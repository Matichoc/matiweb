// Pichanga Choco: la simulación del partido 3 contra 3 (2 jugadores de campo + 1 arquero por equipo).
// Lógica pura, sin three.js ni DOM: el dibujo (js/pichanga-game.js) solo la lee, y scripts/qa/deportes-logica.mjs la
// prueba con miles de partidos para que no queden pelotas ni jugadores trabados.
//
// Coordenadas: x a lo largo de la cancha (-L/2 … L/2), z a lo ancho (-W/2 … W/2). El equipo 0 (el tuyo) ataca hacia +x.
// Reglas: goles, saque inicial después de cada gol, saque de banda (pelota afuera por un costado), saque de arco (la tiró
// afuera quien ataca) y córner (la tiró afuera quien defiende). Todos (tú y la IA) siguen las mismas reglas.

export const PITCH = { L: 30, W: 19, goalW: 4.4, goalH: 2.1, boxX: 5, boxZ: 5.5 };
export const MATCH_SECS = 120;

/** Habilidad de los rivales por dificultad. aim: puntería; keeper: atajadas; react: cada cuánto deciden (s). */
export const DIFFICULTY = {
  accesible: { speed: 4.3, react: 0.62, tackle: 0.2, aim: 0.45, keeper: 0.34, shootRange: 7, human: 6.3, humanTackle: 0.78, humanAim: 0.92 },
  normal: { speed: 5.1, react: 0.4, tackle: 0.33, aim: 0.66, keeper: 0.56, shootRange: 8.5, human: 6.0, humanTackle: 0.64, humanAim: 0.85 },
  desafio: { speed: 5.65, react: 0.26, tackle: 0.45, aim: 0.8, keeper: 0.68, shootRange: 10, human: 6.0, humanTackle: 0.55, humanAim: 0.8 },
};
/** Tus compañeros (IA) juegan siempre parejo, para ayudar sin ganar solos. */
const ALLY = { speed: 5.1, react: 0.38, tackle: 0.33, aim: 0.66, keeper: 0.6, shootRange: 8.5 };

const HALF = PITCH.L / 2;
const SIDE = PITCH.W / 2;
const BALL_DEC = 2.2; // frenado de la pelota en el pasto (m/s²) + roce proporcional a la velocidad
const CONTROL = 0.62; // a esta distancia un jugador de campo controla una pelota suelta
const KEEPER_REACH = 1.0;

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const attSign = (team) => (team === 0 ? 1 : -1);
const goalX = (team) => attSign(team) * HALF; // arco que ataca
const ownGoalX = (team) => -attSign(team) * HALF;

/** Distancia de un punto al segmento a→b (para ver si un rival tapa un pase o un tiro). */
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1);
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

function makePlayer(id, team, role, slot) {
  return { id, team, role, slot, x: 0, z: 0, vx: 0, vz: 0, fx: attSign(team), fz: 0, cool: 0, stun: 0, think: 0, tx: 0, tz: 0, hold: 0, press: false };
}

/**
 * Crea un partido. opts: difficulty, seed, secs, golden (gol de oro si termina empatado: para la copa),
 * aiOnly (los 6 con IA: para las pruebas automáticas).
 */
export function createMatch(opts = {}) {
  const diff = DIFFICULTY[opts.difficulty] ? opts.difficulty : "normal";
  const m = {
    diff, skill: DIFFICULTY[diff], secs: opts.secs || MATCH_SECS, time: opts.secs || MATCH_SECS,
    golden: !!opts.golden, goldenOn: false, over: false, score: [0, 0], players: [], human: null, aiOnly: !!opts.aiOnly,
    ball: { x: 0, z: 0, h: 0, vx: 0, vz: 0, vh: 0, owner: null, last: null, lastTeam: -1, noPick: {}, kind: null, shot: null, target: null, still: 0 },
    restart: null, pause: 0, pendingKickoff: -1, events: [], elapsed: 0,
    stats: { shots: [0, 0], passes: [0, 0], poss: [0, 0], tackles: [0, 0], saves: [0, 0] },
    rng: mulberry32(opts.seed || 1),
  };
  let id = 0;
  for (const team of [0, 1]) {
    m.players.push(makePlayer(id++, team, "gk", 0));
    m.players.push(makePlayer(id++, team, "f", 1));
    m.players.push(makePlayer(id++, team, "f", 2));
  }
  if (!m.aiOnly) m.human = m.players[1];
  setKickoff(m, 0);
  return m;
}

const field = (m, team) => m.players.filter((p) => p.team === team && p.role === "f");
const keeperOf = (m, team) => m.players.find((p) => p.team === team && p.role === "gk");
const skillOf = (m, p) => (p.team === 0 && !m.aiOnly ? ALLY : p.team === 0 ? ALLY : m.skill);
const ev = (m, e) => { m.events.push(e); if (m.events.length > 60) m.events.shift(); };

function place(p, u, v) {
  p.x = attSign(p.team) * u;
  p.z = v;
  p.vx = p.vz = 0;
  p.fx = attSign(p.team);
  p.fz = 0;
  p.stun = 0;
  p.cool = 0.2;
  p.hold = 0;
}

/** Saque inicial: cada equipo en su mitad; saca `team`. */
export function setKickoff(m, team) {
  for (const p of m.players) {
    if (p.role === "gk") place(p, -HALF + 0.9, 0);
    else if (p.team === team) place(p, p.slot === 1 ? -0.7 : -3.2, p.slot === 1 ? 0 : 4.5);
    else place(p, -5.5, p.slot === 1 ? -3.2 : 3.2);
  }
  const taker = field(m, team).find((p) => p.slot === 1);
  setRestart(m, "kickoff", team, 0, 0, taker);
}

function setRestart(m, type, team, x, z, forced) {
  const b = m.ball;
  Object.assign(b, { x, z, h: 0, vx: 0, vz: 0, vh: 0, owner: null, kind: null, shot: null, target: null, noPick: {}, still: 0 });
  let taker = forced;
  if (!taker) {
    if (type === "goalkick") taker = keeperOf(m, team);
    else taker = field(m, team).reduce((a, p) => (dist(p, b) < dist(a, b) ? p : a));
  }
  // el que saca se pone detrás de la pelota, mirando hacia la cancha / el arco rival
  let ax = goalX(team) * 0.35 - x;
  let az = -z;
  if (type === "kickoff") { ax = attSign(team); az = 0; }
  const al = Math.hypot(ax, az) || 1;
  ax /= al; az /= al;
  taker.x = x - ax * 0.5;
  taker.z = z - az * 0.5;
  taker.fx = ax;
  taker.fz = az;
  taker.vx = taker.vz = 0;
  taker.stun = 0;
  b.owner = taker;
  b.last = taker;
  b.lastTeam = team;
  m.restart = { type, team, t: 0, taker };
  // los rivales se alejan a 3 m
  for (const p of m.players) {
    if (p.team === team) continue;
    const d = dist(p, b);
    if (d < 3) {
      const ux = d > 0.01 ? (p.x - x) / d : -attSign(team);
      const uz = d > 0.01 ? (p.z - z) / d : 0;
      p.x = clamp(x + ux * 3, -HALF + 0.4, HALF - 0.4);
      p.z = clamp(z + uz * 3, -SIDE + 0.4, SIDE - 0.4);
    }
  }
  if (m.human && team === m.human.team && taker.role === "f") m.human = taker;
  ev(m, { type: "restart", kind: type, team });
}

function kick(m, p, dx, dz, speed, lift, kind) {
  const b = m.ball;
  const l = Math.hypot(dx, dz) || 1;
  dx /= l; dz /= l;
  b.owner = null;
  b.x = clamp(p.x + dx * 0.45, -HALF + 0.05, HALF - 0.05);
  b.z = clamp(p.z + dz * 0.45, -SIDE + 0.05, SIDE - 0.05);
  b.h = 0.11;
  b.vx = dx * speed;
  b.vz = dz * speed;
  b.vh = lift;
  b.noPick = { [p.id]: 0.32 };
  b.last = p;
  b.lastTeam = p.team;
  b.kind = kind;
  b.shot = kind === "shot" ? { team: p.team, seen: {} } : null;
  b.still = 0;
  p.cool = 0.35;
  p.hold = 0;
  p.fx = dx;
  p.fz = dz;
  m.restart = null;
}

/** Qué tan libre está un punto (distancia al rival de campo más cercano, con tope). */
function openness(m, team, x, z) {
  let best = 6;
  for (const q of m.players) if (q.team !== team && q.role === "f") best = Math.min(best, Math.hypot(q.x - x, q.z - z));
  return best;
}

/** ¿Algún rival tapa la línea entre a y b? (devuelve cuántos la tapan) */
function laneBlocked(m, team, ax, az, bx, bz, w = 0.9) {
  let n = 0;
  for (const q of m.players) {
    if (q.team === team) continue;
    if (segDist(q.x, q.z, ax, az, bx, bz) < w && Math.hypot(q.x - ax, q.z - az) > 0.6) n++;
  }
  return n;
}

function passScore(m, p, q) {
  const att = attSign(p.team);
  const d = dist(p, q);
  if (d < 2) return -9;
  let s = openness(m, p.team, q.x, q.z) * 0.8 + (q.x - p.x) * att * 0.18 - laneBlocked(m, p.team, p.x, p.z, q.x, q.z) * 3.5 - Math.max(0, d - 14) * 0.3;
  if (q.role === "gk") s -= 3; // al arquero solo si no hay nada mejor
  return s;
}

/** Pase. Con dirección (dx, dz) se elige al compañero que está para ese lado. */
export function doPass(m, p, dx = 0, dz = 0, to = null) {
  const mates = m.players.filter((q) => q.team === p.team && q !== p);
  let target = to;
  if (!target) {
    const aim = Math.hypot(dx, dz) > 0.3;
    let best = -1e9;
    for (const q of mates) {
      let s = passScore(m, p, q);
      if (aim) {
        const qd = dist(p, q) || 1;
        const cos = ((q.x - p.x) * dx + (q.z - p.z) * dz) / (qd * Math.hypot(dx, dz));
        if (cos < 0.25) continue;
        s += cos * 6;
      }
      if (s > best) { best = s; target = q; }
    }
    if (!target) target = mates.filter((q) => q.role === "f").reduce((a, q) => (dist(p, q) < dist(p, a) ? q : a), mates[0]);
  }
  const lead = target.role === "gk" ? 0 : 0.35;
  const tx = target.x + target.vx * lead;
  const tz = target.z + target.vz * lead;
  const d = Math.hypot(tx - p.x, tz - p.z);
  kick(m, p, tx - p.x, tz - p.z, clamp(6.5 + d * 0.72, 8, 15.5), d > 11 ? 2.2 : 0, "pass");
  m.ball.target = target;
  m.stats.passes[p.team]++;
  ev(m, { type: "pass", team: p.team, from: p.id, to: target.id });
  return target;
}

/** Tiro al arco. aimSide: -1 / 1 para apuntar a un palo (o null: la IA elige el lado contrario al arquero). */
export function doShoot(m, p, aimSide = null, power = 0.7) {
  const gx = goalX(p.team);
  const k = keeperOf(m, 1 - p.team);
  const edge = PITCH.goalW / 2 - 0.5;
  let tz = aimSide != null ? clamp(aimSide, -1, 1) * edge : (k.z > 0.1 ? -edge : k.z < -0.1 ? edge : (m.rng() < 0.5 ? -edge : edge));
  const human = p === m.human;
  const skill = human ? m.skill.humanAim : skillOf(m, p).aim;
  const d = Math.hypot(gx - p.x, tz - p.z);
  const err = (1 - skill) * 2.4 * clamp(d / 11, 0.5, 2.2);
  tz += (m.rng() + m.rng() - 1) * err;
  const speed = 13 + clamp(power, 0, 1) * 6;
  kick(m, p, gx - p.x, tz - p.z, speed, d > 10 ? 1.6 + m.rng() * 0.8 : 0.6 + m.rng() * 0.6, "shot");
  m.stats.shots[p.team]++;
  ev(m, { type: "shot", team: p.team, from: p.id });
}

/** Intento de quitar la pelota. */
export function tryTackle(m, p) {
  const b = m.ball;
  const c = b.owner;
  p.cool = 0.85;
  if (!c || c.team === p.team || (m.restart && m.restart.taker === c)) return false;
  if (dist(p, c) > 1.4) { p.stun = 0.2; ev(m, { type: "whiff", team: p.team }); return false; }
  const chance = p === m.human ? m.skill.humanTackle : skillOf(m, p).tackle + (c === m.human ? 0 : 0.08);
  if (m.rng() < chance) {
    c.stun = 0.6;
    c.hold = 0;
    b.owner = p;
    b.last = p;
    b.lastTeam = p.team;
    b.kind = null;
    p.hold = 0;
    m.stats.tackles[p.team]++;
    if (m.human && p.team === m.human.team && p.role === "f") m.human = p;
    ev(m, { type: "tackle", team: p.team, by: p.id });
    return true;
  }
  p.stun = 0.45;
  ev(m, { type: "tacklefail", team: p.team });
  return false;
}

// ---------- movimiento ----------

function steer(p, tx, tz, speed, dt) {
  const dx = tx - p.x;
  const dz = tz - p.z;
  const d = Math.hypot(dx, dz);
  const want = d > 0.12 ? Math.min(speed, d * 3.2) : 0;
  const dvx = d > 0.001 ? (dx / d) * want : 0;
  const dvz = d > 0.001 ? (dz / d) * want : 0;
  const k = Math.min(1, dt * 9);
  p.vx += (dvx - p.vx) * k;
  p.vz += (dvz - p.vz) * k;
}

function integrate(m, dt) {
  for (const p of m.players) {
    if (p.stun > 0) { p.vx *= 0.85; p.vz *= 0.85; }
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    const sp = Math.hypot(p.vx, p.vz);
    if (sp > 0.4) {
      const k = Math.min(1, dt * 10);
      p.fx += (p.vx / sp - p.fx) * k;
      p.fz += (p.vz / sp - p.fz) * k;
      const fl = Math.hypot(p.fx, p.fz) || 1;
      p.fx /= fl; p.fz /= fl;
    }
    if (p.role === "gk") {
      const u = p.x * -attSign(p.team); // distancia desde la mitad hacia su propio arco
      const uu = clamp(u, HALF - PITCH.boxX, HALF - 0.3);
      p.x = -attSign(p.team) * uu;
      p.z = clamp(p.z, -PITCH.boxZ, PITCH.boxZ);
    } else {
      p.x = clamp(p.x, -HALF + 0.3, HALF - 0.3);
      p.z = clamp(p.z, -SIDE + 0.3, SIDE - 0.3);
    }
  }
  // que no se encimen
  const ps = m.players;
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const a = ps[i];
    const b = ps[j];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.7 && d > 1e-4) {
      const push = (0.7 - d) / 2;
      a.x -= (dx / d) * push; a.z -= (dz / d) * push;
      b.x += (dx / d) * push; b.z += (dz / d) * push;
    }
  }
}

// ---------- IA ----------

function decidePress(m, team) {
  const b = m.ball;
  const fp = field(m, team);
  const bx = b.owner ? b.owner.x : b.x + b.vx * 0.3;
  const bz = b.owner ? b.owner.z : b.z + b.vz * 0.3;
  const d = fp.map((p) => Math.hypot(p.x - bx, p.z - bz) - (p.press ? 0.8 : 0)); // un poco de inercia: no cambian a cada rato
  const presser = d[0] <= d[1] ? fp[0] : fp[1];
  for (const p of fp) p.press = p === presser;
}

function aiKeeper(m, p, dt) {
  const b = m.ball;
  const sk = skillOf(m, p);
  const own = ownGoalX(p.team);
  const att = attSign(p.team);
  if (b.owner === p) {
    p.hold += dt;
    steer(p, own + att * 1.6, 0, 3, dt);
    if (p.hold > 0.9 && !(m.restart && m.restart.t < 0.8)) doPass(m, p);
    return;
  }
  // pelota suelta cerca, en su área, y nadie más cerca: sale a buscarla
  const loose = !b.owner && Math.abs(b.x - own) < PITCH.boxX && Math.abs(b.z) < PITCH.boxZ && Math.hypot(b.vx, b.vz) < 9;
  if (loose) {
    const dMe = dist(p, b);
    const nearest = Math.min(...m.players.filter((q) => q !== p).map((q) => dist(q, b)));
    if (dMe < nearest + 0.4) { steer(p, b.x, b.z, 4.8, dt); return; }
  }
  const tz = clamp(b.z * 0.7, -PITCH.goalW / 2 + 0.3, PITCH.goalW / 2 - 0.3);
  steer(p, own + att * (0.9 + (Math.abs(b.x - own) < 9 ? 0.4 : 0)), tz, 3.6 + sk.keeper * 2, dt);
}

function aiCarrier(m, p, dt) {
  const sk = skillOf(m, p);
  const att = attSign(p.team);
  const gx = goalX(p.team);
  p.hold += dt;
  p.think -= dt;
  if (p.think <= 0) {
    p.think = sk.react * (0.6 + m.rng() * 0.6);
    const dG = Math.hypot(gx - p.x, p.z);
    const k = keeperOf(m, 1 - p.team);
    const lane = laneBlocked(m, p.team, p.x, p.z, gx, clamp(p.z * 0.3, -1.5, 1.5), 0.8) - (segDist(k.x, k.z, p.x, p.z, gx, 0) < 0.8 ? 1 : 0);
    if (dG < 4.5 || (dG < sk.shootRange && lane <= 0 && m.rng() < 0.6) || (dG < sk.shootRange + 3 && p.hold > 4.5)) { doShoot(m, p); return; }
    // ¿pase?
    const mates = m.players.filter((q) => q.team === p.team && q !== p && q.role === "f");
    const press = Math.min(...m.players.filter((q) => q.team !== p.team && q.role === "f").map((q) => dist(q, p)));
    let best = null;
    let bestS = -1e9;
    for (const q of mates) { const s = passScore(m, p, q); if (s > bestS) { bestS = s; best = q; } }
    const myS = openness(m, p.team, p.x + att * 2, p.z) * 0.8;
    if (best && ((press < 1.7 && bestS > 0.8) || bestS > myS + 1.6 || p.hold > 5.5)) { doPass(m, p, 0, 0, best); return; }
    if (p.hold > 7) { doPass(m, p); return; }
    // conducir hacia el arco, esquivando al rival que tapa
    let tx = gx - att * 3;
    let tz = p.z * 0.6;
    for (const q of m.players) {
      if (q.team === p.team || q.role !== "f") continue;
      const ahead = (q.x - p.x) * att;
      if (ahead > 0 && ahead < 3.5 && Math.abs(q.z - p.z) < 1.8) tz = p.z + (p.z >= q.z ? 1 : -1) * 3;
    }
    p.tx = tx;
    p.tz = clamp(tz, -SIDE + 1, SIDE - 1);
  }
  steer(p, p.tx, p.tz, sk.speed * 0.9, dt);
}

function aiSupport(m, p, dt) {
  const sk = skillOf(m, p);
  const att = attSign(p.team);
  const c = m.ball.owner;
  p.think -= dt;
  if (p.think <= 0) {
    p.think = 0.5 + m.rng() * 0.35;
    let best = null;
    let bestS = -1e9;
    const baseX = c.role === "gk" ? -att * (HALF - 8) : c.x;
    for (const du of [2.5, 5.5, 8]) for (const v of [-5.8, -2.5, 2.5, 5.8]) {
      let x = baseX + att * du;
      if (x * att > HALF - 2.5) x = att * (HALF - 2.5);
      const z = v;
      const dc = Math.hypot(x - c.x, z - c.z);
      let s = openness(m, p.team, x, z) - laneBlocked(m, p.team, c.x, c.z, x, z) * 3 + (x - c.x) * att * 0.12 - Math.hypot(x - p.x, z - p.z) * 0.06;
      if (dc < 3.5) s -= 2;
      if (s > bestS) { bestS = s; best = { x, z }; }
    }
    p.tx = best.x;
    p.tz = best.z;
  }
  steer(p, p.tx, p.tz, sk.speed * 0.85, dt);
}

function aiDefend(m, p, dt) {
  const sk = skillOf(m, p);
  const b = m.ball;
  const own = ownGoalX(p.team);
  const c = b.owner;
  if (p.press) {
    if (c) {
      // se pone entre el que lleva la pelota y su arco, y presiona
      const gx = own - c.x;
      const gz = -c.z;
      const gl = Math.hypot(gx, gz) || 1;
      steer(p, c.x + (gx / gl) * 0.7, c.z + (gz / gl) * 0.7, sk.speed, dt);
      if (dist(p, c) < 1.25 && p.cool <= 0 && p.stun <= 0 && !(m.restart && m.restart.taker === c) && m.rng() < dt * 2.6) tryTackle(m, p);
    } else steer(p, b.x + b.vx * 0.25, b.z + b.vz * 0.25, sk.speed, dt); // pelota suelta: va a buscarla
    return;
  }
  // el otro cubre: marca al rival que no tiene la pelota, del lado de su arco (o cuida la zona si la pelota está suelta)
  const others = field(m, 1 - p.team).filter((q) => q !== c);
  const mark = c ? others[0] : null;
  if (mark && dist(mark, c) < 3.2) {
    // los dos rivales juntos: no se amontona, cuida el camino al arco a unos metros de la pelota
    const gx = own - c.x;
    const gz = -c.z;
    const gl = Math.hypot(gx, gz) || 1;
    steer(p, c.x + (gx / gl) * 3.6, c.z + (gz / gl) * 3.6, sk.speed * 0.95, dt);
  } else if (mark) {
    const gx = own - mark.x;
    const gz = -mark.z;
    const gl = Math.hypot(gx, gz) || 1;
    steer(p, mark.x + (gx / gl) * 1.6, mark.z + (gz / gl) * 1.6, sk.speed * 0.95, dt);
  } else {
    steer(p, (b.x + own) / 2, b.z * 0.5, sk.speed * 0.9, dt);
  }
}

function aiField(m, p, dt) {
  const b = m.ball;
  if (p.stun > 0) return;
  if (b.owner === p) {
    if (m.restart && m.restart.taker === p) return; // el saque lo resuelve updateRestart
    aiCarrier(m, p, dt);
  } else if (b.owner && b.owner.team === p.team) aiSupport(m, p, dt);
  else aiDefend(m, p, dt);
}

// ---------- pelota ----------

function goal(m, team) {
  m.score[team]++;
  ev(m, { type: "goal", team, by: m.ball.last ? m.ball.last.id : -1, score: [...m.score] });
  m.ball.owner = null;
  m.ball.vx = m.ball.vz = 0;
  m.restart = null;
  if (m.goldenOn) { finish(m); return; }
  m.pause = 2.3;
  m.pendingKickoff = 1 - team;
}

function updateBall(m, dt) {
  const b = m.ball;
  for (const k in b.noPick) { b.noPick[k] -= dt; if (b.noPick[k] <= 0) delete b.noPick[k]; }
  if (b.owner) {
    const p = b.owner;
    b.x = clamp(p.x + p.fx * 0.5, -HALF + 0.05, HALF - 0.05);
    b.z = clamp(p.z + p.fz * 0.5, -SIDE + 0.05, SIDE - 0.05);
    b.h = 0; b.vh = 0;
    b.vx = p.vx; b.vz = p.vz;
    m.stats.poss[p.team] += dt;
    return;
  }
  const px = b.x;
  b.x += b.vx * dt;
  b.z += b.vz * dt;
  if (b.h > 0 || b.vh !== 0) {
    b.vh -= 9.8 * dt;
    b.h += b.vh * dt;
    if (b.h <= 0) { b.h = 0; b.vh = b.vh < -2 ? -b.vh * 0.35 : 0; }
  }
  const sp = Math.hypot(b.vx, b.vz);
  if (sp > 0) {
    const dec = (b.h > 0.05 ? 0.4 : BALL_DEC) + sp * 0.22;
    const ns = Math.max(0, sp - dec * dt);
    b.vx *= ns / sp;
    b.vz *= ns / sp;
  }
  b.still = sp < 0.3 ? b.still + dt : 0;
  keeperSaves(m, px);
  // ¿gol o afuera?
  if (Math.abs(b.x) > HALF) {
    const side = Math.sign(b.x);
    const scoring = side > 0 ? 0 : 1;
    if (Math.abs(b.z) < PITCH.goalW / 2 && b.h < PITCH.goalH) { goal(m, scoring); return; }
    ev(m, { type: "out", where: "end" });
    if (b.lastTeam === scoring) setRestart(m, "goalkick", 1 - scoring, side * (HALF - 1.6), 0);
    else setRestart(m, "corner", scoring, side * (HALF - 0.35), Math.sign(b.z || 1) * (SIDE - 0.35));
    return;
  }
  if (Math.abs(b.z) > SIDE) {
    ev(m, { type: "out", where: "side" });
    setRestart(m, "kickin", 1 - (b.lastTeam < 0 ? 0 : b.lastTeam), clamp(b.x, -HALF + 1, HALF - 1), Math.sign(b.z) * (SIDE - 0.3));
    return;
  }
  pickups(m);
}

/** Atajadas: cuando un tiro llega a la línea del arquero, según su alcance y su habilidad. */
function keeperSaves(m, prevX) {
  const b = m.ball;
  if (b.kind !== "shot" || !b.shot) return;
  const k = keeperOf(m, 1 - b.shot.team);
  if (b.shot.seen[k.id]) return;
  const crossed = (prevX - k.x) * (b.x - k.x) <= 0 || Math.abs(b.x - k.x) < 0.25;
  if (!crossed) return;
  b.shot.seen[k.id] = true;
  const sk = skillOf(m, k);
  const sp = Math.hypot(b.vx, b.vz);
  const dz = Math.abs(b.z - k.z);
  const reach = 1.5 + sk.keeper * 0.9;
  if (dz > reach || b.h > 2.3 || k.stun > 0) return;
  const chance = Math.min(0.9, (0.4 + sk.keeper) * (1 - clamp((sp - 15) / 20, 0, 0.3)) * (dz < 0.8 ? 1.1 : 0.92));
  if (m.rng() >= chance) return;
  m.stats.saves[k.team]++;
  if (sp < 16.5 || m.rng() < 0.5) {
    Object.assign(b, { owner: k, kind: null, shot: null, last: k, lastTeam: k.team, vx: 0, vz: 0, h: 0, vh: 0 });
    k.hold = 0;
    ev(m, { type: "save", team: k.team, catch: true });
  } else {
    // la desvía hacia un costado: puede irse al córner
    b.vx = b.vx * 0.22;
    b.vz = (b.z >= k.z ? 1 : -1) * (5 + m.rng() * 4);
    b.vh = 2.5;
    b.last = k;
    b.lastTeam = k.team;
    b.kind = "parry";
    b.shot = null;
    b.noPick[k.id] = 0.4;
    ev(m, { type: "save", team: k.team, catch: false });
  }
}

function pickups(m) {
  const b = m.ball;
  if (b.h > 1.0) return;
  const sp = Math.hypot(b.vx, b.vz);
  let best = null;
  let bd = 1e9;
  for (const p of m.players) {
    if (p.stun > 0 || b.noPick[p.id] > 0) continue;
    const r = p.role === "gk" ? KEEPER_REACH : CONTROL;
    const d = Math.hypot(p.x - b.x, p.z - b.z);
    if (d < r && d < bd) { best = p; bd = d; }
  }
  if (!best) return;
  // un tiro fuerte contra un jugador de campo rival rebota (bloqueo); el arquero ataja con keeperSaves
  if (best.role === "f" && b.kind === "shot" && sp > 15 && best.team !== b.lastTeam) {
    b.vx *= -0.25;
    b.vz = b.vz * 0.3 + (m.rng() - 0.5) * 4;
    b.last = best;
    b.lastTeam = best.team;
    b.kind = "block";
    b.shot = null;
    b.noPick[best.id] = 0.3;
    ev(m, { type: "block", team: best.team });
    return;
  }
  if (best.role === "gk" && b.kind === "shot" && best.team !== b.lastTeam && sp > 9) return; // eso lo decide la atajada
  const prevTeam = b.lastTeam;
  Object.assign(b, { owner: best, last: best, lastTeam: best.team, kind: null, shot: null, target: null, vh: 0, h: 0 });
  best.hold = 0;
  best.think = 0;
  if (m.human && best.team === m.human.team && best.role === "f") m.human = best; // con tu equipo en la pelota manejas a quien la lleva
  ev(m, { type: "control", team: best.team, by: best.id, steal: prevTeam !== best.team });
}

// ---------- saques ----------

function updateRestart(m, dt, input) {
  const r = m.restart;
  if (!r) return;
  r.t += dt;
  const tk = r.taker;
  tk.vx = tk.vz = 0;
  if (m.ball.owner !== tk) { m.restart = null; return; }
  const humanTakes = tk === m.human;
  if (humanTakes) {
    // si se toca antes de tiempo, el toque queda guardado y el saque sale apenas se puede (no se pierde)
    if (input.pass || input.shoot) r.queued = { pass: input.pass, shoot: input.shoot, aimSide: input.aimSide, power: input.power, mx: input.mx, mz: input.mz };
    if (r.t < 0.35) return;
    const q = r.queued;
    if (q && q.shoot && r.type !== "kickin") { doShoot(m, tk, q.aimSide, q.power); return; }
    if (q) { doPass(m, tk, q.mx, q.mz); return; }
    if (r.t > 5) doPass(m, tk); // nadie queda esperando para siempre
    return;
  }
  const sk = skillOf(m, tk);
  if (r.t > 0.7 + sk.react * 1.5) {
    if (r.type === "corner" || r.type === "kickoff" || r.type === "kickin" || r.type === "goalkick") doPass(m, tk);
  }
}

// ---------- paso del partido ----------

function finish(m) {
  m.over = true;
  m.restart = null;
  ev(m, { type: "end", score: [...m.score] });
}

/**
 * Avanza el partido. input (solo para tu jugador): { mx, mz } dirección en la cancha (-1…1), pass / shoot / switch (true
 * solo el cuadro en que se aprietan), aimSide (-1 / 1 / null), power (0…1).
 */
export function stepMatch(m, dt, input = {}) {
  if (m.over) return;
  let rest = Math.min(dt, 0.1);
  let first = true;
  while (rest > 1e-6) {
    const h = Math.min(rest, 1 / 50);
    rest -= h;
    step(m, h, first ? input : { mx: input.mx, mz: input.mz });
    first = false;
    if (m.over) return;
  }
}

function step(m, dt, input) {
  m.elapsed += dt;
  if (m.pause > 0) {
    m.pause -= dt;
    for (const p of m.players) { p.vx *= 0.9; p.vz *= 0.9; }
    if (m.pause <= 0 && m.pendingKickoff >= 0) { const t = m.pendingKickoff; m.pendingKickoff = -1; setKickoff(m, t); }
    return;
  }
  if (!m.goldenOn) {
    m.time -= dt;
    if (m.time <= 0) {
      m.time = 0;
      if (m.golden && m.score[0] === m.score[1]) { m.goldenOn = true; ev(m, { type: "golden" }); }
      else { finish(m); return; }
    }
  }
  for (const p of m.players) { p.cool = Math.max(0, p.cool - dt); p.stun = Math.max(0, p.stun - dt); }
  const b = m.ball;
  decidePress(m, 0);
  decidePress(m, 1);
  const hu = m.human;
  // tu jugador
  if (hu) {
    if (input.switch && !(b.owner && b.owner.team === hu.team && b.owner.role === "f")) {
      const other = field(m, hu.team).find((p) => p !== hu);
      if (other) { m.human = other; ev(m, { type: "switch", to: other.id }); }
    }
    const h = m.human;
    const lock = m.restart && m.restart.taker === h;
    if (!lock && h.stun <= 0) {
      const mx = clamp(input.mx || 0, -1, 1);
      const mz = clamp(input.mz || 0, -1, 1);
      const mag = Math.min(1, Math.hypot(mx, mz));
      const top = m.skill.human * (b.owner === h ? 0.9 : 1);
      if (mag > 0.05) steer(h, h.x + (mx / (Math.hypot(mx, mz) || 1)) * 3, h.z + (mz / (Math.hypot(mx, mz) || 1)) * 3, top * mag, dt);
      else { h.vx *= 0.7; h.vz *= 0.7; }
      if (!m.restart) {
        if (b.owner === h) {
          if (input.shoot) doShoot(m, h, input.aimSide, input.power);
          else if (input.pass) doPass(m, h, mx, mz);
        } else if ((input.pass || input.shoot) && b.owner && b.owner.team !== h.team) tryTackle(m, h);
        else if (input.pass && b.owner && b.owner.team === h.team && b.owner !== h) doPass(m, b.owner, 0, 0, h); // "¡pásala!": tu compañero te la da
      }
    }
  }
  updateRestart(m, dt, input);
  // los demás
  for (const p of m.players) {
    if (p === m.human) continue;
    if (p.role === "gk") aiKeeper(m, p, dt);
    else if (!(m.restart && m.restart.taker === p)) aiField(m, p, dt);
  }
  integrate(m, dt);
  if (m.restart && m.restart.taker) {
    // durante un saque la pelota no se mueve y los rivales respetan 3 m
    const tk = m.restart.taker;
    for (const p of m.players) {
      if (p.team === tk.team) continue;
      const d = dist(p, b);
      if (d < 2.6 && d > 1e-3) { p.x = b.x + ((p.x - b.x) / d) * 2.6; p.z = b.z + ((p.z - b.z) / d) * 2.6; }
    }
    b.vx = b.vz = 0;
    return;
  }
  updateBall(m, dt);
}

/** Resultado del partido para el equipo 0 (el tuyo). */
export const resultOf = (m) => ({ my: m.score[0], their: m.score[1] });
