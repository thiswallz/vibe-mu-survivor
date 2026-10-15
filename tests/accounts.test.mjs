import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from '../apps/server/dist/http-server.js';
test('accounts persist, enforce unique names and ten slots, and isolate profiles', async (t) => {
  const server = createServer({ serveUI: false, databasePath: ':memory:' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  let cookie = '';
  async function call(route, method = 'GET', body) {
    const res = await fetch(base + route, {
      method,
      headers: { cookie, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
    return { status: res.status, data: await res.json() };
  }
  assert.equal((await call('account')).status, 401);
  assert.equal(
    (await call('register', 'POST', { username: 'tester', password: 'password123' })).status,
    200,
  );
  const first = await call('characters', 'POST', { name: 'HeroOne', class: 'knight' });
  assert.equal(first.status, 201);
  assert.equal((await call('characters', 'POST', { name: 'heroone', class: 'elf' })).status, 409);
  const profile = { version: 3, items: [], loadouts: { knight: {}, wizard: {}, elf: {} } };
  assert.equal(
    (await call(`characters/${first.data.id}/profile`, 'PUT', { profile, revision: 0 })).status,
    200,
  );
  assert.deepEqual((await call(`characters/${first.data.id}/profile`)).data.profile, profile);
  for (let i = 1; i < 10; i++)
    assert.equal(
      (await call('characters', 'POST', { name: `Hero${i}`, class: 'elf' })).status,
      201,
    );
  assert.equal(
    (await call('characters', 'POST', { name: 'Overflow', class: 'wizard' })).status,
    409,
  );
  await call('logout', 'POST', {});
  assert.equal(
    (await call('login', 'POST', { username: 'TESTER', password: 'incorrect' })).status,
    401,
  );
  await call('register', 'POST', { username: 'second', password: 'password123' });
  assert.equal((await call(`characters/${first.data.id}/profile`)).status, 404);
  assert.equal(
    (await call('characters', 'POST', { name: 'HeroOne', class: 'wizard' })).status,
    409,
  );
  await call('logout', 'POST', {});
  await call('login', 'POST', { username: 'TESTER', password: 'password123' });
  assert.equal((await call('account')).data.characters.length, 10);
});

test('SQLite account data survives closing and reopening the service', async (t) => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const { createSqliteAccountRepository } =
    await import('../apps/server/dist/account-repository.js');
  const directory = mkdtempSync(path.join(tmpdir(), 'mu-accounts-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'accounts.sqlite');
  let repository = createSqliteAccountRepository(filename);
  repository.createAccount('persistent', 'test-hash');
  const account = repository.findAccount('persistent');
  repository.createCharacter(Number(account.id), 'PersistentHero', 'knight');
  repository.close();
  repository = createSqliteAccountRepository(filename);
  try {
    assert.equal(repository.findAccount('PERSISTENT').username, 'persistent');
    assert.equal(repository.listCharacters(Number(account.id))[0].name, 'PersistentHero');
  } finally {
    repository.close();
  }
});
