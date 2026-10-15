import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, configuration } from '../apps/server/dist/http-server.js';
async function listen(t, options) {
  const server = createServer({
    uiRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/ui'),
    databasePath: ':memory:',
    ...options,
  });
  server.listen(0, '::');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  );
  return `http://127.0.0.1:${server.address().port}`;
}
test('configuration supports Railway binding and rejects unsafe or invalid values', () => {
  assert.equal(configuration({ NODE_ENV: 'production' }).host, '::');
  assert.equal(configuration({}).host, '127.0.0.1');
  assert.equal(configuration({ SERVE_UI: 'false', PORT: '8080' }).serveUI, false);
  for (const env of [
    { PORT: 'bad' },
    { PORT: '0' },
    { SERVE_UI: 'yes' },
    { INTERNAL_API_URL: 'file:///tmp' },
    { INTERNAL_API_URL: 'http://api/api' },
    { SERVE_UI: 'false', INTERNAL_API_URL: 'http://api' },
  ])
    assert.throws(() => configuration(env));
});
test('UI and API work on one origin; audio supports byte ranges and HEAD', async (t) => {
  const origin = await listen(t, {});
  assert.equal((await fetch(origin + '/healthz')).status, 200);
  assert.equal((await (await fetch(origin + '/api/demo')).json()).characters, 3);
  assert.match(await (await fetch(origin + '/')).text(), /MU/);
  const script = await fetch(origin + '/main.js');
  assert.match(script.headers.get('content-type'), /javascript/);
  const audio = await fetch(origin + '/test.wav', { headers: { range: 'bytes=0-31' } });
  assert.equal(audio.status, 206);
  assert.equal((await audio.arrayBuffer()).byteLength, 32);
  const head = await fetch(origin + '/test.wav', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.ok(Number(head.headers.get('content-length')) > 32);
  assert.equal(
    (await fetch(origin + '/test.wav', { headers: { range: 'bytes=999999999-' } })).status,
    416,
  );
  assert.equal((await fetch(origin + '/api/demo', { method: 'POST' })).status, 405);
  assert.equal((await fetch(origin + '/missing')).status, 404);
  assert.equal((await fetch(origin + '/%2e%2e%2fpackage.json')).status, 403);
});
test('split UI proxies API to private server and handles upstream failure', async (t) => {
  const api = await listen(t, { serveUI: false });
  const origin = await listen(t, { upstream: new URL(api) });
  assert.equal((await fetch(api + '/')).status, 404);
  assert.equal((await (await fetch(origin + '/api/demo')).json()).stage, 'Lorencia');
  assert.equal((await fetch(origin + '/api/demo', { method: 'HEAD' })).status, 200);
  assert.equal((await fetch(origin + '/api/missing')).status, 404);
  const broken = await listen(t, { upstream: new URL('http://127.0.0.1:1') });
  assert.equal((await fetch(broken + '/healthz')).status, 200);
  assert.equal((await fetch(broken + '/api/demo')).status, 502);
  assert.equal(
    (await (await fetch(broken + '/api/demo')).json()).error,
    'Internal API unavailable',
  );
});
