#!/usr/bin/env python3
"""Convert the original client's unencrypted BMD v10 meshes and OZ textures.
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
 if data[:4]!=b'BMD\x0a': raise ValueError('not plain BMD v10')
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
 assert 0<=len(data)-r.o<16,(path,r.o,len(data))
 return meshes,bones,actions

def matrices(bones,action=0,frame=0):
 result=[]
 for b in bones:
  if b is None:result.append(np.eye(4));continue
  parent,anim=b[:2];p,rot=anim[action];rx,ry,rz=rot[frame%len(rot)];cx,sx=math.cos(rx),math.sin(rx);cy,sy=math.cos(ry),math.sin(ry);cz,sz=math.cos(rz),math.sin(rz)
  m=np.eye(4);m[:3,:3]=[[cz*cy,cz*sy*sx-sz*cx,cz*sy*cx+sz*sx],[sz*cy,sz*sy*sx+cz*cx,sz*sy*cx-cz*sx],[-sy,cy*sx,cy*cx]];m[:3,3]=p[frame%len(p)]
  if parent>=0:m=result[parent]@m
  result.append(m)
 return result

def texture(folder,name):
 stem=Path(name.replace('\\','/')).stem.lower();files={p.stem.lower():p for p in folder.iterdir() if p.suffix.lower() in ['.ozj','.ozt','.jpg','.tga']}
 if stem not in files:return None
 p=files[stem];dest=OUT/'textures'/f'{folder.name.lower()}-{stem}.png'
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
  indices={"knight":(4,17,26),"wizard":(10,23,32),"elf":(8,21,30)}[key]
  for label,action,count in zip(["idle","walk","run"],indices,[4,8,8]):
   clips[label]={"start":len(matsForClips),"count":count,"fps":count*(.7 if label=="idle" else 1.1 if label=="walk" else 1.65)}
   matsForClips.extend(matrices(rig,action,int(i*(rigActions[action]-1)/count)) for i in range(count))
 for path in paths:
  meshes,bones,actions=parse(path);mat=matrices(bones) if actions else [np.eye(4)]*len(bones)
  # Walk is action 2 for classic monsters. Export four sampled poses.
  action=min(2,len(actions)-1); frames=matsForClips
  if playerRig:mat=matsForClips[0]
  if animate and action>=0:frames=[matrices(bones,action,int(i*actions[action]/4)) for i in range(4)]
  for vv,uv,tri,tex in meshes:
   positions=[];uvs=[];morph=[[] for _ in frames]
   def transform(v,mats):
    node,x,y,z=v;vec=np.array([x,y,z,1]);v=mats[node]@vec if node>=0 else vec
    return [round(float(v[0])/100,5),round(float(v[2])/100,5),round(-float(v[1])/100,5)]
   for vi,ui in tri:
    for k in range(3):
     positions.extend(transform(vv[vi[k]],mat));uvs.extend([uv[ui[k]][0],1-uv[ui[k]][1]])
     for idx,m in enumerate(frames):morph[idx].extend(transform(vv[vi[k]],m))
   if positions:
    part={'positions':positions,'uvs':uvs,'texture':texture(path.parent,tex)}
    if morph:part['frames']=morph
    parts.append(part);bounds.extend(np.array(positions).reshape(-1,3).tolist())
 a=np.array(bounds);minimum=a.min(axis=0);maximum=a.max(axis=0)
 result={'parts':parts,'min':minimum.tolist(),'max':maximum.tolist()}
 if clips:result['clips']=clips
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
  url=texture(folder,name+'.OZJ');tiles.append(Image.open(OUT.parent/url).convert('RGB'))
 size=80;startX=90;startY=90;px=32;image=Image.new('RGB',(size*px,size*px))
 for y in range(size):
  for x in range(size):
   tx=startX+x;ty=startY+y;i=ty*256+tx
   def sample(index):
    im=tiles[index if index<len(tiles) else 0];sx=(tx*64)%im.width;sy=(ty*64)%im.height
    return im.crop((sx,sy,sx+64,sy+64)).resize((px,px))
   base=sample(layers[0][i]);overlay=layers[1][i];alpha=layers[2][i]/255
   if overlay<len(tiles) and alpha>0:base=Image.blend(base,sample(overlay),alpha)
   image.paste(base,(x*px,y*px))
 image.save(OUT/'textures'/'lorencia-terrain.jpg',quality=90)
 raw=(folder/'TerrainHeight.OZB').read_bytes()[-count:]
 heights=[]
 for y in range(size+1):
  for x in range(size+1):heights.append(round((raw[(startY+y)*256+startX+x]-110)*.015,4))
 (OUT/'lorencia-terrain.json').write_text(json.dumps({'size':size,'spacing':2,'heights':heights,'source':['World1/Terrain.map','World1/TerrainHeight.OZB'],'origin':[startX,startY]},separators=(',',':')))
 print('Lorencia terrain: original tile layers + height field, 80 × 80 tiles')

if __name__=='__main__':
 for d in ['models','textures','audio']:(OUT/d).mkdir(parents=True,exist_ok=True)
 player=SOURCE/'Player'
 # Decode once offline; no cipher or encrypted client files are shipped to the UI.
 with tempfile.TemporaryDirectory() as temp:
  decoded=Path(temp)/'player.bmd'
  subprocess.run([os.environ.get('MU_NODE','node'),str(ROOT/'scripts'/'decode-player.mjs'),str(player/'player.bmd'),str(decoded)],check=True)
  _,rig,rigActions=parse(decoded)
 playerRig=(rig,rigActions)
 for key,setname in [('knight','Male02'),('wizard','Male04'),('elf','Elf03')]:
  convert(key,[player/f'{part}{setname}.bmd' for part in ['Helm','Armor','Pant','Glove','Boot']],playerRig=playerRig)
 for key,num in [('spider',10),('budge',3),('bull',4),('hound',2),('giant',11)]:convert(key,[SOURCE/'Monster'/f'Monster{num:02}.bmd'],True)
 for key,name in [('tree','Tree01'),('rock','Stone01'),('statue','StoneStatue01'),('wall','StoneWall01'),('house','House01'),('house2','House02'),('fence','Fence01'),('bonfire','Bonfire01'),('streetlight','StreetLight01'),('well','Well01'),('ruin','StoneMuWall01'),('grass','Grass01')]:
  try:convert(key,[SOURCE/'Object1'/f'{name}.bmd'])
  except ValueError as e: print('skip',name,e)
 for name in ['TileGrass01.OZJ','TileGrass02.OZJ','TileGround01.OZJ','TileGround02.OZJ','TileRock01.OZJ']:texture(SOURCE/'World1',name)
 for source,dest in [('Music/Pub.mp3','lorencia-pub.mp3'),('Sound/eSwingLightSword.wav','knight.wav'),('Sound/sMagic.wav','wizard.wav'),('Sound/Magic_Arrow_Cast_01.wav','elf.wav'),('Sound/pLevelUp.wav','level-up.wav')]:shutil.copy2(SOURCE/source,OUT/'audio'/dest)
 convert_terrain()
 (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
