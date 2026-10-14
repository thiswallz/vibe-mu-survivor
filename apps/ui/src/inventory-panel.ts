import type { EquipmentActor, InventoryItem, EquipmentSlot } from '@mu-survivor/models';
import { ITEMS } from '@mu-survivor/game/loot';
import { SLOTS, SLOT_LABELS, itemKey } from '@mu-survivor/game/equipment';
const placeholders: Record<EquipmentSlot, string> = {
  helm: 'cap',
  armor: 'upper',
  pants: 'lower',
  gloves: 'gloves',
  boots: 'boots',
  weapon: 'weapon(r)',
};
const title = (item: Pick<InventoryItem, 'id' | 'enhancement'>) =>
  ITEMS[item.id].name + (item.enhancement ? ' +' + item.enhancement : '');
interface PanelOptions {
  context: () => EquipmentActor;
  icon: (id: string) => string;
  equip: (item: InventoryItem) => void;
  unequip: (slot: EquipmentSlot) => void;
  openBox: () => InventoryItem | null;
  close: () => void;
}
export function createInventoryPanel({
  context,
  icon,
  equip,
  unequip,
  openBox,
  close,
}: PanelOptions) {
  const overlay = document.createElement('div');
  overlay.id = 'inventory-overlay';
  overlay.hidden = true;
  document.body.append(overlay);
  let selected: string | null = null;
  function render() {
    const s = context(),
      items = s.inventory;
    let chosen = items.find((item) => itemKey(item) === selected);
    if (!chosen) {
      chosen = items.find((i) => ITEMS[i.id].hero === s.hero.id) || items[0];
      selected = chosen ? itemKey(chosen) : null;
    }
    const def = chosen && ITEMS[chosen.id],
      equipped =
        chosen &&
        def.slot &&
        (s.equipment[def.slot] ? itemKey(s.equipment[def.slot]!) : null) === itemKey(chosen),
      compatible = def?.hero === s.hero.id;
    const equippedCount = SLOTS.filter((slot) => s.equipment[slot]).length;
    const picture = (item: Pick<InventoryItem, 'id' | 'enhancement'>) =>
      `<img src="${icon(item.id)}" alt="" draggable="false">`;
    overlay.innerHTML = `<section class="inventory-window" role="dialog" aria-modal="true" aria-labelledby="inventory-title"><header class="inventory-title"><h2 id="inventory-title">Inventory</h2><button id="inventory-close" aria-label="Close inventory">×</button></header><div class="inventory-character"><b>${s.hero.name || { knight: 'Dark Knight', wizard: 'Dark Wizard', elf: 'Fairy Elf' }[s.hero.id]}</b><span>${equippedCount} / 6 equipped</span></div><div class="equipment-slots">${SLOTS.map(
      (slot) => {
        const item = s.equipment[slot];
        return `<button class="equipment-slot slot-${slot} ${item ? 'filled' : ''}" data-slot="${slot}" title="${item ? title(item) : 'Empty ' + SLOT_LABELS[slot]}">${item ? picture(item) : `<img class="slot-outline" src="assets/textures/interface-newui_item_${placeholders[slot]}-alpha.png" alt="">`}<small>${SLOT_LABELS[slot]}</small>${item?.enhancement ? `<em>+${item.enhancement}</em>` : ''}</button>`;
      },
    ).join(
      '',
    )}</div><div class="inventory-bag-title"><span>ITEM BAG</span><span>${items.reduce((n, i) => n + i.quantity, 0)} items</span></div><div class="inventory-grid">${Array.from(
      { length: Math.max(32, Math.ceil(items.length / 8) * 8) },
      (_, i) => {
        const item = items[i];
        return item
          ? `<button class="inventory-cell ${itemKey(item) === selected ? 'selected' : ''} ${ITEMS[item.id].hero && ITEMS[item.id].hero !== s.hero.id ? 'other-class' : ''}" data-item="${i}" title="${title(item)}">${picture(item)}${item.enhancement ? `<em>+${item.enhancement}</em>` : ''}${item.quantity > 1 ? `<small>×${item.quantity}</small>` : ''}</button>`
          : '<div class="inventory-cell empty"></div>';
      },
    ).join(
      '',
    )}</div><div class="inventory-detail">${chosen ? `<b style="color:${def.color}">${title(chosen)}</b><p>${def.kind === 'equipment' ? (compatible ? `${SLOT_LABELS[def!.slot!]} · ${def.slot === 'weapon' ? 'Increases attack power' : 'Increases defense and maximum vitality'}${equipped ? ' · Equipped' : ''}` : `For ${{ knight: 'Dark Knight', wizard: 'Dark Wizard', elf: 'Fairy Elf' }[def!.hero!]}`) : def.kind === 'box' ? 'Open to receive an equipment piece for this hero.' : 'MU jewel · Kept for future upgrade crafting.'}</p>` : '<b>Your inventory is empty.</b><p>Monster drops go here. Empty slots equip matching pieces automatically.</p>'}</div><div class="inventory-actions">${chosen && def.kind === 'equipment' ? `<button id="inventory-equip" ${compatible ? '' : 'disabled'}>${equipped ? 'UNEQUIP' : 'EQUIP'}</button>` : chosen && def.kind === 'box' ? '<button id="inventory-open-box">OPEN BOX</button>' : ''}<span>Saved on this device · <kbd>I</kbd> close</span></div><div class="inventory-help">Select a piece above or in the bag to equip or remove it.</div></section>`;
    overlay.querySelector<HTMLButtonElement>('#inventory-close')!.onclick = close;
    for (const button of overlay.querySelectorAll<HTMLButtonElement>('[data-item]'))
      button.onclick = () => {
        selected = itemKey(items[Number(button.dataset.item)]);
        render();
      };
    for (const button of overlay.querySelectorAll<HTMLButtonElement>('[data-slot]'))
      button.onclick = () => {
        const item = s.equipment[button.dataset.slot as EquipmentSlot];
        if (item) {
          selected = itemKey(item);
          render();
        }
      };
    const equipButton = overlay.querySelector<HTMLButtonElement>('#inventory-equip');
    if (equipButton)
      equipButton.onclick = () => {
        if (equipped) unequip(def!.slot!);
        else equip(chosen!);
        render();
      };
    const boxButton = overlay.querySelector<HTMLButtonElement>('#inventory-open-box');
    if (boxButton)
      boxButton.onclick = () => {
        const reward = openBox();
        if (reward) selected = itemKey(reward);
        render();
      };
  }
  return {
    get visible() {
      return !overlay.hidden;
    },
    open() {
      overlay.hidden = false;
      render();
      overlay.querySelector<HTMLButtonElement>('#inventory-close')!.focus();
    },
    hide() {
      overlay.hidden = true;
    },
    render,
  };
}
