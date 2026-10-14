"""Read the supplied S20 item table instead of guessing names from texture numbers."""
import struct,re,json
SETS={'knight-armor':('Male18','Dark Phoenix'),'wizard-armor':('Male19','Grand Soul'),'elf-armor':('Elf05','Guardian')}
def write_catalog(source,out):
 raw=(source/'Local/item.bmd').read_bytes();count=struct.unpack_from('<I',raw)[0];size=(len(raw)-8)//count
 if size!=700:raise ValueError('Unsupported S20 item record layout')
 records=[]
 for i in range(count):
  data=bytes(v^[252,207,171][j%3] for j,v in enumerate(raw[4+i*size:4+(i+1)*size]));strings=[t.decode('latin1') for t in re.findall(rb'[ -~]{5,}',data)]
  records.append((struct.unpack_from('<IHH',data),strings))
 catalog={}
 for key,(suffix,expected) in SETS.items():
  pieces=[]
  for part in ['Helm','Armor','Pant','Glove','Boot']:
   model=('t_' if part=='Pant' and suffix=='Male19' else '')+part+suffix+'.bmd';match=next(((head,strings) for head,strings in records if model in strings and not any('[Bound]' in s for s in strings)),None)
   if not match:raise ValueError('Item table missing '+model)
   head,strings=match;name=strings[strings.index(model)+1]
   pieces.append({'name':name,'itemId':head[0],'category':head[1],'index':head[2],'sourceModel':'Player/'+model})
  armor=next(p for p in pieces if p['category']==8)
  if not armor['name'].startswith(expected):raise ValueError('Unexpected armor name '+armor['name'])
  catalog[key]={'name':expected+' Set','source':'Local/item.bmd','pieces':pieces}
 for key,suffix in [('knight','Class02'),('wizard','Class01'),('elf','Class03')]:
  catalog[key]={'name':'Unarmored','source':'Player/'+suffix,'pieces':[{'name':part+' body','sourceModel':f'Player/{part}{suffix}.bmd'} for part in ['Helm','Armor','Pant','Glove','Boot']]}
 (out/'armor-catalog.json').write_text(json.dumps(catalog,indent=2))
