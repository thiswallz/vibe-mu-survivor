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
export const SLOTS: EquipmentSlot[] = ['helm', 'armor', 'pants', 'gloves', 'boots', 'weapon'];
export const SLOT_LABELS: Record<EquipmentSlot, string> = {
  helm: 'Helm',
  armor: 'Armor',
  pants: 'Pants',
  gloves: 'Gloves',
  boots: 'Boots',
  weapon: 'Weapon',
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
export const ARMOR_ITEMS: Readonly<Record<string, ItemDefinition>> = Object.freeze(
  Object.fromEntries(
    Object.entries(SET_NAMES).flatMap(([hero, set]) =>
      SLOTS.map((slot) => {
        const id = `${hero}-${slot}`;
        return [
          id,
          {
            id,
            name: slot === 'weapon' ? WEAPON_NAMES[hero as HeroId] : `${set} ${SLOT_LABELS[slot]}`,
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
      def?.hero === hero &&
      def.slot === slot &&
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
  const base: Record<EquipmentSlot, number> = {
    helm: 20,
    armor: 35,
    pants: 26,
    gloves: 12,
    boots: 15,
    weapon: 0,
  };
  const health: Record<EquipmentSlot, number> = {
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
        ? base[def.slot] + level * 2 + Math.floor(level * level * 0.3)
        : 0,
    vitality: def?.slot && def.slot !== 'weapon' ? health[def.slot] + Math.floor(level / 3) : 0,
    attackPower: def?.slot === 'weapon' ? 30 + level * 3 : 0,
    requiredHero: def?.hero,
  };
}
export function bagItems(run: EquipmentActor) {
  return run.inventory
    .map((item) => ({
      ...item,
      quantity:
        item.quantity -
        Object.values(run.equipment).filter((e) => e && itemKey(e) === itemKey(item)).length,
    }))
    .filter((item) => item.quantity > 0);
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
  const nextWeapon =
    1 + (run.equipment.weapon ? itemStats(run.equipment.weapon).attackPower / 100 : 0);
  run.damage = (run.damage / (run.gearWeaponPower || 1)) * nextWeapon;
  run.gearWeaponPower = nextWeapon;
  run.gearHp = bonus;
  run.gearDefense = Math.min(0.45, defense / (500 + defense));
  run.armorEquipped = pieces.some((p) => ARMOR_ITEMS[p.id].slot !== 'weapon');
  run.enhancement = Math.max(0, ...pieces.map((i) => i.enhancement || 0));
}
export function equipItem(run: EquipmentActor, item: InventoryItem | EquippedItem) {
  const def = ARMOR_ITEMS[item?.id || ''];
  if (
    !def ||
    def.hero !== run.hero.id ||
    !run.inventory.some((owned) => itemKey(owned) === itemKey(item))
  )
    return false;
  run.equipment[def.slot!] = { id: item.id, enhancement: item.enhancement || 0 };
  applyEquipment(run);
  return true;
}
export function unequipSlot(run: EquipmentActor, slot: EquipmentSlot) {
  if (!SLOTS.includes(slot)) return false;
  run.equipment[slot] = null;
  applyEquipment(run);
  return true;
}
export function autoEquip(run: EquipmentActor, item: InventoryItem) {
  const def = ARMOR_ITEMS[item.id];
  return def?.hero === run.hero.id && !run.equipment[def.slot!] ? equipItem(run, item) : false;
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
