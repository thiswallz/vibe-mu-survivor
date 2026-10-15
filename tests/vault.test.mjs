import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from '../apps/server/dist/http-server.js';
import { emptyEquipment } from '../packages/game/dist/equipment.js';
test('vault transfers are atomic, revision-checked, account-scoped and preserve private same-class bags', async (t) => {
  const server = createServer({ serveUI: false, databasePath: ':memory:' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  let cookie = '';
  const call = async (route, method = 'GET', body) => {
    const response = await fetch(base + route, {
      method,
      headers: { cookie, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const session = response.headers.get('set-cookie');
    if (session) cookie = session.split(';')[0];
    return { status: response.status, data: await response.json() };
  };
  await call('register', 'POST', { username: 'vaultowner', password: 'test-password' });
  const a = (await call('characters', 'POST', { name: 'VaultHeroOne', class: 'knight' })).data;
  const b = (await call('characters', 'POST', { name: 'VaultHeroTwo', class: 'knight' })).data;
  const ring = { id: 'ring-ice', enhancement: 5, quantity: 1 };
  const profile = {
    version: 3,
    items: [ring],
    loadouts: { knight: emptyEquipment(), wizard: emptyEquipment(), elf: emptyEquipment() },
  };
  assert.equal(
    (await call(`characters/${a.id}/profile`, 'PUT', { profile, revision: 0 })).status,
    200,
  );
  assert.equal((await call(`characters/${b.id}/profile`)).data.profile, null);
  const request = {
    characterId: a.id,
    direction: 'deposit',
    item: ring,
    characterRevision: 1,
    vaultRevision: 0,
  };
  const results = await Promise.all([
    call('vault/transfer', 'POST', request),
    call('vault/transfer', 'POST', request),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.deepEqual((await call(`characters/${a.id}/profile`)).data.profile.items, []);
  assert.deepEqual((await call('vault')).data.items, [ring]);
  const withdrawn = await call('vault/transfer', 'POST', {
    ...request,
    characterId: b.id,
    direction: 'withdraw',
    characterRevision: 0,
    vaultRevision: 1,
  });
  assert.equal(withdrawn.status, 200);
  assert.deepEqual(withdrawn.data.profile.items, [ring]);
  assert.deepEqual(withdrawn.data.vault.items, []);
  assert.deepEqual((await call(`characters/${a.id}/profile`)).data.profile.items, []);
  assert.equal(
    (await call(`characters/${a.id}/profile`, 'PUT', { profile, revision: 1 })).status,
    409,
  );
  const failed = await call('vault/transfer', 'POST', {
    ...request,
    characterRevision: 2,
    vaultRevision: 2,
  });
  assert.equal(failed.status, 409);
  assert.deepEqual((await call('vault')).data, { items: [], revision: 2 });
  await call('logout', 'POST', {});
  await call('register', 'POST', { username: 'outsider', password: 'test-password' });
  assert.deepEqual((await call('vault')).data.items, []);
  assert.equal((await call(`characters/${b.id}/profile`)).status, 404);
  assert.equal(
    (
      await call('vault/transfer', 'POST', {
        ...request,
        characterId: b.id,
        direction: 'withdraw',
        characterRevision: 1,
        vaultRevision: 0,
      })
    ).status,
    409,
  );
});
