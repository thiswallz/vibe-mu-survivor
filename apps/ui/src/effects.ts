import type { SkillId, Shot, Enemy } from '@mu-survivor/models';
import * as THREE from 'three';

// Lightweight, animated spell geometry. Shared shapes/textures; bounded transient objects.
const glowCanvas = document.createElement('canvas');
glowCanvas.width = glowCanvas.height = 64;
const context = glowCanvas.getContext('2d')!;
const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
gradient.addColorStop(0, 'rgba(255,255,255,1)');
gradient.addColorStop(0.16, 'rgba(255,255,255,.9)');
gradient.addColorStop(0.42, 'rgba(255,255,255,.3)');
gradient.addColorStop(1, 'rgba(255,255,255,0)');
context.fillStyle = gradient;
context.fillRect(0, 0, 64, 64);
const glowTexture = new THREE.CanvasTexture(glowCanvas);
const shapes = {
  arrow: new THREE.CylinderGeometry(0.035, 0.035, 1.55, 6),
  head: new THREE.ConeGeometry(0.13, 0.38, 6),
  crystal: new THREE.OctahedronGeometry(0.18),
  shard: new THREE.ConeGeometry(0.1, 0.65, 5),
  line: new THREE.PlaneGeometry(1, 1),
};
const damageTextures = new Map<string, THREE.Texture>();
const palette: Record<string, string> = {
  slash: '#ffc56f',
  stab: '#ffeba8',
  evil: '#b18aff',
  hellfire: '#ff7537',
  multishot: '#adffd3',
  icearrow: '#75dcff',
};
const additive = (color: THREE.ColorRepresentation, opacity = 1) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
function sprite(color: THREE.ColorRepresentation, size: number) {
  const material = new THREE.SpriteMaterial({
    map: glowTexture,
    color,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const s = new THREE.Sprite(material);
  s.scale.set(size, size, size);
  return s;
}
function arc(radius: number, width: number, color: THREE.ColorRepresentation, angle = Math.PI * 2) {
  const g = new THREE.RingGeometry(Math.max(0.01, radius - width), radius, 80, 1, 0, angle);
  const m = new THREE.Mesh(g, additive(color));
  m.rotation.x = -Math.PI / 2;
  m.userData.ownGeometry = true;
  return m;
}
function release(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (const material of materials) material.dispose();
      if (o instanceof THREE.Mesh && o.userData.ownGeometry) o.geometry.dispose();
    }
  });
}
interface EffectItem {
  root: THREE.Object3D;
  duration: number;
  age: number;
  update: (t: number, dt: number) => void;
}
export class SpellEffects {
  items: EffectItem[];
  parent: THREE.Group;
  heightAt: (x: number, z: number) => number;
  constructor(parent: THREE.Group, heightAt: (x: number, z: number) => number) {
    this.parent = parent;
    this.heightAt = heightAt;
    this.items = [];
  }
  clear() {
    for (const item of this.items) {
      this.parent.remove(item.root);
      release(item.root);
    }
    this.items = [];
  }
  add<T extends THREE.Object3D>(
    root: T,
    duration: number,
    update: (t: number, dt: number) => void,
  ) {
    if (this.items.length >= 100) {
      const old = this.items.shift()!;
      this.parent.remove(old.root);
      release(old.root);
    }
    this.parent.add(root);
    this.items.push({ root, duration, age: 0, update });
    return root;
  }
  place<T extends THREE.Object3D>(root: T, x: number, z: number, y = 0.15) {
    root.position.set(x, this.heightAt(x, z) + y, z);
    return root;
  }
  fade(root: THREE.Object3D, opacity: number) {
    root.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const material of materials)
          material.opacity = (o.userData.baseOpacity ?? 1) * opacity;
      }
    });
  }
  update(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.age += dt;
      const t = Math.min(1, item.age / item.duration);
      item.update(t, dt);
      if (t >= 1) {
        this.parent.remove(item.root);
        release(item.root);
        this.items.splice(i, 1);
      }
    }
  }
  attack(skill: SkillId, x: number, z: number, angle: number, range: number) {
    if (skill === 'slash') this.slash(x, z, range);
    else if (skill === 'stab') this.stab(x, z, angle, range);
    else if (skill === 'hellfire') this.hellfire(x, z, range);
    else this.muzzle(skill, x, z, angle);
  }
  slash(x: number, z: number, radius: number) {
    const group = this.place(new THREE.Group(), x, z, 0.7);
    for (let i = 0; i < 3; i++) {
      const blade = arc(radius * (1 - i * 0.12), 0.19, palette.slash, Math.PI * 1.1);
      blade.position.y = i * 0.16;
      blade.rotation.z = (i * Math.PI * 2) / 3;
      group.add(blade);
      const glow = arc(radius * (1 - i * 0.12) + 0.06, 0.42, palette.slash, Math.PI * 1.1);
      glow.position.y = i * 0.16 - 0.01;
      glow.rotation.z = (i * Math.PI * 2) / 3;
      glow.userData.baseOpacity = 0.16;
      group.add(glow);
      const core = arc(radius * (1 - i * 0.12) - 0.05, 0.04, '#fff8db', Math.PI * 0.95);
      core.position.y = i * 0.16 + 0.02;
      core.rotation.z = (i * Math.PI * 2) / 3;
      group.add(core);
    }
    this.add(group, 0.58, (t) => {
      group.rotation.y = t * Math.PI * 2.4;
      group.scale.setScalar(0.68 + 0.32 * Math.sin((t * Math.PI) / 2));
      this.fade(group, Math.sin(Math.PI * t) ** 0.65);
    });
    this.burst(x, z, palette.slash, 12, 0.8);
  }
  stab(x: number, z: number, angle: number, length: number) {
    const group = this.place(new THREE.Group(), x, z, 0.95);
    group.rotation.y = angle;
    for (const [width, color, opacity] of [
      [0.5, palette.stab, 0.36],
      [0.11, '#fff9e4', 1],
    ] as [number, string, number][]) {
      const line = new THREE.Mesh(shapes.line, additive(color, opacity));
      line.rotation.x = -Math.PI / 2;
      line.scale.set(width, length, 1);
      line.position.z = length / 2;
      line.userData.baseOpacity = opacity;
      group.add(line);
    }
    const tip = new THREE.Mesh(shapes.head, additive('#fff1bb'));
    tip.rotation.x = Math.PI / 2;
    tip.position.z = length;
    group.add(tip);
    this.add(group, 0.38, (t) => {
      group.scale.z = 0.4 + 0.6 * (1 - (1 - t) ** 3);
      this.fade(group, (1 - t) ** 0.6);
    });
  }
  hellfire(x: number, z: number, radius: number) {
    const group = this.place(new THREE.Group(), x, z, 0.08);
    const ring = arc(radius, 0.2, '#ff9e49');
    group.add(ring);
    const inner = arc(radius * 0.83, 0.045, '#ffdd8c');
    group.add(inner);
    const halo = sprite('#ff7428', radius * 2);
    halo.position.y = 0.2;
    halo.userData.baseOpacity = 0.34;
    group.add(halo);
    const flames: { f: THREE.Sprite; y: number }[] = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2,
        r = radius * (0.5 + Math.random() * 0.4);
      const f = sprite(i % 3 ? '#ff793d' : '#ffe5a0', 0.7 + Math.random() * 0.5);
      f.position.set(Math.sin(a) * r, 0.1, Math.cos(a) * r);
      group.add(f);
      flames.push({ f, y: 0.6 + Math.random() * 1.6 });
    }
    this.add(group, 1.05, (t) => {
      const expansion = 0.35 + 0.65 * (1 - (1 - t) ** 3);
      ring.scale.setScalar(expansion);
      inner.scale.setScalar(expansion);
      inner.rotation.z = t * 0.8;
      for (const { f, y } of flames) {
        f.position.y = t * y * 2.5;
        f.scale.set(0.75 * (1 - t) + 0.15, 1.4 * (1 - t) + 0.3, 1);
      }
      this.fade(group, Math.sin(Math.PI * t) ** 0.7);
    });
    this.burst(x, z, '#ffb45d', 22, radius * 0.7);
  }
  muzzle(skill: SkillId, x: number, z: number, _angle: number) {
    const color = palette[skill];
    const group = this.place(new THREE.Group(), x, z, 1);
    const flash = sprite(color, skill === 'evil' ? 1.25 : 0.7);
    group.add(flash);
    this.add(group, 0.23, (t) => {
      group.scale.setScalar(0.5 + t);
      this.fade(group, 1 - t);
    });
  }
  impact(skill: SkillId, x: number, z: number) {
    if (skill === 'icearrow') {
      const group = this.place(new THREE.Group(), x, z, 0.05);
      const ring = arc(2.2, 0.13, palette.icearrow);
      group.add(ring);
      const shards: { m: THREE.Mesh; a: number }[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2,
          m = new THREE.Mesh(shapes.shard, additive(i % 2 ? '#75dcff' : '#d8faff'));
        m.position.set(Math.sin(a) * 0.5, 0.4, Math.cos(a) * 0.5);
        m.rotation.z = Math.sin(a) * 0.6;
        m.rotation.x = Math.cos(a) * 0.6;
        group.add(m);
        shards.push({ m, a });
      }
      this.add(group, 0.65, (t) => {
        ring.scale.setScalar(0.2 + t);
        for (const { m, a } of shards) {
          m.position.x = Math.sin(a) * (0.5 + t);
          m.position.z = Math.cos(a) * (0.5 + t);
          m.position.y = 0.4 + Math.sin(t * Math.PI) * 0.5;
        }
        this.fade(group, 1 - t);
      });
    }
    this.burst(x, z, palette[skill] || '#d0baff', skill === 'evil' ? 10 : 7, 0.8);
  }
  burst(x: number, z: number, color: THREE.ColorRepresentation, count: number, radius: number) {
    const group = this.place(new THREE.Group(), x, z, 0.65),
      embers: { glow: THREE.Sprite; x: number; z: number; y: number }[] = [];
    for (let i = 0; i < count; i++) {
      const glow = sprite(color, 0.12 + Math.random() * 0.16),
        a = Math.random() * Math.PI * 2;
      group.add(glow);
      embers.push({
        glow,
        x: Math.sin(a) * radius,
        z: Math.cos(a) * radius,
        y: 0.3 + Math.random() * 1.4,
      });
    }
    this.add(group, 0.55, (t) => {
      for (const e of embers) e.glow.position.set(e.x * t, e.y * t - t * t, e.z * t);
      this.fade(group, 1 - t);
    });
  }
  hit(x: number, z: number, size: number, damage: number, critical = false) {
    this.burst(x, z, critical ? '#66edff' : '#fff0bf', critical ? 9 : 4, critical ? 0.5 : 0.28);
    const value = Math.round(damage),
      key = `${critical ? 'crit' : 'normal'}:${value}`;
    let texture = damageTextures.get(key);
    if (!texture) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.font = 'bold 36px Georgia';
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#35150a';
      ctx.strokeText(String(value), 64, 44);
      ctx.fillStyle = critical ? '#65eaff' : '#ffdf8b';
      ctx.fillText(String(value), 64, 44);
      texture = new THREE.CanvasTexture(canvas);
      damageTextures.set(key, texture);
    }
    const number = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        toneMapped: false,
      }),
    );
    number.scale.set(critical ? 2.3 : 1.7, critical ? 1.15 : 0.85, 1);
    this.place(number, x, z, size + 0.3);
    const base = number.position.y;
    this.add(number, 0.65, (t) => {
      number.position.y = base + t * 1.4;
      number.material.opacity = 1 - t * t;
    });
  }
  death(body: THREE.Group | undefined, x: number, z: number, size: number) {
    const group = new THREE.Group();
    if (body) {
      const metadata = body.userData;
      body.userData = {};
      const corpse = body.clone();
      body.userData = metadata;
      corpse.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.material = o.material.clone();
          o.material.transparent = true;
          o.material.depthWrite = false;
        }
      });
      group.add(corpse);
      const startY = corpse.position.y;
      this.add(group, 0.85, (t) => {
        corpse.rotation.z = t * t * 1.25;
        corpse.position.y = startY - t * 0.28;
        this.fade(corpse, 1 - t * t);
      });
    }
    const soul = this.place(sprite('#b2e7ff', size * 0.75), x, z, size * 0.5),
      base = soul.position.y;
    this.add(soul, 0.95, (t) => {
      soul.position.y = base + t * 2;
      soul.scale.setScalar(size * 0.75 * (1 - t * 0.6));
      soul.material.opacity = Math.sin(Math.PI * t);
    });
    const ground = this.place(arc(Math.max(0.45, size * 0.5), 0.08, '#c7a56e'), x, z, 0.08);
    this.add(ground, 0.65, (t) => {
      ground.scale.setScalar(0.5 + t);
      ground.material.opacity = 1 - t;
    });
    this.burst(x, z, '#d7b183', 10, size * 0.6);
  }
  createProjectile(shot: Shot) {
    const root = new THREE.Group(),
      color = palette[shot.skill];
    if (shot.skill === 'evil') {
      const core = sprite('#eee2ff', 0.48);
      root.add(core);
      const aura = sprite(color, 0.9);
      root.add(aura);
      for (const side of [-1, 1]) {
        const eye = sprite('#ffffff', 0.1);
        eye.position.set(side * 0.1, 0.06, 0.1);
        root.add(eye);
      }
    } else {
      const shaft = new THREE.Mesh(shapes.arrow, additive(color));
      shaft.rotation.x = Math.PI / 2;
      root.add(shaft);
      const head = new THREE.Mesh(
        shot.skill === 'icearrow' ? shapes.crystal : shapes.head,
        additive('#eaffff'),
      );
      if (shot.skill !== 'icearrow') head.rotation.x = Math.PI / 2;
      head.position.z = 0.86;
      root.add(head);
      root.add(sprite(color, 0.4));
    }
    const trail = [];
    for (let i = 0; i < 7; i++) {
      const glow = sprite(color, (shot.skill === 'evil' ? 0.55 : 0.25) * (1 - i / 9));
      glow.material.opacity = 0.65 * (1 - i / 8);
      root.add(glow);
      trail.push(glow);
    }
    root.userData.trail = trail;
    root.userData.history = [];
    root.userData.skill = shot.skill;
    return root;
  }
  moveProjectile(root: THREE.Group, shot: Shot, target?: Enemy) {
    root.position.set(shot.x, this.heightAt(shot.x, shot.z) + 1, shot.z);
    if (target) root.rotation.y = Math.atan2(target.x - shot.x, target.z - shot.z);
    const history = root.userData.history;
    history.unshift(root.position.clone());
    if (history.length > 15) history.pop();
    root.updateMatrixWorld(true);
    for (let i = 0; i < root.userData.trail.length; i++) {
      const past = history[Math.min(history.length - 1, i * 2 + 1)];
      if (past) {
        root.userData.trail[i].position.copy(root.worldToLocal(past.clone()));
      }
    }
  }
  disposeProjectile(root: THREE.Group) {
    release(root);
  }
}
