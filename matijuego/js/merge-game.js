// Mati Merge 3D: tablero lleno de productos Matichoc de 4 familias (alfajores, cuchuflís, bombones y tabletas).
// Arrastra un producto sobre otro IGUAL y se transforma en el siguiente de su familia, del más chiquito al más grande, hasta el
// ¡Mati Dubai! Los 4 generadores sacan productos nuevos (1 ⚡ cada uno) y los clientes piden productos para entregar.
// El tablero se guarda en tu perfil.

import { THREE, Game3D, lerp, rand, roundedBox, makeBunting, makeLogo } from "./three-kit.js?v=6ffcfcb247";
import * as audio from "./audio.js?v=6ffcfcb247";
import { recordRun } from "./progression.js?v=6ffcfcb247";
import { COLS, ROWS, CELLS, CHAINS, TOTAL_ITEMS, DUBAI, itemInfo, chainIdx, tierIdx, codeOf, maxTier, foundCount, mergeOf, spawnPiece, dropPiece, deliverOrder, canDeliver, emptyCells } from "./merge-data.js?v=6ffcfcb247";
import { drawItem, loadProductImages } from "./merge-art.js?v=6ffcfcb247";

const GAME_ID = "merge";
const CELL = 1.1;
const cellX = (i) => ((i % COLS) - (COLS - 1) / 2) * CELL;
const cellZ = (i) => (Math.floor(i / COLS) - (ROWS - 1) / 2) * CELL;

export class MergeGame extends Game3D {
  constructor(character, progress, els) {
    super(GAME_ID, character, progress, els, { fov: 40 });
    this.kawaii = true;
    this.ambientOpts = { petals: 18, hearts: 7, stars: 10, radius: 9, height: 9 };
    this.musicTheme = "chill";
    this.q = els.q;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.25);
    this.pieces = new Array(CELLS).fill(null);
    this.canvasCache = new Map();
    this.texCache = new Map();
    this.urlCache = new Map();
    this.images = {};
    this.drag = null;
    this.hint = { cells: [], t: 0 }; // pista: las dos piezas que se pueden juntar
    this.rings = []; // aros verdes que marcan con quién se puede juntar la pieza
    this.sessionMerges = 0;
    this.onNoEnergy = () => this.banner("😴 Sin energía: ¡puedes seguir juntando y entregando, pero no sacar productos nuevos!");
  }

  // ---------- escena ----------

  async build() {
    const s = this.scene;
    s.background = new THREE.Color(0xf3d7e8);
    s.fog = new THREE.Fog(0xf3d7e8, 20, 44);
    s.add(new THREE.HemisphereLight(0xfff0f8, 0xc9a6c8, 1.5));
    const sun = new THREE.DirectionalLight(0xfff3e0, 1.5);
    sun.position.set(-4, 12, 7);
    s.add(sun);
    const std = (color, roughness = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), std(0xe9c3dc, 0.95));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.6;
    s.add(floor);
    const base = new THREE.Mesh(roundedBox(COLS * CELL + 1.1, 0.6, ROWS * CELL + 1.1, 0.34, 0.08), std(0xb985c9, 0.55));
    base.position.y = -0.22;
    s.add(base);
    const tray = new THREE.Mesh(roundedBox(COLS * CELL + 0.4, 0.16, ROWS * CELL + 0.4, 0.2, 0.05), std(0xfff0f6, 0.8));
    tray.position.y = 0.06;
    s.add(tray);
    const tileGeo = new THREE.PlaneGeometry(CELL * 0.94, CELL * 0.94);
    for (let i = 0; i < CELLS; i++) {
      const dark = (Math.floor(i / COLS) + (i % COLS)) % 2;
      const t = new THREE.Mesh(tileGeo, new THREE.MeshStandardMaterial({ color: dark ? 0xf6d4e6 : 0xfde9f2, roughness: 0.9 }));
      t.rotation.x = -Math.PI / 2;
      t.position.set(cellX(i), 0.15, cellZ(i));
      s.add(t);
    }
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 24), std(0xf8e3ef, 0.95));
    wall.position.set(0, 9, -12);
    s.add(wall);
    const logo = makeLogo(4.4);
    logo.position.set(0, 6.4, -11.8);
    s.add(logo);
    s.add(makeBunting(new THREE.Vector3(-13, 9.4, -11), new THREE.Vector3(13, 9.4, -11), { count: 26, sag: 1.4, size: 0.5 }));
    this.sel = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 28), new THREE.MeshBasicMaterial({ color: 0xff7ab8 }));
    this.sel.rotation.x = Math.PI / 2;
    this.sel.visible = false;
    s.add(this.sel);
    // las fotos de los productos se cargan antes de dibujar las piezas
    this.images = await loadProductImages(CHAINS.flatMap((c) => c.tiers.map((t) => t.img).filter(Boolean)));
  }

  /** El dibujo (256x256) de un producto. */
  _canvasOf(code) {
    let c = this.canvasCache.get(code);
    if (!c) {
      c = document.createElement("canvas");
      c.width = c.height = 256;
      drawItem(c, itemInfo(code), this.images);
      this.canvasCache.set(code, c);
    }
    return c;
  }

  _textureOf(code) {
    let t = this.texCache.get(code);
    if (!t) {
      t = new THREE.CanvasTexture(this._canvasOf(code));
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      this.texCache.set(code, t);
    }
    return t;
  }

  /** Imagen del producto para la interfaz (pedidos, lista de productos). */
  _urlOf(code) {
    let u = this.urlCache.get(code);
    if (!u) { u = this._canvasOf(code).toDataURL("image/png"); this.urlCache.set(code, u); }
    return u;
  }

  _makePiece(code) {
    const info = itemInfo(code);
    const g = new THREE.Group();
    const k = 0.84 + 0.16 * (info.t / info.max); // las piezas más avanzadas se ven un poco más grandes
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.46 * k, 0.49 * k, 0.16, 36), new THREE.MeshStandardMaterial({ color: info.gold ? 0xf2c030 : info.chain.color, roughness: 0.4, metalness: info.gold ? 0.55 : 0.05, emissive: info.gold ? 0xb88400 : 0x000000, emissiveIntensity: info.gold ? 0.35 : 0 }));
    body.position.y = 0.08;
    g.add(body);
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.5 * k, 36), new THREE.MeshBasicMaterial({ map: this._textureOf(code), transparent: true }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.17;
    g.add(top);
    g.userData.noToon = true;
    return g;
  }

  _addPiece(i, code, { from = null, grow = true } = {}) {
    const mesh = this._makePiece(code);
    const p = { code, mesh, x: from ? from.x : cellX(i), z: from ? from.z : cellZ(i), y: from ? 0.6 : 0, scale: grow ? 0.05 : 1, pop: 0 };
    mesh.position.set(p.x, p.y, p.z);
    mesh.scale.setScalar(p.scale);
    this.scene.add(mesh);
    this.pieces[i] = p;
    return p;
  }

  _removePiece(i) {
    const p = this.pieces[i];
    if (!p) return;
    this.scene.remove(p.mesh);
    // las texturas se comparten entre piezas: solo se liberan geometrías y materiales
    p.mesh.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    this.pieces[i] = null;
  }

  /** Deja las piezas 3D iguales al tablero guardado (y crea o quita lo que falte). */
  _resync() {
    const m = mergeOf(this.progress);
    for (let i = 0; i < CELLS; i++) {
      const code = m.grid[i];
      const p = this.pieces[i];
      if (!code) { if (p) this._removePiece(i); continue; }
      if (!p) this._addPiece(i, code);
      else if (p.code !== code) { this._removePiece(i); this._addPiece(i, code, { grow: false }); this.pieces[i].pop = 0.35; }
    }
  }

  // ---------- partida ----------

  reset() {
    for (let i = 0; i < CELLS; i++) this._removePiece(i);
    this.drag = null;
    this.sessionMerges = 0;
    const m = mergeOf(this.progress);
    this.score = foundCount(m) * 100 + m.delivered;
    this._resync();
    for (const p of this.pieces) if (p) { p.scale = 1; p.mesh.scale.setScalar(1); }
    this._bindBar();
    this._renderGens();
    this._updateHud();
    this._renderChain();
    this._renderOrders();
  }

  onBegin() {
    this._updateHud();
    this._renderOrders();
    const m = mergeOf(this.progress);
    if (m.spawned === 0 && m.merges === 0) this.banner("👆 Junta dos productos iguales");
  }

  _renderGens() {
    const box = this.q("gens");
    if (!box || box.dataset.ready) return;
    box.dataset.ready = "1";
    box.innerHTML = CHAINS.map((c, i) => `<button type="button" class="mg-gen" data-gen="${i}" title="Sacar ${c.short} nuevo"><img src="${this._urlOf(codeOf(i, 1))}" alt=""><span>${c.short}</span><small>-1 ⚡</small></button>`).join("");
  }

  _bindBar() {
    if (this._barBound) return;
    this._barBound = true;
    const gens = this.q("gens");
    if (gens) gens.addEventListener("click", (e) => {
      const b = e.target.closest("[data-gen]");
      if (b) this.spawn(Number(b.dataset.gen));
    });
    this.q("btn-hint")?.addEventListener("click", () => this._giveHint());
    const orders = this.q("orders");
    if (orders) orders.addEventListener("click", (e) => {
      const b = e.target.closest("[data-order]");
      if (b) this.deliver(Number(b.dataset.order));
    });
  }

  /** 💡 Pista: marca con aros verdes dos piezas iguales que se pueden juntar. */
  _giveHint() {
    if (this.state !== "playing") return;
    const m = mergeOf(this.progress);
    const seen = new Map();
    for (let i = 0; i < CELLS; i++) {
      const code = m.grid[i];
      if (!code || tierIdx(code) >= maxTier(chainIdx(code))) continue;
      if (seen.has(code)) {
        this.hint = { cells: [seen.get(code), i], t: 4 };
        this.banner("💡 ¡Junta estas dos!");
        audio.playPop();
        return;
      }
      seen.set(code, i);
    }
    this.banner(emptyCells(m).length ? "💡 No hay pares: saca un producto nuevo abajo 👇" : "💡 No hay pares: entrega un pedido para hacer espacio");
    audio.playBump();
  }

  spawn(c) {
    if (this.state !== "playing") return;
    const m = mergeOf(this.progress);
    if (!emptyCells(m).length) { this.banner("📦 ¡Tablero lleno! Junta productos o entrega pedidos"); audio.playBump(); return; }
    if (!this.spendAction(1)) return; // cada producto nuevo gasta 1 ⚡
    const r = spawnPiece(this.progress, c);
    if (!r) return;
    this._addPiece(r.cell, r.code, { from: { x: (c - 1.5) * CELL * 1.3, z: ROWS * CELL * 0.5 + 1.6 } });
    audio.playPop();
    this._updateHud();
    this._renderOrders();
  }

  deliver(idx) {
    if (this.state !== "playing") return;
    const m = mergeOf(this.progress);
    const o = m.orders[idx];
    if (!o) return;
    const info = itemInfo(codeOf(o.c, o.t));
    const done = deliverOrder(this.progress, idx);
    if (!done) { this.banner(`Aún no tienes ${info.name} en el tablero`); audio.playBump(); return; }
    const p = this.pieces[done.cell];
    if (p) this.particles.burst(new THREE.Vector3(p.x, 0.5, p.z), [0xffd36a, 0xff7ab8, 0xffffff], 18, 4, 0.8, 6);
    this._removePiece(done.cell);
    this.popups.add(new THREE.Vector3(0, 1.2, -ROWS * CELL * 0.5 + 0.4), `+${done.coins} 🍫✨${done.pack ? " 🎴" : ""}`, "combo");
    audio.playPurchase();
    this.haptic(25);
    this.score = foundCount(m) * 100 + m.delivered;
    this._updateHud();
    this._renderOrders();
  }

  _afterMerge(res) {
    const m = mergeOf(this.progress);
    const to = res.to;
    const info = itemInfo(res.code);
    this._removePiece(res.from);
    this._removePiece(to);
    const p = this._addPiece(to, res.code, { grow: false });
    p.pop = 0.4;
    this.particles.burst(new THREE.Vector3(cellX(to), 0.5, cellZ(to)), [info.chain.color, 0xffffff, 0xffd36a], 12 + res.tier * 2, 3.5, 0.7, 5);
    audio.playCombo?.(Math.min(6, res.tier));
    this.haptic(20);
    this.sessionMerges++;
    if (res.gift != null && !this.pieces[res.gift]) {
      this._addPiece(res.gift, m.grid[res.gift]);
      this.popups.add(new THREE.Vector3(cellX(res.gift), 1, cellZ(res.gift)), "🎁 ¡Regalo!", "combo");
    }
    if (res.record) {
      this.banner(res.dubai ? "👑 ¡¡LLEGASTE AL MATI DUBAI!! +1000 🍫✨ y 3 sobres" : `🎉 ¡Nuevo producto: ${info.name}! +${res.coins} 🍫✨`);
      audio.playMissionComplete();
      this.particles.burst(new THREE.Vector3(cellX(to), 1, cellZ(to)), [0xffd36a, 0xff7ab8, 0x7ad8ff, 0xffffff], res.dubai ? 90 : 40, 6, 1.2, 4, 1.3);
      this._renderChain();
    }
    this.score = foundCount(m) * 100 + m.delivered;
    this._updateHud();
    this._renderOrders();
  }

  // ---------- entrada ----------

  async init() {
    const first = !this.ready;
    await super.init();
    if (first) this._bindInput();
  }

  _hit(e) {
    const r = this.els.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.plane, hit)) return null;
    const c = Math.round(hit.x / CELL + (COLS - 1) / 2);
    const rr = Math.round(hit.z / CELL + (ROWS - 1) / 2);
    const inside = c >= 0 && c < COLS && rr >= 0 && rr < ROWS;
    return { x: hit.x, z: hit.z, cell: inside ? rr * COLS + c : -1 };
  }

  _bindInput() {
    const wrap = this.els.wrap;
    wrap.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button, .overlay, .mg-bar") || this.state !== "playing" || this.drag) return;
      const h = this._hit(e);
      if (!h || h.cell < 0 || !this.pieces[h.cell]) return;
      this.drag = { id: e.pointerId, from: h.cell, x0: h.x, z0: h.z, moved: false };
      wrap.setPointerCapture?.(e.pointerId);
      audio.playPop();
    });
    wrap.addEventListener("pointermove", (e) => {
      const d = this.drag;
      if (!d || e.pointerId !== d.id) return;
      const h = this._hit(e);
      if (!h) return;
      if (Math.hypot(h.x - d.x0, h.z - d.z0) > CELL * 0.25) d.moved = true;
      d.x = h.x; d.z = h.z; d.over = h.cell;
    });
    const end = (e) => {
      const d = this.drag;
      if (!d || e.pointerId !== d.id) return;
      this.drag = null;
      const h = this._hit(e);
      const to = h ? h.cell : -1;
      const p = this.pieces[d.from];
      if (!d.moved || to === d.from || to < 0) {
        if (!d.moved && p) this._tip(p.code);
        return;
      }
      const res = dropPiece(this.progress, d.from, to);
      if (res.kind === "move") {
        this.pieces[to] = this.pieces[d.from]; this.pieces[d.from] = null;
        audio.playBump();
      } else if (res.kind === "swap") {
        const a = this.pieces[d.from]; this.pieces[d.from] = this.pieces[to]; this.pieces[to] = a;
        audio.playBump();
      } else if (res.kind === "merge") this._afterMerge(res);
      this._updateHud();
      this._renderOrders();
    };
    wrap.addEventListener("pointerup", end);
    wrap.addEventListener("pointercancel", end);
  }

  _tip(code) {
    const info = itemInfo(code);
    this.banner(info.top ? `👑 ¡${info.name}! El chocolate más preciado` : `${info.chain.icon} ${info.name} · nivel ${info.t} de ${info.max}`);
  }

  // ---------- interfaz ----------

  _updateHud() {
    const m = mergeOf(this.progress);
    const set = (id, v) => { const el = this.q(id); if (el) el.textContent = v; };
    set("hud-best", `${foundCount(m)}/${TOTAL_ITEMS}`);
    set("hud-coins", this.progress.coins);
    set("hud-free", emptyCells(m).length);
    set("hud-name", m.dubai ? "¡Tienes el Mati Dubai! 👑" : `Tabletas: nivel ${m.bests[DUBAI.c]}/${maxTier(DUBAI.c)}`);
    this.q("gens")?.classList.toggle("full", emptyCells(m).length === 0);
  }

  _renderOrders() {
    const box = this.q("orders");
    if (!box) return;
    const m = mergeOf(this.progress);
    box.innerHTML = m.orders.map((o, i) => {
      const code = codeOf(o.c, o.t);
      const info = itemInfo(code);
      return `<button type="button" class="mg-order${canDeliver(m, i) ? " ready" : ""}" data-order="${i}" title="${info.name}"><img src="${this._urlOf(code)}" alt=""><em>${info.name}</em><span>🍫✨${o.coins}</span></button>`;
    }).join("");
  }

  _renderChain() {
    const box = this.q("chain");
    if (!box) return;
    const m = mergeOf(this.progress);
    box.innerHTML = CHAINS.map((c, ci) => {
      const steps = c.tiers.map((t, ti) => {
        const got = ti + 1 <= m.bests[ci];
        return `<span class="mg-step${got ? " got" : ""}${t.top ? " top" : ""}" title="${got ? t.name : "???"}">${got ? `<img src="${this._urlOf(codeOf(ci, ti + 1))}" alt="">` : "?"}</span>`;
      }).join("");
      return `<div class="mg-row"><b>${c.icon} ${c.name}</b><div class="mg-steps">${steps}</div></div>`;
    }).join("");
    const next = this.q("next-goal");
    if (next) next.textContent = m.dubai ? "¡Lo lograste! Tienes el ¡Mati Dubai! 👑" : `Meta: llegar al ¡Mati Dubai! (el nivel ${maxTier(DUBAI.c)} de las Tabletas). Vas en el ${m.bests[DUBAI.c]}.`;
  }

  onResize() { this._fit(); }

  _fit() {
    if (!this.camera) return;
    const aspect = this.camera.aspect;
    const vf = (this.camera.fov * Math.PI) / 180;
    const wide = aspect > 1.25; // en celular acostado, el tablero va a la izquierda y la barra a la derecha
    const needH = (ROWS * CELL * (wide ? 1.02 : 0.92) + (wide ? 1.3 : 5.2)) / 2;
    const needW = (COLS * CELL + 0.9) / 2 / (wide ? aspect * 0.66 : aspect);
    const half = Math.max(needH, needW);
    const dist = half / Math.tan(vf / 2);
    const tilt = 0.26; // casi desde arriba: se ve el tablero entero sin que se achique al fondo
    const shift = wide ? dist * Math.tan(vf / 2) * aspect * 0.34 : 0;
    this.camBase = new THREE.Vector3(shift, Math.cos(tilt) * dist, Math.sin(tilt) * dist + 0.3);
    this.camera.position.copy(this.camBase);
    this.camLook = new THREE.Vector3(shift, 0, wide ? -0.1 : 2.4); // en vertical el tablero sube para dejar sitio a los botones de abajo
    this.camera.lookAt(this.camLook);
  }

  // ---------- cada cuadro ----------

  update(dt) {
    for (let i = 0; i < CELLS; i++) {
      const p = this.pieces[i];
      if (!p) continue;
      const dragging = this.drag && this.drag.from === i && this.drag.moved;
      let tx = cellX(i);
      let tz = cellZ(i);
      let ty = 0;
      if (dragging && this.drag.x != null) { tx = this.drag.x; tz = this.drag.z; ty = 0.7; }
      const k = 1 - Math.pow(0.0005, dt);
      p.x = lerp(p.x, tx, dragging ? 0.55 : k);
      p.z = lerp(p.z, tz, dragging ? 0.55 : k);
      p.y = lerp(p.y, ty, k);
      p.scale = lerp(p.scale, 1, 1 - Math.pow(0.002, dt));
      if (p.pop > 0) p.pop -= dt;
      const bounce = p.pop > 0 ? 1 + Math.sin((p.pop / 0.4) * Math.PI) * 0.22 : 1;
      p.mesh.position.set(p.x, p.y, p.z); // los dorados quedan quietos (antes subían y bajaban y se veían parpadeando)
      p.mesh.scale.setScalar(p.scale * bounce);
    }
    const d = this.drag;
    if (d && d.moved && d.over != null && d.over >= 0) {
      this.sel.visible = true;
      this.sel.position.set(cellX(d.over), 0.22, cellZ(d.over));
      const a = this.pieces[d.from];
      const b = this.pieces[d.over];
      const same = a && b && a.code === b.code && d.over !== d.from && tierIdx(a.code) < maxTier(chainIdx(a.code));
      this.sel.material.color.setHex(same ? 0x7be08a : 0xff7ab8);
      this.sel.scale.setScalar(1 + Math.sin(this.time * 9) * 0.06);
    } else this.sel.visible = false;
    this._updateRings(dt);
    if (this.camBase) this.camera.lookAt(this.camLook);
  }

  /** Aros verdes: al arrastrar una pieza, las otras iguales (con las que se puede juntar); o las dos de la pista. */
  _updateRings(dt) {
    let cells = [];
    const d = this.drag;
    if (d && d.moved && this.pieces[d.from]) {
      const code = this.pieces[d.from].code;
      if (tierIdx(code) < maxTier(chainIdx(code))) for (let i = 0; i < CELLS; i++) if (i !== d.from && this.pieces[i] && this.pieces[i].code === code) cells.push(i);
    } else if (this.hint.t > 0) {
      this.hint.t -= dt;
      cells = this.hint.cells.filter((i) => this.pieces[i]);
    }
    while (this.rings.length < cells.length) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.07, 8, 32), new THREE.MeshBasicMaterial({ color: 0x4be06a }));
      r.rotation.x = Math.PI / 2;
      this.scene.add(r);
      this.rings.push(r);
    }
    const pulse = 1 + Math.sin(this.time * 8) * 0.08;
    this.rings.forEach((r, k) => {
      const i = cells[k];
      r.visible = i != null;
      if (i == null) return;
      r.position.set(cellX(i), 0.24, cellZ(i));
      r.scale.setScalar(pulse);
    });
  }

  pauseForMenu() {
    this.drag = null;
    this.hint.t = 0;
    // jugar un rato cuenta como una partida para las misiones y la experiencia
    if (this.sessionMerges >= 3 && this.progress) {
      try { recordRun(this.progress, GAME_ID, this.score || 0, {}); } catch (e) { /* no debe romper la salida */ }
    }
    this.sessionMerges = 0;
    super.pauseForMenu();
  }
}
