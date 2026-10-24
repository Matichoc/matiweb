// Retratos 3D del Matichico (menú, perfiles, encabezado de los juegos y tienda): se dibuja
// el modelo 3D con todo lo que lleva puesto y se copia a un canvas 2D pequeño.
// Usa un solo renderizador compartido, así que es barato pedir muchos retratos.

import { THREE } from "./three-kit.js?v=d71cbaec54";
import { createMatichico } from "./matichico3d.js?v=d71cbaec54";
import { getOutfit } from "./wardrobe-data.js?v=d71cbaec54";

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

/**
 * Dibuja en `target` un objeto 3D cualquiera (por ejemplo un producto de Mati Merge), mirado un poco desde arriba.
 * `size` = ancho aproximado del objeto; `y` = altura de su centro.
 */
export function renderObjectThumb(target, object, { size = 1, y = 0.3 } = {}) {
  if (!renderer) init();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
  const dist = (size * 0.62) / Math.tan((15 * Math.PI) / 180);
  cam.position.set(0, y + dist * 0.62, dist * 0.78);
  cam.lookAt(0, y * 0.8, 0);
  scene.add(object);
  renderer.render(scene, cam);
  const ctx = target.getContext("2d");
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(renderer.domElement, 0, 0, target.width, target.height);
  scene.remove(object);
  return true;
}
