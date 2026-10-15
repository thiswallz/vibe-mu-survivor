import type { Equipment, HeroId, StageDefinition } from '@mu-survivor/models';
import { ITEMS } from '@mu-survivor/game/loot';
import { itemStats } from '@mu-survivor/game/equipment';
import { mapDrops, bestMapDrops, mapLootSettings } from '@mu-survivor/game/map-loot';
import { CLASSES } from '@mu-survivor/game';
export interface MapLootView {
  hero: () => HeroId;
  equipment: () => Equipment;
  icon: (id: string) => string;
}
const score = (id: string, enhancement: number) => {
  const s = itemStats({ id, enhancement });
  return s.defense + s.vitality * 2 + s.attackPower * 2 + s.aura * 30;
};
export function renderMapLoot(host: HTMLElement, stage: StageDefinition, view: MapLootView) {
  const hero = view.hero(),
    gear = view.equipment(),
    drops = mapDrops(stage),
    best = bestMapDrops(stage, hero);
  host.replaceChildren();
  const heading = document.createElement('h3');
  heading.textContent = `Best potential for ${CLASSES.find((entry) => entry.id === hero)!.name}`;
  const caption = document.createElement('p');
  caption.className = 'loot-caption';
  caption.textContent = `${mapLootSettings(stage).limit} drops maximum · Equipment +0–${mapLootSettings(stage).max}`;
  const grid = document.createElement('div');
  grid.className = 'map-best-loot';
  for (const drop of best) {
    const def = ITEMS[drop.id],
      card = document.createElement('div');
    card.className = 'map-loot-card';
    if (view.icon(drop.id)) {
      const image = document.createElement('img');
      image.src = view.icon(drop.id);
      image.alt = '';
      card.append(image);
    }
    const label = document.createElement('span');
    label.textContent = def.name;
    const detail = document.createElement('small');
    const targetScores = (def.slots || [def.slot!]).map((slot) =>
      gear[slot] ? score(gear[slot]!.id, gear[slot]!.enhancement) : 0,
    );
    const better = score(drop.id, drop.maxEnhancement) > Math.min(...targetScores);
    detail.textContent = better
      ? `Potential upgrade · up to +${drop.maxEnhancement}`
      : `Up to +${drop.maxEnhancement}`;
    card.append(label, detail);
    grid.append(card);
  }
  const details = document.createElement('details'),
    summary = document.createElement('summary');
  summary.textContent = `All ${drops.length} possible drops`;
  details.append(summary);
  const list = document.createElement('ul');
  list.className = 'map-drop-list';
  const total = drops
    .filter((drop) => drop.source === 'monster')
    .reduce((sum, drop) => sum + drop.weight, 0);
  for (const drop of drops) {
    const def = ITEMS[drop.id],
      entry = document.createElement('li');
    entry.classList.toggle('incompatible', !!def.hero && def.hero !== hero);
    const label = document.createElement('span');
    label.textContent = def.name;
    const note = document.createElement('small');
    note.textContent =
      drop.source === 'guardian'
        ? 'Guardian'
        : `${((drop.weight / total) * 100).toFixed(1)}%${def.hero ? ' · ' + CLASSES.find((h) => h.id === def.hero)!.name : ''}`;
    entry.append(label, note);
    list.append(entry);
  }
  const note = document.createElement('p');
  note.className = 'loot-caption';
  note.textContent =
    'Monster percentages apply after the guaranteed first class weapon. Other-class equipment can go into your vault.';
  details.append(list, note);
  host.append(heading, caption, grid, details);
}
