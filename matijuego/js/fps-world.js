// Mundo 3D de "Choco Blaster 3D": la feria de Matichoc (plaza con puestos,
// banderines, cajones, estatua de chocolate y árboles de cacao), construida
// solo con primitivas de Three.js y texturas de la marca (sin modelos externos).

export const ARENA_HALF = 24;

const COLORS = {
  pink: 0xd4216c,
  pinkDark: 0x9c1650,
  brown: 0x64321b,
  brownDark: 0x3d1f10,
  cafe: 0x4b2e2e,
  wood: 0x8a5a36,
  green: 0xcfd767,
  gold: 0xffc800,
  cream: 0xfff6e6,
};
const FLAG_COLORS = [COLORS.pink, COLORS.gold, COLORS.green, COLORS.cream, 0xf08a3c];

function box(THREE, w, h, d, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Intersección rayo-AABB (método de las "slabs"); devuelve la distancia o Infinity. */
export function rayAabb(origin, dir, b) {
  let tmin = 0;
  let tmax = Infinity;
  const axes = [
    ["x", b.minX, b.maxX],
    ["y", b.minY, b.maxY],
    ["z", b.minZ, b.maxZ],
  ];
  for (const [axis, lo, hi] of axes) {
    const o = origin[axis];
    const d = dir[axis];
    if (Math.abs(d) < 1e-8) {
      if (o < lo || o > hi) return Infinity;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

function cratetexture(THREE) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#9a6a3f";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#6e4624";
  g.lineWidth = 6;
  for (let y = 0; y <= 256; y += 64) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(256, y);
    g.stroke();
  }
  g.lineWidth = 8;
  g.strokeRect(4, 4, 248, 248);
  g.fillStyle = "#D4216C";
  g.fillRect(0, 96, 256, 64);
  g.fillStyle = "#FFF6E6";
  g.font = '40px "Baby Chipmunk", sans-serif';
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("MATICHOC", 128, 130);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function loadTex(THREE, url, repeat) {
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
  }
  return tex;
}

/** Patrón de cacao de la marca compuesto sobre crema (el PNG es translúcido y se vería oscuro sobre el piso). */
function patternFloorTexture(THREE, repeat) {
  const c = document.createElement("canvas");
  c.width = c.height = 300;
  const g = c.getContext("2d");
  g.fillStyle = "#fff1dc";
  g.fillRect(0, 0, 300, 300);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  const img = new Image();
  img.onload = () => {
    g.drawImage(img, 0, 0);
    tex.needsUpdate = true;
  };
  img.src = "assets/brand/pattern-cacao-subtle.png";
  return tex;
}

function buildSky(THREE) {
  const geo = new THREE.SphereGeometry(300, 24, 16);
  const top = new THREE.Color(0x5fb8ec);
  const mid = new THREE.Color(0xbfe3f7);
  const low = new THREE.Color(0xffe9cc);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / 300);
    if (t < 0.25) c.copy(low).lerp(mid, t / 0.25);
    else c.copy(mid).lerp(top, (t - 0.25) / 0.75);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = -10;
  return sky;
}

function buildClouds(THREE) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(Math.random() * 3);
    for (let p = 0; p < puffs; p++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(5 + Math.random() * 4, 10, 8), mat);
      s.position.set(p * 6 - puffs * 3, Math.random() * 2, Math.random() * 3);
      s.scale.y = 0.55;
      cloud.add(s);
    }
    const ang = (i / 9) * Math.PI * 2;
    cloud.position.set(Math.cos(ang) * 150, 55 + Math.random() * 25, Math.sin(ang) * 150);
    cloud.userData.speed = 0.4 + Math.random() * 0.5;
    group.add(cloud);
  }
  return group;
}

function makeStall(THREE, mats, productTextures, awningA, awningB) {
  const g = new THREE.Group();

  const counter = box(THREE, 4.4, 1.1, 1.2, mats.wood);
  counter.position.set(0, 0.55, 0);
  g.add(counter);
  const front = box(THREE, 4.2, 0.7, 0.05, mats.pink);
  front.position.set(0, 0.55, 0.62);
  g.add(front);
  const top = box(THREE, 4.7, 0.08, 1.5, mats.cream);
  top.position.set(0, 1.14, 0);
  g.add(top);

  for (const sx of [-2.2, 2.2]) {
    for (const sz of [-0.7, 0.7]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.1, 8), mats.brownDark);
      post.position.set(sx, 1.55, sz);
      post.castShadow = true;
      g.add(post);
    }
  }

  const stripeCount = 10;
  const stripeW = 4.9 / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    const stripe = box(THREE, stripeW, 0.08, 1.9, i % 2 ? awningB : awningA);
    stripe.position.set(-2.45 + stripeW * (i + 0.5), 3.15, 0);
    stripe.rotation.x = 0.18;
    g.add(stripe);
    const flap = new THREE.Mesh(new THREE.ConeGeometry(stripeW * 0.6, 0.34, 4), i % 2 ? awningB : awningA);
    flap.rotation.set(Math.PI, Math.PI / 4, 0);
    flap.position.set(-2.45 + stripeW * (i + 0.5), 2.85, 0.98);
    flap.castShadow = true;
    g.add(flap);
  }

  // cartel con el logo, sobre el toldo
  const plate = new THREE.Mesh(new THREE.CircleGeometry(0.95, 28), mats.white);
  plate.position.set(0, 4.15, 0.1);
  g.add(plate);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.57), mats.logo);
  logo.position.set(0, 4.15, 0.12);
  g.add(logo);
  for (const sx of [-0.5, 0.5]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), mats.brownDark);
    pole.position.set(sx, 3.55, 0.05);
    g.add(pole);
  }

  // productos sobre el mostrador, con fotos reales en la tapa
  productTextures.forEach((tex, i) => {
    const topMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
    const prod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.14, 20),
      [mats.brown, topMat, mats.brown]
    );
    prod.position.set(-1.9 + i * 0.68, 1.25, 0.1 + (i % 2) * 0.2);
    prod.castShadow = true;
    g.add(prod);
  });

  return g;
}

export async function buildWorld(THREE, { tier = "high" } = {}) {
  try {
    await Promise.all([document.fonts.load('40px "Baby Chipmunk"'), document.fonts.ready]);
  } catch (e) {
    /* sin fuentes: se usa la tipografía de reserva */
  }

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffe9cc, 45, 150);

  const sky = buildSky(THREE);
  scene.add(sky);
  const clouds = buildClouds(THREE);
  scene.add(clouds);

  const hemi = new THREE.HemisphereLight(0xcfeaff, 0xf2d8b0, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.6);
  sun.position.set(24, 38, 16);
  sun.castShadow = tier !== "low";
  sun.shadow.mapSize.set(tier === "high" ? 2048 : 1024, tier === "high" ? 2048 : 1024);
  const sc = sun.shadow.camera;
  sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 5; sc.far = 100;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);

  const mats = {
    wood: new THREE.MeshStandardMaterial({ color: COLORS.wood, roughness: 0.8 }),
    brown: new THREE.MeshStandardMaterial({ color: COLORS.brown, roughness: 0.55 }),
    brownDark: new THREE.MeshStandardMaterial({ color: COLORS.brownDark, roughness: 0.7 }),
    pink: new THREE.MeshStandardMaterial({ color: COLORS.pink, roughness: 0.5 }),
    cream: new THREE.MeshStandardMaterial({ color: COLORS.cream, roughness: 0.7 }),
    white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
    gold: new THREE.MeshStandardMaterial({ color: COLORS.gold, roughness: 0.25, metalness: 0.6, emissive: 0x6a5000, emissiveIntensity: 0.4 }),
    logo: new THREE.MeshBasicMaterial({ map: loadTex(THREE, "assets/brand/logo-badge.png"), transparent: true }),
    crate: new THREE.MeshStandardMaterial({ map: cratetexture(THREE), roughness: 0.85 }),
  };

  // ---------- suelo ----------
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: 0x9cc257, roughness: 1 })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.02;
  grass.receiveShadow = true;
  scene.add(grass);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_HALF * 2 + 4, ARENA_HALF * 2 + 4),
    new THREE.MeshStandardMaterial({ map: patternFloorTexture(THREE, 17), roughness: 0.92 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const obstacles = [];
  const addObstacle = (x, z, w, d, h) =>
    obstacles.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: 0, maxY: h });

  // ---------- puestos de la feria ----------
  const productTextures = ["alf-frambuesa", "alf-menta", "alf-naranja", "alf-trufa", "alf-pie-limon", "alf-maracuya"].map((n) =>
    loadTex(THREE, `assets/products/${n}.jpg`)
  );
  const awningMats = [
    [mats.pink, mats.cream],
    [new THREE.MeshStandardMaterial({ color: COLORS.green, roughness: 0.6 }), mats.cream],
  ];
  const stallSpots = [
    { x: -8, z: -20.5, rot: 0, a: 0 },
    { x: 8, z: -20.5, rot: 0, a: 1 },
    { x: -8, z: 20.5, rot: Math.PI, a: 1 },
    { x: 8, z: 20.5, rot: Math.PI, a: 0 },
  ];
  for (const s of stallSpots) {
    const stall = makeStall(THREE, mats, productTextures, awningMats[s.a][0], awningMats[s.a][1]);
    stall.position.set(s.x, 0, s.z);
    stall.rotation.y = s.rot;
    scene.add(stall);
    addObstacle(s.x, s.z, 4.7, 1.5, 1.2);
  }

  // ---------- estatua central: tableta de chocolate con destellos ----------
  const statue = new THREE.Group();
  const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.3, 28), mats.gold);
  baseRing.position.y = 0.15;
  baseRing.castShadow = true;
  baseRing.receiveShadow = true;
  statue.add(baseRing);
  const bar = new THREE.Group();
  for (const [dx, dz] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) {
    const sq = box(THREE, 1.0, 0.9, 1.0, mats.brown);
    sq.position.set(dx, 0, dz);
    bar.add(sq);
    const hl = box(THREE, 0.6, 0.06, 0.6, new THREE.MeshStandardMaterial({ color: 0x7a4326, roughness: 0.4 }));
    hl.position.set(dx, 0.48, dz);
    bar.add(hl);
  }
  bar.position.y = 1.5;
  bar.rotation.y = Math.PI / 6;
  statue.add(bar);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.9, 0.07, 10, 40),
    new THREE.MeshBasicMaterial({ color: COLORS.pink })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.5;
  statue.add(ring);
  const sparkles = [];
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshBasicMaterial({ color: COLORS.gold }));
    sp.scale.y = 1.7;
    sparkles.push(sp);
    statue.add(sp);
  }
  scene.add(statue);
  addObstacle(0, 0, 3.0, 3.0, 2.2);

  // ---------- cajones y barriles de cobertura ----------
  const crateSpots = [
    [-10, -6, 0.3], [-11.2, -6.8, 0.1], [10, 7, -0.2], [11.3, 6.6, 0.4],
    [-6, 11, 0.2], [6.5, -11, -0.3], [-14, 9, 0.5], [14, -9, 0.1],
    [0, -12, 0], [-4, 16, 0.2],
  ];
  for (const [x, z, r] of crateSpots) {
    const crate = box(THREE, 1.4, 1.4, 1.4, mats.crate);
    crate.position.set(x, 0.7, z);
    crate.rotation.y = r;
    scene.add(crate);
    addObstacle(x, z, 1.9, 1.9, 1.4);
  }
  const barrelSpots = [[-4, -9], [4.5, 9], [-16, -2], [16, 2], [-3, 5], [3, -5]];
  for (const [x, z] of barrelSpots) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 16), mats.pink);
    barrel.position.set(x, 0.55, z);
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    scene.add(barrel);
    for (const y of [0.25, 0.85]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.555, 0.04, 6, 20), mats.gold);
      band.rotation.x = Math.PI / 2;
      band.position.set(x, y, z);
      scene.add(band);
    }
    addObstacle(x, z, 1.1, 1.1, 1.1);
  }

  // ---------- cerco, postes y banderines ----------
  const postGeo = new THREE.BoxGeometry(0.22, 1.2, 0.22);
  const posts = [];
  const H = ARENA_HALF + 1;
  for (let i = -H; i <= H; i += 3) {
    posts.push([i, -H], [i, H], [-H, i], [H, i]);
  }
  const postMesh = new THREE.InstancedMesh(postGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), posts.length);
  const tmp = new THREE.Object3D();
  const col = new THREE.Color();
  posts.forEach(([x, z], i) => {
    tmp.position.set(x, 0.6, z);
    tmp.updateMatrix();
    postMesh.setMatrixAt(i, tmp.matrix);
    col.setHex(i % 2 ? COLORS.pink : COLORS.cream);
    postMesh.setColorAt(i, col);
  });
  postMesh.castShadow = true;
  scene.add(postMesh);
  const railMat = new THREE.MeshStandardMaterial({ color: COLORS.wood, roughness: 0.8 });
  for (const [w, d, x, z] of [[H * 2, 0.1, 0, -H], [H * 2, 0.1, 0, H], [0.1, H * 2, -H, 0], [0.1, H * 2, H, 0]]) {
    for (const y of [0.45, 0.95]) {
      const rail = box(THREE, w, 0.08, d, railMat);
      rail.position.set(x, y, z);
      scene.add(rail);
    }
  }

  const poleSpots = [[-19, -19], [19, -19], [19, 19], [-19, 19]];
  for (const [x, z] of poleSpots) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 4.6, 10), mats.brownDark);
    pole.position.set(x, 2.3, z);
    pole.castShadow = true;
    scene.add(pole);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), mats.gold);
    ball.position.set(x, 4.7, z);
    scene.add(ball);
    addObstacle(x, z, 0.4, 0.4, 4.6);
  }

  const flagGeo = new THREE.ConeGeometry(0.24, 0.5, 3);
  flagGeo.rotateX(Math.PI);
  const flagCount = 4 * 24;
  const flags = new THREE.InstancedMesh(flagGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, side: THREE.DoubleSide }), flagCount);
  let fi = 0;
  const stringMat = new THREE.LineBasicMaterial({ color: COLORS.cafe });
  for (let e = 0; e < 4; e++) {
    const a = poleSpots[e];
    const b = poleSpots[(e + 1) % 4];
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[1] + (b[1] - a[1]) * t;
      const y = 4.4 - Math.sin(t * Math.PI) * 0.9;
      pts.push(new THREE.Vector3(x, y, z));
      if (i < 24) {
        tmp.position.set(x, y - 0.25, z);
        tmp.rotation.set(0, Math.atan2(b[0] - a[0], b[1] - a[1]), 0);
        tmp.scale.set(1, 1, 0.25);
        tmp.updateMatrix();
        flags.setMatrixAt(fi, tmp.matrix);
        col.setHex(FLAG_COLORS[(fi + e) % FLAG_COLORS.length]);
        flags.setColorAt(fi, col);
        fi++;
      }
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), stringMat));
  }
  flags.castShadow = true;
  scene.add(flags);

  // ---------- árboles de cacao y colinas de fondo ----------
  const trunkMat = new THREE.MeshStandardMaterial({ color: COLORS.brown, roughness: 0.9 });
  const leafMats = [0x6fa447, 0x8cbc55, 0x5f9640].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true }));
  for (let i = 0; i < 26; i++) {
    const ang = (i / 26) * Math.PI * 2 + Math.random() * 0.2;
    const r = 32 + Math.random() * 20;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 2.6, 7), trunkMat);
    trunk.position.y = 1.3;
    trunk.castShadow = true;
    tree.add(trunk);
    for (let l = 0; l < 3; l++) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 - l * 0.2, 0), leafMats[(i + l) % 3]);
      leaf.position.set((Math.random() - 0.5) * 0.8, 3.0 + l * 0.8, (Math.random() - 0.5) * 0.8);
      leaf.castShadow = tier === "high";
      tree.add(leaf);
    }
    // vainas de cacao colgando
    for (let p = 0; p < 2; p++) {
      const pod = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshStandardMaterial({ color: p ? COLORS.gold : COLORS.pink, roughness: 0.5 }));
      pod.scale.y = 1.4;
      pod.position.set(0.9 - p * 1.6, 2.6, 0.6);
      tree.add(pod);
    }
    tree.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
    tree.scale.setScalar(0.9 + Math.random() * 0.6);
    scene.add(tree);
  }
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x86b64c, roughness: 1 });
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(28 + Math.random() * 14, 18, 12), hillMat);
    hill.position.set(Math.cos(ang) * 120, -14, Math.sin(ang) * 120);
    hill.scale.y = 0.6;
    scene.add(hill);
  }

  // puntos de aparición de enemigos: anillo interior, fuera de obstáculos
  const spawnPoints = [];
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2;
    const x = Math.cos(ang) * 22;
    const z = Math.sin(ang) * 22;
    const clamped = { x: Math.max(-22, Math.min(22, x * 1.1)), z: Math.max(-22, Math.min(22, z * 1.1)) };
    const blocked = obstacles.some((o) => clamped.x > o.minX - 1.2 && clamped.x < o.maxX + 1.2 && clamped.z > o.minZ - 1.2 && clamped.z < o.maxZ + 1.2);
    if (!blocked) spawnPoints.push(clamped);
  }

  function update(dt, time, camera) {
    sky.position.copy(camera.position);
    for (const c of clouds.children) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 170) c.position.x = -170;
    }
    bar.rotation.y = Math.PI / 6 + time * 0.5;
    ring.scale.setScalar(1 + Math.sin(time * 2) * 0.04);
    sparkles.forEach((sp, i) => {
      const a = time * 1.2 + (i / 3) * Math.PI * 2;
      sp.position.set(Math.cos(a) * 1.9, 2.4 + Math.sin(time * 2 + i) * 0.3, Math.sin(a) * 1.9);
      sp.rotation.y = time * 2;
    });
  }

  return { scene, obstacles, spawnPoints, update, sun };
}
