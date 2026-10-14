import type { Equipment } from '@mu-survivor/models';
import * as THREE from 'three';
export function prepareActor(root: THREE.Group) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    if (mesh.isMesh) {
      mesh.material = mesh.material.clone();
      mesh.userData.baseEmissive = mesh.material.emissive?.clone();
      mesh.userData.baseIntensity = mesh.material.emissiveIntensity || 0;
    }
  });
}
export function disposeActor(root: THREE.Group) {
  root.traverse((m) => {
    if (m instanceof THREE.Mesh || m instanceof THREE.Sprite) {
      const materials = Array.isArray(m.material) ? m.material : [m.material];
      for (const material of materials) material.dispose();
    }
  });
}
export function flashActor(root: THREE.Group, power: number, color = '#ffdfac') {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    if (mesh.isMesh && mesh.material.emissive && !mesh.userData.chrome) {
      mesh.material.emissive.copy(mesh.userData.baseEmissive || new THREE.Color(0));
      mesh.material.emissive.lerp(new THREE.Color(color), power);
      mesh.material.emissiveIntensity = (mesh.userData.baseIntensity || 0) + power * 1.3;
    }
  });
}
export function enhancementAppearance(level: number) {
  const tint =
    level >= 15
      ? '#e5dcff'
      : level >= 13
        ? '#b9e6ff'
        : level >= 11
          ? '#eac6ff'
          : level >= 9
            ? '#ffe3a0'
            : level >= 7
              ? '#ffffff'
              : level >= 5
                ? '#748cff'
                : level >= 3
                  ? '#d65c50'
                  : '#ffffff';
  const glow = level >= 7 ? 0.18 + (level - 7) * 0.045 : 0;
  const emissive = level >= 7 ? 0.24 + (level - 7) * 0.045 : level >= 3 ? 0.07 : level * 0.008;
  return { tint, glow, emissive };
}
export function enhanceArmor(
  root: THREE.Group,
  level: number,
  chrome: THREE.Texture,
  shiny?: THREE.Texture,
  equipment?: Equipment,
) {
  root.userData.enhancement = level;
  root.userData.armorSparkles = [];
  const body = root.userData.body;
  const surfaces: THREE.Mesh[] = [];
  body.traverse((child: THREE.Mesh) => {
    if (child.isMesh && child.userData.armor) surfaces.push(child);
  });
  for (const original of surfaces) {
    if (!original.isMesh || !original.userData.armor) continue;
    const pieceLevel = equipment?.[original.userData.slot as keyof Equipment]?.enhancement;
    const activeLevel = equipment ? pieceLevel || 0 : level;
    const mat = original.material;
    if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
    mat.roughness = activeLevel ? 0.23 : 0.83;
    mat.metalness = activeLevel ? 0.48 : 0.12;
    mat.emissiveMap = activeLevel ? mat.map : null;
    const appearance = enhancementAppearance(activeLevel);
    mat.emissive.set(activeLevel ? appearance.tint : '#000000');
    mat.emissiveIntensity = appearance.emissive;
    original.userData.baseEmissive = mat.emissive.clone();
    original.userData.baseIntensity = mat.emissiveIntensity;
    mat.needsUpdate = true;
    if (activeLevel < 7) continue;
    const material = new THREE.MeshMatcapMaterial({
      matcap: chrome,
      color: appearance.tint,
      transparent: true,
      opacity: appearance.glow,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const clock = { value: 0 };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.muShineTime = clock;
      shader.fragmentShader = 'uniform float muShineTime;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec4 matcapColor = texture2D( matcap, uv );',
        'vec2 shineUV = uv + vec2(sin(muShineTime * .8) * .13, cos(muShineTime * .6) * .13); vec4 matcapColor = texture2D( matcap, shineUV );',
      );
    };
    const overlay = new THREE.Mesh(original.geometry, material);
    overlay.userData.chrome = true;
    overlay.userData.level = activeLevel;
    overlay.userData.upperBody = original.userData.upperBody;
    overlay.userData.clock = clock;
    original.add(overlay);
    original.userData.overlay = overlay;
    if (shiny && activeLevel >= 13)
      for (let i = 0; i < (activeLevel === 15 ? 2 : 1); i++) {
        const glow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: shiny,
            color: '#fff2c0',
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        original.add(glow);
        root.userData.armorSparkles.push({
          mesh: original,
          glow,
          index: Math.floor(original.geometry.attributes.position.count * (0.27 + i * 0.43)),
          level: activeLevel,
          phase: root.userData.armorSparkles.length * 1.73,
        });
      }
  }
}
export function updateArmor(root: THREE.Group, time: number) {
  if (root.userData.armorSetAura) updateArmorSetAura(root.userData.armorSetAura, time);
  const level = root.userData.enhancement;
  if (!level) return;
  root.userData.body.traverse((mesh: THREE.Mesh) => {
    if (mesh.userData.chrome) {
      mesh.userData.clock.value = time;
      (mesh.material as THREE.MeshMatcapMaterial).opacity =
        enhancementAppearance(mesh.userData.level).glow +
        Math.sin(time * 2 + mesh.userData.level) * 0.045;
      const material = mesh.material as THREE.MeshMatcapMaterial;
      if (mesh.userData.level >= 11)
        material.color
          .set(enhancementAppearance(mesh.userData.level).tint)
          .lerp(new THREE.Color('#fff1cb'), Math.max(0, Math.sin(time * 1.6)) * 0.45);
    }
  });
  for (const spark of root.userData.armorSparkles) {
    const { mesh, glow, index, phase } = spark,
      base = mesh.geometry.attributes.position,
      frames = mesh.geometry.morphAttributes.position,
      weights = mesh.morphTargetInfluences || [];
    glow.position.fromBufferAttribute(base, index);
    let total = 0;
    const point = new THREE.Vector3();
    for (let j = 0; j < weights.length; j++)
      if (weights[j] > 0.001) {
        point.addScaledVector(
          new THREE.Vector3().fromBufferAttribute(frames[j], index),
          weights[j],
        );
        total += weights[j];
      }
    glow.position.multiplyScalar(1 - total).add(point);
    const pulse = Math.max(0, Math.sin(time * 3 + phase)) ** 8;
    glow.material.opacity = pulse * 0.9;
    glow.scale.setScalar((spark.level === 15 ? 0.22 : 0.14) * (1 + pulse * 0.7));
  }
}
export function createArmorSetAura(shiny: THREE.Texture, height: number) {
  const group = new THREE.Group();
  group.name = 'armor-set-aura';
  for (let trail = 0; trail < 3; trail++) {
    for (let i = 0; i < 24; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: shiny,
          color: trail === 1 ? '#f4f0c5' : '#d2e9ff',
          transparent: true,
          opacity: 0.48 * (1 - i / 24),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      sprite.scale.setScalar(height * (i === 0 ? 0.1 : 0.045));
      sprite.userData.trail = trail;
      sprite.userData.index = i;
      group.add(sprite);
    }
  }
  group.userData.height = height;
  return group;
}
function updateArmorSetAura(group: THREE.Group, time: number) {
  const height = group.userData.height;
  for (const sprite of group.children) {
    const phase =
      time * 2.5 + (sprite.userData.trail * Math.PI * 2) / 3 - sprite.userData.index * 0.06;
    sprite.position.set(
      Math.cos(phase) * height * 0.39,
      height * (0.42 + Math.sin(phase * 1.35) * 0.3),
      Math.sin(phase) * height * 0.39,
    );
  }
}
export function createAura(texture: THREE.Texture, shiny: THREE.Texture) {
  const group = new THREE.Group();
  const circle = new THREE.Mesh(
    new THREE.PlaneGeometry(8.4, 8.4),
    new THREE.MeshBasicMaterial({
      map: texture,
      color: '#91bcff',
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.1;
  group.add(circle);
  group.userData.circle = circle;
  group.userData.orbs = [];
  for (let i = 0; i < 3; i++) {
    const orb = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: shiny,
        color: '#b7d4ff',
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    orb.scale.setScalar(0.5);
    group.add(orb);
    group.userData.orbs.push(orb);
  }
  return group;
}
export function updateAura(group: THREE.Group, time: number, level: number) {
  group.visible = level > 0;
  if (!level) return;
  group.userData.circle.rotation.z = time * 0.4;
  group.userData.circle.material.opacity = 0.28 + Math.sin(time * 4) * 0.1;
  for (let i = 0; i < 3; i++) {
    const a = time * 1.8 + (i * Math.PI * 2) / 3;
    group.userData.orbs[i].position.set(
      Math.sin(a) * 3.5,
      0.8 + Math.sin(a * 2) * 0.3,
      Math.cos(a) * 3.5,
    );
  }
  group.scale.setScalar(level === 2 ? 1.05 : 1);
}
