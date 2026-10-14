#!/usr/bin/env python3
"""Convert the supplied MU BMD v10/v15 meshes, animation and OZ textures.
No modification of the source client. Bone poses are baked for a small web demo.
"""
from pathlib import Path
import struct, json, math, io, shutil, subprocess, tempfile, os
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT.parent/'Mu Eternals S20 1-2'/'Data'
OUT=ROOT/'apps'/'ui'/'public'/'assets'
manifest={}
class Reader:
 def __init__(self,data): self.data=data; self.o=4
 def read(self,fmt):
  v=struct.unpack_from('<'+fmt,self.data,self.o); self.o+=struct.calcsize('<'+fmt); return v[0] if len(v)==1 else v
 def skip(self,n): self.o+=n
 def string(self):
  s=self.data[self.o:self.o+32].split(b'\0')[0].decode('latin1');self.o+=32;return s

def parse(path):
 data=path.read_bytes()
 if data[:4]==b'BMD\x0f':
  with tempfile.TemporaryDirectory() as temp:
   decoded=Path(temp)/'plain.bmd'
   subprocess.run([os.environ.get('MU_NODE','node'),str(ROOT/'scripts'/'decode-player.mjs'),str(path),str(decoded)],check=True)
   data=decoded.read_bytes()
 if data[:4]!=b'BMD\x0a': raise ValueError('unsupported BMD format')
 r=Reader(data); name=r.string(); nm,nb,na=r.read('3h'); meshes=[]
 for i in range(nm):
  nv,nn,nu,nt,tex=r.read('5h'); vv=[]
  for j in range(nv): vv.append(r.read('h2x3f'))
  r.skip(nn*20);uv=[r.read('2f') for _ in range(nu)];tri=[]
  for j in range(nt):
   o=r.o;poly=r.read('B');r.skip(1);vi=r.read('4h');r.skip(8);ui=r.read('4h');r.o=o+64
   tri.append((vi,ui))
  texture=r.string();meshes.append((vv,uv,tri,texture))
 actions=[]
 for i in range(na):
  keys,lock=r.read('hB');actions.append(keys)
  if lock:r.skip(keys*12)
 bones=[]
 for i in range(nb):
  dummy=r.read('B')
  if dummy: bones.append(None);continue
  name=r.string();parent=r.read('h'); anim=[]
  for keys in actions:
   pos=[r.read('3f') for _ in range(keys)];rot=[r.read('3f') for _ in range(keys)];anim.append((pos,rot))
  bones.append((parent,anim,name))
 assert 0<=len(data)-r.o<=16,(path,r.o,len(data))
 return meshes,bones,actions

def matrices(bones,action=0,frame=0):
 # Interpolate native bone rotations before baking, rather than repeating integer keys.
 result=[]
 def quat(rot):
  x,y,z=[v/2 for v in rot];cx,sx=math.cos(x),math.sin(x);cy,sy=math.cos(y),math.sin(y);cz,sz=math.cos(z),math.sin(z)
  return np.array([sx*cy*cz-cx*sy*sz,cx*sy*cz+sx*cy*sz,cx*cy*sz-sx*sy*cz,cx*cy*cz+sx*sy*sz])
 for b in bones:
  if b is None:result.append(np.eye(4));continue
  parent,anim=b[:2];p,rot=anim[action];lo=int(math.floor(frame))%len(rot);hi=(lo+1)%len(rot);blend=frame-math.floor(frame)
  qa=quat(rot[lo]);qb=quat(rot[hi]);qb=qb if np.dot(qa,qb)>=0 else -qb;q=qa*(1-blend)+qb*blend;q/=np.linalg.norm(q);x,y,z,w=q
  m=np.eye(4);m[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
  m[:3,3]=np.array(p[lo])*(1-blend)+np.array(p[hi])*blend
  if parent>=0:m=result[parent]@m
  result.append(m)
 return result

def texture(folder,name):
 stem=Path(name.replace('\\','/')).stem.lower();files={p.stem.lower():p for p in folder.iterdir() if p.suffix.lower() in ['.ozj','.ozt','.jpg','.tga']}
 if stem not in files:return None
 p=files[stem]
 preferred='.ozt' if Path(name).suffix.lower() in ['.tga','.ozt'] else '.ozj'
 for candidate in folder.iterdir():
  if candidate.stem.lower()==stem and candidate.suffix.lower()==preferred:p=candidate;break
 variant='-alpha' if p.suffix.lower() in ['.ozt','.tga'] else ''
 dest=OUT/'textures'/f'{folder.name.lower()}-{stem}{variant}.png'
 if not dest.exists():
  data=p.read_bytes()
  if p.suffix.lower()=='.ozj':
   # MU prepends 24 bytes to the original JPG.
   start=data.find(b'\xff\xd8',2); im=Image.open(io.BytesIO(data[start:]))
  elif p.suffix.lower()=='.ozt':im=Image.open(io.BytesIO(data[4:]))
  else:im=Image.open(p)
  im.save(dest)
 return 'assets/textures/'+dest.name

def convert(key,paths,animate=False,playerRig=None):
 parts=[];bounds=[]; clips={}; matsForClips=[]
 if playerRig:
  rig,rigActions=playerRig
  # S20 action layout, verified by alternating foot motion. Older 15/25 indices are idle poses here.
  indices={"knight":(4,53,60,136,147),"wizard":(10,56,64,149,148),"elf":(8,55,62,122,122)}[key.split("-")[0]]
  for label,action,count in zip(["idle","walk","run","attack","attack2"],indices,[8,16,16,16,16]):
   clips[label]={"start":len(matsForClips),"count":count,"fps":count*(.65 if label=="idle" else 1.15 if label=="walk" else 1.7),"sourceAction":action}
   for i in range(count):
    mats=matrices(rig,action,i*(rigActions[action]-1)/count)
    if label in ['walk','run','attack','attack2']:
     # Simulation supplies world movement; remove animated root translation in the ground plane.
     root=mats[0][:2,3].copy()
     for m in mats:m[:2,3]-=root
    matsForClips.append(mats)
 for path in paths:
  meshes,bones,actions=parse(path);mat=matrices(bones) if actions else [np.eye(4)]*len(bones)
  # Walk is action 2 for classic monsters. Export four sampled poses.
  action=min(2,len(actions)-1); frames=matsForClips
  if playerRig:mat=matsForClips[0]
  if animate and action>=0:frames=[matrices(bones,action,int(i*actions[action]/4)) for i in range(4)]
  for vv,uv,tri,tex in meshes:
   if playerRig and tex.lower().startswith('hide'):continue
   resolved=tex
   if playerRig and tex.lower().startswith(('skin','level')):
    resolved={'knight':'skin_barbarian_01.jpg','wizard':'skin_wizard_01.jpg','elf':'skin_archer_01.jpg'}[key.split('-')[0]]
   positions=[];uvs=[];morph=[[] for _ in frames]
   def transform(v,mats):
    node,x,y,z=v;vec=np.array([x,y,z,1]);v=mats[node]@vec if node>=0 else vec
    return [round(float(v[0])/100,5),round(float(v[2])/100,5),round(-float(v[1])/100,5)]
   for vi,ui in tri:
    for k in range(3):
     positions.extend(transform(vv[vi[k]],mat));uvs.extend([uv[ui[k]][0],1-uv[ui[k]][1]])
     for idx,m in enumerate(frames):morph[idx].extend(transform(vv[vi[k]],m))
   if positions:
    part={'positions':positions,'uvs':uvs,'texture':texture(path.parent,resolved),'sourceTexture':tex,'resolvedTexture':resolved,'sourceModel':str(path.relative_to(SOURCE)),'slot':{'Helm':'helm','Armor':'armor','Pant':'pants','t_Pant':'pants','Glove':'gloves','Boot':'boots'}.get(next((prefix for prefix in ['t_Pant','Helm','Armor','Pant','Glove','Boot'] if path.stem.startswith(prefix)),''))}
    if playerRig:part['upperBody']=sum(v[0]>=17 for v in vv)>len(vv)/2
    if morph:part['frames']=morph
    parts.append(part);bounds.extend(np.array(positions).reshape(-1,3).tolist())
 a=np.array(bounds);minimum=a.min(axis=0);maximum=a.max(axis=0)
 result={'parts':parts,'min':minimum.tolist(),'max':maximum.tolist()}
 if clips:
  result['clips']=clips;result['sockets']={}
  axis=np.array([[1,0,0],[0,0,1],[0,-1,0]])
  for label,node in [('right',33),('left',42)]:
   result['sockets'][label]=[]
   for mats in matsForClips:
    m=mats[node];out=np.eye(4);out[:3,:3]=axis@m[:3,:3]@axis.T;out[:3,3]=axis@m[:3,3]/100
    result['sockets'][label].append([round(float(v),6) for v in out.T.flatten()])
 dest=OUT/'models'/f'{key}.json';dest.write_text(json.dumps(result,separators=(',',':')))
 manifest[key]={'source':[str(p.relative_to(SOURCE)) for p in paths],'file':'assets/models/'+dest.name,'triangles':sum(len(p['positions'])//9 for p in parts),'height':float(maximum[1]-minimum[1])}
 print(key,len(parts),'parts',manifest[key]['triangles'],'triangles',manifest[key]['height'],'height')

def convert_terrain():
 folder=SOURCE/'World1'; mapping=(folder/'Terrain.map').read_bytes(); count=256*256
 assert len(mapping)==1+count*3
 layers=[mapping[1+i*count:1+(i+1)*count] for i in range(3)]
 names=['TileGrass01','TileGrass02','TileGround01','TileGround02','TileGround03','TileWater01','TileWood01','TileRock01','TileRock02','TileRock03']
 tiles=[]
 for name in names:
  url=texture(folder,name+'.OZJ');tiles.append(Image.open(OUT.parent/url).convert('RGBA'))
 size=80;startX=90;startY=90;px=32;image=Image.new('RGB',(size*px,size*px))
 for y in range(size):
  for x in range(size):
   tx=startX+x;ty=startY+y;i=ty*256+tx
   def sample(index):
    im=tiles[index if index<len(tiles) else 0];sx=(tx*64)%im.width;sy=(ty*64)%im.height
    return im.crop((sx,sy,sx+64,sy+64)).resize((px,px))
   base=sample(0);base=Image.alpha_composite(base,sample(layers[0][i]));overlay=layers[1][i];alpha=layers[2][i]/255
   if overlay<len(tiles) and alpha>0:
    top=sample(overlay);top.putalpha(top.getchannel('A').point(lambda v:int(v*alpha)));base=Image.alpha_composite(base,top)
   image.paste(base.convert('RGB'),(x*px,y*px))
 image.save(OUT/'textures'/'lorencia-terrain.jpg',quality=90)
 raw=(folder/'TerrainHeight.OZB').read_bytes()[-count:]
 heights=[]
 for y in range(size+1):
  for x in range(size+1):heights.append(round((raw[(startY+y)*256+startX+x]-110)*.015,4))
 (OUT/'lorencia-terrain.json').write_text(json.dumps({'size':size,'spacing':2,'heights':heights,'source':['World1/Terrain.map','World1/TerrainHeight.OZB'],'origin':[startX,startY]},separators=(',',':')))
 print('Lorencia terrain: original tile layers + height field, 80 × 80 tiles')

def convert_world_objects():
 mapping={}
 for start,name,count in [(0,'Tree',13),(20,'Grass',8),(30,'Stone',5),(40,'StoneStatue',3),(44,'Tomb',3),(50,'FireLight',2),(56,'MerchantAnimal',2),(65,'SteelWall',3),(69,'StoneWall',6),(75,'StoneMuWall',4),(81,'Fence',4),(91,'Cannon',3),(96,'Sign',2),(98,'Carriage',4),(102,'Straw',2),(106,'Well',4),(115,'House',5),(121,'HouseWall',6),(127,'HouseEtc',3),(130,'Light',3),(140,'Furniture',7),(151,'Beer',3)]:
  for n in range(count):mapping[start+n]=name+f'{n+1:02}'
 mapping.update({43:'SteelStatue01',52:'Bonfire01',55:'DoungeonGate01',58:'TreasureDrum01',59:'TreasureChest01',60:'Ship01',68:'SteelDoor01',80:'Bridge01',85:'BridgeStone01',90:'StreetLight01',95:'Curtain01',105:'Waterspout01',110:'Hanging01',111:'Stair01',120:'Tent01',133:'PoseBox01',150:'Candle01'})
 data=(SOURCE/'World1'/'Terrain.obj').read_bytes();n=struct.unpack_from('<h',data,1)[0];objects=[];converted=set()
 for i in range(n):
  kind,x,y,z,ax,ay,az,scale=struct.unpack_from('<h7f',data,3+i*30)
  if not (90<=x/100<=170 and 90<=y/100<=170) or kind not in mapping:continue
  key=f'lorencia-{kind}'
  if key not in converted:
   convert(key,[SOURCE/'Object1'/(mapping[kind]+'.bmd')]);converted.add(key)
  objects.append({'model':key,'type':kind,'position':[(x/100-130)*2,z/100*2-3.3,-(y/100-130)*2],'rotation':[math.radians(ax),math.radians(az),-math.radians(ay)],'scale':scale*2})
 (OUT/'lorencia-objects.json').write_text(json.dumps({'source':'World1/Terrain.obj','objects':objects,'models':sorted(converted)},separators=(',',':')))
 print('Lorencia: '+str(len(objects))+' ORIGINAL object placements')

if __name__=='__main__':
 for d in ['models','textures','audio']:(OUT/d).mkdir(parents=True,exist_ok=True)
 player=SOURCE/'Player'
 # Decode once offline; no cipher or encrypted client files are shipped to the UI.
 with tempfile.TemporaryDirectory() as temp:
  decoded=Path(temp)/'player.bmd'
  subprocess.run([os.environ.get('MU_NODE','node'),str(ROOT/'scripts'/'decode-player.mjs'),str(player/'player.bmd'),str(decoded)],check=True)
  _,rig,rigActions=parse(decoded)
 playerRig=(rig,rigActions)
 for key,setname in [('knight','Class02'),('wizard','Class01'),('elf','Class03'),('knight-armor','Male18'),('wizard-armor','Male19'),('elf-armor','Elf05')]:
  convert(key,[player/f"{'t_' if part=='Pant' and setname=='Male19' else ''}{part}{setname}.bmd" for part in ['Helm','Armor','Pant','Glove','Boot']],playerRig=playerRig)
 for hero,suffix in [('knight','Male18'),('wizard','Male19'),('elf','Elf05')]:
  for slot,prefix in [('helm','Helm'),('armor','Armor'),('pants','t_Pant' if hero=='wizard' else 'Pant'),('gloves','Glove'),('boots','Boot')]:convert(f'loot-{hero}-{slot}',[SOURCE/'Item'/f'{prefix}{suffix}.bmd'])
 for key,num in [('spider',10),('budge',3),('bull',1),('hound',2),('giant',11)]:convert(key,[SOURCE/'Monster'/f'Monster{num:02}.bmd'],True)
 for key,name in [('tree','Tree01'),('rock','Stone01'),('statue','StoneStatue01'),('wall','StoneWall01'),('house','House01'),('house2','House02'),('fence','Fence01'),('bonfire','Bonfire01'),('streetlight','StreetLight01'),('well','Well01'),('ruin','StoneMuWall01'),('grass','Grass01')]:
  try:convert(key,[SOURCE/'Object1'/f'{name}.bmd'])
  except ValueError as e: print('skip',name,e)
 for key,name in [('kundun-box','MagicBox01'),('jewel-bless','Jewel01'),('jewel-soul','Jewel02'),('jewel-life','Jewel03'),('jewel-chaos','Jewel15')]:convert('loot-'+key,[SOURCE/'Item'/(name+'.bmd')])
 for name in ['TileGrass01.OZJ','TileGrass02.OZJ','TileGround01.OZJ','TileGround02.OZJ','TileRock01.OZJ']:texture(SOURCE/'World1',name)
 for name in ['Chrome01.OZJ','Chrome02.OZJ','Shiny01.OZJ','AuraWave_Blue_00.OZJ']:texture(SOURCE/'Effect',name)
 for key,name in [('slash','WaveForce'),('arrow','Arrow01'),('ice','Ice01'),('fire','Fire01'),('inferno','Inferno01'),('spirit','Bone01')]:convert('skill-'+key,[SOURCE/'Skill'/(name+'.bmd')])
 for key,name in [('sword','Sword02'),('staff','Staff01'),('bow','Bow01')]:convert('weapon-'+key,[SOURCE/'Item'/(name+'.bmd')])
 for name in ['InventoryBox2.OZJ','newui_item_back01.OZT','newui_item_back04.OZT','newui_item_cap.OZT','newui_item_upper.OZT','newui_item_lower.OZT','newui_item_gloves.OZT','newui_item_boots.OZT','newui_menu01.OZJ','newui_menu02.OZJ','newui_menu03.OZJ','newui_menu_red.OZJ','newui_menu_blue.OZJ','newui_Exbar.OZJ','newui_skill.OZJ','newui_skillbox.OZJ','newui_Party_HpBar.OZJ','newui_Party_Lifebar01.OZJ','newui_Party_Lifebar02.OZJ']:texture(SOURCE/'Interface',name)
 for id,prefix in [('spider','Spider'),('budge','Budge'),('bull','Bull'),('hound','Hound'),('giant','Giant')]:
  for kind,filename in [('idle',f'm{prefix}1.wav'),('attack',f'm{prefix}Attack1.wav' if id!='spider' else 'mSpider1.wav')]:shutil.copy2(SOURCE/'Sound'/filename,OUT/'audio'/f'{kind}-{id}.wav')
 for source,dest in [('Sound/mSpider1.wav','death-spider.wav'),('Sound/mBudgeDie.wav','death-budge.wav'),('Sound/mBullDie.wav','death-bull.wav'),('Sound/mHoundDie.wav','death-hound.wav'),('Sound/mGiantDie.wav','death-giant.wav'),('Sound/pMaleScream1.wav','hurt-knight.wav'),('Sound/pMaleScream2.wav','hurt-wizard.wav'),('Sound/pFemaleScream1.wav','hurt-elf.wav'),('Sound/eMeleeHit1.wav','hit.wav'),('Sound/pDropItem.wav','armor.wav'),('Sound/sEvil.wav','evil.wav'),('Sound/sHellFire.wav','hellfire.wav'),('Sound/eIceArrow.wav','ice.wav'),('Sound/SwordInertiaAttack.wav','stab.wav'),('Music/Pub.mp3','lorencia-pub.mp3'),('Sound/eSwingLightSword.wav','knight.wav'),('Sound/sMagic.wav','wizard.wav'),('Sound/Magic_Arrow_Cast_01.wav','elf.wav'),('Sound/pLevelUp.wav','level-up.wav')]:shutil.copy2(SOURCE/source,OUT/'audio'/dest)
 convert_world_objects()
 convert_terrain()
 from asset_catalog import write_catalog
 write_catalog(SOURCE,OUT)
 (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
