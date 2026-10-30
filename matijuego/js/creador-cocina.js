// Crea tu Chocolate: la cocina (pedido de la persona dueña, 29-oct-2026). Después de elegir cómo será el chocolate, se
// hace a mano, como una cocinita de juguete:
//   1. Juntar: los ingredientes van apareciendo en la repisa; se tocan los que pide la receta (¡no la cebolla!).
//   2. Llevar: se arrastran del canasto a la olla.
//   3. Derretir: se mantiene apretado para calentar, sin pasarse (si se pasa, se quema).
//   4. Revolver: se dan vueltas con el dedo alrededor de la olla hasta que el relleno se mezcla.
//   5. Al molde: se mantiene apretado para verter y se suelta cuando el molde está justo lleno.
//   6. Decorar: se toca el molde para espolvorear los toppings.
// Los ingredientes se consiguen jugando: nunca se pagan con Matipuntos. Lo bien que se cocina suma puntos a la creación.

import { THREE, canvasTexture, roundedBox, clamp } from "./three-kit.js?v=4754985988";
import * as audio from "./audio.js?v=4754985988";
import { getChocolate, getFlavor, getTopping, FLAVOR_ICON } from "./creador-data.js?v=4754985988";

export const PHASES = [
  { id: "juntar", label: "Juntar", icon: "🧺" },
  { id: "llevar", label: "Llevar", icon: "🤲" },
  { id: "derretir", label: "Derretir", icon: "🔥" },
  { id: "revolver", label: "Revolver", icon: "🥄" },
  { id: "moldear", label: "Al molde", icon: "🫗" },
  { id: "decorar", label: "Decorar", icon: "✨" },
];
const DECOYS = ["🧅", "🥦", "🧀", "🌶️", "🐟", "🥕"];
const ZONE = [0.45, 0.75]; // temperatura justa para derretir
const BAND = [0.85, 1.0]; // molde lleno "justo"
const TURNS = 4; // vueltas para mezclar
const POT = new THREE.Vector3(0.35, 0.06, 0.25);
const BASKET = new THREE.Vector3(-2.35, 0.06, 0.95);
const MOLD = new THREE.Vector3(2.35, 0.06, 1.0);

const texCache = new Map();
function emojiTex(icon) {
  if (!texCache.has(icon)) {
    texCache.set(icon, canvasTexture(128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.font = '92px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(icon, w / 2, h / 2 + 6);
    }));
  }
  return texCache.get(icon);
}
const sprite = (icon, size = 0.8) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(icon), transparent: true }));
  s.scale.set(size, size, 1);
  return s;
};
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

export class Kitchen {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.ray = new THREE.Raycaster();
    this._build();
  }

  // ---------- escena ----------

  _build() {
    const std = (c, r = 0.6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const g = (this.group = new THREE.Group());
    g.visible = false;
    this.game.scene.add(g);
    // repisa del fondo (despensa) con cajoncitos
    const wood = std(0xa86b3c, 0.8);
    for (const y of [1.15, 2.3]) {
      const plank = new THREE.Mesh(roundedBox(7.2, 0.14, 0.7, 0.05, 0.02), wood);
      plank.position.set(0, y, -2.55);
      plank.castShadow = plank.receiveShadow = true;
      g.add(plank);
    }
    const backBoard = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 2.6), std(0xf3dcc0, 0.9));
    backBoard.position.set(0, 1.75, -2.88);
    g.add(backBoard);
    for (const x of [-3.55, 3.55]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.9, 0.7), wood);
      side.position.set(x, 1.45, -2.55);
      side.castShadow = true;
      g.add(side);
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), new THREE.MeshBasicMaterial({
      transparent: true,
      map: canvasTexture(512, 100, (c, w, h) => {
        c.fillStyle = "#fff6e6"; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 30); c.fill();
        c.fillStyle = "#6b3a1e"; c.font = '56px "Baby Chipmunk", sans-serif'; c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText("DESPENSA", w / 2, h / 2 + 4);
      }),
    }));
    sign.position.set(0, 3.15, -2.5);
    g.add(sign);
    // 10 lugares donde aparecen los ingredientes
    this.slots = [];
    for (const y of [1.62, 2.77]) {
      for (let i = 0; i < 5; i++) {
        const s = sprite("🍫", 1);
        s.position.set(-2.8 + i * 1.4, y, -2.4);
        s.visible = false;
        g.add(s);
        this.slots.push({ s, item: null, t: 0, life: 0, base: y });
      }
    }
    // hornilla y olla
    this.burner = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.07, 8, 32), new THREE.MeshStandardMaterial({ color: 0x3a3a40, emissive: 0xff4a1a, emissiveIntensity: 0, roughness: 0.6 }));
    this.burner.rotation.x = Math.PI / 2;
    this.burner.position.set(POT.x, 0.1, POT.z);
    g.add(this.burner);
    this.pot = new THREE.Group();
    const steel = std(0xcfd2d8, 0.25, 0.8);
    const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(0.8, 0), new THREE.Vector2(0.86, 0.06), new THREE.Vector2(0.9, 0.85), new THREE.Vector2(0.96, 0.9), new THREE.Vector2(0.86, 0.9), new THREE.Vector2(0.8, 0.12), new THREE.Vector2(0, 0.12)];
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), steel);
    body.castShadow = body.receiveShadow = true;
    this.pot.add(body);
    for (const sx of [-1, 1]) {
      const h = new THREE.Mesh(roundedBox(0.36, 0.1, 0.18, 0.04, 0.02), std(0x2b1a10, 0.6));
      h.position.set(sx * 1.08, 0.72, 0);
      this.pot.add(h);
    }
    // el chocolate derretido y el relleno que se mezcla (un remolino que se va borrando)
    this.liquid = new THREE.Mesh(new THREE.CircleGeometry(0.8, 32), new THREE.MeshStandardMaterial({ color: 0x7b4a2a, roughness: 0.25 }));
    this.liquid.rotation.x = -Math.PI / 2;
    this.pot.add(this.liquid);
    this.swirlTex = canvasTexture(256, 256, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.strokeStyle = "#ffffff"; c.lineWidth = 16; c.lineCap = "round";
      c.beginPath();
      for (let a = 0; a < 12; a += 0.1) { const r = 8 + a * 9.5; c.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); }
      c.stroke();
    });
    this.swirl = new THREE.Mesh(new THREE.CircleGeometry(0.78, 32), new THREE.MeshBasicMaterial({ map: this.swirlTex, transparent: true, color: 0xd9923a, depthWrite: false }));
    this.swirl.rotation.x = -Math.PI / 2;
    this.pot.add(this.swirl);
    this.chunks = [];
    const chunkGeo = roundedBox(0.34, 0.16, 0.34, 0.05, 0.02);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(chunkGeo, std(0x7b4a2a, 0.45));
      m.position.set(Math.cos(i * 2.1) * 0.35, 0.22, Math.sin(i * 2.1) * 0.35);
      m.rotation.y = i;
      m.castShadow = true;
      this.pot.add(m);
      this.chunks.push(m);
    }
    this.spoon = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.5, 8), std(0xd9a463, 0.7));
    stick.position.y = 0.75;
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), std(0xd9a463, 0.7));
    bowl.scale.set(1, 0.5, 1.3);
    this.spoon.add(stick, bowl);
    this.spoon.rotation.z = 0.35;
    this.pot.add(this.spoon);
    this.pot.position.copy(POT);
    this.pot.position.y = 0.14;
    g.add(this.pot);
    this.stream = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1, 10), new THREE.MeshStandardMaterial({ color: 0x7b4a2a, roughness: 0.25 }));
    this.stream.visible = false;
    g.add(this.stream);
    // canasto
    const weave = canvasTexture(128, 64, (c, w, h) => {
      c.fillStyle = "#c98a4b"; c.fillRect(0, 0, w, h);
      c.strokeStyle = "#8a5a36"; c.lineWidth = 4;
      for (let x = 0; x < w; x += 12) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 6, h); c.stroke(); }
      for (let y = 8; y < h; y += 14) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    });
    weave.wrapS = THREE.RepeatWrapping;
    weave.repeat.set(4, 1);
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.65, 0.55, 20, 1, true), new THREE.MeshStandardMaterial({ map: weave, roughness: 0.9, side: THREE.DoubleSide }));
    basket.position.set(BASKET.x, 0.33, BASKET.z);
    basket.castShadow = true;
    g.add(basket);
    // molde de silicona
    this.mold = new THREE.Group();
    const silicone = std(0xe0457f, 0.55);
    const tray = new THREE.Mesh(roundedBox(1.7, 0.36, 1.3, 0.12, 0.03), silicone);
    tray.position.y = 0.18;
    tray.castShadow = tray.receiveShadow = true;
    this.mold.add(tray);
    this.fill = new THREE.Mesh(roundedBox(1.4, 0.3, 1.0, 0.1, 0.02), new THREE.MeshStandardMaterial({ color: 0x7b4a2a, roughness: 0.3 }));
    this.fill.position.y = 0.37;
    this.fill.visible = false;
    this.mold.add(this.fill);
    this.mold.position.copy(MOLD);
    g.add(this.mold);
    // lo que va en el canasto (para llevar a la olla) y la cucharita de cada topping
    this.carry = [];
  }

  // ---------- partida ----------

  /** Empieza la cocina para la receta `cfg`. Al terminar llama a onDone({ score, notes }). */
  start(cfg, onDone) {
    this.cfg = cfg;
    this.onDone = onDone;
    this.active = true;
    this.group.visible = true;
    const choc = getChocolate(cfg.chocolate);
    const flav = getFlavor(cfg.flavor);
    this.chocColor = new THREE.Color(choc.color);
    this.need = [
      { id: "choco", icon: "🍫", name: `chocolate ${choc.name.toLowerCase()}`, n: 3, got: 0 },
      { id: "flavor", icon: FLAVOR_ICON[flav.id] || "🍯", name: flav.name.toLowerCase(), n: 2, got: 0 },
      ...cfg.toppings.map((t) => ({ id: t, icon: getTopping(t).icon, name: getTopping(t).name.toLowerCase(), n: 1, got: 0, topping: true })),
    ];
    this.decoys = 0;
    this.burnt = 0;
    this.temp = 0;
    this.melt = 0;
    this.stir = 0;
    this.pour = 0;
    this.pourHold = false;
    this.overflow = false;
    this.cooling = false;
    this.pourGood = false;
    this.sprinkles = 0;
    this.holding = false;
    this.spawnT = 0.4;
    this.drag = null;
    this.waitT = 0;
    for (const sl of this.slots) { sl.item = null; sl.s.visible = false; }
    for (const c of this.carry) this.group.remove(c.s);
    this.carry = [];
    for (const m of this.chunks) { m.visible = false; m.scale.setScalar(1); m.material.color.copy(this.chocColor); }
    this.liquid.material.color.copy(this.chocColor);
    this.liquid.visible = false;
    this.swirl.visible = false;
    this.swirl.material.opacity = 0;
    this.swirl.material.color.set(flav.color);
    this.stream.material.color.copy(this.chocColor);
    this.fill.material.color.copy(this.chocColor);
    this.fill.visible = false;
    this.pot.position.set(POT.x, 0.14, POT.z);
    this.pot.rotation.set(0, 0, 0);
    this.spoon.visible = false;
    this.phase = null;
    this._phase("juntar");
    this.frame();
  }

  stop() {
    this.active = false;
    this.group.visible = false;
    this.game.els.wrap.classList.remove("cr-cooking");
  }

  _phase(id) {
    this.phase = id;
    this.phaseIdx = PHASES.findIndex((p) => p.id === id);
    this.game.els.wrap.classList.add("cr-cooking");
    if (id === "llevar") {
      // lo que hay que llevar a la olla espera arriba del canasto
      const items = [...Array(3).fill(this.need[0].icon), ...Array(2).fill(this.need[1].icon)];
      this.carry = items.map((icon, i) => {
        const s = sprite(icon, 0.62);
        const home = new THREE.Vector3(BASKET.x - 0.55 + (i % 3) * 0.55, 0.85 + Math.floor(i / 3) * 0.5, BASKET.z + 0.1);
        s.position.copy(home);
        this.group.add(s);
        return { s, home, kind: i < 3 ? "choco" : "flavor", done: false, fly: 0 };
      });
    }
    if (id === "revolver") this.spoon.visible = true;
    if (id === "decorar" && !this.cfg.toppings.length) { this._finish(); return; }
    this.game._renderPanel();
  }

  frame() {
    const cam = this.game.camera;
    const vfov = THREE.MathUtils.degToRad(cam.fov / 2);
    const d = Math.max(9.4, 3.95 / (Math.tan(vfov) * cam.aspect));
    cam.position.set(0, 1.1 + d * 0.36, d * 0.93 - 0.6);
    cam.lookAt(0, 1.1, -0.6);
    this.game.mascotRoot.visible = false; // en la cocina no cabe: vuelve al terminar
  }

  // ---------- entrada ----------

  _ndc(e) {
    const r = this.game.els.canvas.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  _hit(e, objs) {
    this.ray.setFromCamera(this._ndc(e), this.game.camera);
    return this.ray.intersectObjects(objs, false)[0] || null;
  }

  /** Punto del plano horizontal a la altura y bajo el dedo. */
  _onPlane(e, y) {
    this.ray.setFromCamera(this._ndc(e), this.game.camera);
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null;
  }

  _potAngle(e) {
    const c = new THREE.Vector3(POT.x, 0.6, POT.z).project(this.game.camera);
    const n = this._ndc(e);
    return Math.atan2((n.y - c.y), (n.x - c.x) * this.game.camera.aspect);
  }

  pointer(type, e) {
    if (!this.active) return;
    const ph = this.phase;
    if (type === "down") {
      if (ph === "juntar") {
        const h = this._hit(e, this.slots.filter((s) => s.item && !s.fly && s.s.visible).map((s) => s.s));
        if (h) this._pick(this.slots.find((s) => s.s === h.object));
      } else if (ph === "llevar") {
        const h = this._hit(e, this.carry.filter((c) => !c.done).map((c) => c.s));
        if (h) { this.drag = this.carry.find((c) => c.s === h.object); audio.playPop(); }
      } else if (ph === "derretir" || ph === "moldear") this.hold(true);
      else if (ph === "revolver") this.stirA = this._potAngle(e);
      else if (ph === "decorar") {
        if (this._hit(e, this.mold.children)) this._sprinkle();
      }
    } else if (type === "move") {
      if (ph === "llevar" && this.drag) {
        const p = this._onPlane(e, 1.1);
        if (p) this.drag.s.position.set(clamp(p.x, -3.4, 3.4), 1.1, clamp(p.z, -1.5, 2.4));
      } else if (ph === "revolver" && this.stirA != null) {
        const a = this._potAngle(e);
        let d = a - this.stirA;
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        this.stirA = a;
        this._stirBy(Math.abs(d), -a);
      }
    } else {
      if (ph === "llevar" && this.drag) {
        const c = this.drag;
        this.drag = null;
        const dx = c.s.position.x - POT.x, dz = c.s.position.z - POT.z;
        if (Math.hypot(dx, dz) < 1.35) this._drop(c);
        else c.s.position.copy(c.home);
      }
      if (ph === "derretir" || ph === "moldear") this.hold(false);
      this.stirA = null;
    }
  }

  /** Mantener apretado (pantalla, botón o barra espaciadora): calienta o vierte. */
  hold(on) {
    if (!this.active) return;
    this.holding = !!on;
    if (this.phase === "moldear" && !on && this.pour > 0) this._pourStop();
  }

  _pick(sl) {
    const it = sl.item;
    const need = this.need.find((n) => n.icon === it.icon && n.got < n.n && it.need);
    const at = sl.s.position.clone().add(new THREE.Vector3(0, 0.5, 0.3));
    if (need) {
      need.got++;
      audio.playCollect();
      this.game.popups.add(at, `+1 ${it.icon}`, "coin");
      sl.fly = { from: sl.s.position.clone(), t: 0 };
    } else if (it.need) {
      this.game.popups.add(at, "¡Ya tienes suficiente!", "kill");
      sl.item = null; sl.s.visible = false;
    } else {
      this.decoys++;
      audio.playBump();
      this.game.popups.add(at, "¡Eso no va en un chocolate! 😝", "kill");
      sl.item = null; sl.s.visible = false;
    }
    this._refresh();
    if (this.need.every((n) => n.got >= n.n)) this.waitT = 0.7;
  }

  _drop(c) {
    c.done = true;
    c.fly = 0.001;
    audio.playBonusCollect();
    if (c.kind === "choco") {
      const m = this.chunks.find((x) => !x.visible);
      if (m) { m.visible = true; m.scale.setScalar(1); }
    } else {
      this.swirl.visible = true;
      this.swirl.material.opacity = Math.min(0.95, (this.swirl.material.opacity || 0) + 0.5);
    }
    this.game.particles.burst(new THREE.Vector3(POT.x, 1.0, POT.z), [0xfff6e6, this.chocColor.getHex()], 8, 2.5, 0.5, 6, 0.8);
    this._refresh();
    if (this.carry.every((x) => x.done)) this.waitT = 0.6;
  }

  _stirBy(d, ang) {
    this.stir = Math.min(TURNS * Math.PI * 2, this.stir + d);
    this.spoon.position.set(Math.cos(ang) * 0.42, 0.3, Math.sin(ang) * 0.42);
    this.spoon.rotation.set(0, -ang, 0.35);
    this.swirl.rotation.z = -this.stir * 0.6;
    const k = this.stir / (TURNS * Math.PI * 2);
    this.swirl.material.opacity = 0.95 * (1 - k);
    const before = Math.floor(((this.stir - d) / (Math.PI * 2)));
    if (Math.floor(this.stir / (Math.PI * 2)) > before) { audio.playCombo(Math.floor(this.stir / (Math.PI * 2)) + 1); this._refresh(); }
    if (k >= 1 && !this.waitT) { this.waitT = 0.5; this.game.popups.add(new THREE.Vector3(POT.x, 1.6, POT.z + 0.4), "¡Bien mezclado!", "combo"); }
  }

  _pourStop() {
    if (this.cooling) return;
    const ok = this.pour >= BAND[0] && this.pour <= BAND[1];
    if (ok || this.overflow) {
      this.pourGood = ok;
      this.game.popups.add(new THREE.Vector3(MOLD.x, 1.6, MOLD.z), ok ? "¡Justo! 👌" : "¡Se rebalsó un poquito!", ok ? "combo" : "kill");
      if (ok) audio.playStar();
      this.waitT = 1.3; // enfriar
      this.cooling = true;
    }
  }

  _sprinkle() {
    const tops = this.cfg.toppings;
    const t = tops[Math.floor(this.sprinkles / 3) % tops.length];
    const col = new THREE.Color(getTopping(t).color).getHex();
    this.game.particles.burst(new THREE.Vector3(MOLD.x, 1.3, MOLD.z), [col, 0xfff6e6], 14, 1.6, 0.6, 9, 0.8);
    audio.playPop();
    this.sprinkles++;
    this._refresh();
    if (this.sprinkles >= tops.length * 3) this.waitT = 0.6;
  }

  // ---------- cada cuadro ----------

  update(dt, time) {
    if (!this.active) return;
    const ph = this.phase;
    if (this.waitT > 0) {
      this.waitT -= dt;
      if (this.waitT <= 0) {
        this.waitT = 0;
        if (ph === "moldear") this.cooling = false;
        if (PHASES[this.phaseIdx + 1]) this._phase(PHASES[this.phaseIdx + 1].id);
        else this._finish();
        return;
      }
    }
    if (ph === "juntar") this._updateJuntar(dt);
    // lo que se lleva a la olla: cae adentro
    for (const c of this.carry) {
      if (c.done && c.fly > 0 && c.s.visible) {
        c.fly += dt * 3;
        c.s.position.lerp(new THREE.Vector3(POT.x, 0.5, POT.z), Math.min(1, dt * 10));
        c.s.scale.setScalar(0.62 * Math.max(0, 1 - c.fly * 0.8));
        if (c.fly > 1.2) c.s.visible = false;
      }
    }
    // olla: hornilla, temperatura y derretido
    const heating = ph === "derretir" && this.holding;
    this.burner.material.emissiveIntensity += ((heating ? 1.4 : 0) - this.burner.material.emissiveIntensity) * Math.min(1, dt * 6);
    if (ph === "derretir" && !this.waitT) {
      this.temp = clamp(this.temp + (heating ? 0.4 : -0.26) * dt, 0, 1);
      if (this.temp >= ZONE[0] && this.temp <= ZONE[1]) this.melt = Math.min(1, this.melt + dt / 2.6);
      if (this.temp > 0.9) {
        this.burnt += dt;
        if (Math.random() < dt * 8) this.game.particles.burst(new THREE.Vector3(POT.x, 1.1, POT.z), [0x555555, 0x888888], 3, 1.2, 0.8, -2, 1.2);
      } else if (this.temp > ZONE[0] && Math.random() < dt * 3) this.game.particles.burst(new THREE.Vector3(POT.x + (Math.random() - 0.5), 1.0, POT.z), [0xffffff], 2, 0.8, 0.9, -1.5, 1);
      if (this.melt >= 1) { this.waitT = 0.6; this.game.popups.add(new THREE.Vector3(POT.x, 1.6, POT.z + 0.4), "¡Derretido!", "combo"); audio.playMissionComplete(); }
      this._meter(this.temp, this.melt);
    }
    const melted = ph === "derretir" ? this.melt : ["revolver", "moldear", "decorar"].includes(ph) ? 1 : 0;
    for (const m of this.chunks) if (m.visible) m.scale.set(1 - melted * 0.9, 1 - melted * 0.95, 1 - melted * 0.9);
    this.liquid.visible = melted > 0.05 && !(ph === "moldear" && this.pour > 0.95) && ph !== "decorar";
    this.liquid.position.y = 0.14 + melted * 0.36 - (ph === "moldear" ? this.pour * 0.4 : 0);
    this.swirl.position.y = this.liquid.position.y + 0.012;
    if (ph === "decorar") this.swirl.visible = false;
    // al molde: la olla se levanta y se inclina sobre el molde mientras se mantiene apretado
    if (ph === "moldear") {
      const pouring = this.holding && !this.waitT;
      const tgt = pouring ? new THREE.Vector3(MOLD.x - 0.95, 1.25, MOLD.z) : new THREE.Vector3(POT.x, 0.14, POT.z);
      this.pot.position.lerp(tgt, Math.min(1, dt * 7));
      this.pot.rotation.z += ((pouring ? -0.95 : 0) - this.pot.rotation.z) * Math.min(1, dt * 7);
      const ready = pouring && this.pot.position.distanceTo(tgt) < 0.25;
      this.stream.visible = ready;
      if (ready) {
        this.pour += dt * 0.34;
        this.stream.position.set(MOLD.x - 0.15, 0.95, MOLD.z);
        this.stream.scale.set(1, 1.1, 1);
        if (this.pour > 1.12 && !this.overflow) { this.overflow = true; this.holding = false; audio.playBump(); this._pourStop(); }
      }
      this.fill.visible = this.pour > 0.02;
      const p = Math.max(0.05, Math.min(1.15, this.pour));
      this.fill.scale.set(1, p * 0.5, 1);
      this.fill.position.y = 0.34 + p * 0.075;
      if (this.cooling && Math.random() < dt * 10) this.game.particles.burst(new THREE.Vector3(MOLD.x + (Math.random() - 0.5), 1.4, MOLD.z), [0xbfe8ff, 0xffffff], 2, 0.6, 0.9, 2, 1);
      if (this.cooling) this.fill.material.color.lerp(this.chocColor.clone().multiplyScalar(0.8), dt);
      this._meter(Math.min(1.15, this.pour) / 1.15, null);
    } else this.stream.visible = false;
    // la cuchara solo se ve mientras se revuelve
    if (ph !== "revolver") this.spoon.visible = false;
    void time;
  }

  _updateJuntar(dt) {
    this.spawnT -= dt;
    const missing = this.need.filter((n) => n.got < n.n);
    if (this.spawnT <= 0 && missing.length) {
      this.spawnT = 0.5;
      const free = this.slots.filter((s) => !s.item);
      if (free.length) {
        const sl = free[Math.floor(Math.random() * free.length)];
        const good = Math.random() < 0.66;
        const icon = good ? missing[Math.floor(Math.random() * missing.length)].icon : DECOYS[Math.floor(Math.random() * DECOYS.length)];
        sl.item = { icon, need: good };
        sl.s.material.map = emojiTex(icon);
        sl.s.visible = true;
        sl.t = 0;
        sl.life = 2.4;
        sl.fly = null;
      }
    }
    for (const sl of this.slots) {
      if (!sl.item) continue;
      if (sl.fly) {
        // vuela al canasto
        sl.fly.t += dt * 2.2;
        const k = Math.min(1, sl.fly.t);
        sl.s.position.lerpVectors(sl.fly.from, new THREE.Vector3(BASKET.x, 0.9, BASKET.z), k);
        sl.s.position.y += Math.sin(k * Math.PI) * 1.2;
        if (k >= 1) { sl.item = null; sl.s.visible = false; sl.fly = null; this._resetSlot(sl); }
        continue;
      }
      sl.t += dt;
      const a = Math.min(1, sl.t / 0.2, (sl.life - sl.t) / 0.2);
      sl.s.scale.setScalar(Math.max(0, a));
      sl.s.position.y = sl.base + Math.sin(sl.t * 6) * 0.04;
      if (sl.t >= sl.life) { sl.item = null; sl.s.visible = false; }
    }
  }

  _resetSlot(sl) {
    const i = this.slots.indexOf(sl);
    sl.s.position.set(-2.8 + (i % 5) * 1.4, sl.base, -2.4);
  }

  _finish() {
    const notes = [];
    let score = 40;
    if (this.decoys === 0) { score += 20; notes.push("Juntaste justo lo que pedía la receta."); } else if (this.decoys <= 2) score += 10;
    if (this.burnt === 0) { score += 30; notes.push("Derretiste el chocolate sin quemarlo."); } else if (this.burnt < 1) score += 15;
    score += 20;
    if (this.pourGood) { score += 40; notes.push("¡El molde quedó justo lleno!"); } else score += 10;
    this.stop();
    this.onDone && this.onDone({ score, notes: notes.length ? [`👩‍🍳 Hecho a mano: ${notes.join(" ")}`] : ["👩‍🍳 ¡Hecho a mano!"] });
  }

  // ---------- panel ----------

  renderPanel(panel) {
    const box = el("div", "ck");
    box.append(el("h3", null, "👩‍🍳 ¡A la cocina!"));
    const steps = el("div", "cr-steps");
    PHASES.forEach((p, i) => {
      if (p.id === "decorar" && !this.cfg.toppings.length) return;
      steps.append(el("span", `cr-step${i === this.phaseIdx ? " sel" : ""}${i < this.phaseIdx ? " done" : ""}`, `${p.icon} ${p.label}`));
    });
    box.append(steps);
    const text = {
      juntar: "Toca en la despensa los ingredientes de tu receta. ¡Ojo con los que no van!",
      llevar: "Arrastra cada ingrediente del canasto a la olla.",
      derretir: "Mantén apretado (la pantalla o el botón) para calentar. Que el termómetro quede en lo verde: si se pasa, ¡se quema!",
      revolver: `Revuelve: da ${TURNS} vueltas con el dedo alrededor de la olla.`,
      moldear: "Mantén apretado para verter el chocolate y suelta cuando el molde esté en la raya verde.",
      decorar: "Toca el molde para espolvorear tus toppings.",
    }[this.phase];
    box.append(el("p", "ck-text", text));
    this.ui = {};
    if (this.phase === "juntar" || this.phase === "llevar" || this.phase === "decorar") {
      const list = el("div", "ck-need");
      this.ui.need = list;
      box.append(list);
    }
    if (this.phase === "derretir" || this.phase === "moldear") {
      const meter = el("div", "ck-meter");
      const zone = el("div", "ck-zone");
      const [lo, hi] = this.phase === "derretir" ? ZONE : [BAND[0] / 1.15, BAND[1] / 1.15];
      zone.style.left = `${lo * 100}%`;
      zone.style.width = `${(hi - lo) * 100}%`;
      const fill = el("div", "ck-fill");
      meter.append(zone, fill);
      box.append(el("small", "ck-meter-label", this.phase === "derretir" ? "🌡️ Temperatura" : "🫗 Molde"), meter);
      this.ui.fill = fill;
      if (this.phase === "derretir") {
        const prog = el("div", "ck-meter ck-small");
        const pf = el("div", "ck-fill ck-melt");
        prog.append(pf);
        box.append(el("small", "ck-meter-label", "🍫 Derretido"), prog);
        this.ui.melt = pf;
      }
      const btn = el("button", "btn-primary ck-hold", this.phase === "derretir" ? "🔥 Mantén para calentar" : "🫗 Mantén para verter");
      btn.type = "button";
      const on = (e) => { e.preventDefault(); this.hold(true); };
      const off = (e) => { e.preventDefault(); this.hold(false); };
      btn.addEventListener("pointerdown", on);
      btn.addEventListener("pointerup", off);
      btn.addEventListener("pointerleave", off);
      btn.addEventListener("pointercancel", off);
      box.append(btn);
    }
    if (this.phase === "revolver") {
      const t = el("div", "ck-turns");
      this.ui.turns = t;
      box.append(t);
    }
    panel.append(box);
    this._refresh();
  }

  _refresh() {
    const ui = this.ui || {};
    if (ui.need) {
      ui.need.replaceChildren();
      if (this.phase === "juntar") {
        for (const n of this.need) ui.need.append(el("span", `ck-chip${n.got >= n.n ? " ok" : ""}`, `${n.icon} ${n.got}/${n.n} ${n.name}`));
      } else if (this.phase === "llevar") {
        const left = this.carry.filter((c) => !c.done).length;
        ui.need.append(el("span", "ck-chip", `Faltan ${left} para la olla`));
      } else {
        const total = this.cfg.toppings.length * 3;
        ui.need.append(el("span", "ck-chip", `${this.cfg.toppings.map((t) => getTopping(t).icon).join(" ")} · ${Math.min(this.sprinkles, total)}/${total}`));
      }
    }
    if (ui.turns) ui.turns.textContent = `🥄 ${Math.min(TURNS, Math.floor(this.stir / (Math.PI * 2)))}/${TURNS} vueltas`;
  }

  _meter(v, melt) {
    const ui = this.ui || {};
    if (ui.fill) {
      ui.fill.style.width = `${Math.round(clamp(v, 0, 1) * 100)}%`;
      const hot = this.phase === "derretir" && this.temp > 0.9;
      ui.fill.classList.toggle("hot", hot || (this.phase === "moldear" && this.pour > BAND[1]));
    }
    if (ui.melt && melt != null) ui.melt.style.width = `${Math.round(melt * 100)}%`;
  }
}
