// Básquet 2 contra 2 en media cancha: la simulación (lógica pura, sin three.js ni DOM). El dibujo está en
// js/basquet2v2-game.js y scripts/qa/deportes-logica.mjs la prueba con muchos partidos.
//
// Coordenadas: el aro está en (0, HOOP_Z) a 3,05 m de alto; x va de -7,5 a 7,5 y z de 0 (línea de fondo) a 14.
// Reglas simplificadas (se explican en el juego):
//  · Canasta: 2 puntos, o 3 desde detrás de la línea (6 m del aro).
//  · Después de una canasta o de una pelota afuera, la pelota pasa al otro equipo y se saca desde arriba ("check").
//  · Si la defensa recupera la pelota (rebote o robo), tiene que sacarla detrás de la línea de 3 antes de tirar.
//  · Gana quien llega primero a la meta de puntos, o quien va arriba cuando se acaba el tiempo (en la copa, si hay
//    empate, la siguiente canasta gana).

export const COURT = { W: 15, D: 14, hoopZ: 1.3, rimH: 3.05, three: 6.0, topZ: 9.6 };
export const MATCH_SECS = 180;
export const TARGET = 11;

// Calibrado con el "jugador humano" simulado (scripts/qa/jugador-humano.mjs), no con un robot perfecto (ver pichanga-sim.js).
export const DIFFICULTY = {
  accesible: { speed: 4.4, react: 0.68, steal: 0.1, shot: 0.68, reb: 0.34, human: 6.1, humanSteal: 0.6, humanShot: 1.2, target: 9, autoSteal: true, safePass: 0.5, reach: 1.7 },
  normal: { speed: 4.85, react: 0.48, steal: 0.15, shot: 0.82, reb: 0.44, human: 5.9, humanSteal: 0.5, humanShot: 1.1, target: 11, autoSteal: false, safePass: 0.75, reach: 1.55 },
  desafio: { speed: 5.2, react: 0.36, steal: 0.2, shot: 0.9, reb: 0.56, human: 5.8, humanSteal: 0.42, humanShot: 1.0, target: 11, autoSteal: false, safePass: 1, reach: 1.4 },
};
const ALLY = { speed: 5.0, react: 0.4, steal: 0.2, shot: 0.9, reb: 0.5 };

const HX = COURT.W / 2;
const HOOP = { x: 0, z: COURT.hoopZ };

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
const hoopDist = (p) => Math.hypot(p.x - HOOP.x, p.z - HOOP.z);
const ev = (m, e) => { m.events.push(e); if (m.events.length > 60) m.events.shift(); };

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1);
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

export function createMatch(opts = {}) {
  const diff = DIFFICULTY[opts.difficulty] ? opts.difficulty : "normal";
  const m = {
    diff, skill: DIFFICULTY[diff], secs: opts.secs || MATCH_SECS, time: opts.secs || MATCH_SECS, target: opts.target || DIFFICULTY[diff].target,
    golden: !!opts.golden, goldenOn: false, over: false, score: [0, 0], players: [], human: null, aiOnly: !!opts.aiOnly,
    ball: { x: 0, z: COURT.topZ, h: 1, vx: 0, vz: 0, vh: 0, owner: null, kind: null, shot: null, pass: null, last: null, lastTeam: -1, noPick: {}, still: 0 },
    offense: 0, mustClear: -1, check: null, pause: 0, pending: null, events: [], elapsed: 0, possT: 0,
    stats: { made: [0, 0], att: [0, 0], three: [0, 0], reb: [0, 0], steals: [0, 0], blocks: [0, 0], passes: [0, 0] },
    rng: mulberry32(opts.seed || 1),
  };
  let id = 0;
  for (const team of [0, 1]) for (const slot of [0, 1]) m.players.push({ id: id++, team, slot, x: 0, z: 0, vx: 0, vz: 0, fx: 0, fz: -1, cool: 0, stun: 0, think: 0, tx: 0, tz: 0, hold: 0, jump: 0, jh: 0, charge: -1, guard: null });
  if (!m.aiOnly) m.human = m.players[0];
  setCheck(m, 0);
  return m;
}

const teamOf = (m, t) => m.players.filter((p) => p.team === t);
const skillOf = (m, p) => (p.team === 0 ? ALLY : m.skill);

/** Saque desde arriba ("check") para `team`: todos a sus lugares y la pelota al que saca. */
export function setCheck(m, team) {
  m.offense = team;
  m.mustClear = -1;
  const off = teamOf(m, team);
  const def = teamOf(m, 1 - team);
  const spots = [[0, COURT.topZ], [-4.8, 5.2]];
  off.forEach((p, i) => Object.assign(p, { x: spots[i][0], z: spots[i][1], vx: 0, vz: 0, fx: 0, fz: -1, hold: 0, stun: 0, charge: -1, jump: 0, jh: 0 }));
  def.forEach((p, i) => Object.assign(p, { x: spots[i][0] * 0.8, z: spots[i][1] - 2.4, vx: 0, vz: 0, fx: 0, fz: 1, stun: 0, charge: -1, jump: 0, jh: 0 }));
  // marca: cada defensor al atacante que tiene enfrente
  def.forEach((p, i) => { p.guard = off[i]; });
  off.forEach((p) => { p.guard = null; });
  const taker = off[0];
  const b = m.ball;
  Object.assign(b, { owner: taker, kind: null, shot: null, pass: null, last: taker, lastTeam: team, vx: 0, vz: 0, vh: 0, h: 1, noPick: {}, still: 0 });
  m.check = { team, t: 0, taker };
  m.possT = 0;
  if (m.human && team === m.human.team) m.human = taker;
  ev(m, { type: "check", team });
}

function changePossession(m, team, why) {
  // la defensa recuperó la pelota: pasa a atacar, pero primero debe sacarla detrás de la línea de 3
  m.offense = team;
  m.mustClear = team;
  m.possT = 0;
  const off = teamOf(m, team);
  const def = teamOf(m, 1 - team);
  def.forEach((p, i) => { p.guard = off[i]; });
  off.forEach((p) => { p.guard = null; });
  ev(m, { type: "turnover", team, why });
}

function giveBall(m, p) {
  const b = m.ball;
  const prev = b.lastTeam;
  Object.assign(b, { owner: p, kind: null, shot: null, pass: null, last: p, lastTeam: p.team, vx: 0, vz: 0, vh: 0, still: 0 });
  p.hold = 0;
  p.think = 0;
  p.charge = -1;
  if (p.team !== m.offense) changePossession(m, p.team, "recover");
  else if (prev !== p.team && m.mustClear !== p.team) m.mustClear = -1;
  if (m.human && p.team === m.human.team) m.human = p;
}

// ---------- acciones ----------

/** Probabilidad de embocar desde donde está p (antes del ajuste por tiempo de tiro). */
export function shotChance(m, p) {
  const d = hoopDist(p);
  let c = d < 1.8 ? 0.72 : d < 4 ? 0.56 : d < COURT.three ? 0.46 : d < 7.6 ? 0.36 : 0.18;
  let dd = 9;
  for (const q of m.players) if (q.team !== p.team) dd = Math.min(dd, dist(p, q));
  if (dd < 1.0) c *= 0.55;
  else if (dd < 1.8) c *= 0.78;
  c *= p === m.human ? m.skill.humanShot : skillOf(m, p).shot;
  return clamp(c, 0.05, 0.93);
}

/** Tiro. quality: 1 normal; >1 si soltaste en el momento justo (barra), <1 si no. */
export function doShoot(m, p, quality = 1) {
  const b = m.ball;
  if (b.owner !== p) return false;
  if (m.mustClear === p.team && !m.goldenOn) return false;
  const d = hoopDist(p);
  const three = d >= COURT.three;
  let chance = shotChance(m, p) * quality;
  // tapón: un rival saltando encima
  let blocked = false;
  for (const q of m.players) {
    if (q.team === p.team || q.jump <= 0) continue;
    if (dist(q, p) < 1.25 && m.rng() < (q === m.human ? 0.42 : 0.25)) { blocked = true; break; }
  }
  const made = !blocked && m.rng() < clamp(chance, 0.03, 0.95);
  const T = 0.75 + d * 0.06;
  Object.assign(b, { owner: null, kind: "shot", pass: null, last: p, lastTeam: p.team, noPick: { [p.id]: 0.3 } });
  b.shot = { team: p.team, pts: three ? 3 : 2, made, blocked, t: 0, T, x0: p.x, z0: p.z, h0: 2.1 };
  b.x = p.x; b.z = p.z; b.h = 2.1;
  p.hold = 0;
  p.charge = -1;
  p.cool = 0.4;
  m.stats.att[p.team]++;
  ev(m, { type: "shot", team: p.team, from: p.id, three, made, blocked, chance });
  if (blocked) {
    // la pelota sale despedida: queda suelta
    b.kind = "loose";
    b.shot = null;
    const a = m.rng() * Math.PI * 2;
    b.vx = Math.cos(a) * 3.5;
    b.vz = Math.sin(a) * 3.5 + 1;
    b.vh = 2.5;
    const blocker = m.players.find((q) => q.team !== p.team && q.jump > 0 && dist(q, p) < 1.3);
    if (blocker) m.stats.blocks[blocker.team]++;
    ev(m, { type: "block", team: 1 - p.team });
  }
  return true;
}

export function doPass(m, p, dx = 0, dz = 0) {
  const b = m.ball;
  if (b.owner !== p) return null;
  const mate = m.players.find((q) => q.team === p.team && q !== p);
  const tx = mate.x + mate.vx * 0.3;
  const tz = mate.z + mate.vz * 0.3;
  const d = Math.hypot(tx - p.x, tz - p.z) || 1;
  const sp = clamp(8 + d * 0.5, 9, 14);
  Object.assign(b, { owner: null, kind: "pass", shot: null, last: p, lastTeam: p.team, h: 1.4, vh: 0, noPick: { [p.id]: 0.3 }, x: p.x, z: p.z });
  b.vx = ((tx - p.x) / d) * sp;
  b.vz = ((tz - p.z) / d) * sp;
  b.pass = { to: mate, tried: {} };
  p.hold = 0;
  p.cool = 0.3;
  p.charge = -1;
  m.stats.passes[p.team]++;
  ev(m, { type: "pass", team: p.team, from: p.id, to: mate.id });
  return mate;
}

export function trySteal(m, p) {
  const b = m.ball;
  const c = b.owner;
  p.cool = 0.9;
  if (!c || c.team === p.team || (m.check && m.check.taker === c)) return false;
  const human = p === m.human;
  if (dist(p, c) > (human ? m.skill.reach : 1.35)) { p.stun = human ? 0 : 0.15; return false; }
  const chance = p === m.human ? m.skill.humanSteal : skillOf(m, p).steal + 0.1;
  if (m.rng() < chance) {
    c.stun = 0.5;
    m.stats.steals[p.team]++;
    ev(m, { type: "steal", team: p.team, by: p.id });
    giveBall(m, p);
    return true;
  }
  p.stun = human ? 0.2 : 0.4;
  ev(m, { type: "stealfail", team: p.team });
  return false;
}

function jump(p) {
  if (p.jump > 0 || p.stun > 0) return;
  p.jump = 0.55;
}

// ---------- movimiento ----------

function steer(p, tx, tz, speed, dt) {
  const dx = tx - p.x;
  const dz = tz - p.z;
  const d = Math.hypot(dx, dz);
  const want = d > 0.1 ? Math.min(speed, d * 3.2) : 0;
  const k = Math.min(1, dt * 9);
  p.vx += ((d > 1e-3 ? (dx / d) * want : 0) - p.vx) * k;
  p.vz += ((d > 1e-3 ? (dz / d) * want : 0) - p.vz) * k;
}

function integrate(m, dt) {
  for (const p of m.players) {
    if (p.stun > 0) { p.vx *= 0.85; p.vz *= 0.85; }
    p.x = clamp(p.x + p.vx * dt, -HX + 0.3, HX - 0.3);
    p.z = clamp(p.z + p.vz * dt, 0.3, COURT.D - 0.3);
    const sp = Math.hypot(p.vx, p.vz);
    if (sp > 0.4) {
      const k = Math.min(1, dt * 10);
      p.fx += (p.vx / sp - p.fx) * k;
      p.fz += (p.vz / sp - p.fz) * k;
      const l = Math.hypot(p.fx, p.fz) || 1;
      p.fx /= l; p.fz /= l;
    }
    if (p.jump > 0) { p.jump -= dt; p.jh = Math.sin(clamp(1 - p.jump / 0.55, 0, 1) * Math.PI) * 0.75; } else p.jh = 0;
    // no se puede estar dentro del poste del aro
    const dh = Math.hypot(p.x - HOOP.x, p.z - (HOOP.z - 1.2));
    if (dh < 0.5) { p.z = HOOP.z - 1.2 + 0.5; }
  }
  const ps = m.players;
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const a = ps[i];
    const b = ps[j];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.75 && d > 1e-4) {
      const push = (0.75 - d) / 2;
      a.x -= (dx / d) * push; a.z -= (dz / d) * push;
      b.x += (dx / d) * push; b.z += (dz / d) * push;
    }
  }
}

// ---------- IA ----------

const SPOTS = [[-5.2, 5.6], [5.2, 5.6], [-6.6, 1.6], [6.6, 1.6], [0, 8.4], [-2.3, 5.0], [2.3, 5.0], [0.9, 2.2], [-0.9, 2.2]];

function openness(m, team, x, z) {
  let best = 6;
  for (const q of m.players) if (q.team !== team) best = Math.min(best, Math.hypot(q.x - x, q.z - z));
  return best;
}

function aiCarrier(m, p, dt) {
  const sk = skillOf(m, p);
  p.hold += dt;
  p.think -= dt;
  if (p.think <= 0) {
    p.think = sk.react * (0.6 + m.rng() * 0.6);
    if (m.mustClear === p.team) {
      // primero sacarla detrás de la línea de 3
      const d = hoopDist(p) || 1;
      const k = (COURT.three + 0.8) / d;
      p.tx = clamp(HOOP.x + (p.x - HOOP.x) * k, -HX + 1, HX - 1);
      p.tz = clamp(HOOP.z + (p.z - HOOP.z) * k, 2, COURT.D - 1);
    } else {
      const c = shotChance(m, p);
      const mate = m.players.find((q) => q.team === p.team && q !== p);
      const mc = shotChance(m, mate) * (openness(m, p.team, mate.x, mate.z) > 1.8 ? 1.1 : 0.7);
      const lane = m.players.filter((q) => q.team !== p.team && segDist(q.x, q.z, p.x, p.z, mate.x, mate.z) < 0.7).length;
      if (c > 0.5 || (c > 0.3 && m.rng() < 0.45) || p.hold > 7.5) { doShoot(m, p); return; }
      if (mc > c + 0.08 && lane === 0 && m.rng() < 0.75) { doPass(m, p); return; }
      // ir hacia el aro si hay camino; si no, moverse a un costado
      const def = m.players.find((q) => q.team !== p.team && q.guard === p);
      const blocked = def && segDist(def.x, def.z, p.x, p.z, HOOP.x, HOOP.z) < 0.8 && dist(def, p) < 2.5;
      if (!blocked) { p.tx = HOOP.x + (p.x - HOOP.x) * 0.25; p.tz = HOOP.z + 1.2; }
      else { p.tx = clamp(p.x + (p.x >= 0 ? -1 : 1) * 2.5, -HX + 1, HX - 1); p.tz = clamp(p.z + (m.rng() - 0.5) * 2, 2.5, 9); }
    }
  }
  steer(p, p.tx, p.tz, sk.speed * 0.9, dt);
}

function aiOffBall(m, p, dt) {
  const sk = skillOf(m, p);
  p.think -= dt;
  if (p.think <= 0) {
    p.think = 0.6 + m.rng() * 0.4;
    const c = m.ball.owner;
    let best = null;
    let bs = -1e9;
    for (const [x, z] of SPOTS) {
      if (c && Math.hypot(x - c.x, z - c.z) < 3) continue;
      const s = openness(m, p.team, x, z) - Math.hypot(x - p.x, z - p.z) * 0.08 + (m.rng() * 0.6);
      if (s > bs) { bs = s; best = [x, z]; }
    }
    if (best) { p.tx = best[0]; p.tz = best[1]; }
  }
  steer(p, p.tx, p.tz, sk.speed * 0.85, dt);
}

function aiDefender(m, p, dt) {
  const sk = skillOf(m, p);
  const t = p.guard || m.players.find((q) => q.team !== p.team);
  const onBall = m.ball.owner === t;
  const gap = onBall ? 1.0 : 1.9;
  const dx = HOOP.x - t.x;
  const dz = HOOP.z - t.z;
  const d = Math.hypot(dx, dz) || 1;
  steer(p, t.x + (dx / d) * Math.min(gap, d * 0.6), t.z + (dz / d) * Math.min(gap, d * 0.6), sk.speed, dt);
  if (onBall && p.cool <= 0 && p.stun <= 0 && dist(p, t) < 1.25 && !(m.check && m.check.taker === t) && m.rng() < dt * 1.6) trySteal(m, p);
}

function aiRebound(m, p, dt) {
  const sk = skillOf(m, p);
  const b = m.ball;
  // hacia donde cae la pelota (o a cuidar el aro si todavía va subiendo)
  const tx = b.x + b.vx * 0.35;
  const tz = b.z + b.vz * 0.35;
  steer(p, tx, tz, sk.speed, dt);
  if (b.h < 3.2 && b.h > 2.0 && b.vh < 0 && dist(p, b) < 1.4 && m.rng() < dt * 6 * sk.reb) jump(p);
}

// ---------- pelota ----------

function updateBall(m, dt) {
  const b = m.ball;
  for (const k in b.noPick) { b.noPick[k] -= dt; if (b.noPick[k] <= 0) delete b.noPick[k]; }
  if (b.owner) {
    const p = b.owner;
    b.x = p.x + p.fx * 0.45;
    b.z = p.z + p.fz * 0.45;
    // botando (la altura la anima el dibujo)
    b.h = 1.0 + p.jh;
    m.possT += dt;
    return;
  }
  if (b.kind === "shot" && b.shot) {
    const s = b.shot;
    s.t += dt;
    const u = Math.min(1, s.t / s.T);
    b.x = s.x0 + (HOOP.x - s.x0) * u;
    b.z = s.z0 + (HOOP.z - s.z0) * u;
    b.h = s.h0 + (COURT.rimH + 0.25 - s.h0) * u + Math.sin(u * Math.PI) * (1.6 + s.T * 0.8);
    if (u >= 1) {
      if (s.made) {
        m.score[s.team] += s.pts;
        m.stats.made[s.team]++;
        if (s.pts === 3) m.stats.three[s.team]++;
        ev(m, { type: "score", team: s.team, pts: s.pts, score: [...m.score] });
        b.kind = "net";
        b.shot = null;
        b.vx = b.vz = 0;
        b.vh = -1;
        if (m.goldenOn || m.score[s.team] >= m.target) { finish(m); return; }
        m.pause = 1.6;
        m.pending = 1 - s.team;
      } else {
        // rebota en el aro y queda suelta
        const a = m.rng() * Math.PI * 2;
        const sp = 2 + m.rng() * 2.5;
        b.kind = "loose";
        b.shot = null;
        b.vx = Math.cos(a) * sp;
        b.vz = Math.abs(Math.sin(a)) * sp + 0.5;
        b.vh = 3.2 + m.rng() * 1.5;
        b.h = COURT.rimH + 0.2;
        ev(m, { type: "rim", team: s.team });
      }
    }
    return;
  }
  if (b.kind === "net") { b.h = Math.max(0.3, b.h - dt * 4); return; }
  // pelota suelta o en un pase
  b.x += b.vx * dt;
  b.z += b.vz * dt;
  if (b.kind === "pass") {
    // un pase va recto, a la altura del pecho; un rival muy cerca de la línea puede cortarlo (una vez)
    for (const q of m.players) {
      if (q.team === b.lastTeam || b.pass.tried[q.id]) continue;
      if (Math.hypot(q.x - b.x, q.z - b.z) < 0.55) {
        b.pass.tried[q.id] = true;
        // los pases de tu equipo se cortan menos en accesible y normal (safePass)
        if (m.rng() < (q === m.human ? 0.6 : skillOf(m, q).steal * 1.6 * (b.lastTeam === 0 && m.human ? m.skill.safePass : 1))) { m.stats.steals[q.team]++; ev(m, { type: "steal", team: q.team, by: q.id, pass: true }); giveBall(m, q); return; }
      }
    }
  } else {
    b.vh -= 9.8 * dt;
    b.h += b.vh * dt;
    if (b.h <= 0.12) {
      b.h = 0.12;
      if (b.vh < -1.5) { b.vh = -b.vh * 0.55; b.vx *= 0.8; b.vz *= 0.8; } else b.vh = 0;
    }
    const sp = Math.hypot(b.vx, b.vz);
    if (b.h <= 0.13 && sp > 0) { const ns = Math.max(0, sp - 3 * dt); b.vx *= ns / sp; b.vz *= ns / sp; }
  }
  b.still = Math.hypot(b.vx, b.vz) < 0.3 && b.h < 0.2 ? b.still + dt : 0;
  // afuera: la pelota cambia de equipo y se saca desde arriba
  if (Math.abs(b.x) > HX || b.z < 0 || b.z > COURT.D) {
    ev(m, { type: "out" });
    setCheck(m, b.lastTeam < 0 ? 0 : 1 - b.lastTeam);
    return;
  }
  // atrapar: un pase o una pelota suelta (en el aire hay que alcanzarla: saltar ayuda)
  let best = null;
  let bd = 1e9;
  for (const p of m.players) {
    if (p.stun > 0 || b.noPick[p.id] > 0) continue;
    const reach = 2.55 + p.jh * 1.1;
    if (b.h > reach) continue;
    const d = Math.hypot(p.x - b.x, p.z - b.z);
    const r = b.kind === "pass" && b.pass.to === p ? 0.9 : 0.7;
    if (d < r && d < bd) { best = p; bd = d; }
  }
  if (best) {
    const wasShotMiss = b.kind === "loose";
    if (wasShotMiss) { m.stats.reb[best.team]++; ev(m, { type: "rebound", team: best.team, by: best.id, off: best.team === m.offense }); }
    giveBall(m, best);
  }
}

// ---------- paso ----------

function finish(m) {
  m.over = true;
  m.check = null;
  ev(m, { type: "end", score: [...m.score] });
}

/**
 * input (tu jugador): { mx, mz, pass, shootHold (botón de tiro apretado), shootPress (recién apretado), switch }.
 * El tiro sale al SOLTAR el botón; la barra de tiempo (p.charge, 0…1) premia soltar en la zona buena (0,45–0,7).
 */
export function stepMatch(m, dt, input = {}) {
  if (m.over) return;
  let rest = Math.min(dt, 0.1);
  let first = true;
  while (rest > 1e-6) {
    const h = Math.min(rest, 1 / 50);
    rest -= h;
    step(m, h, first ? input : { mx: input.mx, mz: input.mz, shootHold: input.shootHold });
    first = false;
    if (m.over) return;
  }
}

export const CHARGE_SECS = 0.9;
export const timingQuality = (c) => (c >= 0.45 && c <= 0.7 ? 1.22 : c >= 0.3 && c <= 0.85 ? 1.0 : 0.8);

function step(m, dt, input) {
  m.elapsed += dt;
  if (m.pause > 0) {
    m.pause -= dt;
    updateBall(m, dt);
    for (const p of m.players) { p.vx *= 0.9; p.vz *= 0.9; }
    if (m.pause <= 0 && m.pending != null) { const t = m.pending; m.pending = null; setCheck(m, t); }
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
  if (m.check) {
    m.check.t += dt;
    if (b.owner !== m.check.taker) m.check = null;
    else if (m.check.t > 0.7) { m.check = null; ev(m, { type: "live" }); }
  }
  // tu jugador
  const hu = m.human;
  if (hu) {
    if (input.switch && !(b.owner && b.owner.team === hu.team)) {
      const other = m.players.find((p) => p.team === hu.team && p !== hu);
      m.human = other;
      ev(m, { type: "switch", to: other.id });
    }
    const h = m.human;
    if (h.stun <= 0 && !(m.check && m.check.taker === h)) {
      const mx = clamp(input.mx || 0, -1, 1);
      const mz = clamp(input.mz || 0, -1, 1);
      const mag = Math.min(1, Math.hypot(mx, mz));
      if (mag > 0.05) steer(h, h.x + (mx / (Math.hypot(mx, mz) || 1)) * 3, h.z + (mz / (Math.hypot(mx, mz) || 1)) * 3, m.skill.human * (b.owner === h ? 0.92 : 1) * mag, dt);
      else { h.vx *= 0.7; h.vz *= 0.7; }
    } else if (m.check && m.check.taker === h) { h.vx = h.vz = 0; }
    if (b.owner === h) {
      if (input.shootHold) {
        if (h.charge < 0) h.charge = 0;
        h.charge += dt / CHARGE_SECS;
        if (h.charge >= 1.15) { // se pasó: tira igual (mal)
          if (!doShoot(m, h, 0.75)) { h.charge = -1; ev(m, { type: "mustclear" }); }
        }
      } else if (h.charge >= 0) {
        const q = timingQuality(h.charge);
        if (!doShoot(m, h, q)) { h.charge = -1; ev(m, { type: "mustclear" }); } else ev(m, { type: "timing", q });
      }
      if (input.pass && b.owner === h) doPass(m, h, mx0(input), mz0(input));
    } else {
      h.charge = -1;
      if (input.pass && b.owner && b.owner.team !== h.team) trySteal(m, h);
      // en accesible y normal, pegarse al rival que lleva la pelota ya intenta robarla
      else if (m.skill.autoSteal && b.owner && b.owner.team !== h.team && h.cool <= 0 && dist(h, b.owner) < 0.95 && !(m.check && m.check.taker === b.owner)) trySteal(m, h);
      if (input.shootPress) jump(h); // sin la pelota, el botón de tiro es "saltar": tapar un tiro o ganar un rebote
    }
  }
  // los demás
  const off = m.offense;
  for (const p of m.players) {
    if (p === m.human || p.stun > 0) continue;
    if (m.check && m.check.taker === p) { p.vx = p.vz = 0; continue; }
    if (b.owner === p) aiCarrier(m, p, dt);
    else if (!b.owner && (b.kind === "loose" || (b.kind === "shot" && b.shot && b.shot.t > b.shot.T * 0.6))) aiRebound(m, p, dt);
    else if (!b.owner && b.kind === "pass" && b.pass && b.pass.to === p) steer(p, b.x, b.z, skillOf(m, p).speed, dt);
    else if (p.team === off) aiOffBall(m, p, dt);
    else aiDefender(m, p, dt);
    // la IA salta para tapar si el rival que marca está por tirar (solo un poquito de las veces)
    if (p.team !== off && b.owner && b.owner.team === off && p.guard === b.owner && b.owner.charge > 0.3 && dist(p, b.owner) < 1.3 && m.rng() < dt * 1.5) jump(p);
  }
  integrate(m, dt);
  if (m.check) {
    const tk = m.check.taker;
    for (const p of m.players) {
      if (p.team === tk.team) continue;
      const d = dist(p, tk);
      if (d < 2 && d > 1e-3) { p.x = tk.x + ((p.x - tk.x) / d) * 2; p.z = tk.z + ((p.z - tk.z) / d) * 2; }
    }
  }
  // ¿ya la sacó detrás de la línea de 3?
  if (m.mustClear >= 0 && b.owner && b.owner.team === m.mustClear && hoopDist(b.owner) >= COURT.three) { m.mustClear = -1; ev(m, { type: "cleared", team: b.owner.team }); }
  updateBall(m, dt);
  // pelota suelta y quieta demasiado rato (nadie la toma): saca desde arriba el equipo que no la tocó último
  if (!b.owner && b.still > 3) setCheck(m, b.lastTeam < 0 ? 0 : 1 - b.lastTeam);
}

const mx0 = (i) => i.mx || 0;
const mz0 = (i) => i.mz || 0;

export const resultOf = (m) => ({ my: m.score[0], their: m.score[1] });
