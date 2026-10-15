import { followCompanion } from '../apps/ui/src/companion.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { poseAttachments, animateNativeLoop } from '../apps/ui/src/attachments.ts';
import { STAGES } from '../packages/game/dist/stage.js';
import { createRun, spawnEnemy, tick, CLASSES } from '../packages/game/dist/index.js';
const readModel = (name) =>
  JSON.parse(
    fs.readFileSync(new URL(`../apps/ui/public/assets/models/${name}.json`, import.meta.url)),
  );
test('hand, forearm and spine attachments follow locomotion and attack sockets for every class', () => {
  for (const hero of CLASSES) {
    const data = readModel(hero.id);
    const root = new THREE.Group();
    root.userData.socket = hero.id === 'elf' ? 'left' : 'right';
    for (const name of ['weapon', 'shield', 'wingAttachment'])
      root.userData[name] = new THREE.Group();
    poseAttachments(root, data, 0, 0, 0, 1);
    const shield = root.userData.shield.position.clone();
    const wings = root.userData.wingAttachment.position.clone();
    const wingRotation = root.userData.wingAttachment.quaternion.clone();
    const clip = data.clips.attack;
    poseAttachments(
      root,
      data,
      clip.start + Math.floor(clip.count / 2),
      clip.start + Math.floor(clip.count / 2),
      0,
      1,
    );
    assert.ok(
      shield.distanceTo(root.userData.shield.position) > 0.01,
      hero.id + ' shield must follow attack',
    );
    assert.ok(
      wings.distanceTo(root.userData.wingAttachment.position) > 0.005 ||
        wingRotation.angleTo(root.userData.wingAttachment.quaternion) > 0.01,
      hero.id + ' wings must follow spine',
    );
    const run = data.clips.run;
    poseAttachments(root, data, run.start + 3, run.start + 4, 0.5, 1);
    assert.ok(
      shield.distanceTo(root.userData.shield.position) > 0.01,
      hero.id + ' shield must follow movement',
    );
  }
});

test('shield forearm sockets remain rigid without mirroring or scaling the shield', () => {
  for (const hero of CLASSES) {
    const data = readModel(hero.id);
    for (const side of ['forearmLeft', 'forearmRight']) {
      assert.equal(data.sockets[side].length, data.sockets.torso.length);
      for (const frame of data.sockets[side]) {
        assert.ok(frame.every(Number.isFinite));
        const matrix = new THREE.Matrix4().fromArray(frame);
        assert.ok(Math.abs(matrix.determinant() - 1) < 0.00001);
        const axes = [0, 1, 2].map((column) =>
          new THREE.Vector3().setFromMatrixColumn(matrix, column),
        );
        for (const axis of axes) assert.ok(Math.abs(axis.length() - 1) < 0.00001);
        assert.ok(Math.abs(axes[0].dot(axes[1])) < 0.00001);
        assert.ok(Math.abs(axes[0].dot(axes[2])) < 0.00001);
      }
    }
  }
});
test('wings and companions include changing native animation frames and loop with blended weights', () => {
  for (const name of ['loot-pet-angel', 'loot-pet-satan', 'loot-wings-angel']) {
    const data = readModel(name);
    assert.ok(
      data.parts.some((part) =>
        part.frames.some((frame) =>
          frame.some((value, i) => Math.abs(value - part.frames[0][i]) > 0.001),
        ),
      ),
      name + ' needs native motion',
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  geometry.morphAttributes.position = Array.from(
    { length: 7 },
    () => new THREE.Float32BufferAttribute([0, 0, 0], 3),
  );
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  animateNativeLoop(mesh, 0.12);
  assert.ok(Math.abs(mesh.morphTargetInfluences.reduce((a, b) => a + b, 0) - 1) < 1e-8);
  assert.equal(mesh.morphTargetInfluences.filter((weight) => weight > 0).length, 2);
  geometry.dispose();
  mesh.material.dispose();
});
test('skills require stationary casting; movement resumes after the cast and dash cancels it', () => {
  for (const hero of CLASSES) {
    const s = createRun(hero.id, () => 0.5);
    s.spawnTimer = 100;
    const enemy = spawnEnemy(s, 4);
    enemy.x = 1;
    enemy.z = 0;
    enemy.speed = 0;
    enemy.hp = 10000;
    tick(s, 1 / 60, { x: 1 });
    assert.ok(s.moving);
    assert.equal(s.attackAnimation, 0);
    tick(s, 1 / 60);
    assert.ok(s.attackAnimation > 0);
    assert.equal(s.moving, false);
    const x = s.x;
    tick(s, 1 / 60, { x: 1 });
    assert.equal(s.x, x);
    assert.equal(s.moving, false);
    for (let i = 0; i < 100; i++) tick(s, 1 / 60, { x: 1 });
    assert.ok(s.x > x);
    assert.equal(s.attackAnimation, 0);
    s.attackAnimation = 0.4;
    s.dashCooldown = 0;
    const before = s.x;
    tick(s, 1 / 60, { x: 1, dash: true });
    assert.equal(s.attackAnimation, 0);
    assert.ok(s.x > before);
  }
});
test('three worlds each provide two playable maps with local assets and distinct encounter settings', () => {
  assert.equal(STAGES.length, 6);
  for (const world of ['lorencia', 'noria', 'devias'])
    assert.equal(STAGES.filter((stage) => stage.worldId === world).length, 2);
  for (const stage of STAGES) {
    for (const asset of [stage.texture, stage.terrain, stage.objects])
      assert.ok(fs.existsSync(new URL('../apps/ui/public/' + asset, import.meta.url)), asset);
    const terrain = JSON.parse(
      fs.readFileSync(new URL('../apps/ui/public/' + stage.terrain, import.meta.url)),
    );
    assert.equal(terrain.heights.length, (terrain.size + 1) ** 2);
    const objects = JSON.parse(
      fs.readFileSync(new URL('../apps/ui/public/' + stage.objects, import.meta.url)),
    );
    assert.ok(objects.objects.length > 0);
    for (const model of objects.models) {
      const data = readModel(model);
      for (const part of data.parts)
        if (part.texture)
          assert.ok(
            fs.existsSync(new URL('../apps/ui/public/' + part.texture, import.meta.url)),
            part.texture,
          );
    }
    const s = createRun('knight', () => 0.5, stage);
    s.spawnTimer = 0;
    tick(s, 0.01);
    assert.equal(s.stage.id, stage.id);
    assert.ok(s.enemies.length > 0);
  }
  const first = createRun('knight', () => 0.5, STAGES[0]),
    last = createRun('knight', () => 0.5, STAGES[5]);
  assert.ok(spawnEnemy(last, 4).hp > spawnEnemy(first, 4).hp);
});

test('pets follow in world space without inheriting character rotation or skill pose', () => {
  const world = new THREE.Group(),
    hero = new THREE.Group(),
    pet = new THREE.Group();
  world.add(hero, pet);
  pet.position.set(1.4, 1.7, -0.6);
  const before = pet.getWorldPosition(new THREE.Vector3());
  hero.rotation.y = Math.PI;
  hero.rotation.x = 0.5;
  assert.deepEqual(pet.getWorldPosition(new THREE.Vector3()).toArray(), before.toArray());
  followCompanion(pet, { x: 8, z: 0, facing: 0 }, 1 / 60, 1, 2.4, () => 0);
  assert.ok(pet.position.x > before.x && pet.position.x < 8);
  assert.ok(pet.position.y > 0);
  assert.equal(pet.parent, world);
});

test('vault rejects a full destination stack without consuming a character item', async () => {
  const { transferVaultItem } = await import('../packages/game/dist/vault.js');
  const profile = {
    version: 3,
    items: [{ id: 'ring-ice', enhancement: 0, quantity: 1 }],
    loadouts: {},
  };
  const vault = [{ id: 'ring-ice', enhancement: 0, quantity: 9999 }];
  assert.throws(() => transferVaultItem(profile, vault, profile.items[0], 'deposit'), /full/);
  assert.equal(profile.items[0].quantity, 1);
  assert.equal(vault[0].quantity, 9999);
});

test('passive companions roam while a stationary character turns and remain within six meters', () => {
  const pet = new THREE.Group();
  pet.position.set(1, 1, 0);
  const positions = [];
  for (let frame = 0; frame < 1200; frame++) {
    followCompanion(pet, { x: 0, z: 0 }, 1 / 60, frame / 60, 2.4, () => 0);
    assert.ok(Math.hypot(pet.position.x, pet.position.z) <= 6.001);
    if (frame % 60 === 0) positions.push(pet.position.clone());
  }
  assert.ok(positions.some((point) => point.distanceTo(positions[0]) > 1));
  for (let frame = 0; frame < 600; frame++) {
    const target = { x: (frame / 60) * 4, z: 0 };
    followCompanion(pet, target, 1 / 60, 20 + frame / 60, 2.4, () => 0);
    assert.ok(Math.hypot(pet.position.x - target.x, pet.position.z - target.z) <= 6.001);
  }
});
