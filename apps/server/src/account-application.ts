import type { InventoryProfile, InventoryItem } from '@mu-survivor/models';
import { transferVaultItem } from '@mu-survivor/game/vault';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { AccountRepository } from './account-port.js';
export function createAccountApplication(repository: AccountRepository) {
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  return {
    execute(
      method: string,
      route: string,
      body: Record<string, unknown>,
      cookie: string,
      send: (status: number, data: unknown) => void,
      setCookie: (value: string) => void,
    ) {
      if (method === 'POST' && ['/api/register', '/api/login'].includes(route)) {
        const username = typeof body.username === 'string' ? body.username.trim() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        if (
          !/^[a-zA-Z0-9_]{3,20}$/.test(username) ||
          password.length < 8 ||
          password.length > 128
        ) {
          send(400, {
            error:
              'Use a 3–20 character username (letters, numbers, underscore) and an 8–128 character password.',
          });
          return;
        }
        if (route === '/api/register') {
          const salt = randomBytes(16).toString('hex');
          try {
            repository.createAccount(
              username,
              salt + ':' + scryptSync(password, salt, 64).toString('hex'),
            );
          } catch {
            send(409, { error: 'Username already exists' });
            return;
          }
        }
        const account = repository.findAccount(username);
        const [salt, stored] = String(account?.password || 'invalid:' + '00'.repeat(64)).split(':');
        if (
          !timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(stored, 'hex')) ||
          !account
        ) {
          send(401, { error: 'Invalid username or password' });
          return;
        }
        const token = randomBytes(32).toString('hex');
        repository.expireSessions(Date.now());
        repository.createSession(hash(token), Number(account.id), Date.now() + 7 * 86400000);
        setCookie(`mu_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`);
        send(200, { username: account.username });
        return;
      }
      const token = /(?:^|;\s*)mu_session=([^;]+)/.exec(cookie)?.[1] || '';
      const account = repository.findSessionAccount(hash(token), Date.now());
      if (!account) {
        send(401, { error: 'Please sign in' });
        return;
      }
      if (route === '/api/logout' && method === 'POST') {
        repository.deleteSession(hash(token));
        setCookie('mu_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
        send(200, { ok: true });
        return;
      }
      if (route === '/api/account' && method === 'GET') {
        send(200, {
          username: account.username,
          characters: repository.listCharacters(Number(account.id)),
        });
        return;
      }
      if (route === '/api/characters' && method === 'POST') {
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (
          !/^[a-zA-Z][a-zA-Z0-9_]{2,15}$/.test(name) ||
          !['knight', 'wizard', 'elf'].includes(String(body.class))
        ) {
          send(400, {
            error:
              'Choose a class and a name of 3–16 letters, numbers or underscores, starting with a letter.',
          });
          return;
        }
        if (Number(repository.countCharacters(Number(account.id))?.n) >= 10) {
          send(409, { error: 'Your account already has 10 characters' });
          return;
        }
        try {
          const result = repository.createCharacter(Number(account.id), name, String(body.class));
          send(201, { id: Number(result.lastInsertRowid), name, class: body.class });
        } catch {
          send(409, { error: 'That character name already exists' });
        }
        return;
      }
      if (route === '/api/vault' && method === 'GET') {
        const vault = repository.readVault(Number(account.id));
        send(200, {
          items: vault ? JSON.parse(String(vault.items)) : [],
          revision: Number(vault?.revision || 0),
        });
        return;
      }
      if (route === '/api/vault/transfer' && method === 'POST') {
        const item = body.item as InventoryItem | undefined;
        if (
          !item ||
          typeof item.id !== 'string' ||
          !['deposit', 'withdraw'].includes(String(body.direction)) ||
          !Number.isSafeInteger(body.characterId) ||
          !Number.isSafeInteger(body.characterRevision) ||
          !Number.isSafeInteger(body.vaultRevision)
        ) {
          send(400, { error: 'Invalid transfer' });
          return;
        }
        try {
          const result = repository.transaction(() => {
            const character = repository.findCharacter(
              Number(body.characterId),
              Number(account.id),
            );
            if (!character) throw new Error('Character not found');
            const vault = repository.readVault(Number(account.id));
            const revision = Number(character.revision);
            const vaultRevision = Number(vault?.revision || 0);
            if (revision !== body.characterRevision || vaultRevision !== body.vaultRevision)
              throw new Error('Inventory changed in another tab. Reopen the vault and try again.');
            const profile: InventoryProfile = character.profile
              ? JSON.parse(String(character.profile))
              : { version: 3, items: [], loadouts: { knight: {}, wizard: {}, elf: {} } };
            const next = transferVaultItem(
              profile,
              vault ? JSON.parse(String(vault.items)) : [],
              item,
              body.direction as 'deposit' | 'withdraw',
            );
            repository.saveProfile(JSON.stringify(next.profile), Number(character.id), revision);
            repository.saveVault(Number(account.id), JSON.stringify(next.items), vaultRevision + 1);
            return {
              profile: next.profile,
              revision: revision + 1,
              vault: { items: next.items, revision: vaultRevision + 1 },
            };
          });
          send(200, result);
        } catch (error) {
          send(409, { error: error instanceof Error ? error.message : 'Transfer failed' });
        }
        return;
      }
      const match = /^\/api\/characters\/(\d+)\/profile$/.exec(route);
      if (match) {
        const character = repository.findCharacter(Number(match[1]), Number(account.id));
        if (!character) {
          send(404, { error: 'Character not found' });
          return;
        }
        if (method === 'GET') {
          send(200, {
            profile: character.profile ? JSON.parse(String(character.profile)) : null,
            revision: Number(character.revision),
          });
          return;
        }
        if (method === 'PUT') {
          const profile = body.profile as Record<string, unknown> | undefined;
          if (
            !profile ||
            profile.version !== 3 ||
            !Array.isArray(profile.items) ||
            typeof profile.loadouts !== 'object'
          ) {
            send(400, { error: 'Invalid inventory profile' });
            return;
          }
          if (!Number.isSafeInteger(body.revision)) {
            send(400, { error: 'Inventory revision is required' });
            return;
          }
          const result = repository.saveProfile(
            JSON.stringify(profile),
            Number(character.id),
            Number(body.revision),
          );
          if (!Number(result.changes)) {
            send(409, { error: 'Inventory changed in another tab. Reload before saving.' });
            return;
          }
          send(200, { ok: true, revision: Number(character.revision) + 1 });
          return;
        }
      }
      send(404, { error: 'Not found' });
    },
  };
}
