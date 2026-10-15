"""Build authored survivor arenas with offline-converted MU world textures and props."""
import importlib.util, json, math, random, shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
root=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('mu_assets',root/'convert-assets.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
out=c.OUT
(out/'stages').mkdir(exist_ok=True)
manifest_path=out/'manifest.json'; manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
worlds=[('noria',4),('devias',3)]
for world,number in worlds:
    shutil.copy2(c.SOURCE/'Music'/f'{world.title()}.mp3',out/'audio'/f'{world}.mp3')
    models=[]
    for i in [1,2,3,4,5,6]:
        key=f'{world}-{i-1}'
        c.convert(key,[c.SOURCE/f'Object{number}'/f'Object{i:02}.bmd'])
        models.append(key)
    folder=c.SOURCE/f'World{number}'
    tiles=[]
    for filename in ['TileGrass01.OZJ','TileGround01.OZJ','TileRock01.OZJ']:
        url=c.texture(folder,filename)
        tiles.append(Image.open(out.parent/url).convert('RGB').resize((128,128)))
    for variant in [1,2]:
        rng=random.Random(number*100+variant)
        layers=[]
        for tile in tiles:
            layer=Image.new('RGB',(2048,2048))
            for y in range(16):
                for x in range(16):layer.paste(tile,(x*128,y*128))
            layers.append(layer)
        mask=Image.new('L',(2048,2048));draw=ImageDraw.Draw(mask)
        draw.line([(1024,0),(1024,2048)] if variant==1 else [(0,0),(2048,2048)],fill=180,width=220)
        mask=mask.filter(ImageFilter.GaussianBlur(85))
        terrain=Image.composite(layers[1],layers[0],mask)
        patches=Image.new('L',(2048,2048));draw=ImageDraw.Draw(patches)
        for _ in range(18):
            x=rng.randrange(2048);y=rng.randrange(2048);r=rng.randrange(35,90)
            draw.ellipse((x-r,y-r,x+r,y+r),fill=65)
        terrain=Image.composite(layers[2],terrain,patches.filter(ImageFilter.GaussianBlur(30)))
        texture_name=f'{world}-{variant}-terrain.jpg'
        terrain.save(out/'textures'/texture_name,quality=90)
        size=80
        heights=[round(.22*math.sin(x*.23+variant)*math.cos(y*.19+number),4) for y in range(size+1) for x in range(size+1)]
        (out/'stages'/f'{world}-{variant}-terrain.json').write_text(json.dumps({'size':size,'spacing':2,'heights':heights,'source':f'Authored survivor arena; native World{number} terrain textures.'},separators=(',',':')),encoding='utf-8')
        placements=[]
        for i in range(90):
            angle=rng.random()*math.tau
            radius=rng.uniform(17,68)
            x=math.cos(angle)*radius; z=math.sin(angle)*radius
            if variant==2 and abs(x)<8 and abs(z)<34:continue
            if abs(x-10)<6 and abs(z)<6:continue
            key=models[i%len(models)]
            target=rng.uniform(2,4.2)
            scale=target/c.manifest[key]['height']
            placements.append({'model':key,'type':i%6,'position':[round(x,3),0,round(z,3)],'rotation':[0,rng.random()*math.tau,0],'scale':scale})
        (out/'stages'/f'{world}-{variant}-objects.json').write_text(json.dumps({'models':models,'source':f'Authored layout using native Object{number} meshes; map {variant}.','objects':placements},separators=(',',':')),encoding='utf-8')
# A second Lorencia arena reuses the bundled native props but has its own layout.
rng=random.Random(102); base=json.loads((out/'lorencia-objects.json').read_text(encoding='utf-8')); layout=[]
for i in range(100):
    original=dict(base['objects'][i%len(base['objects'])]); angle=rng.random()*math.tau; radius=rng.uniform(16,65)
    original['position']=[round(math.cos(angle)*radius,3),original['position'][1],round(math.sin(angle)*radius,3)]
    layout.append(original)
(out/'stages'/'lorencia-2-objects.json').write_text(json.dumps({'models':base['models'],'source':'Authored crossroads arena using bundled Lorencia props.','objects':layout},separators=(',',':')),encoding='utf-8')
manifest.update(c.manifest);manifest_path.write_text(json.dumps(manifest,indent=2),encoding='utf-8')
(out/'world-catalog.json').write_text(json.dumps({'sourceClient':'Nexus MU Online','terrainSources':{'noria':['World4/TileGrass01.OZJ','World4/TileGround01.OZJ','World4/TileRock01.OZJ'],'devias':['World3/TileGrass01.OZJ','World3/TileGround01.OZJ','World3/TileRock01.OZJ']},'layout':'Original small survivor arenas inspired by MU. Native encrypted map placements are not imported.'},indent=2),encoding='utf-8')
