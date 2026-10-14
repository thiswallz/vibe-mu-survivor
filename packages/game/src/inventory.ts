import type {InventoryProfile,InventoryStorage,HeroId,GameState,InventoryItem,InventorySaveResult,EquipmentActor} from '@mu-survivor/models';
import {mergeInventory} from './loot.js';
import {sanitizeEquipment,emptyEquipment} from './equipment.js';
const key='mu-survivor.inventory.v1';
export function readProfile(storage?:InventoryStorage):InventoryProfile{
 try{const raw=JSON.parse((storage||globalThis.localStorage).getItem(key)||'null');const items=[1,2].includes(raw?.version)&&Array.isArray(raw.items)?mergeInventory([],raw.items):[];
 return {version:2,items,loadouts:Object.fromEntries(['knight','wizard','elf'].map(hero=>[hero,sanitizeEquipment(hero as HeroId,raw?.loadouts?.[hero as HeroId]||emptyEquipment(),items)])) as InventoryProfile['loadouts']};
 }catch{return {version:2,items:[],loadouts:Object.fromEntries(['knight','wizard','elf'].map(h=>[h,emptyEquipment()])) as InventoryProfile['loadouts']};}
}
export function readInventory(storage?:InventoryStorage){return readProfile(storage?:InventoryStorage):InventoryProfile.items;}
export function saveProfile(profile:InventoryProfile,storage?:InventoryStorage){try{(storage||globalThis.localStorage).setItem(key,JSON.stringify(profile));return true;}catch{return false;}}
export function saveRunInventory(run:EquipmentActor,storage?:InventoryStorage){const profile=readProfile(storage?:InventoryStorage):InventoryProfile;profile.items=mergeInventory([],run.inventory);profile.loadouts[run.hero.id]=sanitizeEquipment(run.hero.id,run.equipment,profile.items);return saveProfile(profile:InventoryProfile,storage?:InventoryStorage);}
export function bankRun(run:Partial<GameState> & {loot:{collected:InventoryItem[]}},storage?:InventoryStorage):InventorySaveResult{
 if(run.inventory){const saved=saveRunInventory(run:EquipmentActor,storage?:InventoryStorage);return {saved,items:run.inventory};}
 if(run.lootBanked)return run.lootSaveResult!;
 const profile=readProfile(storage?:InventoryStorage):InventoryProfile;profile.items=mergeInventory(profile.items,run.loot.collected);const saved=saveProfile(profile:InventoryProfile,storage?:InventoryStorage);if(saved)run.lootBanked=true;return run.lootSaveResult={saved,items:profile.items};
}
