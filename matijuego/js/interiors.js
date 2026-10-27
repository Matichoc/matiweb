// Visitas a las casas de los vecinos (Pueblo y Ciudad), al estilo de las casas de Pokémon: en la puerta aparece
// «🚪 Visitar a …» y el Matichico entra a una pieza 3D con el vecino y sus muebles. Cada casa tiene una misión chica al
// día: el vecino perdió 3 cosas en la pieza; al encontrarlas y volver a hablarle, da Matipuntos y una ⭐ de la aventura.
// La pieza se arma lejos del mundo (no se ve desde afuera) solo mientras dura la visita, y se desarma al salir.
// Cada juego entrega sus "ganchos": hablar (say), crear al vecino (makeHost), mostrar un aviso (popup) y su suelo (y0).
import { THREE, roundedBox, canvasTexture, emojiSprite } from "./three-kit.js?v=5e39093371";
import * as audio from "./audio.js?v=5e39093371";
import { earnCoins, saveProgress, todayKey } from "./storage.js?v=5e39093371";
import { addStars } from "./adventure.js?v=5e39093371";

const O = { x: 0, z: -900 }; // dónde se arma la pieza (lejos de todo)
const W = 12; // ancho (x) y fondo (z) de la pieza; el frente queda abierto hacia la cámara, como una casa de muñecas
const D = 9;
const REWARD = 40; // Matipuntos por la misión del día (y una ⭐)
const HOST = { x: -0.6, z: -2.4 }; // dónde espera el vecino (lejos del sillón, para que «Sentarse» y «Hablar» no se pisen)

/** Las casas que se pueden visitar. `item` es lo que el vecino perdió en la pieza. */
export const VISITS = {
  bombi: {
    host: "Bombi", wall: 0xffd6e8, accent: 0xd4216c, item: { emoji: "📚", one: "libro", many: "libros" },
    hello: ["¡Hola! Pasa, pasa, estás en tu casa 🌷", "Me encanta leer en mi rincón… pero se me desordenó todo."],
    ask: "Perdí 3 libros por aquí. ¿Me ayudas a encontrarlos? Brillan un poquito ✨",
    done: ["¡Mis libros! Ya puedo seguir mi cuento 📚", "Toma, por ayudarme 💝"],
    after: ["¡Gracias por la visita! Vuelve mañana, que siempre se me pierde algo 😅"],
  },
  capi: {
    host: "Capi Menta", wall: 0xd6f5e0, accent: 0x2fa86a, item: { emoji: "⚽", one: "pelota", many: "pelotas" },
    hello: ["¡Bienvenida a mi casa, campeona! ⚽", "Aquí guardo todo lo del equipo… o eso intento."],
    ask: "Se me arrancaron 3 pelotas por la pieza. ¿Las buscas conmigo?",
    done: ["¡Todas! Ahora sí podemos entrenar 💪", "Esto es para ti 🏆"],
    after: ["¡Gracias! Mañana entrenamos otra vez 😄"],
  },
  cuchufli: {
    host: "Don Cuchufli", wall: 0xffefc2, accent: 0xe8742a, item: { emoji: "🍫", one: "cuchuflí", many: "cuchuflís" },
    hello: ["¡Qué alegría una visita! 🍫", "Estaba preparando cuchuflís para el festival."],
    ask: "Se me cayeron 3 cuchuflís y rodaron por toda la casa. ¿Me ayudas?",
    done: ["¡Justo los que faltaban! Quedaron perfectos 😋", "Toma tu premio, ayudante 🍫"],
    after: ["¡Gracias! Mañana hago más, pasa a verme 😊"],
  },
  rosa: {
    host: "Doña Rosa", wall: 0xe8f7d4, accent: 0x2fa86a, item: { emoji: "🌱", one: "semilla", many: "semillas" },
    hello: ["¡Hola, mi niña! Pasa a mi casita 🌻", "Estaba ordenando las semillas para el huerto."],
    ask: "Se me volaron 3 bolsitas de semillas por la pieza. ¿Las buscamos?",
    done: ["¡Esas son! Mañana las plantamos 🌱", "Toma, por tu ayuda 💚"],
    after: ["¡Gracias por venir! Vuelve mañana 🌻"],
  },
  pepe: {
    host: "Don Pepe", wall: 0xdde8ff, accent: 0x2c6fb7, item: { emoji: "🖌️", one: "pincel", many: "pinceles" },
    hello: ["¡Adelante! Esta es mi casa-taller 🎨", "Estoy pintando un cuadro de la ciudad."],
    ask: "Perdí 3 pinceles entre tanto cachureo. ¿Me ayudas a encontrarlos?",
    done: ["¡Mis pinceles! Ya puedo terminar el cuadro 🖼️", "Toma, por ayudarme 🎨"],
    after: ["¡Gracias! Mañana te muestro el cuadro terminado 😄"],
  },
};

// lugares donde pueden quedar escondidas las cosas (coordenadas de la pieza; se eligen 3 distintos cada día)
const HIDE = [[-4.6, -2.6], [4.8, -3.4], [-5.1, 2.1], [5, 0.4], [1.6, 0.6], [-1.8, 3.2], [2.8, -3.6], [-3.2, -0.4]];

/** Número fijo por día y casa (las cosas quedan en los mismos lugares durante el día). */
function seedOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296);
}

export class Interiors {
  /** hooks: { say(name, lines, onEnd), makeHost(key) → Object3D, popup(text, kind), y0, addBench(b), removeBench(b), onLeave() } */
  constructor(game, hooks) {
    this.g = game;
    this.h = hooks;
    this.active = null; // { key, def, room, host, items, benches, back }
  }

  /** ¿Ya hizo hoy la misión de esta casa? */
  doneToday(key) {
    return ((this.g.progress.visits || {})[key] || "") === todayKey();
  }

  /** Entra a la casa `key`. `back` = { x, z, yaw }: dónde vuelve a quedar al salir. */
  enter(key, back) {
    const def = VISITS[key];
    if (!def || this.active) return;
    const y0 = this.h.y0 || 0;
    const room = this._buildRoom(def, y0);
    this.g.scene.add(room);
    const host = this.h.makeHost(key);
    host.position.set(O.x + HOST.x, y0, O.z + HOST.z);
    host.rotation.y = 0;
    if (host.parent !== this.g.scene) this.g.scene.add(host);
    // el sillón para sentarse (se suma a las bancas del juego mientras dura la visita)
    const sofa = { x: O.x - 3.6, z: O.z - 3.3, yaw: 0, seat: 0.56 };
    this.h.addBench(sofa);
    this.active = { key, def, room, host, items: [], started: false, benches: [sofa], back, t: 0 };
    this._cam = null;
    const p = this.g.pos;
    p.set(O.x, p.y, O.z + D / 2 - 1.2);
    this.g.vel && this.g.vel.set(0, 0, 0);
    this.g.heroYaw = Math.PI;
    audio.playPop?.();
    this.h.popup(`🏠 Casa de ${def.host}`, "combo");
  }

  /** Sale de la casa y vuelve a la puerta. */
  leave() {
    const a = this.active;
    if (!a) return;
    if (this.g.sitting && a.benches.includes(this.g.sitting)) this.g.sitting = null;
    for (const b of a.benches) this.h.removeBench(b);
    this.g.scene.remove(a.room);
    if (a.host.parent) a.host.parent.remove(a.host);
    a.room.traverse((o) => { if (o.isMesh || o.isSprite) { o.geometry?.dispose(); if (o.material?.map) o.material.map.dispose(); o.material?.dispose(); } });
    this.active = null;
    const p = this.g.pos;
    p.set(a.back.x, p.y, a.back.z);
    this.g.vel && this.g.vel.set(0, 0, 0);
    if (a.back.yaw != null) this.g.heroYaw = a.back.yaw;
    this.h.onLeave?.();
    this.g._placeCamera?.(true);
  }

  /** La pieza: piso, tres paredes, ventana, alfombra, sillón, mesa, repisa, cama y plantas (todo cajas simples). */
  _buildRoom(def, y0) {
    const g = new THREE.Group();
    g.position.set(O.x, y0, O.z);
    const mat = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const box = (w, h, d, c, x, y, z, r) => { const m = new THREE.Mesh(roundedBox(w, h, d, Math.min(0.06, w / 4, h / 4, d / 4)), mat(c, r)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    // piso de tablas y paredes del color de la casa
    const floorTex = canvasTexture(256, 256, (c, w, h) => { c.fillStyle = "#c98a5a"; c.fillRect(0, 0, w, h); c.fillStyle = "#b67646"; for (let i = 0; i < 8; i++) c.fillRect(0, i * 32, w, 3); });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(2, 2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    floor.receiveShadow = true;
    g.add(floor);
    box(W, 4, 0.3, def.wall, 0, 2, -D / 2, 0.9);
    box(0.3, 4, D, def.wall, -W / 2, 2, 0, 0.9);
    box(0.3, 4, D, def.wall, W / 2, 2, 0, 0.9);
    // zócalo y ventana con luz del día
    box(W, 0.25, 0.34, def.accent, 0, 0.12, -D / 2 + 0.02, 0.6);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshBasicMaterial({ color: 0xbfe6ff }));
    win.position.set(1.8, 2.4, -D / 2 + 0.17);
    g.add(win);
    box(2.7, 0.14, 0.12, 0xffffff, 1.8, 3.2, -D / 2 + 0.2, 0.5);
    box(2.7, 0.14, 0.12, 0xffffff, 1.8, 1.6, -D / 2 + 0.2, 0.5);
    // alfombra redonda
    const rug = new THREE.Mesh(new THREE.CircleGeometry(2.2, 28), mat(def.accent, 0.95));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.03, 0.4);
    g.add(rug);
    // sillón (se puede sentar) contra la pared del fondo, a la izquierda
    box(2.4, 0.5, 0.9, def.accent, -3.6, 0.3, -3.3, 0.8);
    box(2.4, 0.8, 0.25, def.accent, -3.6, 0.85, -3.75, 0.8);
    for (const sx of [-1.15, 1.15]) box(0.25, 0.7, 0.9, def.accent, -3.6 + sx, 0.45, -3.3, 0.8);
    // mesa con dos sillas
    box(1.8, 0.12, 1.1, 0x8a5a2a, 2.6, 0.85, 0.2, 0.6);
    for (const [x, z] of [[1.9, -0.2], [3.3, -0.2], [1.9, 0.6], [3.3, 0.6]]) box(0.1, 0.8, 0.1, 0x6b3a1e, x, 0.42, z, 0.6);
    for (const sx of [1.6, 3.6]) { box(0.6, 0.08, 0.6, 0x6b3a1e, sx, 0.5, 1.2, 0.6); box(0.6, 0.6, 0.08, 0x6b3a1e, sx, 0.85, 1.48, 0.6); }
    // repisa con cositas de colores
    box(2, 2.2, 0.5, 0x7a3f22, 4.6, 1.1, -3.9, 0.6);
    [0xff3b6b, 0xffe14a, 0x4fd09a, 0x4fd0ff, 0x9a5cff].forEach((c, i) => box(0.24, 0.5, 0.3, c, 3.9 + i * 0.32, 1.65, -3.75, 0.6));
    // cama a la derecha, adelante
    box(1.8, 0.5, 2.6, 0xffffff, 4.8, 0.3, 2.6, 0.8);
    box(1.8, 0.12, 2.0, def.accent, 4.8, 0.6, 2.9, 0.9);
    box(1.2, 0.2, 0.5, 0xfff6e6, 4.8, 0.65, 1.6, 0.9);
    // plantas en los rincones
    for (const [x, z] of [[-5.3, -3.9], [-5.3, 3.6]]) {
      box(0.6, 0.6, 0.6, 0xc4572b, x, 0.3, z, 0.8);
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), mat(0x3fae4a, 0.8));
      leaf.position.set(x, 1, z);
      g.add(leaf);
    }
    // la salida: felpudo con cartel
    const mat2 = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), mat(0x8a5a2a, 0.95));
    mat2.rotation.x = -Math.PI / 2;
    mat2.position.set(0, 0.03, D / 2 - 0.5);
    g.add(mat2);
    const exit = emojiSprite("🚪", 0.9);
    exit.position.set(0, 1.6, D / 2 - 0.4);
    g.add(exit);
    return g;
  }

  /** Muebles: el Matichico no los atraviesa. */
  static get SOLIDS() {
    return [
      { x: -3.6, z: -3.5, hw: 1.3, hd: 0.6 }, // sillón (se sienta desde adelante)
      { x: 2.6, z: 0.2, hw: 1, hd: 0.65 }, // mesa
      { x: 4.6, z: -3.9, hw: 1.1, hd: 0.4 }, // repisa
      { x: 4.8, z: 2.6, hw: 1, hd: 1.4 }, // cama
      { x: HOST.x, z: HOST.z, hw: 0.45, hd: 0.45 }, // el vecino
    ];
  }

  /** Mantiene al Matichico dentro de la pieza y fuera de los muebles. */
  clamp(p) {
    const lx = THREE.MathUtils.clamp(p.x - O.x, -W / 2 + 0.6, W / 2 - 0.6);
    const lz = THREE.MathUtils.clamp(p.z - O.z, -D / 2 + 0.6, D / 2 - 0.3);
    let x = lx, z = lz;
    for (const s of Interiors.SOLIDS) {
      const r = 0.4;
      const dx = x - s.x, dz = z - s.z;
      const ox = s.hw + r - Math.abs(dx), oz = s.hd + r - Math.abs(dz);
      if (ox > 0 && oz > 0) { if (ox < oz) x += Math.sign(dx || 1) * ox; else z += Math.sign(dz || 1) * oz; }
    }
    p.x = O.x + x;
    p.z = O.z + z;
  }

  /** Qué ofrece el botón de acción adentro: hablar con el vecino o salir. { label, icon, short, fn, d } */
  target(p) {
    const a = this.active;
    if (!a) return null;
    const lx = p.x - O.x, lz = p.z - O.z;
    const dHost = Math.hypot(lx - HOST.x, lz - HOST.z);
    if (dHost < 2.1) return { label: `💬 Hablar con ${a.def.host}`, icon: "💬", short: "Hablar", fn: () => this._talk(), d: dHost };
    const dExit = Math.hypot(lx, lz - (D / 2 - 0.7));
    if (dExit < 1.6) return { label: "🚪 Salir de la casa", icon: "🚪", short: "Salir", fn: () => this.leave(), d: dExit };
    return null;
  }

  _talk() {
    const a = this.active;
    const def = a.def;
    if (this.doneToday(a.key)) { this.h.say(def.host, def.after); return; }
    if (!a.started) {
      this.h.say(def.host, [...def.hello, def.ask], () => this._hide());
      return;
    }
    const left = a.items.filter((i) => !i.got).length;
    if (left > 0) { this.h.say(def.host, [`Te ${left === 1 ? "falta" : "faltan"} ${left} ${left === 1 ? def.item.one : def.item.many}. ¡Busca bien por la pieza! ✨`]); return; }
    this.h.say(def.host, def.done, () => this._reward());
  }

  /** Esconde las 3 cosas del día (siempre en los mismos lugares durante el día). */
  _hide() {
    const a = this.active;
    if (!a || a.started) return;
    a.started = true;
    const rnd = seedOf(`${a.key}:${todayKey()}`);
    const spots = HIDE.slice();
    for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
    for (const [x, z] of spots.slice(0, 3)) {
      const s = emojiSprite(a.def.item.emoji, 0.7);
      s.position.set(x, 0.6, z);
      a.room.add(s);
      a.items.push({ s, x, z, got: false, ph: rnd() * 6 });
    }
    this.h.popup(`🔍 Busca ${a.def.item.many}: 0/3`, "combo");
  }

  _reward() {
    const a = this.active;
    const pr = this.g.progress;
    pr.visits = pr.visits || {};
    pr.visits[a.key] = todayKey();
    earnCoins(pr, REWARD);
    addStars(pr, 1);
    saveProgress(pr);
    audio.playVictory?.();
    this.h.popup(`+${REWARD} 🍫✨  +1 ⭐`, "coin");
    this.h.onReward?.();
  }

  /** Cada cuadro: las cosas flotan y brillan; al pasar cerca se recogen. El vecino mira al Matichico. */
  update(dt, p) {
    const a = this.active;
    if (!a) return;
    a.t += dt;
    const lx = p.x - O.x, lz = p.z - O.z;
    let got = a.items.filter((i) => i.got).length;
    for (const it of a.items) {
      if (it.got) continue;
      it.s.position.y = 0.6 + Math.sin(a.t * 3 + it.ph) * 0.12;
      if (Math.hypot(lx - it.x, lz - it.z) < 1) {
        it.got = true;
        got++;
        it.s.visible = false;
        audio.playCollect?.();
        this.h.popup(`${a.def.item.emoji} ${got}/3`, "coin");
        if (got === 3) this.h.popup(`¡Listo! Vuelve con ${a.def.host} 💬`, "combo");
      }
    }
    // el vecino mira hacia el Matichico
    a.host.rotation.y = Math.atan2(lx - HOST.x, lz - HOST.z);
    a.host.userData.anim?.(a.t);
  }

  /** Cámara de casa de muñecas: desde el frente abierto, siguiendo un poco al Matichico. */
  camera(cam, p, dt) {
    const portrait = cam.aspect < 0.95;
    // en vertical no cabe toda la pieza: la cámara sigue más al Matichico hacia los lados
    const lx = portrait ? THREE.MathUtils.clamp(p.x - O.x, -4, 4) * 0.85 : THREE.MathUtils.clamp(p.x - O.x, -3, 3) * 0.35;
    const back = portrait ? 11 : 4.5;
    const up = portrait ? 11 : 7;
    const want = new THREE.Vector3(O.x + lx, (this.h.y0 || 0) + up, O.z + D / 2 + back);
    if (!this._cam) this._cam = want.clone();
    this._cam.lerp(want, 1 - Math.exp(-6 * Math.max(dt || 0.016, 0.001)));
    cam.position.copy(this._cam);
    cam.lookAt(O.x + lx, (this.h.y0 || 0) + 0.6, O.z - 0.2);
  }
}
