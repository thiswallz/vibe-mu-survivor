import { mapLootSettings } from '../packages/game/dist/map-loot.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLootState,
  dropLoot,
  collectLoot,
  mergeInventory,
} from '../packages/game/dist/loot.js';
import { readInventory, bankRun } from '../packages/game/dist/inventory.js';
import { createRun, spawnEnemy, tick } from '../packages/game/dist/index.js';
test('stage loot is capped, includes accessories and a Guardian box, and requires proximity', () => {
  const state = createLootState();
  let roll = 0;
  const run = createRun('knight', () => (roll = (roll + 0.137) % 1));
  const limit = mapLootSettings(run.stage).limit;
  let uid = 1;
  for (let i = 0; i < limit - 1; i++)
    assert.ok(dropLoot(state, { x: 4, z: 0 }, 1000, () => uid++, run));
  assert.ok(state.drops.every((item) => item.enhancement <= 5));
  assert.ok(dropLoot(state, { x: 4, z: 0, elite: true }, 1001, () => uid++, run));
  assert.equal(
    dropLoot(state, { x: 4, z: 0, elite: true }, 1002, () => uid++, run),
    null,
  );
  assert.equal(state.drops.length, limit);
  assert.equal(state.drops.at(-1).id, 'kundun-box');
  assert.equal(collectLoot(state, 0, 0).length, 0);
  assert.equal(collectLoot(state, 4, 0).length, limit);
  assert.equal(state.drops.length, 0);
});

test('inventory persists across runs, merges quantities and banks a run only once', () => {
  const data = new Map(),
    storage = { getItem: (k) => data.get(k), setItem: (k, v) => data.set(k, v) };
  const run = {
    loot: {
      collected: [
        { id: 'kundun-box', quantity: 1 },
        { id: 'jewel-soul', quantity: 1 },
      ],
    },
  };
  assert.equal(bankRun(run, storage).saved, true);
  bankRun(run, storage);
  assert.equal(readInventory(storage)[0].quantity, 1);
  bankRun({ loot: { collected: [{ id: 'kundun-box', quantity: 1 }] } }, storage);
  assert.equal(readInventory(storage)[0].quantity, 2);
  assert.deepEqual(
    mergeInventory(
      [],
      [
        { id: 'fake', quantity: 99 },
        { id: 'jewel-soul', quantity: -1 },
      ],
    ),
    [],
  );
  assert.deepEqual(readInventory({ getItem: () => '{broken' }), []);
  assert.equal(
    bankRun(
      { loot: { collected: [] } },
      {
        getItem: () => null,
        setItem: () => {
          throw Error('blocked');
        },
      },
    ).saved,
    false,
  );
});
test('critical rolls increase actual damage and carry the cyan-number flag', () => {
  for (const [chance, critical, damage] of [
    [0, false, 32],
    [1, true, 48],
  ]) {
    const s = createRun('knight', () => 0.5);
    s.criticalChance = chance;
    s.spawnTimer = 100;
    const enemy = spawnEnemy(s, 4);
    enemy.x = 1;
    enemy.z = 0;
    enemy.speed = 0;
    tick(s, 0.01);
    const hit = s.events.find((e) => e.type === 'hit');
    assert.equal(hit.critical, critical);
    assert.equal(hit.damage, damage);
  }
});
test('nearby monsters emit their species voice and attack identity', () => {
  const s = createRun('knight', () => 0.5);
  s.spawnTimer = 100;
  s.attackTimer = 100;
  s.monsterVoiceTimer = 0;
  const enemy = spawnEnemy(s, 1);
  enemy.x = 0.2;
  enemy.z = 0;
  tick(s, 0.01);
  assert.ok(s.events.some((e) => e.type === 'monster-idle' && e.id === 'budge'));
  assert.ok(s.events.some((e) => e.type === 'monster-attack' && e.id === 'budge'));
});

test('enhancement rolls cover every level from zero to fifteen', async () => {
  const { rollEnhancement } = await import('../packages/game/dist/loot.js');
  for (let level = 0; level <= 15; level++)
    assert.equal(
      rollEnhancement(() => (level + 0.5) / 16),
      level,
    );
});
