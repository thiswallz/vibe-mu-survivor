import type { InventoryItem, VaultSnapshot } from '@mu-survivor/models';
import { ITEMS } from '@mu-survivor/game/loot';
import { itemName } from '@mu-survivor/game/equipment';
interface VaultPanelOptions {
  inventory: () => InventoryItem[];
  load: () => Promise<VaultSnapshot>;
  transfer: (
    item: InventoryItem,
    direction: 'deposit' | 'withdraw',
    revision: number,
  ) => Promise<VaultSnapshot>;
  icon: (id: string) => string;
}
export function createVaultPanel(options: VaultPanelOptions) {
  const overlay = document.createElement('div');
  overlay.id = 'vault-overlay';
  overlay.hidden = true;
  document.body.append(overlay);
  let snapshot: VaultSnapshot = { items: [], revision: 0 };
  let busy = false;
  let error = '';
  function render() {
    overlay.innerHTML = `<section class="vault-window" role="dialog" aria-modal="true" aria-labelledby="vault-title"><header><h2 id="vault-title">Account vault</h2><button id="vault-close" aria-label="Close vault">×</button></header><p>Only the vault is shared between your characters. Transfer one item at a time. Unequip worn items before depositing.</p><div class="vault-columns"><section><h3>Character inventory</h3><div id="deposit-items"></div></section><section><h3>Shared account vault</h3><div id="withdraw-items"></div></section></div><p role="status" id="vault-status"></p></section>`;
    overlay.querySelector('#vault-status')!.textContent =
      error || (busy ? 'Saving transfer…' : 'Transfers are saved to SQLite immediately.');
    overlay.querySelector<HTMLButtonElement>('#vault-close')!.onclick = () => {
      if (!busy) overlay.hidden = true;
    };
    for (const direction of ['deposit', 'withdraw'] as const) {
      const host = overlay.querySelector(`#${direction}-items`)!;
      const items = direction === 'deposit' ? options.inventory() : snapshot.items;
      if (!items.length) {
        const text = document.createElement('p');
        text.textContent = 'Empty';
        host.append(text);
      }
      for (const item of items) {
        const button = document.createElement('button');
        button.className = 'vault-item';
        button.disabled = busy;
        const img = document.createElement('img');
        img.src = options.icon(item.id);
        img.alt = '';
        const label = document.createElement('span');
        label.textContent = `${ITEMS[item.id].kind === 'equipment' ? itemName(item) : ITEMS[item.id].name} ×${item.quantity}`;
        const action = document.createElement('b');
        action.textContent = direction === 'deposit' ? 'DEPOSIT →' : '← WITHDRAW';
        button.append(img, label, action);
        button.onclick = async () => {
          busy = true;
          error = '';
          render();
          try {
            snapshot = await options.transfer(item, direction, snapshot.revision);
          } catch (reason) {
            error = reason instanceof Error ? reason.message : 'Transfer failed';
          } finally {
            busy = false;
            render();
          }
        };
        host.append(button);
      }
    }
  }
  return {
    get visible() {
      return !overlay.hidden;
    },
    hide() {
      if (!busy) overlay.hidden = true;
    },
    async open() {
      overlay.hidden = false;
      busy = true;
      error = '';
      render();
      try {
        snapshot = await options.load();
      } catch (reason) {
        error = reason instanceof Error ? reason.message : 'Vault unavailable';
      } finally {
        busy = false;
        render();
      }
    },
  };
}
