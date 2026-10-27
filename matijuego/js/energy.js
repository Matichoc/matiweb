// Energía: cada partida gasta un poco y se recupera con el tiempo, con cofres y jugando bien. Así nadie juega "todo el día"
// ni un bot puede farmear sin parar. La casa, la tienda, el álbum, el Pueblo y Ciudad Choco (explorar) NO gastan energía.
//
// progress.energy = { v, t, day, extra, chestAt, sleepUntil }
//   v         energía actual (0..ENERGY_CAP)
//   t         última vez que se calculó la recarga (ms)
//   day       día local de la última revisión (cada día nuevo se vuelve a llenar hasta ENERGY_MAX)
//   ver       versión de las reglas de energía: si cambia, la energía parte de nuevo (solo la energía; lo demás no se toca)
//   extra     energía "extra" ganada hoy (cofres, misiones, logros...); tiene tope diario
//   chestAt   cuándo estará listo el próximo cofre del tesoro (ms)
//   bought    veces que compró energía con Matipuntos hoy
//   sleepUntil mientras el Matichico duerme en su cama la recarga es más rápida

import { saveProgress, earnCoins, spendCoins, dayKey } from "./storage.js?v=a91b3b44ae";

export const ENERGY_VERSION = 2; // al subirla, la energía de todos los perfiles se reinicia (llena) una sola vez
export const ENERGY_MAX = 200; // lo que se llena solo (por día y con el tiempo)
export const ENERGY_CAP = 400; // tope con extras (cofres, logros, calendario...)
export const REGEN_SECS = 240; // +1 de energía cada 4 minutos (15 por hora): se gasta y se va reutilizando
export const SLEEP_MULT = 3; // durmiendo se recarga 3 veces más rápido
export const EXTRA_DAILY_MAX = 100; // máximo de energía extra por día
export const CHEST_EVERY = 40 * 60 * 1000; // un cofre del tesoro cada 40 minutos
export const CHEST_ENERGY = 10;
/** Comprar energía con Matipuntos: solo sube hasta ENERGY_MAX (no pasa de ahí) y tiene tope de compras por día. */
export const BUY_ENERGY = { amount: 20, price: 80, perDay: 10 };

/** Cuánto cuesta ENTRAR a jugar cada juego (0 = gratis). Además, durante la partida se gasta por acción (ver ENERGY_RULE). */
export const ENERGY_COST = {
  memoria: 4, tetris: 6, salto: 8, autos: 8, porristas: 6, basquet_tiros: 4, recolecta: 8, parkour: 8, dulces: 4,
  futbol: 4, aventura: 8, fps3d: 5, merge: 0,
  pichanga: 4, basquet2v2: 4, // partidos de los deportes nuevos: solo la entrada (sin gasto por acción)
  ciudad: 0, // explorar es gratis; cada misión cuesta ENERGY_MISSION
  town: 0, creador: 0,
};
/** Lo que se gasta mientras se juega (para mostrarlo en las tarjetas). */
export const ENERGY_RULE = {
  basquet_tiros: "1 por tiro", futbol: "1 por tiro", tetris: "1 cada 4 piezas", dulces: "1 por movimiento",
  memoria: "1 cada 2 intentos", autos: "1 cada 250 m", parkour: "1 cada 60 m", salto: "1 cada 15 m alto",
  porristas: "1 cada 6 rebotes", recolecta: "1 cada 12 s", aventura: "1 cada 20 s", merge: "1 por producto nuevo",
};
export const ENERGY_MISSION = 2; // misión de Ciudad Choco
export const costOf = (gameId) => (gameId in ENERGY_COST ? ENERGY_COST[gameId] : 5);

const emitGain = (n, reason) => {
  try { window.dispatchEvent(new CustomEvent("energy-gain", { detail: { n, reason } })); } catch (e) { /* sin ventana */ }
};

/** Estado de energía al día (aplica la recarga por tiempo y el llenado del día nuevo). */
export function energyOf(progress, now = Date.now()) {
  let e = progress.energy;
  if (!e || typeof e !== "object") e = progress.energy = { v: ENERGY_MAX, t: now, day: dayKey(new Date(now)), extra: 0, chestAt: now + CHEST_EVERY, sleepUntil: 0, ver: ENERGY_VERSION };
  if (e.ver !== ENERGY_VERSION) { // reglas nuevas de energía: parte de nuevo, llena (lo demás del perfil no se toca)
    Object.assign(e, { v: ENERGY_MAX, t: now, day: dayKey(new Date(now)), extra: 0, bought: 0, chestAt: now + CHEST_EVERY, sleepUntil: 0, ver: ENERGY_VERSION });
  }
  if (!Number.isFinite(e.v)) e.v = ENERGY_MAX;
  e.v = Math.min(ENERGY_CAP, Math.max(0, e.v));
  if (!Number.isFinite(e.t) || e.t > now) e.t = now; // el reloj se atrasó: no se regala tiempo
  if (!Number.isFinite(e.chestAt) || e.chestAt - now > CHEST_EVERY * 2) e.chestAt = now + CHEST_EVERY;
  e.extra = Math.max(0, e.extra || 0);
  e.bought = Math.max(0, e.bought || 0);
  e.sleepUntil = e.sleepUntil || 0;
  const today = dayKey(new Date(now));
  if (e.day !== today) {
    e.day = today;
    e.extra = 0;
    e.bought = 0;
    if (e.v < ENERGY_MAX) e.v = ENERGY_MAX; // cada día se empieza con la energía llena
    e.t = now;
  }
  if (e.v < ENERGY_MAX) {
    // recarga por tiempo: más rápida mientras duerme
    let t = e.t;
    let v = e.v;
    while (v < ENERGY_MAX && t < now) {
      const sleeping = t < e.sleepUntil;
      const step = (REGEN_SECS * 1000) / (sleeping ? SLEEP_MULT : 1);
      const segEnd = sleeping ? Math.min(now, e.sleepUntil) : now;
      const n = Math.floor((segEnd - t) / step);
      if (n <= 0) {
        if (segEnd >= now) break;
        t = segEnd; // pasó a despierto
        continue;
      }
      const gain = Math.min(n, ENERGY_MAX - v);
      v += gain;
      t += gain * step;
      if (gain < n) break;
    }
    e.v = v;
    e.t = v >= ENERGY_MAX ? now : t;
  } else e.t = now;
  return e;
}

/** Datos para mostrar: energía, cuánto falta para la próxima y el cofre. */
export function energyInfo(progress, now = Date.now()) {
  const e = energyOf(progress, now);
  let next = 0;
  if (e.v < ENERGY_MAX) {
    const sleeping = now < e.sleepUntil;
    const step = (REGEN_SECS * 1000) / (sleeping ? SLEEP_MULT : 1);
    next = Math.max(0, Math.ceil((e.t + step - now) / 1000));
  }
  return {
    v: Math.floor(e.v), max: ENERGY_MAX, cap: ENERGY_CAP, nextInSecs: next, sleeping: now < e.sleepUntil,
    chestReady: now >= e.chestAt, chestInSecs: Math.max(0, Math.ceil((e.chestAt - now) / 1000)),
    extraLeft: Math.max(0, EXTRA_DAILY_MAX - e.extra), buysLeft: Math.max(0, BUY_ENERGY.perDay - e.bought),
    fullInSecs: e.v >= ENERGY_MAX ? 0 : Math.ceil(((ENERGY_MAX - e.v - 1) * REGEN_SECS * 1000 / (now < e.sleepUntil ? SLEEP_MULT : 1)) / 1000) + next,
  };
}

export const canSpend = (progress, n) => energyOf(progress).v >= n;

/** Gasta energía. Devuelve false (sin gastar nada) si no alcanza. */
export function spendEnergy(progress, n) {
  if (!(n > 0)) return true;
  const e = energyOf(progress);
  if (e.v < n) return false;
  if (e.v >= ENERGY_MAX && e.v - n < ENERGY_MAX) e.t = Date.now(); // desde aquí empieza a recargarse
  e.v -= n;
  saveProgress(progress);
  return true;
}

/** Suma energía extra (cofres, misiones, logros, subir de nivel). Respeta el tope diario. Devuelve cuánto sumó. */
export function addEnergy(progress, n, reason = "", { calendar = false } = {}) {
  if (!(n > 0)) return 0;
  const e = energyOf(progress);
  // los premios del calendario mensual no cuentan para el tope diario de extras (solo para el tope general)
  const room = Math.min(n, calendar ? Infinity : EXTRA_DAILY_MAX - e.extra, ENERGY_CAP - e.v);
  if (room <= 0) return 0;
  if (e.v >= ENERGY_MAX && e.v + room > ENERGY_MAX) e.t = Date.now();
  e.v += room;
  if (!calendar) e.extra += room;
  saveProgress(progress);
  emitGain(room, reason);
  return room;
}

/** Lo que costaría y daría comprar ahora: la energía comprada nunca pasa de ENERGY_MAX (si faltan menos de 20, se da lo que falta y se cobra proporcional). */
export function buyOffer(progress) {
  const e = energyOf(progress);
  const n = Math.min(BUY_ENERGY.amount, Math.max(0, ENERGY_MAX - Math.floor(e.v)));
  return { n, price: n > 0 ? Math.ceil((BUY_ENERGY.price * n) / BUY_ENERGY.amount) : 0 };
}

/** Compra energía con Matipuntos, solo hasta llegar al máximo. Devuelve cuánta sumó, o 0 si no se pudo (sin puntos, tope del día o ya está llena). */
export function buyEnergy(progress) {
  const e = energyOf(progress);
  const { n, price } = buyOffer(progress);
  if (e.bought >= BUY_ENERGY.perDay || n <= 0 || (progress.coins || 0) < price) return 0;
  if (!spendCoins(progress, price)) return 0;
  e.v += n;
  e.bought++;
  if (e.v >= ENERGY_MAX) e.t = Date.now();
  saveProgress(progress);
  emitGain(n, "comprada");
  return n;
}

/** Cobra el cofre del tesoro si ya está listo: energía (si queda cupo extra hoy) y unos Matipuntos. */
export function claimEnergyChest(progress) {
  const now = Date.now();
  const e = energyOf(progress, now);
  if (now < e.chestAt) return null;
  // el cofre siempre da su energía: no cuenta para el tope diario de extras (solo para el tope general de 300)
  const energy = addEnergy(progress, CHEST_ENERGY, "cofre", { calendar: true });
  const coins = energy > 0 ? 5 : 8; // si ya no cabe más energía (tope general), se compensa con puntos
  earnCoins(progress, coins);
  e.chestAt = now + CHEST_EVERY;
  saveProgress(progress);
  return { energy, coins };
}

/** El Matichico se va a dormir: la recarga va más rápido por un rato (se corta al salir de la casa). */
export function startSleep(progress, secs = 600) {
  const e = energyOf(progress);
  if (e.v >= ENERGY_MAX) return false;
  const now = Date.now();
  if (now >= e.sleepUntil) e.t = now;
  e.sleepUntil = now + secs * 1000;
  saveProgress(progress);
  return true;
}

export function stopSleep(progress) {
  const e = energyOf(progress);
  if (e.sleepUntil > Date.now()) { e.sleepUntil = 0; saveProgress(progress); }
}

export const fmtSecs = (s) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} min` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
