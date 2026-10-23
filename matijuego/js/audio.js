// Efectos de sonido generados con Web Audio API (sin archivos externos).

let ctx = null;
let master = null;
let muted = false;

function getCtx() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx();
    // Salida común: un filtro que recorta los agudos (las ondas cuadradas y de sierra "chillan" en el parlante del celular)
    // y un limitador suave para que ningún efecto suene más fuerte que el resto.
    const soft = ctx.createBiquadFilter();
    soft.type = "lowpass";
    soft.frequency.value = 2600;
    soft.Q.value = 0.4;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 12;
    limiter.ratio.value = 6;
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(soft);
    soft.connect(limiter);
    limiter.connect(ctx.destination);
  }
  return ctx;
}

/** Dónde se conecta todo lo que suena (la salida común de arriba). */
function out() {
  getCtx();
  return master;
}

function tone(freq, duration, type = "sine", startGain = 0.18, delay = 0) {
  if (muted) return;
  const audio = getCtx();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = startGain;
  osc.connect(gain);
  gain.connect(out());
  const t0 = audio.currentTime + delay;
  osc.start(t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.stop(t0 + duration + 0.02);
}

export function setMuted(value) {
  muted = value;
  if (muted) stopSchedulers();
  else if (currentTheme) startMusic(currentTheme);
}

export function isMuted() {
  return muted;
}

export function playCollect() {
  tone(880, 0.09, "triangle");
  tone(1320, 0.09, "triangle", 0.12, 0.05);
}

export function playMissionComplete() {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, "square", 0.14, i * 0.1));
}

export function playLose() {
  tone(220, 0.35, "sawtooth", 0.16);
  tone(160, 0.4, "sawtooth", 0.14, 0.15);
}

export function playVictory() {
  [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, "square", 0.14, i * 0.12));
}

export function playBump() {
  tone(120, 0.08, "square", 0.1);
}

export function playBounce() {
  tone(300, 0.06, "sine", 0.16);
  tone(520, 0.09, "sine", 0.13, 0.05);
}

export function playJump() {
  tone(400, 0.08, "square", 0.12);
  tone(700, 0.1, "square", 0.1, 0.06);
}

export function playBonusCollect() {
  [660, 880, 1100, 1320, 1568].forEach((f, i) => tone(f, 0.16, "triangle", 0.15, i * 0.06));
}

export function playPurchase() {
  tone(523, 0.1, "triangle", 0.15);
  tone(784, 0.14, "triangle", 0.13, 0.08);
}

export function playShoot() {
  tone(520, 0.07, "square", 0.1);
  tone(210, 0.1, "sawtooth", 0.1, 0.02);
}

export function playHitEnemy() {
  tone(660, 0.05, "triangle", 0.14);
}

export function playHeadshot() {
  tone(880, 0.06, "triangle", 0.16);
  tone(1320, 0.1, "triangle", 0.14, 0.05);
}

export function playPop() {
  tone(400, 0.05, "sine", 0.18);
  tone(800, 0.08, "triangle", 0.14, 0.04);
  tone(1200, 0.1, "triangle", 0.1, 0.09);
}

export function playHurt() {
  tone(180, 0.18, "sawtooth", 0.16);
  tone(110, 0.25, "square", 0.12, 0.08);
}

export function playReload() {
  tone(300, 0.05, "square", 0.08);
  tone(450, 0.06, "square", 0.08, 0.35);
}

export function playWave() {
  [392, 523, 659].forEach((f, i) => tone(f, 0.18, "triangle", 0.14, i * 0.1));
}

// ---------- efectos extra ----------

function noise(duration, gainV = 0.12, lowpass = 1800, delay = 0) {
  if (muted) return;
  const audio = getCtx();
  const len = Math.floor(audio.sampleRate * duration);
  const buf = audio.createBuffer(1, len, audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audio.createBufferSource();
  src.buffer = buf;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = lowpass;
  const gain = audio.createGain();
  gain.gain.value = gainV;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(out());
  src.start(audio.currentTime + delay);
}

export function playCrash() {
  noise(0.35, 0.2, 1400);
  tone(110, 0.25, "sawtooth", 0.14);
}

export function playWhoosh() {
  noise(0.28, 0.07, 3200);
}

/** Subida de tono según el combo (1, 2, 3...). */
export function playCombo(n = 1) {
  const base = 520 * Math.pow(1.0595, Math.min(n, 12) * 2);
  tone(base, 0.08, "triangle", 0.14);
  tone(base * 1.5, 0.1, "triangle", 0.11, 0.05);
}

export function playPowerup() {
  [392, 523, 659, 880].forEach((f, i) => tone(f, 0.12, "square", 0.1, i * 0.05));
}

/** Bocina del auto (dos notitas). */
export function playHorn() {
  tone(392, 0.18, "square", 0.12);
  tone(330, 0.18, "square", 0.1, 0.0);
  tone(392, 0.25, "square", 0.12, 0.22);
  tone(330, 0.25, "square", 0.1, 0.22);
}

export function playCountdown(go = false) {
  tone(go ? 880 : 440, go ? 0.3 : 0.12, "square", 0.13);
}

/** Sonidito suave del sello de inicio (si el aparato todavía no deja sonar, simplemente no suena). */
export function playIntro() {
  try {
    if (muted) return;
    // en el navegador el sonido solo se permite después de tocar la pantalla; en la app (Capacitor) sí suena de entrada
    const ua = navigator.userActivation;
    if (ua && !ua.hasBeenActive && !window.Capacitor) return;
    const c = getCtx();
    if (c.state === "suspended") c.resume();
    [392, 523, 659, 784].forEach((f, i) => tone(f, 0.9, "sine", 0.1, 0.25 + i * 0.16));
    tone(1046, 1.2, "triangle", 0.06, 1.0);
  } catch (e) { /* sin audio */ }
}

export function playStar() {
  [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, "triangle", 0.13, i * 0.08));
}

// ---------- música de fondo (generada, sin archivos) ----------
// Un bajo y una melodía cortitos que se repiten, distintos para cada tipo de juego.

const MIDI = (n) => 440 * Math.pow(2, (n - 69) / 12);
const THEMES = {
  // bpm, nota base, escala (semitonos), progresión de acordes (grados), onda de la melodía, brillo (0..1)
  arcade: { bpm: 128, root: 60, scale: [0, 2, 4, 7, 9], prog: [0, 5, 3, 4], wave: "square", lead: 0.7, seed: 11 },
  race: { bpm: 150, root: 57, scale: [0, 3, 5, 7, 10], prog: [0, 0, 5, 3], wave: "sawtooth", lead: 0.55, seed: 23 },
  puzzle: { bpm: 112, root: 62, scale: [0, 2, 4, 7, 9], prog: [0, 3, 4, 0], wave: "triangle", lead: 0.9, seed: 37 },
  sport: { bpm: 120, root: 64, scale: [0, 2, 4, 7, 9], prog: [0, 4, 5, 3], wave: "square", lead: 0.6, seed: 41 },
  chill: { bpm: 96, root: 60, scale: [0, 2, 4, 7, 9], prog: [0, 5, 3, 4], wave: "triangle", lead: 0.8, seed: 53 },
  adventure: { bpm: 136, root: 55, scale: [0, 2, 4, 7, 9], prog: [0, 4, 5, 3], wave: "square", lead: 0.65, seed: 67 },
};
const CHORD_ROOTS = [0, 2, 4, 5, 7, 9, 11];

let currentTheme = null;
let timer = null;
let nextT = 0;
let step = 0;
let musicGain = null;
let tracks = null;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Arma de antemano la melodía de 16 compases (64 pasos de corchea x2) para que suene "compuesta" y se repita. */
function composeTrack(th) {
  const r = rng(th.seed);
  const lead = [];
  let idx = 2;
  for (let bar = 0; bar < 16; bar++) {
    for (let st = 0; st < 8; st++) {
      const strong = st % 4 === 0;
      if (!strong && r() > th.lead) { lead.push(null); continue; }
      const move = Math.floor(r() * 3) - 1;
      idx = Math.max(0, Math.min(th.scale.length * 2 - 1, idx + move + (r() < 0.12 ? 2 : 0)));
      lead.push(idx);
    }
  }
  return lead;
}

function noteAt(th, degreeIdx) {
  const oct = Math.floor(degreeIdx / th.scale.length);
  return th.root + 12 + oct * 12 + th.scale[degreeIdx % th.scale.length];
}

function playNote(freq, t0, dur, type, gainV, dest) {
  const audio = getCtx();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(gainV, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function schedule() {
  if (!currentTheme || muted) return;
  const audio = getCtx();
  const th = THEMES[currentTheme];
  const stepDur = 60 / th.bpm / 2; // corchea
  while (nextT < audio.currentTime + 0.35) {
    const bar = Math.floor(step / 8) % 16;
    const st = step % 8;
    const chordDeg = th.prog[Math.floor(bar / 1) % th.prog.length];
    const chordRoot = th.root - 12 + th.scale[chordDeg % th.scale.length];
    // bajo: raíz en 1 y 3, quinta en 2 y 4 (con pausitas)
    if (st % 2 === 0) playNote(MIDI(chordRoot + (st === 4 ? 7 : 0)), nextT, stepDur * 1.7, "triangle", 0.5, musicGain);
    // melodía
    const li = tracks.lead[(bar * 8 + st) % tracks.lead.length];
    if (li != null) playNote(MIDI(noteAt(th, li)), nextT, stepDur * 1.5, th.wave, 0.22, musicGain);
    // percusión simple
    if (st % 4 === 0) playNote(60, nextT, 0.08, "sine", 0.6, musicGain);
    if (st % 2 === 1) playNote(MIDI(84), nextT, 0.03, "triangle", 0.05, musicGain);
    nextT += stepDur;
    step++;
  }
}

function stopSchedulers() {
  if (timer) { clearInterval(timer); timer = null; }
  if (musicGain) { try { musicGain.disconnect(); } catch (e) { /* nada */ } musicGain = null; }
}

/** Empieza (o cambia) la música de fondo. Se llama desde un gesto del usuario (el botón de jugar). */
export function startMusic(name) {
  if (!THEMES[name]) return;
  currentTheme = name;
  if (muted) return;
  stopSchedulers();
  const audio = getCtx();
  if (audio.state === "suspended") audio.resume();
  musicGain = audio.createGain();
  musicGain.gain.value = 0.06;
  musicGain.connect(out());
  tracks = { lead: composeTrack(THEMES[name]) };
  step = 0;
  nextT = audio.currentTime + 0.1;
  timer = setInterval(schedule, 90);
  schedule();
}

export function stopMusic() {
  currentTheme = null;
  stopSchedulers();
}
