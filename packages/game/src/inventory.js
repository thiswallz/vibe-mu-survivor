import {mergeInventory} from './loot.js';
const key='mu-survivor.inventory.v1';
// Replace this adapter with an account/server store later; game loot rules stay unchanged.
export function readInventory(storage){try{const saved=JSON.parse((storage||globalThis.localStorage).getItem(key)||'null');return saved?.version===1&&Array.isArray(saved.items)?mergeInventory([],saved.items):[];}catch{return [];}}
export function bankRun(run,storage){
 if(run.lootBanked)return run.lootSaveResult;
 const items=mergeInventory(readInventory(storage),run.loot.collected);
 try{(storage||globalThis.localStorage).setItem(key,JSON.stringify({version:1,items}));run.lootBanked=true;return run.lootSaveResult={saved:true,items};}catch{return run.lootSaveResult={saved:false,items};}
}
