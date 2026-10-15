import { renderMapLoot, type MapLootView } from './map-loot-panel.js';
import type { StageDefinition } from '@mu-survivor/models';
import { STAGES, DEFAULT_STAGE } from '@mu-survivor/game/stage';
export function createWorldSelection(
  load: (stage: StageDefinition) => Promise<void>,
  loot: MapLootView,
) {
  const world = document.getElementById('world-select') as HTMLSelectElement;
  const map = document.getElementById('map-select') as HTMLSelectElement;
  const play = document.getElementById('begin') as HTMLButtonElement;
  const status = document.getElementById('stage-status')!;
  let current = DEFAULT_STAGE,
    ready = false,
    busy = false;
  const worlds = STAGES.filter(
    (stage, index) => STAGES.findIndex((other) => other.worldId === stage.worldId) === index,
  );
  for (const stage of worlds)
    world.add(new Option(`World ${stage.worldNumber} · ${stage.worldName}`, stage.worldId));
  function options() {
    map.replaceChildren();
    for (const stage of STAGES.filter((stage) => stage.worldId === world.value))
      map.add(new Option(`Map ${stage.mapNumber} · ${stage.name}`, stage.id));
  }
  function controls() {
    world.disabled = map.disabled = !ready || busy;
    play.disabled = !ready || busy;
  }
  function summary() {
    document.getElementById('world-name')!.textContent =
      `WORLD ${current.worldNumber} · ${current.worldName.toUpperCase()}`;
    document.getElementById('stage-name')!.textContent =
      `MAP ${current.mapNumber} · ${current.name}`;
    document.getElementById('stage-description')!.textContent = current.description;
    document.getElementById('stage-difficulty')!.textContent = current.difficulty;
    renderMapLoot(document.getElementById('map-loot')!, current, loot);
    play.textContent = `PLAY ${current.worldName.toUpperCase()} · MAP ${current.mapNumber} ↗`;
  }
  async function select() {
    const stage = STAGES.find((stage) => stage.id === map.value);
    if (!stage || !ready || busy) return;
    busy = true;
    status.textContent = `Preparing ${stage.worldName} · ${stage.name}…`;
    controls();
    try {
      await load(stage);
      current = stage;
      summary();
      status.textContent = 'Ready to enter. Stop moving to attack. Dash to evade.';
    } catch (error) {
      world.value = current.worldId;
      options();
      map.value = current.id;
      status.textContent = `Could not load this map: ${error instanceof Error ? error.message : 'Please retry.'}`;
    } finally {
      busy = false;
      controls();
    }
  }
  world.value = current.worldId;
  options();
  map.value = current.id;
  controls();
  summary();
  world.onchange = () => {
    options();
    void select();
  };
  map.onchange = () => void select();
  return {
    refresh: summary,
    enable() {
      ready = true;
      controls();
      summary();
    },
  };
}
