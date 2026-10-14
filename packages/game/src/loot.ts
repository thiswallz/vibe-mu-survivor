import type {ItemDefinition,LootState,PointXZ,GameState,InventoryItem,HeroId,EquipmentSlot} from '@mu-survivor/models';
import {ARMOR_ITEMS,itemKey,validEnhancement} from './equipment.js';
export const LOOT_LIMIT=5;
export const ITEMS:Readonly<Record<string,ItemDefinition>>=Object.freeze({
 'kundun-box':{id:'kundun-box',name:'Box of Kundun +1',model:'loot-kundun-box',color:'#ffd378',kind:'box',description:'Open for an equipment piece for the selected hero.'},
 'jewel-bless':{id:'jewel-bless',name:'Jewel of Bless',model:'loot-jewel-bless',color:'#ffbc68',kind:'jewel'},
 'jewel-soul':{id:'jewel-soul',name:'Jewel of Soul',model:'loot-jewel-soul',color:'#d8a6ff',kind:'jewel'},
 'jewel-life':{id:'jewel-life',name:'Jewel of Life',model:'loot-jewel-life',color:'#ffacda',kind:'jewel'},
 'jewel-chaos':{id:'jewel-chaos',name:'Jewel of Chaos',model:'loot-jewel-chaos',color:'#e9df76',kind:'jewel'},
 ...ARMOR_ITEMS
});
const milestones=[4,15,35,65];
export function createLootState():LootState{return {drops:[],collected:[],dropped:0};}
export function dropLoot(state:LootState,enemy:PointXZ & {elite?:boolean},kills:number,nextId:()=>number,run?:GameState){
 if(state.dropped>=LOOT_LIMIT)return null;
 if(!enemy.elite&&(state.dropped>=4||kills<milestones[state.dropped]))return null;
 const index=state.dropped;
 const id=enemy.elite?'kundun-box':run?`${run.hero.id}-${run.dropSlots[index]}`:['kundun-box','jewel-bless','jewel-soul','jewel-life'][index];
 const enhancement=ITEMS[id].kind==='equipment'?(run.wave>=8?15:run.wave>=5?13:0):0;
 const drop={uid:nextId(),id,enhancement,x:enemy.x,z:enemy.z};state.dropped++;state.drops.push(drop);return drop;
}
export function collectLoot(state:LootState,x:number,z:number,radius=1.8){
 const picked:InventoryItem[]=[];state.drops=state.drops.filter(drop=>{if(Math.hypot(drop.x-x,drop.z-z)>radius)return true;const item={id:drop.id,enhancement:drop.enhancement||0,quantity:1};state.collected.push(item);picked.push(item);return false;});return picked;
}
export function mergeInventory(existing:InventoryItem[],collected:InventoryItem[]){
 const items=new Map<string,InventoryItem>();for(const item of [...existing,...collected]){
  const enhancement=item.enhancement||0;if(!ITEMS[item.id]||!Number.isSafeInteger(item.quantity)||item.quantity<=0||!validEnhancement(enhancement))continue;
  const key=itemKey(item),prior=items.get(key);items.set(key,{id:item.id,enhancement,quantity:Math.min(9999,(prior?.quantity||0)+item.quantity)});
 }return [...items.values()];
}
export function takeItem(items:InventoryItem[],item:Pick<InventoryItem,'id'|'enhancement'>){const next=mergeInventory([],items),owned=next.find(i=>itemKey(i)===itemKey(item));if(!owned)return null;owned.quantity--;return next.filter(i=>i.quantity>0);}
export function openKundun(items:InventoryItem[],hero:HeroId,slot:EquipmentSlot,random=Math.random){
 const rest=takeItem(items,{id:'kundun-box'});if(!rest)return null;
 const roll=random(),reward={id:`${hero}-${slot}`,enhancement:roll<.15?15:roll<.5?13:0,quantity:1};if(!ITEMS[reward.id])return null;
 return {items:mergeInventory(rest,[reward]),reward};
}
