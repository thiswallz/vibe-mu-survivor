// Original client voices, with small pools and distance attenuation for horde battles.
export const MONSTER_AUDIO = Object.freeze(
  Object.fromEntries(
    ['spider', 'budge', 'bull', 'hound', 'giant'].map((id) => [
      id,
      { idle: 'idle-' + id, attack: 'attack-' + id, death: 'death-' + id },
    ]),
  ),
);
export class GameAudio {
  muted: boolean;
  times: Map<string, number>;
  music: HTMLAudioElement;
  pools: Record<string, HTMLAudioElement[]>;
  constructor() {
    this.muted = false;
    this.times = new Map();
    this.music = new Audio('assets/audio/lorencia-pub.mp3');
    this.music.loop = true;
    this.music.volume = 0.24;
    const ids = [
      'knight',
      'wizard',
      'elf',
      'level-up',
      'evil',
      'hellfire',
      'ice',
      'stab',
      'hurt-knight',
      'hurt-wizard',
      'hurt-elf',
      'hit',
      'armor',
      ...Object.values(MONSTER_AUDIO).flatMap(Object.values),
    ];
    this.pools = Object.fromEntries(
      ids.map((id) => [id, Array.from({ length: 3 }, () => new Audio(`assets/audio/${id}.wav`))]),
    );
  }
  setMuted(value: boolean) {
    this.muted = value;
    this.music.muted = value;
    for (const pool of Object.values(this.pools)) for (const voice of pool) voice.muted = value;
  }
  setWorld(worldId: string) {
    const source =
      worldId === 'lorencia' ? 'assets/audio/lorencia-pub.mp3' : `assets/audio/${worldId}.mp3`;
    if (this.music.getAttribute('src') === source) return;
    this.music.pause();
    this.music.src = source;
    this.startMusic();
  }
  startMusic() {
    if (!this.muted) this.music.play().catch(() => {});
  }
  effect(id: string, distance = 0) {
    if (this.muted) return;
    const pool = this.pools[id];
    if (!pool) return;
    const monster = /^(idle|attack|death)-/.test(id),
      interval = id.startsWith('idle-')
        ? 1800
        : id.startsWith('attack-')
          ? 500
          : id.startsWith('death-') || id === 'hit'
            ? 120
            : 0;
    const now = performance.now();
    if (now - (this.times.get(id) ?? -10000) < interval) return;
    if (
      monster &&
      (distance > 22 ||
        Object.entries(this.pools)
          .filter(([key]) => /^(idle|attack|death)-/.test(key))
          .flatMap(([, voices]) => voices)
          .filter((a) => !a.paused).length >= 4)
    )
      return;
    const voice = pool.find((a) => a.paused);
    if (!voice) return;
    this.times.set(id, now);
    const volume = id === 'level-up' ? 0.4 : id.startsWith('death-') ? 0.32 : monster ? 0.3 : 0.18;
    voice.volume = volume * Math.max(0.12, 1 - distance / 24);
    voice.currentTime = 0;
    voice.play().catch(() => {});
  }
}
