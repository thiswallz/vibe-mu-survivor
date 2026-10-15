import type { StageDefinition, HeroId } from '@mu-survivor/models';
import { ARMOR_ITEMS, itemStats } from './equipment.js';
export interface MapDrop {
  id: string;
  weight: number;
  source: 'monster' | 'guardian';
  minEnhancement: number;
  maxEnhancement: number;
}
const settings: Record<
  string,
  { tiers: number[]; extras: string[]; max: number; limit: number; preferred?: HeroId }
> = {
  'lorencia-1': {
    tiers: [1],
    extras: ['ring-ice', 'shield-round', 'pet-angel', 'jewel-bless'],
    max: 5,
    limit: 24,
  },
  'lorencia-2': {
    tiers: [1, 2],
    extras: [
      'ring-fire',
      'pendant-lightning',
      'shield-round',
      'pet-satan',
      'jewel-bless',
      'jewel-chaos',
    ],
    max: 7,
    limit: 30,
  },
  'noria-1': {
    tiers: [1, 2],
    extras: [
      'ring-ice',
      'pendant-lightning',
      'pet-angel',
      'wings-angel',
      'jewel-bless',
      'jewel-life',
    ],
    max: 7,
    limit: 28,
    preferred: 'elf',
  },
  'noria-2': {
    tiers: [2, 3],
    extras: [
      'ring-fire',
      'pendant-lightning',
      'pet-angel',
      'pet-satan',
      'wings-angel',
      'jewel-soul',
      'jewel-life',
    ],
    max: 10,
    limit: 36,
    preferred: 'elf',
  },
  'devias-1': {
    tiers: [2, 3],
    extras: [
      'ring-ice',
      'shield-round',
      'pendant-lightning',
      'pet-angel',
      'wings-angel',
      'jewel-soul',
      'jewel-chaos',
    ],
    max: 11,
    limit: 36,
  },
  'devias-2': {
    tiers: [3],
    extras: [
      'ring-ice',
      'ring-fire',
      'pendant-lightning',
      'shield-round',
      'pet-angel',
      'pet-satan',
      'wings-angel',
      'jewel-bless',
      'jewel-soul',
      'jewel-life',
      'jewel-chaos',
    ],
    max: 15,
    limit: 42,
  },
};
export function mapLootSettings(stage: Pick<StageDefinition, 'id'>) {
  return settings[stage.id] || settings['lorencia-1'];
}
export function mapDrops(stage: Pick<StageDefinition, 'id'>): MapDrop[] {
  const config = mapLootSettings(stage);
  const gear = Object.values(ARMOR_ITEMS).filter(
    (def) => def.hero && config.tiers.includes(def.tier || 3),
  );
  return [
    ...gear.map((def) => ({
      id: def.id,
      weight:
        (def.tier === Math.min(...config.tiers) ? 10 : 3) *
        (config.preferred === def.hero ? 1.8 : 1),
      source: 'monster' as const,
      minEnhancement: 0,
      maxEnhancement: config.max,
    })),
    ...config.extras.map((id) => ({
      id,
      weight: id.startsWith('jewel-')
        ? 12
        : id.startsWith('pet-') || id.startsWith('wings-')
          ? 3
          : 8,
      source: 'monster' as const,
      minEnhancement: 0,
      maxEnhancement: config.max,
    })),
    {
      id: 'kundun-box',
      weight: 1,
      source: 'guardian' as const,
      minEnhancement: 0,
      maxEnhancement: 0,
    },
  ];
}
export function rollMapDrop(
  stage: Pick<StageDefinition, 'id'>,
  hero: HeroId,
  first: boolean,
  random: () => number,
): MapDrop {
  let pool = mapDrops(stage).filter((drop) => drop.source === 'monster');
  if (first)
    pool = pool.filter(
      (drop) => ARMOR_ITEMS[drop.id]?.hero === hero && ARMOR_ITEMS[drop.id]?.slot === 'weapon',
    );
  const total = pool.reduce((sum, drop) => sum + drop.weight, 0);
  let roll = Math.max(0, Math.min(0.999999, random())) * total;
  for (const drop of pool) {
    roll -= drop.weight;
    if (roll < 0) return drop;
  }
  return pool[pool.length - 1];
}
export function bestMapDrops(stage: Pick<StageDefinition, 'id'>, hero: HeroId, limit = 6) {
  const scored = mapDrops(stage)
    .filter((drop) => {
      const def = ARMOR_ITEMS[drop.id];
      return !!def && (!def.hero || def.hero === hero);
    })
    .map((drop) => {
      const stats = itemStats({ id: drop.id, enhancement: drop.maxEnhancement });
      return {
        ...drop,
        score: stats.defense + stats.vitality * 2 + stats.attackPower * 2 + stats.aura * 30,
      };
    })
    .sort((a, b) => b.score - a.score);
  const slots = new Set<string>();
  const diverse = scored.filter((drop) => {
    const slot = ARMOR_ITEMS[drop.id].slot!;
    if (slots.has(slot)) return false;
    slots.add(slot);
    return true;
  });
  const anchors = ['weapon', 'armor']
    .map((slot) => diverse.find((drop) => ARMOR_ITEMS[drop.id].slot === slot))
    .filter((drop): drop is (typeof diverse)[number] => !!drop);
  return [...anchors, ...diverse.filter((drop) => !anchors.includes(drop))].slice(0, limit);
}
