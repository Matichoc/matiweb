// Matichico y Chocolatina en 3D, como los personajes de matichoc.cl: cabeza de barra de chocolate (bloque
// con surcos), ojos azules grandes, sonrisa con dientes, polera negra de Matichoc con cuello rosado y su
// logo, jeans y zapatillas. Matichico trae un rulo de pelo; Chocolatina, un moño con flores.

import { THREE, roundedBox, loadTexture } from "./three-kit.js?v=4754985988";
import { applyLook, HEAD_W, HEAD_H, HEAD_D } from "./wardrobe3d.js?v=4754985988";

const LIFT = 0.26; // largo extra de las piernas: da las proporciones de los personajes de la web

export function createMatichico(character, outfit, look = null) {
  const outer = new THREE.Group();
  const root = new THREE.Group(); // todo el cuerpo; se achica un poco para mantener la altura de siempre
  root.scale.setScalar(0.88);
  outer.add(root);
  const girl = character.gender === "girl";
  const std = (color, roughness = 0.55) => new THREE.MeshStandardMaterial({ color, roughness });
  const mats = {
    choco: std(character.choco),
    chocoDark: std(character.chocoDark, 0.6),
    jersey: std(outfit.jersey, 0.6),
    trim: std(outfit.trim, 0.55),
    white: std(0xffffff, 0.4),
    hair: std(girl ? 0x6e3216 : 0x7a3a14, 0.7),
    shoe: std(girl ? 0xf4f0ea : 0xe9e1d3, 0.6),
    jeans: std(0x2e4a7c, 0.8),
    dark: new THREE.MeshBasicMaterial({ color: 0x2b1a10 }),
    iris: new THREE.MeshBasicMaterial({ color: 0x2f78dc }),
    cheek: new THREE.MeshBasicMaterial({ color: 0xd4216c, transparent: true, opacity: 0.4 }),
  };
  const shadowed = (m) => {
    m.castShadow = true;
    return m;
  };
  const soleMat = std(girl ? 0xf0508a : 0xb98a4c, 0.6);

  // ---------- piernas (jeans) y zapatillas ----------
  const legs = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.15, 0.32 + LIFT, 0);
    const leg = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.34, 4, 10), mats.jeans));
    leg.position.y = -0.27;
    pivot.add(leg);
    const shoe = shadowed(new THREE.Mesh(roundedBox(0.18, 0.1, 0.3, 0.05, 0.02), mats.shoe));
    shoe.position.set(0, -0.53, 0.05);
    pivot.add(shoe);
    const sole = new THREE.Mesh(roundedBox(0.19, 0.03, 0.31, 0.015, 0.01), soleMat);
    sole.position.set(0, -0.585, 0.05);
    pivot.add(sole);
    const lace = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.08), soleMat);
    lace.position.set(0, -0.475, 0.06);
    pivot.add(lace);
    rootAdd(pivot);
    legs.push(pivot);
  }
  function rootAdd(o) { root.add(o); }

  // ---------- torso: polera con cuello y logo ----------
  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = LIFT;
  root.add(bodyGroup);
  const torso = shadowed(new THREE.Mesh(roundedBox(girl ? 0.5 : 0.54, 0.44, 0.34, 0.1, 0.04), mats.jersey));
  torso.position.y = 0.52;
  bodyGroup.add(torso);
  const hem = shadowed(new THREE.Mesh(roundedBox(girl ? 0.51 : 0.55, 0.05, 0.35, 0.02, 0.01), mats.jersey));
  hem.position.y = 0.325;
  bodyGroup.add(hem);
  for (const sx of [-1, 1]) {
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.07), mats.trim);
    collar.position.set(sx * 0.1, 0.735, 0.165);
    collar.rotation.set(0.25, 0, -sx * 0.5);
    bodyGroup.add(collar);
  }
  const neckBack = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.08), mats.trim);
  neckBack.position.set(0, 0.75, -0.1);
  bodyGroup.add(neckBack);
  const logo = new THREE.Mesh(
    new THREE.CircleGeometry(0.06, 20),
    new THREE.MeshBasicMaterial({ map: loadTexture("assets/brand/icon-512.png"), transparent: true }),
  );
  logo.position.set(0.12, 0.62, 0.174);
  bodyGroup.add(logo);

  // ---------- brazos (pivote en el hombro): manga corta y mano ----------
  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * (girl ? 0.32 : 0.34), 0.66, 0);
    const arm = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.22, 4, 8), mats.choco));
    arm.position.y = -0.18;
    pivot.add(arm);
    const sleeve = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.092, 0.15, 12), mats.jersey));
    sleeve.position.y = -0.06;
    pivot.add(sleeve);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.093, 0.093, 0.025, 12), mats.trim);
    cuff.position.y = -0.125;
    pivot.add(cuff);
    const hand = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), mats.choco));
    hand.position.y = -0.38;
    pivot.add(hand);
    bodyGroup.add(pivot);
    arms.push(pivot);
  }

  // ---------- cabeza: barra de chocolate ----------
  const head = new THREE.Group();
  head.position.y = LIFT + 0.72 + HEAD_H / 2;
  root.add(head);
  const skull = shadowed(new THREE.Mesh(roundedBox(HEAD_W, HEAD_H, HEAD_D, 0.14, 0.05), mats.choco));
  head.add(skull);
  // surcos de la barra: arriba y en los costados
  for (let i = -2; i <= 2; i++) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, HEAD_D * 0.82), mats.chocoDark);
    g.position.set(i * 0.12, HEAD_H / 2 + 0.006, 0);
    head.add(g);
  }
  for (const sx of [-1, 1]) {
    for (let i = -2; i <= 2; i++) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.012, HEAD_H * 0.62, 0.012), mats.chocoDark);
      g.position.set(sx * (HEAD_W / 2 + 0.004), 0.02, i * 0.1);
      head.add(g);
    }
  }

  const eyes = [];
  const brows = [];
  const fz = HEAD_D / 2;
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(sx * 0.17, 0.05, fz - 0.015);
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 12), mats.white);
    white.scale.set(1, 1.12, 0.5);
    eye.add(white);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.078, 14, 10), mats.iris);
    iris.position.set(sx * -0.012, -0.004, 0.047);
    iris.scale.z = 0.5;
    eye.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), mats.dark);
    pupil.position.set(sx * -0.012, -0.004, 0.066);
    pupil.scale.z = 0.5;
    eye.add(pupil);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    shine.position.set(0.035, 0.04, 0.085);
    eye.add(shine);
    head.add(eye);
    eyes.push(eye);

    const brow = new THREE.Mesh(roundedBox(0.15, 0.04, 0.03, 0.015, 0.006), mats.hair);
    brow.position.set(sx * 0.17, 0.225, fz + 0.005);
    brow.rotation.z = -sx * 0.18;
    head.add(brow);
    brows.push(brow);

    if (girl) {
      const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.06, 14), mats.cheek);
      cheek.position.set(sx * 0.3, -0.07, fz + 0.004);
      head.add(cheek);
      for (const k of [0, 1]) {
        const lash = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.014, 0.014), mats.dark);
        lash.position.set(sx * (0.27 + k * 0.02), 0.155 + k * 0.03, fz + 0.02);
        lash.rotation.z = sx * (0.5 + k * 0.4);
        head.add(lash);
      }
    }
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), mats.choco);
  nose.position.set(0, -0.025, fz + 0.035);
  nose.scale.set(1, 0.85, 0.8);
  nose.castShadow = true;
  head.add(nose);

  // sonrisa abierta con dientes y lengua
  const mouth = new THREE.Group();
  mouth.position.set(0, -0.16, fz + 0.004);
  const mouthShape = new THREE.Mesh(new THREE.CircleGeometry(0.12, 20, Math.PI, Math.PI), mats.dark);
  mouthShape.scale.set(1, 0.95, 1);
  mouth.add(mouthShape);
  const teeth = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.035), mats.white);
  teeth.position.set(0, -0.022, 0.002);
  mouth.add(teeth);
  const tongue = new THREE.Mesh(new THREE.CircleGeometry(0.055, 12, Math.PI, Math.PI), new THREE.MeshBasicMaterial({ color: 0xe8527a }));
  tongue.position.set(0, -0.1, 0.002);
  mouth.add(tongue);
  head.add(mouth);

  // ---------- pelo y adornos propios del personaje ----------
  const accStart = head.children.length;
  const top = HEAD_H / 2;
  const hairBand = () => {
    const c = shadowed(new THREE.Mesh(roundedBox(HEAD_W + 0.02, 0.07, HEAD_D + 0.02, 0.03, 0.01), mats.hair));
    c.position.y = top - 0.03;
    head.add(c);
  };
  const bow = (x, y, z, scale = 1) => {
    for (const s of [-1, 1]) {
      const wing = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.075 * scale, 0.17 * scale, 4), mats.jersey));
      wing.position.set(x + s * 0.085 * scale, y, z);
      wing.rotation.z = -s * Math.PI / 2;
      head.add(wing);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.04 * scale, 8, 6), mats.trim);
    knot.position.set(x, y, z);
    head.add(knot);
  };
  const flower = (x, y, z, color, size = 1) => {
    const f = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.036 * size, 8, 6), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
      petal.position.set(Math.cos(a) * 0.04 * size, Math.sin(a) * 0.04 * size, 0);
      f.add(petal);
    }
    const mid = new THREE.Mesh(new THREE.SphereGeometry(0.03 * size, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd34d }));
    mid.position.z = 0.02;
    f.add(mid);
    f.position.set(x, y, z);
    f.lookAt(x * 3, y * 0.5, z * 3 + 1);
    head.add(f);
  };
  if (!girl) {
    // Matichico: rulo de pelo arriba (y flequillo corto)
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.1, top, 0.02), new THREE.Vector3(-0.02, top + 0.12, 0.03), new THREE.Vector3(0.1, top + 0.17, 0.02),
      new THREE.Vector3(0.18, top + 0.09, 0.0), new THREE.Vector3(0.1, top + 0.03, -0.02), new THREE.Vector3(0.04, top + 0.1, 0.0),
    ]);
    const curl = shadowed(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.055, 8, false), mats.hair));
    head.add(curl);
    const tip = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), mats.hair));
    tip.position.copy(curve.getPoint(1));
    head.add(tip);
    const fringe = shadowed(new THREE.Mesh(roundedBox(0.34, 0.06, 0.05, 0.02, 0.01), mats.hair));
    fringe.position.set(-0.12, top - 0.03, fz - 0.03);
    head.add(fringe);
    if (character.type === "basket") {
      const band = shadowed(new THREE.Mesh(roundedBox(HEAD_W + 0.03, 0.07, HEAD_D + 0.03, 0.03, 0.01), std(0xe83a3a, 0.6)));
      band.position.y = top - 0.2;
      head.add(band);
    }
  } else {
    // Chocolatina: moño alto con rulitos y flores
    const bun = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mats.hair));
    bun.position.set(0.06, top + 0.14, -0.06);
    head.add(bun);
    for (const [x, y] of [[-0.26, 0.2], [0.26, 0.2], [-0.33, 0.04], [0.33, 0.04]]) {
      const curl = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mats.hair));
      curl.position.set(x, y + 0.1, fz - 0.06);
      head.add(curl);
    }
    hairBand();
    if (character.type === "cheer") {
      bow(0.06, top + 0.2, 0.08, 1.1);
    } else {
      flower(0.3, top + 0.03, 0.12, 0xff5a7a, 1.5);
      flower(0.2, top + 0.16, 0.12, 0xffffff, 1.2);
      flower(0.36, top + 0.18, 0.04, 0xff8aa8, 1.1);
    }
  }
  // peinado y accesorios originales del personaje (se ocultan si se elige otro peinado)
  const defaultStyle = head.children.slice(accStart);

  // ---------- animación ----------
  let nextBlink = 2 + Math.random() * 2;
  function animate(t, mode = "idle", speed = 1) {
    const s = Math.sin(t * 11 * speed);
    let bob = Math.sin(t * 3) * 0.012;
    let armL = [0, 0, -0.14];
    let armR = [0, 0, 0.14];
    let legL = 0;
    let legR = 0;
    let headTilt = 0;
    let lean = 0;
    if (mode === "run") {
      bob = Math.abs(s) * 0.05;
      legL = s * 0.9;
      legR = -s * 0.9;
      armL = [-s * 0.8, 0, -0.1];
      armR = [s * 0.8, 0, 0.1];
      lean = 0.12;
    } else if (mode === "jump") {
      armL = [0, 0, -2.5];
      armR = [0, 0, 2.5];
      legL = 0.35;
      legR = -0.2;
    } else if (mode === "cheer") {
      bob = Math.abs(Math.sin(t * 7)) * 0.14;
      armL = [0, 0, -2.6 + Math.sin(t * 13) * 0.3];
      armR = [0, 0, 2.6 - Math.sin(t * 13) * 0.3];
      headTilt = Math.sin(t * 7) * 0.12;
    } else if (mode === "sad") {
      armL = [0, 0, -0.04];
      armR = [0, 0, 0.04];
      headTilt = 0.1;
      lean = 0.18;
    } else if (mode === "kick") {
      // patada: `speed` es el avance de la patada (0 a 1); la pierna derecha se balancea hacia adelante
      const k = Math.sin(Math.min(1, Math.max(0, speed)) * Math.PI);
      legR = -1.6 * k;
      legL = 0.35 * k;
      armL = [0.6 * k, 0, -0.5];
      armR = [-0.6 * k, 0, 0.5];
      lean = -0.12 * k;
    } else if (mode === "climb") {
      // escalar un muro: brazos arriba que se turnan para agarrarse y piernas que empujan
      const c = Math.sin(t * 9 * speed);
      armL = [-2.7 + c * 0.45, 0, -0.25];
      armR = [-2.7 - c * 0.45, 0, 0.25];
      legL = -0.5 + c * 0.6;
      legR = -0.5 - c * 0.6;
      bob = Math.abs(c) * 0.04;
      lean = -0.08;
    } else if (mode === "drive") {
      armL = [-1.25, 0, -0.35];
      armR = [-1.25, 0, 0.35];
    } else if (mode === "walk") {
      // caminar tranquilo por la casa
      const w = Math.sin(t * 7.5 * speed);
      bob = Math.abs(w) * 0.03;
      legL = w * 0.6;
      legR = -w * 0.6;
      armL = [-w * 0.5, 0, -0.1];
      armR = [w * 0.5, 0, 0.1];
    } else if (mode === "sit" || mode === "type" || mode === "piano") {
      // sentado: piernas hacia adelante; escribiendo / tocando mueve las manos
      legL = -1.5;
      legR = -1.5;
      bob = Math.sin(t * 2.4) * 0.008;
      armL = [-0.35, 0, -0.18];
      armR = [-0.35, 0, 0.18];
      if (mode === "type") {
        armL = [-1.3 + Math.sin(t * 17) * 0.14, 0, -0.22];
        armR = [-1.3 + Math.sin(t * 17 + 1.7) * 0.14, 0, 0.22];
        headTilt = Math.sin(t * 1.3) * 0.04;
      } else if (mode === "piano") {
        armL = [-1.2 + Math.sin(t * 9) * 0.22, 0, -0.3];
        armR = [-1.2 + Math.sin(t * 9 + 2.2) * 0.22, 0, 0.3];
        headTilt = Math.sin(t * 2.2) * 0.1;
      }
    } else if (mode === "sleep") {
      // acostado: respira despacio
      bob = Math.sin(t * 1.6) * 0.012;
      armL = [0, 0, -0.18];
      armR = [0, 0, 0.18];
    } else if (mode === "arcade") {
      // de pie, manos en la palanca y los botones
      armL = [-1.15 + Math.sin(t * 12) * 0.12, 0, -0.28];
      armR = [-1.2 + Math.sin(t * 15 + 1) * 0.16, 0, 0.28];
      lean = 0.1;
      headTilt = Math.sin(t * 3) * 0.05;
    } else if (mode === "dance") {
      // ¡a bailar! brazos arriba alternados, pasitos y cadera
      const b = Math.sin(t * 8);
      bob = Math.abs(b) * 0.12;
      armL = [Math.sin(t * 4) * 0.5, 0, -2.0 + b * 0.8];
      armR = [Math.sin(t * 4 + 3) * 0.5, 0, 2.0 - b * 0.8];
      legL = b * 0.55;
      legR = -b * 0.55;
      headTilt = Math.sin(t * 4) * 0.2;
      lean = Math.sin(t * 4) * 0.08;
    } else if (mode === "admire") {
      // mira y señala con una mano
      armR = [-0.9 + Math.sin(t * 2.5) * 0.12, 0, 0.5];
      headTilt = Math.sin(t * 1.8) * 0.1;
    }
    bodyGroup.position.y = LIFT + bob;
    bodyGroup.rotation.x = lean;
    head.position.y = LIFT + 0.72 + HEAD_H / 2 + bob;
    head.rotation.z = headTilt;
    head.rotation.x = mode === "sad" ? 0.25 : 0;
    arms[0].rotation.set(armL[0], armL[1], armL[2]);
    arms[1].rotation.set(armR[0], armR[1], armR[2]);
    legs[0].rotation.x = legL;
    legs[1].rotation.x = legR;

    let blink = 1;
    if (t > nextBlink) {
      const k = (t - nextBlink) / 0.14;
      blink = k < 1 ? Math.max(0.1, Math.abs(1 - k * 2)) : 1;
      if (k >= 1) nextBlink = t + 2 + Math.random() * 2.5;
    }
    if (mode === "sleep") blink = 0.08; // ojitos cerrados
    for (const e of eyes) e.scale.y = blink;
    if (hero.tick) hero.tick(t, mode, speed);
  }

  function setOutfit(next) {
    mats.jersey.color.set(next.jersey);
    mats.trim.color.set(next.trim);
  }

  const hero = {
    group: outer, head, bodyGroup, arms, legs, animate, setOutfit, logo,
    mats, eyes, brows, mouth, defaultStyle,
    defaults: { jeans: mats.jeans.color.getHex(), choco: mats.choco.color.getHex(), chocoDark: mats.chocoDark.color.getHex(), hair: mats.hair.color.getHex(), shoe: mats.shoe.color.getHex() },
    worn: [], tick: null, look: null,
    /** Viste al Matichico con un "look" completo (peinado, sombrero, ropa, etc.; ver wardrobe-data.js). */
    setLook(next) { applyLook(hero, next || {}); },
  };
  hero.setLook(look || { outfit: outfit && outfit.id });
  outer.userData.noToon = true; // los personajes no llevan el estilo de ambiente (sombreado por tonos)
  return hero;
}

