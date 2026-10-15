import type * as THREE from 'three';
import type { PointXZ } from '@mu-survivor/models';
interface RoamingState {
  x: number;
  z: number;
  nextGoal: number;
  restUntil: number;
  seed: number;
  following?: boolean;
}
const roaming = new WeakMap<THREE.Group, RoamingState>();
const ROAM_RADIUS = 3.2,
  FOLLOW_DISTANCE = 4.5,
  MAX_DISTANCE = 6;
export function followCompanion(
  pet: THREE.Group,
  target: PointXZ,
  dt: number,
  time: number,
  height: number,
  ground: (x: number, z: number) => number,
) {
  let state = roaming.get(pet);
  if (!state) {
    state = { x: pet.position.x, z: pet.position.z, nextGoal: 0, restUntil: 0, seed: 1729 };
    roaming.set(pet, state);
  }
  const random = () => {
    state!.seed = (state!.seed * 1664525 + 1013904223) >>> 0;
    return state!.seed / 4294967296;
  };
  let distance = Math.hypot(pet.position.x - target.x, pet.position.z - target.z);
  if (distance > MAX_DISTANCE) {
    const ratio = MAX_DISTANCE / distance;
    pet.position.x = target.x + (pet.position.x - target.x) * ratio;
    pet.position.z = target.z + (pet.position.z - target.z) * ratio;
    distance = MAX_DISTANCE;
  }
  const following = distance > FOLLOW_DISTANCE;
  if (
    (following && !state.following) ||
    time >= state.nextGoal ||
    Math.hypot(state.x - target.x, state.z - target.z) > FOLLOW_DISTANCE
  ) {
    const angle = random() * Math.PI * 2;
    const radius = following ? 1.2 + random() : 0.8 + random() * (ROAM_RADIUS - 0.8);
    state.x = target.x + Math.cos(angle) * radius;
    state.z = target.z + Math.sin(angle) * radius;
    state.nextGoal = time + (following ? 0.65 : 2.5 + random() * 3);
    state.restUntil = following ? time : time + random() * 0.8;
  }
  state.following = following;
  const dx = state.x - pet.position.x,
    dz = state.z - pet.position.z,
    length = Math.hypot(dx, dz);
  const speed = following ? 7.5 : 1.2;
  if (time >= state.restUntil && length > 0.12) {
    const step = Math.min(length, speed * dt);
    pet.position.x += (dx / length) * step;
    pet.position.z += (dz / length) * step;
    const angle = Math.atan2(dx, dz);
    const turn = Math.atan2(Math.sin(angle - pet.rotation.y), Math.cos(angle - pet.rotation.y));
    pet.rotation.y += turn * (1 - Math.exp(-dt * 3));
  }
  const y = ground(pet.position.x, pet.position.z) + height * (0.65 + Math.sin(time * 2.8) * 0.045);
  pet.position.y += (y - pet.position.y) * (1 - Math.exp(-dt * 3));
}
