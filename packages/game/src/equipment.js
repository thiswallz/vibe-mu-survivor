// Equipment rules have no renderer, browser, or storage dependencies.
export const SLOTS=['helm','armor','pants','gloves','boots'];
export const SLOT_LABELS={helm:'Helm',armor:'Armor',pants:'Pants',gloves:'Gloves',boots:'Boots'};
export const SET_NAMES={knight:'Dark Phoenix',wizard:'Grand Soul',elf:'Guardian'};
export const ARMOR_ITEMS=Object.freeze(Object.fromEntries(Object.entries(SET_NAMES).flatMap(([hero,set])=>SLOTS.map(slot=>{
 const id=`${hero}-${slot}`;return [id,{id,name:`${set} ${SLOT_LABELS[slot]}`,hero,slot,kind:'equipment',model:`loot-${id}`,color:hero==='knight'?'#ffc476':hero==='wizard'?'#b1baff':'#94e4b3'}];
}))));
export function itemKey(item){return `${item.id}:${item.enhancement||0}`;}
export function validEnhancement(value){return Number.isInteger(value)&&value>=0&&value<=15;}
export function emptyEquipment(){return Object.fromEntries(SLOTS.map(slot=>[slot,null]));}
export function sanitizeEquipment(hero,equipment,items){
 const result=emptyEquipment();for(const slot of SLOTS){const item=equipment?.[slot],def=ARMOR_ITEMS[item?.id];if(def?.hero===hero&&def.slot===slot&&validEnhancement(item.enhancement||0)&&items.some(owned=>itemKey(owned)===itemKey(item)))result[slot]={id:item.id,enhancement:item.enhancement||0};}return result;
}
export function applyEquipment(run){
 const pieces=Object.values(run.equipment).filter(Boolean);const bonus=pieces.length*7;
 const difference=bonus-(run.gearHp||0);run.maxHp+=difference;if(run.hp>0)run.hp=Math.max(1,Math.min(run.maxHp,run.hp+difference));
 run.gearHp=bonus;run.gearDefense=Math.min(.38,pieces.reduce((sum,item)=>sum+.035+(item.enhancement||0)*.0015,0));
 run.armorEquipped=pieces.length>0;run.enhancement=Math.max(0,...pieces.map(i=>i.enhancement||0));
}
export function equipItem(run,item){
 const def=ARMOR_ITEMS[item?.id];if(!def||def.hero!==run.hero.id||!run.inventory.some(owned=>itemKey(owned)===itemKey(item)))return false;
 run.equipment[def.slot]={id:item.id,enhancement:item.enhancement||0};applyEquipment(run);return true;
}
export function unequipSlot(run,slot){if(!SLOTS.includes(slot))return false;run.equipment[slot]=null;applyEquipment(run);return true;}
export function autoEquip(run,item){const def=ARMOR_ITEMS[item.id];return def?.hero===run.hero.id&&!run.equipment[def.slot]?equipItem(run,item):false;}
export function chooseDropSlots(hero,equipment,random=Math.random){
 const missing=SLOTS.filter(slot=>!equipment?.[slot]),occupied=SLOTS.filter(slot=>equipment?.[slot]);
 for(const slots of [missing,occupied])for(let i=slots.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[slots[i],slots[j]]=[slots[j],slots[i]];}
 return [...missing,...occupied];
}
