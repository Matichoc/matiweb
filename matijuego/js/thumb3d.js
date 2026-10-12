// Retratos 3D del Matichico (menú, perfiles, encabezado de los juegos y tienda): se dibuja
// el modelo 3D con todo lo que lleva puesto y se copia a un canvas 2D pequeño.
// Usa un solo renderizador compartido, así que es barato pedir muchos retratos.

import { THREE } from "./three-kit.js";
import { createMatichico } from "./matichico3d.js";
import { getOutfit } from "./wardrobe-data.js";

let renderer = null;
let scene = null;
let camera = null;

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(256, 256, false);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff0e0, 0x6a3a40, 1.5));
  const key = new THREE.DirectionalLight(0xfff3dc, 2.4);
  key.position.set(-2, 4, 5);
  scene.add(key);
  camera = new THREE.PerspectiveCamera(26, 1, 0.1, 30);
  camera.position.set(0.3, 1.25, 5.6);
  camera.lookAt(0, 0.98, 0);
}

function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
  });
}

/** Dibuja en `target` (un canvas) a `character` con el `look` dado. Devuelve true si pudo. */
export function renderHeroThumb(target, character, look) {
  if (!renderer) init();
  const hero = createMatichico(character, getOutfit(look.outfit), look);
  hero.group.rotation.y = -0.3;
  hero.animate(0.5, "idle", 1);
  scene.add(hero.group);
  renderer.render(scene, camera);
  const ctx = target.getContext("2d");
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(renderer.domElement, 0, 0, target.width, target.height);
  scene.remove(hero.group);
  disposeTree(hero.group);
  return true;
}
