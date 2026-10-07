// Crea tu Chocolate: configurador con vista 3D en vivo. Se elige producto,
// chocolate, sabor, toppings, envoltorio y etiqueta; el juego puntúa los
// maridajes, guarda las creaciones en el perfil y permite pedir algo parecido
// por WhatsApp (solo un mensaje, sin precios ni promesas).

import { THREE, Game3D, clamp, lerp, canvasTexture, makeBunting } from "./three-kit.js";
import { createMatichico } from "./matichico3d.js";
import { saveProgress, earnCoins, reportScore, addToLeaderboard, saveCreation, deleteCreation, todayKey } from "./storage.js";
import * as audio from "./audio.js";
import {
  PRODUCTS, CHOCOLATES, FLAVORS, TOPPINGS, WRAPS, WRAP_COLORS, MOTIFS, STEPS,
  defaultCreation, sanitize, scoreCreation, comboKey, dailyChallenge, matchesChallenge,
  describeChallenge, describeCreation, whatsappUrl, drawLabel, getProduct, getFlavor,
} from "./creador-data.js";
import { buildCreation } from "./creador-3d.js";

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

function disposeTree(obj) {
  obj.traverse((m) => {
    if (m.geometry) m.geometry.dispose();
    if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
  });
}

export class CreadorGame extends Game3D {
  constructor(character, progress, els) {
    super("creador", character, progress, els, { fov: 34 });
    this.cfg = defaultCreation();
    this.step = 0;
    this.view = "wizard"; // wizard | result | gallery
    this.userYaw = 0;
    this.touched = false;
    this.spin = 0;
    this.result = null;
  }

  get challenge() {
    return dailyChallenge(todayKey());
  }

  get challengeClaimed() {
    return this.progress.creatorChallengeDate === todayKey();
  }

  // ---------- escena ----------

  async build() {
    try {
      await Promise.all([document.fonts.load('40px "Baby Chipmunk"'), document.fonts.load('30px "Adorable Mother Script"')]);
    } catch (e) { /* tipografía de reserva */ }
    this.logoImg = await new Promise((res) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => res(null);
      i.src = "assets/brand/logo-horizontal.png";
    });

    const s = this.scene;
    s.background = new THREE.Color(0xffe6d2);
    const std = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r });

    this.hemi = new THREE.HemisphereLight(0xfff4e8, 0xe7b9a2, 1.25);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
    this.sun.position.set(-6, 12, 9);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.coarse ? 1024 : 2048, this.coarse ? 1024 : 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -7; sc.right = 7; sc.top = 8; sc.bottom = -5; sc.near = 1; sc.far = 40;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.04;
    s.add(this.sun);
    this.onLowQuality = () => { this.sun.castShadow = false; };

    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 36),
      new THREE.MeshBasicMaterial({
        map: canvasTexture(256, 256, (g, w, h) => {
          const grd = g.createRadialGradient(w / 2, h * 0.55, 10, w / 2, h * 0.55, w * 0.75);
          grd.addColorStop(0, "#fff7ec");
          grd.addColorStop(0.55, "#ffd9cf");
          grd.addColorStop(1, "#e98fb4");
          g.fillStyle = grd;
          g.fillRect(0, 0, w, h);
        }),
      })
    );
    back.position.set(0, 6, -12);
    s.add(back);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), std(0xf4d3b5, 0.95));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.62;
    floor.receiveShadow = true;
    s.add(floor);
    s.add(makeBunting(new THREE.Vector3(-13, 10.5, -9), new THREE.Vector3(13, 10.5, -9), { count: 24, sag: 1.4, size: 0.5 }));

    const ped = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 0.62, 48), std(0x8a5a36, 0.6));
    ped.position.y = -0.31;
    ped.castShadow = true;
    ped.receiveShadow = true;
    const cloth = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.05, 48), std(0xf3dcc0, 0.7));
    cloth.position.y = 0.01;
    cloth.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.05, 8, 60), new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.25, metalness: 0.6 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.04;
    s.add(ped, cloth, ring);

    this.holder = new THREE.Group();
    s.add(this.holder);

    this.labelCanvas = document.createElement("canvas");
    this.labelCanvas.width = this.labelCanvas.height = 512;
    this.labelTex = new THREE.CanvasTexture(this.labelCanvas);
    this.labelTex.colorSpace = THREE.SRGBColorSpace;
    this.labelTex.anisotropy = 4;

    this.mascotRoot = new THREE.Group();
    s.add(this.mascotRoot);
    this._ensureMascot();
  }

  _ensureMascot() {
    if (this.mascot && this.mascotId === this.character.id) {
      this.mascot.setOutfit(this.outfit);
      return;
    }
    if (this.mascot) this.mascotRoot.remove(this.mascot.group);
    this.mascot = createMatichico(this.character, this.outfit);
    this.mascotId = this.character.id;
    this.mascot.group.scale.setScalar(1.1);
    this.mascot.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.mascotRoot.add(this.mascot.group);
  }

  async init() {
    await super.init();
    if (this._dragBound) return;
    this._dragBound = true;
    const wrap = this.els.wrap;
    let drag = null;
    wrap.addEventListener("pointerdown", (e) => { if (e.target.closest("button, .overlay, .cr-drag-hint")) return; drag = { x: e.clientX }; wrap.setPointerCapture?.(e.pointerId); });
    wrap.addEventListener("pointermove", (e) => {
      if (!drag) return;
      this.userYaw += (e.clientX - drag.x) * 0.012;
      drag.x = e.clientX;
      this.touched = true;
    });
    const end = () => { drag = null; };
    wrap.addEventListener("pointerup", end);
    wrap.addEventListener("pointercancel", end);
  }

  // ---------- partida ----------

  reset() {
    this.cfg = defaultCreation();
    this.step = 0;
    this.view = "wizard";
    this.userYaw = 0;
    this.touched = false;
    this.spin = 0;
    this.result = null;
    this.score = this.progress.bestScores.creador || 0;
    this._ensureMascot();
    this.mascotMode = "idle";
    this.mascotTimer = 0;
    this._rebuild(false);
    this._renderPanel();
    this._updateHud();
  }

  onBegin() {
    this.mascotMode = "cheer";
    this.mascotTimer = 1.2;
  }

  retry() {
    this.reset();
    this.beginPlaying();
  }

  pauseForMenu() {
    this.running = false;
    this.state = "paused";
  }

  // ---------- 3D ----------

  _rebuild(burst = true) {
    drawLabel(this.labelCanvas, this.cfg, this.logoImg);
    this.labelTex.needsUpdate = true;
    if (this.creation) {
      this.holder.remove(this.creation.group);
      disposeTree(this.creation.group);
    }
    this.creation = buildCreation(this.cfg, this.labelTex);
    this.holder.add(this.creation.group);
    this._frame();
    if (burst && this.particles) {
      this.particles.burst(new THREE.Vector3(0, this.creation.height * 0.5, 0.6), [0xffc800, 0xd4216c, 0xfff6e6], 10, 3.2, 0.6, 3, 0.9);
    }
  }

  onResize() {
    if (this.creation) this._frame();
  }

  _frame() {
    const h = this.creation ? this.creation.height : 2.5;
    const vfov = THREE.MathUtils.degToRad(this.fov);
    const aspect = this.camera.aspect;
    const ty = Math.max(1.1, h * 0.46);
    const dH = (h / 2 + 1.1) / Math.tan(vfov / 2);
    const dW = 3.6 / (Math.tan(vfov / 2) * aspect);
    const d = Math.max(dH, dW, 6.2) * 1.04;
    const elev = THREE.MathUtils.degToRad(17);
    this.camera.position.set(0, ty + d * Math.sin(elev), d * Math.cos(elev));
    this.camera.lookAt(0, ty, 0);
    const halfW = d * Math.tan(vfov / 2) * aspect;
    const showMascot = aspect > 1.15;
    this.mascotRoot.visible = showMascot;
    this.mascotRoot.position.set(halfW * 0.7, 0, 1.4);
    this.mascotRoot.rotation.y = -0.45;
  }

  update(dt) {
    const sway = this.touched ? 0 : Math.sin(this.time * 0.6) * 0.5;
    if (this.spin > 0) this.spin = Math.max(0, this.spin - dt * 4.2);
    this.holder.rotation.y = this.userYaw + sway + this.spin * Math.PI * 2;
    if (this.mascotTimer > 0) {
      this.mascotTimer -= dt;
      if (this.mascotTimer <= 0) this.mascotMode = "idle";
    }
    this.mascot.animate(this.time, this.mascotMode || "idle", 1);
  }

  // ---------- panel (asistente) ----------

  _set(key, value) {
    this.cfg[key] = value;
    audio.playCollect();
    this._rebuild(true);
    this._renderPanel();
  }

  _optionButton(inner, selected, onClick, extra = "") {
    const b = el("button", `cr-opt${selected ? " sel" : ""} ${extra}`);
    b.type = "button";
    b.setAttribute("aria-pressed", selected ? "true" : "false");
    b.append(...inner);
    b.addEventListener("click", onClick);
    return b;
  }

  _renderPanel() {
    const panel = this.els.panel;
    panel.replaceChildren();

    const ch = this.challenge;
    const chBox = el("div", `cr-challenge${this.challengeClaimed ? " done" : ""}`);
    chBox.append(el("span", "cr-ch-tag", this.challengeClaimed ? "Reto cumplido ✓" : "🎯 Reto de hoy"));
    chBox.append(el("span", "cr-ch-text", `Crea ${describeChallenge(ch)} (+5 🍫✨)`));
    panel.append(chBox);

    if (this.view === "gallery") return this._renderGallery(panel);
    if (this.view === "result") return this._renderResult(panel);

    const tabs = el("div", "cr-steps");
    STEPS.forEach((s, i) => {
      const t = el("button", `cr-step${i === this.step ? " sel" : ""}${i < this.step ? " done" : ""}`, `${i + 1}. ${s.label}`);
      t.type = "button";
      t.addEventListener("click", () => { this.step = i; this._renderPanel(); });
      tabs.append(t);
    });
    panel.append(tabs);

    const body = el("div", "cr-body");
    const id = STEPS[this.step].id;
    const c = this.cfg;

    if (id === "producto") {
      body.append(el("h3", null, "¿Qué quieres crear?"));
      const grid = el("div", "cr-grid cr-grid-products");
      PRODUCTS.forEach((p) => grid.append(this._optionButton([el("span", "cr-ico", p.icon), el("b", null, p.name), el("small", null, p.desc)], c.product === p.id, () => this._set("product", p.id))));
      body.append(grid);
    } else if (id === "chocolate") {
      body.append(el("h3", null, "Elige el chocolate"));
      const grid = el("div", "cr-grid cr-grid-swatch");
      CHOCOLATES.forEach((x) => {
        const sw = el("span", "cr-swatch");
        sw.style.background = x.color;
        grid.append(this._optionButton([sw, el("b", null, x.name)], c.chocolate === x.id, () => this._set("chocolate", x.id)));
      });
      body.append(grid);
    } else if (id === "sabor") {
      body.append(el("h3", null, "Elige el relleno / sabor"));
      const grid = el("div", "cr-grid cr-grid-swatch");
      FLAVORS.forEach((x) => {
        const sw = el("span", "cr-swatch");
        sw.style.background = x.color;
        grid.append(this._optionButton([sw, el("b", null, x.name)], c.flavor === x.id, () => this._set("flavor", x.id)));
      });
      body.append(grid);
    } else if (id === "toppings") {
      body.append(el("h3", null, `Toppings (elige hasta 3): ${c.toppings.length}/3`));
      const grid = el("div", "cr-grid cr-grid-products");
      TOPPINGS.forEach((x) => {
        const on = c.toppings.includes(x.id);
        grid.append(this._optionButton([el("span", "cr-ico", x.icon), el("b", null, x.name)], on, () => {
          if (on) c.toppings = c.toppings.filter((t) => t !== x.id);
          else if (c.toppings.length < 3) c.toppings = [...c.toppings, x.id];
          else return this._toast("Máximo 3 toppings: quita uno para cambiar");
          audio.playCollect();
          this._rebuild(true);
          this._renderPanel();
        }));
      });
      body.append(grid);
    } else if (id === "envoltorio") {
      body.append(el("h3", null, "¿Cómo lo envolvemos?"));
      const grid = el("div", "cr-grid cr-grid-products");
      WRAPS.forEach((x) => grid.append(this._optionButton([el("span", "cr-ico", x.icon), el("b", null, x.name)], c.wrap === x.id, () => this._set("wrap", x.id))));
      body.append(grid);
      if (c.wrap !== "ninguno") {
        body.append(el("h3", null, "Color"));
        const colors = el("div", "cr-grid cr-grid-swatch");
        WRAP_COLORS.forEach((x) => {
          const sw = el("span", "cr-swatch");
          sw.style.background = x.color;
          colors.append(this._optionButton([sw, el("b", null, x.name)], c.wrapColor === x.id, () => this._set("wrapColor", x.id)));
        });
        body.append(colors);
      }
    } else {
      body.append(el("h3", null, "Diseña tu etiqueta"));
      const lab1 = el("label", "cr-field");
      lab1.append(el("span", null, "Nombre de tu chocolate"));
      const name = el("input", "text-input");
      name.type = "text";
      name.maxLength = 18;
      name.placeholder = "Ej: Dulce Sofi";
      name.value = c.name;
      name.addEventListener("input", () => {
        c.name = name.value.slice(0, 18);
        drawLabel(this.labelCanvas, c, this.logoImg);
        this.labelTex.needsUpdate = true;
      });
      lab1.append(name);
      const lab2 = el("label", "cr-field");
      lab2.append(el("span", null, "Para (opcional)"));
      const dedic = el("input", "text-input");
      dedic.type = "text";
      dedic.maxLength = 14;
      dedic.placeholder = "Ej: la abuela";
      dedic.value = c.dedic;
      dedic.addEventListener("input", () => {
        c.dedic = dedic.value.slice(0, 14);
        drawLabel(this.labelCanvas, c, this.logoImg);
        this.labelTex.needsUpdate = true;
      });
      lab2.append(dedic);
      body.append(lab1, lab2);
      body.append(el("span", "cr-label-hint", "Dibujo del centro"));
      const motifs = el("div", "cr-grid cr-grid-motif");
      MOTIFS.forEach((m) => motifs.append(this._optionButton([el("span", "cr-ico", m)], c.motif === m, () => this._set("motif", m), "cr-motif")));
      body.append(motifs);
    }
    panel.append(body);

    const nav = el("div", "cr-nav");
    const prev = el("button", "btn-secondary", "← Atrás");
    prev.type = "button";
    prev.disabled = this.step === 0;
    prev.addEventListener("click", () => { this.step = Math.max(0, this.step - 1); this._renderPanel(); });
    const next = el("button", "btn-primary", this.step === STEPS.length - 1 ? "¡Crear mi chocolate!" : "Siguiente →");
    next.type = "button";
    next.addEventListener("click", () => {
      if (this.step === STEPS.length - 1) this._create();
      else { this.step++; this._renderPanel(); }
    });
    const gal = el("button", "btn-tiny cr-gal-btn", `📚 Mis creaciones (${this.progress.creations.length})`);
    gal.type = "button";
    gal.addEventListener("click", () => { this.view = "gallery"; this._renderPanel(); });
    nav.append(prev, next);
    panel.append(nav, gal);
  }

  _toast(msg) {
    const t = el("div", "cr-toast", msg);
    this.els.panel.append(t);
    setTimeout(() => t.remove(), 2200);
  }

  // ---------- resultado ----------

  _create() {
    this.cfg = sanitize(this.cfg);
    const claimedBonus = matchesChallenge(this.cfg, this.challenge) && !this.challengeClaimed;
    this.result = { ...scoreCreation(this.cfg, { challengeDone: claimedBonus }), challenge: claimedBonus, saved: false };
    this.score = Math.max(this.score || 0, this.result.score);
    this.view = "result";
    this.touched = false;
    this.userYaw = 0;
    this.spin = 1;
    this.mascotMode = "cheer";
    this.mascotTimer = 2.4;
    audio.playMissionComplete();
    this.particles.burst(new THREE.Vector3(0, this.creation.height * 0.6, 0.8), [0xd4216c, 0xffc800, 0xcfd767, 0xfff6e6], 40, 6, 1.2, 5);
    this.popups.add(new THREE.Vector3(0, this.creation.height + 0.8, 0.5), this.result.perfect ? "¡Maridaje perfecto!" : "¡Qué creación!", "combo");
    this._banner("¡Tu chocolate está listo!");
    this._renderPanel();
    this._updateHud();
  }

  _banner(text) {
    const b = this.els.banner;
    b.textContent = text;
    b.classList.remove("show");
    void b.offsetWidth;
    b.classList.add("show");
  }

  _renderResult(panel) {
    const r = this.result;
    const c = this.cfg;
    const box = el("div", "cr-result");
    box.append(el("h3", "cr-r-title", c.name.trim() || `${getProduct(c.product).name} de ${getFlavor(c.flavor).name.toLowerCase()}`));
    box.append(el("div", "g3d-stars", "★".repeat(r.stars) + "☆".repeat(5 - r.stars)));
    box.append(el("p", "cr-r-desc", describeCreation(c)));
    const ul = el("ul", "cr-notes");
    r.notes.forEach((n) => ul.append(el("li", null, n)));
    box.append(ul);
    box.append(el("p", "cr-r-score", `${r.score} puntos de creatividad`));
    panel.append(box);

    const actions = el("div", "cr-actions");
    const save = el("button", "btn-primary", r.saved ? "Guardada ✓" : "💾 Guardar en Mis creaciones");
    save.type = "button";
    save.disabled = r.saved;
    save.addEventListener("click", () => this._save());
    const wa = el("button", "btn-whatsapp", "💬 Pedir algo parecido por WhatsApp");
    wa.type = "button";
    wa.addEventListener("click", () => window.open(whatsappUrl(c), "_blank", "noopener"));
    const again = el("button", "btn-secondary", "🔁 Crear otro");
    again.type = "button";
    again.addEventListener("click", () => { this.cfg = defaultCreation(); this.step = 0; this.view = "wizard"; this.touched = false; this.userYaw = 0; this._rebuild(true); this._renderPanel(); });
    const edit = el("button", "btn-secondary", "✏️ Seguir editando");
    edit.type = "button";
    edit.addEventListener("click", () => { this.view = "wizard"; this.step = 0; this._renderPanel(); });
    const gal = el("button", "btn-tiny", `📚 Mis creaciones (${this.progress.creations.length})`);
    gal.type = "button";
    gal.addEventListener("click", () => { this.view = "gallery"; this._renderPanel(); });
    actions.append(save, wa, again, edit, gal);
    panel.append(actions);
  }

  _save() {
    const r = this.result;
    if (!r || r.saved) return;
    const key = comboKey(this.cfg);
    const isNew = !this.progress.creations.some((x) => comboKey(sanitize(x)) === key);
    saveCreation(this.progress, { ...this.cfg, score: r.score, stars: r.stars });
    r.saved = true;
    let coins = 0;
    if (isNew) coins += 2;
    if (r.challenge && !this.challengeClaimed) {
      coins += 5;
      this.progress.creatorChallengeDate = todayKey();
    }
    if (coins) {
      earnCoins(this.progress, coins);
      saveProgress(this.progress);
      this.popups.add(new THREE.Vector3(0, this.creation.height + 0.4, 0.6), `+${coins} 🍫✨`, "coin");
      audio.playBonusCollect();
    } else {
      audio.playPurchase();
    }
    reportScore(this.progress, "creador", r.score);
    addToLeaderboard(this.progress, "creador", this.progress.playerName, r.score);
    this._updateHud();
    this._renderPanel();
  }

  // ---------- galería ----------

  _renderGallery(panel) {
    const head = el("div", "cr-gal-head");
    head.append(el("h3", null, "Mis creaciones"));
    const back = el("button", "btn-secondary", "← Volver");
    back.type = "button";
    back.addEventListener("click", () => { this.view = this.result ? "result" : "wizard"; this._renderPanel(); });
    head.append(back);
    panel.append(head);
    const list = el("div", "cr-gal");
    if (!this.progress.creations.length) {
      list.append(el("p", "cr-empty", "Todavía no guardas ninguna. ¡Crea tu primer chocolate!"));
    }
    this.progress.creations.forEach((raw) => {
      const c = sanitize(raw);
      const row = el("div", "cr-gal-item");
      const cv = document.createElement("canvas");
      cv.width = cv.height = 128;
      drawLabel(cv, c, this.logoImg);
      const info = el("div", "cr-gal-info");
      info.append(el("b", null, c.name.trim() || getFlavor(c.flavor).name));
      info.append(el("small", null, describeCreation(c)));
      info.append(el("small", "cr-gal-score", `${raw.score || 0} pts`));
      const edit = el("button", "btn-tiny", "Abrir");
      edit.type = "button";
      edit.addEventListener("click", () => {
        this.cfg = c;
        this.view = "wizard";
        this.step = 0;
        this.touched = false;
        this.userYaw = 0;
        this._rebuild(true);
        this._renderPanel();
      });
      const del = el("button", "btn-tiny cr-del", "✕");
      del.type = "button";
      del.title = "Borrar";
      del.addEventListener("click", () => {
        if (window.confirm("¿Borrar esta creación?")) {
          deleteCreation(this.progress, raw.id);
          this._updateHud();
          this._renderPanel();
        }
      });
      row.append(cv, info, edit, del);
      list.append(row);
    });
    panel.append(list);
  }

  _updateHud() {
    this.els.hudScore.textContent = String(Math.max(this.score || 0, this.progress.bestScores.creador || 0));
    this.els.hudCount.textContent = String(this.progress.creations.length);
    this.els.hudCoins.textContent = String(this.progress.coins);
  }
}
