// Avance de los deportes nuevos (Pichanga Choco 3 contra 3 y Básquet 2 contra 2), aparte del de los modos de siempre.
// Vive en progress.sports (versionado). Lógica pura, sin DOM, para probarla en Node (scripts/qa/deportes-logica.mjs).
// Los premios de copa se marcan como cobrados aquí (una vez por dificultad); quien llama los paga con Matipuntos.

export const SPORTS_VERSION = 2; // v2: se empieza en "accesible" (ver normalizeSports)
export const SPORTS = ["pichanga", "basquet2v2"];
export const DIFFS = ["accesible", "normal", "desafio"];
export const DIFF_NAMES = { accesible: "Accesible", normal: "Normal", desafio: "Desafío" };
export const CUP_ROUNDS = 3;

/** Rivales de la copa (de menos a más). */
export const CUP_RIVALS = {
  pichanga: [
    { name: "Los Cacaítos", color: 0xff8a1f },
    { name: "Las Trufas", color: 0x7a3f22 },
    { name: "Los Menta FC", color: 0x2fbf86 },
  ],
  basquet2v2: [
    { name: "Dúo Chispa", color: 0xff8a1f },
    { name: "Las Nubes", color: 0x6aa8ff },
    { name: "Los Cohetes", color: 0x9a5cff },
  ],
};
export const ROUND_NAMES = ["Cuartos de final", "Semifinal", "Final"];

/** Premio (Matipuntos) por ganar la copa la primera vez en cada dificultad. */
export const CUP_REWARD = { accesible: 60, normal: 100, desafio: 150 };

const blankSport = () => ({ played: 0, wins: 0, draws: 0, losses: 0, scored: 0, against: 0, cup: { round: 0 }, cups: { accesible: 0, normal: 0, desafio: 0 }, diff: "accesible", claimed: [] });

const nat = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

export function normalizeSports(raw) {
  const out = { v: SPORTS_VERSION };
  for (const id of SPORTS) {
    const src = raw && typeof raw === "object" && raw[id] && typeof raw[id] === "object" ? raw[id] : {};
    const s = blankSport();
    for (const k of ["played", "wins", "draws", "losses", "scored", "against"]) s[k] = nat(src[k]);
    s.cup.round = Math.min(CUP_ROUNDS - 1, nat(src.cup && src.cup.round));
    for (const d of DIFFS) s.cups[d] = nat(src.cups && src.cups[d]);
    s.diff = DIFFS.includes(src.diff) ? src.diff : "accesible";
    // v1 → v2: antes se partía en "normal", que quedó difícil para aprender; quien no ganó copas ahí pasa a "accesible"
    if (raw && raw.v === 1 && s.diff === "normal" && !DIFFS.some((d) => s.cups[d] > 0)) s.diff = "accesible";
    s.claimed = Array.isArray(src.claimed) ? [...new Set(src.claimed.filter((x) => DIFFS.includes(x)))] : [];
    out[id] = s;
  }
  return out;
}

export function sportsOf(progress) {
  if (!progress.sports || progress.sports.v !== SPORTS_VERSION || SPORTS.some((id) => !progress.sports[id])) progress.sports = normalizeSports(progress.sports);
  return progress.sports;
}

export const sportOf = (progress, id) => sportsOf(progress)[id];
export const cupsWon = (progress, id) => DIFFS.reduce((n, d) => n + sportOf(progress, id).cups[d], 0);

export function setDifficulty(progress, id, diff) {
  if (DIFFS.includes(diff)) sportOf(progress, id).diff = diff;
  return sportOf(progress, id).diff;
}

/** El rival que toca en la copa (según la ronda guardada). */
export function cupRival(progress, id) {
  const s = sportOf(progress, id);
  return { ...CUP_RIVALS[id][s.cup.round], round: s.cup.round, roundName: ROUND_NAMES[s.cup.round] };
}

/**
 * Guarda un partido terminado. mode: "amistoso" | "copa". En la copa, ganar pasa a la ronda siguiente; perder deja la misma
 * ronda para intentarlo otra vez (no se pierde nada). Ganar la final suma una copa y, la primera vez en esa dificultad, un premio.
 * Devuelve { result: "win"|"draw"|"loss", cupWon, nextRound, reward }.
 */
export function recordMatch(progress, id, { mode = "amistoso", diff = "normal", my = 0, their = 0 } = {}) {
  const s = sportOf(progress, id);
  my = nat(my);
  their = nat(their);
  s.played++;
  s.scored += my;
  s.against += their;
  const result = my > their ? "win" : my < their ? "loss" : "draw";
  if (result === "win") s.wins++;
  else if (result === "loss") s.losses++;
  else s.draws++;
  const out = { result, cupWon: false, nextRound: s.cup.round, reward: 0, diff };
  if (mode === "copa" && result === "win") {
    if (s.cup.round >= CUP_ROUNDS - 1) {
      s.cup.round = 0;
      if (DIFFS.includes(diff)) s.cups[diff]++;
      out.cupWon = true;
      if (DIFFS.includes(diff) && !s.claimed.includes(diff)) {
        s.claimed.push(diff);
        out.reward = CUP_REWARD[diff];
      }
    } else s.cup.round++;
    out.nextRound = s.cup.round;
  }
  return out;
}
