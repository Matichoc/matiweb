// Efectos de sonido generados con Web Audio API (sin archivos externos).

let ctx = null;
let muted = false;

function getCtx() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx();
  }
  return ctx;
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
  gain.connect(audio.destination);
  const t0 = audio.currentTime + delay;
  osc.start(t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.stop(t0 + duration + 0.02);
}

export function setMuted(value) {
  muted = value;
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
