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

export function createRopeMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0xe0c995, roughness: 0.95, vertexColors: true });
}

// Three-strand hawser-laid bell rope: a cylinder whose radius dips into three helical grooves, with
// vertex colours shading each strand round its crown and a fine streak of fibre along it.
// Pass a curve to lay the rope along it (it is built straight, then each ring is carried onto the curve).
// A bell-rope sally: the tufted woollen hand grip woven into the fall, twisted in spiral cream, red & blue stripes
// and tapering into the rope at each end. Built along +Y, centred on the origin.
export function buildSally(length, radius, ropeRadius) {
  const radial = 24;
  const rows = Math.max(16, Math.round(length / 0.005));
  const geo = new THREE.CylinderGeometry(radius, radius, length, radial, rows, true);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const stripes = [
    new THREE.Color(0xeee3c6),
    new THREE.Color(0xb0222a),
    new THREE.Color(0xeee3c6),
    new THREE.Color(0x24407e)
  ];
  const taper = 0.09; // length of the woven taper into the rope at each end
  const pitch = radius * 9; // one full turn of the spiral stripes
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const theta = Math.atan2(z, x);
    const fromEnd = length * 0.5 - Math.abs(y);
    const t = Math.min(1, fromEnd / taper);
    const swell = t * t * (3 - 2 * t);
    // woollen tufts: fine irregular bumps over the surface
    const tuft = 0.06 * Math.sin(theta * 11 + y * 610) * Math.sin(theta * 7 - y * 430);
    const r = ropeRadius + (radius - ropeRadius) * swell * (1 + tuft);
    pos.setX(i, Math.cos(theta) * r);
    pos.setZ(i, Math.sin(theta) * r);
    // two-start spiral: the band index advances around the girth and along the length
    const u = ((((theta / (2 * Math.PI) + y / pitch) * 2) % 1) + 1) % 1;
    const c = stripes[Math.floor(u * stripes.length)];
    const shade = 0.86 + 0.14 * Math.sin(theta * 23 + y * 1300) * Math.cos(y * 700);
    colors[i * 3] = c.r * shade;
    colors[i * 3 + 1] = c.g * shade;
    colors[i * 3 + 2] = c.b * shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const sally = new THREE.Mesh(geo, mat);
  sally.castShadow = true;
  return sally;
}

export function buildTwistedRope(length, radius, material, curve = null) {
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
  ctx.fillStyle = '#d6ad52'; // bright polished brass-gold
  ctx.fillRect(0, 0, W, H);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 400; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const r = 2 + rng() * 14;
    const green = rng() < 0.2;
    ctx.fillStyle = green
      ? `rgba(78,104,78,${0.06 + rng() * 0.12})`
      : `rgba(${90 + rng() * 60},${60 + rng() * 40},${30 + rng() * 20},0.14)`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.4 + rng() * 0.6), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // Weathering streaks running down from the shoulder
  for (let i = 0; i < 160; i++) {
    const x = rng() * W;
    const y0 = rowY(BAND + 1);
    ctx.fillStyle = `rgba(60,82,64,${0.03 + rng() * 0.05})`;
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
  paint(ctx, '#f4d98c', 'rgba(70,48,16,0.65)');
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

// A small cube map of the bell chamber for the bronze to reflect: daylight through the louvres in bright bands on
// the boarded walls, the pale ceiling above and the dark oak floor below. Shared by all three bells.
let belfryEnvMap = null;
function getBelfryEnvMap() {
  if (belfryEnvMap) return belfryEnvMap;
  const size = 128;
  const face = (draw) => {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    draw(c.getContext('2d'));
    return c;
  };
  const wall = (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, '#c9b89a');
    g.addColorStop(0.55, '#7a6448');
    g.addColorStop(1, '#3a2a1a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    // Louvre openings: bright slats of sky
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = 'rgba(235,240,250,0.85)';
      ctx.fillRect(size * 0.34, size * (0.08 + k * 0.05), size * 0.32, size * 0.022);
    }
  };
  const top = (ctx) => {
    ctx.fillStyle = '#b8a88a';
    ctx.fillRect(0, 0, size, size);
  };
  const bottom = (ctx) => {
    ctx.fillStyle = '#3b2818';
    ctx.fillRect(0, 0, size, size);
  };
  belfryEnvMap = new THREE.CubeTexture([face(wall), face(wall), face(top), face(bottom), face(wall), face(wall)]);
  belfryEnvMap.colorSpace = THREE.SRGBColorSpace;
  belfryEnvMap.needsUpdate = true;
  return belfryEnvMap;
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
    metalness: 1.0,
    roughness: 0.2,
    envMap: getBelfryEnvMap(),
    envMapIntensity: 1.5,
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

  // Clapper: staple in the crown, shaft, ball and flight, in its own group pivoting on the staple so it can swing
  const clapperMat = mats.iron;
  const lipY = -crownDrop - height;
  const shaftTop = -crownDrop - 0.04;
  const ballY = lipY + D * 0.2;
  const ballR = D * 0.065;
  const clapper = new THREE.Group();
  clapper.userData.animated = true; // swings: main.js's static-mesh merge must keep it a group of its own
  clapper.userData.era = 'today'; // in 1900 the bells hung dead and were chimed by hammers, so no clappers
  clapper.position.y = shaftTop;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, shaftTop - ballY, 8), clapperMat);
  shaft.position.y = (ballY - shaftTop) * 0.5;
  clapper.add(shaft);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(ballR, 16, 12), clapperMat);
  ball.scale.y = 1.25;
  ball.position.y = ballY - shaftTop;
  clapper.add(ball);
  const flight = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.012, D * 0.22, 8), clapperMat);
  flight.position.y = ballY - D * 0.15 - shaftTop;
  clapper.add(flight);
  g.add(clapper);
  g.userData.clapper = clapper;
  // The angle (relative to the bell) at which the ball meets the sound bow: inner radius there is about 0.44 D
  const armLen = shaftTop - ballY;
  g.userData.strikeAngle = Math.asin(Math.min(0.95, (0.44 * D - ballR) / armLen));

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
  wheel.userData.era = 'today'; // in 1900 the bells hung dead and were chimed by hammers
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
// tower ceiling (their positions below are fixed by interior.js). Returns { shell, frame }.
export function buildBellChamber(mats) {
  const g = new THREE.Group(); // boarding, floor & ceiling: hidden with the roof in the floorplan cutaway
  const frame = new THREE.Group(); // bell frame, bells & ropes: stay visible in the cutaway
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
    frame.add(box(sideW, sideH, zS - zN, oak, fx, lowTop - sideH * 0.5, (zN + zS) * 0.5));
    [zN + 0.08, zS - 0.08].forEach((pz) =>
      frame.add(box(sideW, lowTop - sideH - floorTop, sideW, oak, fx, floorTop + (lowTop - sideH - floorTop) * 0.5, pz))
    );
    // Raking braces from the sill up to the side
    [-1, 1].forEach((dir) => {
      const brace = box(0.1, 0.95, 0.1, oak, fx, floorTop + 0.42, (zN + zS) * 0.5 + dir * 0.75);
      brace.rotation.x = dir * 0.62;
      frame.add(brace);
    });
  });
  [zN + 0.08, zS - 0.08].forEach((sz) =>
    frame.add(box(frameXs[0] - frameXs[2] + 0.2, 0.14, 0.16, oak, (frameXs[0] + frameXs[2]) * 0.5, floorTop + 0.07, sz))
  );

  // --- Upper tier: two cross beams on posts rising from the lower frame, carrying the treble's pit ------------
  const upTop = floorTop + 2.5;
  const upXs = [-4.32, -5.48];
  [zN + 0.08, zS - 0.08].forEach((sz) => {
    frame.add(
      box(frameXs[0] - frameXs[2] + 0.14, 0.2, 0.16, oak, (frameXs[0] + frameXs[2]) * 0.5, upTop - sideH - 0.1, sz)
    );
    [frameXs[0], frameXs[2]].forEach((px) =>
      frame.add(box(sideW, upTop - sideH - 0.2 - lowTop, sideW, oak, px, (lowTop + upTop - sideH - 0.2) * 0.5, sz))
    );
  });
  upXs.forEach((fx) => frame.add(box(sideW, sideH, zS - zN - 0.04, oak, fx, upTop - sideH * 0.5, (zN + zS) * 0.5)));

  // --- The bells ---------------------------------------------------------------------------------------------
  const ropeMat = createRopeMaterial();
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
    hung.userData.wheelR = wheelR;
    frame.add(hung);
    // Plummer blocks on the frame sides
    [xa, xb].forEach((bx) => frame.add(box(0.16, 0.08, 0.18, mats.iron, bx, top + 0.02, axleZ)));

    // Rope: leaves the wheel at its North-most low point and runs down through a guide to the hole
    const wx = pitCx + wheelLocalX;
    const [hx, hz] = holes[bell.name];
    const from = new THREE.Vector3(wx, axleY, axleZ - wheelR);
    const to = new THREE.Vector3(hx, T.belfryCeilingY, hz);
    const belfryRope = buildTwistedRope(0, 0.012, ropeMat, new THREE.LineCurve3(from, to));
    belfryRope.userData.ringsBells = true;
    belfryRope.userData.era = 'today';
    frame.add(belfryRope);
    // Garter: the rope's last quarter-turn in the wheel's groove, from the bottom of the sole round to its North side
    const garterPts = [];
    for (let k = 0; k <= 8; k++) {
      const a = (k / 8) * (Math.PI / 2);
      garterPts.push(
        new THREE.Vector3(wx, axleY - (wheelR + 0.006) * Math.sin(a), axleZ - (wheelR + 0.006) * Math.cos(a))
      );
    }
    const garter = buildTwistedRope(0, 0.012, ropeMat, new THREE.CatmullRomCurve3(garterPts.reverse()));
    garter.userData.era = 'today';
    frame.add(garter);
    // Wooden rope guide on the floor
    const ropeAtFloor = from.clone().lerp(to, (from.y - floorTop) / (from.y - to.y));
    const guide = box(0.12, 0.05, 0.12, board, ropeAtFloor.x, floorTop + 0.025, ropeAtFloor.z);
    guide.userData.era = 'today';
    frame.add(guide);

    // 1900: an Ellacombe chiming hammer on the South side of the bell, pivoted on a bracket off the frame, with its
    // cord running down through the floor to the chiming frame in the vestry
    const hammerG = new THREE.Group();
    hammerG.userData.era = '1900';
    hammerG.visible = false;
    const bellX = pitCx + bellOffset;
    const bowY = axleY - 0.085 - D * 0.62; // sound bow, just above the lip
    const bowZ = axleZ + D * 0.5;
    const pivot = new THREE.Group();
    pivot.userData.animated = true; // swings: main.js's static-mesh merge must keep it a group of its own
    pivot.position.set(bellX, bowY + 0.32, bowZ + 0.1);
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.32, 8), mats.iron);
    shank.position.y = -0.16;
    pivot.add(shank);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 12), mats.iron);
    head.rotation.x = Math.PI / 2;
    head.position.set(0, -0.32, -0.035);
    pivot.add(head);
    const tailArm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.16), mats.iron);
    tailArm.position.set(0, 0, 0.08);
    pivot.add(tailArm);
    hammerG.add(pivot);
    const bracket = box(0.05, 0.05, 0.22, mats.iron, bellX, bowY + 0.32, bowZ + 0.1 + 0.05);
    hammerG.add(bracket);
    const post = box(0.1, top - (bowY + 0.32) + 0.1, 0.1, oak, bellX, (top + bowY + 0.32) * 0.5, bowZ + 0.27);
    hammerG.add(post);
    // The cord hangs from the tail of the hammer and rises and falls with it (main.js's static merge leaves it alone
    // because it carries userData); it runs on down through a hole in the floor
    const cordTop = new THREE.Vector3(bellX, bowY + 0.32, bowZ + 0.1 + 0.16);
    const cordFoot = new THREE.Vector3(bellX, floorTop - 0.2, bowZ + 0.26);
    const cordG = new THREE.Group();
    cordG.userData.chimeCord = true;
    cordG.add(buildTwistedRope(0, 0.006, ropeMat, new THREE.LineCurve3(cordTop, cordFoot)));
    hammerG.add(cordG);
    frame.add(hammerG);
    hung.userData.hammer = pivot;
    hung.userData.hammerCord = cordG;
  });

  return { shell: g, frame };
}

// Swing chiming: each bell is swung up on its wheel and the clapper strikes as the bell turns at the top of each
// swing. ring() starts two rounds (treble, second, tenor; handstroke then backstroke), returning the strike times
// so the caller can sound them; update(time) moves the bells. Times are in seconds on the caller's clock.
const SWING_HALF = 0.9; // seconds per swing from one side to the other
const SWING_AMPLITUDE = THREE.MathUtils.degToRad(78);
const STRIKE_GAP = SWING_HALF / 3; // even spacing of the three bells within a round
const CLAPPER_LAG = 0.2;
const RING_LENGTH = 4 * SWING_HALF;

function smooth01(x) {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

// Swing angle of one bell, tau seconds after it was set going: builds up over a swing and a half, holds for the
// two strokes (at 1.5 and 2.5 half-swings, the tops of the swing), then settles back to hang mouth down
function swingAngle(tau) {
  if (tau <= 0 || tau >= RING_LENGTH) return 0;
  const env = smooth01(tau / (1.5 * SWING_HALF)) * (1 - smooth01((tau - 2.6 * SWING_HALF) / (1.4 * SWING_HALF)));
  return SWING_AMPLITUDE * env * Math.sin((Math.PI * tau) / SWING_HALF);
}

const CHIME_GAP = 0.55; // seconds between hammer blows when chiming
const HAMMER_LIFT = 0.2; // seconds for the hammer to swing in and strike
const HAMMER_FALL = 0.32; // seconds for it to drop back off the bell
const HAMMER_REST = -0.5; // radians: drawn well back from the bell, so each blow is plain to see
const HAMMER_STRIKE = 0.07; // radians: head on the sound bow
const HAMMER_TAIL = 0.16; // metres from the pivot to the cord on the hammer's tail
const VESTRY_PULL = 1.6; // radians the vestry cord swings out towards the ringer per metre of hammer-tail travel

// frame: the belfry; extraRoots: other groups holding the 1900 chiming frame's vestry cords (userData.chimeCord = n)
export function createBellRinger(frame, ...extraRoots) {
  const hung = [];
  frame.traverse((o) => {
    if (o.userData.bell && o.userData.clapper) hung.push(o);
  });
  // Rounds run from the treble down to the tenor
  hung.sort((a, b) => a.userData.bell.number - b.userData.bell.number);
  let startedAt = null;
  let mode = 'swing'; // 'swing' (today) or 'chime' (1900: hammers on bells hung dead)
  let chimes = []; // [{ hung, at }] hammer blows of the current chime, times relative to startedAt

  function chime(now) {
    if (startedAt !== null) return [];
    startedAt = now;
    // Two rounds, treble to tenor, then the tenor tolled once more to finish
    chimes = [];
    const order = [...hung, ...hung, hung[hung.length - 1]];
    order.forEach((h, i) => chimes.push({ hung: h, at: i * CHIME_GAP + (i >= hung.length * 2 ? CHIME_GAP : 0) }));
    return chimes.map((c) => ({ bell: c.hung.userData.bell, delay: c.at + HAMMER_LIFT }));
  }

  // Vestry chiming-frame cords by bell number: each hangs from the ceiling, and the ringer pulls its foot out
  // towards them (+X) to work the hammer
  const vestryCords = new Map();
  for (const root of extraRoots) {
    root.traverse((o) => {
      if (typeof o.userData.chimeCord !== 'number') return;
      const half = (o.geometry?.parameters?.height ?? 1) / 2;
      vestryCords.set(o.userData.chimeCord, { o, half, top: o.position.clone().setY(o.position.y + half) });
    });
  }
  // Pose a hammer: its cord (on the tail) and the matching vestry cord follow it down as it strikes
  function poseHammer(h, angle) {
    const pivot = h.userData.hammer;
    if (!pivot) return;
    pivot.rotation.x = angle;
    const drop = HAMMER_TAIL * (Math.sin(angle) - Math.sin(HAMMER_REST)); // how far the tail has come down
    if (h.userData.hammerCord) h.userData.hammerCord.position.y = -HAMMER_TAIL * Math.sin(angle);
    const v = vestryCords.get(h.userData.bell.number);
    if (v) {
      const phi = drop * VESTRY_PULL;
      v.o.rotation.z = phi;
      v.o.position.set(v.top.x + v.half * Math.sin(phi), v.top.y - v.half * Math.cos(phi), v.top.z);
    }
  }

  function updateChime(now) {
    const t = now - startedAt;
    hung.forEach((h) => {
      // Hammer swings in towards the bell, strikes, and falls back away from it
      let a = 0;
      for (const c of chimes) {
        if (c.hung !== h) continue;
        const u = t - c.at;
        if (u >= 0 && u < HAMMER_LIFT) a = Math.max(a, smooth01(u / HAMMER_LIFT));
        else if (u >= HAMMER_LIFT && u < HAMMER_LIFT + HAMMER_FALL) {
          a = Math.max(a, 1 - smooth01((u - HAMMER_LIFT) / HAMMER_FALL));
        }
      }
      poseHammer(h, HAMMER_REST + a * (HAMMER_STRIKE - HAMMER_REST));
    });
    const end = chimes.length ? chimes[chimes.length - 1].at + 1 : 0;
    if (t > end) {
      hung.forEach((h) => poseHammer(h, HAMMER_REST));
      startedAt = null;
    }
  }

  function setMode(m) {
    mode = m;
    startedAt = null;
    hung.forEach((h) => {
      h.rotation.x = 0;
      h.userData.clapper.rotation.x = 0;
      poseHammer(h, HAMMER_REST);
    });
  }

  function ring(now) {
    if (mode === 'chime') return chime(now);
    if (startedAt !== null && now - startedAt < RING_LENGTH + STRIKE_GAP * 2) return [];
    startedAt = now;
    const strikes = [];
    [1.5, 2.5].forEach((stroke) => {
      hung.forEach((h, i) => {
        strikes.push({ bell: h.userData.bell, delay: i * STRIKE_GAP + stroke * SWING_HALF + CLAPPER_LAG * 0.5 });
      });
    });
    return strikes.sort((a, b) => a.delay - b.delay);
  }

  function update(now) {
    if (startedAt === null) return;
    if (mode === 'chime') {
      updateChime(now);
      return;
    }
    const t = now - startedAt;
    hung.forEach((h, i) => {
      const tau = t - i * STRIKE_GAP;
      const theta = swingAngle(tau);
      h.rotation.x = theta;
      // The clapper hangs back under gravity, lagging the bell, until the sound bow catches it
      const clapperWorld = swingAngle(tau - CLAPPER_LAG) * 1.12;
      const limit = h.userData.strikeAngle;
      h.userData.clapper.rotation.x = THREE.MathUtils.clamp(clapperWorld - theta, -limit, limit);
    });
    if (t > RING_LENGTH + STRIKE_GAP * 2) {
      hung.forEach((h) => {
        h.rotation.x = 0;
        h.userData.clapper.rotation.x = 0;
      });
      startedAt = null;
    }
  }

  setMode('swing');
  return { ring, update, setMode, isRinging: () => startedAt !== null, bells: hung };
}

// Strike tone of each bell: nominal frequency in Hz. The ring is untuned medieval and Jacobean work, so these are
// representative of bells of these diameters rather than measured.
export const BELL_NOMINAL_HZ = { 1: 830, 2: 740, 3: 660 };
