import * as THREE from 'three';
import type { PointXZ } from '@mu-survivor/models';
const desired = new THREE.Vector3();
// Companions live in the world. No player mesh, socket, skill or animation pose enters this update.
export function followCompanion(
  pet: THREE.Group,
  target: PointXZ & { facing: number },
  dt: number,
  time: number,
  height: number,
  ground: (x: number, z: number) => number,
) {
  const side = height * 0.6,
    behind = height * 0.25;
  const x = target.x + Math.cos(target.facing) * side - Math.sin(target.facing) * behind;
  const z = target.z - Math.sin(target.facing) * side - Math.cos(target.facing) * behind;
  const y = ground(x, z) + height * (0.72 + Math.sin(time * 3.2) * 0.05);
  const oldX = pet.position.x,
    oldZ = pet.position.z;
  desired.set(x, y, z);
  const factor = pet.position.distanceToSquared(desired) > 144 ? 1 : 1 - Math.exp(-dt * 4.5);
  pet.position.lerp(desired, factor);
  const dx = pet.position.x - oldX,
    dz = pet.position.z - oldZ;
  const angle = Math.hypot(dx, dz) > 0.0001 ? Math.atan2(dx, dz) : target.facing;
  const turn = Math.atan2(Math.sin(angle - pet.rotation.y), Math.cos(angle - pet.rotation.y));
  pet.rotation.y += turn * (1 - Math.exp(-dt * 5));
}
