import * as THREE from 'three';
import { DIM } from '/assets/js/st-peters-3d/dimensions.js';

// The ring of three, from A. H. Cocks, "The Church Bells of Buckinghamshire" (1897), Ilmer entry, with the
// diameters he measured. The 1981 restoration by Whites of Appleton rehung them for swing chiming.
export const ILMER_BELLS = [
  {
    number: 1,
    name: 'Treble',
    diameterIn: 30.75,
    year: 1618,
    founder: 'Henry Knight, Reading',
    lettering: 'roman',
    inscription: 'HENRI KNIGHT MADE MEE ANO 1618',
    waist: null
  },
  {
    number: 2,
    name: 'Second',
    diameterIn: 34,
    year: 1586,
    founder: 'Knight foundry, Reading (initials WK)',
    lettering: 'blackletter',
    inscription: 'gloria in excelsis deo 1586',
    waist: 'WK'
  },
  {
    number: 3,
    name: 'Tenor',
    diameterIn: 37,
    year: 1500,
    founder: 'William Hasylwood, Reading',
    lettering: 'lombardic',
    inscription: 'Sancta Margareta Ora Pro Nobis W H',
    waist: null
  }
];

const IN = 0.0254;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bell section in units of the mouth diameter, from the crown (on the axis) down the outside to the lip, then back
// up the inside. y is measured up from the lip. The shoulder band (points 4-5) carries the inscription, the waist
// band (6-7) any founder's initials.
const BELL_PROFILE = [
  [0, 0.77],
  [0.15, 0.765],
  [0.25, 0.752],
  [0.3, 0.728],
  [0.318, 0.695],
  [0.326, 0.615],
  [0.334, 0.53],
  [0.35, 0.42],
  [0.38, 0.31],
  [0.42, 0.21],
  [0.46, 0.13],
  [0.49, 0.07],
  [0.5, 0.035],
  [0.5, 0.0],
  [0.468, 0.0],
  [0.455, 0.04],
  [0.43, 0.11],
  [0.39, 0.2],
  [0.355, 0.31],
  [0.325, 0.42],
  [0.31, 0.52],
  [0.3, 0.62],
  [0.284, 0.68],
  [0.24, 0.712],
  [0, 0.72]
];
const ROW = 64; // canvas px per profile segment
const BAND = 4; // inscription band runs from profile point 4 to 5
const WAIST_BAND = 6;
const INSIDE_FROM = 14;

function drawCrossPatee(ctx, x, y, s) {
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const p = (u, v) => [x + u * c - v * sn, y + u * sn + v * c];
    const pts = [p(0.12 * s, -0.08 * s), p(0.5 * s, -0.3 * s), p(0.5 * s, 0.3 * s), p(0.12 * s, 0.08 * s)];
    pts.forEach(([px, py], i) => (i === 0 && k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - 0.13 * s, y - 0.13 * s, 0.26 * s, 0.26 * s);
}

// A pair of little fleurs-de-lys, the stops between William Knight's words
function drawFleurStop(ctx, x, y, s) {
  [-0.32, 0.32].forEach((dx) => {
    const cx = x + dx * s;
    ctx.beginPath();
    ctx.ellipse(cx, y - 0.18 * s, 0.08 * s, 0.2 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 0.15 * s, y - 0.05 * s, 0.07 * s, 0.14 * s, 0.7, 0, Math.PI * 2);
    ctx.ellipse(cx + 0.15 * s, y - 0.05 * s, 0.07 * s, 0.14 * s, -0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 0.17 * s, y + 0.06 * s, 0.34 * s, 0.07 * s);
  });
}

function drawShield(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x - 0.3 * s, y - 0.36 * s);
  ctx.lineTo(x + 0.3 * s, y - 0.36 * s);
  ctx.lineTo(x + 0.3 * s, y);
  ctx.quadraticCurveTo(x + 0.28 * s, y + 0.3 * s, x, y + 0.42 * s);
  ctx.quadraticCurveTo(x - 0.28 * s, y + 0.3 * s, x - 0.3 * s, y);
  ctx.closePath();
  ctx.lineWidth = 0.07 * s;
  ctx.stroke();
}

// Cast bronze with a dull brown-green patina, and the inscription standing proud round the shoulder (map + bump)
function createBellMaps(bell, circumferenceM) {
  const W = 2048;
  const H = ROW * (BELL_PROFILE.length - 1);
  const col = document.createElement('canvas');
  col.width = W;
  col.height = H;
  const bmp = document.createElement('canvas');
  bmp.width = W;
  bmp.height = H;
  const ctx = col.getContext('2d');
  const bctx = bmp.getContext('2d');
  const rng = mulberry32(1500 + bell.number * 37);

  // LatheGeometry runs v from the crown (v=0, the canvas's bottom row once flipped) to the inner crown (v=1)
  const rowY = (j) => H - j * ROW;
  ctx.fillStyle = '#6b5434';
  ctx.fillRect(0, 0, W, H);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const r = 2 + rng() * 14;
    const green = rng() < 0.35;
    ctx.fillStyle = green
      ? `rgba(78,104,78,${0.15 + rng() * 0.25})`
      : `rgba(${40 + rng() * 60},${30 + rng() * 40},${18 + rng() * 20},0.25)`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.4 + rng() * 0.6), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // Weathering streaks running down from the shoulder
  for (let i = 0; i < 160; i++) {
    const x = rng() * W;
    const y0 = rowY(BAND + 1);
    ctx.fillStyle = `rgba(60,82,64,${0.08 + rng() * 0.12})`;
    ctx.fillRect(x, rowY(12), 3 + rng() * 6, y0 - rowY(12));
  }
  // Inside of the bell: darker, unpolished
  ctx.fillStyle = 'rgba(25,18,10,0.55)';
  ctx.fillRect(0, 0, W, rowY(INSIDE_FROM));

  // Moulding wires either side of the inscription band and at the sound bow
  const wire = (j, frac) => {
    const y = rowY(j) - frac * ROW;
    ctx.fillStyle = 'rgba(150,120,70,0.7)';
    ctx.fillRect(0, y - 3, W, 6);
    bctx.fillStyle = '#e0e0e0';
    bctx.fillRect(0, y - 3, W, 6);
  };
  wire(BAND, 0.06);
  wire(BAND, 0.94);
  wire(11, 0.5);
  wire(12, 0.5);

  // Lettering, drawn mirrored vertically so it reads upright on the bell
  const letterPx = ROW * 0.8;
  const fonts = {
    roman: `bold ${letterPx}px "Times New Roman", Georgia, serif`,
    blackletter: `bold italic ${letterPx * 0.95}px "Old English Text MT", "UnifrakturMaguntia", Georgia, serif`,
    lombardic: `bold ${letterPx}px "Lombardic", "Palatino Linotype", Georgia, serif`
  };
  const tokens = [{ cross: true }];
  bell.inscription.split(' ').forEach((wd, i, arr) => {
    tokens.push({ text: wd });
    if (bell.lettering === 'blackletter' && i < arr.length - 2) tokens.push({ fleur: true });
  });
  if (bell.lettering === 'lombardic') tokens.push({ shield: true });

  const paint = (c, fill, shadow) => {
    c.save();
    c.translate(0, rowY(BAND) - ROW * 0.5);
    c.scale(1, -1);
    c.font = fonts[bell.lettering];
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    const widths = tokens.map((t) => (t.text ? c.measureText(t.text).width : letterPx * 0.9));
    // Spread the words round about 80% of the circumference, as the founders did
    const usable = W * 0.86;
    const gap = Math.max(letterPx * 0.5, (usable - widths.reduce((a, b) => a + b, 0)) / tokens.length);
    let x = W * 0.06;
    tokens.forEach((t, i) => {
      const passes = shadow
        ? [
            [3, 3, shadow],
            [0, 0, fill]
          ]
        : [[0, 0, fill]];
      passes.forEach(([dx, dy, style]) => {
        c.fillStyle = style;
        c.strokeStyle = style;
        if (t.text) c.fillText(t.text, x + dx, dy);
        else if (t.cross) drawCrossPatee(c, x + widths[i] * 0.5 + dx, dy, letterPx * 0.9);
        else if (t.fleur) drawFleurStop(c, x + widths[i] * 0.5 + dx, dy, letterPx * 0.8);
        else if (t.shield) drawShield(c, x + widths[i] * 0.5 + dx, dy, letterPx);
      });
      x += widths[i] + gap;
    });
    if (bell.waist) {
      c.font = `bold ${letterPx * 0.9}px Georgia, serif`;
      c.translate(0, -(rowY(WAIST_BAND) - rowY(BAND)));
      (shadow
        ? [
            [3, 3, shadow],
            [0, 0, fill]
          ]
        : [[0, 0, fill]]
      ).forEach(([dx, dy, style]) => {
        c.fillStyle = style;
        c.fillText(bell.waist, W * 0.06 + dx, dy);
      });
    }
    c.restore();
  };
  paint(ctx, '#a88a55', 'rgba(30,20,10,0.75)');
  paint(bctx, '#ffffff', null);

  const finish = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    return t;
  };
  void circumferenceM;
  return { map: finish(col, true), bumpMap: finish(bmp, false) };
}

function buildBell(bell) {
  const D = bell.diameterIn * IN;
  const top = BELL_PROFILE[0][1];
  const pts = BELL_PROFILE.map(([r, y]) => new THREE.Vector2(Math.max(r * D, 0.0005), (y - top) * D));
  const geo = new THREE.LatheGeometry(pts, 56);
  geo.computeVertexNormals();
  const maps = createBellMaps(bell, Math.PI * 0.64 * D);
  const mat = new THREE.MeshStandardMaterial({
    map: maps.map,
    bumpMap: maps.bumpMap,
    bumpScale: 2.5,
    metalness: 0.55,
    roughness: 0.5,
    side: THREE.DoubleSide
  });
  const g = new THREE.Group();
  const body = new THREE.Mesh(geo, mat);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  return { group: g, D, height: top * D };
}

// One bell hung for swing chiming: elm headstock on iron gudgeons in plummer blocks, a full wheel on one side
// with the rope leaving it, canon straps, and an iron clapper inside. The group's origin is the gudgeon axis.
function buildHungBell(bell, { pitHalf, wheelX, wheelR, headX }, mats) {
  const g = new THREE.Group();
  const { group: bellG, D, height } = buildBell(bell);
  const crownDrop = 0.085;
  bellG.position.y = -crownDrop;
  g.add(bellG);

  const ironMat = mats.iron;
  const elm = mats.medOak;

  // Headstock, spanning the pit between the frame sides
  const hs = new THREE.Mesh(new THREE.BoxGeometry(pitHalf * 2 - 0.02, 0.15, 0.2), elm);
  hs.position.set(headX, -0.005, 0);
  hs.castShadow = true;
  g.add(hs);
  // Gudgeons out to the bearings
  [-1, 1].forEach((sx) => {
    const gud = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.14, 12), ironMat);
    gud.rotation.z = Math.PI / 2;
    gud.position.x = headX + sx * (pitHalf + 0.06);
    g.add(gud);
  });
  // Canons cast on the crown, strapped up to the headstock
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    const canon = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.011, 6, 12, Math.PI), mats.iron);
    canon.position.set(Math.cos(a) * 0.05, -crownDrop + 0.001, Math.sin(a) * 0.05);
    canon.rotation.y = -a;
    g.add(canon);
  }
  [-1, 1].forEach((sz) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.01), ironMat);
    strap.position.set(0, -0.05, sz * 0.105);
    g.add(strap);
    [-0.06, 0.06].forEach((bx) => {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.19, 8), ironMat);
      bolt.position.set(bx, -0.01, sz * 0.05);
      g.add(bolt);
    });
  });

  // Clapper: staple in the crown, shaft, ball and flight
  const clapperMat = mats.iron;
  const lipY = -crownDrop - height;
  const shaftTop = -crownDrop - 0.04;
  const ballY = lipY + D * 0.2;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, shaftTop - ballY, 8), clapperMat);
  shaft.position.y = (shaftTop + ballY) * 0.5;
  g.add(shaft);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(D * 0.065, 16, 12), clapperMat);
  ball.scale.y = 1.25;
  ball.position.y = ballY;
  g.add(ball);
  const flight = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.012, D * 0.22, 8), clapperMat);
  flight.position.y = ballY - D * 0.15;
  g.add(flight);

  // Full wheel: sole, two shrouds, four spokes and a hub on the gudgeon
  const wheel = new THREE.Group();
  const sole = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, 0.07, 48, 1, true), elm);
  sole.rotation.z = Math.PI / 2;
  sole.material = elm;
  wheel.add(sole);
  const shroudGeo = new THREE.RingGeometry(wheelR - 0.07, wheelR + 0.012, 48);
  [-1, 1].forEach((sx) => {
    const shroud = new THREE.Mesh(shroudGeo, mats.wheelOak);
    shroud.rotation.y = Math.PI / 2;
    shroud.position.x = sx * 0.036;
    wheel.add(shroud);
  });
  for (let k = 0; k < 4; k++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.045, wheelR * 2 - 0.08, 0.055), elm);
    spoke.rotation.x = (k * Math.PI) / 4 + Math.PI / 8;
    wheel.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12), ironMat);
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);
  wheel.position.x = wheelX;
  wheel.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  g.add(wheel);

  return g;
}

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Bell chamber inside the weatherboarded turret: boarded floor and ceiling, studs, a two-tier oak frame with the
// second and tenor side by side below and the treble above, and the three ropes running down to the holes in the
// tower ceiling (their positions below are fixed by interior.js).
export function buildBellChamber(mats) {
  const g = new THREE.Group();
  const T = DIM.tower;
  const cx = T.xCenter;
  const cz = T.zCenter;
  const inner = T.size * 0.5 - 0.1;
  const floorTop = T.baseY + 0.05;
  const ceilY = T.eavesY - 0.06;
  const oak = mats.darkOak;
  const board = mats.medOak;
  mats.wheelOak ??= new THREE.MeshStandardMaterial({
    map: mats.medOak.map,
    color: 0xb08a5a,
    roughness: 0.8,
    side: THREE.DoubleSide
  });

  // Boarded floor with the trap over the hatch below, and the boarded ceiling under the spire
  g.add(box(inner * 2, 0.05, inner * 2, board, cx, floorTop - 0.025, cz));
  const trapW = 1.0;
  const trapD = 1.15;
  [
    [trapW + 0.06, 0.012, 0.03, 0, -trapD * 0.5],
    [trapW + 0.06, 0.012, 0.03, 0, trapD * 0.5],
    [0.03, 0.012, trapD, -trapW * 0.5, 0],
    [0.03, 0.012, trapD, trapW * 0.5, 0]
  ].forEach(([w, h, d, dx, dz]) => g.add(box(w, h, d, oak, cx + dx, floorTop + 0.006, cz + dz)));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 16), mats.iron);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(cx + trapW * 0.38, floorTop + 0.008, cz);
  g.add(ring);
  g.add(box(inner * 2, 0.04, inner * 2, board, cx, ceilY - 0.02, cz));
  [-0.75, 0.75].forEach((dz) => g.add(box(inner * 2, 0.16, 0.14, oak, cx, ceilY - 0.12, cz + dz)));

  // Corner posts, mid-height rail and studs inside the boarding
  const wallH = ceilY - floorTop;
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ].forEach(([sx, sz]) =>
    g.add(box(0.18, wallH, 0.18, oak, cx + sx * (inner - 0.09), floorTop + wallH * 0.5, cz + sz * (inner - 0.09)))
  );
  [-1, 1].forEach((s) => {
    g.add(box(inner * 2, 0.12, 0.08, oak, cx, floorTop + 2.0, cz + s * (inner - 0.04)));
    g.add(box(0.08, 0.12, inner * 2, oak, cx + s * (inner - 0.04), floorTop + 2.0, cz));
    [-0.55, 0.55].forEach((d) => {
      g.add(box(0.1, wallH, 0.06, oak, cx + d, floorTop + wallH * 0.5, cz + s * (inner - 0.03)));
      g.add(box(0.06, wallH, 0.1, oak, cx + s * (inner - 0.03), floorTop + wallH * 0.5, cz + d));
    });
  });

  // --- Lower tier: frame sides run North-South, three of them making two pits -------------------------------
  const lowTop = floorTop + 1.0;
  const sideW = 0.14;
  const sideH = 0.22;
  const zN = cz - 1.4;
  const zS = cz + 1.2;
  const frameXs = [-3.89, -5.19, -6.41];
  frameXs.forEach((fx) => {
    g.add(box(sideW, sideH, zS - zN, oak, fx, lowTop - sideH * 0.5, (zN + zS) * 0.5));
    [zN + 0.08, zS - 0.08].forEach((pz) =>
      g.add(box(sideW, lowTop - sideH - floorTop, sideW, oak, fx, floorTop + (lowTop - sideH - floorTop) * 0.5, pz))
    );
    // Raking braces from the sill up to the side
    [-1, 1].forEach((dir) => {
      const brace = box(0.1, 0.95, 0.1, oak, fx, floorTop + 0.42, (zN + zS) * 0.5 + dir * 0.75);
      brace.rotation.x = dir * 0.62;
      g.add(brace);
    });
  });
  [zN + 0.08, zS - 0.08].forEach((sz) =>
    g.add(box(frameXs[0] - frameXs[2] + 0.2, 0.14, 0.16, oak, (frameXs[0] + frameXs[2]) * 0.5, floorTop + 0.07, sz))
  );

  // --- Upper tier: two cross beams on posts rising from the lower frame, carrying the treble's pit ------------
  const upTop = floorTop + 2.5;
  const upXs = [-4.32, -5.48];
  [zN + 0.08, zS - 0.08].forEach((sz) => {
    g.add(
      box(frameXs[0] - frameXs[2] + 0.14, 0.2, 0.16, oak, (frameXs[0] + frameXs[2]) * 0.5, upTop - sideH - 0.1, sz)
    );
    [frameXs[0], frameXs[2]].forEach((px) =>
      g.add(box(sideW, upTop - sideH - 0.2 - lowTop, sideW, oak, px, (lowTop + upTop - sideH - 0.2) * 0.5, sz))
    );
  });
  upXs.forEach((fx) => g.add(box(sideW, sideH, zS - zN - 0.04, oak, fx, upTop - sideH * 0.5, (zN + zS) * 0.5)));

  // --- The bells ---------------------------------------------------------------------------------------------
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xd8c08a, roughness: 0.95 });
  const hangs = [
    // [bell, pit between frame sides xa..xb, axle height, axle z, wheel side (+1 east / -1 west), wheel radius]
    [ILMER_BELLS[2], frameXs[0], frameXs[1], lowTop, -0.53, 1, 0.62],
    [ILMER_BELLS[1], frameXs[1], frameXs[2], lowTop, -0.25, -1, 0.58],
    [ILMER_BELLS[0], upXs[0], upXs[1], upTop, -0.45, -1, 0.54]
  ];
  // Rope holes in the tower ceiling below (interior.js): tenor East, treble middle, second West
  const bay = T.eastPostX - T.westPostX - 0.1;
  const cX0 = (T.eastPostX + T.westPostX) * 0.5 - bay * 0.5;
  const cellW = bay / 3;
  const cellD = 3.45 / 3;
  const cZ0 = -3.45 * 0.5;
  const holes = {
    Tenor: [cX0 + cellW * 2.45, cZ0 + cellD * 0.5],
    Treble: [cX0 + cellW * 1.35, cZ0 + cellD * 0.64],
    Second: [cX0 + cellW * 0.75, cZ0 + cellD * 0.78]
  };
  hangs.forEach(([bell, xa, xb, top, axleZ, wheelSide, wheelR]) => {
    const pitHalf = Math.abs(xa - xb) * 0.5;
    const pitCx = (xa + xb) * 0.5;
    const D = bell.diameterIn * IN;
    const wheelLocalX = wheelSide * (pitHalf - sideW * 0.5 - 0.06);
    // Bell sits towards the far side of its pit so the wheel clears it
    const bellOffset = -wheelSide * (pitHalf - sideW * 0.5 - 0.05 - D * 0.5);
    const axleY = top + 0.06;
    const hung = buildHungBell(bell, { pitHalf, wheelX: wheelLocalX - bellOffset, wheelR, headX: -bellOffset }, mats);
    hung.position.set(pitCx + bellOffset, axleY, axleZ);
    hung.userData.bell = bell;
    g.add(hung);
    // Plummer blocks on the frame sides
    [xa, xb].forEach((bx) => g.add(box(0.16, 0.08, 0.18, mats.iron, bx, top + 0.02, axleZ)));

    // Rope: leaves the wheel at its North-most low point and runs down through a guide to the hole
    const wx = pitCx + wheelLocalX;
    const [hx, hz] = holes[bell.name];
    const from = new THREE.Vector3(wx, axleY, axleZ - wheelR);
    const to = new THREE.Vector3(hx, T.belfryCeilingY, hz);
    const len = from.distanceTo(to);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 8), ropeMat);
    rope.position.copy(from).add(to).multiplyScalar(0.5);
    rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    g.add(rope);
    // Garter: the rope's last turn round the sole, from the bottom of the wheel to its North side
    const garter = new THREE.Mesh(new THREE.TorusGeometry(wheelR + 0.006, 0.012, 6, 24, Math.PI / 2), ropeMat);
    garter.rotation.y = Math.PI / 2;
    garter.rotation.x = Math.PI;
    garter.position.set(wx, axleY, axleZ);
    g.add(garter);
    // Wooden rope guide on the floor
    const ropeAtFloor = from.clone().lerp(to, (from.y - floorTop) / (from.y - to.y));
    const guide = box(0.12, 0.05, 0.12, board, ropeAtFloor.x, floorTop + 0.025, ropeAtFloor.z);
    g.add(guide);
  });

  return g;
}
