import type { StageDefinition } from '@mu-survivor/models';
// Keep client placements, but only props that fit a small survivor arena.
export function keepArenaProp(
  type: number,
  bounds: { height: number; width: number; depth: number },
) {
  const allowed =
    type <= 34 ||
    (type >= 40 && type <= 46) ||
    [58, 59, 90, 96, 97, 98, 99, 100, 101, 102, 103, 106, 107, 108, 109].includes(type);
  return allowed && bounds.height <= 4.5 && bounds.width <= 7 && bounds.depth <= 7;
}
export function solidArenaProp(
  type: number,
  bounds: { height: number; width: number; depth: number },
) {
  return (
    !(type >= 20 && type <= 27) &&
    ![50, 51].includes(type) &&
    bounds.height > 0.45 &&
    bounds.width > 0.25 &&
    bounds.depth > 0.25
  );
}

export const STAGES: readonly StageDefinition[] = [
  {
    id: 'lorencia-1',
    worldId: 'lorencia',
    worldName: 'Lorencia',
    worldNumber: 1,
    mapNumber: 1,
    name: 'The First Stand',
    description: 'Defend the sanctuary outskirts amid ancient stone and open grassland.',
    difficulty: 'Normal',
    terrain: 'assets/lorencia-terrain.json',
    objects: 'assets/lorencia-objects.json',
    texture: 'assets/textures/lorencia-terrain.jpg',
    fog: '#17282a',
    ground: '#b9c5b0',
    sun: '#f0d4ad',
    enemyHealth: 1,
    enemyDamage: 1,
    spawnRate: 1,
    enemyOrder: [0, 1, 2, 3, 4],
  },
  {
    id: 'lorencia-2',
    worldId: 'lorencia',
    worldName: 'Lorencia',
    worldNumber: 1,
    mapNumber: 2,
    name: 'Forgotten Crossroads',
    description: 'Hold the ruined trade roads as larger packs converge on the crossing.',
    difficulty: 'Veteran',
    terrain: 'assets/lorencia-terrain.json',
    objects: 'assets/stages/lorencia-2-objects.json',
    texture: 'assets/textures/lorencia-terrain.jpg',
    fog: '#292922',
    ground: '#c6bc9c',
    sun: '#ffd39a',
    enemyHealth: 1.12,
    enemyDamage: 1.08,
    spawnRate: 1.12,
    enemyOrder: [1, 0, 3, 2, 4],
  },
  {
    id: 'noria-1',
    worldId: 'noria',
    worldName: 'Noria',
    worldNumber: 2,
    mapNumber: 1,
    name: 'Tree of Light',
    description: 'Protect the forest path beneath the living canopy of the elven homeland.',
    difficulty: 'Normal',
    terrain: 'assets/stages/noria-1-terrain.json',
    objects: 'assets/stages/noria-1-objects.json',
    texture: 'assets/textures/noria-1-terrain.jpg',
    fog: '#183729',
    ground: '#c3e7ac',
    sun: '#d4ffc5',
    enemyHealth: 1.08,
    enemyDamage: 1,
    spawnRate: 1.05,
    enemyOrder: [0, 3, 1, 2, 4],
  },
  {
    id: 'noria-2',
    worldId: 'noria',
    worldName: 'Noria',
    worldNumber: 2,
    mapNumber: 2,
    name: 'Forgotten Grove',
    description: 'Fight through the overgrown passage where the woodland closes around you.',
    difficulty: 'Veteran',
    terrain: 'assets/stages/noria-2-terrain.json',
    objects: 'assets/stages/noria-2-objects.json',
    texture: 'assets/textures/noria-2-terrain.jpg',
    fog: '#102b24',
    ground: '#9acc9c',
    sun: '#c6e9b5',
    enemyHealth: 1.2,
    enemyDamage: 1.1,
    spawnRate: 1.18,
    enemyOrder: [3, 0, 2, 1, 4],
  },
  {
    id: 'devias-1',
    worldId: 'devias',
    worldName: 'Devias',
    worldNumber: 3,
    mapNumber: 1,
    name: 'Snowfield',
    description: 'Stand against the horde on the frozen road beyond the northern outpost.',
    difficulty: 'Hard',
    terrain: 'assets/stages/devias-1-terrain.json',
    objects: 'assets/stages/devias-1-objects.json',
    texture: 'assets/textures/devias-1-terrain.jpg',
    fog: '#526b7e',
    ground: '#e3efff',
    sun: '#c5ddff',
    enemyHealth: 1.15,
    enemyDamage: 1.08,
    spawnRate: 1.1,
    enemyOrder: [1, 3, 0, 4, 2],
  },
  {
    id: 'devias-2',
    worldId: 'devias',
    worldName: 'Devias',
    worldNumber: 3,
    mapNumber: 2,
    name: 'Frozen Pass',
    description: 'Survive the narrow icy approach as relentless waves descend from the mountains.',
    difficulty: 'Hard',
    terrain: 'assets/stages/devias-2-terrain.json',
    objects: 'assets/stages/devias-2-objects.json',
    texture: 'assets/textures/devias-2-terrain.jpg',
    fog: '#354b66',
    ground: '#ccdef6',
    sun: '#a8caff',
    enemyHealth: 1.3,
    enemyDamage: 1.15,
    spawnRate: 1.25,
    enemyOrder: [3, 1, 4, 2, 0],
  },
];
export const DEFAULT_STAGE = STAGES[0];
export function getStage(id: string) {
  return STAGES.find((stage) => stage.id === id);
}
