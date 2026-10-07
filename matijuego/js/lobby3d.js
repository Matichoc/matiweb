// Escenario 3D del menú principal: tu Matichico sobre un pedestal, con alfajores
// girando alrededor y chispas. Se puede arrastrar para girarlo y tocar para que salude.
// Es liviano (sin sombras pesadas ni efectos) y solo dibuja cuando el menú está visible.

import { THREE, loadTexture } from "./three-kit.js";
import { createMatichico } from "./matichico3d.js";

const SPRITES = ["alf-frambuesa", "alf-menta", "alf-naranja", "alf-trufa", "alf-maracuya"];

export class Lobby3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.active = false;
    this.ready = false;
    this.time = 0;
    this.dragYaw = 0;
    this.cheerT = 0;
    this.pop = 1;
    this.key = "";
  }

  init() {
    const canvas = this.canvas;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, alpha: true, powerPreference: "default" });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.scene.add(new THREE.HemisphereLight(0xfff0e0, 0x5a2a40, 1.35));
    const key = new THREE.DirectionalLight(0xfff3dc, 2.6);
    key.position.set(-3, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 4; key.shadow.camera.bottom = -2;
    key.shadow.bias = -0.0008;
    this.scene.add(key);
    const rim = new THREE.PointLight(0xd4216c, 40, 12);
    rim.position.set(3, 2.5, -2);
    this.scene.add(rim);
    const gold = new THREE.PointLight(0xffc800, 22, 10);
    gold.position.set(-3, 1.5, 3);
    this.scene.add(gold);

    // pedestal
    const pink = new THREE.MeshStandardMaterial({ color: 0xd4216c, roughness: 0.3, metalness: 0.1 });
    const goldM = new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.25, metalness: 0.7, emissive: 0x6a4a00, emissiveIntensity: 0.5 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.7, 0.4, 40), pink);
    base.position.y = 0.2;
    base.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.56, 0.06, 10, 48), goldM);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.4;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.06, 40), new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.4 }));
    top.position.y = 0.42;
    top.receiveShadow = true;
    this.scene.add(base, ring, top);

    // aro luminoso al fondo
    const halo = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.05, 10, 64), new THREE.MeshBasicMaterial({ color: 0xffc800, transparent: true, opacity: 0.55 }));
    halo.position.set(0, 2.2, -1.2);
    this.scene.add(halo);
    this.halo = halo;

    // alfajores girando
    this.discs = [];
    const discGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.09, 24);
    const rimGeo = new THREE.TorusGeometry(0.35, 0.04, 8, 24);
    const creamM = new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.5 });
    SPRITES.forEach((n, i) => {
      const tex = loadTexture(`assets/products/${n}.jpg`);
      const g = new THREE.Group();
      const disc = new THREE.Mesh(discGeo, [creamM, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), creamM]);
      disc.rotation.x = Math.PI / 2;
      const r = new THREE.Mesh(rimGeo, goldM);
      r.position.z = 0.03;
      g.add(disc, r);
      this.scene.add(g);
      this.discs.push({ g, a: (i / SPRITES.length) * Math.PI * 2, y: 1.2 + (i % 3) * 0.55, r: 2.15 + (i % 2) * 0.25 });
    });

    // chispas
    const N = 70;
    const pos = new Float32Array(N * 3);
    this.sparkData = [];
    for (let i = 0; i < N; i++) {
      this.sparkData.push({ a: Math.random() * 6.28, r: 1 + Math.random() * 2.2, y: Math.random() * 3.6, s: 0.2 + Math.random() * 0.5 });
    }
    this.sparkGeo = new THREE.BufferGeometry();
    this.sparkGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.sparks = new THREE.Points(this.sparkGeo, new THREE.PointsMaterial({ color: 0xffd966, size: 0.07, transparent: true, opacity: 0.9, depthWrite: false }));
    this.scene.add(this.sparks);

    this._resize = () => {
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      // encuadre: que quepa el pedestal y los alfajores
      const need = Math.max(5.3, 6.4 / Math.min(1, this.camera.aspect * 1.05));
      const dist = (need / 2) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      this.camera.position.set(0, 2.3, dist);
      this.camera.lookAt(0, 1.55, 0);
      this.camera.updateProjectionMatrix();
    };
    new ResizeObserver(this._resize).observe(canvas);
    this._resize();

    // arrastrar para girar / tocar para saludar
    let drag = null;
    canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, moved: false }; canvas.setPointerCapture?.(e.pointerId); });
    canvas.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 3) drag.moved = true;
      this.dragYaw += dx * 0.012;
      drag.x = e.clientX;
    });
    const end = () => {
      if (drag && !drag.moved) this.cheerT = 1.4;
      drag = null;
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", () => { drag = null; });

    this._loop = this._loop.bind(this);
    this.ready = true;
  }

  setHero(character, outfit, key) {
    if (!this.ready) return;
    if (this.hero) this.scene.remove(this.hero.group);
    this.hero = createMatichico(character, outfit);
    this.hero.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.hero.group.scale.setScalar(2.1);
    this.hero.group.position.y = 0.45;
    this.scene.add(this.hero.group);
    this.pop = 0;
    this.cheerT = 1.3;
    this.key = key;
  }

  setActive(on) {
    if (!this.ready) return;
    if (on && !this.active) {
      this.active = true;
      this._last = null;
      requestAnimationFrame(this._loop);
    } else if (!on) this.active = false;
  }

  _loop(ts) {
    if (!this.active) return;
    if (this._last == null) this._last = ts;
    const dt = Math.min(0.05, (ts - this._last) / 1000);
    this._last = ts;
    this.time += dt;
    const t = this.time;

    if (this.hero) {
      this.pop = Math.min(1, this.pop + dt * 3.2);
      const e = 1 - Math.pow(1 - this.pop, 3);
      this.hero.group.scale.setScalar(2.1 * (0.55 + 0.45 * e));
      this.dragYaw *= Math.pow(0.12, dt); // vuelve suavemente a mirar al frente
      this.hero.group.rotation.y = Math.sin(t * 0.7) * 0.28 + this.dragYaw;
      this.cheerT = Math.max(0, this.cheerT - dt);
      this.hero.animate(t, this.cheerT > 0 ? "cheer" : "idle", 1);
      this.hero.group.position.y = 0.45 + (this.cheerT > 0 ? Math.abs(Math.sin(t * 7)) * 0.12 : 0);
    }
    for (const d of this.discs) {
      const a = d.a + t * 0.5;
      d.g.position.set(Math.cos(a) * d.r, d.y + Math.sin(t * 1.6 + d.a * 3) * 0.12, Math.sin(a) * d.r * 0.55);
      d.g.rotation.y = Math.sin(t * 1.2 + d.a) * 0.5;
    }
    this.halo.rotation.z = t * 0.2;
    const p = this.sparkGeo.attributes.position;
    this.sparkData.forEach((s, i) => {
      const a = s.a + t * s.s * 0.4;
      p.setXYZ(i, Math.cos(a) * s.r, (s.y + t * s.s * 0.5) % 3.8, Math.sin(a) * s.r * 0.7);
    });
    p.needsUpdate = true;

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }
}
