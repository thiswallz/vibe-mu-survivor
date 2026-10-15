"""Add native early/mid armor sets and weapons, keeping existing late sets intact."""
import importlib.util,json,re,struct,tempfile,subprocess,os
from pathlib import Path
root=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('c',root/'convert-assets.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
sets=[('knight','leather','Male06','Leather',1),('knight','plate','Male10','Plate',2),('wizard','pad','Male03','Pad',1),('wizard','legendary','Male04','Legendary',2),('elf','vine','Elf01','Vine',1),('elf','spirit','Elf04','Spirit',2)]
weapons=[('knight','katana','Sword04.bmd','Katana',1),('knight','falchion','Sword08.bmd','Falchion',2),('wizard','serpent-staff','Staff03.bmd','Serpent Staff',1),('wizard','legendary-staff','Staff06.bmd','Legendary Staff',2),('elf','elven-bow','Bow03.bmd','Elven Bow',1),('elf','tiger-bow','Bow05.bmd','Tiger Bow',2)]
_,rig,actions=c.parse(c.SOURCE/'Player'/'player.bmd')
items={}
manifest_path=c.OUT/'manifest.json';manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
for hero,key,suffix,name,tier in sets:
    armor_model=f'{hero}-{key}-armor'
    paths=[c.SOURCE/'Player'/f'{prefix}{suffix}.bmd' for prefix in ['Helm','Armor','Pant','Glove','Boot']]
    c.convert(armor_model,paths,playerRig=(rig,actions))
    for slot,prefix,label in [('helm','Helm','Helm'),('armor','Armor','Armor'),('pants','Pant','Pants'),('gloves','Glove','Gloves'),('boots','Boot','Boots')]:
        item_id=f'{hero}-{key}-{slot}'
        c.convert('loot-'+item_id,[c.SOURCE/'Item'/f'{prefix}{suffix}.bmd'])
        items[item_id]={'id':item_id,'name':f'{name} {label}','hero':hero,'slot':slot,'kind':'equipment','model':'loot-'+item_id,'armorModel':armor_model,'tier':tier,'color':'#c8dfb1' if tier==1 else '#a8caff','setName':name}
for hero,key,source,name,tier in weapons:
    item_id=f'{hero}-{key}'
    c.convert('loot-'+item_id,[c.SOURCE/'Item'/source])
    items[item_id]={'id':item_id,'name':name,'hero':hero,'slot':'weapon','kind':'equipment','model':'loot-'+item_id,'tier':tier,'color':'#c8dfb1' if tier==1 else '#a8caff'}
manifest.update(c.manifest);manifest_path.write_text(json.dumps(manifest,indent=2),encoding='utf-8')
(c.OUT/'expanded-equipment-catalog.json').write_text(json.dumps({'sourceClient':'Nexus MU Online','sets':sets,'weapons':weapons,'items':items},indent=2),encoding='utf-8')
(c.ROOT/'packages/game/src/expanded-equipment.ts').write_text("import type { ItemDefinition } from '@mu-survivor/models';\n// Generated from the native gear conversion catalog.\nexport const EXPANDED_EQUIPMENT: Readonly<Record<string, ItemDefinition>> = "+json.dumps(items,indent=2)+";\n",encoding='utf-8')
