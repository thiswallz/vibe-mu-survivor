export type HeroId = 'knight' | 'wizard' | 'elf';
export type MonsterId = 'spider' | 'budge' | 'bull' | 'hound' | 'giant';
export type SkillId = 'slash' | 'stab' | 'evil' | 'hellfire' | 'multishot' | 'icearrow';
export type EquipmentSlot =
  | 'helm'
  | 'armor'
  | 'pants'
  | 'gloves'
  | 'boots'
  | 'weapon'
  | 'shield'
  | 'ringLeft'
  | 'ringRight'
  | 'pendant'
  | 'wings'
  | 'pet';
export interface PointXZ {
  x: number;
  z: number;
}
export interface InventoryItem {
  id: string;
  enhancement?: number;
  quantity: number;
}
export interface EquippedItem {
  id: string;
  enhancement: number;
}
export type Equipment = Record<EquipmentSlot, EquippedItem | null>;
export interface ItemDefinition {
  id: string;
  name: string;
  model: string;
  color: string;
  kind: 'equipment' | 'box' | 'jewel';
  hero?: HeroId;
  slot?: EquipmentSlot;
  slots?: EquipmentSlot[];
  bonuses?: { defense?: number; vitality?: number; attackPower?: number; aura?: number };
  description?: string;
}
export interface LootDrop extends PointXZ {
  uid: number;
  id: string;
  enhancement: number;
}
export interface LootState {
  drops: LootDrop[];
  collected: InventoryItem[];
  dropped: number;
}
export interface InventoryProfile {
  version: 3;
  items: InventoryItem[];
  loadouts: Record<HeroId, Equipment>;
}
export interface InventoryStorage {
  getItem(key: string): string | null | undefined;
  setItem(key: string, value: string): void;
}
export interface HeroDefinition {
  id: HeroId;
  name: string;
  title: string;
  skill: string;
  role: string;
  color: string;
  hp: number;
  speed: number;
  damage: number;
  cooldown: number;
  range: number;
  description: string;
}
export interface EquipmentActor {
  hero: Pick<HeroDefinition, 'id'> & Partial<HeroDefinition>;
  inventory: InventoryItem[];
  equipment: Equipment;
  hp: number;
  maxHp: number;
  damage: number;
  gearHp?: number;
  gearDefense?: number;
  gearWeaponPower?: number;
  auraLevel?: number;
  armorEquipped?: boolean;
  enhancement?: number;
}
export interface EnemyDefinition {
  id: MonsterId;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  size: number;
  xp: number;
  color: string;
}
export interface Enemy extends EnemyDefinition, PointXZ {
  uid: number;
  type: number;
  maxHp: number;
  elite: boolean;
  hit: number;
  slow?: number;
}
export interface SkillDefinition {
  id: SkillId;
  name: string;
  description: string;
  icon: number;
  sound: string;
  range: number;
  cooldown: number;
  damage: number;
}
export interface Shot extends PointXZ {
  uid: number;
  target: number;
  life: number;
  damage: number;
  speed: number;
  kind: HeroId;
  skill: SkillId;
}
export interface Gem extends PointXZ {
  uid: number;
  xp: number;
  collected?: boolean;
}
export interface Obstacle {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
export type Phase = 'playing' | 'paused' | 'dead' | 'won';
export interface EventMap {
  attack: PointXZ & { hero: HeroId; skill: SkillId; facing: number; range: number };
  hit: PointXZ & { uid: number; id: MonsterId; size: number; damage: number; critical: boolean };
  death: PointXZ & { uid: number; id: MonsterId; size: number; color: string; facing: number };
  hurt: PointXZ & { damage: number };
  'monster-idle': PointXZ & { id: MonsterId };
  'monster-attack': PointXZ & { id: MonsterId };
  'loot-drop': PointXZ & { id: string };
  'loot-pickup': InventoryItem & { equipped: boolean };
  impact: PointXZ & { skill: SkillId };
  ice: PointXZ;
  burst: PointXZ;
  'aura-pulse': PointXZ;
  surge: { wave: number };
  level: object;
  dash: object;
  boss: object;
  end: object;
}
export type GameEvent = { [K in keyof EventMap]: { type: K } & EventMap[K] }[keyof EventMap];
export interface GameState extends EquipmentActor, PointXZ {
  stage: StageDefinition;
  hero: HeroDefinition;
  random: () => number;
  loot: LootState;
  dropSlots: EquipmentSlot[];
  gearHp: number;
  gearDefense: number;
  criticalChance: number;
  criticalMultiplier: number;
  monsterVoiceTimer: number;
  skill: SkillId;
  unlockedSkills: SkillId[];
  auraLevel: number;
  auraTimer: number;
  armorEquipped: boolean;
  enhancement: number;
  hitFlash: number;
  lastSurgeWave: number;
  moving: boolean;
  walking: boolean;
  travel: number;
  obstacles: Obstacle[];
  attackAnimation: number;
  attackDuration: number;
  animationSkill?: SkillId;
  attackFacing?: number;
  phase: Phase;
  time: number;
  wave: number;
  speed: number;
  cooldown: number;
  slashRange: number;
  projectiles: number;
  magnet: number;
  facing: number;
  enemies: Enemy[];
  shots: Shot[];
  gems: Gem[];
  events: GameEvent[];
  kills: number;
  level: number;
  xp: number;
  xpNeeded: number;
  spawnTimer: number;
  attackTimer: number;
  dashCooldown: number;
  dashTime: number;
  invulnerable: number;
  bossSpawned: boolean;
  bossDefeated: boolean;
  nextId: number;
  lootBanked?: boolean;
  lootSaveResult?: InventorySaveResult;
}
export interface InventorySaveResult {
  saved: boolean;
  items: InventoryItem[];
}
export interface InputState {
  x?: number;
  z?: number;
  walk?: boolean;
  dash?: boolean;
}
export interface UpgradeDefinition {
  id: string;
  icon: string;
  name: string;
  text: string;
  apply(state: GameState): void;
}
export interface HealthResponse {
  ok: true;
  game: string;
  mode: 'production' | 'development';
}
export interface DemoResponse {
  stage: string;
  durationSeconds: number;
  characters: number;
  enemyTypes: number;
  skillsPerCharacter: number;
  accounts: boolean;
}
export interface NativePart {
  positions: number[];
  uvs: number[];
  texture: string | null;
  frames?: number[][];
  upperBody?: boolean;
  sourceTexture?: string;
  resolvedTexture?: string;
  sourceModel?: string;
  slot?: EquipmentSlot | null;
}
export interface NativeClip {
  start: number;
  count: number;
  fps: number;
  sourceAction: number;
}
export interface NativeModel {
  parts: NativePart[];
  min: number[];
  max: number[];
  clips?: Record<string, NativeClip>;
  sockets?: Record<string, number[][]>;
}
export interface TerrainData {
  size: number;
  spacing: number;
  heights: number[];
  source: string;
}
export interface PropPlacement {
  model: string;
  type: number;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}
export interface PropData {
  models: string[];
  objects: PropPlacement[];
  source: string;
}

export interface CharacterSummary {
  id: number;
  name: string;
  class: HeroId;
}
export interface AccountResponse {
  username: string;
  characters: CharacterSummary[];
}

export interface VaultSnapshot {
  items: InventoryItem[];
  revision: number;
}
export interface CharacterProfileResponse {
  profile: InventoryProfile | null;
  revision: number;
}
export interface VaultTransferRequest {
  characterId: number;
  direction: 'deposit' | 'withdraw';
  item: InventoryItem;
  characterRevision: number;
  vaultRevision: number;
}
export interface VaultTransferResponse {
  profile: InventoryProfile;
  revision: number;
  vault: VaultSnapshot;
}

export interface StageDefinition {
  id: string;
  worldId: string;
  worldName: string;
  worldNumber: number;
  mapNumber: number;
  name: string;
  description: string;
  difficulty: string;
  terrain: string;
  objects: string;
  texture: string;
  fog: string;
  ground: string;
  sun: string;
  enemyHealth: number;
  enemyDamage: number;
  spawnRate: number;
  enemyOrder: number[];
}
