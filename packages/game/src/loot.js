// Stage loot rules are independent of rendering and persistence.
export const LOOT_LIMIT=5;
export const ITEMS=Object.freeze({
 'kundun-box':{id:'kundun-box',name:'Box of Kundun +1',model:'loot-kundun-box',color:'#ffd378',kind:'box',description:'Sealed reward box. Keep for future stages.'},
 'jewel-bless':{id:'jewel-bless',name:'Jewel of Bless',model:'loot-jewel-bless',color:'#ffbc68',kind:'jewel'},
 'jewel-soul':{id:'jewel-soul',name:'Jewel of Soul',model:'loot-jewel-soul',color:'#d8a6ff',kind:'jewel'},
 'jewel-life':{id:'jewel-life',name:'Jewel of Life',model:'loot-jewel-life',color:'#ffacda',kind:'jewel'},
 'jewel-chaos':{id:'jewel-chaos',name:'Jewel of Chaos',model:'loot-jewel-chaos',color:'#e9df76',kind:'jewel'}
});
const milestones=[12,35,75,130];
export function createLootState(){return {drops:[],collected:[],dropped:0};}
export function dropLoot(state,enemy,kills,nextId){
 if(state.dropped>=LOOT_LIMIT)return null;
 if(!enemy.elite&&(state.dropped>=4||kills<milestones[state.dropped]))return null;
 // Guardian always drops a second Kundun box if a slot remains.
 const id=enemy.elite?'kundun-box':['kundun-box','jewel-bless','jewel-soul','jewel-life'][state.dropped];
 const drop={uid:nextId(),id,x:enemy.x,z:enemy.z};state.dropped++;state.drops.push(drop);return drop;
}
export function collectLoot(state,x,z,radius=1.8){
 const picked=[];
 state.drops=state.drops.filter(drop=>{if(Math.hypot(drop.x-x,drop.z-z)>radius)return true;const item={id:drop.id,quantity:1};state.collected.push(item);picked.push(item);return false;});
 return picked;
}
export function mergeInventory(existing,collected){
 const counts=new Map();
 for(const item of [...existing,...collected])if(ITEMS[item.id]&&Number.isSafeInteger(item.quantity)&&item.quantity>0)counts.set(item.id,Math.min(9999,(counts.get(item.id)||0)+item.quantity));
 return [...counts].map(([id,quantity])=>({id,quantity}));
}
