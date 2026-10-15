import { enhancementAppearance } from './appearance.js';
import type { EquipmentActor, InventoryItem, EquipmentSlot } from '@mu-survivor/models';
import { ITEMS } from '@mu-survivor/game/loot';
import {
  SLOTS,
  fitsSlot,
  SLOT_LABELS,
  itemKey,
  bagItems,
  itemName,
  itemColor,
  itemStats,
} from '@mu-survivor/game/equipment';
const placeholders: Partial<Record<EquipmentSlot, string>> = {
  helm: 'cap',
  armor: 'upper',
  pants: 'lower',
  gloves: 'gloves',
  boots: 'boots',
  weapon: 'weapon(r)',
};
const title = (item: Pick<InventoryItem, 'id' | 'enhancement'>) =>
  ITEMS[item.id].kind === 'equipment' ? itemName(item) : ITEMS[item.id].name;
interface PanelOptions {
  context: () => EquipmentActor;
  icon: (id: string) => string;
  equip: (item: InventoryItem, slot?: EquipmentSlot) => void;
  openVault: () => void;
  vaultAvailable: () => boolean;
  unequip: (slot: EquipmentSlot) => void;
  openBox: () => InventoryItem | null;
  close: () => void;
  preview: (item: Pick<InventoryItem, 'id' | 'enhancement'>, host: HTMLElement) => void;
  stopPreview: () => void;
}
export function createInventoryPanel({
  context,
  icon,
  equip,
  openVault,
  vaultAvailable,
  unequip,
  openBox,
  close,
  preview,
  stopPreview,
}: PanelOptions) {
  const overlay = document.createElement('div');
  overlay.id = 'inventory-overlay';
  overlay.hidden = true;
  document.body.append(overlay);
  let selected: string | null = null,
    pinned = false;
  let selectedSlot: EquipmentSlot | null = null;
  const details = document.createElement('section');
  details.id = 'item-details';
  details.hidden = true;
  document.body.append(details);
  function hideDetails() {
    details.hidden = true;
    pinned = false;
    stopPreview();
  }
  function showDetails(
    item: Pick<InventoryItem, 'id' | 'enhancement'>,
    pin = true,
    sourceSlot?: EquipmentSlot,
  ) {
    pinned = pin;
    const def = ITEMS[item.id],
      stats = itemStats(item),
      compatible = !def.hero || def.hero === context().hero.id,
      slot =
        sourceSlot || def.slots?.find((candidate) => !context().equipment[candidate]) || def.slot,
      equipped = !!sourceSlot;
    details.hidden = false;
    details.classList.toggle('pinned', pin);
    details.innerHTML = `<button class="details-close" aria-label="Close item details">×</button><h3 style="color:${def.kind === 'equipment' ? itemColor(item) : def.color}">${title(item)}</h3><div class="item-preview"></div><div class="item-stat-lines">${def.kind === 'equipment' ? `${stats.defense ? `<p>Defense: <b>+${stats.defense}</b></p>` : ''}${stats.vitality ? `<p>Vitality: <b>+${stats.vitality}</b></p>` : ''}${stats.attackPower ? `<p>Attack power: <b>+${stats.attackPower}%</b></p>` : ''}${stats.aura ? `<p>Protection aura: <b>${stats.aura}</b></p>` : ''}<p>${def.description || ''}</p><p>Enhancement: <b>+${item.enhancement || 0}</b></p><p>Required class: <b>${def.hero ? { knight: 'Dark Knight', wizard: 'Dark Wizard', elf: 'Fairy Elf' }[def.hero] : 'All classes'}</b></p>${!compatible ? '<p class="cannot-equip">Cannot equip: incompatible character class.</p>' : ''}` : `<p>${def.description || 'Stored for future crafting.'}</p>`}</div>${pin && def.kind === 'equipment' ? `<button class="details-action" ${compatible ? '' : 'disabled'}>${equipped ? 'UNEQUIP' : 'EQUIP'}</button>` : ''}`;
    details.querySelector<HTMLButtonElement>('.details-close')!.onclick = hideDetails;
    const action = details.querySelector<HTMLButtonElement>('.details-action');
    if (action)
      action.onclick = () => {
        if (equipped) {
          unequip(slot!);
          selectedSlot = null;
        } else {
          const owned = bagItems(context()).find((i) => itemKey(i) === itemKey(item));
          if (owned) {
            equip(owned, slot);
            selectedSlot = slot || null;
          }
        }
        hideDetails();
        render();
      };
    preview(item, details.querySelector<HTMLElement>('.item-preview')!);
  }
  function render() {
    hideDetails();
    const s = context(),
      items = bagItems(s);
    let chosen = [
      ...s.inventory,
      ...Object.values(s.equipment)
        .filter((item) => item !== null)
        .map((item) => ({ ...item, quantity: 1 })),
    ].find((item) => itemKey(item) === selected);
    if (!chosen) {
      chosen = items.find((i) => ITEMS[i.id].hero === s.hero.id) || items[0];
      selected = chosen ? itemKey(chosen) : null;
    }
    if (selectedSlot && s.equipment[selectedSlot])
      chosen = { ...s.equipment[selectedSlot]!, quantity: 1 };
    else selectedSlot = null;
    const def = chosen && ITEMS[chosen.id],
      equipped = chosen && selectedSlot !== null,
      compatible = !!def && (!def.hero || def.hero === s.hero.id);
    const equippedCount = SLOTS.filter((slot) => s.equipment[slot]).length;
    const picture = (item: Pick<InventoryItem, 'id' | 'enhancement'>) => {
      const level = item.enhancement || 0,
        appearance = enhancementAppearance(level);
      return `<img src="${icon(item.id)}" alt="" draggable="false" style="filter:brightness(${1 + appearance.emissive}) ${level >= 7 ? `drop-shadow(0 0 ${2 + (level - 7) * 0.4}px ${appearance.tint})` : level >= 3 ? `drop-shadow(0 0 1px ${appearance.tint})` : ''}">`;
    };
    overlay.innerHTML = `<section class="inventory-window" role="dialog" aria-modal="true" aria-labelledby="inventory-title"><header class="inventory-title"><h2 id="inventory-title">Inventory</h2><button id="inventory-close" aria-label="Close inventory">×</button></header><div class="inventory-character"><b>${s.hero.name || { knight: 'Dark Knight', wizard: 'Dark Wizard', elf: 'Fairy Elf' }[s.hero.id]}</b><span>${equippedCount} / ${SLOTS.length} equipped</span></div><div class="equipment-slots">${SLOTS.map(
      (slot) => {
        const item = s.equipment[slot];
        return `<button class="equipment-slot slot-${slot} ${item ? 'filled' : ''}" data-slot="${slot}" draggable="${!!item}" title="${item ? title(item) : 'Empty ' + SLOT_LABELS[slot]}">${item ? picture(item) : ` ${placeholders[slot] ? `<img class="slot-outline" src="assets/textures/interface-newui_item_${placeholders[slot]}-alpha.png" alt="">` : `<span class="accessory-outline">${slot === 'pet' ? '♧' : slot === 'wings' ? '⋈' : '◇'}</span>`}`}<small>${SLOT_LABELS[slot]}</small>${item?.enhancement ? `<em>+${item.enhancement}</em>` : ''}</button>`;
      },
    ).join(
      '',
    )}</div><div class="inventory-bag-title"><span>CHARACTER BAG</span><span>${items.reduce((n, i) => n + i.quantity, 0)} items</span></div><div class="inventory-grid">${Array.from(
      { length: Math.max(32, Math.ceil(items.length / 8) * 8) },
      (_, i) => {
        const item = items[i];
        return item
          ? `<button class="inventory-cell ${itemKey(item) === selected ? 'selected' : ''} ${ITEMS[item.id].hero && ITEMS[item.id].hero !== s.hero.id ? 'other-class' : ''}" data-item="${i}" draggable="true" title="${title(item)}">${picture(item)}${item.enhancement ? `<em>+${item.enhancement}</em>` : ''}${item.quantity > 1 ? `<small>×${item.quantity}</small>` : ''}</button>`
          : '<div class="inventory-cell empty"></div>';
      },
    ).join(
      '',
    )}</div><div class="inventory-detail">${chosen ? `<b style="color:${def.kind === 'equipment' ? itemColor(chosen) : def.color}">${title(chosen)}</b><p>${def.kind === 'equipment' ? (compatible ? `${SLOT_LABELS[selectedSlot || def!.slot!]} · ${[itemStats(chosen).attackPower ? 'Attack power' : '', itemStats(chosen).defense ? 'Defense' : '', itemStats(chosen).vitality ? 'Vitality' : '', itemStats(chosen).aura ? 'Protection aura' : ''].filter(Boolean).join(' · ')}${equipped ? ' · Equipped' : ''}` : `For ${{ knight: 'Dark Knight', wizard: 'Dark Wizard', elf: 'Fairy Elf' }[def!.hero!]}`) : def.kind === 'box' ? 'Open to receive an equipment piece for this hero.' : 'MU jewel · Kept for future upgrade crafting.'}</p>` : '<b>Your inventory is empty.</b><p>Monster drops go here. Empty slots equip matching pieces automatically.</p>'}</div><div class="inventory-actions">${chosen && def.kind === 'equipment' ? `<button id="inventory-equip" ${compatible ? '' : 'disabled'}>${equipped ? 'UNEQUIP' : 'EQUIP'}</button>` : chosen && def.kind === 'box' ? '<button id="inventory-open-box">OPEN BOX</button>' : ''}<span>Character inventory · Saved separately · <kbd>I</kbd> close</span></div><button id="inventory-vault" class="vault-link" ${vaultAvailable() ? '' : 'disabled'}>ACCOUNT VAULT · SHARED STORAGE</button><div class="inventory-help">${vaultAvailable() ? 'Only deposited items are shared with your other characters.' : 'Vault available from map selection for signed-in accounts.'} Select a piece above or in the bag to equip or remove it.</div></section>`;
    overlay.querySelector<HTMLButtonElement>('#inventory-close')!.onclick = close;
    overlay.querySelector<HTMLButtonElement>('#inventory-vault')!.onclick = openVault;
    for (const button of overlay.querySelectorAll<HTMLButtonElement>('[data-item]'))
      button.onclick = () => {
        selectedSlot = null;
        selected = itemKey(items[Number(button.dataset.item)]);
        render();
        showDetails(items[Number(button.dataset.item)]);
      };
    for (const button of overlay.querySelectorAll<HTMLButtonElement>('[data-slot]'))
      button.onclick = () => {
        const item = s.equipment[button.dataset.slot as EquipmentSlot];
        if (item) {
          selectedSlot = button.dataset.slot as EquipmentSlot;
          selected = itemKey(item);
          render();
          showDetails(item, true, selectedSlot!);
        }
      };
    for (const button of overlay.querySelectorAll<HTMLButtonElement>('[data-item],[data-slot]')) {
      const item =
        button.dataset.item !== undefined
          ? items[Number(button.dataset.item)]
          : s.equipment[button.dataset.slot as EquipmentSlot];
      if (item) {
        button.onpointerenter = () => {
          if (!pinned) showDetails(item, false, button.dataset.slot as EquipmentSlot | undefined);
        };
        button.onpointerleave = () => {
          if (!pinned) hideDetails();
        };
      }
      button.ondragstart = (e) => {
        hideDetails();
        const payload =
          button.dataset.item !== undefined
            ? { origin: 'bag', item: items[Number(button.dataset.item)] }
            : { origin: 'slot', slot: button.dataset.slot };
        e.dataTransfer?.setData('application/x-mu-item', JSON.stringify(payload));
      };
      if (button.dataset.slot) {
        button.ondragover = (e) => {
          e.preventDefault();
          button.classList.add('drop-target');
        };
        button.ondragleave = () => button.classList.remove('drop-target');
        button.ondrop = (e) => {
          e.preventDefault();
          button.classList.remove('drop-target');
          try {
            const data = JSON.parse(e.dataTransfer?.getData('application/x-mu-item') || 'null');
            const item =
              data?.origin === 'bag' &&
              bagItems(context()).find((i) => itemKey(i) === itemKey(data.item));
            if (
              item &&
              fitsSlot(ITEMS[item.id], button.dataset.slot as EquipmentSlot) &&
              (!ITEMS[item.id].hero || ITEMS[item.id].hero === context().hero.id)
            ) {
              equip(item, button.dataset.slot as EquipmentSlot);
              render();
            }
          } catch {
            /* Ignore unrelated external drags. */
          }
        };
      }
    }
    const grid = overlay.querySelector<HTMLElement>('.inventory-grid')!;
    grid.ondragover = (e) => e.preventDefault();
    grid.ondrop = (e) => {
      e.preventDefault();
      try {
        const data = JSON.parse(e.dataTransfer?.getData('application/x-mu-item') || 'null');
        if (data?.origin === 'slot' && SLOTS.includes(data.slot)) {
          unequip(data.slot);
          render();
        }
      } catch {
        /* Ignore unrelated external drags. */
      }
    };
    const equipButton = overlay.querySelector<HTMLButtonElement>('#inventory-equip');
    if (equipButton)
      equipButton.onclick = () => {
        if (equipped) {
          unequip(selectedSlot!);
          selectedSlot = null;
        } else equip(chosen!);
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
      hideDetails();
      overlay.hidden = true;
    },
    dismissDetails() {
      if (details.hidden) return false;
      hideDetails();
      return true;
    },
    render,
  };
}
