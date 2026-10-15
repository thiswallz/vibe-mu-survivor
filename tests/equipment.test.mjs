import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, spawnEnemy, tick } from '../packages/game/dist/index.js';
import {
  hasEnhancedArmorSet,
  equipItem,
  autoEquip,
  unequipSlot,
  itemKey,
  SLOTS,
  itemStats,
  bagItems,
} from '../packages/game/dist/equipment.js';
import { readProfile, saveRunInventory } from '../packages/game/dist/inventory.js';
import { openKundun } from '../packages/game/dist/loot.js';
const memory = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k), setItem: (k, v) => data.set(k, v) };
};
test('empty armor slots auto-equip owned pickups; occupied slots keep the chosen piece', () => {
  const s = createRun('knight'),
    first = { id: 'knight-helm', enhancement: 0, quantity: 1 },
    better = { id: 'knight-helm', enhancement: 15, quantity: 1 };
  s.inventory = [first, better];
  assert.ok(autoEquip(s, first));
  assert.equal(s.maxHp, 160 + itemStats(s.equipment.helm).vitality);
  assert.equal(s.equipment.helm.enhancement, 0);
  assert.equal(autoEquip(s, better), false);
  assert.equal(s.equipment.helm.enhancement, 0);
  assert.ok(equipItem(s, better));
  assert.equal(s.maxHp, 160 + itemStats(s.equipment.helm).vitality);
  assert.equal(s.equipment.helm.enhancement, 15);
  unequipSlot(s, 'helm');
  assert.equal(s.equipment.helm, null);
  assert.equal(s.maxHp, 160);
  assert.equal(
    equipItem(s, { id: 'knight-armor', enhancement: 15 }),
    false,
    'unowned gear cannot be equipped',
  );
  s.inventory.push({ id: 'wizard-helm', quantity: 1 });
  assert.equal(equipItem(s, s.inventory.at(-1)), false, 'class restriction');
});
test('weapon equips increase damage without compounding on replacement or removal', () => {
  const s = createRun('wizard');
  s.inventory = [{ id: 'wizard-weapon', quantity: 1, enhancement: 13 }];
  const base = s.damage;
  equipItem(s, s.inventory[0]);
  const damage = s.damage;
  assert.ok(damage > base);
  equipItem(s, s.inventory[0]);
  assert.equal(s.damage, damage);
  unequipSlot(s, 'weapon');
  assert.equal(s.damage, base);
  assert.equal(s.maxHp, s.hero.hp);
});
test('actual first drop is a weapon, collects and equips during play, and persists a hero loadout', () => {
  const s = createRun('knight', () => 0.5);
  s.kills = 3;
  s.spawnTimer = 100;
  const enemy = spawnEnemy(s, 0);
  enemy.x = 1;
  enemy.z = 0;
  tick(s, 0.01);
  assert.equal(s.loot.collected.length, 1);
  assert.equal(s.loot.collected[0].id, 'knight-katana');
  assert.equal(s.equipment.weapon.id, 'knight-katana');
  const storage = memory();
  assert.ok(saveRunInventory(s, storage));
  const profile = readProfile(storage);
  assert.equal(profile.loadouts.knight.weapon.id, 'knight-katana');
  assert.equal(profile.loadouts.wizard.weapon, null);
  assert.ok(SLOTS.every((slot) => slot in profile.loadouts.elf));
});
test('opening a Kundun consumes exactly one box and creates an owned compatible item', () => {
  const result = openKundun([{ id: 'kundun-box', quantity: 2 }], 'elf', 'boots', () => 0.1);
  assert.equal(result.reward.enhancement, 1);
  assert.equal(result.reward.id, 'elf-boots');
  assert.equal(result.items.find((i) => i.id === 'kundun-box').quantity, 1);
  assert.ok(result.items.some((i) => itemKey(i) === itemKey(result.reward)));
  assert.equal(openKundun([], 'elf', 'helm'), null);
});
test('old stash data migrates and fabricated equipment is not loaded', () => {
  const storage = memory();
  storage.setItem(
    'mu-survivor.inventory.v1',
    JSON.stringify({ version: 1, items: [{ id: 'kundun-box', quantity: 1 }] }),
  );
  assert.equal(readProfile(storage).items.length, 1);
  storage.setItem(
    'mu-survivor.inventory.v1',
    JSON.stringify({
      version: 2,
      items: [],
      loadouts: { elf: { helm: { id: 'elf-helm', enhancement: 15 } } },
    }),
  );
  assert.equal(readProfile(storage).loadouts.elf.helm, null);
});

test('equipped copies disappear from the bag and stats increase with every enhancement', () => {
  const s = createRun('knight');
  s.inventory = [{ id: 'knight-helm', quantity: 1, enhancement: 0 }];
  equipItem(s, s.inventory[0]);
  assert.equal(bagItems(s).length, 0);
  unequipSlot(s, 'helm');
  assert.equal(bagItems(s).length, 1);
  for (let level = 1; level <= 15; level++)
    assert.ok(
      itemStats({ id: 'knight-helm', enhancement: level }).defense >
        itemStats({ id: 'knight-helm', enhancement: level - 1 }).defense,
    );
});

test('equipment transfers conserve copies and keep the bag separate through save/load', () => {
  const s = createRun('knight');
  s.inventory = [
    { id: 'knight-helm', enhancement: 7, quantity: 2 },
    { id: 'knight-helm', enhancement: 15, quantity: 1 },
  ];
  equipItem(s, s.inventory[0]);
  assert.equal(s.inventory[0].quantity, 1);
  equipItem(s, s.inventory[1]);
  assert.deepEqual(s.inventory, [{ id: 'knight-helm', enhancement: 7, quantity: 2 }]);
  const storage = memory();
  saveRunInventory(s, storage);
  const profile = readProfile(storage);
  assert.deepEqual(profile.items, s.inventory);
  assert.equal(profile.loadouts.knight.helm.enhancement, 15);
  unequipSlot(s, 'helm');
  assert.equal(
    s.inventory.reduce((sum, item) => sum + item.quantity, 0),
    3,
  );
});

test('full +13 armor aura requires all five armor slots and ignores weapon', () => {
  const s = createRun('knight');
  for (const slot of SLOTS.filter((slot) => slot !== 'weapon'))
    s.equipment[slot] = { id: `knight-${slot}`, enhancement: 13 };
  assert.equal(hasEnhancedArmorSet(s.equipment), true);
  s.equipment.weapon = { id: 'knight-weapon', enhancement: 0 };
  assert.equal(hasEnhancedArmorSet(s.equipment), true);
  s.equipment.boots.enhancement = 12;
  assert.equal(hasEnhancedArmorSet(s.equipment), false);
  s.equipment.boots = null;
  assert.equal(hasEnhancedArmorSet(s.equipment), false);
});

test('rings fit either hand, universal accessories work for all classes, and pets own aura', () => {
  for (const hero of ['knight', 'wizard', 'elf']) {
    const s = createRun(hero);
    const startingDamage = s.damage;
    s.inventory = [
      { id: 'ring-ice', enhancement: 3, quantity: 2 },
      { id: 'pet-angel', enhancement: 0, quantity: 1 },
      { id: 'pet-satan', enhancement: 0, quantity: 1 },
      { id: 'pendant-lightning', enhancement: 0, quantity: 1 },
    ];
    assert.ok(equipItem(s, s.inventory[0], 'ringLeft'));
    assert.ok(equipItem(s, s.inventory[0], 'ringRight'));
    assert.equal(
      s.inventory.some((item) => item.id === 'ring-ice'),
      false,
    );
    assert.equal(s.auraLevel, 0);
    assert.ok(
      equipItem(
        s,
        s.inventory.find((item) => item.id === 'pet-angel'),
      ),
    );
    assert.equal(s.auraLevel, 1);
    assert.ok(
      equipItem(
        s,
        s.inventory.find((item) => item.id === 'pet-satan'),
      ),
    );
    assert.equal(s.auraLevel, 0);
    assert.ok(s.damage > startingDamage);
    assert.ok(unequipSlot(s, 'pet'));
    assert.equal(s.damage, startingDamage);
    assert.ok(
      equipItem(
        s,
        s.inventory.find((item) => item.id === 'pendant-lightning'),
      ),
    );
    assert.ok(s.damage > startingDamage);
    assert.equal(
      equipItem(
        s,
        s.inventory.find((item) => item.id === 'pet-angel'),
        'ringRight',
      ),
      false,
    );
  }
});

test('Guardian Angel aura damages nearby enemies only while the pet is worn', () => {
  const s = createRun('knight');
  s.inventory = [{ id: 'pet-angel', quantity: 1, enhancement: 0 }];
  equipItem(s, s.inventory[0]);
  s.spawnTimer = 100;
  s.attackTimer = 100;
  const enemy = spawnEnemy(s, 4);
  enemy.x = 3;
  enemy.z = 0;
  enemy.speed = 0;
  const hp = enemy.hp;
  tick(s, 0.02);
  assert.ok(enemy.hp < hp);
  unequipSlot(s, 'pet');
  const after = enemy.hp;
  s.auraTimer = 0;
  tick(s, 0.02);
  assert.equal(enemy.hp, after);
});
