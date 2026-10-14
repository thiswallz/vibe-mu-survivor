// Keep client placements, but only props that fit a small survivor arena.
export function keepArenaProp(type,bounds){
 const allowed=type<=34||(type>=40&&type<=46)||[58,59,90,96,97,98,99,100,101,102,103,106,107,108,109].includes(type);
 return allowed&&bounds.height<=4.5&&bounds.width<=7&&bounds.depth<=7;
}
export function solidArenaProp(type,bounds){return !(type>=20&&type<=27)&&![50,51].includes(type)&&bounds.height>.45&&bounds.width>.25&&bounds.depth>.25;}
