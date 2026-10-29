// La aventura "Renovar el Pueblo" en el centro del pueblo: el rincón de la plaza, la cancha de la pichanga, el aro de
// básquet y el gran festival. Cada tarea hecha (js/adventure.js) cambia algo y queda así para siempre (los barrios de
// más allá de la cerca están en js/town-zones.js). También: el "❗" sobre el vecino que te espera, la flecha que guía a la
// zona, el globo de arriba con lo que sigue y la decoración del festival (con los colores del evento de temporada).

import { THREE, canvasTexture, roundedBox, makeBunting, toonify, disposeTree } from "./three-kit.js?v=abd0c6da60";
import { activeEvent } from "./events.js?v=abd0c6da60";
import { ZONES, choiceOf, choiceOption, placeOpen, npcWaiting, stepPlace, takeTownDest, currentTask, taskDone, objective, starsOf } from "./adventure.js?v=abd0c6da60";
import { paintNeighbor } from "./neighbors.js?v=abd0c6da60";
import { zonePlaces } from "./town-zones.js?v=abd0c6da60";
import { GAMES_CATALOG } from "./games-catalog.js?v=abd0c6da60";

const pol = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return { x: Math.sin(a) * r, z: -Math.cos(a) * r };
};

/** Los lugares de la aventura (medidos para no chocar con edificios, caminos, aros ni puertas; ver docs/EVOLUCION-JUGABILIDAD.md). */
export const PLACES = {
  plaza: { deg: 150, ...pol(150, 12), r: 3.6, npc: "Bombi", home: pol(150, 15.4), name: "Rincón de Bombi" },
  cancha: { deg: 165, ...pol(165, 33), r: 8.5, npc: "Capi Menta", home: pol(165, 27.4), name: "Cancha del Pueblo" },
  aro: { deg: 140, ...pol(140, 33), r: 6.5, npc: "Don Cuchufli", home: pol(140, 28), name: "Aro del Pueblo" },
  fuente: { deg: 180, x: 0, z: 0, r: 5, npc: "Mati Cacao", home: { x: 2.6, z: 6.2 } },
  ...zonePlaces(), // bosque de cacao, granja y lago (más allá de la cerca)
};

/** Un juego rápido para ganar ⭐ desde cada zona (sirve cualquiera; estos están libres en un perfil nuevo). */
const QUICK = { plaza: "memoria", cancha: "pichanga", aro: "basquet2v2", festival: "porristas", bosque: "recolecta", granja: "merge", lago: "salto" };

const std = (color, rough = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
const REDUCED = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function textSprite(text, { bg = "#7a3f22", fg = "#fff6e6", w = 512, h = 128, font = 54 } = {}) {
  const tex = canvasTexture(w, h, (g, W, H) => {
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(6, 6, W - 12, H - 12, 26);
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = "#ffc800";
    g.stroke();
    g.fillStyle = fg;
    g.font = `${font}px "Baby Chipmunk", "Fredoka", sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, W / 2, H / 2 + 3, W - 36);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(4.2, 1.05, 1);
  return sp;
}

export class TownFestival {
  constructor(town) {
    this.g = town;
    this.groups = {};
    this.colliders = [];
    this.goalText = "";
  }

  get progress() { return this.g.progress; }

  /** Antes de los árboles: aparta los lugares (para que no crezca nada encima) y crea sus puntos de uso. */
  buildWorld() {
    for (const id of ["plaza", "cancha", "aro"]) this.g.fun.claimed.push({ x: PLACES[id].x, z: PLACES[id].z, r: PLACES[id].r });
    this.itPitch = { kind: "fest", place: "cancha", x: PLACES.cancha.x, z: PLACES.cancha.z, radius: 6, label: "" };
    this.itCourt = { kind: "fest", place: "aro", x: PLACES.aro.x, z: PLACES.aro.z, radius: 4.8, label: "" };
    this.g.interact.push(this.itPitch, this.itCourt);
  }

  /** Después de los vecinos: marcador, flecha y el estado actual de cada lugar. */
  build() {
    const s = this.g.scene;
    const mark = canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = "#ffc800";
      g.beginPath(); g.arc(w / 2, h / 2, 56, 0, Math.PI * 2); g.fill();
      g.lineWidth = 8; g.strokeStyle = "#fff"; g.stroke();
      g.fillStyle = "#7a3f22";
      g.font = "bold 84px sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("!", w / 2, h / 2 + 4);
    });
    this.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: mark, transparent: true, depthTest: false }));
    this.marker.scale.set(1.3, 1.3, 1);
    this.marker.renderOrder = 12;
    this.marker.visible = false;
    s.add(this.marker);
    // flecha guía en el suelo, junto al héroe
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.95); shape.lineTo(0.62, 0.15); shape.lineTo(0.24, 0.15); shape.lineTo(0.24, -0.7);
    shape.lineTo(-0.24, -0.7); shape.lineTo(-0.24, 0.15); shape.lineTo(-0.62, 0.15); shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    this.arrow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffc800, transparent: true, opacity: 0.9, depthWrite: false }));
    this.arrow.renderOrder = 8;
    this.arrow.visible = false;
    s.add(this.arrow);
    this.refresh();
  }

  // ---------- estado de los lugares ----------

  /** Vuelve a armar lo que cambió (al entrar al Pueblo y cada vez que avanza la aventura). */
  refresh() {
    const p = this.progress;
    if (!p) return;
    const t = (id) => (taskDone(p, id) ? 1 : 0);
    this._place("plaza", { clean: t("plaza.limpiar"), style: choiceOf(p, "plaza"), bench: t("plaza.banca"), lamps: t("plaza.faroles") });
    this._place("cancha", { cut: t("cancha.pasto"), style: choiceOf(p, "cancha"), goals: t("cancha.arcos"), stands: t("cancha.galeria") });
    this._place("aro", { floor: t("aro.piso"), style: choiceOf(p, "aro"), hoop: t("aro.aro"), lights: t("aro.focos") });
    this._festival({ bunting: t("festival.banderines"), stage: t("festival.escenario"), balloons: t("festival.globos"), open: t("festival.inaugurar") });
    if (this.g.zones) this.g.zones.refresh();
    this._homes();
    this.itPitch.label = placeOpen(p, "cancha") ? "⚽ Jugar una pichanga (3 contra 3)" : "⚽ Cancha abandonada";
    this.itCourt.label = placeOpen(p, "aro") ? "🏀 Jugar básquet 2 contra 2" : "🏀 Terreno abandonado";
    const fountain = this.g.interact.find((i) => i.kind === "fountain");
    if (fountain) fountain.label = "🍫 Probar el chocolate de la fuente";
    this.g.target = null; // que el botón de acción se actualice con la etiqueta nueva
    this._goal(true);
  }

  _homes() {
    for (const n of this.g.npcs) {
      const place = Object.values(PLACES).find((pl) => pl.npc === n.def.name);
      if (!place) continue;
      const first = !n.home;
      n.home = place.home;
      if (first) { n.x = n.tx = place.home.x; n.z = n.tz = place.home.z; }
    }
  }

  _swap(id, group) {
    const old = this.groups[id];
    if (old) { this.g.scene.remove(old); disposeTree(old); }
    this.groups[id] = group;
    if (group) {
      if (this.g.kawaii) toonify(group);
      this.g.scene.add(group);
    }
  }

  _base(id) {
    const P = PLACES[id];
    const grp = new THREE.Group();
    grp.position.set(P.x, 0, P.z);
    grp.rotation.y = (-P.deg * Math.PI) / 180; // +x a lo largo del borde; +z mira a la fuente
    return grp;
  }

  _mesh(grp, geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    grp.add(m);
    return m;
  }

  _sign(grp, text, z, bg) {
    const sp = textSprite(text, { bg });
    sp.position.set(0, 3.2, z);
    grp.add(sp);
  }

  _place(id, f) {
    const key = `${id}:${JSON.stringify(f)}`;
    const old = this.groups[id];
    if (old && old.userData.key === key) return;
    const grp = this._base(id);
    grp.userData.key = key;
    if (id === "plaza") this._buildCorner(grp, f);
    else if (id === "cancha") this._buildPitch(grp, f);
    else this._buildCourt(grp, f);
    this._swap(id, grp);
    if (old) this._pop(grp); // lo recién arreglado aparece con un saltito
  }

  _pop(obj) {
    if (REDUCED) return;
    this.pops = this.pops || [];
    this.pops.push({ obj, t: 0 });
  }

  _weeds(grp, n, w, d, seed) {
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const geo = new THREE.ConeGeometry(0.28, 0.9, 5);
    const mat = std(0x5f7f3a, 0.9);
    for (let i = 0; i < n; i++) {
      const m = this._mesh(grp, geo, mat, (rnd() - 0.5) * w, 0.4, (rnd() - 0.5) * d);
      m.rotation.z = (rnd() - 0.5) * 0.5;
      m.scale.setScalar(0.7 + rnd() * 0.8);
    }
  }

  _bench(grp, x, z, color, rotY = 0) {
    const b = new THREE.Group();
    b.position.set(x, 0, z);
    b.rotation.y = rotY;
    const wood = std(color, 0.6);
    this._mesh(b, roundedBox(1.9, 0.14, 0.6, 0.05), wood, 0, 0.5, 0);
    this._mesh(b, roundedBox(1.9, 0.5, 0.1, 0.04), wood, 0, 0.85, -0.28);
    for (const sx of [-0.8, 0.8]) this._mesh(b, new THREE.BoxGeometry(0.12, 0.5, 0.5), std(0x4b2e1e), sx, 0.25, 0);
    grp.add(b);
    return b;
  }

  _buildCorner(grp, f) {
    const style = f.style;
    if (!f.clean) {
      this._mesh(grp, new THREE.CylinderGeometry(3.2, 3.3, 0.12, 28), std(0xa98a5e, 0.95), 0, 0.12, 0);
      this._weeds(grp, 9, 5, 4.5, 11);
      for (const [x, z] of [[-1.8, 1.1], [1.9, 0.9]]) this._mesh(grp, new THREE.DodecahedronGeometry(0.35, 0), std(0x9a9086, 0.9), x, 0.3, z);
    } else if (!style) {
      this._mesh(grp, new THREE.CylinderGeometry(3.2, 3.3, 0.12, 28), std(0xead7b0, 0.9), 0, 0.12, 0);
    } else if (style === "jardin") {
      this._mesh(grp, new THREE.CylinderGeometry(3.2, 3.3, 0.14, 28), std(0x8fd47a, 0.9), 0, 0.12, 0);
      const cols = [0xff6fb0, 0xffe14a, 0xffffff, 0xc59bff, 0xff8a5a];
      const stem = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 5);
      const head = new THREE.SphereGeometry(0.17, 10, 8);
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const r = 2.2 + (i % 3) * 0.32;
        this._mesh(grp, stem, std(0x3f9a4a), Math.cos(a) * r, 0.45, Math.sin(a) * r);
        this._mesh(grp, head, std(cols[i % cols.length], 0.5), Math.cos(a) * r, 0.8, Math.sin(a) * r);
      }
      for (const [x, z] of [[-1.6, -1.2], [1.6, -1.2], [0, -2.1]]) {
        this._mesh(grp, new THREE.SphereGeometry(0.75, 12, 10), std(0x3f9a4a, 0.8), x, 0.75, z);
        for (const k of [0, 1, 2]) this._mesh(grp, new THREE.SphereGeometry(0.16, 8, 6), std(0x8a4a22, 0.5), x + Math.cos(k * 2.1) * 0.6, 0.7, z + Math.sin(k * 2.1) * 0.6).scale.set(1, 1.5, 1);
      }
    } else if (style === "guirnaldas") {
      this._mesh(grp, new THREE.CylinderGeometry(3.2, 3.3, 0.14, 28), std(0xf6e3bf, 0.8), 0, 0.12, 0);
      for (const sx of [-2.7, 2.7]) this._mesh(grp, new THREE.CylinderGeometry(0.1, 0.12, 3.4, 8), std(0xffc800, 0.3, { metalness: 0.5 }), sx, 1.7, -0.8);
      grp.add(makeBunting(new THREE.Vector3(-2.7, 3.3, -0.8), new THREE.Vector3(2.7, 3.3, -0.8), { count: 12, sag: 0.6, size: 0.24 }));
    } else {
      this._mesh(grp, new THREE.CylinderGeometry(3.2, 3.3, 0.12, 28), std(0xf3dfb8, 0.85), 0, 0.1, 0);
      this._mesh(grp, new THREE.CylinderGeometry(2.2, 2.2, 0.05, 28), std(0xd4216c, 0.9), 0, 0.2, 0.3);
      this._mesh(grp, new THREE.TorusGeometry(2.05, 0.06, 6, 32), std(0xffc800, 0.4), 0, 0.23, 0.3).rotation.x = Math.PI / 2;
      [0xffe14a, 0x4fd0ff, 0x9a5cff].forEach((c, i) => this._mesh(grp, new THREE.SphereGeometry(0.42, 12, 8), std(c, 0.8), -1 + i, 0.38, 0.9).scale.set(1, 0.55, 1));
      const shelf = new THREE.Group();
      shelf.position.set(0, 0, -2);
      this._mesh(shelf, roundedBox(2.2, 1.6, 0.5, 0.05), std(0x7a3f22, 0.6), 0, 0.8, 0);
      const bookCols = [0xff3b6b, 0xffe14a, 0x4fd09a, 0x4fd0ff, 0x9a5cff, 0xff8a2a, 0xffffff, 0x3b8cff];
      bookCols.forEach((c, i) => this._mesh(shelf, new THREE.BoxGeometry(0.18, 0.5 + (i % 3) * 0.08, 0.36), std(c, 0.6), -0.85 + i * 0.24, 1.1, 0.1));
      grp.add(shelf);
    }
    // la banca: rota y ladeada hasta que la arreglas (del color del estilo elegido)
    const benchCol = { jardin: 0x7a3f22, guirnaldas: 0xff6fb0, lectura: 0xffc800 }[style] || 0x7a3f22;
    this.g.removeBench(this.plazaBench);
    this.plazaBench = null;
    if (f.bench) {
      const bz = style === "lectura" ? 1.9 : 0.5;
      this._bench(grp, 0, bz, benchCol, Math.PI);
      // arreglada, se puede usar: su lugar en el mundo (el grupo está girado hacia la fuente)
      const a = grp.rotation.y;
      this.plazaBench = this.g.addBench({ x: grp.position.x + Math.sin(a) * bz, z: grp.position.z + Math.cos(a) * bz, yaw: a + Math.PI, seat: 0.57 });
    } else { const b = this._bench(grp, 0.4, -1.2, 0x8a7a6a, 0.1); b.rotation.z = 0.18; }
    // faroles de colores alrededor
    if (f.lamps) {
      const cols = [0xff3b6b, 0xffe14a, 0x4fd0ff, 0x9a5cff];
      [[-2.9, 1.4], [2.9, 1.4], [-2.4, -2.2], [2.4, -2.2]].forEach(([x, z], i) => {
        this._mesh(grp, new THREE.CylinderGeometry(0.06, 0.08, 2.6, 8), std(0x2a1810), x, 1.3, z);
        this._mesh(grp, new THREE.SphereGeometry(0.28, 12, 10), std(cols[i], 0.3, { emissive: cols[i], emissiveIntensity: 0.8 }), x, 2.75, z);
      });
    }
    if (f.clean) this._sign(grp, `🌷 ${PLACES.plaza.name}`, -2.9, "#d4216c");
  }

  _pitchTexture(color) {
    return canvasTexture(512, 320, (g, w, h) => {
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#5fbf5a" : "#57b153"; g.fillRect((i * w) / 8, 0, w / 8 + 1, h); }
      g.strokeStyle = "#ffffff";
      g.lineWidth = 6;
      g.strokeRect(10, 10, w - 20, h - 20);
      g.beginPath(); g.moveTo(w / 2, 10); g.lineTo(w / 2, h - 10); g.stroke();
      g.beginPath(); g.arc(w / 2, h / 2, 42, 0, Math.PI * 2); g.stroke();
      g.strokeRect(10, h / 2 - 70, 60, 140);
      g.strokeRect(w - 70, h / 2 - 70, 60, 140);
      g.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
      g.beginPath(); g.arc(w / 2, h / 2, 10, 0, Math.PI * 2); g.fill();
    });
  }

  _goalFrame(grp, x, facing, color) {
    const goal = new THREE.Group();
    goal.position.set(x, 0, 0);
    goal.rotation.y = facing;
    const white = std(0xffffff, 0.35);
    for (const sz of [-1.2, 1.2]) this._mesh(goal, new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), white, 0, 0.7, sz);
    this._mesh(goal, new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), white, 0, 1.4, 0).rotation.x = Math.PI / 2;
    const net = this._mesh(goal, new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }), -0.5, 0.7, 0);
    net.rotation.y = Math.PI / 2;
    this._mesh(goal, new THREE.BoxGeometry(0.12, 0.12, 2.4), std(color, 0.5), 0, 0.06, 0);
    grp.add(goal);
  }

  _buildPitch(grp, f) {
    const style = f.style;
    if (!f.cut) {
      this._mesh(grp, new THREE.PlaneGeometry(13, 8).rotateX(-Math.PI / 2), std(0x6f9a48, 1), 0, 0.04, 0);
      this._weeds(grp, 26, 12, 7, 23);
      const fallen = this._mesh(grp, new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), std(0xd8d8d8, 0.5), -5.4, 0.1, 0.4);
      fallen.rotation.set(Math.PI / 2, 0, 0.3);
      this._sign(grp, "⚽ Cancha abandonada", -4.6, "#6b5a3a");
      return;
    }
    const opt = choiceOption("cancha", style);
    const color = opt ? opt.color : 0xffffff;
    this._mesh(grp, new THREE.PlaneGeometry(13, 8).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: this._pitchTexture(color), roughness: 0.95 }), 0, 0.04, 0);
    if (f.goals) {
      this._goalFrame(grp, -6.5, 0, color);
      this._goalFrame(grp, 6.5, Math.PI, 0xffffff);
    }
    if (style) {
      for (const [x, z] of [[-6.5, -4], [6.5, -4], [-6.5, 4], [6.5, 4]]) {
        this._mesh(grp, new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), std(0xffffff), x, 0.6, z);
        this._mesh(grp, new THREE.PlaneGeometry(0.45, 0.3), std(color, 0.6, { side: THREE.DoubleSide }), x + 0.24, 1.05, z);
      }
      for (const x of [-6, 0, 6]) this._mesh(grp, new THREE.CylinderGeometry(0.08, 0.1, 3, 8), std(0x2a1810), x, 1.5, -4.8);
      const colors = [color, 0xffffff, 0xffc800];
      grp.add(makeBunting(new THREE.Vector3(-6, 2.9, -4.8), new THREE.Vector3(0, 2.9, -4.8), { count: 8, sag: 0.4, size: 0.22, colors }));
      grp.add(makeBunting(new THREE.Vector3(0, 2.9, -4.8), new THREE.Vector3(6, 2.9, -4.8), { count: 8, sag: 0.4, size: 0.22, colors }));
    }
    if (f.stands) {
      // graderías de tres escalones del lado de afuera
      const cols = [0xffffff, color, 0xffc800];
      for (let k = 0; k < 3; k++) this._mesh(grp, roundedBox(9, 0.45, 0.9, 0.05), std(cols[k], 0.6), 0, 0.22 + k * 0.45, -5.9 - k * 0.8).scale.y = 1 + k;
    }
    this._sign(grp, `⚽ ${PLACES.cancha.name}`, f.stands ? -8.4 : -5.2, `#${color.toString(16).padStart(6, "0")}`);
  }

  _courtTexture(style) {
    const floor = { clasico: "#d9a066", dorado: "#6b3a22", arcoiris: "#f6e9ff" }[style] || "#d9a066";
    const line = { clasico: "#ffffff", dorado: "#ffc800", arcoiris: "#9a5cff" }[style] || "#ffffff";
    return canvasTexture(360, 320, (g, w, h) => {
      g.fillStyle = floor;
      g.fillRect(0, 0, w, h);
      if (style === "clasico") for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)"; g.fillRect(0, (i * h) / 12, w, h / 12); }
      g.lineWidth = 6;
      const lines = style === "arcoiris" ? ["#ff3b6b", "#ffc800", "#4fd09a", "#4fd0ff", "#9a5cff"] : [line];
      g.strokeStyle = lines[0];
      g.strokeRect(8, 8, w - 16, h - 16);
      g.strokeStyle = lines[1 % lines.length];
      g.beginPath(); g.arc(w / 2, 20, 150, 0, Math.PI); g.stroke(); // línea de 3
      g.strokeStyle = lines[2 % lines.length];
      g.strokeRect(w / 2 - 45, 8, 90, 120); // la "pintura"
      g.strokeStyle = lines[3 % lines.length];
      g.beginPath(); g.arc(w / 2, 128, 45, 0, Math.PI); g.stroke();
    });
  }

  _buildCourt(grp, f) {
    const style = f.style;
    for (const c of this.colliders) { const i = this.g.colliders.indexOf(c); if (i >= 0) this.g.colliders.splice(i, 1); }
    this.colliders = [];
    if (!f.floor) {
      this._mesh(grp, new THREE.PlaneGeometry(9, 8).rotateX(-Math.PI / 2), std(0xb59466, 1), 0, 0.055, 0); // un poco más alto que el pasto de la cancha, que lo toca
      this._weeds(grp, 12, 8, 7, 37);
      const pole = this._mesh(grp, new THREE.CylinderGeometry(0.1, 0.1, 3, 8), std(0x777777, 0.5), 1, 0.12, -2);
      pole.rotation.z = Math.PI / 2;
      this._mesh(grp, new THREE.TorusGeometry(0.3, 0.04, 6, 16), std(0x9a6a3a, 0.6), 2.8, 0.06, -2).rotation.x = Math.PI / 2;
      this._sign(grp, "🏀 Terreno abandonado", -4.4, "#6b5a3a");
      return;
    }
    const opt = choiceOption("aro", style);
    const rim = opt ? opt.color : 0xff7a1a;
    // en la textura, el aro queda arriba (v = 1) → se rota para que el aro quede del lado de afuera (-z)
    const floor = new THREE.PlaneGeometry(9, 8).rotateX(-Math.PI / 2);
    if (style) this._mesh(grp, floor, new THREE.MeshStandardMaterial({ map: this._courtTexture(style), roughness: 0.8 }), 0, 0.04, 0);
    else this._mesh(grp, floor, std(0xc9c2b8, 0.9), 0, 0.04, 0);
    if (f.hoop) {
      this._mesh(grp, new THREE.CylinderGeometry(0.11, 0.13, 3.4, 10), std(0x3a3a46, 0.4, { metalness: 0.4 }), 0, 1.7, -4.1);
      this._mesh(grp, new THREE.BoxGeometry(0.12, 0.12, 0.9), std(0x3a3a46), 0, 3.25, -3.7);
      this._mesh(grp, roundedBox(1.8, 1.1, 0.08, 0.04), std(0xffffff, 0.3), 0, 3.5, -3.25);
      this._mesh(grp, new THREE.PlaneGeometry(0.6, 0.45), std(rim, 0.5), 0, 3.35, -3.2);
      this._mesh(grp, new THREE.TorusGeometry(0.3, 0.035, 8, 24), std(rim, 0.35, { metalness: 0.4 }), 0, 3.05, -2.88).rotation.x = Math.PI / 2;
      this._mesh(grp, new THREE.CylinderGeometry(0.3, 0.2, 0.42, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, wireframe: true }), 0, 2.82, -2.88);
      // el poste del aro no se atraviesa
      const P = PLACES.aro;
      const a = (-P.deg * Math.PI) / 180;
      const col = { type: "c", x: P.x + Math.sin(a) * -4.1, z: P.z + Math.cos(a) * -4.1, r: 0.45 };
      this.g.colliders.push(col);
      this.colliders.push(col);
    }
    if (f.lights) {
      for (const sx of [-4.6, 4.6]) {
        this._mesh(grp, new THREE.CylinderGeometry(0.1, 0.13, 5, 8), std(0x3a3a46, 0.4, { metalness: 0.4 }), sx, 2.5, -3.6);
        this._mesh(grp, roundedBox(0.9, 0.5, 0.3, 0.05), std(0xfff6c0, 0.3, { emissive: 0xffe9a0, emissiveIntensity: 0.9 }), sx, 5.1, -3.4);
      }
    }
    this._sign(grp, `🏀 ${PLACES.aro.name}`, -4.9, `#${rim.toString(16).padStart(6, "0")}`);
  }

  /** El gran festival alrededor de la fuente: banderines, escenario, globos y el cartel al inaugurar. */
  _festival(f) {
    const ev = activeEvent();
    const key = `${JSON.stringify(f)}:${ev ? ev.id : "-"}`;
    const old = this.groups.festival;
    if (old && old.userData.key === key) return;
    if (!f.bunting && !f.stage && !f.balloons && !f.open) { this._swap("festival", null); return; }
    const grp = new THREE.Group();
    grp.userData.key = key;
    const colors = ev ? ev.colors : [0xd4216c, 0xffc800, 0x4fd0ff, 0x4fd09a, 0xfff6e6];
    if (f.bunting) {
      for (let i = 0; i < 12; i++) {
        const a = pol(i * 30 + 15, 21.5);
        const b = pol((i + 1) * 30 + 15, 21.5);
        grp.add(makeBunting(new THREE.Vector3(a.x, 3.85, a.z), new THREE.Vector3(b.x, 3.85, b.z), { count: 10, sag: 0.8, size: 0.26, colors }));
      }
    }
    if (f.stage) {
      const st = new THREE.Group();
      const at = pol(-72, 11.5);
      st.position.set(at.x, 0, at.z);
      st.rotation.y = Math.atan2(-at.x, -at.z); // mirando a la fuente
      this._mesh(st, roundedBox(6, 0.8, 3.4, 0.08), std(0x7a3f22, 0.6), 0, 0.4, 0);
      this._mesh(st, roundedBox(6, 0.12, 3.4, 0.05), std(0xd4216c, 0.6), 0, 0.86, 0);
      for (const sx of [-2.8, 2.8]) this._mesh(st, new THREE.CylinderGeometry(0.12, 0.14, 3.6, 8), std(0xffc800, 0.3, { metalness: 0.5 }), sx, 2.6, -1.5);
      this._mesh(st, roundedBox(6, 0.5, 0.3, 0.05), std(0xffc800, 0.3, { metalness: 0.5 }), 0, 4.4, -1.5);
      for (const sx of [-1.8, 1.8]) this._mesh(st, roundedBox(0.9, 1.3, 0.7, 0.1), std(0x2a1810), sx, 1.5, -1.1);
      this._mesh(st, new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), std(0x3a3a46), 0, 1.6, 0.3);
      this._mesh(st, new THREE.SphereGeometry(0.12, 8, 6), std(0x3a3a46), 0, 2.35, 0.3);
      grp.add(st);
    }
    if (f.balloons) {
      const cols = [0xff4fa8, 0xffe14a, 0x4fd0ff, 0x7ddc4a, 0xff8a2a];
      const ball = new THREE.SphereGeometry(0.42, 12, 10);
      for (let i = 0; i < 6; i++) {
        const p = pol(i * 60 + 45, 18.4);
        for (let k = 0; k < 3; k++) {
          const m = this._mesh(grp, ball, std(cols[(i + k) % cols.length], 0.35), p.x + (k - 1) * 0.5, 3.4 + (k % 2) * 0.5, p.z);
          m.scale.set(1, 1.2, 1);
          m.castShadow = false;
        }
        this._mesh(grp, new THREE.CylinderGeometry(0.015, 0.015, 3, 4), std(0xffffff), p.x, 1.6, p.z);
      }
    }
    if (f.open) {
      const banner = textSprite(`🎉 Gran festival del Pueblo${ev ? ` · ${ev.icon}` : ""}`, { bg: "#d4216c", w: 768, font: 60 });
      banner.scale.set(8, 1.6, 1);
      banner.position.set(0, 8.6, 0);
      grp.add(banner);
    }
    this._swap("festival", grp);
    if (old) this._pop(grp);
  }

  // ---------- uso de los lugares ----------

  /** Botón de acción sobre la cancha o el aro. */
  act(it) {
    const p = this.progress;
    const game = it.place === "cancha" ? "pichanga" : "basquet2v2";
    if (placeOpen(p, it.place)) {
      window.dispatchEvent(new CustomEvent("town-action", { detail: { kind: "game", game } }));
      return;
    }
    const z = ZONES.find((x) => x.place === it.place);
    this.g.popups.add(new THREE.Vector3(it.x, 3.2, it.z), `Aquí falta arreglar. ${z.npc} te va a pedir ayuda con ⭐`, "kill");
  }

  /** Al entrar al Pueblo desde "Ir al Pueblo": te deja junto al lugar del objetivo. */
  applyDest() {
    return this.goTo(takeTownDest());
  }

  /** Pone al héroe junto al lugar (y su vecino), mirándolo. */
  goTo(dest) {
    if (!dest || !PLACES[dest]) return false;
    const P = PLACES[dest];
    const h = P.home;
    // del otro lado del vecino que su lugar, mirándolo: así se ven el vecino y el lugar detrás (y la cámara no queda dentro de nada)
    let ux = h.x - P.x;
    let uz = h.z - P.z;
    const len = Math.hypot(ux, uz) || 1;
    ux /= len;
    uz /= len;
    const x = h.x + ux * 2.8;
    const z = h.z + uz * 2.8;
    this.g.pos.set(x, 0, z);
    this.g.heroYaw = Math.atan2(h.x - x, h.z - z);
    this.g.camYaw = this.g.heroYaw + Math.PI;
    this.g.vel.set(0, 0, 0);
    if (this.g.ready) this.g._placeCamera(true);
    return true;
  }

  // ---------- cada cuadro ----------

  /** Adónde apunta la flecha: al vecino de la zona actual (o al centro de la zona si no está). */
  _targetPos() {
    const p = this.progress;
    const cur = currentTask(p);
    if (!cur) return null;
    const P = PLACES[cur.zone.place];
    const n = this.g.npcs.find((x) => x.def.name === cur.zone.npc);
    if (n) return { x: n.x, z: n.z, y: 3.9, npc: n };
    return P ? { x: P.x, z: P.z, y: 3.6 } : null;
  }

  update(dt) {
    this.t = (this.t || 0) + dt;
    if (this.pops) {
      for (const q of this.pops) {
        q.t += dt;
        const k = Math.min(1, q.t / 0.6);
        q.obj.scale.setScalar(k < 1 ? 0.3 + 0.7 * k + Math.sin(k * Math.PI) * 0.15 : 1);
      }
      this.pops = this.pops.filter((q) => q.t < 0.6);
    }
    const tgt = this._targetPos();
    const waiting = npcWaiting(this.progress);
    // "❗" sobre quien te espera (o sobre la fuente para celebrar)
    if (tgt && waiting) {
      this.marker.visible = true;
      this.marker.position.set(tgt.x, tgt.y + (REDUCED ? 0 : Math.sin(this.t * 3) * 0.18), tgt.z);
    } else this.marker.visible = false;
    // flecha guía cuando el objetivo está lejos
    const P = this.g.pos;
    if (tgt && this.g.state === "playing") {
      const dx = tgt.x - P.x;
      const dz = tgt.z - P.z;
      const d = Math.hypot(dx, dz);
      this.arrow.visible = d > 7;
      if (this.arrow.visible) {
        this.arrow.position.set(P.x + (dx / d) * 1.9, P.y + 0.12, P.z + (dz / d) * 1.9);
        this.arrow.rotation.y = Math.atan2(-dx, -dz); // la flecha apunta a su -z local
        this.arrow.material.opacity = REDUCED ? 0.9 : 0.7 + Math.sin(this.t * 5) * 0.2;
      }
    } else this.arrow.visible = false;
    this._goal();
  }

  /**
   * Globo de arriba: la cara del vecino de la zona, la tarea que sigue con su costo en ⭐ y un botón:
   * "🔨 ¡Hacer!" (abre la lista de tareas) si te alcanzan las ⭐, o "▶ Jugar" para ganarlas.
   */
  _goal(force = false) {
    const el = this.g.q && this.g.q("goal");
    if (!el) return;
    const p = this.progress;
    const obj = objective(p);
    const key = obj.done ? "done" : `${obj.task.id}|${obj.can}|${starsOf(p)}`;
    if (!force && key === this.goalText) return;
    this.goalText = key;
    el.innerHTML = "";
    el.classList.toggle("hidden", obj.done);
    if (obj.done) return;
    const z = obj.zone;
    const face = document.createElement("canvas");
    face.className = "tq-face";
    face.width = face.height = 96;
    paintNeighbor(face, z.npc);
    const txt = document.createElement("span");
    txt.className = "tq-text";
    txt.innerHTML = "<b></b><span></span>";
    txt.querySelector("b").textContent = `${z.icon} ${z.title} · ${z.npc}`;
    txt.querySelector("span").textContent = obj.can ? `${obj.task.icon} ${obj.task.text} (⭐${obj.task.cost})` : `${obj.task.icon} ${obj.task.text}: te faltan ⭐${obj.task.cost - obj.stars}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `tq-btn${obj.can ? " go" : ""}`;
    if (obj.can) {
      btn.textContent = "🔨 ¡Hacer!";
      btn.addEventListener("click", () => window.dispatchEvent(new CustomEvent("adventure-tasks")));
    } else {
      const quick = QUICK[z.id] || "memoria";
      const entry = GAMES_CATALOG.find((g) => g.id === quick);
      btn.textContent = `▶ ${({ pichanga: "Pichanga", basquet2v2: "Básquet" })[quick] || (entry ? entry.name : "Jugar")}`;
      btn.title = "Juega cualquier juego para ganar ⭐";
      btn.addEventListener("click", () => window.dispatchEvent(new CustomEvent("town-action", { detail: { kind: "game", game: quick } })));
    }
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    const list = document.createElement("button");
    list.type = "button";
    list.className = "tq-list";
    list.title = "Ver las tareas de la zona";
    list.textContent = "📋";
    list.addEventListener("click", () => window.dispatchEvent(new CustomEvent("adventure-tasks")));
    list.addEventListener("pointerdown", (e) => e.stopPropagation());
    el.append(face, txt, btn, list);
  }
}
