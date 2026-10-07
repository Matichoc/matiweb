// Matichico en 3D: cabeza de barra de chocolate (mismas proporciones "chibi" que
// el dibujo 2D), cuerpo con el atuendo comprado en la tienda y accesorios por
// personaje. Origen en los pies, mira hacia +z. Solo primitivas de Three.js.

import { THREE, roundedBox } from "./three-kit.js";

const HEAD_W = 0.78;
const HEAD_H = 0.72;
const HEAD_D = 0.64;

function drawNumber(ctx, text, color) {
  ctx.clearRect(0, 0, 128, 128);
  if (!text) return;
  ctx.fillStyle = color;
  ctx.font = '84px "Baby Chipmunk", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 68);
}

export function createMatichico(character, outfit) {
  const root = new THREE.Group();
  const std = (color, roughness = 0.55) => new THREE.MeshStandardMaterial({ color, roughness });
  const mats = {
    choco: std(character.choco),
    chocoDark: std(character.chocoDark, 0.6),
    jersey: std(outfit.jersey, 0.5),
    trim: std(outfit.trim, 0.5),
    white: std(0xffffff, 0.4),
    hair: std(character.type === "futbol_chico" ? 0x2a180d : 0x3b2414, 0.7),
    shoe: std(0x2a2a2a, 0.7),
    dark: new THREE.MeshBasicMaterial({ color: 0x2b1a10 }),
    iris: new THREE.MeshBasicMaterial({ color: character.type === "basket" ? 0x2f6fd6 : 0x2b1a10 }),
    cheek: new THREE.MeshBasicMaterial({ color: 0xd4216c, transparent: true, opacity: 0.4 }),
  };
  const shadowed = (m) => {
    m.castShadow = true;
    return m;
  };

  // ---------- piernas (pivote en la cadera) ----------
  const legs = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.15, 0.32, 0);
    const leg = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.12, 3, 8), mats.chocoDark));
    leg.position.y = -0.14;
    pivot.add(leg);
    const shoe = shadowed(new THREE.Mesh(roundedBox(0.17, 0.08, 0.26, 0.04, 0.02), mats.shoe));
    shoe.position.set(0, -0.29, 0.04);
    pivot.add(shoe);
    root.add(pivot);
    legs.push(pivot);
  }

  // ---------- torso ----------
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);
  const torso = shadowed(new THREE.Mesh(roundedBox(0.54, 0.4, 0.36, 0.12, 0.04), mats.jersey));
  torso.position.y = 0.52;
  bodyGroup.add(torso);
  const hem = shadowed(new THREE.Mesh(roundedBox(0.56, 0.06, 0.38, 0.03, 0.015), mats.trim));
  hem.position.y = 0.345;
  bodyGroup.add(hem);

  let numberCtx = null;
  let numberTex = null;
  if (character.number) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    numberCtx = c.getContext("2d");
    drawNumber(numberCtx, character.number, outfit.trim);
    numberTex = new THREE.CanvasTexture(c);
    numberTex.colorSpace = THREE.SRGBColorSpace;
    const num = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: numberTex, transparent: true }));
    num.position.set(0, 0.54, 0.186);
    bodyGroup.add(num);
  }
  if (character.type === "cheer") {
    const skirt = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.38, 0.14, 20), mats.trim));
    skirt.position.y = 0.36;
    bodyGroup.add(skirt);
  }

  // ---------- brazos (pivote en el hombro) ----------
  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.34, 0.66, 0);
    const arm = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.14, 3, 8), mats.choco));
    arm.position.y = -0.12;
    pivot.add(arm);
    const hand = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mats.choco));
    hand.position.y = -0.26;
    pivot.add(hand);
    bodyGroup.add(pivot);
    arms.push(pivot);
  }

  // ---------- cabeza ----------
  const head = new THREE.Group();
  head.position.y = 0.72 + HEAD_H / 2;
  root.add(head);
  const skull = shadowed(new THREE.Mesh(roundedBox(HEAD_W, HEAD_H, HEAD_D, 0.2, 0.06), mats.choco));
  head.add(skull);
  for (const sx of [-1, 1]) {
    const groove = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.012, HEAD_D * 0.8), mats.chocoDark);
    groove.position.set(sx * 0.13, HEAD_H / 2 + 0.012, 0);
    head.add(groove);
  }

  const eyes = [];
  const fz = HEAD_D / 2;
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(sx * 0.17, 0.05, fz - 0.015);
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), mats.white);
    white.scale.set(1, 1.1, 0.5);
    eye.add(white);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 8), mats.iris);
    iris.position.set(0.014, -0.005, 0.045);
    iris.scale.z = 0.5;
    eye.add(iris);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    shine.position.set(0.04, 0.035, 0.07);
    eye.add(shine);
    head.add(eye);
    eyes.push(eye);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.024, 0.02), mats.chocoDark);
    brow.position.set(sx * 0.17, 0.215, fz + 0.005);
    brow.rotation.z = -sx * 0.14;
    head.add(brow);

    if (character.gender === "girl") {
      const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.06, 14), mats.cheek);
      cheek.position.set(sx * 0.3, -0.07, fz + 0.004);
      head.add(cheek);
      const lash = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, 0.014), mats.dark);
      lash.position.set(sx * 0.29, 0.14, fz + 0.02);
      lash.rotation.z = sx * 0.6;
      head.add(lash);
    }
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 6, 16, Math.PI), mats.dark);
  mouth.position.set(0, -0.11, fz + 0.004);
  mouth.rotation.z = Math.PI;
  head.add(mouth);

  // ---------- accesorios por personaje ----------
  const top = HEAD_H / 2;
  const cap = (h = 0.12) => {
    const c = shadowed(new THREE.Mesh(roundedBox(HEAD_W + 0.02, h, HEAD_D + 0.02, 0.05, 0.02), mats.hair));
    c.position.y = top - h / 2 + 0.02;
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
  if (character.type === "futbol_chico") {
    cap(0.14);
    const fringe = shadowed(new THREE.Mesh(roundedBox(0.7, 0.1, 0.06, 0.03, 0.015), mats.hair));
    fringe.position.set(0, top - 0.1, fz + 0.012);
    head.add(fringe);
  } else if (character.type === "futbol_chica") {
    cap(0.1);
    const tail = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.3, 4, 8), mats.hair));
    tail.position.set(0.42, 0.06, -0.06);
    tail.rotation.z = -0.35;
    head.add(tail);
    bow(0.4, 0.26, -0.04, 0.9);
  } else if (character.type === "basket") {
    cap(0.09);
    const tuft = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 6), mats.hair));
    tuft.position.set(0.02, top + 0.1, 0);
    tuft.rotation.z = -0.25;
    head.add(tuft);
  } else if (character.type === "cheer") {
    cap(0.1);
    const bun = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), mats.hair));
    bun.position.set(0, top + 0.12, -0.05);
    head.add(bun);
    bow(0, top + 0.1, 0.12, 1.1);
    const glassMat = std(0x5a3320, 0.4);
    for (const sx of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.014, 6, 20), glassMat);
      ring.position.set(sx * 0.17, 0.05, fz + 0.04);
      head.add(ring);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.014, 0.014), glassMat);
    bridge.position.set(0, 0.06, fz + 0.04);
    head.add(bridge);
  }

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
    } else if (mode === "drive") {
      armL = [-1.25, 0, -0.35];
      armR = [-1.25, 0, 0.35];
    }
    bodyGroup.position.y = bob;
    bodyGroup.rotation.x = lean;
    head.position.y = 0.72 + HEAD_H / 2 + bob;
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
    for (const e of eyes) e.scale.y = blink;
  }

  function setOutfit(next) {
    mats.jersey.color.set(next.jersey);
    mats.trim.color.set(next.trim);
    if (numberCtx) {
      drawNumber(numberCtx, character.number, next.trim);
      numberTex.needsUpdate = true;
    }
  }

  return { group: root, head, bodyGroup, arms, legs, animate, setOutfit };
}
