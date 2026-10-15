import { EXPANDED_EQUIPMENT } from './expanded-equipment.js';
import type {
  EquipmentSlot,
  HeroId,
  ItemDefinition,
  Equipment,
  EquippedItem,
  InventoryItem,
  EquipmentActor,
} from '@mu-survivor/models';
// Equipment rules have no renderer, browser, or storage dependencies.
export const BODY_SLOTS: EquipmentSlot[] = ['helm', 'armor', 'pants', 'gloves', 'boots'];
export const SLOTS: EquipmentSlot[] = [
  ...BODY_SLOTS,
  'weapon',
  'shield',
  'ringLeft',
  'ringRight',
  'pendant',
  'wings',
  'pet',
];
export const SLOT_LABELS: Record<EquipmentSlot, string> = {
  helm: 'Helm',
  armor: 'Armor',
  pants: 'Pants',
  gloves: 'Gloves',
  boots: 'Boots',
  weapon: 'Weapon',
  shield: 'Shield',
  ringLeft: 'Left ring',
  ringRight: 'Right ring',
  pendant: 'Pendant',
  wings: 'Wings',
  pet: 'Pet',
};
export const SET_NAMES: Record<HeroId, string> = {
  knight: 'Dark Phoenix',
  wizard: 'Grand Soul',
  elf: 'Guardian',
};
export const WEAPON_NAMES: Record<HeroId, string> = {
  knight: 'Giant Sword',
  wizard: 'Staff of Kundun',
  elf: 'Silver Bow',
};
const CLASS_ITEMS: Readonly<Record<string, ItemDefinition>> = Object.freeze(
  Object.fromEntries(
    Object.entries(SET_NAMES).flatMap(([hero, set]) =>
      [...BODY_SLOTS, 'weapon' as EquipmentSlot].map((slot) => {
        const id = `${hero}-${slot}`;
        return [
          id,
          {
            id,
            name: slot === 'weapon' ? WEAPON_NAMES[hero as HeroId] : `${set} ${SLOT_LABELS[slot]}`,
            tier: 3,
            hero: hero as HeroId,
            slot,
            kind: 'equipment' as const,
            model: `loot-${id}`,
            color: hero === 'knight' ? '#ffc476' : hero === 'wizard' ? '#b1baff' : '#94e4b3',
          },
        ];
      }),
    ),
  ),
);
export const ACCESSORY_ITEMS: Readonly<Record<string, ItemDefinition>> = Object.freeze(
  Object.fromEntries(
    [
      {
        id: 'ring-ice',
        name: 'Ring of Ice',
        slot: 'ringLeft',
        slots: ['ringLeft', 'ringRight'],
        bonuses: { defense: 15, vitality: 8 },
        description: 'A protective ring. Can be worn on either hand.',
      },
      {
        id: 'ring-fire',
        name: 'Ring of Fire',
        slot: 'ringLeft',
        slots: ['ringLeft', 'ringRight'],
        bonuses: { defense: 10, attackPower: 8 },
        description: 'A ring that increases attack power. Fits either hand.',
      },
      {
        id: 'pendant-lightning',
        name: 'Pendant of Lightning',
        slot: 'pendant',
        bonuses: { attackPower: 12 },
        description: 'An accessory that increases attack power.',
      },
      {
        id: 'shield-round',
        name: 'Small Shield',
        slot: 'shield',
        bonuses: { defense: 45 },
        description: 'An off-hand shield for all classes in this local build.',
      },
      {
        id: 'wings-angel',
        name: 'Wings of Angel',
        slot: 'wings',
        bonuses: { defense: 20, attackPower: 15 },
        description: 'Wearable wings. Increase attack power and defense.',
      },
      {
        id: 'pet-angel',
        name: 'Guardian Angel',
        slot: 'pet',
        bonuses: { vitality: 35, defense: 20, aura: 1 },
        description: 'A wearable companion. Grants a protective damaging aura only while equipped.',
      },
      {
        id: 'pet-satan',
        name: 'Satan',
        slot: 'pet',
        bonuses: { attackPower: 25 },
        description: 'A wearable companion that increases attack power.',
      },
    ].map((value) => [
      value.id,
      {
        ...value,
        kind: 'equipment',
        model: 'loot-' + value.id,
        color: '#a7d8ff',
      } as ItemDefinition,
    ]),
  ),
);
// Kept as a compatibility export for existing equipment consumers.
export const ARMOR_ITEMS: Readonly<Record<string, ItemDefinition>> = Object.freeze({
  ...CLASS_ITEMS,
  ...EXPANDED_EQUIPMENT,
  ...ACCESSORY_ITEMS,
});
export function fitsSlot(def: ItemDefinition, slot: EquipmentSlot) {
  return (def.slots || [def.slot]).includes(slot);
}
export function itemKey(item: Pick<InventoryItem, 'id' | 'enhancement'>) {
  return `${item.id}:${item.enhancement || 0}`;
}
export function validEnhancement(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 15;
}
export function emptyEquipment(): Equipment {
  return Object.fromEntries(SLOTS.map((slot) => [slot, null])) as Equipment;
}
export function sanitizeEquipment(
  hero: HeroId,
  equipment: Partial<Equipment> | undefined,
  items: InventoryItem[],
) {
  const result = emptyEquipment();
  for (const slot of SLOTS) {
    const item = equipment?.[slot],
      def = ARMOR_ITEMS[item?.id || ''];
    if (
      def &&
      (!def.hero || def.hero === hero) &&
      fitsSlot(def, slot) &&
      item &&
      validEnhancement(item.enhancement || 0) &&
      items.some((owned) => itemKey(owned) === itemKey(item))
    )
      result[slot] = { id: item.id, enhancement: item.enhancement || 0 };
  }
  return result;
}
export function itemName(item: Pick<InventoryItem, 'id' | 'enhancement'>) {
  const def = ARMOR_ITEMS[item.id];
  return def ? `${def.name} +${item.enhancement || 0}` : item.id;
}
export function itemColor(item: Pick<InventoryItem, 'id' | 'enhancement'>) {
  return (item.enhancement || 0) >= 7 ? '#ffe777' : '#dedbd0';
}
export function itemStats(item: Pick<InventoryItem, 'id' | 'enhancement'>) {
  const def = ARMOR_ITEMS[item.id],
    level = item.enhancement || 0;
  const tierScale = def?.tier === 1 ? 0.55 : def?.tier === 2 ? 0.8 : 1;
  const base: Partial<Record<EquipmentSlot, number>> = {
    helm: 20,
    armor: 35,
    pants: 26,
    gloves: 12,
    boots: 15,
    weapon: 0,
  };
  const health: Partial<Record<EquipmentSlot, number>> = {
    helm: 4,
    armor: 12,
    pants: 7,
    gloves: 3,
    boots: 4,
    weapon: 0,
  };
  return {
    defense:
      def?.slot && def.slot !== 'weapon'
        ? Math.round((base[def.slot] || def.bonuses?.defense || 0) * tierScale) +
          level * 2 +
          Math.floor(level * level * 0.3)
        : 0,
    vitality:
      def?.slot && def.slot !== 'weapon'
        ? Math.round((health[def.slot] || def.bonuses?.vitality || 0) * tierScale) +
          Math.floor(level / 3)
        : 0,
    attackPower:
      def?.slot === 'weapon'
        ? Math.round(30 * tierScale) + level * 3
        : (def?.bonuses?.attackPower || 0) + (def?.bonuses?.attackPower ? level : 0),
    aura: def?.bonuses?.aura || 0,
    requiredHero: def?.hero,
  };
}
export function bagItems(run: EquipmentActor) {
  return run.inventory.filter((item) => item.quantity > 0);
}
export function applyEquipment(run: EquipmentActor) {
  const pieces = Object.values(run.equipment).filter(
    (piece): piece is EquippedItem => piece !== null,
  );
  const bonus = pieces.reduce((sum, piece) => sum + itemStats(piece).vitality, 0),
    defense = pieces.reduce((sum, piece) => sum + itemStats(piece).defense, 0);
  const difference = bonus - (run.gearHp || 0);
  run.maxHp += difference;
  if (run.hp > 0) run.hp = Math.max(1, Math.min(run.maxHp, run.hp + difference));
  const nextWeapon = 1 + pieces.reduce((sum, piece) => sum + itemStats(piece).attackPower, 0) / 100;
  run.damage = (run.damage / (run.gearWeaponPower || 1)) * nextWeapon;
  run.gearWeaponPower = nextWeapon;
  run.gearHp = bonus;
  run.gearDefense = Math.min(0.45, defense / (500 + defense));
  run.auraLevel = pieces.reduce((sum, piece) => sum + itemStats(piece).aura, 0);
  run.armorEquipped = BODY_SLOTS.some((slot) => !!run.equipment[slot]);
  run.enhancement = Math.max(0, ...pieces.map((i) => i.enhancement || 0));
}
export function equipItem(
  run: EquipmentActor,
  item: InventoryItem | EquippedItem,
  targetSlot?: EquipmentSlot,
) {
  const def = ARMOR_ITEMS[item?.id || ''];
  if (
    !def ||
    (def.hero && def.hero !== run.hero.id) ||
    !run.inventory.some((owned) => itemKey(owned) === itemKey(item))
  )
    return false;
  const slot = targetSlot || def.slots?.find((slot) => !run.equipment[slot]) || def.slot!;
  if (!fitsSlot(def, slot)) return false;
  const owned = run.inventory.find((entry) => itemKey(entry) === itemKey(item))!;
  owned.quantity--;
  run.inventory = run.inventory.filter((entry) => entry.quantity > 0);
  const previous = run.equipment[slot];
  if (previous) returnToBag(run, previous);
  run.equipment[slot] = { id: item.id, enhancement: item.enhancement || 0 };
  applyEquipment(run);
  return true;
}
function returnToBag(run: EquipmentActor, item: EquippedItem) {
  const existing = run.inventory.find((entry) => itemKey(entry) === itemKey(item));
  if (existing) existing.quantity++;
  else run.inventory.push({ ...item, quantity: 1 });
}
export function unequipSlot(run: EquipmentActor, slot: EquipmentSlot) {
  if (!SLOTS.includes(slot)) return false;
  const previous = run.equipment[slot];
  if (!previous) return false;
  returnToBag(run, previous);
  run.equipment[slot] = null;
  applyEquipment(run);
  return true;
}
export function autoEquip(run: EquipmentActor, item: InventoryItem) {
  const def = ARMOR_ITEMS[item.id];
  if (!def || (def.hero && def.hero !== run.hero.id)) return false;
  const slot = (def.slots || [def.slot!]).find((slot) => !run.equipment[slot]);
  return slot ? equipItem(run, item, slot) : false;
}
export function chooseDropSlots(_hero: HeroId, equipment?: Equipment, random = Math.random) {
  const missing = SLOTS.filter((slot) => !equipment?.[slot]),
    occupied = SLOTS.filter((slot) => equipment?.[slot]);
  for (const slots of [missing, occupied])
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
  return [
    ...(!equipment?.weapon ? ['weapon' as EquipmentSlot] : []),
    ...missing.filter((s) => s !== 'weapon'),
    ...occupied,
  ];
}

export function hasEnhancedArmorSet(equipment: Equipment, minimum = 13) {
  return BODY_SLOTS.every((slot) => {
    const item = equipment[slot];
    return !!item && item.enhancement >= minimum;
  });
}
