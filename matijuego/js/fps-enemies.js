// Malvaviscos traviesos: los "enemigos" amigables de Choco Blaster 3D.
// Cada impacto los baña de chocolate (cambian de color); al completar el
// baño estallan en confeti. Todo con primitivas de Three.js.

export const ENEMY_TYPES = {
  normal: { hp: 2, speed: 2.5, points: 100, scale: 1.0, hat: 0xd4216c, radius: 0.5 },
  rapido: { hp: 1, speed: 4.4, points: 150, scale: 0.72, hat: 0xffc800, radius: 0.4 },
  grande: { hp: 5, speed: 1.55, points: 400, scale: 1.55, hat: 0x64321b, radius: 0.8 },
  dorado: { hp: 3, speed: 3.6, points: 1000, scale: 1.0, hat: 0xcfd767, radius: 0.5, flees: true, coins: 10 },
};

const CHOCOLATE = 0x5a2d16;

export function createEnemy(THREE, typeId) {
  const type = ENEMY_TYPES[typeId];
  const golden = typeId === "dorado";
  const group = new THREE.Group();

  const baseColor = new THREE.Color(golden ? 0xffd34d : 0xfff3f6);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: baseColor.clone(),
    roughness: golden ? 0.25 : 0.55,
    metalness: golden ? 0.5 : 0,
    emissive: golden ? 0x7a5200 : 0x000000,
    emissiveIntensity: golden ? 0.5 : 0,
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 4, 12), bodyMat);
  body.position.y = 0.95;
  body.castShadow = true;
  group.add(body);

  const dark = new THREE.MeshBasicMaterial({ color: 0x2a1408 });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), dark);
    eye.position.set(sx * 0.16, 1.16, 0.37);
    eye.scale.z = 0.6;
    group.add(eye);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), white);
    shine.position.set(sx * 0.16 + 0.025, 1.2, 0.42);
    group.add(shine);
    const cheek = new THREE.Mesh(
      new THREE.CircleGeometry(0.075, 12),
      new THREE.MeshBasicMaterial({ color: 0xff8fb8, transparent: true, opacity: 0.8 })
    );
    cheek.position.set(sx * 0.27, 1.02, 0.34);
    cheek.rotation.y = sx * 0.6;
    group.add(cheek);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 12, Math.PI), dark);
  mouth.position.set(0, 1.0, 0.405);
  mouth.rotation.z = Math.PI;
  group.add(mouth);

  const hatMat = new THREE.MeshStandardMaterial({ color: type.hat, roughness: 0.5 });
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.42, 12), hatMat);
  hat.position.set(0, 1.78, 0);
  hat.castShadow = true;
  group.add(hat);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), white);
  pom.position.set(0, 2.0, 0);
  group.add(pom);

  const armMat = new THREE.MeshStandardMaterial({ color: baseColor.clone(), roughness: 0.55 });
  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.46, 1.0, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.2, 3, 8), armMat);
    arm.position.y = -0.14;
    arm.castShadow = true;
    pivot.add(arm);
    group.add(pivot);
    arms.push(pivot);
  }

  const footMat = new THREE.MeshStandardMaterial({ color: 0x6b3a1e, roughness: 0.7 });
  const feet = [];
  for (const sx of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), footMat);
    foot.position.set(sx * 0.18, 0.14, 0.05);
    foot.scale.set(1, 0.7, 1.3);
    foot.castShadow = true;
    group.add(foot);
    feet.push(foot);
  }

  group.scale.setScalar(type.scale);

  return {
    typeId,
    type,
    group,
    bodyMat,
    armMat,
    baseColor,
    arms,
    feet,
    hp: type.hp,
    maxHp: type.hp,
    speed: type.speed,
    radius: type.radius,
    stun: 0,
    hitFlash: 0,
    age: 0,
    phase: Math.random() * 10,
    life: golden ? 16 : Infinity,
  };
}

/** Pinta al enemigo según el chocolate recibido (0 = limpio, 1 = bañado). */
export function applyChocolate(enemy, THREE) {
  const t = 1 - Math.max(0, enemy.hp) / enemy.maxHp;
  const c = enemy.baseColor.clone().lerp(new THREE.Color(CHOCOLATE), t);
  enemy.bodyMat.color.copy(c);
  enemy.armMat.color.copy(c);
}

/** Esferas de impacto en coordenadas del mundo: cuerpo y cabeza (cabezazo = daño doble). */
export function hitSpheres(enemy) {
  const p = enemy.group.position;
  const s = enemy.type.scale;
  return {
    body: { x: p.x, y: p.y + 0.8 * s, z: p.z, r: 0.52 * s },
    head: { x: p.x, y: p.y + 1.42 * s, z: p.z, r: 0.4 * s },
  };
}

export function animateEnemy(enemy, dt, moving) {
  enemy.age += dt;
  const t = enemy.age * 8 + enemy.phase;
  const bob = moving ? Math.abs(Math.sin(t)) * 0.12 : Math.sin(enemy.age * 2 + enemy.phase) * 0.03;
  const squash = enemy.hitFlash > 0 ? 1 - enemy.hitFlash * 0.25 : 1;
  const s = enemy.type.scale;
  enemy.group.scale.set(s * (2 - squash), s * squash, s * (2 - squash));
  enemy.group.children[0].position.y = 0.95 + bob;
  enemy.arms.forEach((a, i) => {
    a.rotation.z = (i ? -1 : 1) * (0.5 + (moving ? Math.sin(t + i * Math.PI) * 0.5 : 0.08));
  });
  enemy.feet.forEach((f, i) => {
    f.position.z = 0.05 + (moving ? Math.sin(t + i * Math.PI) * 0.12 : 0);
  });
  if (enemy.hitFlash > 0) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 5);
  if (enemy.stun > 0) enemy.stun = Math.max(0, enemy.stun - dt);
}
