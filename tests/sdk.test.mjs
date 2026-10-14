import test from 'node:test';
import assert from 'node:assert/strict';
import { createMuApiClient, ApiError } from '../packages/sdk/dist/index.js';
test('typed API client uses the configured same-origin base and validates contracts', async () => {
  let request;
  const api = createMuApiClient({
    baseUrl: '/internal-api/',
    fetch: async (url) => {
      request = url;
      return new Response(
        JSON.stringify({
          stage: 'Lorencia',
          durationSeconds: 180,
          characters: 3,
          enemyTypes: 5,
          skillsPerCharacter: 2,
          accounts: false,
        }),
      );
    },
  });
  assert.equal((await api.demo()).durationSeconds, 180);
  assert.equal(request, '/internal-api/demo');
  const malformed = createMuApiClient({ fetch: async () => new Response('{}') });
  await assert.rejects(() => malformed.demo(), ApiError);
  const failed = createMuApiClient({ fetch: async () => new Response('', { status: 503 }) });
  await assert.rejects(
    () => failed.health(),
    (error) => error.status === 503,
  );
});
