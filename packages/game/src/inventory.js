import {mergeInventory} from './loot.js';
import {sanitizeEquipment,emptyEquipment} from './equipment.js';
const key='mu-survivor.inventory.v1';
export function readProfile(storage){
 try{const raw=JSON.parse((storage||globalThis.localStorage).getItem(key)||'null');const items=[1,2].includes(raw?.version)&&Array.isArray(raw.items)?mergeInventory([],raw.items):[];
 return {version:2,items,loadouts:Object.fromEntries(['knight','wizard','elf'].map(hero=>[hero,sanitizeEquipment(hero,raw?.loadouts?.[hero]||emptyEquipment(),items)]))};
 }catch{return {version:2,items:[],loadouts:Object.fromEntries(['knight','wizard','elf'].map(h=>[h,emptyEquipment()]))};}
}
export function readInventory(storage){return readProfile(storage).items;}
export function saveProfile(profile,storage){try{(storage||globalThis.localStorage).setItem(key,JSON.stringify(profile));return true;}catch{return false;}}
export function saveRunInventory(run,storage){const profile=readProfile(storage);profile.items=mergeInventory([],run.inventory);profile.loadouts[run.hero.id]=sanitizeEquipment(run.hero.id,run.equipment,profile.items);return saveProfile(profile,storage);}
export function bankRun(run,storage){
 if(run.inventory){const saved=saveRunInventory(run,storage);return {saved,items:run.inventory};}
 if(run.lootBanked)return run.lootSaveResult;
 const profile=readProfile(storage);profile.items=mergeInventory(profile.items,run.loot.collected);const saved=saveProfile(profile,storage);if(saved)run.lootBanked=true;return run.lootSaveResult={saved,items:profile.items};
}
