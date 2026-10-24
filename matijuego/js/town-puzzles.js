// Las puertas de juegos chicos del Pueblo Matichoc: el Gato contra la máquina, el Mini Sudoku de 4×4 y el Cachipún.
// Se abren en un cuadro (#puzzle-dialog) sobre el pueblo. La lógica vive en puzzles-logic.js; aquí solo la pantalla.
// Cada puerta da un premio una vez al día (lo entrega el pueblo con `onWin`); después se puede seguir jugando por diversión.

import * as audio from "./audio.js?v=b28a0715a9";
import { gatoWinner, gatoFull, gatoMachineMove, sudokuNew, sudokuSolved, sudokuConflict, cachipun } from "./puzzles-logic.js?v=b28a0715a9";

export const PUZZLES = {
  gato: { title: "🐱 El Gato", reward: 4 },
  sudoku: { title: "🔢 Mini Sudoku", reward: 8 },
  cachipun: { title: "✊ Cachipún", reward: 3 },
};

const SYMBOLS = ["", "🍫", "🍪", "🍬", "🍓"];
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

let dialog = null;
let boardEl = null;
let statusEl = null;
let againBtn = null;
let current = null; // { kind, start, onWin, onClose }

function ensureDom() {
  if (dialog) return true;
  dialog = document.getElementById("puzzle-dialog");
  if (!dialog) return false;
  boardEl = document.getElementById("puzzle-board");
  statusEl = document.getElementById("puzzle-status");
  againBtn = document.getElementById("puzzle-again");
  document.getElementById("puzzle-close").addEventListener("click", closePuzzle);
  dialog.addEventListener("click", (e) => { if (e.target === dialog) closePuzzle(); });
  againBtn.addEventListener("click", () => current && current.start());
  return true;
}

export function puzzleIsOpen() {
  return !!dialog && !dialog.classList.contains("hidden");
}

export function closePuzzle() {
  if (!dialog) return;
  dialog.classList.add("hidden");
  const c = current;
  current = null;
  if (c && c.onClose) c.onClose();
}

/** Abre una puerta. `onWin()` devuelve el texto del premio (o "" si hoy ya lo ganó). `onClose()` se llama al salir. */
export function openPuzzle(kind, { onWin, onClose } = {}) {
  if (!ensureDom() || !PUZZLES[kind]) return false;
  const p = PUZZLES[kind];
  document.getElementById("puzzle-title").textContent = p.title;
  const win = () => {
    audio.playVictory();
    return onWin ? onWin(kind) : "";
  };
  const starters = { gato: () => startGato(win), sudoku: () => startSudoku(win), cachipun: () => startCachipun(win) };
  current = { kind, start: starters[kind], onWin, onClose };
  dialog.classList.remove("hidden");
  current.start();
  return true;
}

const say = (text) => { statusEl.textContent = text; };
const clearBoard = () => { boardEl.replaceChildren(); boardEl.className = "pz-board"; };
const extraButtons = () => {
  document.querySelectorAll("#puzzle-dialog .pz-extra").forEach((b) => b.remove());
};
const addExtra = (label, fn) => {
  const b = el("button", "btn-secondary pz-extra", label);
  b.type = "button";
  b.addEventListener("click", fn);
  againBtn.before(b);
  return b;
};

// ---------- Gato ----------

function startGato(win) {
  clearBoard();
  extraButtons();
  boardEl.classList.add("pz-gato");
  const b = Array(9).fill(0);
  const GLYPH = ["", "🍫", "🍬"];
  let over = false;
  let busy = false;
  const cells = b.map((_, i) => {
    const c = el("button", "pz-cell");
    c.type = "button";
    c.setAttribute("aria-label", `Casillero ${i + 1}`);
    c.addEventListener("click", () => play(i));
    boardEl.appendChild(c);
    return c;
  });
  const paint = () => b.forEach((v, i) => { cells[i].textContent = GLYPH[v]; cells[i].disabled = over || !!v; });
  const finish = () => {
    const w = gatoWinner(b);
    if (w === 1) { over = true; const prize = win(); say(`¡Ganaste! 🎉 ${prize}`); }
    else if (w === 2) { over = true; audio.playLose(); say("¡Ganó la máquina! 🤖 Prueba otra vez."); }
    else if (gatoFull(b)) { over = true; say("¡Empate! 🤝 Prueba otra vez."); }
    else return false;
    paint();
    return true;
  };
  const play = (i) => {
    if (over || busy || b[i]) return;
    b[i] = 1;
    audio.playPop();
    paint();
    if (finish()) return;
    busy = true;
    say("La máquina está pensando… 🤔");
    setTimeout(() => {
      if (!current || current.kind !== "gato") return;
      const m = gatoMachineMove(b);
      if (m >= 0) b[m] = 2;
      audio.playBump();
      busy = false;
      paint();
      if (!finish()) say("Tu turno: tú eres 🍫");
    }, 520);
  };
  say("Junta tres seguidos. Tú eres 🍫, la máquina es 🍬");
  paint();
}

// ---------- Mini Sudoku ----------

function startSudoku(win) {
  clearBoard();
  extraButtons();
  boardEl.classList.add("pz-sudoku");
  const { puzzle, solution } = sudokuNew();
  const b = puzzle.slice();
  const given = puzzle.map(Boolean);
  let sel = -1;
  let over = false;
  const grid = el("div", "pz-grid");
  const cells = b.map((_, i) => {
    const c = el("button", "pz-cell pz-s");
    c.type = "button";
    if (i % 4 === 1) c.classList.add("rb");
    if (Math.floor(i / 4) === 1) c.classList.add("bb");
    c.addEventListener("click", () => { if (over || given[i]) return; sel = i; audio.playPop(); paint(); });
    grid.appendChild(c);
    return c;
  });
  const palette = el("div", "pz-palette");
  [1, 2, 3, 4, 0].forEach((v) => {
    const k = el("button", "pz-key", v ? SYMBOLS[v] : "🧽");
    k.type = "button";
    k.setAttribute("aria-label", v ? `Poner ${SYMBOLS[v]}` : "Borrar");
    k.addEventListener("click", () => put(v));
    palette.appendChild(k);
  });
  boardEl.append(grid, palette);
  const paint = () => {
    b.forEach((v, i) => {
      const c = cells[i];
      c.textContent = SYMBOLS[v];
      c.classList.toggle("given", given[i]);
      c.classList.toggle("sel", i === sel);
      c.classList.toggle("bad", !given[i] && sudokuConflict(b, i));
      c.disabled = over;
    });
    palette.querySelectorAll(".pz-key").forEach((k) => { k.disabled = over || sel < 0; });
  };
  const put = (v) => {
    if (over || sel < 0 || given[sel]) return;
    b[sel] = v;
    audio.playPop();
    paint();
    if (sudokuSolved(b)) {
      over = true;
      const prize = win();
      say(`¡Resuelto! 🎉 ${prize}`);
      paint();
    } else {
      const left = b.filter((x) => !x).length;
      say(left ? `Faltan ${left} dibujos. Cada fila, columna y cuadro de 2×2 lleva 🍫🍪🍬🍓 una sola vez.` : "Hay dibujos repetidos (en rojo). ¡Revisa!");
    }
  };
  addExtra("💡 Pista", () => {
    if (over) return;
    const wrong = b.findIndex((v, i) => !given[i] && v !== solution[i]);
    if (wrong < 0) return;
    b[wrong] = solution[wrong];
    given[wrong] = true;
    sel = -1;
    audio.playBonusCollect();
    paint();
    if (sudokuSolved(b)) { over = true; say(`¡Resuelto! 🎉 ${win()}`); paint(); }
    else say("Te puse un dibujo en su lugar 💡");
  });
  say("Pon 🍫🍪🍬🍓 una sola vez en cada fila, columna y cuadro de 2×2. Toca un casillero y elige un dibujo.");
  paint();
}

// ---------- Cachipún ----------

function startCachipun(win) {
  clearBoard();
  extraButtons();
  boardEl.classList.add("pz-cachi");
  const HAND = ["✊", "✋", "✌️"];
  const NAME = ["piedra", "papel", "tijera"];
  let me = 0;
  let cpu = 0;
  let over = false;
  const score = el("div", "pz-score");
  const duel = el("div", "pz-duel", "❔ vs ❔");
  const row = el("div", "pz-palette");
  const buttons = HAND.map((h, i) => {
    const k = el("button", "pz-key", h);
    k.type = "button";
    k.setAttribute("aria-label", NAME[i]);
    k.addEventListener("click", () => play(i));
    row.appendChild(k);
    return k;
  });
  boardEl.append(score, duel, row);
  const paint = () => { score.textContent = `Tú ${me} – ${cpu} Máquina`; buttons.forEach((k) => { k.disabled = over; }); };
  const play = (mine) => {
    if (over) return;
    const theirs = Math.floor(Math.random() * 3);
    const r = cachipun(mine, theirs);
    duel.textContent = `${HAND[mine]} vs ${HAND[theirs]}`;
    if (r > 0) { me++; audio.playPop(); say(`¡${NAME[mine]} le gana a ${NAME[theirs]}! 😄`); }
    else if (r < 0) { cpu++; audio.playBump(); say(`${NAME[theirs]} le gana a ${NAME[mine]} 😅`); }
    else say("¡Empate! Otra vez 🤝");
    if (me >= 2) { over = true; say(`¡Ganaste el Cachipún! 🎉 ${win()}`); }
    else if (cpu >= 2) { over = true; audio.playLose(); say("Ganó la máquina 🤖 ¡Revancha!"); }
    paint();
  };
  say("El primero que gane 2 veces se lleva el Cachipún. ¡Elige!");
  paint();
}
