// Standalone interior props, botanical arrangements, books, extinguishers, curtains and 1900 hardware.
import * as THREE from 'three';
import { canvas2d, canvasTexture, makeCanvas } from '../canvas-utils.ts';
import { addBox } from '../mesh-utils.ts';
import { DIM } from '../dimensions.ts';
import { createRopeMaterial } from '../belfry.ts';
import type { ChurchMaterials } from '../textures.ts';

type FlowerAssets = {
  laurelLeafGeo: THREE.BufferGeometry;
  ivyLeafGeo: THREE.BufferGeometry;
  sprayLeafletGeo: THREE.BufferGeometry;
  daisyPetalGeo: THREE.BufferGeometry;
  mumPetalGeo: THREE.BufferGeometry;
  rosePetalGeo: THREE.BufferGeometry;
  smallPetalGeo: THREE.BufferGeometry;
  calyxGeo: THREE.BufferGeometry;
  centerGeo: THREE.BufferGeometry;
  stemUnitGeo: THREE.BufferGeometry;
  trayMat: THREE.Material;
  stemMat: THREE.Material;
  leafMats: THREE.Material[];
  yellowBrightMat: THREE.Material;
  yellowGoldMat: THREE.Material;
  orangeVibrantMat: THREE.Material;
  orangeWarmMat: THREE.Material;
  apricotMat: THREE.Material;
  creamMat: THREE.Material;
  centerDarkMat: THREE.Material;
  centerGoldMat: THREE.Material;
};

type HymnBookLayer = { t: number; colour: number };

type StackedHymnBook = {
  y: number;
  t: number;
  side: number;
  rot: number;
  dx: number;
  dz: number;
};

export function markEra1900<T extends THREE.Object3D>(obj: T): T {
  obj.userData.era = '1900';
  obj.visible = false;
  return obj;
}

export function spiralPts(cx: number, cy: number, r0: number, a0: number, sweep: number, dir = 1, tighten = 0.55) {
  const pts: THREE.Vector3[] = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const a = a0 + dir * sweep * f;
    const r = r0 * (1 - tighten * f);
    pts.push(new THREE.Vector3(cx + Math.sin(a) * r, cy - Math.cos(a) * r, 0));
  }
  return pts;
}

export function buildVisitorBook(mats: ChurchMaterials, x: number, y: number, z: number) {
  const g = new THREE.Group();
  const c = makeCanvas(256, 192);
  const ctx = canvas2d(c);
  ctx.fillStyle = '#f4eedc';
  ctx.fillRect(0, 0, 256, 192);
  let seed = 77;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (const ox of [0, 128]) {
    ctx.strokeStyle = 'rgba(120,150,190,0.55)';
    ctx.lineWidth = 1;
    for (let ly = 22; ly < 186; ly += 12) {
      ctx.beginPath();
      ctx.moveTo(ox + 8, ly);
      ctx.lineTo(ox + 120, ly);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(190,80,80,0.5)';
    ctx.beginPath();
    ctx.moveTo(ox + 34, 10);
    ctx.lineTo(ox + 34, 186);
    ctx.stroke();
    // Handwritten entries
    ctx.strokeStyle = 'rgba(30,40,90,0.8)';
    ctx.lineWidth = 1.1;
    const rows = ox === 0 ? 14 : 6;
    for (let r = 0; r < rows; r++) {
      const ly = 20 + r * 12;
      ctx.beginPath();
      let px = ox + 38;
      ctx.moveTo(px, ly);
      const end = ox + 60 + rnd() * 58;
      while (px < end) {
        px += 2 + rnd() * 3;
        ctx.lineTo(px, ly - rnd() * 6);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ox + 10, ly);
      ctx.lineTo(ox + 28, ly - 3);
      ctx.stroke();
    }
  }
  const tex = canvasTexture(c);
  const pageMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  const coverMat = new THREE.MeshStandardMaterial({ color: 0x6e1f24, roughness: 0.7 });
  const pageW = 0.2;
  const pageD = 0.28;
  const cover = addBox(g, [pageD + 0.012, 0.008, pageW * 2 + 0.02], coverMat);
  cover.position.y = 0.004;
  // Each page block bows up gently from the spine (a curved strip of the shared page texture)
  [-1, 1].forEach((side) => {
    const geo = new THREE.PlaneGeometry(pageD, pageW, 1, 12);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getZ(i) + pageW * 0.5) / pageW; // 0 at one edge .. 1 at the other
      const fromSpine = side > 0 ? t : 1 - t;
      pos.setY(i, 0.018 + Math.sin(fromSpine * Math.PI * 0.5) * 0.004 - (1 - fromSpine) * 0.01);
      pos.setZ(i, pos.getZ(i) + side * pageW * 0.5);
      uv.setX(i, side > 0 ? 0.5 + uv.getX(i) * 0.5 : uv.getX(i) * 0.5);
    }
    geo.computeVertexNormals();
    const page = new THREE.Mesh(geo, pageMat);
    g.add(page);
    addBox(g, [pageD - 0.01, 0.014, pageW - 0.01], pageMat, [0, 0.009, side * (pageW * 0.5 + 0.003)]);
  });
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.14, 10), mats.iron);
  pen.rotation.z = Math.PI / 2;
  pen.rotation.y = 0.5;
  pen.position.set(0.02, 0.026, pageW * 0.55);
  g.add(pen);
  const clip = addBox(g, [0.035, 0.003, 0.003], mats.brass);
  clip.rotation.y = 0.5;
  clip.position.set(-0.03, 0.031, pageW * 0.55 + 0.025);
  g.position.set(x, y, z);
  g.rotation.y = -Math.PI / 2 + 0.12; // reads from the pew's front edge
  return g;
}

// Wall donation safe: a black-painted iron door plate in a slightly larger frame, hinged down its left edge,
// with a coin slot across the top and a keyhole below (faces +Z, back on the wall at z = 0)
// A white-enamelled anglepoise desk lamp: weighted round base, two parallel-arm sections with springs, and a
// conical shade. Built so the arm reaches along +X with its shade tipped down; origin at the base's underside.

export function buildDonationPlate(mats: ChurchMaterials) {
  // Landscape black iron plate: two coin slots along the top, keyhole on the left, hinged on the right, and a
  // white paper "Donations" label taped across the middle
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.5, metalness: 0.6 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const W = 0.32;
  const H = 0.21;
  const frame = addBox(g, [W, H, 0.01], paint);
  frame.position.z = 0.005;
  const door = addBox(g, [W - 0.04, H - 0.04, 0.012], paint);
  door.position.z = 0.016;
  // Two coin slots, each a dark recess in a raised lip
  [-0.065, 0.065].forEach((sx) => {
    addBox(g, [0.095, 0.024, 0.006], paint, [sx, 0.06, 0.025]);
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.072, 0.007), dark);
    slot.position.set(sx, 0.06, 0.0285);
    g.add(slot);
  });
  // Keyhole on the left
  const kx = -0.115;
  const escutcheon = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 16), mats.brass);
  escutcheon.rotation.x = Math.PI / 2;
  escutcheon.position.set(kx, -0.005, 0.024);
  g.add(escutcheon);
  const keyRound = new THREE.Mesh(new THREE.CircleGeometry(0.005, 12), dark);
  keyRound.position.set(kx, -0.001, 0.0265);
  g.add(keyRound);
  const keyStem = new THREE.Mesh(new THREE.PlaneGeometry(0.0045, 0.011), dark);
  keyStem.position.set(kx, -0.01, 0.0265);
  g.add(keyStem);
  // Two hinge knuckles on the right edge
  [0.05, -0.05].forEach((hy) => {
    const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 10), paint);
    knuckle.position.set(W * 0.5 - 0.016, hy, 0.018);
    g.add(knuckle);
  });
  // Paper label with clear tape over each end
  const c = makeCanvas(512, 128);
  const ctx = canvas2d(c);
  // Lettered in gothic blackletter (UnifrakturMaguntia, OFL), redrawn into the texture once the font has loaded
  const drawLabel = (family: string) => {
    ctx.fillStyle = '#f6f4ee';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = `80px ${family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Donations', 256, 66, 480);
  };
  drawLabel('serif');
  const tex = canvasTexture(c);
  if (typeof FontFace !== 'undefined') {
    new FontFace('UnifrakturMaguntia', 'url(/assets/fonts/UnifrakturMaguntia.woff2)')
      .load()
      .then((font) => {
        document.fonts.add(font);
        drawLabel("'UnifrakturMaguntia', serif");
        tex.needsUpdate = true;
      })
      .catch(() => {}); // keep the serif fallback
  }
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.17, 0.0425),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 })
  );
  label.position.set(0.01, -0.022, 0.0228);
  label.rotation.z = -0.015;
  g.add(label);
  const tapeMat = new THREE.MeshStandardMaterial({
    color: 0xf2efe0,
    roughness: 0.25,
    transparent: true,
    opacity: 0.45
  });
  [-1, 1].forEach((side) => {
    const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.05), tapeMat);
    tape.position.set(0.01 + side * 0.085, -0.022 + side * 0.001, 0.0232);
    tape.rotation.z = side * 0.08;
    g.add(tape);
  });
  return g;
}

// Shared hassock geometries: a plump pillow (thickest in the middle, softly rounded to its seams) plus hook & loop

function createCurvedBladeGeo(width: number, length: number, arch: number, cup: number) {
  const segs = 4;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const halfW = width * 0.5 * Math.sin(Math.pow(t, 0.78) * Math.PI);
    const z = t * length;
    const yCenter = Math.sin(t * Math.PI) * arch;
    const yEdge = yCenter + cup * Math.sin(t * Math.PI);
    positions.push(-halfW, yEdge, z, 0, yCenter, z, halfW, yEdge, z);
  }
  for (let i = 0; i < segs; i++) {
    const r0 = i * 3;
    const r1 = (i + 1) * 3;
    indices.push(r0, r1, r0 + 1, r0 + 1, r1, r1 + 1);
    indices.push(r0 + 1, r1 + 1, r0 + 2, r0 + 2, r1 + 1, r1 + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Shared botanical geometries & materials for realistic sanctuary floral arrangements (IMG_3938)
let flowerAssetsCache: FlowerAssets | null = null;
function getFlowerAssets() {
  if (flowerAssetsCache) return flowerAssetsCache;
  flowerAssetsCache = {
    laurelLeafGeo: createCurvedBladeGeo(0.052, 0.138, 0.016, 0.007),
    ivyLeafGeo: createCurvedBladeGeo(0.044, 0.092, 0.012, 0.005),
    sprayLeafletGeo: createCurvedBladeGeo(0.02, 0.058, 0.008, 0.003),
    daisyPetalGeo: createCurvedBladeGeo(0.017, 0.052, 0.009, 0.005),
    mumPetalGeo: createCurvedBladeGeo(0.015, 0.042, 0.011, 0.007),
    rosePetalGeo: createCurvedBladeGeo(0.032, 0.04, 0.007, 0.015),
    smallPetalGeo: createCurvedBladeGeo(0.011, 0.022, 0.004, 0.003),
    calyxGeo: new THREE.ConeGeometry(0.015, 0.022, 7),
    centerGeo: new THREE.SphereGeometry(0.018, 10, 7),
    stemUnitGeo: new THREE.CylinderGeometry(0.0032, 0.0046, 1, 5),
    trayMat: new THREE.MeshStandardMaterial({ color: 0x1d341a, roughness: 0.78 }),
    stemMat: new THREE.MeshStandardMaterial({ color: 0x2b5222, roughness: 0.72 }),
    leafMats: [
      new THREE.MeshStandardMaterial({ color: 0x1e441b, roughness: 0.46, side: THREE.DoubleSide }),
      new THREE.MeshStandardMaterial({ color: 0x2c5c24, roughness: 0.48, side: THREE.DoubleSide }),
      new THREE.MeshStandardMaterial({ color: 0x43742d, roughness: 0.54, side: THREE.DoubleSide })
    ],
    yellowBrightMat: new THREE.MeshStandardMaterial({ color: 0xf8c928, roughness: 0.52, side: THREE.DoubleSide }),
    yellowGoldMat: new THREE.MeshStandardMaterial({ color: 0xebb018, roughness: 0.54, side: THREE.DoubleSide }),
    orangeVibrantMat: new THREE.MeshStandardMaterial({ color: 0xea6716, roughness: 0.52, side: THREE.DoubleSide }),
    orangeWarmMat: new THREE.MeshStandardMaterial({ color: 0xf38b24, roughness: 0.52, side: THREE.DoubleSide }),
    apricotMat: new THREE.MeshStandardMaterial({ color: 0xf4ae5a, roughness: 0.55, side: THREE.DoubleSide }),
    creamMat: new THREE.MeshStandardMaterial({ color: 0xfff8e3, roughness: 0.58, side: THREE.DoubleSide }),
    centerDarkMat: new THREE.MeshStandardMaterial({ color: 0x45220a, roughness: 0.85 }),
    centerGoldMat: new THREE.MeshStandardMaterial({ color: 0xc98412, roughness: 0.78 })
  };
  return flowerAssetsCache;
}

// Build a lush, layered English church sanctuary floral arrangement (IMG_3938)

export function buildFlowerArrangement(seed = 1) {
  const g = new THREE.Group();
  const a = getFlowerAssets();

  let s = (seed * 2654435761) >>> 0 || 1;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };

  const UP = new THREE.Vector3(0, 1, 0);
  const FWD = new THREE.Vector3(0, 0, 1);
  const anchor = new THREE.Vector3(0.03, 0.035, 0);

  // Low dark-green florist dish & oasis dome tucked on the stone bracket
  addBox(g, [0.18, 0.048, 0.34], a.trayMat, [0.02, 0.024, 0]);
  const oasis = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), a.trayMat);
  oasis.scale.set(0.75, 0.55, 1.35);
  oasis.position.set(0.02, 0.055, 0);
  g.add(oasis);

  function addStem(start: THREE.Vector3, end: THREE.Vector3, radiusScale = 1.0) {
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    if (len < 0.01) return;
    const stem = new THREE.Mesh(a.stemUnitGeo, a.stemMat);
    stem.scale.set(radiusScale, len, radiusScale);
    stem.position.copy(start).addScaledVector(dir, 0.5);
    stem.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
    g.add(stem);
  }

  function addLeafBlade(
    pos: THREE.Vector3,
    dir: THREE.Vector3,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    scale = 1.0,
    roll = 0
  ) {
    const leaf = new THREE.Mesh(geo, mat);
    leaf.position.copy(pos);
    leaf.quaternion.setFromUnitVectors(FWD, dir.clone().normalize());
    if (roll !== 0) leaf.rotateZ(roll);
    leaf.scale.setScalar(scale);
    leaf.castShadow = true;
    g.add(leaf);
  }

  // 1. Lush fan of glossy laurel & bay foliage radiating outward and arching over the stone bracket
  for (let i = 0; i < 42; i++) {
    const frac = i / 41;
    const zAngle = (frac - 0.5) * Math.PI * 0.96 + (rand() - 0.5) * 0.14;
    const elev = 0.05 + Math.pow(rand(), 0.78) * 1.12;
    const spread = 0.05 + rand() * 0.07;

    const dir = new THREE.Vector3(
      -(0.25 + Math.cos(elev) * (0.55 + rand() * 0.38)) * Math.cos(zAngle * 0.65),
      Math.sin(elev) * 0.85 - (elev < 0.22 ? 0.18 : 0),
      Math.sin(zAngle) * (0.95 + rand() * 0.25)
    ).normalize();

    const origin = new THREE.Vector3(
      0.04 - rand() * 0.06,
      0.045 + Math.sin(elev) * 0.1 + rand() * 0.05,
      Math.sin(zAngle) * spread * 1.4
    );
    const leafScale = 0.82 + rand() * 0.55;
    const geo = i % 3 === 0 ? a.ivyLeafGeo : a.laurelLeafGeo;
    const mat = a.leafMats[i % a.leafMats.length];
    addLeafBlade(origin, dir, geo, mat, leafScale, (rand() - 0.5) * 0.75);
  }

  // 2. Airy arching foliage sprays & feathery sprigs framing the top crown & left/right wings (IMG_3938)
  const spraySpecs = [
    [-0.08, 0.49, -0.02],
    [-0.07, 0.46, -0.14],
    [-0.07, 0.45, 0.13],
    [-0.1, 0.38, -0.25],
    [-0.1, 0.37, 0.26],
    [-0.13, 0.25, -0.34],
    [-0.13, 0.24, 0.34],
    [-0.18, 0.13, -0.35],
    [-0.18, 0.12, 0.35],
    [-0.22, 0.05, -0.22],
    [-0.22, 0.04, 0.22],
    [-0.24, 0.03, 0.0]
  ];
  spraySpecs.forEach(([sx, sy, sz], idx) => {
    const tip = new THREE.Vector3(sx + (rand() - 0.5) * 0.03, sy + (rand() - 0.5) * 0.03, sz + (rand() - 0.5) * 0.03);
    addStem(anchor, tip, 0.78);
    const stemDir = new THREE.Vector3().subVectors(tip, anchor).normalize();
    for (let k = 1; k <= 4; k++) {
      const t = 0.38 + (k / 4) * 0.6;
      const p = new THREE.Vector3().lerpVectors(anchor, tip, t);
      const side = k % 2 === 0 ? 1 : -1;
      const leafletDir = stemDir
        .clone()
        .add(new THREE.Vector3(-0.18, 0.12, side * 0.55))
        .normalize();
      addLeafBlade(p, leafletDir, a.sprayLeafletGeo, a.leafMats[(idx + k) % a.leafMats.length], 0.85 + (1 - t) * 0.35);
    }
  });

  // Helper to construct a realistic multi-petal flower head (chrysanthemum, gerbera, rose, or spray daisy)
  function createFlowerHead(kind: string, scale = 1.0) {
    const head = new THREE.Group();

    const calyx = new THREE.Mesh(a.calyxGeo, a.stemMat);
    calyx.rotation.x = Math.PI;
    calyx.position.y = -0.008;
    head.add(calyx);

    if (kind === 'mum-yellow' || kind === 'mum-gold') {
      const pMat = kind === 'mum-yellow' ? a.yellowBrightMat : a.yellowGoldMat;
      const center = new THREE.Mesh(a.centerGeo, a.centerGoldMat);
      center.scale.set(0.85, 0.55, 0.85);
      center.position.y = 0.008;
      head.add(center);

      const rings = [
        { count: 12, tilt: 0.14, r: 0.006, s: 1.05, y: 0.001 },
        { count: 9, tilt: 0.46, r: 0.004, s: 0.88, y: 0.005 },
        { count: 6, tilt: 0.82, r: 0.002, s: 0.68, y: 0.009 }
      ];
      rings.forEach((ring, ri) => {
        for (let i = 0; i < ring.count; i++) {
          const ang = (i / ring.count) * Math.PI * 2 + ri * 0.42 + (rand() - 0.5) * 0.14;
          const p = new THREE.Mesh(a.mumPetalGeo, pMat);
          p.position.set(Math.sin(ang) * ring.r, ring.y, Math.cos(ang) * ring.r);
          p.rotation.order = 'YXZ';
          p.rotation.y = ang;
          p.rotation.x = -ring.tilt - (rand() - 0.5) * 0.1;
          p.scale.setScalar(ring.s);
          head.add(p);
        }
      });
    } else if (kind === 'gerbera-orange' || kind === 'gerbera-warm') {
      const pMat = kind === 'gerbera-orange' ? a.orangeVibrantMat : a.orangeWarmMat;
      const disc = new THREE.Mesh(a.centerGeo, a.centerDarkMat);
      disc.scale.set(1.0, 0.45, 1.0);
      disc.position.y = 0.006;
      head.add(disc);

      const rings = [
        { count: 13, tilt: 0.08, s: 1.02, y: 0.002 },
        { count: 10, tilt: 0.28, s: 0.78, y: 0.005 }
      ];
      rings.forEach((ring, ri) => {
        for (let i = 0; i < ring.count; i++) {
          const ang = (i / ring.count) * Math.PI * 2 + ri * 0.25 + (rand() - 0.5) * 0.1;
          const p = new THREE.Mesh(a.daisyPetalGeo, pMat);
          p.position.set(Math.sin(ang) * 0.008, ring.y, Math.cos(ang) * 0.008);
          p.rotation.order = 'YXZ';
          p.rotation.y = ang;
          p.rotation.x = -ring.tilt;
          p.scale.setScalar(ring.s);
          head.add(p);
        }
      });
    } else if (kind === 'rose-apricot') {
      const rings = [
        { count: 6, tilt: 0.45, r: 0.008, s: 1.0, y: 0.002 },
        { count: 5, tilt: 0.85, r: 0.005, s: 0.8, y: 0.006 },
        { count: 4, tilt: 1.18, r: 0.002, s: 0.58, y: 0.01 }
      ];
      rings.forEach((ring, ri) => {
        for (let i = 0; i < ring.count; i++) {
          const ang = (i / ring.count) * Math.PI * 2 + ri * 0.65;
          const p = new THREE.Mesh(a.rosePetalGeo, a.apricotMat);
          p.position.set(Math.sin(ang) * ring.r, ring.y, Math.cos(ang) * ring.r);
          p.rotation.order = 'YXZ';
          p.rotation.y = ang;
          p.rotation.x = -ring.tilt;
          p.scale.setScalar(ring.s);
          head.add(p);
        }
      });
    } else {
      // Dainty cream-white spray daisy floret
      const disc = new THREE.Mesh(a.centerGeo, a.centerGoldMat);
      disc.scale.set(0.45, 0.35, 0.45);
      disc.position.y = 0.003;
      head.add(disc);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + rand() * 0.2;
        const p = new THREE.Mesh(a.smallPetalGeo, a.creamMat);
        p.position.set(Math.sin(ang) * 0.004, 0.002, Math.cos(ang) * 0.004);
        p.rotation.order = 'YXZ';
        p.rotation.y = ang;
        p.rotation.x = -0.14;
        head.add(p);
      }
    }

    head.scale.setScalar(scale);
    return head;
  }

  // 3. Curated focal blooms (golden-yellow mums, vivid orange gerberas, warm apricot roses)
  const focalBlooms = [
    { pos: [-0.08, 0.41, -0.02], kind: 'mum-yellow', scale: 0.96 },
    { pos: [-0.14, 0.34, -0.12], kind: 'gerbera-orange', scale: 1.02 },
    { pos: [-0.14, 0.33, 0.13], kind: 'mum-gold', scale: 0.98 },
    { pos: [-0.21, 0.25, -0.04], kind: 'gerbera-warm', scale: 1.08 },
    { pos: [-0.19, 0.24, 0.09], kind: 'mum-yellow', scale: 1.04 },
    { pos: [-0.18, 0.23, -0.19], kind: 'mum-gold', scale: 0.95 },
    { pos: [-0.16, 0.21, 0.23], kind: 'gerbera-orange', scale: 0.96 },
    { pos: [-0.23, 0.16, -0.12], kind: 'mum-yellow', scale: 1.02 },
    { pos: [-0.24, 0.15, 0.03], kind: 'rose-apricot', scale: 1.05 },
    { pos: [-0.21, 0.14, 0.16], kind: 'mum-yellow', scale: 0.94 },
    { pos: [-0.14, 0.14, -0.27], kind: 'gerbera-warm', scale: 0.88 },
    { pos: [-0.14, 0.13, 0.28], kind: 'rose-apricot', scale: 0.9 },
    { pos: [-0.22, 0.09, -0.03], kind: 'gerbera-orange', scale: 0.96 },
    { pos: [-0.19, 0.29, -0.09], kind: 'rose-apricot', scale: 0.92 },
    { pos: [-0.11, 0.36, 0.03], kind: 'gerbera-warm', scale: 0.9 }
  ];

  focalBlooms.forEach((b) => {
    const pos = new THREE.Vector3(
      b.pos[0] + (rand() - 0.5) * 0.025,
      b.pos[1] + (rand() - 0.5) * 0.025,
      b.pos[2] + (rand() - 0.5) * 0.03
    );
    addStem(anchor, pos, 0.95);
    const head = createFlowerHead(b.kind, b.scale * (0.94 + rand() * 0.14));
    head.position.copy(pos);
    // Orient bloom face outward along stem + biased toward Nave (-X) so petals greet the viewer
    const faceDir = new THREE.Vector3()
      .subVectors(pos, anchor)
      .normalize()
      .add(new THREE.Vector3(-0.75, 0.14, 0))
      .normalize();
    head.quaternion.setFromUnitVectors(UP, faceDir);
    head.rotateY(rand() * Math.PI * 2);
    g.add(head);
  });

  // 4. Dainty cream-white spray daisies nestled among the foliage for light, natural contrast
  for (let i = 0; i < 14; i++) {
    const ang = ((i + 0.5) / 14 - 0.5) * Math.PI * 0.95;
    const h = 0.08 + rand() * 0.34;
    const reach = 0.14 + (1 - h * 1.4) * 0.12 + rand() * 0.04;
    const pos = new THREE.Vector3(-reach * Math.cos(ang * 0.6), h, Math.sin(ang) * (0.28 + rand() * 0.06));
    addStem(anchor, pos, 0.6);
    const floret = createFlowerHead('daisy-cream', 0.85 + rand() * 0.4);
    floret.position.copy(pos);
    const faceDir = new THREE.Vector3(-0.75, 0.25, Math.sin(ang) * 0.6).normalize();
    floret.quaternion.setFromUnitVectors(UP, faceDir);
    g.add(floret);
  }

  return g;
}

// Helper to trace a miniature trefoil-headed vertical tracery cutout hole (CW winding)

export function buildOldBible(mats: ChurchMaterials) {
  const g = new THREE.Group();
  const W = 0.28; // spine to fore-edge
  const D = 0.36; // head to tail
  const H = 0.09;
  const bt = 0.008; // board thickness

  const cv = makeCanvas(256, 256);
  const c = canvas2d(cv);
  c.fillStyle = '#3a2218';
  c.fillRect(0, 0, 256, 256);
  let a = 1611;
  const rnd = () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
  for (let i = 0; i < 2600; i++) {
    const l = rnd() < 0.5 ? 255 : 0;
    c.fillStyle = `rgba(${l},${l * 0.85},${l * 0.7},${0.03 + rnd() * 0.05})`;
    c.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 5, 1 + rnd() * 3);
  }
  // rubbed, paler wear towards the edges and corners
  const wear = c.createRadialGradient(128, 128, 60, 128, 128, 190);
  wear.addColorStop(0, 'rgba(0,0,0,0)');
  wear.addColorStop(1, 'rgba(150,105,70,0.35)');
  c.fillStyle = wear;
  c.fillRect(0, 0, 256, 256);
  // Blind-tooled double border, and "HOLY BIBLE" embossed inside a six-pointed star with bulging, rounded points.
  // The cover is taller than wide, so the emblem is drawn squashed vertically to come out true on the board.
  const drawCover = (ctx: CanvasRenderingContext2D, line: string, fill: string) => {
    ctx.strokeStyle = line;
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, 220, 220);
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, 196, 196);
    ctx.save();
    ctx.translate(128, 128);
    ctx.scale(1, W / D);
    // Sharp tips joined by sides that bulge outwards, so the star looks puffed up
    ctx.beginPath();
    const tipR = 88;
    const valleyR = 50;
    const at = (ang: number, r: number) => [Math.cos(ang) * r, Math.sin(ang) * r];
    for (let i = 0; i < 6; i++) {
      const tipA = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const valA = tipA + Math.PI / 6;
      const nextA = tipA + Math.PI / 3;
      const [tx, ty] = at(tipA, tipR);
      if (i === 0) ctx.moveTo(tx, ty);
      const [c1x, c1y] = at(tipA + Math.PI / 12, 80);
      const [vx, vy] = at(valA, valleyR);
      ctx.quadraticCurveTo(c1x, c1y, vx, vy);
      const [c2x, c2y] = at(nextA - Math.PI / 12, 80);
      const [nx, ny] = at(nextA, tipR);
      ctx.quadraticCurveTo(c2x, c2y, nx, ny);
    }
    ctx.closePath();
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = fill;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 30px Georgia, serif';
    ctx.fillText('HOLY', 0, -20);
    ctx.fillText('BIBLE', 0, 20);
    ctx.restore();
  };
  // Colour: the tooling pressed dark into the leather, the lettering's faded gilt
  drawCover(c, 'rgba(15,6,3,0.6)', 'rgba(176,138,72,0.85)');
  const leatherTex = canvasTexture(cv);
  // Bump: the border lines and star outline pressed in, the letters raised
  const bv = makeCanvas(256, 256);
  const bc = canvas2d(bv);
  bc.fillStyle = '#808080';
  bc.fillRect(0, 0, 256, 256);
  drawCover(bc, '#303030', '#e0e0e0');
  const bumpTex = new THREE.CanvasTexture(bv);
  const leather = new THREE.MeshStandardMaterial({
    map: leatherTex,
    bumpMap: bumpTex,
    bumpScale: 2.5,
    roughness: 0.72
  });
  const plainLeather = new THREE.MeshStandardMaterial({ color: 0x3a2218, roughness: 0.75 });
  const pageEdge = new THREE.MeshStandardMaterial({ color: 0xa8956a, roughness: 0.6, metalness: 0.2 });
  const brass = mats.brass;

  // Boards: textured on their outer faces only
  const boardMats = [plainLeather, plainLeather, leather, leather, plainLeather, plainLeather];
  [bt * 0.5, H - bt * 0.5].forEach((y) => {
    const board = addBox(g, [W, bt, D], boardMats, [0, 0, 0], { cast: true, receive: true });
    board.position.y = y;
  });
  addBox(g, [W - 0.012, H - bt * 2, D - 0.014], pageEdge, [0.004, H * 0.5, 0]);
  // Rounded spine with five raised bands
  const spine = new THREE.Mesh(
    new THREE.CylinderGeometry(H * 0.5, H * 0.5, D, 16, 1, false, Math.PI, Math.PI),
    plainLeather
  );
  spine.rotation.x = Math.PI / 2;
  spine.scale.set(0.35, 1, 1);
  spine.position.set(-W * 0.5, H * 0.5, 0);
  spine.castShadow = true;
  g.add(spine);
  for (let k = 0; k < 5; k++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(H * 0.5, 0.0045, 6, 16, Math.PI), plainLeather);
    band.rotation.set(0, 0, Math.PI / 2);
    band.scale.set(1, 0.35, 1);
    band.position.set(-W * 0.5, H * 0.5, -D * 0.33 + (k * D * 0.66) / 4);
    g.add(band);
  }
  // Brass corner pieces on the fore-edge corners of the front board
  [-1, 1].forEach((sz) => {
    addBox(g, [0.045, 0.003, 0.045], brass, [W * 0.5 - 0.021, H + 0.0015, sz * (D * 0.5 - 0.021)]);
  });
  // Clasp: a leather strap from the back board round the fore-edge, ending in a brass hasp over a pin on the front
  const strapW = 0.04;
  addBox(g, [0.05, 0.003, strapW], plainLeather, [W * 0.5 - 0.02, -0.0015, 0]);
  addBox(g, [0.004, H + 0.006, strapW], plainLeather, [W * 0.5 + 0.002, H * 0.5, 0]);
  addBox(g, [0.06, 0.004, strapW + 0.006], brass, [W * 0.5 - 0.026, H + 0.002, 0], { cast: true });
  addBox(g, [0.006, 0.02, strapW + 0.006], brass, [W * 0.5 + 0.004, H - 0.006, 0]);
  const catchPin = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.008, 10), brass);
  catchPin.position.set(W * 0.5 - 0.05, H + 0.006, 0);
  g.add(catchPin);
  return g;
}

// A pile of cloth-bound hymn books, laid flat with their spines alternating side to side as they are stacked to
// keep the pile level: blue boards overhanging a cream page block (its edges ruled with leaves), a rounded spine
// with gilt bands, each book a little askew. Instanced, so the whole pile is four draw calls.
// `books` optionally fixes the pile instead: [{ t, colour }] from the bottom up, each with its own cloth colour.

export function buildHymnBookPile(
  x: number,
  baseY: number,
  z: number,
  height: number,
  { books: spec = null, seed = 3944 }: { books?: HymnBookLayer[] | null; seed?: number } = {}
) {
  const g = new THREE.Group();
  const rng = (() => {
    let a = seed;
    return () => {
      a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
      return a / 4294967296;
    };
  })();
  const W = 0.135; // across, spine to fore-edge
  const D = 0.2; // head to tail
  const board = 0.0028;
  const books: StackedHymnBook[] = [];
  let y = 0;
  while (spec ? books.length < spec.length : y < height - 0.02) {
    const t = spec ? spec[books.length].t : 0.026 + rng() * 0.008;
    books.push({
      y,
      t,
      side: books.length % 2 ? 1 : -1,
      rot: (rng() - 0.5) * 0.12,
      dx: (rng() - 0.5) * 0.014,
      dz: (rng() - 0.5) * 0.014
    });
    y += t;
  }
  const pageCanvas = makeCanvas(64, 64);
  const pctx = canvas2d(pageCanvas);
  pctx.fillStyle = '#ece2c8';
  pctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 64; i += 2) {
    pctx.fillStyle = `rgba(120,100,70,${0.12 + rng() * 0.12})`;
    pctx.fillRect(0, i, 64, 1);
  }
  const pageTex = canvasTexture(pageCanvas);
  const pageMat = new THREE.MeshStandardMaterial({ map: pageTex, roughness: 0.9 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0x2c5688, roughness: 0.8 });
  const giltMat = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.35, metalness: 0.8 });

  const n = books.length;
  const boards = new THREE.InstancedMesh(new THREE.BoxGeometry(W, board, D), clothMat, n * 2);
  const pages = new THREE.InstancedMesh(new THREE.BoxGeometry(W - 0.008, 1, D - 0.008), pageMat, n);
  const spines = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.5, 0.5, D, 12, 1, false, 0, Math.PI),
    clothMat,
    n
  );
  const bands = new THREE.InstancedMesh(new THREE.BoxGeometry(0.003, 1, 0.006), giltMat, n * 2);
  const m = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const pos = new THREE.Vector3();
  books.forEach((b, i) => {
    // Book frame: origin at the centre of the book's base, spine towards +side along x
    const bookM = new THREE.Matrix4().compose(
      new THREE.Vector3(x + b.dx, baseY + b.y, z + b.dz),
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rot + (b.side > 0 ? 0 : Math.PI)),
      new THREE.Vector3(1, 1, 1)
    );
    [board * 0.5, b.t - board * 0.5].forEach((by, k) => {
      local.makeTranslation(0, by, 0);
      boards.setMatrixAt(i * 2 + k, m.multiplyMatrices(bookM, local));
    });
    const pageH = b.t - board * 2;
    local.compose(pos.set(-0.004, b.t * 0.5, 0), q.identity(), sc.set(1, pageH, 1));
    pages.setMatrixAt(i, m.multiplyMatrices(bookM, local));
    // Half-round spine along the book's length, bulging 6mm out past the boards' back edge
    local.compose(
      pos.set(W * 0.5 - 0.002, b.t * 0.5, 0),
      q.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
      sc.set(0.016, 1, b.t)
    );
    spines.setMatrixAt(i, m.multiplyMatrices(bookM, local));
    [-D * 0.36, D * 0.36].forEach((bz, k) => {
      local.compose(pos.set(W * 0.5 + 0.0055, b.t * 0.5, bz), q.identity(), sc.set(1, b.t * 0.7, 1));
      bands.setMatrixAt(i * 2 + k, m.multiplyMatrices(bookM, local));
    });
  });
  if (spec) {
    const c = new THREE.Color();
    clothMat.color.set(0xffffff);
    spec.forEach((b, i) => {
      c.set(b.colour);
      boards.setColorAt(i * 2, c);
      boards.setColorAt(i * 2 + 1, c);
      spines.setColorAt(i, c);
    });
  }
  [boards, pages, spines, bands].forEach((im) => {
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = true;
    im.receiveShadow = true;
    g.add(im);
  });
  return g;
}

// UK 9-litre water fire extinguisher: all red with a red WATER band on its label, black hose down the side to a
// clipped nozzle. Origin at the centre of its base; label faces +Z.

export function buildWaterExtinguisher() {
  const waterG = new THREE.Group();
  const extRedMat = new THREE.MeshStandardMaterial({ color: 0xc8161d, roughness: 0.24, metalness: 0.28 });
  const extBlackMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.55, metalness: 0.15 });
  const extMetalMat = new THREE.MeshStandardMaterial({ color: 0xbec4ca, roughness: 0.3, metalness: 0.85 });
  const extPinMat = new THREE.MeshStandardMaterial({ color: 0xf0c420, roughness: 0.42, metalness: 0.25 });
  const wR = 0.085;
  const wH = 0.5;
  const wTank = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(wR - 0.004, 0),
        new THREE.Vector2(wR, 0.012),
        new THREE.Vector2(wR, wH - 0.05),
        new THREE.Vector2(wR * 0.9, wH - 0.02),
        new THREE.Vector2(wR * 0.6, wH),
        new THREE.Vector2(0.024, wH + 0.012),
        new THREE.Vector2(0.024, wH + 0.03),
        new THREE.Vector2(0, wH + 0.03)
      ],
      24
    ),
    extRedMat
  );
  wTank.castShadow = true;
  wTank.receiveShadow = true;
  waterG.add(wTank);
  const wBase = new THREE.Mesh(new THREE.CylinderGeometry(wR + 0.0015, wR + 0.0025, 0.02, 24), extBlackMat);
  wBase.position.y = 0.01;
  waterG.add(wBase);
  const wCanvas = makeCanvas(256, 256);
  const wctx = canvas2d(wCanvas);
  wctx.fillStyle = '#f4f2ec';
  wctx.fillRect(0, 0, 256, 256);
  wctx.fillStyle = '#c8161d';
  wctx.fillRect(0, 10, 256, 70);
  wctx.fillStyle = '#ffffff';
  wctx.font = 'bold 40px sans-serif';
  wctx.textAlign = 'center';
  wctx.fillText('WATER', 128, 60);
  wctx.fillStyle = '#1c1c1e';
  wctx.font = 'bold 16px sans-serif';
  wctx.fillText('FIRE EXTINGUISHER', 128, 108);
  wctx.fillStyle = '#44464a';
  for (let i = 0; i < 4; i++) wctx.fillRect(34, 124 + i * 14, 188, 5);
  wctx.fillStyle = '#c8161d';
  wctx.fillRect(100, 192, 56, 40);
  wctx.fillStyle = '#ffffff';
  wctx.font = 'bold 28px sans-serif';
  wctx.fillText('A', 128, 224);
  const wTex = canvasTexture(wCanvas);
  const wLabel = new THREE.Mesh(
    new THREE.CylinderGeometry(wR + 0.001, wR + 0.001, 0.24, 20, 1, true, -0.8, 1.6),
    new THREE.MeshStandardMaterial({ map: wTex, roughness: 0.35, metalness: 0.1 })
  );
  wLabel.position.y = 0.25;
  waterG.add(wLabel);
  const wValve = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.05, 12), extMetalMat);
  wValve.position.y = wH + 0.055;
  waterG.add(wValve);
  const wCarry = addBox(waterG, [0.016, 0.013, 0.12], extBlackMat, [0, wH + 0.06, -0.06]);
  wCarry.rotation.x = 0.1;
  const wLever = addBox(waterG, [0.018, 0.012, 0.13], extBlackMat, [0, wH + 0.1, -0.06]);
  wLever.rotation.x = -0.36;
  const wPin = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0024, 6, 14), extPinMat);
  wPin.position.set(0.026, wH + 0.075, -0.01);
  wPin.rotation.y = Math.PI / 3;
  waterG.add(wPin);
  // Hose from the valve, round the shoulder and down the side to a nozzle held in a clip
  const hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.02, wH + 0.055, 0),
    new THREE.Vector3(0.06, wH + 0.05, 0.01),
    new THREE.Vector3(wR + 0.02, wH - 0.03, 0.02),
    new THREE.Vector3(wR + 0.014, 0.3, 0.03),
    new THREE.Vector3(wR + 0.004, 0.16, 0.035)
  ]);
  const hose = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 24, 0.008, 8), extBlackMat);
  hose.castShadow = true;
  waterG.add(hose);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.011, 0.07, 10), extBlackMat);
  nozzle.position.set(wR + 0.004, 0.12, 0.035);
  waterG.add(nozzle);
  addBox(waterG, [0.006, 0.012, 0.03], extMetalMat, [wR + 0.001, 0.12, 0.035]);
  return waterG;
}

/**
 * Gathered cloth curtain skirting a table on all four sides. Origin is the rail
 * at the top of the curtain, centred on the table; the cloth hangs down by `drop`.
 */
export function buildTableCurtain(
  width: number,
  depth: number,
  drop: number,
  clothMat: THREE.Material,
  railMat: THREE.Material
) {
  const g = new THREE.Group();
  const foldPitch = 0.055;
  const foldDepth = 0.012;
  const sides = [
    { len: depth, x: width * 0.5, z: 0, rotY: Math.PI / 2 },
    { len: depth, x: -width * 0.5, z: 0, rotY: -Math.PI / 2 },
    { len: width, x: 0, z: depth * 0.5, rotY: 0 },
    { len: width, x: 0, z: -depth * 0.5, rotY: Math.PI }
  ];
  sides.forEach(({ len, x, z, rotY }, sideIdx) => {
    const segW = Math.max(24, Math.round((len / foldPitch) * 6));
    const geo = new THREE.PlaneGeometry(len, drop, segW, 10);
    const pos = geo.attributes.position;
    const folds = Math.round(len / foldPitch);
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / len + 0.5;
      const v = 0.5 - pos.getY(i) / drop; // 0 at rail, 1 at hem
      const phase = u * folds * Math.PI * 2 + sideIdx * 0.7;
      // Folds are tight at the rail and relax and flare slightly towards the hem
      const amp = foldDepth * (0.75 + 0.5 * v) * (1 + 0.15 * Math.sin(u * 13.1 + sideIdx));
      let offset = Math.sin(phase) * amp + 0.006 + v * 0.018;
      // Fade the folds out at the corners so neighbouring sides meet cleanly
      const edge = Math.min(u, 1 - u) * len;
      if (edge < 0.03) offset *= edge / 0.03;
      pos.setZ(i, offset);
      pos.setY(i, -v * drop);
    }
    geo.computeVertexNormals();
    const cloth = new THREE.Mesh(geo, clothMat);
    cloth.position.set(x, 0, z);
    cloth.rotation.y = rotY;
    cloth.castShadow = true;
    cloth.receiveShadow = true;
    g.add(cloth);
  });
  // Slim rail the curtain hangs from, tucked under the tabletop edge
  const railT = 0.012;
  [
    [width + 0.03, 0, depth * 0.5 + 0.01],
    [width + 0.03, 0, -depth * 0.5 - 0.01]
  ].forEach(([len, rx, rz]) => {
    addBox(g, [len, railT, railT], railMat, [rx, -railT * 0.5, rz]);
  });
  [width * 0.5 + 0.01, -width * 0.5 - 0.01].forEach((rx) => {
    addBox(g, [railT, railT, depth + 0.03], railMat, [rx, -railT * 0.5, 0]);
  });
  return g;
}

export function buildTortoiseStove(mats: ChurchMaterials, x: number, floorY: number, z: number, wallZ: number) {
  const g = markEra1900(new THREE.Group());
  const ironBlack = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.5, metalness: 0.55 });
  const add = (mesh: THREE.Object3D, px: number, py: number, pz: number) => {
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };
  const oct = (r0: number, r1: number, h: number) => {
    const geo = new THREE.CylinderGeometry(r1, r0, h, 8);
    geo.rotateY(Math.PI / 8); // flat faces to the cardinal directions
    return geo;
  };
  const flat = (f: number) => f / Math.cos(Math.PI / 8); // circumradius for a given centre-to-face distance
  // Stepped, moulded base; panelled octagonal body; heavy moulded cornice; small raised collar on top
  add(new THREE.Mesh(oct(flat(0.29), flat(0.285), 0.06), ironBlack), x, floorY + 0.03, z);
  add(new THREE.Mesh(oct(flat(0.27), flat(0.25), 0.1), ironBlack), x, floorY + 0.11, z);
  add(new THREE.Mesh(oct(flat(0.25), flat(0.235), 0.05), ironBlack), x, floorY + 0.185, z);
  add(new THREE.Mesh(oct(flat(0.22), flat(0.22), 0.66), ironBlack), x, floorY + 0.54, z);
  add(new THREE.Mesh(oct(flat(0.235), flat(0.25), 0.05), ironBlack), x, floorY + 0.895, z);
  add(new THREE.Mesh(oct(flat(0.27), flat(0.27), 0.08), ironBlack), x, floorY + 0.96, z);
  add(new THREE.Mesh(oct(flat(0.27), flat(0.25), 0.03), ironBlack), x, floorY + 1.015, z);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.14), ironBlack), x, floorY + 1.065, z + 0.04);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.1), ironBlack), x, floorY + 1.11, z + 0.04);

  // Cast relief panels on the eight faces: a climbing scroll of linked foliate roundels on the four square
  // faces, a grid of square rosette tiles on the four corner faces (from the maker's catalogue drawing)
  const panelMap = (kind: string) => {
    const c = makeCanvas(64, 256);
    const ctx = canvas2d(c);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 64, 256);
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, 58, 250);
    if (kind === 'scroll') {
      ctx.beginPath();
      ctx.moveTo(32, 8);
      ctx.lineTo(32, 248);
      ctx.stroke();
      for (let k = 0; k < 3; k++) {
        const cy = 46 + k * 82;
        ctx.beginPath();
        ctx.arc(32, cy, 24, 0, Math.PI * 2);
        ctx.stroke();
        // Three-leaf sprig inside each roundel, and curling tendrils between them
        [-1, 1].forEach((sd) => {
          ctx.beginPath();
          ctx.ellipse(32 + sd * 9, cy - 4, 8, 4, sd * -0.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(32 + sd * 14, cy + 34, 6, 0, Math.PI * 1.5);
          ctx.stroke();
        });
        ctx.beginPath();
        ctx.ellipse(32, cy - 12, 4, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      for (let r = 0; r < 7; r++) {
        for (let q = 0; q < 2; q++) {
          const tx = 8 + q * 25;
          const ty = 9 + r * 35;
          ctx.strokeRect(tx, ty, 22, 30);
          ctx.beginPath();
          ctx.arc(tx + 11, ty + 15, 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(tx + 11, ty + 15, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    return new THREE.CanvasTexture(c);
  };
  const panelMats: Record<string, THREE.MeshStandardMaterial> = {};
  ['scroll', 'tiles'].forEach((kind) => {
    const bump = panelMap(kind);
    panelMats[kind] = new THREE.MeshStandardMaterial({
      color: 0x1c1c1e,
      roughness: 0.45,
      metalness: 0.55,
      bumpMap: bump,
      bumpScale: 3,
      emissive: 0x2c2c2e,
      emissiveMap: bump,
      emissiveIntensity: 0.6
    });
  });
  const faceW = 2 * 0.22 * Math.tan(Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4; // outward normal angle from +Z
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(faceW - 0.025, 0.58),
      i % 2 === 0 ? panelMats.scroll : panelMats.tiles
    );
    p.position.set(x + Math.sin(a) * 0.2215, floorY + 0.54, z + Math.cos(a) * 0.2215);
    p.rotation.y = a;
    g.add(p);
  }

  // Hinged maker's plate ('Tortoise Stove') hanging on a front corner face near the bottom
  const c = makeCanvas(128, 96);
  const ctx = canvas2d(c);
  ctx.fillStyle = '#2a2a2c';
  ctx.fillRect(0, 0, 128, 96);
  ctx.strokeStyle = '#77777a';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 120, 88);
  ctx.fillStyle = '#8a8a8e';
  ctx.textAlign = 'center';
  ctx.font = 'italic bold 30px Georgia, serif';
  ctx.fillText('Tortoise', 64, 44);
  ctx.fillText('Stove', 64, 78);
  const tex = canvasTexture(c);
  const plateA = Math.PI * 0.75; // front corner face, towards the aisle (-Z) and the font (-X)
  const makerPlate = addBox(
    g,
    [0.13, 0.1, 0.008],
    [
      ironBlack,
      ironBlack,
      ironBlack,
      ironBlack,
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.5 }),
      ironBlack
    ],
    [x + Math.sin(plateA) * 0.235, floorY + 0.36, z + Math.cos(plateA) * 0.235],
    { cast: true }
  );
  makerPlate.rotation.y = plateA;
  makerPlate.rotation.x = -0.08;
  const hinge = add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 8), ironBlack), 0, 0, 0);
  hinge.position.set(x + Math.sin(plateA) * 0.232, floorY + 0.41, z + Math.cos(plateA) * 0.232);
  hinge.rotation.z = Math.PI / 2;
  hinge.rotation.y = plateA;

  // Flue pipe: out of the back, an elbow, straight up, then a 45-degree bend running diagonally up to enter the
  // wall at three-quarters of its height
  const pipeR = 0.065;
  const outY = floorY + 0.58;
  const riseZ = z + 0.48;
  const topY = floorY + DIM.nave.eavesY * 0.75;
  const pipe = (a: THREE.Vector3, b: THREE.Vector3) => {
    const len = a.distanceTo(b);
    const m = add(new THREE.Mesh(new THREE.CylinderGeometry(pipeR, pipeR, len, 16, 1, true), ironBlack), 0, 0, 0);
    m.position.copy(a).lerp(b, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  };
  const elbow = (p: THREE.Vector3) =>
    add(new THREE.Mesh(new THREE.SphereGeometry(pipeR * 1.05, 16, 12), ironBlack), p.x, p.y, p.z);
  const p0 = new THREE.Vector3(x, outY, z + 0.2);
  const p1 = new THREE.Vector3(x, outY, riseZ);
  const p2 = new THREE.Vector3(x, topY - (wallZ - riseZ), riseZ);
  const p3 = new THREE.Vector3(x, topY + 0.01, wallZ + 0.01);
  pipe(p0, p1);
  elbow(p1);
  pipe(p1, p2);
  elbow(p2);
  pipe(p2, p3);
  // Collars at the pipe joints and a round cast-iron soot door plate where the flue enters the wall
  [0.35, 0.62, 0.88].forEach((t) => {
    const col = add(
      new THREE.Mesh(new THREE.CylinderGeometry(pipeR * 1.12, pipeR * 1.12, 0.03, 16), ironBlack),
      0,
      0,
      0
    );
    col.position.copy(p1).lerp(p2, t);
  });
  const plate = add(
    new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 20), ironBlack),
    x,
    p3.y,
    wallZ - 0.006
  );
  plate.rotation.x = Math.PI / 2;
  // Iron wall stays holding the riser
  [0.45, 0.85].forEach((t) => {
    const stay = add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, wallZ - riseZ), ironBlack), 0, 0, 0);
    stay.position.set(x, outY + (p2.y - outY) * t, (riseZ + wallZ) * 0.5);
  });
  return g;
}

// Ellacombe-style chiming frame on the vestry's West wall: a ringer pulls the three cords in turn, each lifting a

export function buildChimingFrame(mats: ChurchMaterials, floorY: number) {
  const g = markEra1900(new THREE.Group());
  g.userData.ringsBells = true;
  const x = DIM.nave.xWestInt + 0.03;
  const zc = -1.75;
  const y0 = floorY + 0.95;
  const y1 = floorY + 2.15;
  addBox(g, [0.03, y1 - y0, 0.46], mats.medOak, [x, (y0 + y1) * 0.5, zc]);
  [y0 + 0.04, y1 - 0.05].forEach((ry) => {
    addBox(g, [0.07, 0.07, 0.5], mats.darkOak, [x + 0.035, ry, zc]);
  });
  const cordMat = createRopeMaterial();
  const ceilingY = DIM.tower.belfryCeilingY;
  [-0.14, 0, 0.14].forEach((dz, i) => {
    const cz = zc + dz;
    // Cord from its hook on the bottom rail, over a brass pulley on the top rail and up through the ceiling
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, ceilingY - y0 - 0.08, 6), cordMat);
    cord.position.set(x + 0.085, (ceilingY + y0 + 0.08) * 0.5, cz);
    cord.userData.chimeCord = i + 1; // belfry.js pulls it down as that bell's hammer strikes
    g.add(cord);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 12), mats.brass);
    hook.position.set(x + 0.085, y0 + 0.07, cz);
    hook.rotation.y = Math.PI / 2;
    g.add(hook);
    const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 14), mats.brass);
    pulley.rotation.x = Math.PI / 2;
    pulley.position.set(x + 0.085, y1 - 0.05, cz);
    g.add(pulley);
    // Number plate above each cord (1 treble, 2, 3 tenor)
    const nc = makeCanvas(64, 64);
    const nctx = canvas2d(nc);
    nctx.fillStyle = '#d8c48a';
    nctx.fillRect(0, 0, 64, 64);
    nctx.fillStyle = '#2a2018';
    nctx.font = 'bold 44px Georgia, serif';
    nctx.textAlign = 'center';
    nctx.fillText(String(i + 1), 32, 48);
    const nt = canvasTexture(nc);
    const num = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), new THREE.MeshStandardMaterial({ map: nt }));
    num.rotation.y = Math.PI / 2;
    num.position.set(x + 0.016, y1 - 0.15, cz);
    g.add(num);
  });
  // An invisible block over the frame takes the clicks
  const hit = addBox(g, [0.25, y1 - y0, 0.5], mats.medOak, [x + 0.1, (y0 + y1) * 0.5, zc]);
  hit.visible = false;
  return g;
}
