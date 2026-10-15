import type {
  CharacterProfileResponse,
  VaultSnapshot,
  VaultTransferResponse,
  InventoryItem,
} from '@mu-survivor/models';
import { requestAccountApi as request } from '@mu-survivor/sdk';
export { requestAccountApi as request } from '@mu-survivor/sdk';
import type { InventoryStorage } from '@mu-survivor/models';
import type { CharacterSummary as Character } from '@mu-survivor/models';
export let activeCharacter: Character | null = null;
export let isGuest = false;
const guestProfiles = new Map<string, string>();
let profileValue: string | null = null;
let profileRevision = 0;
let pending = Promise.resolve();
export const characterStorage: InventoryStorage = {
  getItem: () => profileValue,
  setItem: (_key, value) => {
    if (!activeCharacter) throw new Error('Select a character');
    profileValue = value;
    if (isGuest) {
      guestProfiles.set(`${activeCharacter.name.toLowerCase()}:${activeCharacter.class}`, value);
      return;
    }
    const id = activeCharacter.id;
    pending = pending
      .catch(() => {})
      .then(async () => {
        const result = await request<{ revision: number }>(`characters/${id}/profile`, 'PUT', {
          profile: JSON.parse(value),
          revision: profileRevision,
        });
        profileRevision = result.revision;
      })
      .catch((error: unknown) => {
        document.getElementById('save-status')!.textContent =
          `Inventory save failed: ${error instanceof Error ? error.message : 'Connection lost'}. Keep this page open and try again.`;
        throw error;
      });
    void pending.catch(() => {});
  },
};
export async function flushSaves() {
  await pending;
}
export async function selectCharacter(character: Character) {
  await flushSaves();
  const data = await request<CharacterProfileResponse>(`characters/${character.id}/profile`);
  profileRevision = data.revision;
  isGuest = false;
  activeCharacter = character;
  profileValue = data.profile ? JSON.stringify(data.profile) : null;
}

export function clearSession() {
  isGuest = false;
  activeCharacter = null;
  profileValue = null;
}

export async function selectGuest(name: string, heroClass: Character['class']) {
  await flushSaves();
  isGuest = true;
  activeCharacter = { id: -1, name, class: heroClass };
  profileValue = guestProfiles.get(`${name.toLowerCase()}:${heroClass}`) || null;
}

export async function readVault() {
  await flushSaves();
  return request<VaultSnapshot>('vault');
}
export async function transferItem(
  item: InventoryItem,
  direction: 'deposit' | 'withdraw',
  vaultRevision: number,
) {
  if (!activeCharacter || isGuest) throw new Error('Sign in to use the account vault.');
  await flushSaves();
  const result = await request<VaultTransferResponse>('vault/transfer', 'POST', {
    characterId: activeCharacter.id,
    item,
    direction,
    characterRevision: profileRevision,
    vaultRevision,
  });
  profileValue = JSON.stringify(result.profile);
  profileRevision = result.revision;
  return result;
}
