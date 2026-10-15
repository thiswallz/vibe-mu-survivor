import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STAGES } from '../packages/game/dist/stage.js';
import { ITEMS } from '../packages/game/dist/loot.js';
import {
  mapDrops,
  bestMapDrops,
  rollMapDrop,
  mapLootSettings,
} from '../packages/game/dist/map-loot.js';
import { createRun } from '../packages/game/dist/index.js';
import { equipItem, itemStats } from '../packages/game/dist/equipment.js';
test('every advertised map drop can be sampled and recommendations match the selected class', () => {
  const fingerprints = new Set();
  for (const stage of STAGES) {
    const table = mapDrops(stage),
      pool = table.filter((drop) => drop.source === 'monster');
    fingerprints.add(table.map((drop) => drop.id + ':' + drop.weight).join(','));
    const total = pool.reduce((sum, drop) => sum + drop.weight, 0);
    let cumulative = 0;
    for (const drop of pool) {
      assert.ok(ITEMS[drop.id]);
      const sample = (cumulative + drop.weight / 2) / total;
      assert.equal(rollMapDrop(stage, 'knight', false, () => sample).id, drop.id);
      cumulative += drop.weight;
    }
    for (const hero of ['knight', 'wizard', 'elf']) {
      const first = rollMapDrop(stage, hero, true, () => 0.5);
      assert.equal(ITEMS[first.id].hero, hero);
      assert.equal(ITEMS[first.id].slot, 'weapon');
      const best = bestMapDrops(stage, hero);
      assert.ok(best.length >= 5);
      assert.equal(ITEMS[best[0].id].slot, 'weapon');
      assert.equal(ITEMS[best[1].id].slot, 'armor');
      assert.ok(best.every((drop) => !ITEMS[drop.id].hero || ITEMS[drop.id].hero === hero));
      assert.ok(best.every((drop) => table.some((entry) => entry.id === drop.id)));
    }
    assert.ok(mapLootSettings(stage).limit >= 24);
  }
  assert.equal(fingerprints.size, 6);
});
test('native expanded equipment contains complete rendered armor sets and meaningful tiers', () => {
  const root = new URL('../apps/ui/public/', import.meta.url);
  const catalog = JSON.parse(
    fs.readFileSync(new URL('assets/expanded-equipment-catalog.json', root)),
  );
  assert.equal(Object.keys(catalog.items).length, 36);
  for (const def of Object.values(catalog.items)) {
    const model = JSON.parse(
      fs.readFileSync(new URL('assets/models/' + def.model + '.json', root)),
    );
    for (const part of model.parts) {
      assert.ok(part.texture, def.id);
      assert.ok(fs.existsSync(new URL(part.texture, root)));
    }
    if (def.armorModel) {
      const rig = JSON.parse(
        fs.readFileSync(new URL('assets/models/' + def.armorModel + '.json', root)),
      );
      assert.ok(rig.parts.some((part) => part.slot === def.slot));
      assert.ok(rig.parts.every((part) => part.frames.length === 72));
    }
    const run = createRun(def.hero);
    run.inventory = [{ id: def.id, quantity: 1, enhancement: 0 }];
    assert.ok(equipItem(run, run.inventory[0]), def.id);
    assert.equal(run.equipment[def.slot].id, def.id);
  }
  assert.ok(
    itemStats({ id: 'knight-leather-armor' }).defense <
      itemStats({ id: 'knight-plate-armor' }).defense,
  );
  assert.ok(
    itemStats({ id: 'knight-plate-armor' }).defense < itemStats({ id: 'knight-armor' }).defense,
  );
});
