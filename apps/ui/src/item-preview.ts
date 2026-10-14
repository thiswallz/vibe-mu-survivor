import * as THREE from 'three';
import type { InventoryItem } from '@mu-survivor/models';
import { prepareActor, enhanceArmor, updateArmor, disposeActor } from './appearance.js';
export function createItemPreview(
  template: (id: string) => THREE.Group,
  chrome: THREE.Texture,
  shiny: THREE.Texture,
) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(180, 160);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(35, 180 / 160, 0.01, 100);
  camera.position.set(1.5, 0.8, 3);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight('#ffffff', '#4b5c51', 2.4));
  const light = new THREE.DirectionalLight('#ffe9c7', 2.8);
  light.position.set(2, 4, 5);
  scene.add(light);
  let root: THREE.Group | undefined,
    frame = 0,
    active = false;
  function animate(ms: number) {
    if (!active) return;
    frame = requestAnimationFrame(animate);
    if (root) {
      root.rotation.y = ms * 0.0007;
      updateArmor(root, ms / 1000);
    }
    renderer.render(scene, camera);
  }
  function hide() {
    active = false;
    cancelAnimationFrame(frame);
    if (root) {
      scene.remove(root);
      disposeActor(root);
      root = undefined;
    }
    renderer.domElement.remove();
  }
  return {
    show(item: Pick<InventoryItem, 'id' | 'enhancement'>, host: HTMLElement) {
      hide();
      const body = template(item.id).clone();
      prepareActor(body);
      body.traverse((o) => {
        if (o instanceof THREE.Mesh) o.userData.armor = true;
      });
      const box = new THREE.Box3().setFromObject(body),
        size = box.getSize(new THREE.Vector3());
      body.position.sub(box.getCenter(new THREE.Vector3()));
      root = new THREE.Group();
      root.add(body);
      root.userData.body = body;
      root.scale.setScalar(1.45 / Math.max(size.x, size.y, size.z));
      enhanceArmor(root, item.enhancement || 0, chrome, shiny);
      scene.add(root);
      host.replaceChildren(renderer.domElement);
      active = true;
      frame = requestAnimationFrame(animate);
    },
    hide,
  };
}
