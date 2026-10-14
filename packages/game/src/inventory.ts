import type {
  InventoryProfile,
  InventoryStorage,
  HeroId,
  GameState,
  InventoryItem,
  InventorySaveResult,
  EquipmentActor,
} from '@mu-survivor/models';
import { mergeInventory } from './loot.js';
import { sanitizeEquipment, emptyEquipment } from './equipment.js';
const key = 'mu-survivor.inventory.v1';
const heroes: HeroId[] = ['knight', 'wizard', 'elf'];
function emptyProfile(): InventoryProfile {
  return {
    version: 3,
    items: [],
    loadouts: { knight: emptyEquipment(), wizard: emptyEquipment(), elf: emptyEquipment() },
  };
}
export function readProfile(storage?: InventoryStorage): InventoryProfile {
  try {
    const raw = JSON.parse(
      (storage || globalThis.localStorage).getItem(key) || 'null',
    ) as Partial<InventoryProfile> | null;
    const items =
      raw && [1, 2, 3].includes(raw.version || 0) && Array.isArray(raw.items)
        ? mergeInventory([], raw.items)
        : [];
    const profile = emptyProfile();
    profile.items = items;
    for (const hero of heroes) {
      const candidates = Object.values(raw?.loadouts?.[hero] || {})
        .filter((item) => item !== null)
        .map((item) => ({ ...item, quantity: 1 }));
      profile.loadouts[hero] = sanitizeEquipment(
        hero,
        raw?.loadouts?.[hero],
        raw?.version === 3 ? mergeInventory([], candidates) : items,
      );
      if (raw?.version !== 3) {
        for (const item of Object.values(profile.loadouts[hero])) {
          if (!item) continue;
          const owned = profile.items.find(
            (entry) => entry.id === item.id && (entry.enhancement || 0) === item.enhancement,
          );
          if (owned) owned.quantity--;
        }
      }
    }
    profile.items = profile.items.filter((item) => item.quantity > 0);
    return profile;
  } catch {
    return emptyProfile();
  }
}
export function readInventory(storage?: InventoryStorage) {
  return readProfile(storage).items;
}
export function saveProfile(profile: InventoryProfile, storage?: InventoryStorage) {
  try {
    (storage || globalThis.localStorage).setItem(key, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}
export function saveRunInventory(run: EquipmentActor, storage?: InventoryStorage) {
  const profile = readProfile(storage);
  profile.items = mergeInventory([], run.inventory);
  profile.loadouts[run.hero.id] = sanitizeEquipment(
    run.hero.id,
    run.equipment,
    mergeInventory(
      profile.items,
      Object.values(run.equipment)
        .filter((item) => item !== null)
        .map((item) => ({ ...item, quantity: 1 })),
    ),
  );
  return saveProfile(profile, storage);
}
export function bankRun(
  run: Partial<GameState> & { loot: { collected: InventoryItem[] } },
  storage?: InventoryStorage,
): InventorySaveResult {
  if (run.inventory) {
    const saved = saveRunInventory(run as EquipmentActor, storage);
    return { saved, items: run.inventory };
  }
  if (run.lootBanked) return run.lootSaveResult!;
  const profile = readProfile(storage);
  profile.items = mergeInventory(profile.items, run.loot.collected);
  const saved = saveProfile(profile, storage);
  if (saved) run.lootBanked = true;
  return (run.lootSaveResult = { saved, items: profile.items });
}
