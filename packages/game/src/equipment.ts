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
export function applyEquipment(run: EquipmentActor) {
  const pieces = SLOTS.filter((slot) => slot !== 'weapon')
    .map((slot) => run.equipment[slot])
    .filter((piece): piece is EquippedItem => piece !== null);
  const bonus = pieces.length * 7;
  const difference = bonus - (run.gearHp || 0);
  run.maxHp += difference;
  if (run.hp > 0) run.hp = Math.max(1, Math.min(run.maxHp, run.hp + difference));
  const weapon = run.equipment.weapon,
    nextWeapon = weapon ? 1.3 + (weapon.enhancement || 0) * 0.02 : 1;
  run.damage = (run.damage / (run.gearWeaponPower || 1)) * nextWeapon;
  run.gearWeaponPower = nextWeapon;
  run.gearHp = bonus;
  run.gearDefense = Math.min(
    0.38,
    pieces.reduce((sum, item) => sum + 0.035 + (item.enhancement || 0) * 0.0015, 0),
  );
  run.armorEquipped = pieces.length > 0;
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
