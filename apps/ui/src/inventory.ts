import {
  readProfile as read,
  saveProfile as save,
  saveRunInventory as saveRun,
  bankRun as bank,
} from '@mu-survivor/game/inventory';
import { characterStorage } from './account-session.js';
import type {
  InventoryProfile,
  EquipmentActor,
  GameState,
  InventoryItem,
} from '@mu-survivor/models';
export const readProfile = () => read(characterStorage);
export const readInventory = () => readProfile().items;
export const saveProfile = (profile: InventoryProfile) => save(profile, characterStorage);
export const saveRunInventory = (run: EquipmentActor) => saveRun(run, characterStorage);
export const bankRun = (run: Partial<GameState> & { loot: { collected: InventoryItem[] } }) =>
  bank(run, characterStorage);
