import type {
  HeroId,
  SkillId,
  GameState,
  HeroDefinition,
  EnemyDefinition,
  Enemy,
  SkillDefinition,
  UpgradeDefinition,
  PointXZ,
  Obstacle,
  InputState,
  InventoryItem,
  EventMap,
  GameEvent,
} from '@mu-survivor/models';
import { emptyEquipment, autoEquip, chooseDropSlots } from './equipment.js';
import { createLootState, dropLoot, collectLoot, mergeInventory } from './loot.js';
export const CLASSES: HeroDefinition[] = [
  {
    id: 'knight',
    name: 'Dark Knight',
    title: 'The blade of Lorencia',
    skill: 'Twisting Slash',
    role: 'MELEE · DURABLE',
    color: '#efb46c',
    hp: 160,
    speed: 6.4,
    damage: 32,
    cooldown: 0.8,
    range: 3.8,
    description: 'Stand your ground. A sweeping blade cuts through everything around you.',
  },
  {
    id: 'wizard',
    name: 'Dark Wizard',
    title: 'Master of the arcane',
    skill: 'Evil Spirits',
    role: 'MAGIC · AREA DAMAGE',
    color: '#9bafff',
    hp: 105,
    speed: 6.1,
    damage: 25,
    cooldown: 0.75,
    range: 17,
    description: 'Call the spirits. Seeking magic strikes the horde, or burn it with Hellfire.',
  },
  {
    id: 'elf',
    name: 'Fairy Elf',
    title: 'The silent guardian',
    skill: 'Multiple Shot',
    role: 'RANGED · AGILE',
    color: '#7eddb8',
    hp: 120,
    speed: 7.2,
    damage: 23,
    cooldown: 0.62,
    range: 20,
    description: 'Keep your distance. Twin arrows seek out enemies while you slip away.',
  },
];
export const SKILLS: Record<HeroId, SkillDefinition[]> = {
  knight: [
    {
      id: 'slash',
      name: 'Twisting Slash',
      description: 'Spin through nearby enemies.',
      icon: 41,
      sound: 'knight',
      range: 3.8,
      cooldown: 1,
      damage: 1,
    },
    {
      id: 'stab',
      name: 'Death Stab',
      description: 'Pierce a line of enemies.',
      icon: 43,
      sound: 'stab',
      range: 6,
      cooldown: 1.5,
      damage: 1.8,
    },
  ],
  wizard: [
    {
      id: 'evil',
      name: 'Evil Spirits',
      description: 'Seeking spirits attack three targets.',
      icon: 9,
      sound: 'evil',
      range: 17,
      cooldown: 1.2,
      damage: 0.85,
    },
    {
      id: 'hellfire',
      name: 'Hellfire',
      description: 'Burn every enemy around you.',
      icon: 10,
      sound: 'hellfire',
      range: 6.5,
      cooldown: 2.5,
      damage: 2.2,
    },
  ],
  elf: [
    {
      id: 'multishot',
      name: 'Multiple Shot',
      description: 'Fire multiple seeking arrows.',
      icon: 24,
      sound: 'elf',
      range: 20,
      cooldown: 1,
      damage: 1,
    },
    {
      id: 'icearrow',
      name: 'Ice Arrow',
      description: 'A powerful arrow slows its target.',
      icon: 51,
      sound: 'ice',
      range: 20,
      cooldown: 1.5,
      damage: 1.8,
    },
  ],
};
export function setSkill(s: GameState, id: SkillId) {
  if (!['playing', 'paused'].includes(s.phase)) return false;
  if (!s.unlockedSkills.includes(id) || !SKILLS[s.hero.id].some((skill) => skill.id === id))
    return false;
  s.skill = id;
  s.attackTimer = Math.max(s.attackTimer, 0.15);
  return true;
}
export const ENEMIES: EnemyDefinition[] = [
  {
    id: 'spider',
    name: 'Spider',
    hp: 28,
    speed: 2.6,
    damage: 8,
    size: 0.95,
    xp: 3,
    color: '#a39967',
  },
  {
    id: 'budge',
    name: 'Budge Dragon',
    hp: 45,
    speed: 3.5,
    damage: 10,
    size: 1.25,
    xp: 5,
    color: '#be9863',
  },
  {
    id: 'bull',
    name: 'Bull Fighter',
    hp: 85,
    speed: 2.35,
    damage: 15,
    size: 1.8,
    xp: 8,
    color: '#b9684c',
  },
  {
    id: 'hound',
    name: 'Hound',
    hp: 60,
    speed: 4.2,
    damage: 12,
    size: 1.45,
    xp: 6,
    color: '#9a8584',
  },
  {
    id: 'giant',
    name: 'Giant',
    hp: 170,
    speed: 1.7,
    damage: 22,
    size: 2.9,
    xp: 15,
    color: '#a9a588',
  },
];
export const DURATION = 180,
  WAVE_SECONDS = 18,
  SURGE_SECONDS = 5,
  ARENA = 29,
  MAX_ENEMIES = 180;
export const STARTER_ARMOR = { knight: 'Unarmored', wizard: 'Unarmored', elf: 'Unarmored' };
export const ARMOR = {
  knight: { name: 'Dark Phoenix Set', model: 'knight-armor' },
  wizard: { name: 'Grand Soul Set', model: 'wizard-armor' },
  elf: { name: 'Guardian Set', model: 'elf-armor' },
};
export const UPGRADES: UpgradeDefinition[] = [
  {
    id: 'critical',
    icon: '✧',
    name: 'Critical precision',
    text: 'Gain 8% critical chance. Critical hits deal 50% more damage.',
    apply: (s) => (s.criticalChance = Math.min(0.44, s.criticalChance + 0.08)),
  },
  {
    id: 'damage',
    icon: '✦',
    name: 'Greater power',
    text: 'All attacks deal 25% more damage.',
    apply: (s) => (s.damage *= 1.25),
  },
  {
    id: 'haste',
    icon: 'ϟ',
    name: 'Spell haste',
    text: 'Attack 15% faster.',
    apply: (s) => (s.cooldown = Math.max(0.18, s.cooldown * 0.85)),
  },
  {
    id: 'speed',
    icon: '➶',
    name: 'Wind walker',
    text: 'Move 12% faster.',
    apply: (s) => (s.speed *= 1.12),
  },
  {
    id: 'magnet',
    icon: '◇',
    name: 'Jewel seeker',
    text: 'Collect jewels from 40% farther away.',
    apply: (s) => (s.magnet *= 1.4),
  },
  {
    id: 'vitality',
    icon: '♡',
    name: 'Blessing of life',
    text: 'Gain 30 maximum health and restore 50.',
    apply: (s) => {
      s.maxHp += 30;
      s.hp = Math.min(s.maxHp, s.hp + 50);
    },
  },
  {
    id: 'multishot',
    icon: '⋔',
    name: 'Echoing strike',
    text: 'Add a projectile or widen your slash.',
    apply: (s) => {
      s.projectiles++;
      s.slashRange += 0.5;
    },
  },
];
export function rewardOptions(s: GameState): UpgradeDefinition[] {
  const rewards: UpgradeDefinition[] = [];
  if (s.level >= 2 && !s.unlockedSkills.includes(SKILLS[s.hero.id][1].id))
    rewards.push({
      id: 'unlock-skill',
      icon: '✦',
      name: 'Learn ' + SKILLS[s.hero.id][1].name,
      text: 'Unlock a new skill and equip it. Switch with 1 / 2.',
      apply: (s) => {
        s.unlockedSkills.push(SKILLS[s.hero.id][1].id);
        s.skill = SKILLS[s.hero.id][1].id;
      },
    });
  if (s.level >= 3 && s.auraLevel < 2)
    rewards.push({
      id: 'aura',
      icon: '◉',
      name: s.auraLevel ? 'Greater aura' : 'Aura of protection',
      text: 'Orbiting energy damages nearby enemies and protects you.',
      apply: (s) => {
        s.auraLevel++;
      },
    });
  return rewards;
}
export function upgradeDefinition(s: GameState, id: string) {
  return [...UPGRADES, ...rewardOptions(s)].find((u) => u.id === id);
}
const dist = (a: PointXZ, b: PointXZ) => Math.hypot(a.x - b.x, a.z - b.z);
export function positionClear(x: number, z: number, obstacles: Obstacle[] = [], radius = 0.42) {
  return !obstacles.some(
    (o) => x > o.minX - radius && x < o.maxX + radius && z > o.minZ - radius && z < o.maxZ + radius,
  );
}
export function moveEntity(
  entity: PointXZ,
  dx: number,
  dz: number,
  obstacles: Obstacle[] = [],
  radius = 0.42,
) {
  const beforeX = entity.x,
    beforeZ = entity.z;
  // Slide along a prop's edge instead of crossing its footprint.
  if (positionClear(entity.x + dx, entity.z, obstacles, radius)) entity.x += dx;
  if (positionClear(entity.x, entity.z + dz, obstacles, radius)) entity.z += dz;
  return Math.hypot(entity.x - beforeX, entity.z - beforeZ);
}
export function createRun(id: HeroId, random = Math.random): GameState {
  const hero = CLASSES.find((c) => c.id === id);
  if (!hero) throw new Error('Unknown class');
  return {
    hero,
    random,
    loot: createLootState(),
    inventory: [],
    equipment: emptyEquipment(),
    dropSlots: chooseDropSlots(id, undefined, random),
    gearHp: 0,
    gearDefense: 0,
    criticalChance: 0.12,
    criticalMultiplier: 1.5,
    monsterVoiceTimer: 1,
    skill: SKILLS[id][0].id,
    unlockedSkills: [SKILLS[id][0].id],
    auraLevel: 0,
    auraTimer: 0,
    armorEquipped: false,
    enhancement: 0,
    hitFlash: 0,
    lastSurgeWave: 0,
    moving: false,
    walking: false,
    travel: 0,
    obstacles: [],
    attackAnimation: 0,
    attackDuration: 0.6,
    phase: 'playing',
    time: 0,
    wave: 1,
    hp: hero.hp,
    maxHp: hero.hp,
    speed: hero.speed,
    damage: hero.damage,
    cooldown: hero.cooldown,
    slashRange: hero.range,
    projectiles: id === 'elf' ? 2 : 1,
    magnet: 3.1,
    x: 0,
    z: 0,
    facing: 0,
    enemies: [],
    shots: [],
    gems: [],
    events: [],
    kills: 0,
    level: 1,
    xp: 0,
    xpNeeded: 12,
    spawnTimer: 0.8,
    attackTimer: 0,
    dashCooldown: 0,
    dashTime: 0,
    invulnerable: 0,
    bossSpawned: false,
    bossDefeated: false,
    nextId: 1,
    choices: [],
    pendingLevels: 0,
  };
}
function event<K extends keyof EventMap>(
  s: GameState,
  type: K,
  data: EventMap[K] = {} as EventMap[K],
) {
  s.events.push({ type, ...data } as GameEvent);
}
export function spawnEnemy(s: GameState, type: number, elite = false): Enemy | null {
  const a = s.random() * Math.PI * 2,
    r = 12 + s.random() * 6;
  const def = ENEMIES[type];
  const scale = 1 + (s.wave - 1) * 0.095;
  const e: Enemy = {
    ...def,
    uid: s.nextId++,
    type,
    x: Math.max(-ARENA + 1, Math.min(ARENA - 1, s.x + Math.cos(a) * r)),
    z: Math.max(-ARENA + 1, Math.min(ARENA - 1, s.z + Math.sin(a) * r)),
    hp: def.hp * scale * (elite ? 12 : 1),
    maxHp: def.hp * scale * (elite ? 12 : 1),
    elite,
    hit: 0,
  };
  if (elite) {
    e.size = 4.5;
    e.speed = 2;
    e.damage = 28;
    e.name = 'Lorencia Guardian';
  }
  if (!positionClear(e.x, e.z, s.obstacles, e.size * 0.24)) {
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI * 2) / 24;
      e.x = Math.max(-ARENA + 1, Math.min(ARENA - 1, s.x + Math.sin(a) * r));
      e.z = Math.max(-ARENA + 1, Math.min(ARENA - 1, s.z + Math.cos(a) * r));
      if (positionClear(e.x, e.z, s.obstacles, e.size * 0.24)) break;
    }
    if (!positionClear(e.x, e.z, s.obstacles, e.size * 0.24)) return null;
  }
  s.enemies.push(e);
  return e;
}
function hurt(s: GameState, e: Enemy, damage: number) {
  if (e.hp <= 0) return;
  const critical = s.random() < s.criticalChance;
  if (critical) damage *= s.criticalMultiplier;
  e.hp -= damage;
  const away = dist(e, s) || 1;
  moveEntity(e, ((e.x - s.x) / away) * 0.1, ((e.z - s.z) / away) * 0.1, s.obstacles, e.size * 0.24);
  e.hit = 0.16;
  event(s, 'hit', { uid: e.uid, id: e.id, x: e.x, z: e.z, size: e.size, damage, critical });
  if (e.hp <= 0) {
    s.kills++;
    const drop = dropLoot(s.loot, e, s.kills, () => s.nextId++, s);
    if (drop) event(s, 'loot-drop', { id: drop.id, x: e.x, z: e.z });
    s.gems.push({ uid: s.nextId++, x: e.x, z: e.z, xp: e.elite ? 60 : e.xp });
    event(s, 'death', {
      uid: e.uid,
      id: e.id,
      x: e.x,
      z: e.z,
      size: e.size,
      color: e.color,
      facing: Math.atan2(s.x - e.x, s.z - e.z),
    });
    if (e.elite) s.bossDefeated = true;
  }
}
function levelUp(s: GameState) {
  s.phase = 'upgrade';
  const special = rewardOptions(s);
  const featured = special.find((u) => u.id === 'unlock-skill' && s.level % 2 === 0) || special[0];
  const basics = [...UPGRADES].sort(() => s.random() - 0.5).slice(0, featured ? 2 : 3);
  s.choices = [...(featured ? [featured] : []), ...basics].map((u) => u.id);
  event(s, 'level');
}
export function chooseUpgrade(s: GameState, id: string) {
  if (s.phase !== 'upgrade' || !s.choices.includes(id)) return false;
  const upgrade = upgradeDefinition(s, id);
  if (!upgrade) return false;
  s.events = [];
  upgrade.apply(s);
  event(s, 'reward', { id });
  s.choices = [];
  s.pendingLevels--;
  if (s.pendingLevels > 0) levelUp(s);
  else s.phase = 'playing';
  return true;
}
export function tick(s: GameState, dt: number, input: InputState = {}) {
  s.events = [];
  if (s.phase !== 'playing') return;
  s.time += dt;
  s.wave = Math.min(10, 1 + Math.floor(s.time / WAVE_SECONDS));
  s.hitFlash = Math.max(0, s.hitFlash - dt);
  s.attackAnimation = Math.max(0, s.attackAnimation - dt);
  s.invulnerable = Math.max(0, s.invulnerable - dt);
  s.dashCooldown = Math.max(0, s.dashCooldown - dt);
  s.dashTime = Math.max(0, s.dashTime - dt);
  let mx = input.x || 0,
    mz = input.z || 0;
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  if (input.dash && s.dashCooldown === 0 && len > 0) {
    s.dashTime = 0.2;
    s.dashCooldown = 3;
    s.invulnerable = 0.35;
    event(s, 'dash');
  }
  s.moving = len > 0.01;
  s.walking = !!input.walk || len < 0.5;
  const speed = s.speed * (s.dashTime > 0 ? 3 : s.walking ? 0.65 : 1);
  const dx = Math.max(-ARENA, Math.min(ARENA, s.x + mx * speed * dt)) - s.x,
    dz = Math.max(-ARENA, Math.min(ARENA, s.z + mz * speed * dt)) - s.z;
  const moved = moveEntity(s, dx, dz, s.obstacles);
  s.travel += moved;
  s.moving = moved > 0.0001;
  if (len > 0.01) s.facing = Math.atan2(mx, mz);
  s.spawnTimer -= dt;
  const surge = s.time % WAVE_SECONDS >= WAVE_SECONDS - SURGE_SECONDS;
  if (surge && s.lastSurgeWave !== s.wave) {
    s.lastSurgeWave = s.wave;
    event(s, 'surge', { wave: s.wave });
  }
  if (s.spawnTimer <= 0 && s.enemies.length < MAX_ENEMIES - 1) {
    const unlocked = Math.min(5, 1 + Math.floor((s.wave - 1) / 2));
    const pack = s.time < 1.5 ? 6 : surge ? 5 + s.wave : 2 + Math.floor((s.wave - 1) / 3);
    for (let i = 0; i < pack && s.enemies.length < MAX_ENEMIES - 1; i++)
      spawnEnemy(s, Math.floor(s.random() * unlocked));
    s.spawnTimer = Math.max(0.24, 0.9 - s.wave * 0.035) * (surge ? 0.52 : 1);
  }
  if (s.time >= DURATION - WAVE_SECONDS && !s.bossSpawned) {
    const guardian = spawnEnemy(s, 4, true);
    if (guardian) {
      s.bossSpawned = true;
      event(s, 'boss');
    }
  }
  s.attackTimer -= dt;
  const living = s.enemies.filter((e) => e.hp > 0);
  if (s.attackTimer <= 0 && living.length) {
    const nearest = [...living].sort((a, b) => dist(a, s) - dist(b, s));
    const skill = SKILLS[s.hero.id].find((k) => k.id === s.skill)!;
    const range = skill.id === 'slash' ? s.slashRange : skill.range;
    if (dist(nearest[0], s) < range) {
      s.attackTimer = s.cooldown * skill.cooldown;
      s.attackDuration = Math.min(0.6, s.cooldown * skill.cooldown * 0.9);
      s.attackAnimation = s.attackDuration;
      s.animationSkill = skill.id;
      s.attackFacing = Math.atan2(nearest[0].x - s.x, nearest[0].z - s.z);
      if (!s.moving) s.facing = Math.atan2(nearest[0].x - s.x, nearest[0].z - s.z);
      event(s, 'attack', {
        hero: s.hero.id,
        skill: skill.id,
        x: s.x,
        z: s.z,
        facing: Math.atan2(nearest[0].x - s.x, nearest[0].z - s.z),
        range,
      });
      const damage = s.damage * skill.damage;
      if (skill.id === 'slash' || skill.id === 'hellfire') {
        for (const e of living) if (dist(e, s) < range + e.size * 0.2) hurt(s, e, damage);
      } else if (skill.id === 'stab') {
        const target = nearest[0],
          d = dist(target, s),
          dx = (target.x - s.x) / (d || 1),
          dz = (target.z - s.z) / (d || 1);
        for (const e of living) {
          const x = e.x - s.x,
            z = e.z - s.z,
            along = x * dx + z * dz,
            across = Math.abs(x * dz - z * dx);
          if (along > -0.5 && along < range && across < 1.15 + e.size * 0.2) hurt(s, e, damage);
        }
      } else {
        const count =
          skill.id === 'evil'
            ? s.projectiles + 2
            : skill.id === 'icearrow'
              ? Math.max(1, s.projectiles - 1)
              : s.projectiles;
        for (let i = 0; i < count; i++) {
          const target = nearest[i % nearest.length];
          s.shots.push({
            uid: s.nextId++,
            x: s.x,
            z: s.z,
            target: target.uid,
            life: 2.5,
            damage,
            speed: s.hero.id === 'elf' ? 24 : 16,
            kind: s.hero.id,
            skill: skill.id,
          });
        }
      }
    }
  }
  s.auraTimer -= dt;
  if (s.auraLevel && s.auraTimer <= 0) {
    s.auraTimer = 0.9;
    for (const e of s.enemies) if (dist(e, s) < 4.2) hurt(s, e, 12 * s.auraLevel + s.damage * 0.18);
    event(s, 'aura-pulse', { x: s.x, z: s.z });
  }
  for (const p of s.shots) {
    p.life -= dt;
    const target = s.enemies.find((e) => e.uid === p.target && e.hp > 0);
    if (!target) {
      p.life = 0;
      continue;
    }
    const d = dist(p, target);
    if (d < p.speed * dt + 0.45) {
      hurt(s, target, p.damage);
      event(s, 'impact', { skill: p.skill, x: target.x, z: target.z });
      if (p.skill === 'icearrow') {
        target.slow = 2.5;
        event(s, 'ice', { x: target.x, z: target.z });
      }
      if (p.kind === 'wizard') {
        for (const e of s.enemies)
          if (e.uid !== target.uid && dist(e, target) < 2.5) hurt(s, e, p.damage * 0.65);
        event(s, 'burst', { x: target.x, z: target.z });
      }
      p.life = 0;
    } else {
      p.x += ((target.x - p.x) / d) * p.speed * dt;
      p.z += ((target.z - p.z) / d) * p.speed * dt;
    }
  }
  s.shots = s.shots.filter((p) => p.life > 0);
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    e.slow = Math.max(0, (e.slow || 0) - dt);
    e.hit = Math.max(0, e.hit - dt);
    const d = dist(e, s);
    if (d > 0.65) {
      const step = e.speed * (e.slow > 0 ? 0.45 : 1) * (e.hit > 0 ? 0.3 : 1) * dt,
        dx = ((s.x - e.x) / d) * step,
        dz = ((s.z - e.z) / d) * step;
      const moved = moveEntity(e, dx, dz, s.obstacles, e.size * 0.24);
      if (moved < step * 0.2) {
        for (const angle of [0.65, -0.65, 1.2, -1.2, Math.PI / 2, -Math.PI / 2]) {
          const nx = dx * Math.cos(angle) - dz * Math.sin(angle),
            nz = dx * Math.sin(angle) + dz * Math.cos(angle);
          if (moveEntity(e, nx, nz, s.obstacles, e.size * 0.24) > step * 0.2) break;
        }
      }
    }
    if (d < 0.6 + e.size * 0.27 && s.invulnerable === 0) {
      const reduction = s.gearDefense + (s.auraLevel ? 0.06 : 0);
      s.hp = Math.max(0, s.hp - e.damage * (1 - reduction));
      s.invulnerable = 0.7;
      s.hitFlash = 0.32;
      event(s, 'monster-attack', { id: e.id, x: e.x, z: e.z });
      event(s, 'hurt', { damage: e.damage * (1 - reduction), x: s.x, z: s.z });
    }
  }
  s.enemies = s.enemies.filter((e) => e.hp > 0);
  for (const g of s.gems) {
    const d = dist(g, s);
    if (d < s.magnet) {
      const move = Math.min(d, dt * 14);
      g.x += ((s.x - g.x) / (d || 1)) * move;
      g.z += ((s.z - g.z) / (d || 1)) * move;
    }
    if (d < 0.7) {
      s.xp += g.xp;
      g.collected = true;
    }
  }
  s.gems = s.gems.filter((g) => !g.collected);
  // Combine old distant gems to bound retained geometry in a long run.
  if (s.gems.length > 300) {
    const a = s.gems.shift()!;
    s.gems[0].xp += a.xp;
  }
  while (s.xp >= s.xpNeeded) {
    s.xp -= s.xpNeeded;
    s.level++;
    s.pendingLevels++;
    s.xpNeeded = Math.round(s.xpNeeded * 1.24 + 4);
  }
  for (const item of collectLoot(s.loot, s.x, s.z)) receiveItem(s, item);
  s.monsterVoiceTimer -= dt;
  if (s.monsterVoiceTimer <= 0) {
    s.monsterVoiceTimer = 2.3;
    const nearby = s.enemies.filter((e) => e.hp > 0 && dist(e, s) < 16);
    if (nearby.length) {
      const e = nearby[Math.floor(s.random() * nearby.length)];
      event(s, 'monster-idle', { id: e.id, x: e.x, z: e.z });
    }
  }
  if (s.hp <= 0) {
    s.phase = 'dead';
    event(s, 'end');
  } else if (s.time >= DURATION && s.bossDefeated) {
    for (const item of collectLoot(s.loot, s.x, s.z, Infinity)) receiveItem(s, item);
    s.phase = 'won';
    event(s, 'end');
  } else if (s.pendingLevels > 0) levelUp(s);
}

function receiveItem(s: GameState, item: InventoryItem) {
  s.inventory = mergeInventory(s.inventory, [item]);
  const equipped = autoEquip(s, item);
  event(s, 'loot-pickup', { ...item, equipped });
}
