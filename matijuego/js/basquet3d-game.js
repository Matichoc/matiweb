// Lanzamientos de Básquet 3D: tiro libre contra el reloj, con la cámara detrás de tu
// Matichico en un gimnasio con hinchada. Dos barras (puntería y potencia) se fijan con
// ESPACIO / toque; el balón vuela con física real (aro, tablero y piso rebotan) y la red
// se mueve cuando es un "swish". Cada 5° tiro el aro es dorado (Chocolate Dubai).

import { THREE, Game3D, clamp, lerp, rand, canvasTexture, roundedBox, makeBunting } from "./three-kit.js";
import { createMatichico } from "./matichico3d.js";
import { saveProgress, earnCoins } from "./storage.js";
import * as audio from "./audio.js";

const GAME_ID = "basquet_tiros";
const TIME_LIMIT = 60;
const AIM_TARGET = 0.5;
const POWER_TARGET = 0.7;
const GOLDEN_EVERY = 5;

const HOOP = { x: 0, y: 2.75, z: -6.4, r: 0.46 };
const BOARD_Z = HOOP.z - 0.62;
const BALL_R = 0.24;
const GRAV = -9.8;
const FLIGHT = 1.05;

const oscillate = (t, speed) => (Math.sin(t * speed) + 1) / 2;

function courtTexture() {
  const k = 2;
  return canvasTexture(1024, 1024, (g, w, h) => {
    // tablones de madera
    for (let i = 0; i < 24; i++) {
      g.fillStyle = i % 2 ? "#d99a55" : "#cf8f4a";
      g.fillRect(0, (i * h) / 24, w, h / 24 + 1);
      g.fillStyle = "rgba(60,30,10,0.12)";
      g.fillRect(0, (i * h) / 24, w, 2);
    }
    g.strokeStyle = "#fff6e6";
    g.lineWidth = 8 * k;
    // zona (la pintura) en fucsia
    g.fillStyle = "rgba(212,33,108,0.78)";
    g.fillRect(w * 0.31, 0, w * 0.38, h * 0.52);
    g.strokeRect(w * 0.31, 0, w * 0.38, h * 0.52);
    // tiro libre
    g.beginPath();
    g.arc(w / 2, h * 0.52, w * 0.19, 0, Math.PI);
    g.stroke();
    g.beginPath();
    g.setLineDash([26, 22]);
    g.arc(w / 2, h * 0.52, w * 0.19, Math.PI, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    // línea de 3
    g.beginPath();
    g.arc(w / 2, h * 0.1, w * 0.46, 0.1 * Math.PI, 0.9 * Math.PI);
    g.stroke();
    // logo al centro del arco
    g.fillStyle = "rgba(255,246,230,0.92)";
    g.font = '90px "Baby Chipmunk", sans-serif';
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("MATICHOC", w / 2, h * 0.84);
  });
}

function ballTexture() {
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = "#e26a1b";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#3a1a08";
    g.lineWidth = 7;
    for (const x of [0, w / 2, w]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    for (const cx of [w * 0.25, w * 0.75]) {
      g.beginPath(); g.ellipse(cx, h / 2, w * 0.17, h * 0.46, 0, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = "#FFC800";
    g.font = '60px "Baby Chipmunk", sans-serif';
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("M", w * 0.5, h * 0.3);
  });
}

export class Basquet3DGame extends Game3D {
  constructor(character, progress, els) {
    super(GAME_ID, character, progress, els, { fov: 50 });
    this.q = els.q;
    this.cheer = 0;
    this.swish = 0;
    this.shake = 0;
    this.sbLast = "";
  }

  // ---------- escena ----------

  async build() {
    const s = this.scene;
    s.background = new THREE.Color(0x24120a);
    s.fog = new THREE.Fog(0x24120a, 22, 52);
    s.add(new THREE.HemisphereLight(0xffeedd, 0x6a4020, 1.1));
    this.sun = new THREE.DirectionalLight(0xfff0d2, 2.3);
    this.sun.position.set(-4, 14, 4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.coarse ? 1024 : 2048, this.coarse ? 1024 : 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -10; sc.near = 1; sc.far = 40;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.04;
    s.add(this.sun, this.sun.target);
    this.sun.target.position.set(0, 0, -3);
    this.onLowQuality = () => { this.sun.castShadow = false; };
    const spot = new THREE.SpotLight(0xffffff, 140, 30, 0.5, 0.6, 1.3);
    spot.position.set(0, 9, -3);
    spot.target.position.set(0, 2.5, -6);
    s.add(spot, spot.target);

    this.m = {
      pink: new THREE.MeshStandardMaterial({ color: 0xd4216c, roughness: 0.4 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.25, metalness: 0.6, emissive: 0x6a4a00, emissiveIntensity: 0.4 }),
      cream: new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.5 }),
      brown: new THREE.MeshStandardMaterial({ color: 0x64321b, roughness: 0.6 }),
      rim: new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.3, metalness: 0.4, emissive: 0x802000, emissiveIntensity: 0.4 }),
    };

    this._buildGym();
    this._buildHoop();
    this._buildCrowd();

    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 28, 20),
      new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.55, metalness: 0.05 }),
    );
    this.ball.castShadow = true;
    s.add(this.ball);
    this.ballV = new THREE.Vector3();
    this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
    this.ballShadow.rotation.x = -Math.PI / 2;
    s.add(this.ballShadow);

    this._ensureHero();
  }

  _buildGym() {
    const s = this.scene;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ map: courtTexture(), roughness: 0.32, metalness: 0.08 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -3.2);
    floor.receiveShadow = true;
    s.add(floor);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshStandardMaterial({ color: 0x4a2514, roughness: 0.5 }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.set(0, -0.01, -8);
    outer.receiveShadow = true;
    s.add(outer);

    // pared del fondo con banners de marca
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 18), new THREE.MeshStandardMaterial({ color: 0x5a3320, roughness: 0.85 }));
    wall.position.set(0, 9, -13);
    s.add(wall);
    const mkBanner = (x, text, color) => {
      const b = new THREE.Mesh(
        new THREE.PlaneGeometry(4.4, 1.4),
        new THREE.MeshStandardMaterial({
          map: canvasTexture(512, 164, (g, w, h) => {
            g.fillStyle = color; g.fillRect(0, 0, w, h);
            g.strokeStyle = "#FFC800"; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
            g.fillStyle = "#FFF6E6"; g.font = '86px "Baby Chipmunk", sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
            g.fillText(text, w / 2, h / 2 + 4);
          }),
          roughness: 0.6,
        }),
      );
      b.position.set(x, x === 0 ? 4.6 : 6.4, -12.9);
      s.add(b);
    };
    mkBanner(-8, "MATICHOC", "#D4216C");
    mkBanner(0, "LA LIGA", "#3d1f10");
    mkBanner(8, "MATICHOC", "#D4216C");
    s.add(makeBunting(new THREE.Vector3(-13, 9.5, -12.5), new THREE.Vector3(13, 9.5, -12.5), { count: 30, sag: 1.4, size: 0.6 }));

    // luces del techo (emisivas: el bloom las hace brillar)
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff3d6 });
    for (const x of [-6, 0, 6]) for (const z of [-2, -9]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 0.5), lampMat);
      l.position.set(x, 10, z);
      s.add(l);
    }
    // marcador colgante
    this.sbCanvas = document.createElement("canvas");
    this.sbCanvas.width = 512; this.sbCanvas.height = 192;
    this.sbTex = new THREE.CanvasTexture(this.sbCanvas);
    this.sbTex.colorSpace = THREE.SRGBColorSpace;
    const sb = new THREE.Mesh(roundedBox(4.2, 1.5, 0.3, 0.12, 0.04), [this.m.brown]);
    sb.position.set(0, 6.5, -9);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 1.3), new THREE.MeshBasicMaterial({ map: this.sbTex }));
    face.position.set(0, 6.5, -8.83);
    s.add(sb, face);
    this._drawScoreboard();
  }

  _drawScoreboard() {
    const key = `${this.score}|${Math.ceil(Math.max(0, this.timeLeft || 0))}|${this.made}`;
    if (key === this.sbLast || !this.sbCanvas) return;
    this.sbLast = key;
    const g = this.sbCanvas.getContext("2d");
    g.fillStyle = "#1c0f07"; g.fillRect(0, 0, 512, 192);
    g.strokeStyle = "#FFC800"; g.lineWidth = 6; g.strokeRect(6, 6, 500, 180);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#D4216C"; g.font = '30px "Baby Chipmunk", sans-serif';
    g.fillText("PUNTOS", 140, 38); g.fillText("TIEMPO", 372, 38);
    g.fillStyle = "#FFC800"; g.font = '96px "Baby Chipmunk", sans-serif';
    g.fillText(String(this.score ?? 0), 140, 112);
    g.fillStyle = (this.timeLeft ?? 60) <= 10 ? "#ff5a4a" : "#CFD767";
    g.fillText(String(Math.max(0, Math.ceil(this.timeLeft ?? TIME_LIMIT))).padStart(2, "0"), 372, 112);
    this.sbTex.needsUpdate = true;
  }

  _buildHoop() {
    const s = this.scene;
    const hoop = new THREE.Group();
    // soporte
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 4.2, 14), this.m.brown);
    pole.position.set(0, 2.1, BOARD_Z - 1.4);
    pole.castShadow = true;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 1.5), this.m.brown);
    arm.position.set(0, HOOP.y + 0.5, BOARD_Z - 0.7);
    // tablero
    const board = new THREE.Mesh(roundedBox(2.0, 1.25, 0.1, 0.08, 0.03), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, transmission: 0, clearcoat: 1 }));
    board.position.set(0, HOOP.y + 0.42, BOARD_Z - 0.05);
    board.castShadow = true;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.08, 1.33, 0.06), this.m.pink);
    frame.position.set(0, HOOP.y + 0.42, BOARD_Z - 0.12);
    const square = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), new THREE.MeshBasicMaterial({ color: 0xd4216c, wireframe: true }));
    square.position.set(0, HOOP.y + 0.2, BOARD_Z + 0.002);
    // aro
    this.rim = new THREE.Mesh(new THREE.TorusGeometry(HOOP.r, 0.035, 10, 36), this.m.rim);
    this.rim.rotation.x = Math.PI / 2;
    this.rim.position.set(HOOP.x, HOOP.y, HOOP.z);
    this.rim.castShadow = true;
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.5), this.m.rim);
    bracket.position.set(0, HOOP.y, BOARD_Z + 0.25);
    this.rimGlow = new THREE.PointLight(0xffc800, 0, 6);
    this.rimGlow.position.set(0, HOOP.y, HOOP.z);
    hoop.add(pole, arm, board, frame, square, this.rim, bracket, this.rimGlow);
    s.add(hoop);

    // red: tiras desde el aro hasta un anillo inferior
    const N = 14;
    const pos = [];
    this.netBase = [];
    const ringAt = (a, rad, y) => [HOOP.x + Math.cos(a) * rad, y, HOOP.z + Math.sin(a) * rad];
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2;
      const a1 = ((i + 0.5) / N) * Math.PI * 2;
      const aN = ((i + 1) / N) * Math.PI * 2;
      const top = ringAt(a0, HOOP.r, HOOP.y);
      const mid = ringAt(a1, HOOP.r * 0.82, HOOP.y - 0.22);
      const low = ringAt(aN, HOOP.r * 0.6, HOOP.y - 0.5);
      pos.push(...top, ...mid, ...mid, ...low);
      // cruces
      const midB = ringAt(a1 + (0.5 / N) * Math.PI * 2, HOOP.r * 0.82, HOOP.y - 0.22);
      pos.push(...mid, ...midB);
    }
    this.netBase = Float32Array.from(pos);
    this.netGeo = new THREE.BufferGeometry();
    this.netGeo.setAttribute("position", new THREE.BufferAttribute(Float32Array.from(pos), 3));
    this.net = new THREE.LineSegments(this.netGeo, new THREE.LineBasicMaterial({ color: 0xffffff }));
    s.add(this.net);
  }

  _buildCrowd() {
    const s = this.scene;
    const palette = [0xd4216c, 0xffc800, 0xcfd767, 0xfff6e6, 0x2fa8d6, 0xe8742a];
    const skin = [0x64321b, 0x8a5a36, 0xc98a4b, 0xe0ab72];
    this.crowd = [];
    const bodyGeo = new THREE.BoxGeometry(0.55, 0.65, 0.4);
    const headGeo = new THREE.SphereGeometry(0.22, 10, 8);
    const seats = [];
    const addBleacher = (cx, dir) => {
      for (let row = 0; row < 5; row++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5 + row * 0.5, 15), this.m.brown);
        step.position.set(cx + dir * row * 1.0, (0.5 + row * 0.5) / 2, -4);
        step.receiveShadow = true;
        s.add(step);
        for (let i = 0; i < 12; i++) {
          if (Math.random() < 0.12) continue;
          seats.push({ x: cx + dir * (row * 1.0 - 0.2), y: 0.5 + row * 0.5 + 0.32, z: -10.8 + i * 1.18 + rand(-0.15, 0.15), face: -dir });
        }
      }
    };
    addBleacher(-8, -1);
    addBleacher(8, 1);
    // hinchada del fondo
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 22; i++) {
        seats.push({ x: -10.5 + i * 1.0 + rand(-0.1, 0.1), y: 0.6 + row * 0.5, z: -11.2 - row * 0.6, face: 0, back: true });
      }
    }
    this.crowdBody = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), seats.length);
    this.crowdHead = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), seats.length);
    const col = new THREE.Color();
    seats.forEach((p, i) => {
      this.crowd.push({ ...p, phase: rand(0, 6.28), amp: rand(0.6, 1.2) });
      this.crowdBody.setColorAt(i, col.setHex(palette[Math.floor(Math.random() * palette.length)]));
      this.crowdHead.setColorAt(i, col.setHex(skin[Math.floor(Math.random() * skin.length)]));
    });
    this.crowdBody.instanceColor.needsUpdate = true;
    this.crowdHead.instanceColor.needsUpdate = true;
    this.crowdBody.castShadow = false;
    s.add(this.crowdBody, this.crowdHead);
    this._dummy = new THREE.Object3D();
    this._animateCrowd(0);
  }

  _animateCrowd() {
    const d = this._dummy;
    const t = this.time;
    this.crowd.forEach((p, i) => {
      const bob = Math.max(0, Math.sin(t * 6 + p.phase)) * (0.05 + this.cheer * 0.35) * p.amp;
      const arms = this.cheer > 0.1 ? 0.12 : 0;
      d.position.set(p.x, p.y + bob, p.z);
      d.rotation.set(0, p.face === 0 ? 0 : p.face * Math.PI / 2, 0);
      d.scale.setScalar(1);
      d.updateMatrix();
      this.crowdBody.setMatrixAt(i, d.matrix);
      d.position.y = p.y + 0.55 + bob + arms;
      d.updateMatrix();
      this.crowdHead.setMatrixAt(i, d.matrix);
    });
    this.crowdBody.instanceMatrix.needsUpdate = true;
    this.crowdHead.instanceMatrix.needsUpdate = true;
  }

  _ensureHero() {
    if (this.hero && this.heroId === this.character.id) {
      this.hero.setOutfit(this.outfit);
      return;
    }
    if (this.hero) this.scene.remove(this.hero.group);
    this.hero = createMatichico(this.character, this.outfit);
    this.heroId = this.character.id;
    this.hero.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.hero.group.scale.setScalar(1.35);
    this.hero.group.position.set(0, 0, 0);
    this.scene.add(this.hero.group);
  }

  onResize(w, h) {
    this.portrait = w / h < 0.9;
    this.camera.fov = this.portrait ? 66 : this.fov;
    this.camera.updateProjectionMatrix();
  }

  // ---------- partida ----------

  reset() {
    this.timeLeft = TIME_LIMIT;
    this.score = 0;
    this.made = 0;
    this.attempts = 0;
    this.coinsEarned = 0;
    this.cheer = 0;
    this.swish = 0;
    this.sbLast = "";
    this._ensureHero();
    this._startShot();
    this._updateHud();
    this._drawScoreboard();
    this._setZones();
  }

  _difficulty() { return this.attempts; }
  _accTol() { return Math.max(0.05, 0.16 - this._difficulty() * 0.006); }
  _powTol() { return Math.max(0.045, 0.14 - this._difficulty() * 0.006); }
  _isGolden() { return this.attempts % GOLDEN_EVERY === GOLDEN_EVERY - 1; }

  _setZones() {
    const q = this.q;
    const aim = q("aim-zone");
    const pow = q("power-zone");
    if (aim) { aim.style.left = `${(AIM_TARGET - this._accTol()) * 100}%`; aim.style.width = `${this._accTol() * 200}%`; }
    if (pow) { pow.style.bottom = `${(POWER_TARGET - this._powTol()) * 100}%`; pow.style.height = `${this._powTol() * 200}%`; }
    const meters = q("meters");
    if (meters) meters.classList.toggle("golden", this._isGolden());
    this.rim.material = this._isGolden() ? this.m.gold : this.m.rim;
    this.rimGlow.intensity = this._isGolden() ? 12 : 0;
  }

  _startShot() {
    this.stage = "aim";
    this.aimTime = 0;
    this.powerTime = 0;
    this.aimValue = 0;
    this.powerValue = 0;
    this.aimLocked = null;
    this.powerLocked = null;
    this.aimSpeed = 2.2 + this._difficulty() * 0.08;
    this.powerSpeed = 2.6 + this._difficulty() * 0.08;
    this.resultTimer = 0;
    this.shotMade = false;
    this.scored = false;
    this.flightClock = 0;
    this.bounceSfx = 0;
    this._setZones();
    this._placeBallInHands();
  }

  _handPos(out) {
    const hp = this.hero.group.position;
    return out.set(hp.x, 1.55, hp.z - 0.4);
  }

  _placeBallInHands() {
    this._handPos(this.ball.position);
    this.ballV.set(0, 0, 0);
    this.ball.visible = true;
  }

  onBegin() {
    this.stage = "aim";
  }

  _tryAction() {
    if (this.state !== "playing" || !this.running) return;
    if (this.stage === "aim") {
      this.aimLocked = this.aimValue;
      this.stage = "power";
      this.powerTime = 0;
      audio.playJump();
    } else if (this.stage === "power") {
      this.powerLocked = this.powerValue;
      this._launchBall();
      audio.playJump();
    }
  }

  _launchBall() {
    const accErr = this.aimLocked - AIM_TARGET;
    const powErr = this.powerLocked - POWER_TARGET;
    const aErr = Math.abs(accErr);
    const pErr = Math.abs(powErr);
    const made = aErr <= this._accTol() && pErr <= this._powTol();
    const clean = made && aErr <= this._accTol() / 2 && pErr <= this._powTol() / 2;
    this.shotMade = made;
    this.shotClean = clean;
    this.stage = "flying";

    let ox;
    let oz;
    if (made) {
      ox = clean ? 0 : (accErr / this._accTol()) * 0.15;
      oz = clean ? 0 : (powErr / this._powTol()) * 0.15;
    } else {
      ox = accErr * 3.4;
      oz = -powErr * 3.6; // potencia de más → más lejos (z más negativo)
      const len = Math.hypot(ox, oz);
      const min = 0.62;
      if (len < min) {
        const a = len < 0.001 ? rand(0, 6.28) : Math.atan2(oz, ox);
        ox = Math.cos(a) * min;
        oz = Math.sin(a) * min;
      }
    }
    const start = this._handPos(new THREE.Vector3());
    const target = new THREE.Vector3(HOOP.x + ox, HOOP.y + (made ? 0.0 : 0.05), HOOP.z + oz);
    const T = FLIGHT;
    this.ballV.set(
      (target.x - start.x) / T,
      (target.y - start.y - 0.5 * GRAV * T * T) / T,
      (target.z - start.z) / T,
    );
    this.ball.position.copy(start);
    this.flightClock = 0;
    this.hero.animate(this.time, "jump", 1);
    this.heroJump = 0.5;
    this.attempts++; // se cuenta al lanzar
    this.shotGolden = (this.attempts - 1) % GOLDEN_EVERY === GOLDEN_EVERY - 1;
    this._updateHud();
  }

  _settleShot(made) {
    if (this.stage === "result") return;
    this.stage = "result";
    this.resultTimer = 1.0;
    if (made) {
      this.made++;
      let gained = 20 + (this.shotClean ? 10 : 0);
      if (this.shotGolden) {
        gained += 10;
        earnCoins(this.progress, 15);
        this.coinsEarned += 15;
        saveProgress(this.progress);
      }
      this.score += gained;
      this.cheer = 1;
      this.swish = this.shotClean ? 1 : 0.6;
      audio.playBonusCollect();
      const at = new THREE.Vector3(HOOP.x, HOOP.y + 0.9, HOOP.z + 0.4);
      this.particles.burst(new THREE.Vector3(HOOP.x, HOOP.y - 0.2, HOOP.z), [0xffc800, 0xd4216c, 0xcfd767, 0xffffff], 36, 5.5, 1.3, 7, 1.3);
      this.popups.add(at, this.shotClean ? `¡SWISH! +${gained}` : `+${gained}`, this.shotClean ? "combo" : "kill");
      if (this.shotGolden) this.popups.add(new THREE.Vector3(at.x, at.y + 0.9, at.z), "+15 🍫✨", "coin");
      this.heroMode = "cheer";
      this.heroModeTimer = 1.1;
    } else {
      audio.playBump();
      this.heroMode = "sad";
      this.heroModeTimer = 0.9;
    }
    this._updateHud();
    this._drawScoreboard();
  }

  _updateHud() {
    const q = this.q;
    q("hud-score").textContent = String(this.score);
    q("hud-made").textContent = String(this.made);
    q("hud-attempts").textContent = String(this.attempts);
    q("hud-coins").textContent = String(this.progress.coins);
  }

  // ---------- física del balón ----------

  _stepBall(dt) {
    const b = this.ball.position;
    const v = this.ballV;
    const sub = 3;
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      v.y += GRAV * h;
      b.addScaledVector(v, h);
      // tablero
      if (b.z - BALL_R < BOARD_Z && b.z > BOARD_Z - 0.2 && Math.abs(b.x - HOOP.x) < 1.0 && b.y > HOOP.y - 0.2 && b.y < HOOP.y + 1.05 && v.z < 0) {
        b.z = BOARD_Z + BALL_R;
        v.z = Math.abs(v.z) * 0.45;
        v.x *= 0.85;
        this._sfx();
      }
      // aro
      const dx = b.x - HOOP.x;
      const dz = b.z - HOOP.z;
      const L = Math.hypot(dx, dz) || 0.0001;
      const px = HOOP.x + (dx / L) * HOOP.r;
      const pz = HOOP.z + (dz / L) * HOOP.r;
      const nx = b.x - px;
      const ny = b.y - HOOP.y;
      const nz = b.z - pz;
      const D = Math.hypot(nx, ny, nz);
      const touch = BALL_R + 0.035;
      if (D < touch && D > 0.0001) {
        const ux = nx / D;
        const uy = ny / D;
        const uz = nz / D;
        b.x += ux * (touch - D);
        b.y += uy * (touch - D);
        b.z += uz * (touch - D);
        const vn = v.x * ux + v.y * uy + v.z * uz;
        if (vn < 0) {
          v.x -= 1.55 * vn * ux;
          v.y -= 1.55 * vn * uy;
          v.z -= 1.55 * vn * uz;
          this.rimShake = 1;
          this._sfx();
        }
      }
      // dentro de la red: frena un poco (efecto red)
      if (this.shotMade && b.y < HOOP.y && b.y > HOOP.y - 0.55 && Math.hypot(dx, dz) < HOOP.r) {
        v.x *= 1 - 3 * h;
        v.z *= 1 - 3 * h;
        v.y *= 1 - 0.8 * h;
      }
      // piso
      if (b.y - BALL_R < 0) {
        b.y = BALL_R;
        if (v.y < -0.8) this._sfx();
        v.y = -v.y * 0.62;
        v.x *= 0.88;
        v.z *= 0.88;
        if (Math.abs(v.y) < 0.4) v.y = 0;
      }
      // paredes invisibles
      if (b.z < -12) { b.z = -12; v.z = Math.abs(v.z) * 0.4; }
      if (Math.abs(b.x) > 6) { b.x = Math.sign(b.x) * 6; v.x *= -0.4; }
    }
    this.ball.rotation.x += v.z * dt * 2.2;
    this.ball.rotation.z -= v.x * dt * 2.2;
    this.ballShadow.position.set(b.x, 0.02, b.z);
    const sh = clamp(1 - b.y / 7, 0.2, 1);
    this.ballShadow.scale.setScalar(sh);
    this.ballShadow.material.opacity = 0.32 * sh;
  }

  _sfx() {
    if (this.time - this.bounceSfx < 0.12) return;
    this.bounceSfx = this.time;
    audio.playBump();
  }

  // ---------- bucle ----------

  update(dt) {
    this.shake = Math.max(0, this.shake - dt);
    this.cheer = Math.max(0, this.cheer - dt * 0.7);
    this.swish = Math.max(0, this.swish - dt * 1.4);
    this.rimShake = Math.max(0, (this.rimShake || 0) - dt * 4);
    this._animateCrowd();
    this._animateNet();
    this.rim.position.y = HOOP.y + Math.sin(this.time * 60) * 0.012 * this.rimShake;

    if (this.state === "playing") {
      this.timeLeft -= dt;
      const chip = this.q("hud-timer-chip");
      chip.classList.toggle("low", this.timeLeft <= 10);
      this.q("hud-timer").textContent = String(Math.max(0, Math.ceil(this.timeLeft))).padStart(2, "0");
      this._drawScoreboard();
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this._onGameOver();
        return;
      }

      if (this.stage === "aim") {
        this.aimTime += dt;
        this.aimValue = oscillate(this.aimTime, this.aimSpeed);
      } else if (this.stage === "power") {
        this.powerTime += dt;
        this.powerValue = oscillate(this.powerTime, this.powerSpeed);
      } else if (this.stage === "flying" || this.stage === "result") {
        const prevY = this.ball.position.y;
        this._stepBall(dt);
        this.flightClock += dt;
        if (this.stage === "flying") {
          const b = this.ball.position;
          const crossed = prevY >= HOOP.y && b.y < HOOP.y && Math.hypot(b.x - HOOP.x, b.z - HOOP.z) < HOOP.r + 0.05 && this.ballV.y < 0;
          if (crossed && this.shotMade) this._settleShot(true);
          else if (this.flightClock > 0.5 && (b.y < 0.6 && this.ballV.y <= 0 || this.flightClock > 3.2)) this._settleShot(false);
        } else {
          this.resultTimer -= dt;
          if (this.resultTimer <= 0) this._startShot();
        }
      }
    }
    this._updateMeters();
    this._updateHero(dt);
    this._placeCamera(dt);
  }

  _updateMeters() {
    const q = this.q;
    const am = q("aim-marker");
    const pm = q("power-marker");
    if (am) {
      const v = this.stage === "aim" ? this.aimValue : this.aimLocked ?? 0;
      am.style.left = `${v * 100}%`;
      am.classList.toggle("locked", this.stage !== "aim");
    }
    if (pm) {
      const v = this.stage === "power" ? this.powerValue : this.powerLocked ?? 0;
      pm.style.bottom = `${v * 100}%`;
      pm.classList.toggle("locked", this.stage !== "power");
    }
    const meters = q("meters");
    if (meters) meters.classList.toggle("off", this.stage === "flying" || this.stage === "result");
    const hint = q("hint");
    if (hint) hint.textContent = this.stage === "aim" ? "¡Fija la PUNTERÍA!" : this.stage === "power" ? "¡Ahora la POTENCIA!" : "";
  }

  _animateNet() {
    const pos = this.netGeo.attributes.position;
    const base = this.netBase;
    const sw = this.swish;
    const t = this.time;
    for (let i = 0; i < pos.count; i++) {
      const y0 = base[i * 3 + 1];
      const depth = clamp((HOOP.y - y0) / 0.5, 0, 1);
      const wob = Math.sin(t * 24 + i) * 0.03 * sw * depth;
      pos.setX(i, HOOP.x + (base[i * 3] - HOOP.x) * (1 + sw * 0.18 * depth) + wob);
      pos.setY(i, y0 - sw * 0.22 * depth * (0.6 + 0.4 * Math.sin(t * 18)));
      pos.setZ(i, HOOP.z + (base[i * 3 + 2] - HOOP.z) * (1 + sw * 0.18 * depth) + wob);
    }
    pos.needsUpdate = true;
  }

  _updateHero(dt) {
    const g = this.hero.group;
    if (this.heroModeTimer > 0) {
      this.heroModeTimer -= dt;
      if (this.heroModeTimer <= 0) this.heroMode = "idle";
    }
    // el Matichico mira hacia el aro y se inclina según la puntería
    const aim = this.stage === "aim" ? this.aimValue : this.aimLocked ?? 0.5;
    const target = Math.PI + (aim - 0.5) * 0.7;
    g.rotation.y = lerp(g.rotation.y || Math.PI, this.state === "gameover" ? 0 : target, 1 - Math.exp(-12 * dt));
    let mode = this.heroMode || "idle";
    if (this.heroJump > 0) { this.heroJump -= dt; mode = "jump"; }
    if (this.state === "gameover") mode = this.score > 0 ? "cheer" : "sad";
    this.hero.animate(this.time, mode, 1);
    if (this.stage === "aim" || this.stage === "power") this._placeBallInHands();
    else if (this.stage === "flying" && this.flightClock < 0.04) this.ball.visible = true;
  }

  _placeCamera(dt) {
    const sway = Math.sin(this.time * 0.4) * 0.12;
    const follow = this.stage === "flying" || this.stage === "result" ? clamp((this.ball.position.y - 1.5) * 0.18, -0.3, 0.7) : 0;
    this.camFollow = lerp(this.camFollow || 0, follow, 1 - Math.exp(-4 * (dt || 0.016)));
    const sk = this.shake * 0.05;
    const portrait = this.portrait;
    this.camera.position.set(1.9 + sway + rand(-sk, sk), (portrait ? 3.4 : 3.0) + this.camFollow * 0.2, portrait ? 6.4 : 5.4);
    this.camera.lookAt(0.1, (portrait ? 2.3 : 2.1) + this.camFollow, -4.2);
  }

  _onGameOver() {
    audio.playLose();
    this.finish(
      `Encestaste ${this.made} de ${this.attempts} tiros y sumaste ${this.score} puntos` + (this.coinsEarned > 0 ? `, ganando ${this.coinsEarned} monedas Dubai.` : "."),
    );
  }

  // ---------- entrada ----------

  async init() {
    const first = !this.ready;
    await super.init();
    if (first) this._bindInput();
  }

  _bindInput() {
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.key === " ") {
        if (this.running && this.state === "playing") e.preventDefault();
        this._tryAction();
      }
    });
    this.els.canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); this._tryAction(); });
    const shootBtn = document.getElementById("basquet-btn-shoot");
    if (shootBtn) shootBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); this._tryAction(); });
  }
}
