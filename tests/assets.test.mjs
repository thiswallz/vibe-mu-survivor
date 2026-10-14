import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ui = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../apps/ui/public');
test('all three heroes and five enemy models include valid geometry and local textures', () => {
  for (const id of ['knight', 'wizard', 'elf', 'spider', 'budge', 'bull', 'hound', 'giant']) {
    const model = JSON.parse(fs.readFileSync(path.join(ui, 'assets/models', id + '.json')));
    assert.ok(model.max[1] > model.min[1]);
    assert.ok(model.parts.length);
    for (const part of model.parts) {
      assert.equal(part.positions.length % 9, 0);
      assert.equal(part.uvs.length, (part.positions.length / 3) * 2);
      assert.ok(part.positions.every(Number.isFinite));
      if (part.texture) assert.ok(fs.existsSync(path.join(ui, part.texture)), part.texture);
      if (part.frames) for (const f of part.frames) assert.equal(f.length, part.positions.length);
    }
  }
});
test('Lorencia pub music and every skill effect are bundled locally', () => {
  for (const audio of [
    'lorencia-pub.mp3',
    'knight.wav',
    'wizard.wav',
    'elf.wav',
    'level-up.wav',
    'evil.wav',
    'hellfire.wav',
    'ice.wav',
    'stab.wav',
  ])
    assert.ok(fs.statSync(path.join(ui, 'assets/audio', audio)).size > 100);
});

test('player armor has distinct original idle, walk, run and attack animation frames', () => {
  for (const id of ['knight', 'wizard', 'elf']) {
    const model = JSON.parse(fs.readFileSync(path.join(ui, 'assets/models', id + '.json')));
    for (const clip of ['idle', 'walk', 'run', 'attack', 'attack2'])
      assert.ok(model.clips[clip].count >= 4);
    assert.ok(model.sockets.right.length > 0);
    const { start, count } = model.clips.run;
    assert.ok(
      model.parts.some((p) =>
        p.frames[start].some(
          (value, i) => Math.abs(value - p.frames[start + Math.floor(count / 2)][i]) > 0.001,
        ),
      ),
      `${id} run cycle should move the armor`,
    );
  }
});
test('Lorencia terrain and object placements retain source provenance', () => {
  const terrain = JSON.parse(fs.readFileSync(path.join(ui, 'assets/lorencia-terrain.json')));
  assert.equal(terrain.heights.length, (terrain.size + 1) ** 2);
  assert.ok(terrain.source.includes('World1/Terrain.map'));
  const objects = JSON.parse(fs.readFileSync(path.join(ui, 'assets/lorencia-objects.json')));
  assert.equal(objects.source, 'World1/Terrain.obj');
  assert.ok(objects.objects.length > 400);
  for (const model of objects.models)
    assert.ok(fs.existsSync(path.join(ui, 'assets/models', model + '.json')));
});

test('S20 run clips contain a full forward foot stride, not an idle pose', () => {
  for (const id of ['knight', 'wizard', 'elf']) {
    const model = JSON.parse(fs.readFileSync(path.join(ui, 'assets/models', id + '.json'))),
      clip = model.clips.run;
    let maximum = 0;
    for (const part of model.parts)
      for (let vertex = 0; vertex < part.positions.length; vertex += 3) {
        if (part.positions[vertex + 1] > 0.45) continue;
        const forward = part.frames
          .slice(clip.start, clip.start + clip.count)
          .map((frame) => frame[vertex + 2]);
        maximum = Math.max(maximum, Math.max(...forward) - Math.min(...forward));
      }
    assert.ok(maximum > 0.4, `${id} feet should stride at least 40 cm, got ${maximum}`);
  }
});
test('arena selection excludes houses, walls and large props', async () => {
  const { keepArenaProp } = await import('../packages/game/dist/stage.js');
  assert.equal(keepArenaProp(115, { height: 3, width: 4, depth: 4 }), false);
  assert.equal(
    keepArenaProp(133, { height: 2, width: 2, depth: 2 }),
    false,
    'invisible client markers are not scenery',
  );
  assert.equal(keepArenaProp(75, { height: 3, width: 4, depth: 2 }), false);
  assert.equal(keepArenaProp(30, { height: 7, width: 2, depth: 2 }), false);
  assert.equal(keepArenaProp(58, { height: 2, width: 1.5, depth: 1.5 }), true);
});

test('reward armor sets retain original models, moving poses and chrome assets', () => {
  for (const id of ['knight', 'wizard', 'elf']) {
    const model = JSON.parse(fs.readFileSync(path.join(ui, 'assets/models', id + '-armor.json')));
    assert.ok(model.parts.length);
    assert.equal(
      model.clips.attack.sourceAction,
      id === 'knight' ? 136 : id === 'wizard' ? 149 : 122,
    );
    assert.ok(model.parts.some((p) => p.upperBody));
    for (const part of model.parts)
      if (part.texture) assert.ok(fs.existsSync(path.join(ui, part.texture)));
  }
  for (const name of ['effect-chrome01.png', 'effect-shiny01.png', 'effect-aurawave_blue_00.png'])
    assert.ok(fs.existsSync(path.join(ui, 'assets/textures', name)));
  for (const id of ['spider', 'budge', 'bull', 'hound', 'giant']) {
    const bytes = fs.readFileSync(path.join(ui, 'assets/audio', 'death-' + id + '.wav'));
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
  }
});

test('S20 catalog verifies set names, Grand Soul pants, and Bull Fighter model', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(ui, 'assets/armor-catalog.json'))),
    manifest = JSON.parse(fs.readFileSync(path.join(ui, 'assets/manifest.json')));
  for (const [id, name] of [
    ['knight', 'Unarmored'],
    ['wizard', 'Unarmored'],
    ['elf', 'Unarmored'],
    ['knight-armor', 'Dark Phoenix Set'],
    ['wizard-armor', 'Grand Soul Set'],
    ['elf-armor', 'Guardian Set'],
  ])
    assert.equal(catalog[id].name, name);
  assert.ok(manifest['wizard-armor'].source.includes('Player/t_PantMale19.bmd'));
  assert.deepEqual(manifest.bull.source, ['Monster/Monster01.bmd']);
  for (const id of ['spider', 'budge', 'bull', 'hound', 'giant'])
    for (const kind of ['idle', 'attack', 'death'])
      assert.ok(fs.statSync(path.join(ui, `assets/audio/${kind}-${id}.wav`)).size > 100);
  for (const id of ['kundun-box', 'jewel-bless', 'jewel-soul', 'jewel-life', 'jewel-chaos']) {
    const model = JSON.parse(fs.readFileSync(path.join(ui, `assets/models/loot-${id}.json`)));
    for (const part of model.parts) assert.ok(fs.existsSync(path.join(ui, part.texture)));
  }
});

test('starting heroes use native unarmored bodies; armor skin placeholders resolve by class', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ui, 'assets/manifest.json')));
  for (const [id, index, skin] of [
    ['knight', '02', 'skin_barbarian_01.jpg'],
    ['wizard', '01', 'skin_wizard_01.jpg'],
    ['elf', '03', 'skin_archer_01.jpg'],
  ]) {
    assert.ok(manifest[id].source.every((p) => p.includes('Class' + index)));
    const body = JSON.parse(fs.readFileSync(path.join(ui, `assets/models/${id}.json`)));
    assert.equal(body.parts.length, 5);
    const armor = JSON.parse(fs.readFileSync(path.join(ui, `assets/models/${id}-armor.json`)));
    assert.ok(
      armor.parts.some((p) => p.resolvedTexture === skin),
      id + ' face texture',
    );
    assert.ok(armor.parts.every((p) => !p.sourceTexture.startsWith('hide')));
  }
});
