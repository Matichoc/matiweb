// Mati Merge 3D: tablero lleno de productos Matichoc de 4 familias (alfajores, cuchuflís, bombones y tabletas).
// Arrastra un producto sobre otro IGUAL y se transforma en el siguiente de su familia, del más chiquito al más grande, hasta el
// ¡Mati Dubai! Los 4 generadores sacan productos nuevos (1 ⚡ cada uno) y los clientes piden productos para entregar.
// El tablero se guarda en tu perfil.

import { THREE, Game3D, lerp, roundedBox, makeBunting, makeLogo } from "./three-kit.js?v=6d55b24c3a";
import * as audio from "./audio.js?v=6d55b24c3a";
import { recordRun } from "./progression.js?v=6d55b24c3a";
import { saveProgress } from "./storage.js?v=6d55b24c3a";
import { addStars } from "./adventure.js?v=6d55b24c3a";
import { COLS, ROWS, CELLS, CHAINS, TOTAL_ITEMS, DUBAI, itemInfo, chainIdx, tierIdx, codeOf, maxTier, foundCount, mergeOf, spawnPiece, dropPiece, deliverOrder, canDeliver, orderHave, emptyCells } from "./merge-data.js?v=6d55b24c3a";
import { drawItem } from "./merge-art.js?v=6d55b24c3a";
import { makeItemMesh } from "./merge-models.js?v=6d55b24c3a";
import { paintNeighbor } from "./neighbors.js?v=6d55b24c3a";

const GAME_ID = "merge";
const CELL = 1.1;
const cellX = (i) => ((i % COLS) - (COLS - 1) / 2) * CELL;
const cellZ = (i) => (Math.floor(i / COLS) - (ROWS - 1) / 2) * CELL;
const BASE = 0.15; // altura de los casilleros (donde se apoyan los productos)

export class MergeGame extends Game3D {
  constructor(character, progress, els) {
    // en celulares, sin brillo (bloom): es una pasada de pantalla completa cara para una GPU modesta
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    super(GAME_ID, character, progress, els, coarse ? { fov: 40, bloom: false } : { fov: 40 });
    this.kawaii = true;
    this.ambientOpts = { petals: 18, hearts: 7, stars: 10, radius: 9, height: 9 };
    this.musicTheme = "chill";
    this.q = els.q;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(BASE + 0.15));
    this.pieces = new Array(CELLS).fill(null);
    this.urlCache = new Map();
    this.drag = null;
    this.hint = { cells: [], t: 0 }; // pista: las dos piezas que se pueden juntar
    this.rings = []; // aros verdes que marcan con quién se puede juntar la pieza
    this.sessionMerges = 0;
    this.onNoEnergy = () => this.banner("😴 Sin energía: ¡puedes seguir juntando y entregando, pero no sacar productos nuevos!");
  }

  // ---------- escena ----------

  async build() {
    const s = this.scene;
    s.background = new THREE.Color(0xf6d6e6);
    s.fog = new THREE.Fog(0xf6d6e6, 22, 46);
    s.add(new THREE.HemisphereLight(0xfff4fa, 0xb98aa8, 1.45));
    const sun = new THREE.DirectionalLight(0xfff3e0, 1.9);
    sun.position.set(-4, 12, 7);
    s.add(sun);
    const std = (color, roughness = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), std(0xe7b9d2, 0.95));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.6;
    s.add(floor);
    // bandeja de madera (como la caja de una chocolatería) con casilleros acolchados rosados
    const W = COLS * CELL;
    const D = ROWS * CELL;
    const wood = std(0xb5743f, 0.55);
    const base = new THREE.Mesh(roundedBox(W + 1.0, 0.5, D + 1.0, 0.36, 0.1), wood);
    base.position.y = -0.17;
    s.add(base);
    const inner = new THREE.Mesh(roundedBox(W + 0.3, 0.12, D + 0.3, 0.22, 0.04), std(0xf4b8d2, 0.8));
    inner.position.y = 0.06;
    s.add(inner);
    const tiles = new THREE.InstancedMesh(roundedBox(CELL * 0.95, 0.07, CELL * 0.95, 0.3, 0.03), std(0xffffff, 0.75), CELLS);
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < CELLS; i++) {
      o.position.set(cellX(i), BASE - 0.035, cellZ(i));
      o.updateMatrix();
      tiles.setMatrixAt(i, o.matrix);
      tiles.setColorAt(i, col.setHex((Math.floor(i / COLS) + (i % COLS)) % 2 ? 0xffdcec : 0xfff4f8));
    }
    s.add(tiles);
    // sombras redondas bajo los productos: una sola pieza para todas (un solo dibujo)
    const blobGeo = new THREE.CircleGeometry(0.42, 20);
    blobGeo.rotateX(-Math.PI / 2);
    this.blobs = new THREE.InstancedMesh(blobGeo, new THREE.MeshBasicMaterial({ color: 0x5a1a3a, transparent: true, opacity: 0.22, depthWrite: false }), CELLS);
    this.blobs.renderOrder = 2;
    this.blobs.frustumCulled = false;
    this.blobs.userData.noToon = true;
    s.add(this.blobs);
    this._blobO = o;
    // pared de la tienda con repisas de frascos, el logo y banderines
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 24), std(0xfbe4ef, 0.95));
    wall.position.set(0, 9, -12);
    s.add(wall);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(30, 0.25, 1.2), wood);
    shelf.position.set(0, 2.2, -11.4);
    s.add(shelf);
    const jarCols = [0xff7ab8, 0xffd23a, 0x7fe0b0, 0xff9a3c, 0x9a7cff, 0x4ab8ff];
    const jarGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 14);
    const jars = new THREE.InstancedMesh(jarGeo, std(0xffffff, 0.25), 16);
    for (let i = 0; i < 16; i++) {
      o.position.set(-13.5 + i * 1.8, 2.95, -11.3);
      o.updateMatrix();
      jars.setMatrixAt(i, o.matrix);
      jars.setColorAt(i, col.setHex(jarCols[i % jarCols.length]));
    }
    s.add(jars);
    const logo = makeLogo(4.4);
    logo.position.set(0, 6.6, -11.8);
    s.add(logo);
    s.add(makeBunting(new THREE.Vector3(-13, 9.6, -11), new THREE.Vector3(13, 9.6, -11), { count: 26, sag: 1.4, size: 0.5 }));
    this.sel = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 28), new THREE.MeshBasicMaterial({ color: 0xff7ab8 }));
    this.sel.rotation.x = Math.PI / 2;
    this.sel.visible = false;
    s.add(this.sel);
    try { this._thumb = (await import("./thumb3d.js?v=6d55b24c3a")).renderObjectThumb; } catch (e) { /* quedan los dibujos 2D */ }
  }

  /**
   * Imagen del producto para la interfaz (pedidos, generadores y lista de productos): el mismo modelo 3D del tablero,
   * dibujado una vez. Si no hay WebGL, queda el dibujo 2D.
   */
  _urlOf(code) {
    let u = this.urlCache.get(code);
    if (u) return u;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    try {
      if (!this._thumb) throw new Error("sin retratos 3D");
      const mesh = makeItemMesh(code);
      this._thumb(c, mesh, { size: mesh.userData.w, y: mesh.userData.h * 0.45 });
    } catch (e) {
      c.width = c.height = 256;
      drawItem(c, itemInfo(code));
    }
    u = c.toDataURL("image/png");
    this.urlCache.set(code, u);
    return u;
  }

  _makePiece(code) {
    return makeItemMesh(code);
  }

  _addPiece(i, code, { from = null, grow = true } = {}) {
    const mesh = this._makePiece(code);
    const p = { code, mesh, x: from ? from.x : cellX(i), z: from ? from.z : cellZ(i), y: from ? 0.6 : 0, scale: grow ? 0.05 : 1, pop: 0 };
    mesh.position.set(p.x, BASE + p.y, p.z);
    mesh.scale.setScalar(p.scale);
    this.scene.add(mesh);
    this.pieces[i] = p;
    return p;
  }

  _removePiece(i) {
    const p = this.pieces[i];
    if (!p) return;
    this.scene.remove(p.mesh); // las geometrías y materiales se comparten entre productos iguales: no se liberan
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
      else if (p.code !== code) { this._removePiece(i); this._addPiece(i, code, { grow: false }); this.pieces[i].pop = 0.45; }
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
    this._fit();
  }

  onBegin() {
    this._updateHud();
    this._renderOrders();
    this._fit();
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
    const done = deliverOrder(this.progress, idx);
    if (!done) {
      const have = orderHave(m, o);
      const miss = o.items.filter((_, k) => !have[k]).map((it) => itemInfo(codeOf(it.c, it.t)).name);
      this.banner(`${o.who} todavía espera: ${miss.join(" y ")}`);
      audio.playBump();
      return;
    }
    for (const cell of done.cells) {
      const p = this.pieces[cell];
      if (p) this.particles.burst(new THREE.Vector3(p.x, 0.5, p.z), [0xffd36a, 0xff7ab8, 0xffffff], 18, 4, 0.8, 6);
      this._removePiece(cell);
    }
    const star = addStars(this.progress, 1); // cada pedido entregado también da ⭐ para renovar el Pueblo
    saveProgress(this.progress);
    this.popups.add(new THREE.Vector3(0, 1.2, -ROWS * CELL * 0.5 + 0.4), `¡Gracias! +${done.coins} 🍫✨ +${star} ⭐${done.pack ? " 🎴" : ""}`, "combo");
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
    p.pop = 0.45;
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

  _hit(e, onPieces = false) {
    const r = this.els.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (onPieces) {
      // al tocar, primero se busca el producto mismo (los altos tapan un poco el casillero de atrás)
      const meshes = this.pieces.filter(Boolean).map((p) => p.mesh);
      const hit = this.raycaster.intersectObjects(meshes, true)[0];
      if (hit) {
        let root = hit.object;
        while (root.parent && !meshes.includes(root)) root = root.parent;
        const cell = this.pieces.findIndex((p) => p && p.mesh === root);
        if (cell >= 0) return { x: cellX(cell), z: cellZ(cell), cell };
      }
    }
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
      const h = this._hit(e, true);
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
      const ready = canDeliver(m, i);
      const have = orderHave(m, o);
      const names = o.items.map((it) => itemInfo(codeOf(it.c, it.t)).name);
      const imgs = o.items.map((it, k) => `<i class="${have[k] ? "ok" : ""}"><img src="${this._urlOf(codeOf(it.c, it.t))}" alt=""></i>`).join("");
      const label = `${o.who} quiere ${names.join(" y ")} ${o.why}${ready ? ". Toca para entregar" : ""}`;
      return `<button type="button" class="mg-order${ready ? " ready" : ""}${o.items.length > 1 ? " two" : ""}" data-order="${i}" title="${label}" aria-label="${label}"><span class="mg-face" data-face="${i}"></span><span class="mg-bub"><span class="mg-imgs">${imgs}</span><em>${o.items.length > 1 ? `${names[0]} + 1` : names[0]}</em><b>${ready ? "¡Entregar!" : `🍫✨${o.coins}`}</b></span></button>`;
    }).join("");
    box.querySelectorAll("[data-face]").forEach((el) => { const i = Number(el.dataset.face); el.appendChild(this._faceCanvas(i, m.orders[i].who)); });
  }

  /** La cara del cliente de un pedido: un canvas por casillero, que se vuelve a pintar solo si cambia el vecino. */
  _faceCanvas(slot, name) {
    this.faces = this.faces || [];
    let c = this.faces[slot];
    if (!c) { c = this.faces[slot] = document.createElement("canvas"); c.width = c.height = 96; }
    if (c.dataset.name !== name) { c.dataset.name = name; paintNeighbor(c, name); }
    return c;
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

  /**
   * Cámara: mira la bandeja desde arriba y un poco de frente (como Choco Match) y la encuadra en el espacio que deja la
   * barra de pedidos y generadores (abajo con el celular de pie, a la derecha con el celular acostado).
   */
  _fit() {
    const cam = this.camera;
    if (!cam) return;
    const aspect = cam.aspect;
    const wide = aspect > 1.25;
    const tilt = 0.6;
    const wrap = this.els.wrap;
    const bar = wrap && wrap.querySelector(".mg-bar");
    const W = Math.max(1, wrap ? wrap.clientWidth : 1);
    const H = Math.max(1, wrap ? wrap.clientHeight : 1);
    const box = { x0: -0.96, x1: 0.96, y0: -0.96, y1: 0.9 };
    if (bar && bar.offsetHeight) {
      if (wide) box.x1 = Math.min(0.5, 1 - (2 * (bar.offsetWidth + 14)) / W);
      else box.y0 = Math.min(0, -1 + (2 * (bar.offsetHeight + 10)) / H);
    }
    const hw = (COLS * CELL) / 2 + 0.35;
    const hd = (ROWS * CELL) / 2 + 0.4;
    const pts = [];
    for (const x of [-hw, hw]) for (const z of [-hd, hd]) for (const y of [-0.2, 0.9]) pts.push(new THREE.Vector3(x, y, z));
    const v = new THREE.Vector3();
    const look = new THREE.Vector3();
    const bw = box.x1 - box.x0;
    const bh = box.y1 - box.y0;
    cam.clearViewOffset();
    const measure = (t, dist) => {
      cam.position.set(0, Math.cos(t) * dist, Math.sin(t) * dist);
      cam.lookAt(look);
      cam.updateMatrixWorld();
      const b = { x0: 9, x1: -9, y0: 9, y1: -9 };
      for (const p of pts) {
        v.copy(p).project(cam);
        b.x0 = Math.min(b.x0, v.x); b.x1 = Math.max(b.x1, v.x); b.y0 = Math.min(b.y0, v.y); b.y1 = Math.max(b.y1, v.y);
      }
      return b;
    };
    const fitAt = (t) => {
      let dist = 20;
      for (let it = 0; it < 4; it++) {
        const b = measure(t, dist);
        dist *= Math.max((b.x1 - b.x0) / bw, (b.y1 - b.y0) / bh);
      }
      const b = measure(t, dist);
      return { t, dist, b, tall: (b.y1 - b.y0) / bh / ((b.x1 - b.x0) / bw) };
    };
    // de pie, el tablero queda limitado por el ancho: se usa la vista más de frente que igual llene el alto disponible
    let f = fitAt(tilt);
    if (!wide) for (let t = 0.65; t >= 0.35; t -= 0.05) { f = fitAt(t); if (f.tall >= 0.93) break; }
    else f = fitAt(0.55);
    const b = measure(f.t, f.dist);
    // se corre la imagen (no la cámara) para que el tablero quede derecho, sin verse torcido
    const dx = (box.x0 + box.x1) / 2 - (b.x0 + b.x1) / 2;
    const dy = (box.y0 + box.y1) / 2 - (b.y0 + b.y1) / 2;
    cam.setViewOffset(W, H, (-dx * W) / 2, (dy * H) / 2, W, H);
    this.camBase = cam.position.clone();
    this.camLook = look.clone();
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
      if (p.pop > 0) p.pop = Math.max(0, p.pop - dt);
      // al juntar: salta, se estira y se aplasta como gelatina (los dorados quedan quietos el resto del tiempo)
      const ph = p.pop > 0 ? 1 - p.pop / 0.45 : 1;
      const jump = p.pop > 0 ? Math.sin(ph * Math.PI) * 0.45 : 0;
      const sq = p.pop > 0 ? Math.sin(ph * Math.PI * 2.5) * 0.2 * (1 - ph) : 0;
      const big = p.pop > 0 ? 1 + Math.sin(ph * Math.PI) * 0.18 : 1;
      p.mesh.position.set(p.x, BASE + p.y + jump, p.z);
      p.mesh.scale.set(p.scale * big * (1 - sq * 0.5), p.scale * big * (1 + sq), p.scale * big * (1 - sq * 0.5));
    }
    this._updateBlobs();
    const d = this.drag;
    if (d && d.moved && d.over != null && d.over >= 0) {
      this.sel.visible = true;
      this.sel.position.set(cellX(d.over), BASE + 0.04, cellZ(d.over));
      const a = this.pieces[d.from];
      const b = this.pieces[d.over];
      const same = a && b && a.code === b.code && d.over !== d.from && tierIdx(a.code) < maxTier(chainIdx(a.code));
      this.sel.material.color.setHex(same ? 0x7be08a : 0xff7ab8);
      this.sel.scale.setScalar(1 + Math.sin(this.time * 9) * 0.06);
    } else this.sel.visible = false;
    this._updateRings(dt);
    if (this.camBase) this.camera.lookAt(this.camLook);
  }

  /** Sombras redondas bajo cada producto (se achican cuando el producto sube). */
  _updateBlobs() {
    if (!this.blobs) return;
    const o = this._blobO;
    let n = 0;
    for (const p of this.pieces) {
      if (!p) continue;
      const k = p.scale * Math.max(0.35, 1 - (p.mesh.position.y - BASE) * 0.6);
      o.position.set(p.x, BASE + 0.008, p.z);
      o.scale.set(k, 1, k);
      o.rotation.set(0, 0, 0);
      o.updateMatrix();
      this.blobs.setMatrixAt(n++, o.matrix);
    }
    this.blobs.count = n;
    this.blobs.instanceMatrix.needsUpdate = true;
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
      r.position.set(cellX(i), BASE + 0.05, cellZ(i));
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
