import type { EquipmentActor, GameState, HeroId } from '@mu-survivor/models';
import { itemStats } from '@mu-survivor/game/equipment';

// Original starting attributes; combat values below reflect this survivor demo.
const startingAttributes: Record<HeroId, [number, number, number, number]> = {
  knight: [28, 20, 25, 10],
  wizard: [18, 18, 15, 30],
  elf: [22, 25, 20, 15],
};
export function createCharacterPanel(close: () => void) {
  const overlay = document.createElement('div');
  overlay.id = 'character-overlay';
  overlay.hidden = true;
  document.body.append(overlay);
  return {
    get visible() {
      return !overlay.hidden;
    },
    hide() {
      overlay.hidden = true;
    },
    show(actor: EquipmentActor, run: GameState | null) {
      const [strength, agility, vitality, energy] = startingAttributes[actor.hero.id];
      const row = (name: string, value: string | number) =>
        `<div class="character-stat"><span>${name}</span><b>${value}</b></div>`;
      const defense = Object.values(actor.equipment).reduce(
        (total, item) => total + (item ? itemStats(item).defense : 0),
        0,
      );
      overlay.innerHTML = `<section class="inventory-window" role="dialog" aria-modal="true" aria-labelledby="character-title"><header class="inventory-title"><h2 id="character-title">Character</h2><button aria-label="Close character stats">×</button></header><div class="inventory-character"><b>${actor.hero.name}</b><span>Level ${run?.level || 1}</span></div><h3 class="stat-heading">Attributes</h3>${row('Strength', strength)}${row('Agility', agility)}${row('Vitality', `${vitality}${actor.gearHp ? ` + ${actor.gearHp}` : ''}`)}${row('Energy', energy)}<h3 class="stat-heading">Battle stats</h3>${row('Life', `${Math.ceil(actor.hp)} / ${actor.maxHp}`)}${row('Attack damage', Math.round(actor.damage))}${row('Defense', defense)}${row('Damage reduction', `${Math.round((actor.gearDefense || 0) * 100)}%`)}${row('Critical chance', `${Math.round((run?.criticalChance ?? 0.12) * 100)}%`)}${row('Critical damage', `${Math.round((run?.criticalMultiplier ?? 1.5) * 100)}%`)}${row('Movement speed', (run?.speed ?? actor.hero.speed ?? 0).toFixed(1))}<p class="inventory-help">Starting MU attributes · Equipment bonuses shown in gold.<br>Battle stats reflect your current survivor build. <kbd>C</kbd> close</p></section>`;
      overlay.hidden = false;
      overlay.querySelector<HTMLButtonElement>('button')!.onclick = close;
      overlay.querySelector<HTMLButtonElement>('button')!.focus();
    },
  };
}
