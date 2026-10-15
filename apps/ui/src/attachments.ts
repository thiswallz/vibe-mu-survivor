import * as THREE from 'three';
import type { NativeModel } from '@mu-survivor/models';
const first = new THREE.Matrix4(),
  second = new THREE.Matrix4();
const position = new THREE.Vector3(),
  nextPosition = new THREE.Vector3(),
  scale = new THREE.Vector3();
const rotation = new THREE.Quaternion(),
  nextRotation = new THREE.Quaternion();
export function poseAttachments(
  root: THREE.Group,
  data: NativeModel,
  a: number,
  b: number,
  blend: number,
  weight: number,
) {
  const bindings: [THREE.Group | undefined, string][] = [
    [root.userData.weapon, root.userData.socket],
    [root.userData.shield, root.userData.socket === 'left' ? 'forearmRight' : 'forearmLeft'],
    [root.userData.wingAttachment, 'torso'],
  ];
  for (const [attachment, socketName] of bindings) {
    const socket = data.sockets?.[socketName];
    if (!attachment || !socket?.[a] || !socket[b]) continue;
    first.fromArray(socket[a]).decompose(position, rotation, scale);
    second.fromArray(socket[b]).decompose(nextPosition, nextRotation, scale);
    position.lerp(nextPosition, blend);
    rotation.slerp(nextRotation, blend);
    attachment.position.lerp(position, weight);
    attachment.quaternion.slerp(rotation, weight);
  }
}
export function animateNativeLoop(root: THREE.Group, time: number, cyclesPerSecond = 1.5) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.morphTargetInfluences) return;
    const weights = child.morphTargetInfluences;
    const phase = ((time * cyclesPerSecond) % 1) * weights.length;
    const current = Math.floor(phase),
      next = (current + 1) % weights.length;
    const blend = phase - current;
    for (let i = 0; i < weights.length; i++)
      weights[i] = (i === current ? 1 - blend : 0) + (i === next ? blend : 0);
  });
}
export function independentAnimation(root: THREE.Group) {
  root.traverse((child) => {
    child.userData.independentAnimation = true;
  });
}
