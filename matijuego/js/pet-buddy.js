// La mascota con vida (Pueblo y Mi Casa): sobre ella aparece un globito con lo que pide (🍪 hambre, ⚽ jugar), baila
// cuando está feliz, salta y suelta corazones al acariciarla, y va a buscar la pelota que le tiras y te la trae.
// La lógica (hambre, ánimo, golosinas, premios) está en js/pet-care.js; aquí solo lo que se ve.
// También arma la tarjeta "Mi mascota" con sus barras y botones (renderPetCard), igual en los dos lugares.
import { THREE, emojiSprite } from "./three-kit.js?v=abd0c6da60";
import * as audio from "./audio.js?v=abd0c6da60";
import { getItem } from "./wardrobe-data.js?v=abd0c6da60";
import { TREATS, petState, feedPet, patPet, playedWithPet } from "./pet-care.js?v=abd0c6da60";

const GRAV = 14;
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();

export class PetBuddy {
  /**
   * opts: { scene, hero: () => matichico, progress: () => progress, popup(text, kind)?, onChange()?,
   *         throwDist (cuánto vuela la pelota), clamp(v)? (para que no salga de la pieza) }
   */
  constructor(opts) {
    this.o = { throwDist: 5, ...opts };
    this.t = 0;
    this.bubble = null;
    this.ask = null;
    this.stateT = 0;
    this.state = null;
    this.fx = []; // corazones y emojis que suben
    this.hop = 0;
    this.spin = 0;
    this.danceT = 3;
    this.chase = null;
  }

  /** La mascota que lleva puesta (o null). */
  get item() {
    const h = this.o.hero();
    const id = h && h.look && h.look.pet;
    return id ? getItem(id) : null;
  }

  _holder() {
    if (this.chase) return this.chase.holder;
    const h = this.o.hero();
    return h ? h.group.children.find((c) => c.userData.pet) || null : null;
  }

  /** Cómo está ahora (lo calcula de nuevo cada pocos segundos). */
  status() {
    const it = this.item;
    return it ? petState(this.o.progress(), it.id) : null;
  }

  // ---------- acciones (desde la tarjeta) ----------

  /** "galleta" | "bombon" | "pat" | "ball". Devuelve un texto corto para mostrar (o ""). */
  do(action) {
    const it = this.item;
    const holder = this._holder();
    if (!it || !holder) return "";
    const pr = this.o.progress();
    let msg = "";
    let found = 0;
    if (action === "pat") {
      found = patPet(pr, it.id).found;
      this.hop = 0.5;
      for (let i = 0; i < 3; i++) this._emoji("💖", holder, i * 0.15, (i - 1) * 0.25);
      audio.playPop?.();
      msg = `💖 ¡A ${it.name} le encanta!`;
    } else if (action === "ball") {
      if (this.chase) return "";
      this._throw(holder);
      msg = `⚽ ¡Anda a buscarla, ${it.name}!`;
    } else {
      const r = feedPet(pr, it.id, action);
      if (r.full) return "😊 ¡Ya está llenita! Juega con ella un rato";
      if (r.need) return `Te faltan ${r.need} Matipuntos para la golosina`;
      if (!r.ok) return "";
      found = r.found;
      this.hop = 0.5;
      this._emoji(r.treat.icon, holder, 0, 0);
      this._emoji("😋", holder, 0.25, 0.2);
      audio.playCollect?.();
      msg = `${r.treat.icon} ¡Ñam! ${it.name} quedó feliz`;
    }
    if (found) this._found(found);
    this.stateT = 0;
    this.o.onChange?.();
    return msg;
  }

  _found(coins) {
    const it = this.item;
    audio.playVictory?.();
    this.o.popup?.(`🐾 ¡${it ? it.name : "Tu mascota"} encontró +${coins} 🍫✨!`, "coin");
  }

  // ---------- la pelota ----------

  _throw(holder) {
    const h = this.o.hero();
    const scene = this.o.scene;
    const g = h.group;
    const yaw = g.rotation.y;
    const fwd = v1.set(Math.sin(yaw), 0, Math.cos(yaw));
    const k = g.scale.x;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17 * Math.max(1, k * 0.8), 14, 10), new THREE.MeshStandardMaterial({ color: 0xff3b6b, roughness: 0.4 }));
    ball.castShadow = true;
    ball.position.copy(g.position).addScaledVector(fwd, 0.4 * k);
    ball.position.y += 1.1 * k;
    scene.add(ball);
    const T = 0.8;
    const vel = fwd.clone().multiplyScalar(this.o.throwDist / T);
    vel.y = 4;
    // la mascota se suelta del Matichico (queda en la escena con el mismo tamaño) y sale corriendo
    const home = { p: holder.position.clone(), q: holder.quaternion.clone(), s: holder.scale.clone() };
    holder.userData.free = true;
    scene.attach(holder);
    this.chase = { holder, ball, vel, home, phase: "chase", t: 0, rest: false, ground: g.position.y };
    audio.playWhoosh?.();
  }

  _chaseTick(dt) {
    const f = this.chase;
    const h = this.o.hero();
    f.t += dt;
    const r = f.ball.geometry.parameters.radius;
    // la pelota vuela, rebota una vez y se queda quieta
    if (!f.rest && f.phase === "chase") {
      f.vel.y -= GRAV * dt;
      f.ball.position.addScaledVector(f.vel, dt);
      if (this.o.clamp) this.o.clamp(f.ball.position);
      if (f.ball.position.y <= f.ground + r) {
        f.ball.position.y = f.ground + r;
        if (Math.abs(f.vel.y) < 2.5) { f.rest = true; f.vel.set(0, 0, 0); } else { f.vel.y *= -0.4; f.vel.x *= 0.6; f.vel.z *= 0.6; }
      }
    }
    const P = f.holder.position;
    const k = h ? h.group.scale.x : 1;
    const speed = 7 * Math.max(1, k * 0.7);
    let goal;
    if (f.phase === "chase") goal = v2.copy(f.ball.position).setY(f.ball.position.y + 0.35 * k);
    else goal = h ? h.group.localToWorld(v2.copy(f.home.p)) : P;
    const d = P.distanceTo(goal);
    if (f.t > 0.2 && d > 1e-3) {
      const step = Math.min(d, speed * dt);
      const dx = goal.x - P.x;
      const dz = goal.z - P.z;
      P.addScaledVector(v1.copy(goal).sub(P).normalize(), step);
      if (Math.hypot(dx, dz) > 0.05) f.holder.rotation.set(0, Math.atan2(dx, dz), 0);
    }
    if (f.phase === "chase" && f.rest && d < 0.3 * k) { f.phase = "back"; audio.playPop?.(); }
    if (f.phase === "back") f.ball.position.copy(P).setY(P.y - 0.3 * k); // la trae en la boca
    if ((f.phase === "back" && d < 0.25 * k) || f.t > 9 || !h) this._chaseDone(f.phase === "back" && f.t <= 9);
  }

  _chaseDone(ok) {
    const f = this.chase;
    this.chase = null;
    const h = this.o.hero();
    if (f.ball.parent) f.ball.parent.remove(f.ball);
    f.ball.geometry.dispose();
    f.ball.material.dispose();
    f.holder.userData.free = false;
    // si mientras jugaba se cambió de ropa, esta mascota ya no está puesta: se va
    const still = h && h.worn && h.worn.includes(f.holder);
    if (still) {
      h.group.attach(f.holder);
      f.holder.position.copy(f.home.p);
      f.holder.quaternion.copy(f.home.q);
      f.holder.scale.copy(f.home.s);
    } else if (f.holder.parent) f.holder.parent.remove(f.holder);
    if (!ok || !still) return;
    const it = this.item;
    const r = playedWithPet(this.o.progress(), it.id);
    this.hop = 0.5;
    for (let i = 0; i < 2; i++) this._emoji("💖", f.holder, i * 0.2, (i - 0.5) * 0.3);
    this.o.popup?.(`⚽ ¡${it.name} trajo la pelota!`, "combo");
    if (r.found) this._found(r.found);
    this.stateT = 0;
    this.o.onChange?.();
  }

  // ---------- cada cuadro ----------

  _emoji(e, holder, delay, dx) {
    const s = emojiSprite(e, 0.45);
    s.visible = false;
    this.o.scene.add(s);
    this.fx.push({ s, holder, t: -delay, dx });
  }

  /** Llamar después de animar al Matichico (su tick ubica a la mascota y aquí se le suma lo demás). */
  update(dt) {
    this.t += dt;
    const holder = this._holder();
    if (this.chase) this._chaseTick(dt);
    // los efectos siguen aunque la mascota ya no esté
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      if (f.t < 0) continue;
      if (!f.base) { f.base = (f.holder.parent ? f.holder.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3()); f.s.visible = true; }
      f.s.position.set(f.base.x + f.dx, f.base.y + 0.4 + f.t * 1.4, f.base.z);
      f.s.material.opacity = Math.max(0, 1 - f.t / 1.1);
      if (f.t > 1.1) { this.o.scene.remove(f.s); f.s.material.map.dispose(); f.s.material.dispose(); this.fx.splice(i, 1); }
    }
    if (!holder || !this.item) { if (this.bubble) this.bubble.visible = false; return; }
    if ((this.stateT -= dt) <= 0) { this.stateT = 3; this.state = this.status(); }
    const st = this.state;
    const inner = holder.children[0];
    // saltito (al comer, al acariciarla, al traer la pelota) y baile cuando está feliz
    if (!this.chase) {
      if (this.hop > 0) { this.hop = Math.max(0, this.hop - dt); holder.position.y += Math.sin((1 - this.hop / 0.5) * Math.PI) * 0.35; }
      if (st && st.mood === "feliz") {
        if ((this.danceT -= dt) <= 0) { this.danceT = 6; this.spin = 0.8; }
      }
      if (this.spin > 0 && inner) {
        this.spin = Math.max(0, this.spin - dt);
        const u = 1 - this.spin / 0.8;
        inner.rotation.y += u * Math.PI * 2;
        holder.position.y += Math.sin(u * Math.PI) * 0.25;
      }
    }
    // el globito con lo que pide
    const ask = st && !this.chase ? st.ask : null;
    if (ask !== this.ask) {
      this.ask = ask;
      if (this.bubble) { this.o.scene.remove(this.bubble); this.bubble.material.map.dispose(); this.bubble.material.dispose(); this.bubble = null; }
      if (ask) { this.bubble = emojiSprite(ask, 0.55); this.bubble.renderOrder = 5; this.o.scene.add(this.bubble); }
    }
    if (this.bubble) {
      holder.getWorldPosition(v1);
      const k = holder.parent ? holder.parent.scale.x : 1;
      this.bubble.visible = true;
      this.bubble.position.set(v1.x, v1.y + 0.55 * k + Math.sin(this.t * 3) * 0.05, v1.z);
    }
  }

  /** Al salir del juego: suelta la pelota, borra los efectos y deja la mascota en su lugar. */
  dispose() {
    if (this.chase) this._chaseDone(false);
    for (const f of this.fx) { this.o.scene.remove(f.s); f.s.material.map.dispose(); f.s.material.dispose(); }
    this.fx = [];
    if (this.bubble) { this.o.scene.remove(this.bubble); this.bubble.material.map.dispose(); this.bubble.material.dispose(); this.bubble = null; }
    this.ask = null;
  }
}

/** La tarjeta "Mi mascota": barras de 🍗 y 💖, y botones para darle golosinas, acariciarla y tirarle la pelota. */
export function renderPetCard(el, buddy, say) {
  const it = buddy.item;
  if (!it) { el.innerHTML = ""; el.classList.add("hidden"); return; }
  const st = buddy.status();
  const coins = buddy.o.progress().coins;
  el.classList.remove("hidden");
  el.innerHTML = `<div class="pc-head"><span class="pc-ico">${it.icon}</span><b>${it.name}</b><small class="pc-mood ${st.mood}">${st.ask ? st.ask + " " : ""}${st.label}</small></div>` +
    `<div class="pc-bars"><div class="pc-bar" title="Pancita"><span>🍗</span><i><em style="width:${st.food}%"></em></i></div>` +
    `<div class="pc-bar joy" title="Ánimo"><span>💖</span><i><em style="width:${st.joy}%"></em></i></div></div>` +
    `<div class="pc-acts">${TREATS.map((t) => `<button type="button" class="pc-btn" data-a="${t.id}"${coins < t.cost ? " disabled" : ""}><span class="pc-i">${t.icon}</span>${t.name}<small>🍫✨${t.cost}</small></button>`).join("")}` +
    `<button type="button" class="pc-btn" data-a="pat"><span class="pc-i">💖</span>Acariciar</button><button type="button" class="pc-btn" data-a="ball"><span class="pc-i">⚽</span>Pelota</button></div>`;
  el.querySelectorAll(".pc-btn").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation();
    const msg = buddy.do(b.dataset.a);
    if (msg) say?.(msg);
    renderPetCard(el, buddy, say);
  }));
}
