import * as THREE from 'three';
import { DIM } from '/assets/js/st-peters-3d/dimensions.js';
import { applyBoxUVs, capSolidMasonry } from '/assets/js/st-peters-3d/architecture.js';
import { createCarvedAngelHeightMap } from '/assets/js/st-peters-3d/plaques.js';

// Helper to create a warm varnished oak pew with scalloped ends, crimson seat cushion & blue kneelers
function buildPew(length, mats, { includeKneelers = true } = {}) {
  const g = new THREE.Group();
  const seatH = 0.44;
  const seatD = 0.42;
  const backH = 0.9;

  // Seat plank
  const seat = new THREE.Mesh(new THREE.BoxGeometry(seatD, 0.045, length), mats.warmOak);
  seat.position.set(0, seatH, 0);
  seat.castShadow = true;
  seat.receiveShadow = true;
  g.add(seat);

  // Crimson velvet seat cushion
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(seatD - 0.05, 0.055, length - 0.08), mats.cushionCrimson);
  cushion.position.set(0.01, seatH + 0.048, 0);
  cushion.castShadow = true;
  cushion.receiveShadow = true;
  g.add(cushion);

  // Slanted open backrest + top rail + book ledge behind
  const backLower = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.24, length - 0.04), mats.warmOak);
  backLower.position.set(-seatD * 0.45, seatH + 0.16, 0);
  backLower.rotation.z = 0.1;
  backLower.castShadow = true;
  g.add(backLower);

  const backTopRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, length - 0.02), mats.warmOak);
  backTopRail.position.set(-seatD * 0.5, backH - 0.04, 0);
  backTopRail.castShadow = true;
  g.add(backTopRail);

  const bookLedge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, length - 0.06), mats.warmOak);
  bookLedge.position.set(-seatD * 0.58, backH - 0.2, 0);
  g.add(bookLedge);

  // Shaped / scalloped Victorian oak bench ends
  const endShape = new THREE.Shape();
  endShape.moveTo(-seatD * 0.56, 0);
  endShape.lineTo(seatD * 0.5, 0);
  endShape.lineTo(seatD * 0.5, seatH + 0.12);
  endShape.quadraticCurveTo(seatD * 0.18, seatH + 0.22, 0.02, backH - 0.06);
  endShape.lineTo(-seatD * 0.46, backH + 0.04);
  endShape.lineTo(-seatD * 0.58, backH - 0.04);
  endShape.closePath();

  const endGeo = new THREE.ExtrudeGeometry(endShape, { depth: 0.055, bevelEnabled: false });
  [-1, 1].forEach((side) => {
    const endMesh = new THREE.Mesh(endGeo, mats.warmOak);
    endMesh.position.set(0, 0, side * (length * 0.5) - (side > 0 ? 0.055 : 0));
    endMesh.castShadow = true;
    endMesh.receiveShadow = true;
    g.add(endMesh);
  });

  // Needlepoint hassocks hanging by a cord loop from brass hooks on the back of the pew (IMG_3949 & IMG_3950)
  if (includeKneelers) {
    const kg = getKneelerGeometries();
    const kCount = Math.max(2, Math.floor(length / 0.52));
    const backX = -seatD * 0.5 - 0.004; // rear face of the lower back board
    for (let i = 0; i < kCount; i++) {
      const kz = -length * 0.36 + (i / Math.max(1, kCount - 1)) * (length * 0.72);
      const hookY = seatH + 0.075;
      // Brass screw hook: a short stem out of the back board turning up into a hook
      const stem = new THREE.Mesh(kg.stem, mats.brass);
      stem.position.set(backX - 0.012, hookY, kz);
      g.add(stem);
      const hook = new THREE.Mesh(kg.hook, mats.brass);
      hook.position.set(backX - 0.024, hookY + 0.012, kz);
      g.add(hook);
      // Cord loop over the hook, down to the hassock's top edge
      const loop = new THREE.Mesh(kg.loop, mats.kneelerCord);
      loop.position.set(backX - 0.03, hookY - 0.045, kz);
      g.add(loop);
      const kneeler = new THREE.Mesh(kg.body, mats.kneelerFabric);
      const topY = hookY - 0.085;
      kneeler.position.set(backX - 0.066, topY - kg.height * 0.5, kz);
      kneeler.rotation.z = -0.06;
      kneeler.rotation.y = (((i * 7) % 5) - 2) * 0.03;
      kneeler.castShadow = true;
      kneeler.receiveShadow = true;
      g.add(kneeler);
    }
  }

  return g;
}

// Open visitor book: red cloth boards, two cream ruled pages bowing up from the spine with lines of signatures,
// and a ballpoint pen lying across the right-hand page
function buildVisitorBook(mats, x, y, z) {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 192;
  const ctx = c.getContext('2d');
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
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const pageMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  const coverMat = new THREE.MeshStandardMaterial({ color: 0x6e1f24, roughness: 0.7 });
  const pageW = 0.2;
  const pageD = 0.28;
  const cover = new THREE.Mesh(new THREE.BoxGeometry(pageD + 0.012, 0.008, pageW * 2 + 0.02), coverMat);
  cover.position.y = 0.004;
  g.add(cover);
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
    const block = new THREE.Mesh(new THREE.BoxGeometry(pageD - 0.01, 0.014, pageW - 0.01), pageMat);
    block.position.set(0, 0.009, side * (pageW * 0.5 + 0.003));
    g.add(block);
  });
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.14, 10), mats.iron);
  pen.rotation.z = Math.PI / 2;
  pen.rotation.y = 0.5;
  pen.position.set(0.02, 0.026, pageW * 0.55);
  g.add(pen);
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.003, 0.003), mats.brass);
  clip.rotation.y = 0.5;
  clip.position.set(-0.03, 0.031, pageW * 0.55 + 0.025);
  g.add(clip);
  g.position.set(x, y, z);
  g.rotation.y = -Math.PI / 2 + 0.12; // reads from the pew's front edge
  return g;
}

// Wall donation safe: a black-painted iron door plate in a slightly larger frame, hinged down its left edge,
// with a coin slot across the top and a keyhole below (faces +Z, back on the wall at z = 0)
function buildDonationPlate(mats) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.5, metalness: 0.6 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.01), paint);
  frame.position.z = 0.005;
  g.add(frame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.012), paint);
  door.position.z = 0.016;
  g.add(door);
  // Coin slot (a dark recess in a raised lip) & keyhole
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.006), paint);
  lip.position.set(0, 0.075, 0.025);
  g.add(lip);
  const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.008), dark);
  slot.position.set(0, 0.075, 0.0285);
  g.add(slot);
  const escutcheon = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.004, 16), mats.brass);
  escutcheon.rotation.x = Math.PI / 2;
  escutcheon.position.set(0.045, -0.04, 0.024);
  g.add(escutcheon);
  const keyRound = new THREE.Mesh(new THREE.CircleGeometry(0.0055, 12), dark);
  keyRound.position.set(0.045, -0.036, 0.0265);
  g.add(keyRound);
  const keyStem = new THREE.Mesh(new THREE.PlaneGeometry(0.005, 0.012), dark);
  keyStem.position.set(0.045, -0.045, 0.0265);
  g.add(keyStem);
  // Two hinge knuckles down the left edge
  [0.08, -0.08].forEach((hy) => {
    const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 10), paint);
    knuckle.position.set(-0.104, hy, 0.018);
    g.add(knuckle);
  });
  return g;
}

// Shared hassock geometries: a plump pillow (thickest in the middle, softly rounded to its seams) plus hook & loop
let kneelerGeoCache = null;
function getKneelerGeometries() {
  if (kneelerGeoCache) return kneelerGeoCache;
  const depth = 0.1;
  const height = 0.27;
  const width = 0.24;
  const body = new THREE.BoxGeometry(depth, height, width, 8, 18, 16);
  const pos = body.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) / (depth * 0.5);
    const ny = pos.getY(i) / (height * 0.5);
    const nz = pos.getZ(i) / (width * 0.5);
    // Squash the thickness towards the edges and round off the corners, like a stuffed cushion
    const puff = Math.sqrt(Math.max(0, (1 - Math.pow(Math.abs(ny), 4)) * (1 - Math.pow(Math.abs(nz), 4))));
    const corner = 1 - 0.08 * Math.pow(Math.abs(ny * nz), 2);
    pos.setX(i, nx * depth * 0.5 * (0.45 + 0.55 * puff));
    pos.setY(i, ny * height * 0.5 * corner * (1 - 0.03 * nx * nx));
    pos.setZ(i, nz * width * 0.5 * corner * (1 - 0.03 * nx * nx));
  }
  body.computeVertexNormals();
  const stem = new THREE.CylinderGeometry(0.004, 0.004, 0.026, 8);
  stem.rotateZ(Math.PI / 2);
  const hook = new THREE.TorusGeometry(0.012, 0.0035, 6, 12, Math.PI);
  hook.rotateZ(Math.PI); // a U, open side up, its inner arm on the stem
  const loop = new THREE.TorusGeometry(0.045, 0.003, 5, 20);
  loop.scale(0.32, 1, 1);
  kneelerGeoCache = { body, stem, hook, loop, height };
  return kneelerGeoCache;
}

// Shared geometries for the Edwardian wrought-iron pendant lamps (built once, reused by every fixture)
let pendantGeoCache = null;
function getPendantGeometries() {
  if (pendantGeoCache) return pendantGeoCache;

  // Opal-white tulip bell shade with a hand-crimped, ruffled (frilled) rim (user photo of the nave lamps)
  const profile = [
    [0.016, 0.0],
    [0.028, -0.004],
    [0.042, -0.018],
    [0.052, -0.042],
    [0.058, -0.075],
    [0.06, -0.11],
    [0.064, -0.14],
    [0.074, -0.162],
    [0.092, -0.18],
    [0.108, -0.19],
    [0.114, -0.194]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const shadeGeo = new THREE.LatheGeometry(profile, 72);
  const pos = shadeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp((-0.15 - y) / 0.044, 0, 1);
    if (t <= 0) continue;
    const theta = Math.atan2(x, z);
    // 11 soft scalloped crimps around the rim, rising & falling, with slight in/out flutter
    const wave = Math.sin(theta * 11);
    const radial = 1 + 0.035 * t * Math.cos(theta * 11);
    pos.setX(i, x * radial);
    pos.setZ(i, z * radial);
    pos.setY(i, y + 0.016 * t * t * wave);
  }
  shadeGeo.computeVertexNormals();

  // Thin clear-glass crimped lip around the very edge of the frill
  const lipPts = [];
  for (let i = 0; i <= 96; i++) {
    const theta = (i / 96) * Math.PI * 2;
    const r = 0.114 * (1 + 0.035 * Math.cos(theta * 11));
    lipPts.push(new THREE.Vector3(Math.sin(theta) * r, -0.194 + 0.016 * Math.sin(theta * 11), Math.cos(theta) * r));
  }
  const lipGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lipPts, true), 120, 0.0035, 5, true);

  // Cast-iron gallery cap that grips the shade neck
  const capGeo = new THREE.CylinderGeometry(0.014, 0.024, 0.032, 12);
  const bulbGeo = new THREE.SphereGeometry(0.028, 10, 8);

  // Single forged chain link (elongated oval ring)
  const linkGeo = new THREE.TorusGeometry(0.0095, 0.0026, 4, 10);
  linkGeo.scale(1, 1.55, 1);

  // Scrolled wrought-iron arm (local +X direction) connecting the central circular ring to each lamp
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.145, 0.0, 0),
    new THREE.Vector3(0.21, 0.034, 0),
    new THREE.Vector3(0.29, 0.07, 0),
    new THREE.Vector3(0.365, 0.082, 0),
    new THREE.Vector3(0.42, 0.064, 0),
    new THREE.Vector3(0.45, 0.024, 0),
    new THREE.Vector3(0.456, -0.02, 0)
  ]);
  const armGeo = new THREE.TubeGeometry(armCurve, 40, 0.0085, 6, false);

  // Spiral C-scroll curls forming the lateral petals of the wrought-iron fleur-de-lys bracket
  const spiralCurve = (cx, cy, startAng, r0, r1, turns, dir) => {
    const pts = [];
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = startAng + dir * t * turns * Math.PI * 2;
      const r = r0 + (r1 - r0) * t;
      pts.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0));
    }
    return new THREE.CatmullRomCurve3(pts);
  };
  const upperScrollGeo = new THREE.TubeGeometry(
    spiralCurve(0.37, 0.122, -Math.PI / 2, 0.042, 0.011, 1.15, -1),
    36,
    0.0065,
    6,
    false
  );
  const underScrollGeo = new THREE.TubeGeometry(
    spiralCurve(0.275, 0.032, Math.PI / 2, 0.034, 0.009, 1.1, 1),
    36,
    0.0058,
    6,
    false
  );

  // Sculpted wrought-iron fleur-de-lys crest bridging between the central circular mount ring and each lamp
  const fleurShape = new THREE.Shape();
  fleurShape.moveTo(0, -0.032);
  fleurShape.quadraticCurveTo(0.014, -0.014, 0.007, 0.004);
  // Right curved lateral lily petal
  fleurShape.bezierCurveTo(0.032, 0.008, 0.048, 0.036, 0.036, 0.056);
  fleurShape.bezierCurveTo(0.026, 0.068, 0.013, 0.052, 0.011, 0.028);
  // Tall pointed central spearhead petal
  fleurShape.bezierCurveTo(0.015, 0.052, 0.011, 0.078, 0, 0.098);
  fleurShape.bezierCurveTo(-0.011, 0.078, -0.015, 0.052, -0.011, 0.028);
  // Left curved lateral lily petal
  fleurShape.bezierCurveTo(-0.013, 0.052, -0.026, 0.068, -0.036, 0.056);
  fleurShape.bezierCurveTo(-0.048, 0.036, -0.032, 0.008, -0.007, 0.004);
  fleurShape.quadraticCurveTo(-0.014, -0.014, 0, -0.032);
  const fleurGeo = new THREE.ExtrudeGeometry(fleurShape, {
    depth: 0.007,
    bevelEnabled: true,
    bevelThickness: 0.0018,
    bevelSize: 0.0015,
    bevelSegments: 2
  });
  fleurGeo.translate(0, 0, -0.0035);

  // Forged iron tie-collar wrapping the base of the fleur-de-lys onto the arm
  const collarGeo = new THREE.BoxGeometry(0.022, 0.012, 0.014);

  const ringGeo = new THREE.TorusGeometry(0.15, 0.011, 8, 40);
  ringGeo.rotateX(Math.PI / 2);
  const bossGeo = new THREE.SphereGeometry(0.018, 8, 6);
  bossGeo.scale(1, 0.7, 1.35);

  const roseGeo = new THREE.CylinderGeometry(0.05, 0.065, 0.035, 16);
  const hookGeo = new THREE.TorusGeometry(0.016, 0.004, 6, 12);

  pendantGeoCache = {
    shadeGeo,
    lipGeo,
    capGeo,
    bulbGeo,
    linkGeo,
    armGeo,
    upperScrollGeo,
    underScrollGeo,
    fleurGeo,
    collarGeo,
    ringGeo,
    bossGeo,
    roseGeo,
    hookGeo
  };
  return pendantGeoCache;
}

// Build a 3-light Edwardian wrought-iron pendant:
// ceiling rose & hook, 3 forged link chains descending to the central circular mount ring, and 3 equidistant
// lamps spaced 120° apart around the ring with wrought-iron fleur-de-lys brackets connecting the ring to each lamp.
function buildChandelier(dropHeight, mats, lightIntensity = 1.6) {
  const g = new THREE.Group();
  const geo = getPendantGeometries();
  const ringY = -dropHeight;

  // Ceiling rose & suspension hook
  const rose = new THREE.Mesh(geo.roseGeo, mats.iron);
  rose.position.y = -0.0175;
  g.add(rose);
  const hook = new THREE.Mesh(geo.hookGeo, mats.iron);
  hook.position.y = -0.05;
  g.add(hook);

  // Opal glass shade + clear crimped lip + iron gallery cap + glowing lamp inside
  const addShade = (x, y, z, scale) => {
    const sg = new THREE.Group();
    const cap = new THREE.Mesh(geo.capGeo, mats.iron);
    cap.position.y = 0.006;
    sg.add(cap);
    const shade = new THREE.Mesh(geo.shadeGeo, mats.opalGlass);
    shade.position.y = -0.008;
    sg.add(shade);
    const lip = new THREE.Mesh(geo.lipGeo, mats.opalGlassLip);
    lip.position.y = -0.008;
    sg.add(lip);
    const bulb = new THREE.Mesh(geo.bulbGeo, mats.glassShade);
    bulb.position.y = -0.08;
    sg.add(bulb);
    sg.position.set(x, y, z);
    sg.scale.setScalar(scale);
    g.add(sg);
  };

  // Central horizontal circular wrought-iron mount ring
  const ring = new THREE.Mesh(geo.ringGeo, mats.iron);
  ring.position.y = ringY;
  g.add(ring);

  // 3 equidistant lamps (120° apart) around the central circular mount ring,
  // each connected from the ring by a scrolled wrought-iron arm + fleur-de-lys motif
  const chainRuns = [];
  for (let i = 0; i < 3; i++) {
    const ang = (i * Math.PI * 2) / 3 + Math.PI / 6;
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);

    // Decorative cast boss on the circular ring between the 3 arm junctions
    const midAng = ang + Math.PI / 3;
    const boss = new THREE.Mesh(geo.bossGeo, mats.iron);
    boss.position.set(Math.cos(midAng) * 0.15, ringY - 0.005, Math.sin(midAng) * 0.15);
    boss.rotation.y = -midAng;
    g.add(boss);

    // Radial arm + fleur-de-lys connecting the central ring to the lamp
    const arm = new THREE.Group();
    arm.add(new THREE.Mesh(geo.armGeo, mats.iron));
    arm.add(new THREE.Mesh(geo.upperScrollGeo, mats.iron));
    arm.add(new THREE.Mesh(geo.underScrollGeo, mats.iron));

    // Inner fleur-de-lys at the ring-to-arm junction + outer fleur-de-lys crest along the arm
    const ringFleur = new THREE.Mesh(geo.fleurGeo, mats.iron);
    ringFleur.position.set(0.185, 0.022, 0);
    ringFleur.rotation.z = -0.42;
    ringFleur.scale.setScalar(0.78);
    arm.add(ringFleur);

    const crestFleur = new THREE.Mesh(geo.fleurGeo, mats.iron);
    crestFleur.position.set(0.345, 0.078, 0);
    crestFleur.rotation.z = -0.12;
    arm.add(crestFleur);

    const collar = new THREE.Mesh(geo.collarGeo, mats.iron);
    collar.position.set(0.345, 0.08, 0);
    arm.add(collar);

    arm.position.y = ringY;
    arm.rotation.y = -ang;
    g.add(arm);

    // Equidistant lamp hanging from the outer tip of the fleur-de-lys arm
    const lampR = 0.456;
    addShade(cosA * lampR, ringY - 0.032, sinA * lampR, 1);

    // Forged suspension chain from the ceiling rose down to this arm's mount point on the circular ring
    chainRuns.push([
      new THREE.Vector3(cosA * 0.016, -0.06, sinA * 0.016),
      new THREE.Vector3(cosA * 0.15, ringY + 0.012, sinA * 0.15)
    ]);
  }
  const linkPitch = 0.024;
  let linkCount = 0;
  chainRuns.forEach(([a, b]) => {
    linkCount += Math.max(2, Math.floor(a.distanceTo(b) / linkPitch));
  });
  const chain = new THREE.InstancedMesh(geo.linkGeo, mats.iron, linkCount);
  const up = new THREE.Vector3(0, 1, 0);
  const dirV = new THREE.Vector3();
  const alignQ = new THREE.Quaternion();
  const twistQ = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  let li = 0;
  chainRuns.forEach(([a, b]) => {
    const n = Math.max(2, Math.floor(a.distanceTo(b) / linkPitch));
    dirV.subVectors(b, a).normalize();
    alignQ.setFromUnitVectors(up, dirV);
    for (let k = 0; k < n; k++) {
      p.lerpVectors(a, b, (k + 0.5) / n);
      twistQ.setFromAxisAngle(up, k % 2 === 0 ? 0 : Math.PI / 2);
      const q = alignQ.clone().multiply(twistQ);
      m.compose(p, q, one);
      chain.setMatrixAt(li++, m);
    }
  });
  chain.instanceMatrix.needsUpdate = true;
  g.add(chain);

  // Warm interior pendant PointLight
  const light = new THREE.PointLight(0xffdfb0, lightIntensity, 10.5, 1.7);
  light.position.set(0, ringY - 0.2, 0);
  light.castShadow = false;
  g.add(light);

  return { group: g, light };
}

// Helper to build a smoothly curved, subtly creased botanical blade (leaf or cupped flower petal)
function createCurvedBladeGeo(width, length, arch, cup) {
  const segs = 4;
  const positions = [];
  const indices = [];
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
let flowerAssetsCache = null;
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
function buildFlowerArrangement(seed = 1) {
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
  const dish = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.048, 0.34), a.trayMat);
  dish.position.set(0.02, 0.024, 0);
  g.add(dish);
  const oasis = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), a.trayMat);
  oasis.scale.set(0.75, 0.55, 1.35);
  oasis.position.set(0.02, 0.055, 0);
  g.add(oasis);

  function addStem(start, end, radiusScale = 1.0) {
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    if (len < 0.01) return;
    const stem = new THREE.Mesh(a.stemUnitGeo, a.stemMat);
    stem.scale.set(radiusScale, len, radiusScale);
    stem.position.copy(start).addScaledVector(dir, 0.5);
    stem.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
    g.add(stem);
  }

  function addLeafBlade(pos, dir, geo, mat, scale = 1.0, roll = 0) {
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
  function createFlowerHead(kind, scale = 1.0) {
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

// Build a simple carved wooden angel corbel (mounted on the nave wall plates in IMG_3937, 3950)
function buildAngelCorbel(mats) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.14), mats.medOak);
  g.add(body);
  [-1, 1].forEach((s) => {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.05), mats.medOak);
    wing.position.set(s * 0.18, 0.1, -0.03);
    wing.rotation.z = s * 0.45;
    g.add(wing);
  });
  return g;
}

// Helper to trace a miniature trefoil-headed vertical tracery cutout hole (CW winding)
function createTrefoilLightHole(uL, uR, vBotL, vBotR, vTop, bottomCurveFn = null) {
  const path = new THREE.Path();
  const uMid = (uL + uR) * 0.5;
  const hw = (uR - uL) * 0.5;
  const vSpring = Math.max(Math.max(vBotL, vBotR) + 0.025, vTop - hw * 1.45);
  const vCusp = vSpring + (vTop - vSpring) * 0.42;

  path.moveTo(uL, vBotL);
  path.lineTo(uL, vSpring);
  // Left foil lobe curving in to left cusp
  path.quadraticCurveTo(uL + hw * 0.04, vSpring + (vCusp - vSpring) * 0.68, uL + hw * 0.34, vCusp);
  // Central pointed trefoil apex
  path.quadraticCurveTo(uL + hw * 0.24, vTop - (vTop - vCusp) * 0.35, uMid, vTop);
  path.quadraticCurveTo(uR - hw * 0.24, vTop - (vTop - vCusp) * 0.35, uR - hw * 0.34, vCusp);
  // Right foil lobe curving back to right springline
  path.quadraticCurveTo(uR - hw * 0.04, vSpring + (vCusp - vSpring) * 0.68, uR, vSpring);
  path.lineTo(uR, vBotR);

  if (bottomCurveFn) {
    const steps = 4;
    for (let s = steps - 1; s >= 1; s--) {
      const u = uL + (uR - uL) * (s / steps);
      path.lineTo(u, bottomCurveFn(u));
    }
  }
  path.closePath();
  return path;
}

// Build the Medieval 15th-Century Carved Oak Rood Screen & Dwarf Wall (IMG_3936, 3937, 3939, 3940)
function buildRoodScreen(mats) {
  const g = new THREE.Group();
  const xPos = DIM.nave.xEastInt + 0.02;
  const baseY = DIM.naveFloorY;
  const dwarfH = 1.02;
  const dwarfTopY = baseY + dwarfH;
  const sillH = 0.06;
  const sillTopY = dwarfTopY + sillH;
  const beamBottomY = baseY + 2.44; // Underside of rood beam soffit (y = 2.54)
  const openHalfW = 0.61; // 1.22m wide central doorway opening
  const maxZ = DIM.chancel.zSouthInt; // 2.00m
  const postW = 0.12;
  const sideStart = openHalfW + postW; // 0.73m
  const sideEnd = maxZ - postW; // 1.88m
  const sideSpan = sideEnd - sideStart; // 1.15m
  const bayCount = 5; // 5 tall slender open lights per side (IMG_3937, 3940)
  const bayW = sideSpan / bayCount; // 0.23m per bay

  // Double-chamfered Gothic vertical mullion cross-section (thicker front-to-back than wide)
  const mullionShape = new THREE.Shape();
  const mW = 0.022;
  const mD = 0.048;
  const mC = 0.012;
  mullionShape.moveTo(-mW + mC, -mD);
  mullionShape.lineTo(mW - mC, -mD);
  mullionShape.lineTo(mW, -mD + mC);
  mullionShape.lineTo(mW, mD - mC);
  mullionShape.lineTo(mW - mC, mD);
  mullionShape.lineTo(-mW + mC, mD);
  mullionShape.lineTo(-mW, mD - mC);
  mullionShape.lineTo(-mW, -mD + mC);
  mullionShape.closePath();

  const traceryY0 = beamBottomY - 0.46; // y = 2.08
  const mullionH = traceryY0 + 0.04 - sillTopY;
  const mullionGeo = new THREE.ExtrudeGeometry(mullionShape, { depth: mullionH, bevelEnabled: false });
  mullionGeo.rotateX(-Math.PI / 2);
  mullionGeo.rotateY(Math.PI / 2);
  applyBoxUVs(mullionGeo, 0.45);

  // Precision-cut pierced Gothic tracery head for a single side light (cusped cinquefoil arch + twin batement lights)
  const sideHeadH = beamBottomY - traceryY0; // 0.46m
  const halfBay = bayW * 0.5; // 0.115m
  const clearHW = halfBay - 0.022; // 0.093m clear light half-width
  const sideHeadShape = new THREE.Shape();
  sideHeadShape.moveTo(-halfBay, 0);
  sideHeadShape.lineTo(-clearHW, 0);
  sideHeadShape.lineTo(-clearHW, 0.065);
  // Left lower cusp foil
  sideHeadShape.quadraticCurveTo(-clearHW - 0.004, 0.118, -clearHW * 0.68, 0.138);
  // Left upper cusp foil
  sideHeadShape.quadraticCurveTo(-clearHW * 0.76, 0.184, -clearHW * 0.38, 0.205);
  // Pointed Gothic central apex
  sideHeadShape.quadraticCurveTo(-clearHW * 0.26, 0.242, 0, 0.262);
  sideHeadShape.quadraticCurveTo(clearHW * 0.26, 0.242, clearHW * 0.38, 0.205);
  // Right upper cusp foil
  sideHeadShape.quadraticCurveTo(clearHW * 0.76, 0.184, clearHW * 0.68, 0.138);
  // Right lower cusp foil
  sideHeadShape.quadraticCurveTo(clearHW + 0.004, 0.118, clearHW, 0.065);
  sideHeadShape.lineTo(clearHW, 0);
  sideHeadShape.lineTo(halfBay, 0);
  sideHeadShape.lineTo(halfBay, sideHeadH);
  sideHeadShape.lineTo(-halfBay, sideHeadH);
  sideHeadShape.closePath();

  // Twin pierced Perpendicular batement lights in the spandrel above each side arch (IMG_3939, 3940)
  sideHeadShape.holes.push(createTrefoilLightHole(-0.088, -0.016, 0.228, 0.285, 0.425));
  sideHeadShape.holes.push(createTrefoilLightHole(0.016, 0.088, 0.285, 0.228, 0.425));

  const traceryDepth = 0.062;
  const sideHeadGeo = new THREE.ExtrudeGeometry(sideHeadShape, {
    depth: traceryDepth,
    bevelEnabled: true,
    bevelThickness: 0.007,
    bevelSize: 0.005,
    bevelSegments: 2,
    curveSegments: 10
  });
  sideHeadGeo.translate(0, 0, -traceryDepth * 0.5);
  sideHeadGeo.rotateY(Math.PI / 2);
  applyBoxUVs(sideHeadGeo, 0.45);

  // Helper to build a stepped/moulded heavy oak structural standard post
  function addMouldedStandard(zCenter, yBot, yTop) {
    const h = yTop - yBot;
    const midY = (yBot + yTop) * 0.5;
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, postW), mats.darkOak);
    core.position.set(xPos, midY, zCenter);
    core.castShadow = true;
    core.receiveShadow = true;
    g.add(core);
    // Subtle raised inner/outer vertical chamfer beads catching light on both faces
    const bead = new THREE.Mesh(new THREE.BoxGeometry(0.185, h, postW * 0.56), mats.darkOak);
    bead.position.set(xPos, midY, zCenter);
    g.add(bead);
    // Moulded capital collar right beneath the rood beam soffit
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, postW + 0.025), mats.darkOak);
    cap.position.set(xPos, yTop - 0.022, zCenter);
    g.add(cap);
  }

  // 1. Cream-plastered dwarf walls, dressed limestone jamb quoins, oak sill & 5-light side screens
  [-1, 1].forEach((side) => {
    const segLen = maxZ - openHalfW;
    const midZ = side * (openHalfW + segLen * 0.5);

    const dwarf = new THREE.Mesh(new THREE.BoxGeometry(0.36, dwarfH, segLen), mats.plaster);
    dwarf.position.set(xPos, baseY + dwarfH * 0.5, midZ);
    dwarf.castShadow = true;
    dwarf.receiveShadow = true;
    g.add(dwarf);

    // 5 courses of alternating long-and-short dressed limestone jamb quoins (IMG_3937, 3939, 3940)
    const quoinCourses = 5;
    const courseH = dwarfH / quoinCourses;
    for (let q = 0; q < quoinCourses; q++) {
      const qLen = q % 2 === 0 ? 0.25 : 0.14;
      const quoin = new THREE.Mesh(new THREE.BoxGeometry(0.385, courseH - 0.012, qLen), mats.ashlarWarm);
      quoin.position.set(xPos, baseY + (q + 0.5) * courseH, side * (openHalfW + qLen * 0.5 - 0.008));
      quoin.castShadow = true;
      quoin.receiveShadow = true;
      g.add(quoin);
    }

    // Chamfered dark-oak sill plate along top of dwarf wall
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.16, sillH, segLen + 0.01), mats.darkOak);
    sill.position.set(xPos, dwarfTopY + sillH * 0.5, midZ);
    sill.castShadow = true;
    g.add(sill);

    // Heavy moulded inner doorway standard (runs to floor) & outer wall standard
    addMouldedStandard(side * (openHalfW + postW * 0.5), baseY, beamBottomY);
    addMouldedStandard(side * (maxZ - postW * 0.5), dwarfTopY, beamBottomY);

    // 4 slender chamfered intermediate mullions + 5 pierced Gothic tracery heads per side
    for (let i = 1; i < bayCount; i++) {
      const mz = side * (sideStart + i * bayW);
      const mullion = new THREE.Mesh(mullionGeo, mats.darkOak);
      mullion.position.set(xPos, sillTopY, mz);
      mullion.castShadow = true;
      g.add(mullion);
    }
    for (let i = 0; i < bayCount; i++) {
      const cz = side * (sideStart + (i + 0.5) * bayW);
      const head = new THREE.Mesh(sideHeadGeo, mats.darkOak);
      head.position.set(xPos, traceryY0, cz);
      head.castShadow = true;
      g.add(head);
    }
  });

  // Two small hymn books resting neatly on the North dwarf wall ledge (IMG_3939)
  const blueBookMat = new THREE.MeshStandardMaterial({ color: 0x3b6894, roughness: 0.78 });
  const hymnBook1 = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.032, 0.18), blueBookMat);
  hymnBook1.position.set(xPos + 0.11, dwarfTopY + 0.016, -0.95);
  hymnBook1.rotation.y = 0.06;
  g.add(hymnBook1);
  const hymnBook2 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.024, 0.16), mats.wax);
  hymnBook2.position.set(xPos + 0.11, dwarfTopY + 0.044, -0.96);
  hymnBook2.rotation.y = -0.05;
  g.add(hymnBook2);

  // 2. Central Doorway Depressed Four-Centered Tudor Arch + 6-Light Pierced Perpendicular Tracery Head (IMG_3937, 3940)
  const doorY0 = beamBottomY - 0.92; // y = 1.62
  const doorH = beamBottomY - doorY0; // 0.92m
  const archSpanHW = openHalfW + 0.005;
  const archRise = 0.5; // Crown at y = 2.12m
  const doorArchCurve = (u) => {
    const norm = Math.min(1, Math.abs(u) / archSpanHW);
    return archRise * Math.pow(Math.max(0, 1 - Math.pow(norm, 1.85)), 0.58);
  };

  const doorHeadShape = new THREE.Shape();
  doorHeadShape.moveTo(-archSpanHW, 0);
  const archSamples = 28;
  for (let i = 1; i <= archSamples; i++) {
    const u = -archSpanHW + (i / archSamples) * (archSpanHW * 2);
    doorHeadShape.lineTo(u, doorArchCurve(u));
  }
  doorHeadShape.lineTo(archSpanHW, doorH);
  doorHeadShape.lineTo(-archSpanHW, doorH);
  doorHeadShape.closePath();

  // 6 vertical Perpendicular trefoil-headed tracery lights above the central doorway arch (IMG_3937, 3940)
  const doorLights = 6;
  const doorInnerSpan = (openHalfW - 0.032) * 2;
  const doorCellW = doorInnerSpan / doorLights;
  const doorLightGap = 0.014;
  const doorBotFn = (u) => doorArchCurve(u) + 0.052;
  for (let i = 0; i < doorLights; i++) {
    const uL = -doorInnerSpan * 0.5 + i * doorCellW + doorLightGap;
    const uR = uL + doorCellW - doorLightGap * 2;
    doorHeadShape.holes.push(createTrefoilLightHole(uL, uR, doorBotFn(uL), doorBotFn(uR), doorH - 0.036, doorBotFn));
  }

  const doorHeadGeo = new THREE.ExtrudeGeometry(doorHeadShape, {
    depth: traceryDepth,
    bevelEnabled: true,
    bevelThickness: 0.007,
    bevelSize: 0.005,
    bevelSegments: 2,
    curveSegments: 10
  });
  doorHeadGeo.translate(0, 0, -traceryDepth * 0.5);
  doorHeadGeo.rotateY(Math.PI / 2);
  applyBoxUVs(doorHeadGeo, 0.45);
  const doorHead = new THREE.Mesh(doorHeadGeo, mats.darkOak);
  doorHead.position.set(xPos, doorY0, 0);
  doorHead.castShadow = true;
  g.add(doorHead);

  // Projecting moulded oak inner rib following the central Tudor doorway arch
  const archPts = [];
  for (let i = 0; i <= 24; i++) {
    const u = -openHalfW + (i / 24) * (openHalfW * 2);
    archPts.push(new THREE.Vector3(0, doorY0 + doorArchCurve(u) + 0.018, u));
  }
  const archCurve = new THREE.CatmullRomCurve3(archPts);
  const archRibGeo = new THREE.TubeGeometry(archCurve, 28, 0.028, 6, false);
  archRibGeo.scale(1.65, 1, 1); // Moulded deeper front-to-back
  const archRib = new THREE.Mesh(archRibGeo, mats.darkOak);
  archRib.position.x = xPos;
  archRib.castShadow = true;
  g.add(archRib);

  // 3. Heavy Stepped, Moulded & Crenellated (Battlemented) Rood Beam Cornice across full width (IMG_3939, 3940)
  const fullW = maxZ * 2 + 0.08;
  // Lower moulded soffit rail
  const soffitRail = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.055, fullW), mats.darkOak);
  soffitRail.position.set(xPos, beamBottomY + 0.0275, 0);
  soffitRail.castShadow = true;
  g.add(soffitRail);

  // Deep recessed cavetto / hollow frieze running across the beam
  const friezeY = beamBottomY + 0.112;
  const friezeCore = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.115, fullW - 0.02), mats.darkOak);
  friezeCore.position.set(xPos, friezeY, 0);
  g.add(friezeCore);

  // Subtle carved square oak bosses / paterae recessed along the hollow frieze
  for (let bz = -maxZ + 0.18; bz <= maxZ - 0.18; bz += 0.28) {
    [-0.072, 0.072].forEach((bx) => {
      const boss = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.056, 0.056), mats.darkOak);
      boss.position.set(xPos + bx, friezeY, bz);
      boss.rotation.x = Math.PI / 4;
      g.add(boss);
    });
  }

  // Projecting stepped cornice mouldings above the frieze
  const corniceLower = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.044, fullW + 0.02), mats.darkOak);
  corniceLower.position.set(xPos, beamBottomY + 0.192, 0);
  corniceLower.castShadow = true;
  g.add(corniceLower);

  const corniceUpper = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.054, fullW + 0.04), mats.darkOak);
  corniceUpper.position.set(xPos, beamBottomY + 0.241, 0);
  corniceUpper.castShadow = true;
  g.add(corniceUpper);

  // Crisp battlemented (crenellated) oak merlons crowning the entire rood beam (IMG_3939, 3940)
  for (let mz = -maxZ + 0.09; mz <= maxZ - 0.09; mz += 0.255) {
    const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.062, 0.135), mats.darkOak);
    merlon.position.set(xPos, beamBottomY + 0.299, mz);
    merlon.castShadow = true;
    g.add(merlon);
  }

  // 4. Arched Wooden Hymn Board mounted on the South Nave pier (IMG_3937)
  const hymnG = new THREE.Group();
  const hbBack = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.68, 0.3), mats.medOak);
  hymnG.add(hbBack);
  const hbArch = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.036, 12, 1, false, 0, Math.PI), mats.medOak);
  hbArch.rotation.z = Math.PI / 2;
  hbArch.position.y = 0.34;
  hymnG.add(hbArch);
  for (let r = 0; r < 5; r++) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.018, 0.28), mats.darkOak);
    rail.position.set(-0.008, -0.24 + r * 0.125, 0);
    hymnG.add(rail);
  }
  hymnG.position.set(xPos - 0.13, baseY + 1.84, maxZ - 0.16);
  g.add(hymnG);

  return g;
}

// Three-strand hawser-laid bell rope: a cylinder whose radius dips into three helical grooves, with
// vertex colours shading each strand round its crown and a fine streak of fibre along it.
// Pass a curve to lay the rope along it (it is built straight, then each ring is carried onto the curve).
function buildTwistedRope(length, radius, material, curve = null) {
  if (curve) length = curve.getLength();
  const strands = 3;
  const layLength = radius * 7; // one full twist of a strand
  const radial = 18;
  const rows = Math.max(8, Math.round(length / 0.004));
  const geo = new THREE.CylinderGeometry(radius, radius, length, radial, rows, true);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const theta = Math.atan2(z, x);
    const phase = strands * theta - (2 * Math.PI * strands * y) / layLength;
    const crown = Math.abs(Math.cos(phase / 2)); // 1 on a strand's crown, 0 in the groove between strands
    const r = radius * (0.8 + 0.2 * Math.sqrt(crown));
    pos.setX(i, Math.cos(theta) * r);
    pos.setZ(i, Math.sin(theta) * r);
    const fibre = 0.94 + 0.06 * Math.sin(phase * 7 + y * 900);
    const shade = (0.55 + 0.45 * crown) * fibre;
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade * 0.97;
    colors[i * 3 + 2] = shade * 0.9;
  }
  if (curve) {
    // Cylinder rows run from y = +length/2 (row 0) down to -length/2 (row `rows`), so row i sits at u = i / rows
    const frames = curve.computeFrenetFrames(rows, false);
    const p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const row = Math.round((length * 0.5 - pos.getY(i)) / (length / rows));
      curve.getPointAt(row / rows, p);
      p.addScaledVector(frames.normals[row], pos.getX(i)).addScaledVector(frames.binormals[row], pos.getZ(i));
      pos.setXYZ(i, p.x, p.y, p.z);
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

// Pierced (cut-out) carving: a plane subdivided every ~4mm and displaced by a height-field canvas (1px = 1mm),
// with everything below a small height cut away through an alpha mask. Front faces +Z, back flat at z = 0.
function buildPiercedCarving(canvas, depth, material) {
  const cw = canvas.width;
  const ch = canvas.height;
  const px = canvas.getContext('2d').getImageData(0, 0, cw, ch).data;
  let hf = new Float32Array(cw * ch);
  for (let i = 0; i < cw * ch; i++) hf[i] = px[i * 4] / 255;
  const blur = (src) => {
    const out = new Float32Array(src.length);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        let sum = 0;
        let n = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx >= 0 && xx < cw && yy >= 0 && yy < ch) {
              sum += src[yy * cw + xx];
              n++;
            }
          }
        }
        out[y * cw + x] = sum / n;
      }
    }
    return out;
  };
  hf = blur(blur(hf));

  // Alpha mask from the softened silhouette
  const mask = document.createElement('canvas');
  mask.width = cw;
  mask.height = ch;
  const mctx = mask.getContext('2d');
  const img = mctx.createImageData(cw, ch);
  for (let i = 0; i < cw * ch; i++) {
    const v = hf[i] > 0.12 ? 255 : 0;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  mctx.putImageData(img, 0, 0);
  const alphaMap = new THREE.CanvasTexture(mask);

  const width = cw * 0.001;
  const height = ch * 0.001;
  const segX = Math.round(width / 0.004);
  const segY = Math.round(height / 0.004);
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = Math.min(cw - 1, Math.round(uv.getX(i) * (cw - 1)));
    const y = Math.min(ch - 1, Math.round((1 - uv.getY(i)) * (ch - 1)));
    const hv = hf[y * cw + x];
    pos.setZ(i, hv * depth);
    const shade = 0.6 + 0.4 * Math.min(1, hv * 1.2);
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade * 0.96;
    colors[i * 3 + 2] = shade * 0.86;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = material.clone();
  mat.alphaMap = alphaMap;
  mat.alphaTest = 0.5;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

// Victorian "Glastonbury" oak sanctuary chair (chancel-chair photo): X-frame side legs, plain plank seat,
// broad arm boards sweeping from the top of the back down to the front of the seat with rolled scroll ends,
// and a raked back with a diamond-parquetry panel. Local space: sitter faces -X, back at +X, width along Z.
function buildGlastonburyChair(mats) {
  const chair = new THREE.Group();
  const oak = mats.warmOak;
  const seatY = 0.45;
  const seatD = 0.46;
  const seatW = 0.56;
  const halfW = seatW * 0.5;
  const rake = 0.12; // Back leans ~7 degrees

  // Plank seat with moulded front & side edge rails
  const seat = new THREE.Mesh(new THREE.BoxGeometry(seatD, 0.035, seatW - 0.06), oak);
  seat.position.set(0, seatY, 0);
  seat.castShadow = true;
  chair.add(seat);
  [-1, 1].forEach((side) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(seatD + 0.02, 0.075, 0.03), oak);
    rail.position.set(0, seatY - 0.012, side * (halfW - 0.015));
    chair.add(rail);
  });

  // X-frame legs on each side (side elevation), each crossing under the seat rail and ending in a short foot
  const legLen = Math.hypot(seatD + 0.06, seatY - 0.03);
  const legAng = Math.atan2(seatY - 0.03, seatD + 0.06);
  [-1, 1].forEach((side) => {
    const z = side * (halfW - 0.045);
    [-1, 1].forEach((dir) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(legLen, 0.055, 0.04), oak);
      leg.position.set(0, (seatY - 0.03) * 0.5, z + dir * 0.022);
      leg.rotation.z = dir * legAng;
      leg.castShadow = true;
      chair.add(leg);
    });
    // Pegged pivot boss where the legs cross
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.11, 10), oak);
    peg.rotation.x = Math.PI / 2;
    peg.position.set(0, (seatY - 0.03) * 0.5, z);
    chair.add(peg);
  });

  // Raked back: side stiles, top rail and the parquetry panel
  const backH = 0.6;
  const back = new THREE.Group();
  back.position.set(seatD * 0.5 - 0.02, seatY, 0);
  back.rotation.z = -Math.atan2(rake, backH);
  [-1, 1].forEach((side) => {
    const stile = new THREE.Mesh(new THREE.BoxGeometry(0.045, backH, 0.05), oak);
    stile.position.set(0, backH * 0.5, side * (halfW - 0.045));
    back.add(stile);
  });
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.09, seatW - 0.14), oak);
  topRail.position.set(0, backH - 0.045, 0);
  back.add(topRail);
  const panelH = backH - 0.13;
  const panelW = seatW - 0.14;
  const panelBoard = new THREE.Mesh(new THREE.BoxGeometry(0.02, panelH, panelW), oak);
  panelBoard.position.set(0.005, 0.02 + panelH * 0.5, 0);
  back.add(panelBoard);
  const parquetry = new THREE.Mesh(new THREE.PlaneGeometry(panelW - 0.01, panelH - 0.01), mats.parquetryOak);
  parquetry.rotation.y = -Math.PI / 2; // Faces the sitter (-X)
  parquetry.position.set(-0.007, 0.02 + panelH * 0.5, 0);
  back.add(parquetry);
  chair.add(back);

  // Top of the back (in chair space) where the arms spring from
  const backTopX = seatD * 0.5 - 0.02 + rake;
  const backTopY = seatY + backH;

  // Broad sweeping arm boards (side elevation profile extruded across Z)
  const armT = 0.032;
  const frontX = -seatD * 0.5 - 0.03;
  const armShape = new THREE.Shape();
  armShape.moveTo(frontX + 0.06, seatY - 0.02);
  armShape.lineTo(frontX, seatY - 0.02);
  armShape.splineThru([
    new THREE.Vector2(frontX - 0.01, seatY + 0.12),
    new THREE.Vector2(frontX + 0.03, seatY + 0.24),
    new THREE.Vector2(frontX + 0.1, seatY + 0.25),
    new THREE.Vector2(frontX + 0.2, seatY + 0.26),
    new THREE.Vector2(backTopX - 0.2, backTopY - 0.24),
    new THREE.Vector2(backTopX - 0.07, backTopY - 0.07),
    new THREE.Vector2(backTopX + 0.01, backTopY + 0.01)
  ]);
  armShape.lineTo(backTopX - 0.05, backTopY + 0.02);
  armShape.splineThru([
    new THREE.Vector2(backTopX - 0.12, backTopY - 0.1),
    new THREE.Vector2(backTopX - 0.24, backTopY - 0.3),
    new THREE.Vector2(frontX + 0.22, seatY + 0.13),
    new THREE.Vector2(frontX + 0.1, seatY + 0.04),
    new THREE.Vector2(frontX + 0.06, seatY - 0.02)
  ]);
  const armGeo = new THREE.ExtrudeGeometry(armShape, { depth: armT, bevelEnabled: false, curveSegments: 6 });
  applyBoxUVs(armGeo, 0.9);
  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(armGeo, oak);
    // Sits just outside the seat rail / stiles
    arm.position.z = side > 0 ? halfW + 0.002 : -halfW - 0.002 - armT;
    arm.castShadow = true;
    chair.add(arm);

    const zMid = side * (halfW + 0.002 + armT * 0.5);
    // Rolled scroll ends (end grain facing forward): at the front of the seat (arm foot) and at the top of the back
    const frontRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.07, 14), oak);
    frontRoll.rotation.z = Math.PI / 2; // Scroll faces forward
    frontRoll.position.set(frontX + 0.01, seatY - 0.005, zMid);
    chair.add(frontRoll);
    const topRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 14), oak);
    topRoll.rotation.z = Math.PI / 2; // Scroll faces forward
    topRoll.position.set(backTopX - 0.02, backTopY - 0.005, zMid);
    chair.add(topRoll);
    // Rolled seat-rail ends at the back, at the foot of the stiles
    const backRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12), oak);
    backRoll.rotation.z = Math.PI / 2; // Scroll faces forward
    backRoll.position.set(seatD * 0.5 + 0.025, seatY - 0.01, side * (halfW - 0.015));
    chair.add(backRoll);
  });

  return chair;
}

// Build the West Timber Tower Substructure, Diagonal Bracing, Coffered Belfry Ceiling & Vestry
function buildWestTowerInterior(mats, ceilingGroup) {
  const g = new THREE.Group();
  const T = DIM.tower;
  const N = DIM.nave;
  const floorY = DIM.naveFloorY;
  const ceilY = T.belfryCeilingY;
  // Underside of the nave roof slopes (with a little clearance): the tower frame must stay beneath it, or its
  // timbers break out through the tiles either side of the belfry
  const roofRun = N.zSouthExt + 0.32;
  const roofUnderY = (z) => N.ridgeY - (Math.abs(z) / roofRun) * (N.ridgeY - N.eavesY) - 0.2;
  const sideTopY = roofUnderY(N.zSouthInt); // highest the wall-side framing can rise
  const kneeZ = (y) => ((N.ridgeY - 0.2 - y) / (N.ridgeY - N.eavesY)) * roofRun; // where the roof drops to y
  const postH = sideTopY - floorY;

  // 1. Four massive medieval dark oak vertical posts (0.30m x 0.30m)
  const postPositions = [
    [T.eastPostX, N.zNorthInt + 0.18],
    [T.eastPostX, N.zSouthInt - 0.18],
    [T.westPostX, N.zNorthInt + 0.18],
    [T.westPostX, N.zSouthInt - 0.18]
  ];
  postPositions.forEach(([px, pz]) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, postH, 0.3), mats.darkOak);
    post.position.set(px, floorY + postH * 0.5, pz);
    post.castShadow = true;
    post.receiveShadow = true;
    g.add(post);
  });

  // Top tie-beams connecting the 4 posts: level under the belfry ceiling, their ends cranked down beneath the
  // roof slopes onto the post heads
  const buildTieBeam = (depth, width) => {
    const half = (N.zSouthInt - N.zNorthInt - 0.05) * 0.5;
    const kz = Math.min(half - 0.1, kneeZ(ceilY));
    const endTop = roofUnderY(half);
    const shape = new THREE.Shape();
    shape.moveTo(-half, endTop - depth);
    shape.lineTo(-half, endTop);
    shape.lineTo(-kz, ceilY);
    shape.lineTo(kz, ceilY);
    shape.lineTo(half, endTop);
    shape.lineTo(half, endTop - depth);
    shape.lineTo(kz, ceilY - depth);
    shape.lineTo(-kz, ceilY - depth);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
    geo.translate(0, 0, -width * 0.5);
    geo.rotateY(Math.PI / 2);
    applyBoxUVs(geo, 0.5);
    return new THREE.Mesh(geo, mats.darkOak);
  };
  const eastTie = buildTieBeam(0.28, 0.28);
  eastTie.position.set(T.eastPostX, 0, 0);
  g.add(eastTie);

  const westTie = buildTieBeam(0.26, 0.26);
  westTie.position.set(T.westPostX, 0, 0);
  g.add(westTie);

  // Longitudinal side beams & heavy mid-height horizontal rails (IMG_3942, 3943)
  const bayLen = T.eastPostX - T.westPostX;
  const midBayX = (T.eastPostX + T.westPostX) * 0.5;
  [-1, 1].forEach((sideZ) => {
    const zLine = sideZ * (N.zSouthInt - 0.18);
    // Top longitudinal plate
    const topPlate = new THREE.Mesh(new THREE.BoxGeometry(bayLen + 0.3, 0.26, 0.26), mats.darkOak);
    topPlate.position.set(midBayX, sideTopY - 0.13, zLine);
    g.add(topPlate);

    // Mid-height horizontal oak rail (y ≈ 2.65, IMG_3942, 3943)
    const midRail = new THREE.Mesh(new THREE.BoxGeometry(bayLen, 0.22, 0.2), mats.darkOak);
    midRail.position.set(midBayX, 2.65, zLine);
    g.add(midRail);

    // Massive diagonal timber braces along North & South walls (IMG_3942, 3943, 3944)
    const diagLower = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.22, 0.18), mats.darkOak);
    diagLower.position.set(midBayX + 0.32, 1.48, zLine);
    diagLower.rotation.z = 0.88;
    g.add(diagLower);

    // Short upper brace between the mid rail and the top plate, kept below the roof slope
    const diagUpper = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.2, 0.18), mats.darkOak);
    diagUpper.position.set(midBayX - 0.25, (2.76 + sideTopY - 0.26) * 0.5, zLine);
    diagUpper.rotation.z = -0.68;
    g.add(diagUpper);
  });

  // Grand Curved East Tower Arch framing the entrance to the tower bay (IMG_3941, 3947)
  const archSpan = N.zSouthInt - N.zNorthInt - 0.36;
  const archHalf = archSpan * 0.5;
  const archShape = new THREE.Shape();
  archShape.moveTo(-archHalf, 2.25);
  // Top edge level under the belfry ceiling, stepping down under the roof slopes at the sides
  const archKnee = Math.min(archHalf - 0.05, kneeZ(ceilY - 0.05));
  archShape.lineTo(-archHalf, roofUnderY(archHalf));
  archShape.lineTo(-archKnee, ceilY - 0.05);
  archShape.lineTo(archKnee, ceilY - 0.05);
  archShape.lineTo(archHalf, roofUnderY(archHalf));
  archShape.lineTo(archHalf, 2.25);
  // Elliptical/four-centered Tudor oak arch underside
  const segs = 24;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const ang = t * Math.PI;
    const uz = Math.cos(ang) * archHalf;
    const vy = 2.45 + Math.sin(ang) * 1.68;
    archShape.lineTo(uz, vy);
  }
  archShape.closePath();
  const towerArchGeo = new THREE.ExtrudeGeometry(archShape, { depth: 0.26, bevelEnabled: false });
  towerArchGeo.rotateY(Math.PI / 2);
  applyBoxUVs(towerArchGeo, 0.5);
  const towerArch = new THREE.Mesh(towerArchGeo, mats.darkOak);
  towerArch.position.set(T.eastPostX - 0.13, 0, 0);
  towerArch.castShadow = true;
  g.add(towerArch);

  // Carved wooden ceiling boss at the apex of the East tower arch (IMG_3947!)
  const archBoss = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13, 0), mats.darkOak);
  archBoss.position.set(T.eastPostX, 4.1, 0);
  g.add(archBoss);

  // Dramatic West Wall Chevron / V-Braces framing Window 5 (IMG_3946, 3947!)
  [-1, 1].forEach((sideZ) => {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 3.15), mats.darkOak);
    brace.position.set(T.westPostX, 3.1, sideZ * 1.15);
    brace.rotation.x = sideZ * 0.72;
    g.add(brace);

    const upperBrace = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1.55), mats.darkOak);
    upperBrace.position.set(T.westPostX, 3.82, sideZ * 1.75);
    upperBrace.rotation.x = sideZ * 0.78;
    g.add(upperBrace);
  });

  // 9-Panel Coffered Boarded Belfry Ceiling + Recessed Centre Hatch + Three Bell Ropes (IMG_3946, 3947, tower-base photo)
  // Mid-brown tongue-and-groove boarded panels framed by slim moulded ribs, set within the black oak tie-beams & plates.
  // Placed in ceilingGroup so Roof Cutaway toggles it cleanly!
  const belfryCeil = new THREE.Group();
  const cWidth = bayLen - 0.1;
  const cDepth = 3.45;
  const cX0 = midBayX - cWidth * 0.5;
  const cZ0 = -cDepth * 0.5;
  const cellW = cWidth / 3;
  const cellD = cDepth / 3;
  const deckT = 0.04;
  const deckY = ceilY; // Underside of the boarding rests on the tie-beams & plates
  // Centre panel is a trap-door hatch set up into the ringing chamber: its underside sits just below the
  // belfry box's floor (y = T.baseY), so the well is as deep as the tower allows
  const hatchRise = T.baseY - deckY - 0.01;

  const boardSeamW = 0.008;
  const boardPitch = 0.115;
  const seams = [];
  const hatchSeams = [];
  for (let ix = 0; ix < 3; ix++) {
    for (let iz = 0; iz < 3; iz++) {
      const cx = cX0 + (ix + 0.5) * cellW;
      const cz = cZ0 + (iz + 0.5) * cellD;
      const isHatch = ix === 1 && iz === 1;
      const underY = deckY + (isHatch ? hatchRise : 0);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(cellW, deckT, cellD), mats.medOak);
      panel.position.set(cx, underY + deckT * 0.5, cz);
      panel.receiveShadow = true;
      belfryCeil.add(panel);

      // Boards run East-West (the hatch's run North-South); dark seams hang 1mm below so they never share its plane
      if (isHatch) {
        for (let bx = -cellW * 0.5 + boardPitch; bx < cellW * 0.5 - 0.04; bx += boardPitch) {
          hatchSeams.push([cx + bx, underY - 0.001, cz, cellD - 0.16]);
        }
      } else {
        for (let bz = -cellD * 0.5 + boardPitch; bz < cellD * 0.5 - 0.04; bz += boardPitch) {
          seams.push([cx, underY - 0.001, cz + bz, cellW - 0.06]);
        }
      }

      if (isHatch) {
        // Boarded lining around the recessed hatch opening
        [-1, 1].forEach((side) => {
          const linX = new THREE.Mesh(new THREE.BoxGeometry(cellW, hatchRise, 0.025), mats.medOak);
          linX.position.set(cx, deckY + hatchRise * 0.5, cz + side * (cellD * 0.5 - 0.0125));
          belfryCeil.add(linX);
          const linZ = new THREE.Mesh(new THREE.BoxGeometry(0.025, hatchRise, cellD - 0.05), mats.medOak);
          linZ.position.set(cx + side * (cellW * 0.5 - 0.0125), deckY + hatchRise * 0.5, cz);
          belfryCeil.add(linZ);
        });
        // The trap door's own ledged frame, a dark shadow gap where it sits in the opening
        const frameW = 0.06;
        const lip = deckY + hatchRise - 0.012;
        [-1, 1].forEach((side) => {
          const fx = new THREE.Mesh(new THREE.BoxGeometry(cellW - 0.05, 0.022, frameW), mats.darkOak);
          fx.position.set(cx, lip, cz + side * (cellD * 0.5 - 0.025 - frameW * 0.5 - 0.012));
          belfryCeil.add(fx);
          const fz = new THREE.Mesh(
            new THREE.BoxGeometry(frameW, 0.022, cellD - 0.05 - 0.024 - frameW * 2),
            mats.darkOak
          );
          fz.position.set(cx + side * (cellW * 0.5 - 0.025 - frameW * 0.5 - 0.012), lip, cz);
          belfryCeil.add(fz);
        });
        // Dark shadow gap between the trap door's frame and the lining of the opening
        const gapMat = new THREE.MeshBasicMaterial({ color: 0x0b0806 });
        [-1, 1].forEach((side) => {
          const gx = new THREE.Mesh(new THREE.BoxGeometry(cellW - 0.05, 0.02, 0.012), gapMat);
          gx.position.set(cx, lip + 0.001, cz + side * (cellD * 0.5 - 0.025 - 0.006));
          belfryCeil.add(gx);
          const gz = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.02, cellD - 0.074), gapMat);
          gz.position.set(cx + side * (cellW * 0.5 - 0.025 - 0.006), lip + 0.001, cz);
          belfryCeil.add(gz);
        });
      }
    }
  }
  const seamGeo = new THREE.BoxGeometry(1, 0.004, boardSeamW);
  const seamMesh = new THREE.InstancedMesh(seamGeo, mats.darkOak, seams.length);
  const seamMat4 = new THREE.Matrix4();
  seams.forEach(([x, y, z, len], i) => {
    seamMat4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(len, 1, 1));
    seamMesh.setMatrixAt(i, seamMat4);
  });
  belfryCeil.add(seamMesh);
  const hatchSeamGeo = new THREE.BoxGeometry(boardSeamW, 0.004, 1);
  const hatchSeamMesh = new THREE.InstancedMesh(hatchSeamGeo, mats.darkOak, hatchSeams.length);
  hatchSeams.forEach(([x, y, z, len], i) => {
    seamMat4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, len));
    hatchSeamMesh.setMatrixAt(i, seamMat4);
  });
  belfryCeil.add(hatchSeamMesh);

  // Slim moulded coffer ribs (4 x 4 grid), proud of the boarding
  const ribDrop = 0.09;
  for (let i = 0; i <= 3; i++) {
    const ribZ = new THREE.Mesh(new THREE.BoxGeometry(0.07, ribDrop, cDepth), mats.medOak);
    ribZ.position.set(cX0 + i * cellW, deckY - ribDrop * 0.5, 0);
    belfryCeil.add(ribZ);

    const ribX = new THREE.Mesh(new THREE.BoxGeometry(cWidth + 0.07, ribDrop - 0.01, 0.07), mats.medOak);
    ribX.position.set(midBayX, deckY - ribDrop * 0.5 + 0.005, cZ0 + i * cellD);
    belfryCeil.add(ribX);
  }

  // Three bell ropes drop through brass-bushed holes running in a slightly diagonal line down the North column
  // of coffers, one hole per panel (tower-base photo), and hang free, each ending in a whipped tail
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xe0c995, roughness: 0.95, vertexColors: true });
  const whippingMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5c, roughness: 0.9 });
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x0b0806 });
  const ropeEndY = floorY + 1.05;
  const ropeHoles = [
    [cX0 + cellW * 2.45, cZ0 + cellD * 0.5], // East panel, furthest North (above the organ)
    [cX0 + cellW * 1.35, cZ0 + cellD * 0.64], // Middle panel, towards its West rib (vestry)
    [cX0 + cellW * 0.75, cZ0 + cellD * 0.78] // West panel, closest to the centre (vestry)
  ];
  // The East rope is looped back over the vestry partition's capping rail so it hangs clear of the organ
  const capTop = floorY + T.vestryPartitionH + 0.04;
  const ropeR = 0.012;
  ropeHoles.forEach(([hx, hz], i) => {
    const boss = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 8, 20), mats.brass);
    boss.rotation.x = Math.PI / 2;
    boss.position.set(hx, deckY - 0.012, hz);
    belfryCeil.add(boss);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.034, 16), holeMat);
    hole.rotation.x = Math.PI / 2;
    hole.position.set(hx, deckY - 0.003, hz);
    belfryCeil.add(hole);

    let rope;
    let tailX = hx;
    if (i === 0) {
      const pX = T.vestryPartitionX;
      const overY = capTop + ropeR + 0.001;
      const eastLip = new THREE.Vector3(pX + 0.07, overY - 0.006, hz);
      const hangX = pX - 0.06 - ropeR - 0.002;
      tailX = hangX;
      const path = new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(hx, deckY, hz),
          new THREE.Vector3(hx, deckY - 0.12, hz),
          new THREE.Vector3()
            .lerpVectors(new THREE.Vector3(hx, deckY - 0.12, hz), eastLip, 0.5)
            .setY((deckY + overY) * 0.5 - 0.06),
          eastLip,
          new THREE.Vector3(pX, overY, hz),
          new THREE.Vector3(pX - 0.05, overY - 0.004, hz),
          new THREE.Vector3(hangX, capTop - 0.06, hz),
          new THREE.Vector3(hangX, capTop - 0.3, hz),
          new THREE.Vector3(hangX, ropeEndY, hz)
        ],
        false,
        'centripetal'
      );
      rope = buildTwistedRope(0, ropeR, ropeMat, path);
    } else {
      const ropeLen = deckY - ropeEndY;
      rope = buildTwistedRope(ropeLen, ropeR, ropeMat);
      rope.position.set(hx, ropeEndY + ropeLen * 0.5, hz);
    }
    belfryCeil.add(rope);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.05, 12), whippingMat);
    tail.position.set(tailX, ropeEndY + 0.01, hz);
    belfryCeil.add(tail);
  });

  capSolidMasonry(belfryCeil); // the boarded tower ceiling is solid when the tour camera rises through it
  ceilingGroup.add(belfryCeil);

  // 2. Cream-plastered Vestry Partition Wall (x = -5.18, height = 2.25m, central doorway, IMG_3941, 3942)
  const pX = T.vestryPartitionX;
  const pH = T.vestryPartitionH;
  const doorHalf = 0.52;
  [-1, 1].forEach((sideZ) => {
    const segW = N.zSouthInt - doorHalf;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.08, pH, segW), mats.plaster);
    panel.position.set(pX, floorY + pH * 0.5, sideZ * (doorHalf + segW * 0.5));
    panel.castShadow = true;
    panel.receiveShadow = true;
    g.add(panel);

    // Dark timber vertical jamb & top capping rail
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.11, pH, 0.07), mats.darkOak);
    jamb.position.set(pX, floorY + pH * 0.5, sideZ * doorHalf);
    g.add(jamb);
  });
  const topCap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, N.zSouthInt * 2), mats.darkOak);
  topCap.position.set(pX, floorY + pH, 0);
  g.add(topCap);

  // 3. West Vestry Interior Contents (IMG_3944, IMG_3945)
  // Crimson vestry carpet
  const vestryLen = pX - N.xWestInt;
  const vCarpet = new THREE.Mesh(
    new THREE.BoxGeometry(vestryLen - 0.04, 0.015, N.zSouthInt * 2 - 0.04),
    mats.carpetCrimson
  );
  vCarpet.position.set(N.xWestInt + vestryLen * 0.5, floorY + 0.008, 0);
  vCarpet.receiveShadow = true;
  g.add(vCarpet);

  // Vestry table with royal-purple pleated cloth, stacked blue hymn books & mirror (IMG_3944)
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.05, 1.55), mats.medOak);
  tableTop.position.set(pX - 0.42, floorY + 0.78, -1.48);
  tableTop.castShadow = true;
  g.add(tableTop);

  const purpleDrape = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.75, 1.53), mats.purpleCloth);
  purpleDrape.position.set(pX - 0.42, floorY + 0.38, -1.48);
  purpleDrape.castShadow = true;
  g.add(purpleDrape);

  // Tall stack of blue hymn books on vestry table (IMG_3944)
  const bookBlueMat = new THREE.MeshStandardMaterial({ color: 0x366494, roughness: 0.75 });
  const hymnStack = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.68, 0.22), bookBlueMat);
  hymnStack.position.set(pX - 0.35, floorY + 1.14, -1.95);
  g.add(hymnStack);

  // Tilted mirror on vestry table
  const mirrorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.46, 0.32), mats.iron);
  mirrorFrame.position.set(pX - 0.22, floorY + 1.02, -1.45);
  mirrorFrame.rotation.z = -0.22;
  g.add(mirrorFrame);

  // Two oak vestry chairs along West wall (IMG_3944)
  [-1.95, -1.15].forEach((cz) => {
    const chair = new THREE.Group();
    const cSeat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.44), mats.carpetGold);
    cSeat.position.y = 0.46;
    chair.add(cSeat);
    const cBack = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.54, 0.42), mats.darkOak);
    cBack.position.set(-0.2, 0.72, 0);
    chair.add(cBack);
    [
      [-0.18, -0.18],
      [0.18, -0.18],
      [-0.18, 0.18],
      [0.18, 0.18]
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.46, 0.04), mats.darkOak);
      leg.position.set(lx, 0.23, lz);
      chair.add(leg);
    });
    chair.position.set(N.xWestInt + 0.34, floorY, cz);
    g.add(chair);
  });

  // Tall grey metal safe/cabinet (IMG_3945)
  const safeMat = new THREE.MeshStandardMaterial({ color: 0x62737c, roughness: 0.55, metalness: 0.35 });
  const safe = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.8, 0.82), safeMat);
  safe.position.set(pX - 0.36, floorY + 0.9, 1.15);
  safe.castShadow = true;
  g.add(safe);

  // Dark wooden vestry cupboard against South wall (IMG_3945)
  const cupboard = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.85, 0.52), mats.darkOak);
  cupboard.position.set(N.xWestInt + 0.92, floorY + 0.92, N.zSouthInt - 0.3);
  cupboard.castShadow = true;
  g.add(cupboard);

  // Electrical Meter Board on SW wall (marked "Meters" on 1974 plan & seen in IMG_3945!)
  const meterPanel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.62), mats.medOak);
  meterPanel.position.set(N.xWestInt + 0.04, floorY + 1.55, 1.85);
  g.add(meterPanel);
  const meterBox = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 0.22), mats.wax);
  meterBox.position.set(N.xWestInt + 0.1, floorY + 1.48, 1.82);
  g.add(meterBox);

  // Detailed British 2kg CO2 Fire Extinguisher beside vestry doorway + wall ID sign (IMG_3942)
  const extG = new THREE.Group();
  const extRedMat = new THREE.MeshStandardMaterial({ color: 0xc8161d, roughness: 0.24, metalness: 0.28 });
  const extBlackMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.55, metalness: 0.15 });
  const extMetalMat = new THREE.MeshStandardMaterial({ color: 0xbec4ca, roughness: 0.3, metalness: 0.85 });
  const extPinMat = new THREE.MeshStandardMaterial({ color: 0xf0c420, roughness: 0.42, metalness: 0.25 });

  // Smooth spun-steel tank with rounded dome shoulder & neck collar
  const tankPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.058, 0.0),
    new THREE.Vector2(0.062, 0.012),
    new THREE.Vector2(0.062, 0.365),
    new THREE.Vector2(0.059, 0.395),
    new THREE.Vector2(0.049, 0.422),
    new THREE.Vector2(0.032, 0.442),
    new THREE.Vector2(0.018, 0.452),
    new THREE.Vector2(0.018, 0.474),
    new THREE.Vector2(0.0, 0.474)
  ];
  const tankMesh = new THREE.Mesh(new THREE.LatheGeometry(tankPts, 20), extRedMat);
  tankMesh.castShadow = true;
  tankMesh.receiveShadow = true;
  extG.add(tankMesh);

  // Subtle black rubber base ring
  const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(0.0635, 0.0645, 0.018, 20), extBlackMat);
  baseRing.position.y = 0.009;
  extG.add(baseRing);

  // Curved UK BS EN 3 CO2 front label decal (black CO2 band + white instruction graphic)
  const lblCanvas = document.createElement('canvas');
  lblCanvas.width = 256;
  lblCanvas.height = 256;
  const lctx = lblCanvas.getContext('2d');
  lctx.fillStyle = '#c8161d';
  lctx.fillRect(0, 0, 256, 256);
  // Black CO2 identification band
  lctx.fillStyle = '#141618';
  lctx.fillRect(14, 16, 228, 66);
  lctx.fillStyle = '#ffffff';
  lctx.font = 'bold 42px sans-serif';
  lctx.textAlign = 'center';
  lctx.fillText('CO2', 128, 63);
  // White instruction box & fire-class icons
  lctx.fillStyle = '#f4f2ec';
  lctx.fillRect(20, 94, 216, 144);
  lctx.fillStyle = '#1c1c1e';
  lctx.font = 'bold 16px sans-serif';
  lctx.fillText('FIRE EXTINGUISHER', 128, 118);
  lctx.fillStyle = '#44464a';
  for (let i = 0; i < 4; i++) {
    lctx.fillRect(34, 132 + i * 14, 188, 5);
  }
  // Small safety pictogram squares
  ['#c8161d', '#1c1c1e', '#1e7b34'].forEach((col, i) => {
    lctx.fillStyle = col;
    lctx.fillRect(42 + i * 62, 196, 46, 30);
    lctx.fillStyle = '#ffffff';
    lctx.fillRect(54 + i * 62, 204, 22, 14);
  });
  const lblTex = new THREE.CanvasTexture(lblCanvas);
  lblTex.colorSpace = THREE.SRGBColorSpace;
  const lblMat = new THREE.MeshStandardMaterial({ map: lblTex, roughness: 0.35, metalness: 0.1 });
  const lblMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.063, 0.063, 0.19, 18, 1, true, -0.95, 1.9), lblMat);
  lblMesh.position.y = 0.21;
  extG.add(lblMesh);

  // Brass neck hex nut & chrome valve assembly
  const neckNut = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.018, 6), mats.brass);
  neckNut.position.y = 0.48;
  extG.add(neckNut);
  const valveBody = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.017, 0.044, 12), extMetalMat);
  valveBody.position.y = 0.51;
  extG.add(valveBody);

  // Yellow safety pull-pin & ring on the side of the valve
  const pinRing = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0024, 6, 14), extPinMat);
  pinRing.position.set(0.024, 0.518, -0.008);
  pinRing.rotation.y = Math.PI / 3;
  extG.add(pinRing);

  // Lower fixed red carry handle + upper angled squeeze-grip operating lever (IMG_3942)
  const carryHandle = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.013, 0.105), extRedMat);
  carryHandle.position.set(0, 0.506, -0.056);
  carryHandle.rotation.x = 0.12;
  extG.add(carryHandle);

  const squeezeLever = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.012, 0.118), extRedMat);
  squeezeLever.position.set(0, 0.548, -0.056);
  squeezeLever.rotation.x = -0.38;
  extG.add(squeezeLever);

  // Brass swivel elbow + matte-black flared conical CO2 discharge horn (concentric assembly pivoted at swivel)
  const swivel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.032, 8), mats.brass);
  swivel.rotation.x = Math.PI / 2;
  swivel.position.set(0, 0.506, 0.024);
  extG.add(swivel);

  const hornGroup = new THREE.Group();
  hornGroup.position.set(0, 0.506, 0.038);
  hornGroup.rotation.set(-0.22, 0, 0.2);
  const hornElbow = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 8), extBlackMat);
  hornGroup.add(hornElbow);
  const hornStem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.0085, 0.075, 10), extBlackMat);
  hornStem.position.y = -0.038;
  hornGroup.add(hornStem);
  const hornCone = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.031, 0.21, 16, 1, false), extBlackMat);
  hornCone.position.y = -0.175;
  hornCone.castShadow = true;
  hornGroup.add(hornCone);
  const hornRim = new THREE.Mesh(new THREE.TorusGeometry(0.0305, 0.003, 6, 16), extBlackMat);
  hornRim.rotation.x = Math.PI / 2;
  hornRim.position.y = -0.28;
  hornGroup.add(hornRim);
  extG.add(hornGroup);

  extG.position.set(pX + 0.14, floorY, -0.72);
  extG.rotation.y = Math.PI * 0.42; // Front label, squeeze levers & black CO2 horn facing out toward Nave/Organ
  g.add(extG);

  // Small UK CO2 fire-extinguisher wall sign mounted right above it on the vestry partition (IMG_3942)
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 128;
  signCanvas.height = 96;
  const sctx = signCanvas.getContext('2d');
  sctx.fillStyle = '#f2f0ea';
  sctx.fillRect(0, 0, 128, 96);
  sctx.fillStyle = '#141618';
  sctx.fillRect(6, 6, 54, 84);
  sctx.fillStyle = '#c8161d';
  sctx.fillRect(66, 6, 56, 38);
  sctx.fillStyle = '#1e7b34';
  sctx.fillRect(66, 50, 56, 40);
  sctx.fillStyle = '#ffffff';
  sctx.font = 'bold 20px sans-serif';
  sctx.textAlign = 'center';
  sctx.fillText('CO2', 33, 56);
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  const signMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.11, 0.085),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.45 })
  );
  signMesh.rotation.y = Math.PI / 2;
  signMesh.position.set(pX + 0.046, floorY + 0.78, -0.74);
  g.add(signMesh);

  return g;
}

// Main interior builder
export function buildInterior(mats) {
  const interiorGroup = new THREE.Group();
  const ceilingGroup = new THREE.Group();
  const chandelierLights = [];

  const N = DIM.nave;
  const C = DIM.chancel;
  const T = DIM.tower;

  // -------------------------------------------------------
  // 1. FLOORS, STEPS & CARPET RUNNER
  // -------------------------------------------------------
  // Nave diagonal terracotta/black quarry tile floor
  const naveW = N.xEastInt - N.xWestInt + 0.2;
  const naveD = N.zSouthInt - N.zNorthInt + 0.1;
  const naveFloorGeo = new THREE.PlaneGeometry(naveW, naveD);
  naveFloorGeo.rotateX(-Math.PI / 2);
  applyBoxUVs(naveFloorGeo, 0.76);
  const naveFloor = new THREE.Mesh(naveFloorGeo, mats.quarryTile);
  naveFloor.position.set((N.xWestInt + N.xEastInt) * 0.5, DIM.naveFloorY, 0);
  naveFloor.receiveShadow = true;
  interiorGroup.add(naveFloor);

  // Chancel lower floor (x: 3.20 to 6.25, y = 0.26)
  const chanLowLen = 6.25 - C.xWestInt;
  const chanW = C.zSouthInt - C.zNorthInt + 0.1;
  // Chancel floor stops at the side walls' plaster faces so its west riser doesn't overlap the walls' end faces
  const chanLowGeo = new THREE.BoxGeometry(chanLowLen, DIM.chancelFloorY, C.zSouthInt - C.zNorthInt);
  applyBoxUVs(chanLowGeo, 0.76);
  const chanLow = new THREE.Mesh(chanLowGeo, mats.quarryTile);
  chanLow.position.set(C.xWestInt + chanLowLen * 0.5, DIM.chancelFloorY * 0.5, 0);
  chanLow.receiveShadow = true;
  interiorGroup.add(chanLow);

  // Sanctuary Step 1 (x: 6.25 to 7.40, y = 0.40) — Ornate Victorian Encaustic Tiles!
  const step1Len = 7.4 - 6.25;
  const step1Geo = new THREE.BoxGeometry(step1Len, DIM.sanctuaryStep1Y, chanW);
  applyBoxUVs(step1Geo, 1.05);
  const step1 = new THREE.Mesh(step1Geo, mats.sanctuaryTile);
  step1.position.set(6.25 + step1Len * 0.5, DIM.sanctuaryStep1Y * 0.5, 0);
  step1.receiveShadow = true;
  interiorGroup.add(step1);

  // Sanctuary Step 2 / Altar Platform (x: 7.40 to 9.05, y = 0.54)
  const step2Len = C.xEastInt - 7.4 + 0.08;
  const step2Geo = new THREE.BoxGeometry(step2Len, DIM.sanctuaryStep2Y, chanW);
  applyBoxUVs(step2Geo, 1.05);
  const step2 = new THREE.Mesh(step2Geo, mats.sanctuaryTile);
  step2.position.set(7.4 + step2Len * 0.5, DIM.sanctuaryStep2Y * 0.5, 0);
  step2.receiveShadow = true;
  interiorGroup.add(step2);

  // Warm cream-gold carpet runner through Rood Screen & up the Sanctuary steps (IMG_3937, 3938)
  const addRunner = (x0, x1, y, w = 1.12) => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.018, w), mats.carpetGold);
    r.position.set((x0 + x1) * 0.5, y + 0.01, 0);
    r.receiveShadow = true;
    interiorGroup.add(r);
  };
  addRunner(2.55, 3.22, DIM.naveFloorY, 1.28);
  addRunner(3.22, 6.26, DIM.chancelFloorY, 1.12);
  addRunner(6.25, 7.41, DIM.sanctuaryStep1Y, 1.06);
  addRunner(7.4, 8.2, DIM.sanctuaryStep2Y, 1.06);
  // Vertical carpet risers on each step
  [
    [3.22, DIM.naveFloorY, DIM.chancelFloorY, 1.12],
    [6.25, DIM.chancelFloorY, DIM.sanctuaryStep1Y, 1.06],
    [7.4, DIM.sanctuaryStep1Y, DIM.sanctuaryStep2Y, 1.06]
  ].forEach(([rx, y0, y1, rw]) => {
    const riser = new THREE.Mesh(new THREE.BoxGeometry(0.02, y1 - y0, rw), mats.carpetGold);
    riser.position.set(rx, (y0 + y1) * 0.5, 0);
    interiorGroup.add(riser);
  });

  // -------------------------------------------------------
  // 2. NAVE COVED DUCK-EGG BLUE CEILING & CHANCEL WAGON-RIBBED BARREL VAULT
  //    (Placed in ceilingGroup so Roof Cutaway hides them cleanly!)
  // -------------------------------------------------------
  // Nave Coved Duck-Egg Blue Ceiling (x: -3.72 to 3.20, IMG_3936, 3941, 3948)
  const naveCeilLen = N.xEastInt - T.eastPostX;
  const naveCeilPts = [
    new THREE.Vector2(-N.zSouthInt, N.eavesY),
    new THREE.Vector2(-1.68, 4.38),
    new THREE.Vector2(-0.85, 5.05),
    new THREE.Vector2(0, 5.26),
    new THREE.Vector2(0.85, 5.05),
    new THREE.Vector2(1.68, 4.38),
    new THREE.Vector2(N.zSouthInt, N.eavesY)
  ];
  const naveCeilPos = [];
  for (let i = 0; i < naveCeilPts.length - 1; i++) {
    const a = naveCeilPts[i];
    const b = naveCeilPts[i + 1];
    // Quad spanning x: T.eastPostX -> N.xEastInt
    const p0 = [T.eastPostX, a.y, a.x];
    const p1 = [N.xEastInt, a.y, a.x];
    const p2 = [N.xEastInt, b.y, b.x];
    const p3 = [T.eastPostX, b.y, b.x];
    naveCeilPos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
  }
  const naveCeilGeo = new THREE.BufferGeometry();
  naveCeilGeo.setAttribute('position', new THREE.Float32BufferAttribute(naveCeilPos, 3));
  naveCeilGeo.computeVertexNormals();
  const naveCeilMesh = new THREE.Mesh(naveCeilGeo, mats.naveCeilingBlue);
  naveCeilMesh.receiveShadow = true;
  ceilingGroup.add(naveCeilMesh);

  // Dark oak wall plates along Nave N & S eaves
  [-1, 1].forEach((sideZ) => {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(naveCeilLen + 0.1, 0.14, 0.14), mats.darkOak);
    plate.position.set((T.eastPostX + N.xEastInt) * 0.5, N.eavesY - 0.04, sideZ * (N.zSouthInt - 0.05));
    ceilingGroup.add(plate);
  });

  // Central Nave Tie-Beam + King-Post + Y-Struts + Ridge Beam (IMG_3948!)
  const tieX = -0.52;
  const tieBeam = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, N.zSouthInt * 2 + 0.05), mats.darkOak);
  tieBeam.position.set(tieX, N.eavesY + 0.04, 0);
  tieBeam.castShadow = true;
  ceilingGroup.add(tieBeam);

  const kingH = 5.2 - (N.eavesY + 0.12);
  const kingPost = new THREE.Mesh(new THREE.BoxGeometry(0.16, kingH, 0.16), mats.darkOak);
  kingPost.position.set(tieX, N.eavesY + 0.12 + kingH * 0.5, 0);
  ceilingGroup.add(kingPost);

  // Y-shaped diagonal struts on king-post (IMG_3948)
  [-1, 1].forEach((sideZ) => {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.95, 0.11), mats.darkOak);
    strut.position.set(tieX, 4.55, sideZ * 0.34);
    strut.rotation.x = sideZ * 0.72;
    ceilingGroup.add(strut);
  });

  const ridgeBeam = new THREE.Mesh(new THREE.BoxGeometry(naveCeilLen, 0.14, 0.14), mats.darkOak);
  ridgeBeam.position.set((T.eastPostX + N.xEastInt) * 0.5, 5.18, 0);
  ceilingGroup.add(ridgeBeam);

  // Carved limewood angel standing on the South wall-plate above the Attenborough plaque (photograph, 2026).
  // It leans back against the coved ceiling, parallel to its first facet, its lobed base resting on the plate.
  {
    const angelMat = new THREE.MeshStandardMaterial({ color: 0xe8d2a8, roughness: 0.85, vertexColors: true });
    const angel = buildPiercedCarving(createCarvedAngelHeightMap(), 0.045, angelMat);
    const cove0 = new THREE.Vector3(0, naveCeilPts[6].y, naveCeilPts[6].x); // eaves, South
    const cove1 = new THREE.Vector3(0, naveCeilPts[5].y, naveCeilPts[5].x);
    const upSlope = cove1.clone().sub(cove0).normalize();
    const intoRoom = new THREE.Vector3(0, upSlope.z, -upSlope.y); // perpendicular to the cove, facing the nave
    const across = upSlope.clone().cross(intoRoom); // -X: the viewer's right when facing the South wall
    const plateTopY = N.eavesY - 0.04 + 0.07;
    const sBase = (plateTopY + 0.005 - cove0.y) / upSlope.y; // distance up the cove to the plate top
    const centre = cove0
      .clone()
      .addScaledVector(upSlope, sBase + 0.21)
      .addScaledVector(intoRoom, 0.006);
    centre.x = 1.88; // centred over the plaque
    angel.matrix.makeBasis(across, upSlope, intoRoom);
    angel.matrix.setPosition(centre);
    angel.matrix.decompose(angel.position, angel.quaternion, angel.scale);
    ceilingGroup.add(angel);
  }

  // Carved wooden winged-angel corbels along Nave wall-plates (IMG_3936, 3937, 3950)
  [
    [-1.45, N.zSouthInt - 0.08, Math.PI],
    [-2.05, N.zNorthInt + 0.08, 0],
    [-2.65, N.zNorthInt + 0.08, 0]
  ].forEach(([ax, az, rotY]) => {
    const angel = buildAngelCorbel(mats);
    angel.position.set(ax, N.eavesY + 0.14, az);
    angel.rotation.y = rotY;
    ceilingGroup.add(angel);
  });

  // Chancel Dark Oak Wagon-Ribbed Barrel Vault (x: 3.20 to 9.00, IMG_3936, 3937, 3938!)
  // Built explicitly with world-space (x, y, z) quads arching cleanly UPWARD from z=-2.00 to z=+2.00
  const chanLen = C.xEastInt - C.xWestInt;
  const vaultR = C.zSouthInt; // 2.00m half-span
  const vaultRise = vaultR * 0.94;
  const vSegs = 24;
  const vaultPos = [];
  for (let i = 0; i < vSegs; i++) {
    const a0 = (i / vSegs) * Math.PI;
    const a1 = ((i + 1) / vSegs) * Math.PI;
    const z0 = -Math.cos(a0) * vaultR;
    const y0 = C.eavesY + Math.sin(a0) * vaultRise;
    const z1 = -Math.cos(a1) * vaultR;
    const y1 = C.eavesY + Math.sin(a1) * vaultRise;

    const p0 = [C.xWestInt, y0, z0];
    const p1 = [C.xEastInt + 0.04, y0, z0];
    const p2 = [C.xEastInt + 0.04, y1, z1];
    const p3 = [C.xWestInt, y1, z1];
    vaultPos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
  }
  const vaultGeo = new THREE.BufferGeometry();
  vaultGeo.setAttribute('position', new THREE.Float32BufferAttribute(vaultPos, 3));
  vaultGeo.computeVertexNormals();
  const vaultMesh = new THREE.Mesh(vaultGeo, mats.chancelPlaster);
  ceilingGroup.add(vaultMesh);

  // 15 closely-spaced curved dark oak wagon vault ribs along the Chancel!
  const ribCount = 15;
  for (let i = 0; i < ribCount; i++) {
    const rx = C.xWestInt + 0.18 + (i / (ribCount - 1)) * (chanLen - 0.36);
    const rib = new THREE.Mesh(new THREE.TorusGeometry(vaultR - 0.04, 0.055, 6, 26, Math.PI), mats.darkOak);
    rib.rotation.y = Math.PI / 2;
    rib.scale.set(1, 0.94, 1);
    rib.position.set(rx, C.eavesY, 0);
    ceilingGroup.add(rib);
  }

  // Heavy dark oak wall plates & longitudinal purlins on Chancel vault
  [-1, 1].forEach((sideZ) => {
    const cPlate = new THREE.Mesh(new THREE.BoxGeometry(chanLen - 0.01, 0.14, 0.16), mats.darkOak); // 5mm clear of the end walls (no z-fighting)
    cPlate.position.set(C.xWestInt + chanLen * 0.5, C.eavesY - 0.04, sideZ * (C.zSouthInt - 0.06));
    ceilingGroup.add(cPlate);
  });

  // Heavy chamfered dark oak Chancel Arch Frame at West entrance to Chancel (IMG_3936, 3937)
  const cArchFrame = new THREE.Mesh(new THREE.TorusGeometry(vaultR + 0.04, 0.14, 6, 26, Math.PI), mats.darkOak);
  cArchFrame.rotation.y = Math.PI / 2;
  cArchFrame.scale.set(1, 0.94, 1);
  cArchFrame.position.set(C.xWestInt + 0.04, C.eavesY, 0);
  ceilingGroup.add(cArchFrame);

  // -------------------------------------------------------
  // 3. MEDIEVAL CARVED OAK ROOD SCREEN & DWARF WALL
  // -------------------------------------------------------
  interiorGroup.add(buildRoodScreen(mats));

  // -------------------------------------------------------
  // 4. SANCTUARY & CHANCEL FURNISHINGS (IMG_3938, 3939, 3940)
  // -------------------------------------------------------
  const altY = DIM.sanctuaryStep2Y;

  // Carved Limestone Reredos behind Altar (IMG_3938)
  const reredosG = new THREE.Group();
  const rMain = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.02, 2.38), mats.ashlarWarm);
  rMain.position.set(C.xEastInt - 0.1, altY + 1.05, 0);
  rMain.castShadow = true;
  reredosG.add(rMain);

  // Battlemented stone cornice along top of reredos
  const rCornice = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 2.48), mats.ashlarWarm);
  rCornice.position.set(C.xEastInt - 0.11, altY + 1.58, 0);
  reredosG.add(rCornice);
  for (let rz = -1.16; rz <= 1.16; rz += 0.16) {
    const dentil = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.08), mats.ashlarWarm);
    dentil.position.set(C.xEastInt - 0.11, altY + 1.66, rz);
    reredosG.add(dentil);
  }

  // Central circular alabaster medallion with dark-stone Greek cross (IMG_3938!)
  const medDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 24), mats.wax);
  medDisc.rotation.z = Math.PI / 2;
  medDisc.position.set(C.xEastInt - 0.19, altY + 1.08, 0);
  reredosG.add(medDisc);

  const crossBarV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.56, 0.11), mats.stoneCapDark);
  crossBarV.position.set(C.xEastInt - 0.2, altY + 1.08, 0);
  reredosG.add(crossBarV);
  const crossBarH = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.11, 0.56), mats.stoneCapDark);
  crossBarH.position.set(C.xEastInt - 0.2, altY + 1.08, 0);
  reredosG.add(crossBarH);

  // Flanking carved stone rosettes
  [-0.76, 0.76].forEach((rz) => {
    const ros = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 14), mats.ashlar);
    ros.rotation.y = Math.PI / 2;
    ros.position.set(C.xEastInt - 0.2, altY + 1.18, rz);
    reredosG.add(ros);
  });
  interiorGroup.add(reredosG);

  // Altar Table with Emerald Green Frontal & White Lace Fair-Linen Cloth (IMG_3938)
  const altarX = C.xEastInt - 0.56;
  const altarW = 2.02;
  const altarD = 0.76;
  const altarH = 0.98;

  const altarBase = new THREE.Mesh(new THREE.BoxGeometry(altarD, altarH, altarW), mats.altarFrontal);
  altarBase.position.set(altarX, altY + altarH * 0.5, 0);
  altarBase.castShadow = true;
  altarBase.receiveShadow = true;
  interiorGroup.add(altarBase);

  // White lace fair-linen top & overhanging upper valence
  const laceTop = new THREE.Mesh(new THREE.BoxGeometry(altarD + 0.06, 0.04, altarW + 0.08), mats.laceCloth);
  laceTop.position.set(altarX, altY + altarH + 0.02, 0);
  interiorGroup.add(laceTop);

  const laceValence = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.38, altarW + 0.1), mats.laceCloth);
  laceValence.position.set(altarX - altarD * 0.5 - 0.015, altY + altarH - 0.17, 0);
  interiorGroup.add(laceValence);

  // Brass Altar Cross + Pair of Brass Candlesticks + Missal Book-Rest (IMG_3938)
  const crossBase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.12, 10), mats.brass);
  crossBase.position.set(altarX + 0.12, altY + altarH + 0.1, 0);
  interiorGroup.add(crossBase);
  const aCrossV = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.48, 0.045), mats.brass);
  aCrossV.position.set(altarX + 0.12, altY + altarH + 0.38, 0);
  interiorGroup.add(aCrossV);
  const aCrossH = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.28), mats.brass);
  aCrossH.position.set(altarX + 0.12, altY + altarH + 0.46, 0);
  interiorGroup.add(aCrossH);

  // Smooth high-resolution teardrop geometry + custom GLSL semi-transparent flickering candle flame shader
  const flameProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.0055, 0.004),
    new THREE.Vector2(0.0105, 0.011),
    new THREE.Vector2(0.0138, 0.021),
    new THREE.Vector2(0.0136, 0.032),
    new THREE.Vector2(0.0114, 0.045),
    new THREE.Vector2(0.008, 0.058),
    new THREE.Vector2(0.0042, 0.07),
    new THREE.Vector2(0.0014, 0.078),
    new THREE.Vector2(0.0, 0.082)
  ];
  const flameGeo = new THREE.LatheGeometry(flameProfile, 20);
  const wickGeo = new THREE.CylinderGeometry(0.0018, 0.0024, 0.018, 6);
  const wickMat = new THREE.MeshBasicMaterial({ color: 0x1a110a });
  const emberGeo = new THREE.SphereGeometry(0.0025, 8, 6);
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xff6b1c, toneMapped: false });

  function createFlameShaderMaterial(phase) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPhase: { value: phase },
        uBoost: { value: 1.0 }
      },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      vertexShader: `
        uniform float uTime;
        uniform float uPhase;
        varying float vH;
        varying vec3 vViewNormal;
        varying vec3 vViewDir;

        void main() {
          vec3 pos = position;
          float h = clamp(pos.y / 0.082, 0.0, 1.0);
          vH = h;

          // Organic travelling convection wave & church draught bend (base pinned cleanly at wick)
          float bend = pow(h, 1.45);
          float swayX = (sin(uTime * 3.4 + uPhase) * 0.0055
            + sin(uTime * 8.9 - h * 5.2 + uPhase * 1.7) * 0.0036
            + sin(uTime * 17.3 - h * 8.5 + uPhase * 2.9) * 0.0016) * bend;
          float swayZ = (cos(uTime * 2.9 + uPhase * 0.8) * 0.0055
            + cos(uTime * 7.8 - h * 4.8 + uPhase * 2.1) * 0.0034
            + sin(uTime * 15.6 - h * 7.6 + uPhase * 3.1) * 0.0015) * bend;

          // Subtle breathing width & rising stretch flicker
          float breath = 1.0 + sin(uTime * 10.4 - h * 4.5 + uPhase) * 0.085 * h
            + sin(uTime * 19.2 + uPhase * 2.3) * 0.045 * h;
          float stretch = 1.0 + sin(uTime * 6.8 + uPhase) * 0.09
            + sin(uTime * 15.1 + uPhase * 1.6) * 0.055;

          pos.x = pos.x * breath + swayX;
          pos.z = pos.z * breath + swayZ;
          pos.y *= stretch;

          vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
          vViewNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uPhase;
        uniform float uBoost;
        varying float vH;
        varying vec3 vViewNormal;
        varying vec3 vViewDir;

        void main() {
          // Soft Fresnel silhouette falloff so edges dissolve semi-transparently instead of hard cones
          float ndotv = clamp(abs(dot(normalize(vViewNormal), normalize(vViewDir))), 0.0, 1.0);
          float softEdge = pow(ndotv, 1.35);
          float hotCore = pow(ndotv, 2.8);

          // Animated internal convection shimmer
          float shimmer = 0.92 + 0.08 * sin(vH * 15.0 - uTime * 17.5 + uPhase)
            + 0.05 * sin(uTime * 23.0 + uPhase * 2.1);

          // Realistic candle flame thermal zones: translucent blue base -> golden body -> white-hot heart -> orange tip
          vec3 blueZone = vec3(0.22, 0.48, 1.0);
          vec3 amberEdge = vec3(1.0, 0.44, 0.06);
          vec3 goldBody = vec3(1.0, 0.78, 0.24);
          vec3 whiteHeart = vec3(1.0, 0.99, 0.9);
          vec3 tipOrange = vec3(1.0, 0.34, 0.04);

          vec3 col = mix(blueZone, goldBody, smoothstep(0.06, 0.28, vH));
          col = mix(col, tipOrange, smoothstep(0.62, 0.96, vH));
          // Outer thin mantle stays warmer amber while thick center glows incandescent white-gold
          col = mix(amberEdge, col, smoothstep(0.08, 0.55, ndotv));
          float heartMask = smoothstep(0.18, 0.42, vH) * smoothstep(0.84, 0.48, vH);
          col = mix(col, whiteHeart, hotCore * heartMask * 0.92);
          col *= shimmer * (0.94 + 0.14 * uBoost);

          // Semi-transparent alpha profile: airy blue base, soft feathered edges, translucent body, dissolving tip
          float baseFade = smoothstep(0.0, 0.12, vH);
          float tipFade = smoothstep(1.0, 0.64, vH);
          // Slightly more transparent in the lower dark-mantle zone around the wick so the wick peeks through
          float lowerSheath = mix(0.42, 0.84, smoothstep(0.08, 0.42, vH));
          float alpha = softEdge * baseFade * tipFade * lowerSheath * shimmer;
          // Boost opacity slightly only at the luminous incandescent heart
          alpha = clamp(alpha + hotCore * heartMask * 0.22, 0.0, 0.88);

          gl_FragColor = vec4(col, alpha);
        }
      `
    });
  }

  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = 64;
  haloCanvas.height = 64;
  const hctx = haloCanvas.getContext('2d');
  const hGrad = hctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  hGrad.addColorStop(0.0, 'rgba(255, 244, 196, 0.72)');
  hGrad.addColorStop(0.24, 'rgba(255, 174, 60, 0.36)');
  hGrad.addColorStop(0.58, 'rgba(255, 112, 20, 0.12)');
  hGrad.addColorStop(1.0, 'rgba(255, 90, 10, 0.0)');
  hctx.fillStyle = hGrad;
  hctx.fillRect(0, 0, 64, 64);
  const haloTex = new THREE.CanvasTexture(haloCanvas);
  haloTex.colorSpace = THREE.SRGBColorSpace;

  // Smooth top-to-bottom gradient texture so the subsurface wax glow fades seamlessly down the shaft
  const waxGlowCanvas = document.createElement('canvas');
  waxGlowCanvas.width = 4;
  waxGlowCanvas.height = 64;
  const wgCtx = waxGlowCanvas.getContext('2d');
  const wgGrad = wgCtx.createLinearGradient(0, 0, 0, 64);
  wgGrad.addColorStop(0.0, 'rgba(255, 198, 96, 0.9)');
  wgGrad.addColorStop(0.35, 'rgba(255, 168, 62, 0.42)');
  wgGrad.addColorStop(1.0, 'rgba(255, 140, 40, 0.0)');
  wgCtx.fillStyle = wgGrad;
  wgCtx.fillRect(0, 0, 4, 64);
  const waxGlowTex = new THREE.CanvasTexture(waxGlowCanvas);
  waxGlowTex.colorSpace = THREE.SRGBColorSpace;

  const waxGlowMat = new THREE.MeshBasicMaterial({
    map: waxGlowTex,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });

  const litCandles = [];
  function addLitCandleFlame(
    x,
    topY,
    z,
    { scale = 1.0, phase = 0, baseIntensity = 0.65, distance = 3.2, waxRadius = 0.022 } = {}
  ) {
    // Charred wick + glowing orange ember tip visible through the translucent blue flame base
    const wick = new THREE.Mesh(wickGeo, wickMat);
    wick.position.set(x, topY + 0.008 * scale, z);
    wick.scale.setScalar(scale);
    interiorGroup.add(wick);

    const ember = new THREE.Mesh(emberGeo, emberMat);
    ember.position.set(x, topY + 0.017 * scale, z);
    ember.scale.setScalar(scale);
    interiorGroup.add(ember);

    // Subtle warm subsurface wax glow collar fading smoothly down the top of the candle
    const waxGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(waxRadius * 1.02, waxRadius * 1.02, 0.055 * scale, 14, 1, true),
      waxGlowMat
    );
    waxGlow.position.set(x, topY - 0.0275 * scale, z);
    interiorGroup.add(waxGlow);

    const flamePivot = new THREE.Group();
    flamePivot.position.set(x, topY + 0.009 * scale, z);

    const flameMat = createFlameShaderMaterial(phase);
    const flameMesh = new THREE.Mesh(flameGeo, flameMat);
    flameMesh.renderOrder = 3;
    flamePivot.add(flameMesh);

    flamePivot.scale.setScalar(scale);
    interiorGroup.add(flamePivot);

    const haloMat = new THREE.SpriteMaterial({
      map: haloTex,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const halo = new THREE.Sprite(haloMat);
    halo.position.set(x, topY + 0.044 * scale, z);
    halo.renderOrder = 4;
    const baseHalo = 0.26 * scale;
    halo.scale.set(baseHalo, baseHalo, 1);
    interiorGroup.add(halo);

    const light = new THREE.PointLight(0xffa43c, baseIntensity, distance, 1.8);
    light.position.set(x, topY + 0.07 * scale, z);
    interiorGroup.add(light);

    litCandles.push({ flamePivot, flameMat, halo, light, scale, phase, baseIntensity, baseHalo });
  }

  [-0.68, 0.68].forEach((cz, idx) => {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 0.24, 10), mats.brass);
    stick.position.set(altarX + 0.12, altY + altarH + 0.16, cz);
    interiorGroup.add(stick);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 8), mats.wax);
    candle.position.set(altarX + 0.12, altY + altarH + 0.36, cz);
    interiorGroup.add(candle);
    addLitCandleFlame(altarX + 0.12, altY + altarH + 0.46, cz, {
      scale: 1.05,
      phase: idx * 2.4,
      baseIntensity: 0.68,
      distance: 3.4,
      waxRadius: 0.022
    });
  });

  const bookRest = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.3), mats.brass);
  bookRest.position.set(altarX - 0.06, altY + altarH + 0.1, -0.34);
  bookRest.rotation.z = 0.42;
  interiorGroup.add(bookRest);

  // Flanking Stone Brackets with Floral Arrangements & Sanctuary Oak Chairs (IMG_3938)
  [-1.52, 1.52].forEach((sz, idx) => {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.56), mats.ashlarWarm);
    bracket.position.set(C.xEastInt - 0.14, altY + 1.18, sz);
    interiorGroup.add(bracket);

    const flowers = buildFlowerArrangement(idx + 1);
    flowers.position.set(C.xEastInt - 0.15, altY + 1.225, sz);
    interiorGroup.add(flowers);

    // Oak Glastonbury sanctuary chair (chancel-chair photo)
    const chair = buildGlastonburyChair(mats);
    // Angled ~30 degrees in towards the centre line, facing down the church
    chair.position.set(C.xEastInt - 0.52, altY, sz);
    chair.rotation.y = -Math.sign(sz) * (Math.PI / 6);
    interiorGroup.add(chair);
  });

  // Tall Wrought-Iron Paschal Candle Stand on North Sanctuary side (IMG_3938)
  const paschalStand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.14, 1.05, 8), mats.iron);
  paschalStand.position.set(7.68, altY + 0.52, -1.68);
  interiorGroup.add(paschalStand);
  const paschalCandle = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.045, 0.95, 10), mats.wax);
  paschalCandle.position.set(7.68, altY + 1.48, -1.68);
  interiorGroup.add(paschalCandle);
  // Subtle crimson wax cross emblem on the front face of the Paschal candle (IMG_3938)
  const paschalCrossMat = new THREE.MeshStandardMaterial({ color: 0xb82228, roughness: 0.65 });
  const pCrossV = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.14, 0.018), paschalCrossMat);
  pCrossV.position.set(7.64, altY + 1.24, -1.68);
  interiorGroup.add(pCrossV);
  const pCrossH = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.018, 0.075), paschalCrossMat);
  pCrossH.position.set(7.64, altY + 1.26, -1.68);
  interiorGroup.add(pCrossH);
  addLitCandleFlame(7.68, altY + 1.955, -1.68, {
    scale: 1.4,
    phase: 4.8,
    baseIntensity: 0.95,
    distance: 4.4,
    waxRadius: 0.042
  });

  // Wooden Communion Rails with Crimson Kneelers (x = 6.36, IMG_3938)
  const railBaseY = DIM.sanctuaryStep1Y;
  [-1, 1].forEach((sideZ) => {
    const rLen = C.zSouthInt - 0.56;
    const midZ = sideZ * (0.56 + rLen * 0.5);
    const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, rLen), mats.medOak);
    railTop.position.set(6.38, railBaseY + 0.68, midZ);
    railTop.castShadow = true;
    interiorGroup.add(railTop);

    [0.08, rLen * 0.5, rLen - 0.08].forEach((off) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.68, 0.06), mats.medOak);
      post.position.set(6.38, railBaseY + 0.34, sideZ * (0.56 + off));
      interiorGroup.add(post);
    });

    // Crimson velvet communion kneeler cushion along step below rail
    const cKneeler = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, rLen - 0.06), mats.cushionCrimson);
    cKneeler.position.set(6.08, DIM.chancelFloorY + 0.04, midZ);
    interiorGroup.add(cKneeler);
  });

  // North Chancel Choir Pews (two parallel rows facing South into chancel aisle, clear of the altar rail cushion) + Bible Table (IMG_3938, 3939)
  [
    { x: 4.82, z: -1.68, len: 1.44 },
    { x: 4.42, z: -0.94, len: 1.56 }
  ].forEach(({ x, z, len }) => {
    const cPew = buildPew(len, mats, { includeKneelers: false });
    cPew.position.set(x, DIM.chancelFloorY, z);
    cPew.rotation.y = -Math.PI / 2; // Local +X (seat front) faces +Z (South into chancel aisle)
    interiorGroup.add(cPew);
  });
  const bibleTable = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.72, 0.62), mats.medOak);
  bibleTable.position.set(3.66, DIM.chancelFloorY + 0.36, -1.58);
  interiorGroup.add(bibleTable);
  const bigBible = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.36), mats.iron);
  bigBible.position.set(3.66, DIM.chancelFloorY + 0.76, -1.58);
  interiorGroup.add(bigBible);

  // South Chancel Carved Oak Clergy Prayer Desk / Stall on Raised Dais (IMG_3940!)
  const deskG = new THREE.Group();
  const dais = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.14, 1.02), mats.medOak);
  dais.position.set(4.15, DIM.chancelFloorY + 0.07, 1.44);
  deskG.add(dais);
  const stallFront = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.88, 0.14), mats.medOak);
  stallFront.position.set(4.15, DIM.chancelFloorY + 0.56, 1.0);
  stallFront.castShadow = true;
  deskG.add(stallFront);
  const stallSeat = buildPew(1.12, mats, { includeKneelers: false });
  stallSeat.position.set(4.15, DIM.chancelFloorY + 0.14, 1.66);
  stallSeat.rotation.y = Math.PI / 2; // Local +X (seat front) faces -Z (North toward prayer desk)
  deskG.add(stallSeat);
  interiorGroup.add(deskG);

  // The medieval jamb carvings of Window 7 are cut into its splayed jambs: see buildCompositeWall in architecture.js

  // -------------------------------------------------------
  // 5. NAVE FURNISHINGS: PULPIT, LECTERN, PEWS, FONT, ORGAN
  // -------------------------------------------------------
  const nfY = DIM.naveFloorY;

  // Octagonal Open-Topped Dark Oak Pulpit with Rear Stone Steps in NE corner of Nave
  const pulpitG = new THREE.Group();
  const octR = 0.54;
  const wallT = 0.068;
  const apothem = octR * Math.cos(Math.PI / 8); // ~0.499m
  const faceW = 2 * octR * Math.sin(Math.PI / 8); // ~0.413m
  const plinthH = 0.35;
  const parapetH = 1.1; // y: 0.35 -> 1.45

  // 1. Dressed pale limestone base plinth with moulded bullnose top edge (visible in user photo)
  const plinthCore = new THREE.Mesh(new THREE.BoxGeometry(1.14, plinthH - 0.04, 1.14), mats.ashlar);
  plinthCore.position.set(-0.02, (plinthH - 0.04) * 0.5, -0.02);
  plinthCore.castShadow = true;
  plinthCore.receiveShadow = true;
  pulpitG.add(plinthCore);

  const plinthCap = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.045, 1.2), mats.ashlarWarm);
  plinthCap.position.set(-0.02, plinthH - 0.02, -0.02);
  plinthCap.castShadow = true;
  plinthCap.receiveShadow = true;
  pulpitG.add(plinthCap);

  // 2. Rear stone steps at the East (+X) back of the pulpit ascending into the open rear entrance
  // Lower step (y: 0 -> 0.125m) & Upper step (y: 0.125 -> 0.245m) with bullnose treads
  const stepSpecs = [
    { x: 0.72, h: 0.12, wX: 0.34, wZ: 0.54 },
    { x: 0.55, h: 0.24, wX: 0.32, wZ: 0.54 }
  ];
  stepSpecs.forEach(({ x, h, wX, wZ }) => {
    const riser = new THREE.Mesh(new THREE.BoxGeometry(wX, h - 0.03, wZ), mats.ashlar);
    riser.position.set(x, (h - 0.03) * 0.5, 0.14);
    riser.castShadow = true;
    riser.receiveShadow = true;
    pulpitG.add(riser);

    const tread = new THREE.Mesh(new THREE.BoxGeometry(wX + 0.04, 0.034, wZ + 0.04), mats.ashlarWarm);
    tread.position.set(x + 0.01, h - 0.015, 0.14);
    tread.castShadow = true;
    tread.receiveShadow = true;
    pulpitG.add(tread);
  });

  // 3. Internal dark-oak floorboards inside the open-topped pulpit
  const innerFloor = new THREE.Mesh(new THREE.CylinderGeometry(octR - 0.04, octR - 0.04, 0.03, 8), mats.darkOak);
  innerFloor.rotation.y = Math.PI / 8;
  innerFloor.position.y = plinthH + 0.015;
  innerFloor.receiveShadow = true;
  pulpitG.add(innerFloor);

  // 4. Open-topped octagonal dark-oak parapet walls (6 closed panelled facets; East + SE-East rear left open for steps)
  // Facet angles: 0 = West (-X), 1 = SW (-X,+Z), 2 = South (+Z), 3 = SE (+X,+Z),
  //               4 = East (+X, OPEN entry), 5 = NE (+X,-Z), 6 = North (-Z), 7 = NW (-X,-Z)
  for (let i = 0; i < 8; i++) {
    if (i === 4) continue; // Open rear doorway facing the stone steps!
    const ang = (i * Math.PI) / 4;
    // Direction vector pointing outward from pulpit centre for facet i (0 = West = -X, 2 = South = +Z)
    const nx = -Math.cos(ang);
    const nz = Math.sin(ang);

    const facetG = new THREE.Group();
    facetG.position.set(nx * (apothem - wallT * 0.5), plinthH, nz * (apothem - wallT * 0.5));
    facetG.rotation.y = Math.atan2(nx, nz);

    // Main oak wall core (visible from both outside and inside the open top)
    const core = new THREE.Mesh(new THREE.BoxGeometry(faceW + 0.02, parapetH, wallT), mats.darkOak);
    core.position.y = parapetH * 0.5;
    core.castShadow = true;
    core.receiveShadow = true;
    facetG.add(core);

    // Moulded stepped oak base skirting & chamfered plinth moulding
    const skirtLow = new THREE.Mesh(new THREE.BoxGeometry(faceW + 0.06, 0.14, wallT + 0.044), mats.darkOak);
    skirtLow.position.y = 0.07;
    skirtLow.castShadow = true;
    facetG.add(skirtLow);

    const skirtMould = new THREE.Mesh(new THREE.BoxGeometry(faceW + 0.04, 0.04, wallT + 0.026), mats.darkOak);
    skirtMould.position.y = 0.16;
    facetG.add(skirtMould);

    // Framing stiles (left & right vertical ribs) and top/bottom rails around the sunken panel
    [-1, 1].forEach((s) => {
      const stile = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.78, 0.022), mats.darkOak);
      stile.position.set(s * (faceW * 0.5 - 0.03), 0.57, wallT * 0.5 + 0.008);
      facetG.add(stile);
    });
    [0.21, 0.93].forEach((ry) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(faceW, 0.065, 0.022), mats.darkOak);
      rail.position.set(0, ry, wallT * 0.5 + 0.008);
      facetG.add(rail);
    });

    // Raised fielded inner panel with mitred moulding frame
    const fieldFrame = new THREE.Mesh(new THREE.BoxGeometry(faceW - 0.15, 0.61, 0.014), mats.darkOak);
    fieldFrame.position.set(0, 0.57, wallT * 0.5 + 0.004);
    facetG.add(fieldFrame);

    const fieldCenter = new THREE.Mesh(new THREE.BoxGeometry(faceW - 0.21, 0.53, 0.02), mats.darkOak);
    fieldCenter.position.set(0, 0.57, wallT * 0.5 + 0.009);
    fieldCenter.castShadow = true;
    facetG.add(fieldCenter);

    // Moulded top cornice & coping rail along top of this parapet facet (leaving the pulpit top OPEN)
    const corniceLow = new THREE.Mesh(new THREE.BoxGeometry(faceW + 0.05, 0.04, wallT + 0.034), mats.darkOak);
    corniceLow.position.y = parapetH - 0.04;
    facetG.add(corniceLow);

    const copingTop = new THREE.Mesh(new THREE.BoxGeometry(faceW + 0.08, 0.045, wallT + 0.064), mats.darkOak);
    copingTop.position.y = parapetH;
    copingTop.castShadow = true;
    facetG.add(copingTop);

    pulpitG.add(facetG);
  }

  // 5. Flared dark-oak reading desk / bookboard & green damask pulpit fall on the congregation-facing facet (i = 1, SW/West)
  const deskAng = Math.PI / 5.5;
  const deskNx = -Math.cos(deskAng);
  const deskNz = Math.sin(deskAng);
  const pulpitDeskG = new THREE.Group();
  pulpitDeskG.position.set(deskNx * (apothem + 0.01), plinthH + parapetH, deskNz * (apothem + 0.01));
  pulpitDeskG.rotation.y = Math.atan2(deskNx, deskNz);

  // Projecting bevelled bookrest cornice shelf
  const bookShelf = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.045, 0.26), mats.darkOak);
  bookShelf.position.set(0, 0.03, -0.02);
  bookShelf.rotation.x = -0.14;
  bookShelf.castShadow = true;
  pulpitDeskG.add(bookShelf);

  // Draped green damask pulpit fall with gold Latin cross & bottom gold fringe
  const pFall = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.38, 0.024), mats.altarFrontal);
  pFall.position.set(0, -0.17, 0.052);
  pFall.castShadow = true;
  pulpitDeskG.add(pFall);

  // Pair of small brass candlesticks with lit flickering white taper candles on the pulpit rail
  const pulpitCandleSticks = [];
  [-0.24, 0.24].forEach((cx) => {
    const cStick = new THREE.Group();
    const cFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.032, 0.025, 10), mats.brass);
    cFoot.position.y = 0.012;
    const cStem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.01, 0.075, 8), mats.brass);
    cStem.position.y = 0.06;
    const cCup = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.012, 0.02, 10), mats.brass);
    cCup.position.y = 0.1;
    const cTaper = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.01, 0.12, 12), mats.wax);
    cTaper.position.y = 0.165;
    cStick.add(cFoot, cStem, cCup, cTaper);
    cStick.position.set(cx, 0.035, -0.02);
    pulpitDeskG.add(cStick);
    pulpitCandleSticks.push(cStick);
  });

  pulpitG.add(pulpitDeskG);
  pulpitG.position.set(2.26, nfY, -1.92);
  pulpitG.updateMatrixWorld(true);
  pulpitCandleSticks.forEach((cStick, idx) => {
    const tip = cStick.localToWorld(new THREE.Vector3(0, 0.225, 0));
    addLitCandleFlame(tip.x, tip.y, tip.z, {
      scale: 0.62,
      phase: 3.1 + idx * 1.9,
      baseIntensity: 0.34,
      distance: 2.2,
      waxRadius: 0.0085
    });
  });
  interiorGroup.add(pulpitG);

  // Dark Oak Lectern in SE Nave (IMG_3936, 3940, 3941)
  const lecternG = new THREE.Group();
  const lBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.1, 14), mats.darkOak);
  lBase.position.y = 0.05;
  lecternG.add(lBase);
  const lStem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 1.12, 12), mats.darkOak);
  lStem.position.y = 0.62;
  lStem.castShadow = true;
  lecternG.add(lStem);
  const lDesk = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.58), mats.darkOak);
  lDesk.position.y = 1.24;
  lDesk.rotation.z = 0.35;
  lDesk.castShadow = true;
  lecternG.add(lDesk);
  lecternG.position.set(2.46, nfY, 1.22);
  interiorGroup.add(lecternG);

  // Nave Oak Pews with Crimson Cushions & Blue Kneelers!
  // North block: 4 rows between Pulpit & North Doorway (IMG_3936, 3949)
  [1.42, 0.48, -0.46, -1.4].forEach((px) => {
    const pew = buildPew(1.86, mats);
    pew.position.set(px, nfY, -1.52);
    interiorGroup.add(pew);
  });

  // South block: 5 main rows + 1 west-end pew + 1 tower-bay pew (IMG_3941, 3943, 3950)
  [1.62, 0.7, -0.22, -1.14, -2.06, -2.98].forEach((px) => {
    const pew = buildPew(1.86, mats);
    pew.position.set(px, nfY, 1.52);
    interiorGroup.add(pew);
  });
  const towerBayPew = buildPew(1.36, mats, { includeKneelers: false });
  towerBayPew.position.set(-4.52, nfY, 1.66);
  interiorGroup.add(towerBayPew);

  // Octagonal Medieval Limestone Font with 4-Rib Curved Ogee Oak Cover (matching close-up photo & IMG_3941/3943)
  const fontG = new THREE.Group();

  // Helper to build crisp flat-faceted 8-sided carved limestone lathe geometry aligned with cardinal faces
  const makeOctagonalStone = (pts, mat) => {
    const raw = new THREE.LatheGeometry(pts, 8);
    raw.rotateY(Math.PI / 8);
    const geo = raw.toNonIndexed();
    geo.computeVertexNormals();
    applyBoxUVs(geo, 0.58);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // 1. Broad low octagonal weathered limestone base step
  const fPlinth = makeOctagonalStone(
    [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.64, 0.0),
      new THREE.Vector2(0.64, 0.13),
      new THREE.Vector2(0.6, 0.165),
      new THREE.Vector2(0.0, 0.165)
    ],
    mats.ashlar
  );
  fontG.add(fPlinth);

  // 2. Sculpted octagonal limestone foot, sturdy tapered stem, chamfered flare & tall vertical bowl
  const fBody = makeOctagonalStone(
    [
      new THREE.Vector2(0.0, 0.16),
      new THREE.Vector2(0.45, 0.16),
      new THREE.Vector2(0.45, 0.22),
      new THREE.Vector2(0.405, 0.255),
      new THREE.Vector2(0.355, 0.295),
      new THREE.Vector2(0.34, 0.345),
      new THREE.Vector2(0.33, 0.65),
      new THREE.Vector2(0.37, 0.695),
      new THREE.Vector2(0.425, 0.745),
      new THREE.Vector2(0.435, 1.18),
      new THREE.Vector2(0.0, 1.18)
    ],
    mats.ashlarWarm
  );
  fontG.add(fBody);

  // 3. Flat overhanging octagonal dark-oak lid
  const lidTopY = 1.212;
  const fLid = new THREE.Mesh(new THREE.CylinderGeometry(0.455, 0.455, 0.032, 8), mats.darkOak);
  fLid.rotation.y = Math.PI / 8;
  fLid.position.y = 1.196;
  fLid.castShadow = true;
  fLid.receiveShadow = true;
  fontG.add(fLid);

  // 4. Four gracefully curved S-shaped (ogee) oak flying ribs rising from the lid and joining in the center
  const ribShape = new THREE.Shape();
  ribShape.moveTo(0.365, 0.0);
  ribShape.lineTo(0.365, 0.095);
  ribShape.bezierCurveTo(0.365, 0.185, 0.285, 0.215, 0.215, 0.26);
  ribShape.bezierCurveTo(0.145, 0.305, 0.068, 0.375, 0.048, 0.455);
  ribShape.lineTo(0.0, 0.455);
  ribShape.lineTo(0.0, 0.365);
  ribShape.lineTo(0.042, 0.365);
  ribShape.bezierCurveTo(0.065, 0.3, 0.135, 0.245, 0.205, 0.205);
  ribShape.bezierCurveTo(0.268, 0.168, 0.305, 0.14, 0.305, 0.075);
  ribShape.lineTo(0.305, 0.0);
  ribShape.closePath();

  const ribDepth = 0.046;
  const ribGeo = new THREE.ExtrudeGeometry(ribShape, {
    depth: ribDepth,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 2,
    curveSegments: 16
  });
  ribGeo.translate(0, 0, -ribDepth * 0.5);
  applyBoxUVs(ribGeo, 0.65);

  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(ribGeo, mats.darkOak);
    rib.position.y = lidTopY;
    rib.rotation.y = (i * Math.PI) / 2;
    rib.castShadow = true;
    rib.receiveShadow = true;
    fontG.add(rib);
  }

  // 5. Turned oak central finial hub & pointed diamond/acorn bud where the 4 curved ribs join (open center below)
  const finialPts = [
    new THREE.Vector2(0.0, 0.36),
    new THREE.Vector2(0.046, 0.385),
    new THREE.Vector2(0.044, 0.455),
    new THREE.Vector2(0.028, 0.49),
    new THREE.Vector2(0.024, 0.545),
    new THREE.Vector2(0.038, 0.565),
    new THREE.Vector2(0.02, 0.585),
    new THREE.Vector2(0.044, 0.625),
    new THREE.Vector2(0.026, 0.655),
    new THREE.Vector2(0.0, 0.68)
  ];
  const finialGeo = new THREE.LatheGeometry(finialPts, 14);
  const fFinial = new THREE.Mesh(finialGeo, mats.darkOak);
  fFinial.position.y = lidTopY;
  fFinial.castShadow = true;
  fontG.add(fFinial);

  fontG.position.set(-3.98, nfY, 0.0);
  interiorGroup.add(fontG);

  // Wooden Organ Console, Pedalboard & Bench in NW Tower Bay (IMG_3941, 3942)
  const organG = new THREE.Group();
  const oBody = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.24, 1.26), mats.medOak);
  oBody.position.set(0, 0.62, 0);
  oBody.castShadow = true;
  organG.add(oBody);
  const oKeys = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.92), mats.wax);
  oKeys.position.set(-0.34, 0.86, 0);
  organG.add(oKeys);
  const oBench = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.58, 1.12), mats.medOak);
  oBench.position.set(-0.62, 0.29, 0);
  organG.add(oBench);
  const oPedals = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.88), mats.warmOak);
  oPedals.position.set(-0.35, 0.06, 0);
  organG.add(oPedals);
  organG.position.set(-4.32, nfY, -1.72);
  organG.rotation.y = 0;
  interiorGroup.add(organG);

  // Pew in front (East) of the organ, facing the altar, with the open visitor book & a pen lying on its cushion
  const visitorPew = buildPew(1.3, mats, { includeKneelers: false });
  visitorPew.position.set(-3.3, nfY, -1.6);
  interiorGroup.add(visitorPew);
  interiorGroup.add(buildVisitorBook(mats, -3.27, nfY + 0.518, -1.9));

  // Hinged iron donation plate with a coin slot & keyhole, on the North wall right (East) of the door, above the front pew
  const donation = buildDonationPlate(mats);
  donation.scale.setScalar(0.7);
  donation.position.set(-1.4, nfY + 1.1, N.zNorthInt);
  interiorGroup.add(donation);

  // -------------------------------------------------------
  // 6. WEST TOWER TIMBER SUBSTRUCTURE & VESTRY
  // -------------------------------------------------------
  interiorGroup.add(buildWestTowerInterior(mats, ceilingGroup));

  // -------------------------------------------------------
  // 7. THREE SUSPENDED CHANDELIERS, WALL MEMORIALS & STAINED-GLASS CAUSTIC
  // -------------------------------------------------------
  [
    [-2.2, 5.08, 2.38, 1.7],
    [0.95, 5.08, 2.38, 1.8],
    [5.45, 4.66, 2.05, 1.7]
  ].forEach(([cx, topY, drop, intensity]) => {
    const ch = buildChandelier(drop, mats, intensity);
    ch.group.position.set(cx, topY, 0);
    ceilingGroup.add(ch.group);
    chandelierLights.push(ch.light);
  });

  // Soft Sanctuary highlight light so altar frontal & reredos glow warmly
  const sanctuaryLight = new THREE.PointLight(0xffe7c2, 1.35, 7.5, 1.6);
  sanctuaryLight.position.set(7.65, 2.85, 0);
  interiorGroup.add(sanctuaryLight);
  chandelierLights.push(sanctuaryLight);

  // Roll of Honour War Dead Stone Plaque + Remembrance Poppy Wreath on South Nave Wall (IMG_3943, 3950 / RollOfHonour.md)
  const rollG = new THREE.Group();
  const rollBack = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.51, 0.036), mats.ashlar);
  rollBack.castShadow = true;
  rollBack.receiveShadow = true;
  rollG.add(rollBack);
  const rollBevel = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.47, 0.044), mats.ashlar);
  rollG.add(rollBevel);
  const rollFace = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.46), mats.rollOfHonour);
  rollFace.position.z = -0.024;
  rollFace.rotation.y = Math.PI;
  rollG.add(rollFace);
  rollG.position.set(-2.32, 2.08, N.zSouthInt - 0.022);
  interiorGroup.add(rollG);

  // Small iron shelf & brackets beneath the Roll of Honour
  const poppyShelf = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.025, 0.14), mats.iron);
  poppyShelf.position.set(-2.32, 1.5, N.zSouthInt - 0.07);
  interiorGroup.add(poppyShelf);
  [-0.2, 0.2].forEach((bx) => {
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.12, 0.025), mats.iron);
    br.position.set(-2.32 + bx, 1.44, N.zSouthInt - 0.02);
    interiorGroup.add(br);
  });

  // Detailed Remembrance Poppy Wreath (green laurel ring + 20 crimson poppies with black centres)
  const wreathG = new THREE.Group();
  const wreathLeafMat = new THREE.MeshStandardMaterial({ color: 0x1f4722, roughness: 0.85 });
  const poppyPetalMat = new THREE.MeshStandardMaterial({ color: 0xcc141c, roughness: 0.65 });
  const poppyCenterMat = new THREE.MeshStandardMaterial({ color: 0x161618, roughness: 0.5 });

  const wreathBase = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.036, 8, 22), wreathLeafMat);
  wreathG.add(wreathBase);
  const poppyCount = 20;
  for (let i = 0; i < poppyCount; i++) {
    const a = (i / poppyCount) * Math.PI * 2;
    const r = 0.155 + (i % 2 === 0 ? 0.012 : -0.012);
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    const pz = -0.028 - (i % 2) * 0.012;
    const flower = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.032, 0.018, 7), poppyPetalMat);
    flower.rotation.x = Math.PI / 2;
    flower.position.set(px, py, pz);
    wreathG.add(flower);

    const center = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), poppyCenterMat);
    center.position.set(px, py, pz - 0.01);
    wreathG.add(center);
  }
  wreathG.position.set(-2.32, 1.7, N.zSouthInt - 0.075);
  interiorGroup.add(wreathG);

  // A7: Carved Oak Memorial Plaque to Robert Harold Attenborough on SE Nave Wall (to the left/East of Sower Window)
  const attenG = new THREE.Group();
  const attenBack = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.34, 0.028), mats.medOak);
  attenBack.castShadow = true;
  attenBack.receiveShadow = true;
  attenG.add(attenBack);
  const attenBevel = new THREE.Mesh(new THREE.BoxGeometry(0.63, 0.31, 0.036), mats.medOak);
  attenG.add(attenBevel);
  const attenFace = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.3), mats.attenboroughPlaque);
  attenFace.position.z = -0.02;
  attenFace.rotation.y = Math.PI;
  attenG.add(attenFace);
  attenG.position.set(1.88, 1.85, N.zSouthInt - 0.02);
  interiorGroup.add(attenG);

  // A4: Framed List of Donors for Mrs Jaques's Memorial Window on North Nave Wall (next to Jaques Window A3)
  const donorsG = new THREE.Group();
  const frameW = 0.5;
  const frameH = 0.72;
  const railT = 0.034;
  // 4-piece moulded dark walnut/oak picture frame
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(frameW, railT, 0.038), mats.darkOak);
  topRail.position.y = (frameH - railT) * 0.5;
  const botRail = new THREE.Mesh(new THREE.BoxGeometry(frameW, railT, 0.038), mats.darkOak);
  botRail.position.y = -(frameH - railT) * 0.5;
  const leftRail = new THREE.Mesh(new THREE.BoxGeometry(railT, frameH, 0.038), mats.darkOak);
  leftRail.position.x = -(frameW - railT) * 0.5;
  const rightRail = new THREE.Mesh(new THREE.BoxGeometry(railT, frameH, 0.038), mats.darkOak);
  rightRail.position.x = (frameW - railT) * 0.5;
  const backBoard = new THREE.Mesh(new THREE.BoxGeometry(frameW - 0.02, frameH - 0.02, 0.016), mats.darkOak);
  backBoard.position.z = -0.008;
  const donorsArt = new THREE.Mesh(
    new THREE.PlaneGeometry(frameW - railT * 1.8, frameH - railT * 1.8),
    mats.jaquesDonors
  );
  donorsArt.position.z = 0.008;
  donorsG.add(topRail, botRail, leftRail, rightRail, backBoard, donorsArt);
  donorsG.position.set(-0.58, 1.92, N.zNorthInt + 0.02);
  interiorGroup.add(donorsG);

  // Rainbow Stained-Glass Sunlight Caustic projected onto the North Nave Wall (IMG_3949!)
  const causticMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.45), mats.causticDecal);
  causticMesh.position.set(-0.65, 1.28, N.zNorthInt + 0.025);
  interiorGroup.add(causticMesh);

  let candleLightScale = 0.88;
  let candleHaloScale = 1.0;
  let candleFlameBoost = 1.0;

  const candleEffect = {
    setMood(moodKey) {
      if (moodKey === 'evensong') {
        candleLightScale = 1.95;
        candleHaloScale = 1.45;
        candleFlameBoost = 1.5;
      } else if (moodKey === 'golden') {
        candleLightScale = 1.15;
        candleHaloScale = 1.15;
        candleFlameBoost = 1.18;
      } else {
        candleLightScale = 0.88;
        candleHaloScale = 1.0;
        candleFlameBoost = 1.0;
      }
      for (const c of litCandles) {
        c.flameMat.uniforms.uBoost.value = candleFlameBoost;
      }
    },
    update(elapsed) {
      for (const c of litCandles) {
        const p = c.phase;
        c.flameMat.uniforms.uTime.value = elapsed;

        const f1 = Math.sin(elapsed * 7.3 + p);
        const f2 = Math.sin(elapsed * 14.9 + p * 1.7);
        const f3 = Math.sin(elapsed * 23.1 + p * 2.9);
        const flicker = 1 + f1 * 0.12 + f2 * 0.075 + f3 * 0.045;

        const haloSize = c.baseHalo * candleHaloScale * (0.9 + flicker * 0.14);
        c.halo.scale.set(haloSize, haloSize, 1);
        c.halo.material.opacity = Math.min(0.92, (0.42 + flicker * 0.14) * candleHaloScale);
        c.light.intensity = c.baseIntensity * candleLightScale * (0.78 + flicker * 0.26);
      }
    }
  };

  return { interiorGroup, ceilingGroup, chandelierLights, causticMesh, candleEffect };
}
