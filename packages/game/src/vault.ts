import type { InventoryProfile, InventoryItem } from '@mu-survivor/models';
import { itemKey } from './equipment.js';
import { mergeInventory, takeItem } from './loot.js';
export function transferVaultItem(
  profile: InventoryProfile,
  vault: InventoryItem[],
  item: InventoryItem,
  direction: 'deposit' | 'withdraw',
) {
  const source = direction === 'deposit' ? profile.items : vault;
  const target = direction === 'deposit' ? vault : profile.items;
  if (target.some((entry) => itemKey(entry) === itemKey(item) && entry.quantity >= 9999))
    throw new Error('The destination stack is full.');
  const remaining = takeItem(source, item);
  if (!remaining) throw new Error('That item is no longer in the selected inventory.');
  const copy = { id: item.id, enhancement: item.enhancement || 0, quantity: 1 };
  return {
    profile: {
      ...profile,
      items: direction === 'deposit' ? remaining : mergeInventory(profile.items, [copy]),
    },
    items: direction === 'withdraw' ? remaining : mergeInventory(vault, [copy]),
  };
}
