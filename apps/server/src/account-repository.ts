import type { AccountRepository } from './account-port.js';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
export function createSqliteAccountRepository(
  filename: string,
): AccountRepository & { close(): void } {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS accounts(id INTEGER PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE, password TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS characters(id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id), name TEXT NOT NULL COLLATE NOCASE UNIQUE, class TEXT NOT NULL CHECK(class IN ('knight','wizard','elf')), profile TEXT);
    CREATE TRIGGER IF NOT EXISTS character_limit BEFORE INSERT ON characters WHEN (SELECT count(*) FROM characters WHERE account_id=NEW.account_id)>=10 BEGIN SELECT RAISE(ABORT,'Character limit reached'); END;`);
  const columns = db.prepare('PRAGMA table_info(characters)').all();
  if (!columns.some((column) => column.name === 'revision'))
    db.exec('ALTER TABLE characters ADD COLUMN revision INTEGER NOT NULL DEFAULT 0');
  db.exec(
    'CREATE TABLE IF NOT EXISTS vaults(account_id INTEGER PRIMARY KEY REFERENCES accounts(id), items TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0)',
  );
  return {
    close: () => db.close(),
    createAccount: (username: string | number, passwordHash: string | number) =>
      db.prepare('INSERT INTO accounts(username,password) VALUES(?,?)').run(username, passwordHash),
    findAccount: (username: string | number) =>
      db.prepare('SELECT * FROM accounts WHERE username=?').get(username),
    expireSessions: (now: string | number) =>
      db.prepare('DELETE FROM sessions WHERE expires < ?').run(now),
    createSession: (
      tokenHash: string | number,
      accountId: string | number,
      expires: string | number,
    ) => db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(tokenHash, accountId, expires),
    findSessionAccount: (tokenHash: string | number, now: string | number) =>
      db
        .prepare(
          'SELECT accounts.id, username FROM accounts JOIN sessions ON accounts.id=sessions.account_id WHERE token=? AND expires>?',
        )
        .get(tokenHash, now),
    deleteSession: (tokenHash: string | number) =>
      db.prepare('DELETE FROM sessions WHERE token=?').run(tokenHash),
    listCharacters: (accountId: string | number) =>
      db
        .prepare('SELECT id,name,class FROM characters WHERE account_id=? ORDER BY id')
        .all(accountId),
    countCharacters: (accountId: string | number) =>
      db.prepare('SELECT count(*) AS n FROM characters WHERE account_id=?').get(accountId),
    createCharacter: (
      accountId: string | number,
      name: string | number,
      heroClass: string | number,
    ) =>
      db
        .prepare('INSERT INTO characters(account_id,name,class) VALUES(?,?,?)')
        .run(accountId, name, heroClass),
    findCharacter: (characterId: string | number, accountId: string | number) =>
      db
        .prepare('SELECT * FROM characters WHERE id=? AND account_id=?')
        .get(characterId, accountId),
    saveProfile: (profileJson: string, characterId: number, revision: number) =>
      db
        .prepare('UPDATE characters SET profile=?, revision=revision+1 WHERE id=? AND revision=?')
        .run(profileJson, characterId, revision),
    readVault: (accountId: number) =>
      db.prepare('SELECT items,revision FROM vaults WHERE account_id=?').get(accountId),
    saveVault: (accountId: number, itemsJson: string, revision: number) =>
      db
        .prepare(
          'INSERT INTO vaults(account_id,items,revision) VALUES(?,?,?) ON CONFLICT(account_id) DO UPDATE SET items=excluded.items, revision=excluded.revision',
        )
        .run(accountId, itemsJson, revision),
    transaction<T>(work: () => T): T {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = work();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
