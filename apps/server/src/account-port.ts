// Application-owned persistence contract. No HTTP or database driver types cross this boundary.
type StoredRow = Record<string, string | number | bigint | Uint8Array | null>;
type InsertResult = { lastInsertRowid: number | bigint };
export interface AccountRepository {
  createAccount(username: string, passwordHash: string): unknown;
  findAccount(username: string): StoredRow | undefined;
  expireSessions(now: number): unknown;
  createSession(tokenHash: string, accountId: number, expires: number): unknown;
  findSessionAccount(tokenHash: string, now: number): StoredRow | undefined;
  deleteSession(tokenHash: string): unknown;
  listCharacters(accountId: number): StoredRow[];
  countCharacters(accountId: number): StoredRow | undefined;
  createCharacter(accountId: number, name: string, heroClass: string): InsertResult;
  findCharacter(characterId: number, accountId: number): StoredRow | undefined;
  saveProfile(
    profileJson: string,
    characterId: number,
    revision: number,
  ): { changes: number | bigint };
  readVault(accountId: number): StoredRow | undefined;
  saveVault(accountId: number, itemsJson: string, revision: number): unknown;
  transaction<T>(work: () => T): T;
}
