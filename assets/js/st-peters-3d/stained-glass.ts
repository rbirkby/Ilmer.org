// @ts-nocheck -- scene code ported from unchecked JavaScript; three.js calls are validated at runtime.
import { canvasTexture, makeCanvas, mulberry32 } from './canvas-utils.ts';

// Subtle mottled antique cathedral-glass luminosity & kiln-fired shading
function addAntiqueGlassMottle(ctx, w, h, seed, alpha = 0.08) {
  const rng = mulberry32(seed);
  ctx.save();
  for (let i = 0; i < 420; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = 10 + rng() * 52;
    const bright = rng() > 0.45;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, bright ? `rgba(255,252,238,${alpha})` : `rgba(26,22,18,${alpha * 0.9})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Fill weathered dressed limestone tracery surround so luminous stained glass stands out cleanly
function fillWeatheredStoneSurround(ctx, w, h, seed, baseHex = '#968b79') {
  const rng = mulberry32(seed);
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, baseHex);
  grad.addColorStop(0.5, '#a49986');
  grad.addColorStop(1, '#857a69');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle limestone mottling and mortar grain
  for (let i = 0; i < 550; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = 4 + rng() * 26;
    const tone = rng() > 0.5 ? 'rgba(235,226,205,0.065)' : 'rgba(55,48,38,0.075)';
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Helper: draw a leaded glass piece with smooth shading gradient & dark lead came outline
function drawLeadedPiece(ctx, drawPath, fillStyle, leadW = 4.5, strokeStyle = '#191716') {
  ctx.save();
  ctx.beginPath();
  drawPath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (leadW > 0) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = leadW;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

// Helper: draw a classic English stained-glass diamond quarry grid with delicate central floral rosettes
function drawDiamondQuarries(
  ctx,
  x0,
  y0,
  x1,
  y1,
  stepX,
  stepY,
  { bg = '#eef4f5', lead = '#201e1c', leadW = 3, rosette = true, tintBlue = false } = {}
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();

  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  if (tintBlue) {
    grad.addColorStop(0, '#ddecf6');
    grad.addColorStop(0.5, '#edf4f7');
    grad.addColorStop(1, '#cfe1ee');
  } else {
    grad.addColorStop(0, '#f5f8f7');
    grad.addColorStop(0.5, bg);
    grad.addColorStop(1, '#dce7e8');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // Subtle kiln-painted 4-petal rosette in each diamond cell
  if (rosette) {
    const cols = Math.ceil((x1 - x0) / stepX) + 2;
    const rows = Math.ceil((y1 - y0) / stepY) + 2;
    for (let r = -1; r < rows; r++) {
      for (let c = -1; c < cols; c++) {
        const cx = x0 + c * stepX + (r % 2 === 0 ? 0 : stepX * 0.5);
        const cy = y0 + r * stepY;
        const rad = Math.min(stepX, stepY) * 0.14;
        ctx.strokeStyle = 'rgba(72, 66, 56, 0.34)';
        ctx.fillStyle = 'rgba(225, 214, 175, 0.36)';
        ctx.lineWidth = 1.4;
        for (let k = 0; k < 4; k++) {
          const ang = (k * Math.PI) / 2;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(ang) * rad * 0.85, cy + Math.sin(ang) * rad * 0.85, rad * 0.55, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(cx, cy, rad * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(205, 172, 82, 0.45)';
        ctx.fill();
      }
    }
  }

  // Diagonal lead cames
  ctx.strokeStyle = lead;
  ctx.lineWidth = leadW;
  const spanY = y1 - y0;
  const spanX = x1 - x0;
  const slope = stepY / stepX;
  const totalDiag = spanX + spanY / slope + stepX * 2;
  for (let sx = x0 - spanY / slope - stepX; sx < x0 + totalDiag; sx += stepX) {
    ctx.beginPath();
    ctx.moveTo(sx, y0);
    ctx.lineTo(sx + spanY / slope, y1);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(sx, y1);
    ctx.lineTo(sx + spanY / slope, y0);
    ctx.stroke();
  }
  ctx.restore();
}

// Helper: draw horizontal iron saddle bars across a stained-glass light
function drawSaddleBars(ctx, x0, x1, ys, thickness = 6.5) {
  ctx.save();
  ctx.fillStyle = '#151413';
  for (const y of ys) {
    ctx.fillRect(x0 - 3, y - thickness * 0.5, x1 - x0 + 6, thickness);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x0, y - thickness * 0.5, x1 - x0, 1.5);
    ctx.fillStyle = '#151413';
  }
  ctx.restore();
}

// Helper: draw painted stained-glass head with classical medieval facial linework
function drawPaintedFace(
  ctx,
  cx,
  cy,
  rx,
  ry,
  {
    facing = 0, // -1 left, 0 front, +1 right
    beard = true,
    hairColor = '#8c6945',
    skinColor = '#f4e3ce',
    eyesClosed = false,
    tilt = 0
  } = {}
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);

  // Flowing hair back
  ctx.fillStyle = hairColor;
  ctx.strokeStyle = '#1b1816';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.ellipse(-facing * rx * 0.16, ry * 0.08, rx * 1.18, ry * 1.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Face oval
  const skinGrad = ctx.createRadialGradient(facing * rx * 0.15, -ry * 0.15, 2, 0, 0, ry * 1.15);
  skinGrad.addColorStop(0, '#fdf2e2');
  skinGrad.addColorStop(0.7, skinColor);
  skinGrad.addColorStop(1, '#d9bfa0');
  ctx.fillStyle = skinGrad;
  ctx.beginPath();
  ctx.ellipse(facing * rx * 0.12, 0, rx * 0.88, ry * 0.94, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hair crown curls
  ctx.fillStyle = hairColor;
  ctx.beginPath();
  ctx.arc(0, -ry * 0.28, rx * 0.95, Math.PI * 1.05, Math.PI * 1.95);
  ctx.quadraticCurveTo(0, -ry * 0.65, -rx * 0.9, -ry * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Painted facial features (iron-oxide vitreous glass paint)
  const fx = facing * rx * 0.22;
  ctx.strokeStyle = '#3b2b20';
  ctx.lineWidth = 2.0;
  ctx.lineCap = 'round';

  // Eyebrows & eyes
  const eyeY = -ry * 0.1;
  const eyeSpread = rx * 0.32;
  for (const side of [-1, 1]) {
    const ex = fx + side * eyeSpread;
    ctx.beginPath();
    ctx.moveTo(ex - rx * 0.16, eyeY - ry * 0.14);
    ctx.quadraticCurveTo(ex, eyeY - ry * 0.22, ex + rx * 0.16, eyeY - ry * 0.14);
    ctx.stroke();

    if (eyesClosed) {
      ctx.beginPath();
      ctx.arc(ex, eyeY, rx * 0.12, 0.15, Math.PI - 0.15);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#2d2219';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, rx * 0.08, ry * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Nose bridge
  ctx.beginPath();
  ctx.moveTo(fx, eyeY - ry * 0.04);
  ctx.lineTo(fx + facing * rx * 0.09, ry * 0.22);
  ctx.lineTo(fx - facing * rx * 0.04, ry * 0.26);
  ctx.stroke();

  // Mouth
  ctx.beginPath();
  ctx.moveTo(fx - rx * 0.18, ry * 0.44);
  ctx.quadraticCurveTo(fx, ry * 0.48, fx + rx * 0.18, ry * 0.44);
  ctx.stroke();

  // Optional soft pointed beard
  if (beard) {
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.moveTo(fx - rx * 0.65, ry * 0.22);
    ctx.quadraticCurveTo(fx - rx * 0.45, ry * 0.92, fx, ry * 1.04);
    ctx.quadraticCurveTo(fx + rx * 0.45, ry * 0.92, fx + rx * 0.65, ry * 0.22);
    ctx.quadraticCurveTo(fx, ry * 0.62, fx - rx * 0.65, ry * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2b2017';
    ctx.lineWidth = 2.0;
    ctx.stroke();
  }

  ctx.restore();
}

// Shared leaded-glass drawing kit: smooth Catmull-Rom outlines, leaded pieces, painted trace lines & hatching,
// crazy-paving quarries and leaves. `rng` drives the random hatching and leaf jitter.
function createGlassKit(ctx, rng, LEAD = '#1a1714') {
  // Smooth closed Catmull-Rom outline through points
  const smooth = (pts) => () => {
    const n = pts.length;
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];
      ctx.bezierCurveTo(
        p1[0] + (p2[0] - p0[0]) / 6,
        p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6,
        p2[1] - (p3[1] - p1[1]) / 6,
        p2[0],
        p2[1]
      );
    }
    ctx.closePath();
  };
  const polyPath = (pts) => () => {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  };
  // Glass with a soft streaky gradient between two tones
  const glass = (x0, y0, x1, y1, a, b) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    return g;
  };
  const piece = (path, fill, leadW = 3.6) => drawLeadedPiece(ctx, path, fill, leadW, LEAD);
  // Vitreous paint: fine trace lines & hatching fired onto the glass
  const paint = (lines, color = 'rgba(48,30,20,0.55)', width = 1.4) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const ln of lines) {
      ctx.beginPath();
      ctx.moveTo(ln[0][0], ln[0][1]);
      for (let i = 1; i < ln.length; i++) ctx.lineTo(ln[i][0], ln[i][1]);
      ctx.stroke();
    }
    ctx.restore();
  };
  const hatch = (x0, y0, x1, y1, n, dx, dy, color, width = 1.2) => {
    const lines = [];
    for (let i = 0; i < n; i++) {
      const x = x0 + rng() * (x1 - x0);
      const y = y0 + rng() * (y1 - y0);
      lines.push([
        [x, y],
        [x + dx * (0.6 + rng() * 0.8), y + dy * (0.6 + rng() * 0.8)]
      ]);
    }
    paint(lines, color, width);
  };
  // Crazy-paving of irregular leaded quarries (jittered grid) filling a band
  const crazyPaving = (x0, y0, x1, y1, cell, tones, seed) => {
    const r = mulberry32(seed);
    const cols = Math.ceil((x1 - x0) / cell) + 1;
    const rows = Math.ceil((y1 - y0) / (cell * 0.6)) + 1;
    const grid = [];
    for (let j = 0; j <= rows; j++) {
      grid.push([]);
      for (let i = 0; i <= cols; i++) {
        grid[j].push([
          x0 + i * cell + (r() - 0.5) * cell * 0.7 + (j % 2) * cell * 0.4,
          y0 + j * cell * 0.6 + (r() - 0.5) * cell * 0.35
        ]);
      }
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const q = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]];
        const t = tones[Math.floor(r() * tones.length)];
        piece(polyPath(q), glass(q[0][0], q[0][1], q[2][0], q[2][1], t[0], t[1]), 3.2);
      }
    }
  };
  const leaf = (x, y, len, ang, tone) => {
    piece(
      () => ctx.ellipse(x, y, len, len * 0.42, ang, 0, Math.PI * 2),
      glass(x - len, y - len, x + len, y + len, tone[0], tone[1]),
      2.6
    );
    paint(
      [
        [
          [x - Math.cos(ang) * len * 0.8, y - Math.sin(ang) * len * 0.8],
          [x + Math.cos(ang) * len * 0.8, y + Math.sin(ang) * len * 0.8]
        ]
      ],
      'rgba(20,50,25,0.55)',
      1.1
    );
  };
  const LEAVES = [
    ['#8fe08f', '#3f9f55'],
    ['#b7ec9c', '#5ab46a'],
    ['#5fc77a', '#2f8a4a'],
    ['#a4e4b4', '#46a56c']
  ];
  return { smooth, polyPath, glass, piece, paint, hatch, crazyPaving, leaf, LEAVES };
}

// =========================================================================
// 1. EAST / ALTAR WINDOW (A2) — Jesus calling Simon Peter & Andrew (1909)
//    Two ogee-cusped lights under a cusped quatrefoil, traced from the photograph:
//    heads of clear quarries edged by a red wavy ribbon with a gold crown, a white & gold canopy over a
//    blue niche, the scene, quarried lower panels with the "Follow me ..." scrolls & the Belgrove inscription.
//    Shapes are drawn in the photograph's pixel coordinates and mapped onto each light.
// =========================================================================
export function createEastStainedGlassTexture(maxAniso = 8) {
  const w = 1024;
  const h = 1536;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(1909);
  const LEAD = '#191613';
  const { smooth, polyPath, glass, piece, paint, hatch } = createGlassKit(ctx, rng, LEAD);

  fillWeatheredStoneSurround(ctx, w, h, 2011, '#928876');

  // Recessed arch moulding framing the whole window
  ctx.save();
  ctx.strokeStyle = 'rgba(42, 36, 28, 0.42)';
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(64, h - 10);
  ctx.lineTo(64, 520);
  ctx.quadraticCurveTo(100, 120, w * 0.5, 22);
  ctx.quadraticCurveTo(w - 100, 120, w - 64, 520);
  ctx.lineTo(w - 64, h - 10);
  ctx.stroke();
  ctx.restore();

  // ---- Upper cusped quatrefoil: four rounded-pointed lobes, red ribbon cross & central roundel ----
  const qx = w * 0.5;
  const qy = 190;
  const traceQuatrefoil = (R, wave = 0) => {
    ctx.beginPath();
    for (let i = 0; i <= 240; i++) {
      const t = (i / 240) * Math.PI * 2;
      const k = Math.abs(Math.cos(2 * t));
      const r = R * (0.56 + 0.36 * Math.pow(k, 0.55) + 0.08 * Math.pow(k, 10) + wave * Math.sin(t * 12));
      const x = qx + Math.cos(t) * r * 1.18;
      const y = qy + Math.sin(t) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  ctx.save();
  traceQuatrefoil(146);
  ctx.fillStyle = '#7b7161';
  ctx.fill();
  ctx.restore();
  ctx.save();
  traceQuatrefoil(130);
  ctx.clip();
  drawDiamondQuarries(ctx, qx - 170, qy - 140, qx + 170, qy + 140, 30, 38, {
    bg: '#eef5f7',
    leadW: 2.6,
    rosette: true,
    tintBlue: true
  });
  for (const [col, lw] of /** @type {[string, number][]} */ ([
    [LEAD, 18],
    ['#d02430', 11]
  ])) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    traceQuatrefoil(98, 0.025);
    ctx.stroke();
  }
  piece(
    () => ctx.arc(qx, qy, 30, 0, Math.PI * 2),
    glass(qx - 30, qy - 30, qx + 30, qy + 30, '#9cc4f0', '#3c6cc8'),
    3.4
  );
  piece(() => ctx.arc(qx, qy, 18, 0, Math.PI * 2), glass(qx - 18, qy - 18, qx + 18, qy + 18, '#fbe58a', '#d9a32a'), 3);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    paint(
      [
        [
          [qx + Math.cos(a) * 5, qy + Math.sin(a) * 5],
          [qx + Math.cos(a) * 15, qy + Math.sin(a) * 15]
        ]
      ],
      'rgba(140,80,10,0.7)',
      1.6
    );
  }
  ctx.restore();
  ctx.save();
  traceQuatrefoil(130);
  ctx.strokeStyle = '#25211c';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.restore();

  // ---- The two lights ----
  const lancetHW = 172;
  const topY = 338;
  const botY = 1482;
  // Photo y -> canvas y, piecewise so the scene gets the most room
  const KY = [
    [236, topY],
    [400, 486],
    [560, 616],
    [960, 1150],
    [1166, 1400],
    [1216, botY]
  ];
  const mapY = (py) => {
    for (let i = 1; i < KY.length; i++) {
      if (py <= KY[i][0] || i === KY.length - 1) {
        const [a0, b0] = KY[i - 1];
        const [a1, b1] = KY[i];
        return b0 + ((py - a0) / (a1 - a0)) * (b1 - b0);
      }
    }
    return py;
  };
  let pcx = 0;
  let ccx = 0;
  const SX = lancetHW / 101;
  const M = ([px, py]) => [ccx + (px - pcx) * SX, mapY(py)];
  const bbox = (pts) => {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  };
  const S = (pts, a, b = a, lw = 3.4) => {
    const m = pts.map(M);
    const [x0, y0, x1, y1] = bbox(m);
    piece(smooth(m), glass(x0, y0, x1, y1, a, b), lw);
  };
  const P = (pts, a, b = a, lw = 3.4) => {
    const m = pts.map(M);
    const [x0, y0, x1, y1] = bbox(m);
    piece(polyPath(m), glass(x0, y0, x1, y1, a, b), lw);
  };
  const L = (lines, color, width) =>
    paint(
      lines.map((ln) => ln.map(M)),
      color,
      width
    );
  const rect = (x0, y0, x1, y1, a, b = a, lw = 3.2) =>
    P(
      [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1]
      ],
      a,
      b,
      lw
    );
  // Ogee-cusped head: two small side lobes and a tall pointed ogee centre (photo offsets from the light's axis)
  const traceHead = (inset = 0) => {
    const k = 1 - inset / 101;
    const X = (dx) => ccx + dx * k * SX;
    const Y = (py) => mapY(236 + (py - 236) * 1) + inset * 0.9;
    ctx.moveTo(X(-101), botY + 20);
    ctx.lineTo(X(-101), Y(356));
    ctx.bezierCurveTo(X(-104), Y(326), X(-98), Y(300), X(-80), Y(302));
    ctx.bezierCurveTo(X(-62), Y(300), X(-46), Y(300), X(-38), Y(292));
    ctx.bezierCurveTo(X(-40), Y(262), X(-12), Y(258), X(0), Y(237));
    ctx.bezierCurveTo(X(12), Y(258), X(40), Y(262), X(38), Y(292));
    ctx.bezierCurveTo(X(46), Y(300), X(62), Y(300), X(80), Y(302));
    ctx.bezierCurveTo(X(98), Y(300), X(104), Y(326), X(101), Y(356));
    ctx.lineTo(X(101), botY + 20);
    ctx.closePath();
  };
  const skin = (pts, lw = 3) => S(pts, '#fbf0e2', '#e5c8aa', lw);
  const white = (pts, lw = 3.4) => S(pts, '#fbfbf5', '#d3d5cf', lw);
  const halo = (x, y, r) => {
    const [mx, my] = M([x, y]);
    const rr = r * SX * 0.86;
    piece(
      () => ctx.arc(mx, my, rr, 0, Math.PI * 2),
      glass(mx - rr, my - rr, mx + rr, my + rr, '#fdf6d8', '#ead489'),
      3.4
    );
    ctx.save();
    ctx.strokeStyle = 'rgba(170,120,30,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, rr - 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };
  // Face (3/4 view) with painted features, hair & optional beard
  const face = (x, y, r, { hair = '#8a5a2c', beard = true, turn = 0 } = {}) => {
    S(
      [
        [x - r * 1.05, y - r * 0.3],
        [x - r * 0.6, y - r * 1.15],
        [x + r * 0.6, y - r * 1.15],
        [x + r * 1.05, y - r * 0.3],
        [x + r, y + r * 0.9],
        [x - r, y + r * 0.9]
      ],
      hair,
      '#4a2c14',
      3
    );
    skin([
      [x - r * 0.72 + turn, y - r * 0.6],
      [x + r * 0.72 + turn, y - r * 0.6],
      [x + r * 0.7 + turn, y + r * 0.4],
      [x + turn, y + r * (beard ? 0.8 : 1.0)],
      [x - r * 0.7 + turn, y + r * 0.4]
    ]);
    if (beard)
      S(
        [
          [x - r * 0.6 + turn, y + r * 0.3],
          [x + r * 0.6 + turn, y + r * 0.3],
          [x + r * 0.4 + turn, y + r * 1.15],
          [x + turn, y + r * 1.4],
          [x - r * 0.4 + turn, y + r * 1.15]
        ],
        hair,
        '#4a2c14',
        2.6
      );
    L(
      [
        [
          [x - r * 0.45 + turn, y - r * 0.1],
          [x - r * 0.15 + turn, y - r * 0.12]
        ],
        [
          [x + r * 0.15 + turn, y - r * 0.12],
          [x + r * 0.45 + turn, y - r * 0.1]
        ],
        [
          [x + turn, y - r * 0.05],
          [x - r * 0.08 + turn, y + r * 0.3],
          [x + r * 0.06 + turn, y + r * 0.34]
        ],
        [
          [x - r * 0.2 + turn, y + r * 0.52],
          [x + r * 0.2 + turn, y + r * 0.52]
        ]
      ],
      'rgba(60,35,20,0.85)',
      1.6
    );
  };
  const netMesh = (pts) => {
    S(pts, '#e9c98a', '#b88a3c', 3);
    const m = pts.map(M);
    const [x0, y0, x1, y1] = bbox(m);
    ctx.save();
    ctx.beginPath();
    smooth(m)();
    ctx.clip();
    ctx.strokeStyle = 'rgba(90,60,20,0.7)';
    ctx.lineWidth = 1.3;
    for (let x = x0 - (y1 - y0); x < x1; x += 9) {
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x + (y1 - y0), y0);
      ctx.moveTo(x, y0);
      ctx.lineTo(x + (y1 - y0), y1);
      ctx.stroke();
    }
    ctx.restore();
  };
  const tree = (cxp, cyp, r, trunk) => {
    P(trunk, '#b07a3a', '#6a4018', 3);
    const pts = [];
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const rr = r * (0.85 + rng() * 0.25);
      pts.push([cxp + Math.cos(a) * rr, cyp + Math.sin(a) * rr * 0.9]);
    }
    S(pts, '#b8e05a', '#5e9a26', 3.4);
    const [mx, my] = M([cxp, cyp]);
    hatch(mx - r * SX * 0.8, my - r, mx + r * SX * 0.8, my + r, 70, 4, 3, 'rgba(60,90,10,0.45)', 1.6);
  };

  const lights = [
    { pc: 206, cc: 298, side: 'left' },
    { pc: 499, cc: 726, side: 'right' }
  ];
  for (const { pc, cc, side } of lights) {
    pcx = pc;
    ccx = cc;
    const x0 = pc - 101;
    const x1 = pc + 101;

    // Carved stone chamfer around the light
    ctx.save();
    ctx.beginPath();
    traceHead(-14);
    ctx.fillStyle = '#756c5d';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    traceHead(0);
    ctx.clip();

    // ---- Head: clear quarries with rosettes, red wavy ribbon & gold crown ----
    const [hx0, hy0] = M([x0, 230]);
    const [hx1, hy1] = M([x1, 440]);
    drawDiamondQuarries(ctx, hx0, hy0, hx1, hy1, 36, 46, { bg: '#f1f6f7', leadW: 2.8, rosette: true, tintBlue: true });
    for (const [col, lw] of /** @type {[string, number][]} */ ([
      [LEAD, 19],
      ['#d22430', 12]
    ])) {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      traceHead(18);
      ctx.stroke();
      ctx.restore();
    }
    // Gold crown on a short white stem
    rect(pc - 6, 392, pc + 6, 420, '#fbfbf2', '#d8d8cc', 2.6);
    P(
      [
        [pc - 30, 398],
        [pc - 34, 374],
        [pc - 18, 384],
        [pc - 9, 368],
        [pc, 382],
        [pc + 9, 368],
        [pc + 18, 384],
        [pc + 34, 374],
        [pc + 30, 398]
      ],
      '#fbe27a',
      '#d29a1e',
      3
    );
    L(
      [
        [
          [pc - 28, 392],
          [pc + 28, 392]
        ]
      ],
      'rgba(120,70,0,0.6)',
      1.6
    );

    // ---- Canopy: side shafts, battlements, gold boss & crocketed gable over a blue ogee niche ----
    P(
      [
        [x0, 420],
        [x1, 420],
        [x1, 560],
        [x0, 560]
      ],
      '#fbfaf0',
      '#dcdacb',
      3
    );
    // Battlement band
    for (let bx = x0; bx < x1; bx += 14) rect(bx, 422, bx + 8, 432, '#fbfbf4', '#d8d6c8', 2);
    rect(x0, 432, x1, 448, '#f6f2df', '#d6d0b4', 2.6);
    // Blue ogee niche behind the figures
    S(
      [
        [x0 + 14, 760],
        [x0 + 14, 560],
        [x0 + 30, 530],
        [pc - 30, 520],
        [pc, 492],
        [pc + 30, 520],
        [x1 - 30, 530],
        [x1 - 14, 560],
        [x1 - 14, 760]
      ],
      '#2a62d6',
      '#5c9ef0',
      3.6
    );
    {
      const [nx0, ny0] = M([x0 + 14, 495]);
      const [nx1, ny1] = M([x1 - 14, 760]);
      ctx.save();
      ctx.strokeStyle = 'rgba(16,40,110,0.35)';
      ctx.lineWidth = 1.6;
      for (let gy = ny0 + 10; gy < ny1; gy += 22)
        for (let gx = nx0 + 8; gx < nx1; gx += 26) {
          ctx.beginPath();
          ctx.arc(gx + ((gy / 22) % 2) * 13, gy, 7, 0.2, Math.PI * 1.5);
          ctx.stroke();
        }
      ctx.restore();
    }
    // Gable sides with gold crockets
    for (const s of [-1, 1]) {
      P(
        [
          [pc + s * 6, 470],
          [pc + s * 90, 530],
          [pc + s * 90, 542],
          [pc + s * 30, 520],
          [pc + s * 4, 494]
        ],
        '#fbfbf2',
        '#d6d4c4',
        2.8
      );
      for (let k = 0; k < 3; k++) {
        const t = 0.25 + k * 0.25;
        const [gx, gy] = [pc + s * (6 + 84 * t), 470 + 60 * t];
        S(
          [
            [gx - 8, gy - 2],
            [gx, gy - 14],
            [gx + 8, gy - 2],
            [gx, gy + 6]
          ],
          '#fbe27a',
          '#c8921c',
          2
        );
      }
    }
    // Central gold foliage boss
    S(
      [
        [pc - 32, 450],
        [pc + 32, 450],
        [pc + 30, 476],
        [pc, 498],
        [pc - 30, 476]
      ],
      '#fbe78a',
      '#d09a24',
      3
    );
    L(
      [
        [
          [pc, 452],
          [pc, 494]
        ],
        [
          [pc - 22, 460],
          [pc - 8, 474],
          [pc - 18, 488]
        ],
        [
          [pc + 22, 460],
          [pc + 8, 474],
          [pc + 18, 488]
        ]
      ],
      'rgba(130,80,10,0.7)',
      1.8
    );
    // Side shafts with gold crockets & pinnacles running down the scene
    for (const sx of [x0, x1 - 16]) {
      rect(sx, 360, sx + 16, 965, '#fbfaf0', '#d6d4c4', 3);
      for (let py = 380; py < 960; py += 42) rect(sx + 3, py, sx + 13, py + 12, '#fbe27a', '#d29a1e', 2);
      L(
        [
          [
            [sx + 8, 360],
            [sx + 8, 965]
          ]
        ],
        'rgba(120,110,90,0.35)',
        1
      );
    }

    // ---- Scene: shore, sky glimpse & water below the niche ----
    S(
      [
        [x0 + 14, 690],
        [pc, 676],
        [x1 - 14, 690],
        [x1 - 14, 960],
        [x0 + 14, 960]
      ],
      '#cfe7c0',
      '#9ccf8a',
      3.4
    );
    rect(x0 + 14, 680, x1 - 14, 700, '#76c056', '#3e8e30', 3);

    if (side === 'left') {
      tree(150, 610, 30, [
        [131, 630],
        [140, 630],
        [142, 770],
        [130, 770]
      ]);
      P(
        [
          [280, 690],
          [288, 690],
          [292, 770],
          [282, 770]
        ],
        '#b07a3a',
        '#6a4018',
        3
      );
      // Blue boat hull & brown gunwale in the lower left, net over the side
      S(
        [
          [x0 + 14, 800],
          [150, 800],
          [215, 880],
          [240, 950],
          [x0 + 14, 960]
        ],
        '#3a5cb0',
        '#14265e'
      );
      S(
        [
          [124, 786],
          [152, 786],
          [176, 830],
          [160, 842],
          [128, 814]
        ],
        '#d49a52',
        '#8a5420',
        3
      );
      netMesh([
        [212, 880],
        [300, 882],
        [x1 - 14, 950],
        [222, 958]
      ]);
      // Christ: white robe, red cloak over the left shoulder with gold lining, hands gesturing
      halo(230, 582, 36);
      white([
        [190, 616],
        [268, 612],
        [282, 700],
        [290, 820],
        [294, 888],
        [190, 892],
        [188, 760]
      ]);
      L(
        [
          [
            [218, 760],
            [214, 886]
          ],
          [
            [246, 760],
            [248, 886]
          ],
          [
            [272, 760],
            [278, 884]
          ]
        ],
        'rgba(90,95,90,0.45)',
        1.6
      );
      S(
        [
          [196, 612],
          [218, 616],
          [252, 680],
          [272, 740],
          [262, 800],
          [214, 800],
          [176, 760],
          [168, 690]
        ],
        '#f6462e',
        '#a81414'
      );
      S(
        [
          [166, 690],
          [180, 692],
          [184, 760],
          [170, 772]
        ],
        '#fbe27a',
        '#d29a1e',
        2.6
      );
      L(
        [
          [
            [210, 660],
            [224, 790]
          ],
          [
            [236, 690],
            [248, 794]
          ]
        ],
        'rgba(70,0,0,0.45)',
        2
      );
      // Raised right hand (viewer's right)
      white([
        [254, 620],
        [282, 640],
        [286, 660],
        [262, 668],
        [246, 640]
      ]);
      skin([
        [280, 618],
        [292, 612],
        [300, 630],
        [292, 648],
        [280, 644]
      ]);
      // Left arm outstretched to the boat
      white([
        [194, 626],
        [196, 650],
        [150, 660],
        [140, 642]
      ]);
      skin([
        [118, 636],
        [142, 634],
        [148, 652],
        [124, 656]
      ]);
      face(230, 584, 18, { hair: '#9a6a34', beard: true, turn: -2 });
      // Bare feet below the hem
      for (const fx of [214, 260])
        skin(
          [
            [fx - 14, 884],
            [fx + 14, 882],
            [fx + 16, 896],
            [fx - 14, 898]
          ],
          2.4
        );
    } else {
      tree(450, 596, 34, [
        [418, 620],
        [430, 620],
        [436, 750],
        [416, 750]
      ]);
      // Water & boat edge on the right, the net hauled up over it
      S(
        [
          [536, 880],
          [x1 - 14, 870],
          [x1 - 14, 960],
          [540, 960]
        ],
        '#2a52b0',
        '#10245e'
      );
      // Andrew, standing behind in blue, leaning to the net
      S(
        [
          [470, 650],
          [530, 660],
          [568, 720],
          [584, 800],
          [586, 890],
          [520, 900],
          [470, 840],
          [454, 720]
        ],
        '#3858c8',
        '#101e6a'
      );
      L(
        [
          [
            [500, 700],
            [520, 890]
          ],
          [
            [540, 700],
            [560, 880]
          ]
        ],
        'rgba(0,0,30,0.5)',
        2
      );
      white([
        [548, 700],
        [570, 700],
        [584, 760],
        [580, 860],
        [566, 862],
        [560, 770]
      ]);
      skin([
        [560, 856],
        [582, 856],
        [584, 880],
        [562, 882]
      ]);
      halo(496, 632, 32);
      face(496, 634, 16, { hair: '#7a5030', beard: true, turn: -2 });
      // Peter, kneeling in front in red, hauling the net
      S(
        [
          [432, 740],
          [490, 746],
          [530, 780],
          [548, 860],
          [544, 905],
          [420, 908],
          [404, 850],
          [410, 780]
        ],
        '#e8343a',
        '#8a0e1c'
      );
      L(
        [
          [
            [440, 790],
            [450, 900]
          ],
          [
            [480, 780],
            [500, 900]
          ],
          [
            [520, 800],
            [530, 900]
          ]
        ],
        'rgba(60,0,10,0.5)',
        2.2
      );
      white([
        [500, 770],
        [524, 770],
        [552, 840],
        [570, 890],
        [556, 900],
        [530, 860]
      ]);
      white([
        [412, 790],
        [430, 790],
        [436, 870],
        [420, 880]
      ]);
      skin([
        [556, 888],
        [578, 886],
        [582, 906],
        [560, 910]
      ]);
      halo(506, 722, 32);
      face(506, 724, 16, { hair: '#6a4426', beard: true, turn: 2 });
      netMesh([
        [404, 902],
        [500, 896],
        [548, 900],
        [550, 952],
        [404, 958]
      ]);
    }

    // ---- Lower panel: crenellated base, quarries with rosettes, red edge stripes & the scroll ----
    rect(x0, 960, x1, 986, '#fbfaf0', '#d8d6c6', 3.2);
    for (let bx = x0 + 4; bx < x1; bx += 16) rect(bx, 962, bx + 9, 972, '#f0ecd8', '#cbc4a6', 1.8);
    {
      const [lx0, ly0] = M([x0, 986]);
      const [lx1, ly1] = M([x1, 1166]);
      drawDiamondQuarries(ctx, lx0, ly0, lx1, ly1, 36, 44, {
        bg: '#f1f6f7',
        leadW: 2.8,
        rosette: true,
        tintBlue: true
      });
    }
    rect(x0 + 10, 986, x0 + 18, 1166, '#e8343a', '#9a1018', 2.6);
    rect(x1 - 18, 986, x1 - 10, 1166, '#e8343a', '#9a1018', 2.6);
    rect(x0, 986, x0 + 10, 1166, '#fbfaf0', '#d8d6c6', 2.6);
    rect(x1 - 10, 986, x1, 1166, '#fbfaf0', '#d8d6c6', 2.6);
    // Scroll with gold turned-back ends
    for (const s of [-1, 1]) {
      const ex = s < 0 ? x0 + 6 : x1 - 6;
      P(
        [
          [ex, 1070],
          [ex - s * 24, 1066],
          [ex - s * 24, 1102],
          [ex, 1104],
          [ex + s * 2, 1088]
        ],
        '#fbe27a',
        '#c8921c',
        2.6
      );
    }
    S(
      [
        [x0 + 10, 1068],
        [pc, 1062],
        [x1 - 10, 1068],
        [x1 - 14, 1098],
        [pc, 1092],
        [x0 + 14, 1098]
      ],
      '#fbfbf4',
      '#e2e0d2',
      3.2
    );
    {
      const [tx, ty] = M([pc, 1081]);
      ctx.save();
      ctx.fillStyle = '#1e1a16';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let fs = 30;
      const text = side === 'left' ? 'Follow me and I will' : 'make you fishers of men';
      ctx.font = `italic ${fs}px 'Palatino Linotype', Georgia, serif`;
      while (ctx.measureText(text).width > lancetHW * 2 - 70) {
        fs -= 1;
        ctx.font = `italic ${fs}px 'Palatino Linotype', Georgia, serif`;
      }
      ctx.fillText(text, tx, ty);
      ctx.restore();
    }

    // ---- Inscription: red band over two pale gold panels ----
    rect(x0, 1162, x1, 1172, '#e8343a', '#9a1018', 2.6);
    const lines =
      side === 'left'
        ? [
            ['To the glory of', 'God and in memory'],
            ['organist of this', 'Church, died 1909']
          ]
        : [
            ['Martha Belgrove', 'for many years'],
            ['erected by Parishioners', 'and friends']
          ];
    const split = side === 'left' ? 0.48 : 0.56;
    const xm = x0 + (x1 - x0) * split;
    rect(x0, 1172, xm, 1222, '#fbeeb0', '#e8cc6a', 3.4);
    rect(xm, 1172, x1, 1222, '#fbeeb0', '#e8cc6a', 3.4);
    ctx.save();
    ctx.fillStyle = '#2a2014';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [col, xa, xb] of [
      [0, x0, xm],
      [1, xm, x1]
    ]) {
      const [ax] = M([xa, 0]);
      const [bx] = M([xb, 0]);
      let fs = 22;
      ctx.font = `italic ${fs}px Georgia, serif`;
      while (Math.max(ctx.measureText(lines[0][col]).width, ctx.measureText(lines[1][col]).width) > bx - ax - 14) {
        fs -= 0.5;
        ctx.font = `italic ${fs}px Georgia, serif`;
      }
      ctx.fillText(lines[0][col], (ax + bx) * 0.5, mapY(1182));
      ctx.fillText(lines[1][col], (ax + bx) * 0.5, mapY(1203));
    }
    ctx.restore();

    // Saddle bars as in the photograph
    drawSaddleBars(ctx, M([x0, 0])[0], M([x1, 0])[0], [440, 560, 682, 800, 960, 1060, 1166].map(mapY), 5.5);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    traceHead(0);
    ctx.strokeStyle = '#1d1a17';
    ctx.lineWidth = 7.5;
    ctx.stroke();
    ctx.restore();
  }

  addAntiqueGlassMottle(ctx, w, h, 1997, 0.06);
  return canvasTexture(c, { anisotropy: maxAniso });
}

// =========================================================================
// 2. SOUTH NAVE "SOWER" WINDOW (A1) — 1991, given by Patricia & John Maude
//    Redrawn from Richard's photograph of the glass (2026). Two pointed lights either side of a broad plain mullion,
//    each with an outer border of alternating cobalt & amber squares and an iron saddle bar across the middle.
//    Left light: the haloed, barefoot Sower in a blue robe with a yellow-and-maroon cloak, scattering seed from a bowl,
//      before a cornfield, a leafy tree and a timber barn under a pink sky, with two small birds on the brown earth.
//    Right light: a white cow above a pink cow, a leafy bough, two horned sheep, a grey goose, a cockerel and a white
//      goose pecking on the brown earth, before the same barn.
// =========================================================================
export function createSowerStainedGlassTexture(maxAniso = 8) {
  const w = 1024;
  const h = 1180;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(1991);

  fillWeatheredStoneSurround(ctx, w, h, 1991, '#948a78');

  const topApexY = 38;
  const springY = 378;
  const botY = 1134;
  const xMidL = 446;
  const xMidR = 578;
  const xOuterL = 56;
  const xOuterR = w - 56;
  const barY = 556;
  const captionY = 1084;
  const LEAD = '#1a1714';

  const traceLeftLight = () => {
    ctx.moveTo(xOuterL, botY);
    ctx.lineTo(xOuterL, springY);
    ctx.quadraticCurveTo(xOuterL + 84, 152, xMidL, topApexY + 18);
    ctx.lineTo(xMidL, botY);
    ctx.closePath();
  };
  const traceRightLight = () => {
    ctx.moveTo(xMidR, botY);
    ctx.lineTo(xMidR, topApexY + 18);
    ctx.quadraticCurveTo(xOuterR - 84, 152, xOuterR, springY);
    ctx.lineTo(xOuterR, botY);
    ctx.closePath();
  };

  const { smooth, polyPath, glass, piece, paint, hatch, crazyPaving, leaf, LEAVES } = createGlassKit(ctx, rng, LEAD);

  // A leafy bough: dark twig with leaves alternating along it
  const bough = (pts, len, density = 1) => {
    paint([pts], '#2a221a', 5.5);
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const segLen = Math.hypot(bx - ax, by - ay);
      const ang = Math.atan2(by - ay, bx - ax);
      const count = Math.max(1, Math.round((segLen / (len * 1.3)) * density));
      for (let k = 0; k < count; k++) {
        const t = (k + 0.5) / count;
        const side = (k + i) % 2 ? 1 : -1;
        const la = ang + side * (0.7 + rng() * 0.4);
        leaf(
          ax + (bx - ax) * t + Math.cos(la) * len * 0.9,
          ay + (by - ay) * t + Math.sin(la) * len * 0.9,
          len * (0.8 + rng() * 0.35),
          la,
          LEAVES[Math.floor(rng() * LEAVES.length)]
        );
      }
    }
  };
  // Alternating cobalt & amber border squares down the outer edge of a light
  const border = (bx) => {
    const bw = 22;
    const step = 30;
    let k = 0;
    for (let y = springY - 30; y < captionY; y += step, k++) {
      piece(
        polyPath([
          [bx, y],
          [bx + bw, y],
          [bx + bw, Math.min(y + step, captionY)],
          [bx, Math.min(y + step, captionY)]
        ]),
        k % 2
          ? glass(bx, y, bx + bw, y + step, '#f6d79a', '#e2ae62')
          : glass(bx, y, bx + bw, y + step, '#4f8fff', '#1f55d8'),
        3
      );
    }
  };
  // Timber barn: grey tiled roof, salmon tie-beam, posts & braces against the pink sky
  const barn = (x0, x1, postXs) => {
    piece(
      polyPath([
        [x0, 150],
        [x1, 150],
        [x1, 214],
        [x0, 214]
      ]),
      glass(x0, 150, x0, 214, '#e8eaec', '#b9bcc2'),
      3.4
    );
    const tiles = [];
    for (let y = 164; y < 214; y += 14)
      tiles.push([
        [x0, y],
        [x1, y]
      ]);
    for (let x = x0 + 8; x < x1; x += 22)
      tiles.push([
        [x, 150],
        [x + 4, 214]
      ]);
    paint(tiles, 'rgba(60,62,70,0.45)', 1.1);
    piece(
      polyPath([
        [x0, 214],
        [x1, 214],
        [x1, 236],
        [x0, 236]
      ]),
      glass(x0, 214, x0, 236, '#f0a184', '#c86c55'),
      3.4
    );
    for (const px of postXs) {
      piece(
        polyPath([
          [px - 11, 236],
          [px + 11, 236],
          [px + 11, 340],
          [px - 11, 340]
        ]),
        glass(px - 11, 236, px + 11, 236, '#f2a68a', '#c4644e'),
        3.2
      );
      for (const s of [-1, 1]) {
        piece(
          polyPath([
            [px + s * 11, 262],
            [px + s * 11, 282],
            [px + s * 62, 236],
            [px + s * 40, 236]
          ]),
          glass(px, 236, px + s * 60, 280, '#eea086', '#c86a52'),
          3
        );
      }
      paint(
        [
          [
            [px - 4, 246],
            [px - 2, 330]
          ],
          [
            [px + 5, 250],
            [px + 4, 334]
          ]
        ],
        'rgba(90,40,30,0.45)',
        1.2
      );
    }
  };
  // Pink-mauve evening sky of streaky glass pieces
  const pinkSky = (x0, x1, y0, y1) => {
    const tones = [
      ['#f3b9dd', '#d98bc2'],
      ['#e7a2d0', '#c77ab5'],
      ['#f8cfe6', '#e3a2cf'],
      ['#d690c6', '#b86aa6']
    ];
    let y = y0;
    let k = 0;
    while (y < y1) {
      const hh = 22 + rng() * 20;
      const tilt = (rng() - 0.5) * 24;
      const t = tones[k++ % tones.length];
      piece(
        polyPath([
          [x0 - 10, y],
          [x1 + 10, y + tilt],
          [x1 + 10, y + tilt + hh],
          [x0 - 10, y + hh]
        ]),
        glass(x0, y, x1, y + hh, t[0], t[1]),
        3
      );
      hatch(x0, y + 4, x1, y + hh - 4, 10, 40, 1, 'rgba(120,50,100,0.25)');
      y += hh;
    }
  };
  const caption = (x0, x1, text, size) => {
    piece(
      polyPath([
        [x0, captionY],
        [x1, captionY],
        [x1, botY],
        [x0, botY]
      ]),
      glass(x0, captionY, x1, botY, '#fbf3d6', '#efdfae'),
      4
    );
    ctx.save();
    ctx.fillStyle = '#2c2014';
    ctx.font = `italic ${size}px Georgia, 'Times New Roman', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, (x0 + x1) * 0.5, (captionY + botY) * 0.5 + 1);
    ctx.restore();
  };
  const EARTH = [
    ['#d8906a', '#b4603e'],
    ['#c97a55', '#9e4e32'],
    ['#e2a37c', '#c0704c'],
    ['#b8683f', '#8e4429'],
    ['#dca088', '#b97456']
  ];
  const cornfield = (x0, x1, y0, y1) => {
    piece(
      polyPath([
        [x0, y0],
        [x1, y0 - 18],
        [x1, y1],
        [x0, y1]
      ]),
      glass(x0, y0, x0, y1, '#f3dca8', '#d9b77a'),
      3.2
    );
    const stalks = [];
    for (let i = 0; i < 70; i++) {
      const x = x0 + rng() * (x1 - x0);
      const y = y0 + rng() * (y1 - y0);
      stalks.push([
        [x, y],
        [x + (rng() - 0.5) * 6, y - 22 - rng() * 14]
      ]);
    }
    paint(stalks, 'rgba(120,80,30,0.5)', 1.3);
  };
  const grass = (path, x0, y0, x1, y1) => {
    piece(path, glass(x0, y0, x0, y1, '#b8ec8c', '#5fb64e'), 3.2);
    const blades = [];
    for (let i = 0; i < 90; i++) {
      const x = x0 + rng() * (x1 - x0);
      const y = y0 + rng() * (y1 - y0);
      blades.push([
        [x, y],
        [x + (rng() - 0.5) * 10, y - 16 - rng() * 18]
      ]);
    }
    paint(blades, 'rgba(30,80,30,0.45)', 1.2);
  };
  const sky = (x0, x1) =>
    piece(
      polyPath([
        [x0, 0],
        [x1, 0],
        [x1, 150],
        [x0, 150]
      ]),
      glass(x0, 0, x1, 150, '#cfe6fb', '#8fbbe8'),
      0
    );

  // =========================
  // LEFT LIGHT: THE SOWER
  // =========================
  ctx.save();
  ctx.beginPath();
  traceLeftLight();
  ctx.clip();

  sky(xOuterL, xMidL);
  pinkSky(xOuterL, xMidL, 236, 420);
  barn(xOuterL + 40, xMidL + 20, [xOuterL + 120, xMidL - 70]);
  // Tree trunk rising behind the Sower's right shoulder into leafy boughs along the arch
  piece(
    polyPath([
      [372, 560],
      [392, 560],
      [404, 300],
      [432, 120],
      [418, 116],
      [386, 290]
    ]),
    glass(372, 120, 432, 560, '#d9e2ec', '#a5b3c4'),
    3.2
  );
  bough(
    [
      [430, 70],
      [380, 120],
      [320, 170],
      [250, 186]
    ],
    20
  );
  bough(
    [
      [440, 210],
      [400, 260],
      [380, 330]
    ],
    18
  );
  bough(
    [
      [xOuterL + 10, 360],
      [xOuterL + 60, 300],
      [xOuterL + 120, 260]
    ],
    16,
    0.8
  );
  // A small bird in flight under the arch
  piece(
    smooth([
      [330, 92],
      [356, 84],
      [372, 96],
      [352, 104]
    ]),
    '#f6f0dc',
    2.6
  );

  cornfield(xOuterL, xMidL, 420, 560);
  grass(
    polyPath([
      [xOuterL, 560],
      [xMidL, 540],
      [xMidL, 900],
      [xOuterL, 930]
    ]),
    xOuterL,
    560,
    xMidL,
    900
  );
  crazyPaving(xOuterL - 20, 880, xMidL + 20, captionY + 20, 62, EARTH, 711);

  // Two little yellow-green birds pecking seed on the earth
  const finch = (bx, by, dir) => {
    piece(
      smooth([
        [bx - dir * 26, by + 2],
        [bx - dir * 6, by - 12],
        [bx + dir * 18, by - 8],
        [bx + dir * 24, by + 4],
        [bx, by + 10]
      ]),
      glass(bx - 20, by - 10, bx + 20, by + 10, '#f2e27a', '#9cc451'),
      2.6
    );
    piece(
      polyPath([
        [bx - dir * 22, by],
        [bx - dir * 44, by - 6],
        [bx - dir * 40, by + 6]
      ]),
      '#8a9a3c',
      2.4
    );
    paint(
      [
        [
          [bx + dir * 24, by + 2],
          [bx + dir * 32, by + 6]
        ],
        [
          [bx - dir * 6, by - 4],
          [bx + dir * 10, by - 2]
        ]
      ],
      'rgba(40,30,20,0.6)',
      1.4
    );
  };
  finch(160, 1000, 1);
  finch(372, 1046, -1);

  // ---- The Sower ----
  // Maroon cloak streaming behind from the shoulders down to the knee
  piece(
    smooth([
      [300, 410],
      [356, 430],
      [392, 560],
      [412, 700],
      [430, 780],
      [380, 760],
      [330, 640],
      [300, 520]
    ]),
    glass(300, 420, 420, 780, '#c46d8a', '#7d3150'),
    3.6
  );
  piece(
    smooth([
      [178, 420],
      [206, 470],
      [196, 600],
      [170, 640],
      [150, 560]
    ]),
    glass(150, 420, 210, 640, '#b55a7a', '#7a2f4c'),
    3.4
  );
  paint(
    [
      [
        [340, 470],
        [380, 640],
        [404, 740]
      ],
      [
        [320, 520],
        [350, 660]
      ]
    ],
    'rgba(60,15,30,0.5)',
    1.6
  );
  // Blue robe (under-tunic)
  piece(
    smooth([
      [206, 420],
      [300, 418],
      [318, 520],
      [324, 640],
      [348, 760],
      [360, 850],
      [300, 872],
      [214, 870],
      [190, 760],
      [204, 600],
      [196, 500]
    ]),
    glass(200, 420, 360, 870, '#6f9ef0', '#3466c8'),
    3.8
  );
  // Paler blue over-skirt draped across the hips & gathered at the right hand
  piece(
    smooth([
      [232, 560],
      [300, 548],
      [334, 640],
      [356, 780],
      [338, 840],
      [282, 846],
      [236, 790],
      [222, 680]
    ]),
    glass(230, 560, 350, 840, '#b9d3fb', '#7fa6ea'),
    3.4
  );
  paint(
    [
      [
        [248, 600],
        [270, 700],
        [276, 830]
      ],
      [
        [290, 590],
        [316, 700],
        [326, 820]
      ],
      [
        [236, 700],
        [250, 790]
      ],
      [
        [212, 520],
        [208, 640]
      ],
      [
        [300, 450],
        [306, 540]
      ]
    ],
    'rgba(20,35,80,0.5)',
    1.6
  );
  // Yellow cloak over the shoulders
  piece(
    smooth([
      [190, 410],
      [236, 388],
      [282, 384],
      [334, 404],
      [352, 442],
      [310, 432],
      [262, 446],
      [214, 452],
      [184, 470]
    ]),
    glass(190, 386, 350, 470, '#fbe39a', '#e0b24e'),
    3.4
  );
  paint(
    [
      [
        [220, 420],
        [256, 414],
        [300, 420]
      ],
      [
        [236, 440],
        [280, 432]
      ]
    ],
    'rgba(120,80,20,0.5)',
    1.4
  );
  // Sower's right arm (viewer's left) swinging down to scatter seed, hand open at the hip
  piece(
    smooth([
      [196, 450],
      [218, 458],
      [222, 560],
      [236, 612],
      [214, 620],
      [196, 560]
    ]),
    glass(196, 450, 236, 620, '#f6e3c8', '#dcbb94'),
    3
  );
  piece(
    smooth([
      [222, 602],
      [252, 600],
      [262, 622],
      [240, 640],
      [220, 630]
    ]),
    '#f3dcbd',
    2.8
  );
  paint(
    [
      [
        [232, 612],
        [256, 614]
      ],
      [
        [234, 622],
        [254, 628]
      ]
    ],
    'rgba(90,55,35,0.55)',
    1.1
  );
  // Seed bowl carried in the crook of the left arm
  piece(
    smooth([
      [290, 474],
      [372, 456],
      [382, 476],
      [352, 510],
      [304, 514],
      [286, 494]
    ]),
    glass(290, 460, 380, 512, '#f6edd6', '#d6c39c'),
    3.4
  );
  piece(
    smooth([
      [296, 474],
      [336, 458],
      [376, 458],
      [340, 474]
    ]),
    glass(296, 456, 376, 476, '#f2d36a', '#c9a23a'),
    2.6
  );
  hatch(306, 460, 370, 472, 26, 2, 2, 'rgba(110,70,10,0.6)', 1.6);
  piece(
    smooth([
      [304, 500],
      [340, 494],
      [350, 512],
      [312, 520]
    ]),
    '#f3dcbd',
    2.6
  );
  // Neck, halo & head turned slightly to the left
  piece(
    polyPath([
      [240, 372],
      [262, 372],
      [264, 396],
      [238, 396]
    ]),
    '#f2dcc0',
    2.6
  );
  const hx = 250;
  const hy = 326;
  piece(
    () => ctx.arc(hx, hy, 58, 0, Math.PI * 2),
    glass(hx - 58, hy - 58, hx + 58, hy + 58, '#fff6f4', '#f2c6d0'),
    3.4
  );
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    paint(
      [
        [
          [hx + Math.cos(a) * 40, hy + Math.sin(a) * 40],
          [hx + Math.cos(a) * 56, hy + Math.sin(a) * 56]
        ]
      ],
      'rgba(200,70,90,0.55)',
      2
    );
  }
  // Red cross-nimbus arms
  for (const [dx, dy] of [
    [0, -1],
    [-1, 0],
    [1, 0]
  ]) {
    piece(
      polyPath([
        [hx + dx * 34 - dy * 9, hy + dy * 34 - dx * 9],
        [hx + dx * 57 - dy * 9, hy + dy * 57 - dx * 9],
        [hx + dx * 57 + dy * 9, hy + dy * 57 + dx * 9],
        [hx + dx * 34 + dy * 9, hy + dy * 34 + dx * 9]
      ]),
      glass(hx - 50, hy - 50, hx + 50, hy + 50, '#f07c8e', '#c43a52'),
      2.6
    );
  }
  drawPaintedFace(ctx, hx - 2, hy + 6, 27, 34, {
    facing: -0.35,
    beard: false,
    hairColor: '#ddd0b8',
    skinColor: '#f6e6d4'
  });
  // Bare feet striding over the furrows
  piece(
    smooth([
      [214, 866],
      [236, 868],
      [230, 912],
      [176, 922],
      [150, 918],
      [170, 902],
      [208, 896]
    ]),
    glass(150, 866, 236, 922, '#f6e2c8', '#d8b48c'),
    3
  );
  piece(
    smooth([
      [330, 866],
      [354, 864],
      [362, 930],
      [390, 948],
      [352, 952],
      [334, 930]
    ]),
    glass(330, 864, 390, 952, '#f6e2c8', '#d8b48c'),
    3
  );
  paint(
    [
      [
        [160, 912],
        [196, 908]
      ],
      [
        [356, 936],
        [380, 944]
      ]
    ],
    'rgba(100,60,40,0.5)',
    1.2
  );

  border(xOuterL);
  drawSaddleBars(ctx, xOuterL, xMidL, [barY], 7);
  caption(xOuterL, xMidL, 'The Sower Soweth the Word', 27);
  ctx.restore();

  // =========================
  // RIGHT LIGHT: THE FARMYARD
  // =========================
  ctx.save();
  ctx.beginPath();
  traceRightLight();
  ctx.clip();

  sky(xMidR, xOuterR);
  pinkSky(xMidR, xOuterR, 236, 470);
  barn(xMidR - 20, xOuterR - 40, [xMidR + 100, xOuterR - 110]);
  cornfield(xMidR, xOuterR, 470, 600);
  grass(
    polyPath([
      [xMidR, 600],
      [xOuterR, 590],
      [xOuterR, 900],
      [xMidR, 900]
    ]),
    xMidR,
    600,
    xOuterR,
    900
  );
  crazyPaving(xMidR - 20, 870, xOuterR + 20, captionY + 20, 62, EARTH, 1991);

  // Leafy boughs framing the light: across the arch, down the left side and up the right edge
  bough(
    [
      [xMidR + 4, 330],
      [xMidR + 40, 220],
      [xMidR + 110, 130],
      [xMidR + 220, 90],
      [xOuterR - 60, 150]
    ],
    20
  );
  bough(
    [
      [xMidR + 10, 120],
      [xMidR + 60, 60],
      [xMidR + 120, 34]
    ],
    18
  );
  bough(
    [
      [xOuterR - 30, 640],
      [xOuterR - 26, 520],
      [xOuterR - 50, 400],
      [xOuterR - 90, 300]
    ],
    16,
    0.9
  );

  // White cow above, facing left with short horns
  const cowBody = (pts, tone) =>
    piece(smooth(pts), glass(pts[0][0], pts[0][1], pts[3][0], pts[3][1], tone[0], tone[1]), 3.6);
  cowBody(
    [
      [650, 330],
      [760, 318],
      [900, 322],
      [946, 360],
      [930, 410],
      [860, 420],
      [720, 418],
      [660, 396]
    ],
    ['#fbfaf4', '#d9d6cc']
  );
  paint(
    [
      [
        [760, 330],
        [770, 400]
      ],
      [
        [870, 334],
        [890, 400]
      ],
      [
        [700, 406],
        [880, 412]
      ]
    ],
    'rgba(90,90,80,0.4)',
    1.4
  );
  piece(
    smooth([
      [604, 300],
      [646, 292],
      [674, 312],
      [672, 350],
      [652, 380],
      [626, 380],
      [608, 350]
    ]),
    glass(604, 292, 674, 380, '#ffffff', '#dcd8cc'),
    3.4
  );
  for (const s of [-1, 1]) {
    piece(
      smooth([
        [639 + s * 22, 300],
        [639 + s * 34, 282],
        [639 + s * 30, 300]
      ]),
      '#f0d98a',
      2.4
    );
  }
  paint(
    [
      [
        [626, 326],
        [632, 328]
      ],
      [
        [648, 326],
        [654, 328]
      ],
      [
        [626, 368],
        [652, 368]
      ]
    ],
    'rgba(40,30,25,0.7)',
    1.8
  );
  // Pink cow in front, head raised to the left
  cowBody(
    [
      [640, 440],
      [760, 420],
      [900, 424],
      [952, 470],
      [930, 530],
      [880, 540],
      [740, 536],
      [656, 500]
    ],
    ['#f6b9a8', '#d9826e']
  );
  for (const lx of [690, 728, 880, 918]) {
    piece(
      polyPath([
        [lx - 11, 520],
        [lx + 11, 520],
        [lx + 9, 610],
        [lx - 9, 610]
      ]),
      glass(lx, 520, lx, 610, '#f0ad98', '#c9705c'),
      3
    );
  }
  piece(
    smooth([
      [596, 396],
      [632, 382],
      [668, 404],
      [676, 446],
      [650, 470],
      [612, 462],
      [592, 430]
    ]),
    glass(592, 382, 676, 470, '#fcc8b8', '#e28f7a'),
    3.4
  );
  paint(
    [
      [
        [618, 414],
        [624, 416]
      ],
      [
        [604, 446],
        [624, 452]
      ],
      [
        [760, 440],
        [790, 520]
      ],
      [
        [840, 446],
        [860, 520]
      ]
    ],
    'rgba(110,40,30,0.5)',
    1.5
  );
  // Bough sweeping diagonally across in front of the cows
  bough(
    [
      [xMidR, 640],
      [660, 560],
      [760, 520],
      [880, 500],
      [xOuterR, 470]
    ],
    18,
    0.9
  );

  // Two horned sheep, heads to the right
  const sheep = (bx, by, scale) => {
    piece(
      smooth([
        [bx - 120 * scale, by],
        [bx - 60 * scale, by - 40 * scale],
        [bx + 40 * scale, by - 42 * scale],
        [bx + 90 * scale, by - 10 * scale],
        [bx + 80 * scale, by + 40 * scale],
        [bx - 40 * scale, by + 50 * scale],
        [bx - 120 * scale, by + 36 * scale]
      ]),
      glass(bx - 120, by - 40, bx + 90, by + 50, '#fdfbf2', '#ddd6c4'),
      3.6
    );
    const curls = [];
    for (let k = 0; k < 18; k++) {
      const x = bx - 100 * scale + rng() * 170 * scale;
      const y = by - 30 * scale + rng() * 70 * scale;
      curls.push([
        [x, y],
        [x + 5, y - 3],
        [x + 8, y + 2]
      ]);
    }
    paint(curls, 'rgba(110,100,80,0.45)', 1.3);
    piece(
      smooth([
        [bx + 70 * scale, by - 30 * scale],
        [bx + 112 * scale, by - 24 * scale],
        [bx + 130 * scale, by + 14 * scale],
        [bx + 110 * scale, by + 40 * scale],
        [bx + 82 * scale, by + 22 * scale]
      ]),
      glass(bx + 70, by - 30, bx + 130, by + 40, '#fbf6ea', '#d8cfbb'),
      3.2
    );
    piece(() => ctx.arc(bx + 86 * scale, by - 16 * scale, 16 * scale, 0, Math.PI * 2), '#e8cf86', 2.6);
    paint(
      [
        [
          [bx + 80 * scale, by - 18 * scale],
          [bx + 88 * scale, by - 10 * scale],
          [bx + 94 * scale, by - 20 * scale]
        ],
        [
          [bx + 112 * scale, by + 2 * scale],
          [bx + 118 * scale, by + 4 * scale]
        ]
      ],
      'rgba(70,50,30,0.6)',
      1.5
    );
    for (const lx of [-80, -40, 30, 60]) {
      piece(
        polyPath([
          [bx + lx * scale - 7, by + 40 * scale],
          [bx + lx * scale + 7, by + 40 * scale],
          [bx + lx * scale + 6, by + 86 * scale],
          [bx + lx * scale - 6, by + 86 * scale]
        ]),
        '#efe8d8',
        2.6
      );
    }
  };
  sheep(716, 672, 0.95);
  sheep(812, 652, 0.82);

  // Grey goose behind the cockerel, long neck raised
  piece(
    smooth([
      [690, 740],
      [740, 770],
      [830, 772],
      [880, 800],
      [820, 830],
      [720, 820],
      [680, 790]
    ]),
    glass(680, 740, 880, 830, '#c9d4e6', '#8394b4'),
    3.4
  );
  piece(
    smooth([
      [676, 700],
      [692, 694],
      [704, 760],
      [688, 790],
      [676, 760]
    ]),
    glass(676, 694, 704, 790, '#d6dfee', '#9aa8c4'),
    3
  );
  piece(
    polyPath([
      [676, 702],
      [656, 712],
      [678, 714]
    ]),
    '#e8a048',
    2.4
  );

  // Cockerel: red comb & wattle, golden hackles, chestnut body and a sweep of green tail feathers
  piece(
    smooth([
      [828, 820],
      [880, 776],
      [920, 784],
      [930, 840],
      [900, 880],
      [846, 870]
    ]),
    glass(828, 776, 930, 880, '#6fc06a', '#1f6a3a'),
    3.4
  );
  paint(
    [
      [
        [846, 850],
        [890, 790]
      ],
      [
        [862, 862],
        [912, 800]
      ],
      [
        [880, 870],
        [924, 820]
      ]
    ],
    'rgba(10,50,20,0.6)',
    1.8
  );
  piece(
    smooth([
      [736, 860],
      [790, 840],
      [856, 846],
      [880, 880],
      [850, 930],
      [780, 940],
      [742, 910]
    ]),
    glass(736, 840, 880, 940, '#d98b4e', '#9a4a24'),
    3.6
  );
  hatch(760, 860, 860, 920, 30, 10, 6, 'rgba(80,30,10,0.45)', 1.3);
  piece(
    smooth([
      [720, 800],
      [748, 790],
      [766, 820],
      [762, 870],
      [736, 880],
      [716, 846]
    ]),
    glass(716, 790, 766, 880, '#f4c76a', '#c98a32'),
    3.2
  );
  piece(
    smooth([
      [722, 780],
      [732, 764],
      [744, 772],
      [752, 764],
      [760, 784],
      [736, 794]
    ]),
    '#e2312e',
    2.6
  );
  piece(
    smooth([
      [716, 810],
      [726, 812],
      [724, 832],
      [714, 826]
    ]),
    '#d82a2a',
    2.2
  );
  piece(
    polyPath([
      [716, 798],
      [700, 806],
      [716, 808]
    ]),
    '#e8b24a',
    2.2
  );
  paint(
    [
      [
        [734, 798],
        [738, 800]
      ]
    ],
    'rgba(20,10,5,0.8)',
    2.2
  );
  for (const lx of [786, 818]) {
    paint(
      [
        [
          [lx, 936],
          [lx - 4, 990],
          [lx - 14, 1000]
        ],
        [
          [lx - 4, 990],
          [lx + 8, 998]
        ]
      ],
      '#c48a32',
      4
    );
  }

  // White goose bottom right, neck stretched down pecking at the earth
  piece(
    smooth([
      [836, 860],
      [896, 836],
      [924, 880],
      [912, 950],
      [856, 968],
      [822, 930]
    ]),
    glass(822, 836, 924, 968, '#ffffff', '#d4d8dc'),
    3.6
  );
  paint(
    [
      [
        [846, 880],
        [896, 870]
      ],
      [
        [840, 904],
        [902, 896]
      ],
      [
        [846, 928],
        [896, 924]
      ]
    ],
    'rgba(80,90,100,0.45)',
    1.4
  );
  piece(
    smooth([
      [828, 900],
      [840, 910],
      [814, 980],
      [802, 996],
      [792, 986],
      [806, 960]
    ]),
    glass(792, 900, 840, 996, '#ffffff', '#d8dde2'),
    3
  );
  piece(
    polyPath([
      [796, 990],
      [784, 1012],
      [802, 1000]
    ]),
    '#e89a3c',
    2.4
  );
  piece(
    polyPath([
      [856, 966],
      [848, 1000],
      [868, 1004],
      [866, 966]
    ]),
    '#e8a048',
    2.4
  );

  border(xOuterR - 22);
  drawSaddleBars(ctx, xMidR, xOuterR, [barY], 7);
  caption(xMidR, xOuterR, 'Given by Patricia & John Maude 1991', 22);
  ctx.restore();

  // Outer lead frame around both lights
  ctx.save();
  ctx.strokeStyle = LEAD;
  ctx.lineWidth = 7;
  ctx.beginPath();
  traceLeftLight();
  ctx.stroke();
  ctx.beginPath();
  traceRightLight();
  ctx.stroke();
  ctx.restore();

  addAntiqueGlassMottle(ctx, w, h, 1997, 0.06);
  return canvasTexture(c, { anisotropy: maxAniso });
}

// =========================================================================
// 3. NORTH NAVE "JAQUES / GOOD SAMARITAN" WINDOW (A3) — J.E. Nuttgens (1933)
//    Two cinquefoil-headed lights under clear diamond quarries, traced from the photograph:
//    Left:  "AND WHEN HE SAW HIM" — the wounded man, the donkey's head, the priest & Levite walking on
//    Right: "HE HAD COMPASSION ON HIM" — the turbaned Samaritan with his gourd flask beside the donkey
//    Base:  Mary Clara Jaques of Horsenden House (1849–1932), zigzag band & heraldic lozenge
// =========================================================================

// Cinquefoil lancet head: tall round central lobe, two upper side lobes and two shoulder lobes
// dropping to the springing line (offsets measured from the photograph, scaled to the light's half-width).
function traceCinquefoilLancetPath(ctx, cx, hw, topY, botY) {
  const s = hw / 180;
  const X = (dx) => cx + dx * s;
  const Y = (dy) => topY + dy * s;
  ctx.moveTo(X(-180), botY);
  ctx.lineTo(X(-180), Y(244));
  ctx.bezierCurveTo(X(-184), Y(200), X(-170), Y(164), X(-136), Y(158));
  ctx.bezierCurveTo(X(-152), Y(110), X(-128), Y(64), X(-88), Y(66));
  ctx.bezierCurveTo(X(-60), Y(68), X(-42), Y(74), X(-40), Y(82));
  ctx.lineTo(X(-40), Y(40));
  ctx.arc(X(0), Y(40), 40 * s, Math.PI, Math.PI * 2);
  ctx.lineTo(X(40), Y(82));
  ctx.bezierCurveTo(X(42), Y(74), X(60), Y(68), X(88), Y(66));
  ctx.bezierCurveTo(X(128), Y(64), X(152), Y(110), X(136), Y(158));
  ctx.bezierCurveTo(X(170), Y(164), X(184), Y(200), X(180), Y(244));
  ctx.lineTo(X(180), botY);
  ctx.closePath();
}

export function createJaquesStainedGlassTexture(maxAniso = 8) {
  const w = 1024;
  const h = 1280;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(1933);
  const LEAD = '#191613';
  const { smooth, polyPath, glass, piece, paint, hatch, leaf } = createGlassKit(ctx, rng, LEAD);

  fillWeatheredStoneSurround(ctx, w, h, 1933, '#978d7e');

  const hw = 180;
  const topY = 128;
  const sceneTop = 382;
  const zigY = 1048;
  const textY = 1064;
  const botY = 1134;
  const bars = [382, 562, 746, 942];
  const lights = [
    { cx: 280, side: 'left' },
    { cx: 742, side: 'right' }
  ];

  // ---- local drawing helpers ----------------------------------------------
  const bbox = (pts) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    return [x0, y0, x1, y1];
  };
  // Smooth leaded piece shaded from tone a (top-left) to tone b (bottom-right)
  const S = (pts, a, b = a, lw = 3.4) => {
    const [x0, y0, x1, y1] = bbox(pts);
    piece(smooth(pts), glass(x0, y0, x1, y1, a, b), lw);
  };
  const P = (pts, a, b = a, lw = 3.4) => {
    const [x0, y0, x1, y1] = bbox(pts);
    piece(polyPath(pts), glass(x0, y0, x1, y1, a, b), lw);
  };
  const qPoint = (p0, q, p1, t) => [
    (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * q[0] + t * t * p1[0],
    (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * q[1] + t * t * p1[1]
  ];
  // Curved parchment scroll with its lettering laid along the curve
  const ribbon = (p0, q, p1, half, text, size = 22) => {
    const n = 28;
    const top = [];
    const bot = [];
    const mid = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = qPoint(p0, q, p1, t);
      const a = qPoint(p0, q, p1, Math.max(0, t - 0.01));
      const b = qPoint(p0, q, p1, Math.min(1, t + 0.01));
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const nx = -Math.sin(ang);
      const ny = Math.cos(ang);
      top.push([p[0] - nx * half, p[1] - ny * half]);
      bot.push([p[0] + nx * half, p[1] + ny * half]);
      mid.push([p[0], p[1], ang]);
    }
    const outline = [...top, ...bot.reverse()];
    const [x0, y0, x1, y1] = bbox(outline);
    piece(polyPath(outline), glass(x0, y0, x1, y1, '#fbfaf2', '#dfe2dc'), 3.6);
    paint([top.slice(2, -2).map(([x, y], i) => [x + 2 * Math.sin(i), y + 5])], 'rgba(90,96,100,0.18)', 4);
    // Letters spaced by their measured widths, centred on the scroll's arc length
    ctx.save();
    ctx.font = `${size}px Georgia, 'Times New Roman', serif`;
    ctx.fillStyle = '#2a2622';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const arc = [0];
    for (let i = 1; i < mid.length; i++)
      arc.push(arc[i - 1] + Math.hypot(mid[i][0] - mid[i - 1][0], mid[i][1] - mid[i - 1][1]));
    const total = arc[arc.length - 1];
    const tracking = size * 0.08;
    const widths = [...text].map((ch) => ctx.measureText(ch).width + tracking);
    let s = (total - widths.reduce((a, b) => a + b, 0)) * 0.5;
    [...text].forEach((ch, i) => {
      const at = s + widths[i] * 0.5;
      s += widths[i];
      let k = 1;
      while (k < arc.length - 1 && arc[k] < at) k++;
      const f = (at - arc[k - 1]) / (arc[k] - arc[k - 1] || 1);
      const x = mid[k - 1][0] + (mid[k][0] - mid[k - 1][0]) * f;
      const y = mid[k - 1][1] + (mid[k][1] - mid[k - 1][1]) * f;
      ctx.save();
      ctx.translate(x, y + 1);
      ctx.rotate(mid[k][2]);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
    ctx.restore();
  };
  const gold = (pts) => S(pts, '#f6e27a', '#d9a823', 3.2);
  // Six-pointed white star flower with a gold eye
  const star = (x, y, r) => {
    const pts = [];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + 0.3;
      const rr = k % 2 ? r * 0.42 : r;
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    P(pts, '#ffffff', '#e8eadf', 1.8);
    piece(() => ctx.arc(x, y, r * 0.3, 0, Math.PI * 2), '#e9c23c', 1.2);
  };
  const DARK_LEAVES = [
    ['#5fd39a', '#1f8a5a'],
    ['#8be0b0', '#2f9a66'],
    ['#3fb985', '#176f48'],
    ['#9fe8c0', '#3aa070']
  ];
  // Flowering evergreen: deep green ground filled with narrow pointed leaves & white stars
  const shrub = (pts, nLeaves, nStars, leafLen = 15) => {
    const [x0, y0, x1, y1] = bbox(pts);
    S(pts, '#185c3c', '#0d3a26', 3.6);
    ctx.save();
    ctx.beginPath();
    smooth(pts)();
    ctx.clip();
    for (let i = 0; i < nLeaves; i++) {
      const x = x0 + rng() * (x1 - x0);
      const y = y0 + rng() * (y1 - y0);
      leaf(x, y, leafLen * (0.8 + rng() * 0.5), -Math.PI / 2 + (rng() - 0.5) * 2.2, DARK_LEAVES[i % 4]);
    }
    for (let i = 0; i < nStars; i++)
      star(x0 + 10 + rng() * (x1 - x0 - 20), y0 + 10 + rng() * (y1 - y0 - 20), 9 + rng() * 3);
    ctx.restore();
  };
  // Rounded pale pebbles on the roadside
  const pebbles = (x0, y0, x1, y1, n) => {
    const tones = [
      ['#f7f3e8', '#d8d0bf'],
      ['#efe6c8', '#c9b98e'],
      ['#f4d9a2', '#d9a65a'],
      ['#e6e8e6', '#b9bdbb']
    ];
    for (let i = 0; i < n; i++) {
      const x = x0 + rng() * (x1 - x0);
      const y = y0 + rng() * (y1 - y0);
      const rx = 9 + rng() * 9;
      const t = tones[Math.floor(rng() * tones.length)];
      piece(
        () => ctx.ellipse(x, y, rx, rx * 0.55, 0, 0, Math.PI * 2),
        glass(x - rx, y - rx, x + rx, y + rx, t[0], t[1]),
        2.4
      );
    }
  };
  const grass = (x0, x1, y0, y1) => {
    P(
      [
        [x0, y0 + 6],
        [x1, y0],
        [x1, y1],
        [x0, y1]
      ],
      '#7ee06a',
      '#2e9a3c',
      3.2
    );
    const blades = [];
    for (let x = x0 + 3; x < x1; x += 4 + rng() * 4) {
      const lean = (rng() - 0.5) * 8;
      blades.push([
        [x, y1],
        [x + lean, y0 + 4 + rng() * 10]
      ]);
    }
    paint(blades, 'rgba(20,80,30,0.6)', 1.3);
  };
  const blueFlowers = (x0, y0, x1, y1, n) => {
    ctx.save();
    for (let i = 0; i < n; i++) {
      const x = x0 + rng() * (x1 - x0);
      const y = y0 + rng() * (y1 - y0);
      ctx.fillStyle = rng() > 0.5 ? 'rgba(96,150,240,0.85)' : 'rgba(140,186,250,0.85)';
      ctx.beginPath();
      ctx.arc(x, y, 3.5 + rng() * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };
  // Bare-branched little tree with autumn-gold leaves
  const sapling = (x, y, hgt, tint = '#e0a040') => {
    paint(
      [
        [
          [x, y],
          [x, y - hgt]
        ],
        [
          [x, y - hgt * 0.45],
          [x - hgt * 0.25, y - hgt * 0.8]
        ],
        [
          [x, y - hgt * 0.6],
          [x + hgt * 0.22, y - hgt * 0.9]
        ]
      ],
      'rgba(250,250,250,0.9)',
      2.4
    );
    ctx.save();
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = i % 3 ? tint : '#b8662a';
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.arc(x + (rng() - 0.5) * hgt * 0.6, y - hgt * (0.35 + rng() * 0.65), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };
  const cypress = (x, y, hgt, wid) =>
    S(
      [
        [x, y - hgt],
        [x + wid * 0.5, y - hgt * 0.4],
        [x + wid * 0.4, y],
        [x - wid * 0.4, y],
        [x - wid * 0.5, y - hgt * 0.4]
      ],
      '#3f8d52',
      '#1d5a32',
      2.4
    );
  const skin = (pts, lw = 3.2) => S(pts, '#fbf0e2', '#e7cdb2', lw);
  const white = (pts, lw = 3.4) => S(pts, '#fbfbf7', '#cfd2cd', lw);

  for (const { cx, side } of lights) {
    const xL = cx - hw;
    const xR = cx + hw;

    // Stone hood & chamfered reveal around the cusped head
    ctx.save();
    ctx.beginPath();
    traceCinquefoilLancetPath(ctx, cx, hw + 26, topY - 24, botY + 16);
    ctx.fillStyle = '#867b6b';
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    traceCinquefoilLancetPath(ctx, cx, hw + 12, topY - 11, botY + 8);
    ctx.fillStyle = '#6f6556';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    traceCinquefoilLancetPath(ctx, cx, hw, topY, botY);
    ctx.clip();

    // ---- 1. Head: clear diamond quarries with the text scrolls ----
    drawDiamondQuarries(ctx, xL - 2, topY - 4, xR + 2, sceneTop, 46, 62, {
      leadW: 3.4,
      rosette: false,
      tintBlue: true
    });
    // A few faintly tinted quarries, as in old crown glass
    ctx.save();
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = ['rgba(220,200,240,0.25)', 'rgba(240,236,190,0.28)', 'rgba(170,210,240,0.3)'][i % 3];
      ctx.fillRect(xL + rng() * hw * 2, topY + rng() * (sceneTop - topY), 22, 30);
    }
    ctx.restore();

    if (side === 'left') {
      gold([
        [196, 246],
        [214, 214],
        [230, 226],
        [222, 252]
      ]);
      ribbon([194, 262], [262, 196], [354, 226], 20, '‘AND WHEN', 24);
      gold([
        [292, 258],
        [340, 236],
        [356, 252],
        [330, 288],
        [300, 300]
      ]);
      gold([
        [376, 274],
        [404, 268],
        [400, 302],
        [382, 304]
      ]);
      gold([
        [196, 344],
        [262, 340],
        [292, 352],
        [226, 372],
        [196, 366]
      ]);
      ribbon([182, 334], [286, 296], [410, 322], 22, 'HE SAW HIM', 26);
    } else {
      gold([
        [640, 268],
        [690, 276],
        [700, 300],
        [650, 298]
      ]);
      gold([
        [770, 318],
        [826, 330],
        [836, 356],
        [784, 350]
      ]);
      ribbon([626, 256], [726, 196], [864, 290], 20, 'COMPASSION ON HIM’', 22);
      gold([
        [584, 322],
        [604, 316],
        [612, 348],
        [590, 354]
      ]);
      ribbon([596, 344], [650, 334], [726, 300], 20, 'HE HAD', 24);
    }

    // ---- 2. Narrative scene ----
    if (side === 'left') {
      // Sky, snowy-pale hills & the road climbing away
      P(
        [
          [xL, sceneTop],
          [xR, sceneTop],
          [xR, 470],
          [xL, 470]
        ],
        '#a8d4f4',
        '#e6f2fb',
        0
      );
      S(
        [
          [xL - 10, 450],
          [180, 418],
          [300, 428],
          [xR + 10, 440],
          [xR + 10, 520],
          [xL - 10, 520]
        ],
        '#f1f6f8',
        '#c6dcec',
        3
      );
      S(
        [
          [xL - 10, 470],
          [230, 452],
          [xR + 10, 468],
          [xR + 10, 560],
          [xL - 10, 560]
        ],
        '#cfe8f0',
        '#a9d0e2',
        3
      );
      sapling(122, 520, 80);
      sapling(352, 470, 52, '#e8b050');
      sapling(372, 530, 70, '#d89838');
      cypress(380, 470, 40, 22);
      // Pale cobbled bank on the left
      pebbles(xL, 560, 160, 630, 14);
      // Green meadow with blue flowers behind the wounded man
      S(
        [
          [xL - 10, 600],
          [200, 610],
          [330, 640],
          [360, 780],
          [xL - 10, 790]
        ],
        '#8fdc78',
        '#3f9e4a',
        3
      );
      blueFlowers(xL, 610, 330, 760, 60);

      // The Levite, small & far off, walking away up the road
      S(
        [
          [326, 410],
          [344, 418],
          [354, 470],
          [362, 524],
          [322, 528],
          [326, 470]
        ],
        '#fbfbf5',
        '#cfd6d4',
        3
      );
      S(
        [
          [306, 424],
          [328, 414],
          [338, 470],
          [320, 520],
          [296, 534],
          [298, 470]
        ],
        '#f04030',
        '#b81c1c',
        3
      );
      piece(
        () => ctx.ellipse(330, 404, 11, 13, 0, 0, Math.PI * 2),
        glass(318, 392, 342, 418, '#ffffff', '#d4d8d4'),
        2.6
      );
      paint(
        [
          [
            [356, 432],
            [358, 528]
          ]
        ],
        '#2a2018',
        2.4
      );
      paint(
        [
          [
            [304, 520],
            [360, 520]
          ]
        ],
        'rgba(30,20,10,0.5)',
        1.4
      );

      // The priest: red under-robe, magenta-pink gown, white shawl & striped prayer shawl, red cap & white turban
      S(
        [
          [140, 476],
          [178, 470],
          [186, 560],
          [190, 640],
          [150, 640],
          [132, 560]
        ],
        '#f6482e',
        '#c21e1e'
      );
      S(
        [
          [170, 470],
          [262, 474],
          [296, 560],
          [304, 640],
          [306, 730],
          [270, 742],
          [222, 700],
          [182, 640],
          [176, 560]
        ],
        '#f094c4',
        '#a83a7c'
      );
      paint(
        [
          [
            [214, 500],
            [232, 690]
          ],
          [
            [248, 500],
            [278, 720]
          ],
          [
            [196, 560],
            [206, 650]
          ]
        ],
        'rgba(80,10,50,0.45)',
        2
      );
      // Striped prayer shawl hanging from the shoulder
      S(
        [
          [232, 478],
          [262, 474],
          [282, 560],
          [292, 642],
          [264, 650],
          [248, 560]
        ],
        '#fdfdf8',
        '#d9d9d2'
      );
      ctx.save();
      ctx.beginPath();
      smooth([
        [232, 478],
        [262, 474],
        [282, 560],
        [292, 642],
        [264, 650],
        [248, 560]
      ])();
      ctx.clip();
      for (const y of [552, 566, 610, 624]) {
        ctx.fillStyle = y % 4 ? '#1d1b18' : '#f0c430';
        ctx.fillRect(230, y, 70, 6);
        ctx.fillStyle = '#f0c430';
        ctx.fillRect(230, y + 6, 70, 4);
      }
      ctx.restore();
      // White shawl over head & shoulders, falling down the back
      white([
        [150, 430],
        [196, 414],
        [244, 430],
        [292, 462],
        [300, 492],
        [250, 500],
        [212, 518],
        [168, 500],
        [146, 470]
      ]);
      paint(
        [
          [
            [170, 470],
            [240, 450],
            [290, 476]
          ],
          [
            [190, 498],
            [250, 478]
          ]
        ],
        'rgba(80,90,90,0.4)',
        1.6
      );
      // Head in profile looking back to the left, white beard
      skin([
        [160, 414],
        [182, 404],
        [196, 420],
        [192, 452],
        [172, 462],
        [156, 450],
        [150, 432]
      ]);
      S(
        [
          [152, 442],
          [176, 450],
          [192, 452],
          [184, 476],
          [160, 486],
          [148, 466]
        ],
        '#ffffff',
        '#d6d6d0',
        2.6
      );
      paint(
        [
          [
            [158, 428],
            [168, 426]
          ],
          [
            [152, 436],
            [148, 444],
            [154, 446]
          ],
          [
            [156, 452],
            [168, 454]
          ]
        ],
        'rgba(60,40,30,0.8)',
        1.6
      );
      // White turban with red cap
      white([
        [154, 412],
        [170, 396],
        [196, 398],
        [214, 414],
        [196, 422],
        [168, 420]
      ]);
      S(
        [
          [166, 398],
          [176, 384],
          [196, 384],
          [204, 400]
        ],
        '#f34232',
        '#b81c1c',
        2.8
      );

      // Flowering evergreen down the right edge and around the donkey
      shrub(
        [
          [392, 384],
          [xR + 10, 384],
          [xR + 10, 560],
          [360, 556],
          [376, 470]
        ],
        60,
        9
      );
      shrub(
        [
          [326, 580],
          [370, 560],
          [404, 600],
          [404, 760],
          [360, 780],
          [314, 700]
        ],
        48,
        5,
        13
      );

      // Donkey's head, lowered beside the wounded man: long grey face to a pale muzzle, gold halter
      S(
        [
          [418, 604],
          [402, 562],
          [412, 556],
          [440, 590],
          [446, 610]
        ],
        '#e8e8e4',
        '#9a9d9e',
        3
      );
      S(
        [
          [380, 616],
          [384, 596],
          [430, 600],
          [xR + 6, 604],
          [xR + 6, 700],
          [454, 744],
          [438, 778],
          [398, 780],
          [378, 752],
          [372, 690]
        ],
        '#f2f2f0',
        '#a2a5a6'
      );
      hatch(384, 620, 456, 740, 70, 2, 8, 'rgba(70,70,75,0.3)', 1);
      S(
        [
          [380, 734],
          [440, 730],
          [440, 778],
          [400, 782],
          [378, 760]
        ],
        '#fbf8f2',
        '#d8d4cc',
        2.6
      );
      S(
        [
          [396, 612],
          [352, 576],
          [340, 560],
          [368, 568],
          [412, 600]
        ],
        '#eeeeea',
        '#9c9fa0',
        3
      );
      paint(
        [
          [
            [356, 574],
            [396, 604]
          ]
        ],
        'rgba(60,60,60,0.5)',
        1.6
      );
      piece(() => ctx.ellipse(402, 690, 9, 5, 0.3, 0, Math.PI * 2), '#2a2420', 1.4);
      paint(
        [
          [
            [390, 680],
            [404, 682],
            [414, 690]
          ],
          [
            [392, 764],
            [402, 756],
            [412, 764]
          ]
        ],
        'rgba(40,30,30,0.75)',
        2
      );
      P(
        [
          [378, 646],
          [xR + 4, 640],
          [xR + 4, 652],
          [379, 658]
        ],
        '#fbd25a',
        '#e08c22',
        2.6
      );
      P(
        [
          [436, 604],
          [444, 604],
          [440, 736],
          [432, 736]
        ],
        '#fbd25a',
        '#e08c22',
        2.6
      );
      piece(() => ctx.arc(434, 744, 8, 0, Math.PI * 2), 'rgba(0,0,0,0)', 3.4);

      // Pebbles, teal leaves & pale road on the right below the donkey
      S(
        [
          [330, 790],
          [xR + 10, 790],
          [xR + 10, 1000],
          [360, 990]
        ],
        '#f2efe4',
        '#c9c3b0',
        3
      );
      pebbles(340, 800, xR, 990, 34);
      for (let i = 0; i < 6; i++) leaf(352 + rng() * 40, 810 + rng() * 40, 14, rng() * 3, DARK_LEAVES[i % 4]);

      // ---- The wounded man lying in the foreground ----
      // Blue cloth under & around him
      S(
        [
          [xL - 6, 730],
          [150, 726],
          [190, 760],
          [188, 812],
          [150, 870],
          [xL - 6, 880]
        ],
        '#3a6ae8',
        '#122e9c'
      );
      S(
        [
          [190, 880],
          [262, 870],
          [330, 852],
          [360, 900],
          [380, 970],
          [350, 1020],
          [270, 1032],
          [200, 1010],
          [176, 950]
        ],
        '#3e70ee',
        '#0f2a90'
      );
      paint(
        [
          [
            [240, 900],
            [262, 1010]
          ],
          [
            [300, 890],
            [318, 1010]
          ],
          [
            [200, 940],
            [230, 1000]
          ]
        ],
        'rgba(5,10,50,0.5)',
        2.2
      );
      // Torso, half-naked
      skin([
        [150, 760],
        [196, 744],
        [260, 756],
        [300, 780],
        [314, 840],
        [290, 880],
        [230, 892],
        [172, 890],
        [146, 840]
      ]);
      paint(
        [
          [
            [190, 790],
            [214, 800],
            [240, 794]
          ],
          [
            [206, 822],
            [218, 870]
          ],
          [
            [232, 826],
            [228, 870]
          ],
          [
            [196, 840],
            [250, 846]
          ],
          [
            [194, 858],
            [252, 862]
          ]
        ],
        'rgba(110,70,50,0.45)',
        1.5
      );
      piece(() => ctx.arc(176, 802, 2.5, 0, Math.PI * 2), 'rgba(110,60,40,0.7)', 0);
      // Yellow cloth band over the shoulder & loincloth
      S(
        [
          [196, 744],
          [300, 772],
          [304, 790],
          [196, 760]
        ],
        '#fbe27a',
        '#dcae2c',
        3
      );
      S(
        [
          [150, 872],
          [236, 884],
          [300, 870],
          [272, 920],
          [196, 934],
          [156, 912]
        ],
        '#fbe382',
        '#d9a826'
      );
      // Blue cloth over the right shoulder
      S(
        [
          [276, 766],
          [312, 770],
          [330, 820],
          [306, 840]
        ],
        '#3c6cea',
        '#13309c',
        3
      );
      // Left arm hanging down to the ground, hand splayed
      skin([
        [112, 840],
        [150, 846],
        [156, 940],
        [150, 1000],
        [124, 1004],
        [116, 940]
      ]);
      skin([
        [118, 994],
        [154, 990],
        [168, 1020],
        [150, 1040],
        [112, 1044],
        [104, 1020]
      ]);
      paint(
        [
          [
            [124, 1018],
            [116, 1040]
          ],
          [
            [134, 1020],
            [130, 1042]
          ],
          [
            [144, 1018],
            [146, 1040]
          ]
        ],
        'rgba(110,70,50,0.6)',
        1.4
      );
      // Right arm across the body, hand resting on the cloth
      skin([
        [276, 820],
        [312, 840],
        [290, 900],
        [254, 960],
        [232, 952],
        [256, 890]
      ]);
      skin([
        [226, 946],
        [262, 952],
        [270, 990],
        [250, 1004],
        [222, 996]
      ]);
      paint(
        [
          [
            [236, 970],
            [232, 996]
          ],
          [
            [248, 972],
            [248, 1000]
          ]
        ],
        'rgba(110,70,50,0.6)',
        1.4
      );
      // Raised knee & lower leg to the sandalled foot
      skin([
        [300, 900],
        [334, 860],
        [372, 850],
        [420, 900],
        [452, 948],
        [430, 968],
        [384, 930],
        [350, 920],
        [320, 940]
      ]);
      skin([
        [392, 930],
        [430, 966],
        [440, 1000],
        [414, 1010],
        [388, 970]
      ]);
      S(
        [
          [414, 990],
          [446, 980],
          [460, 1018],
          [432, 1036],
          [414, 1022]
        ],
        '#fbe382',
        '#d9a826',
        3
      );
      paint(
        [
          [
            [374, 866],
            [404, 904]
          ],
          [
            [420, 960],
            [446, 948]
          ]
        ],
        'rgba(110,70,50,0.45)',
        1.5
      );
      // Blond head lolling back, eyes closed
      S(
        [
          [118, 690],
          [150, 662],
          [196, 664],
          [222, 690],
          [210, 704],
          [170, 690],
          [134, 716]
        ],
        '#fbe58a',
        '#d8a632'
      );
      skin([
        [134, 700],
        [176, 688],
        [212, 700],
        [226, 728],
        [210, 748],
        [178, 752],
        [146, 740]
      ]);
      paint(
        [
          [
            [156, 712],
            [172, 716]
          ],
          [
            [186, 712],
            [200, 714]
          ],
          [
            [178, 716],
            [182, 730],
            [176, 734]
          ],
          [
            [172, 740],
            [190, 740]
          ]
        ],
        'rgba(70,45,30,0.8)',
        1.6
      );
      paint(
        [
          [
            [124, 694],
            [150, 676],
            [190, 672]
          ],
          [
            [140, 704],
            [168, 684]
          ]
        ],
        'rgba(150,100,20,0.6)',
        1.4
      );
      grass(150, xR, 1000, zigY);
    } else {
      // Sky with the walled city & river in the distance
      P(
        [
          [xL, sceneTop],
          [xR, sceneTop],
          [xR, 520],
          [xL, 520]
        ],
        '#b4daf6',
        '#eef6fb',
        0
      );
      const wall = [
        [640, 440],
        [640, 412],
        [660, 412],
        [660, 400],
        [690, 400],
        [690, 414],
        [740, 414],
        [740, 404],
        [770, 404],
        [770, 396],
        [800, 396],
        [800, 410],
        [850, 410],
        [850, 400],
        [880, 400],
        [880, 412],
        [xR + 6, 412],
        [xR + 6, 448],
        [640, 448]
      ];
      P(wall, '#c8cdf0', '#9ea8dc', 2.8);
      paint(
        [
          [
            [700, 426],
            [700, 440]
          ],
          [
            [820, 420],
            [820, 436]
          ],
          [
            [660, 424],
            [880, 426]
          ]
        ],
        'rgba(70,70,120,0.4)',
        1.2
      );
      for (const [dx, dy] of [
        [676, 398],
        [786, 392],
        [866, 398]
      ])
        piece(() => ctx.ellipse(dx, dy, 10, 5, 0, Math.PI, Math.PI * 2), '#f2d070', 2);
      S(
        [
          [700, 448],
          [760, 444],
          [800, 470],
          [870, 520],
          [800, 520],
          [740, 472]
        ],
        '#ffffff',
        '#cfe6f6',
        3
      );
      S(
        [
          [xL - 10, 446],
          [700, 448],
          [740, 474],
          [800, 520],
          [xL - 10, 520]
        ],
        '#cfe8d8',
        '#a6d2be',
        3
      );
      cypress(728, 476, 34, 20);
      cypress(756, 480, 28, 16);
      cypress(864, 470, 40, 22);
      cypress(896, 476, 34, 18);

      // Flowering evergreen framing the scene on both sides
      shrub(
        [
          [xL - 10, 384],
          [612, 390],
          [650, 480],
          [660, 560],
          [640, 640],
          [xL - 10, 660]
        ],
        70,
        9,
        14
      );
      shrub(
        [
          [800, 440],
          [850, 426],
          [900, 470],
          [xR + 10, 560],
          [xR + 10, 700],
          [880, 700],
          [790, 560]
        ],
        50,
        7,
        13
      );

      // The donkey at the left edge: grey body, orange saddle cloth with a chequered girth
      S(
        [
          [xL - 8, 600],
          [600, 590],
          [640, 640],
          [652, 760],
          [640, 860],
          [628, 990],
          [598, 1000],
          [590, 880],
          [xL - 8, 870]
        ],
        '#f0f0ee',
        '#a4a7a8'
      );
      hatch(xL, 640, 640, 990, 80, 2, 8, 'rgba(70,70,75,0.3)', 1);
      paint(
        [
          [
            [584, 880],
            [596, 990]
          ]
        ],
        'rgba(40,40,40,0.5)',
        2
      );
      S(
        [
          [598, 590],
          [640, 584],
          [680, 620],
          [672, 700],
          [640, 720],
          [606, 700]
        ],
        '#fba55a',
        '#d9601c'
      );
      P(
        [
          [xL - 6, 596],
          [582, 594],
          [586, 720],
          [xL - 6, 724]
        ],
        '#fbe27a',
        '#d9a826',
        3
      );
      ctx.save();
      for (let y = 600; y < 712; y += 12) {
        ctx.fillStyle = '#1d1b18';
        ctx.fillRect(590 + ((y / 12) % 2) * 6, y, 6, 6);
        ctx.fillRect(590 + ((y / 12 + 1) % 2) * 6, y + 6, 6, 6);
      }
      ctx.restore();
      S(
        [
          [xL - 8, 860],
          [584, 870],
          [580, 990],
          [xL - 8, 996]
        ],
        '#e4e4e0',
        '#9a9d9e',
        3
      );
      // Hooves
      S(
        [
          [578, 990],
          [606, 986],
          [612, 1012],
          [576, 1016]
        ],
        '#d8d2c4',
        '#8d887c',
        3
      );

      // Cobbled road & grass along the bottom
      S(
        [
          [630, 950],
          [xR + 10, 940],
          [xR + 10, 1030],
          [630, 1030]
        ],
        '#f4efe0',
        '#c6bfa8',
        3
      );
      pebbles(640, 950, 860, 1030, 30);
      grass(xL - 6, xR, 1022, zigY);

      // ---- The Samaritan ----
      // White under-robe hem showing below the cloak
      white([
        [650, 880],
        [880, 900],
        [890, 990],
        [800, 1000],
        [700, 1004],
        [648, 990]
      ]);
      paint(
        [
          [
            [690, 920],
            [694, 1000]
          ],
          [
            [730, 920],
            [736, 1000]
          ],
          [
            [820, 930],
            [826, 996]
          ],
          [
            [860, 930],
            [866, 990]
          ]
        ],
        'rgba(90,96,90,0.4)',
        1.6
      );
      // Red cloak: over the back, falling in long folds down the right side
      S(
        [
          [720, 480],
          [800, 498],
          [870, 540],
          [900, 610],
          [906, 760],
          [910, 900],
          [888, 942],
          [800, 950],
          [740, 940],
          [700, 900],
          [700, 760],
          [690, 600],
          [710, 520]
        ],
        '#f04a3a',
        '#9a1218'
      );
      paint(
        [
          [
            [760, 560],
            [770, 940]
          ],
          [
            [820, 700],
            [830, 930]
          ],
          [
            [860, 720],
            [880, 920]
          ],
          [
            [730, 800],
            [790, 806]
          ],
          [
            [800, 520],
            [860, 560]
          ]
        ],
        'rgba(60,0,10,0.45)',
        2.4
      );
      // White robe: the front panel between the cloak's edges, falling to the hem above the sandals
      white([
        [736, 560],
        [772, 556],
        [790, 760],
        [800, 940],
        [760, 946],
        [744, 760]
      ]);
      paint(
        [
          [
            [752, 600],
            [770, 940]
          ]
        ],
        'rgba(90,96,90,0.4)',
        1.6
      );
      for (const y of [870, 900])
        P(
          [
            [774, y],
            [788, y],
            [792, y + 16],
            [778, y + 16]
          ],
          '#fbe27a',
          '#e0a628',
          2
        );
      // White shawl over the shoulder & the long white sleeve of the right arm
      white([
        [680, 478],
        [730, 470],
        [760, 520],
        [740, 600],
        [700, 660],
        [672, 620]
      ]);
      white([
        [806, 546],
        [860, 540],
        [884, 600],
        [888, 690],
        [868, 760],
        [834, 760],
        [820, 680],
        [792, 620]
      ]);
      paint(
        [
          [
            [840, 580],
            [852, 740]
          ],
          [
            [862, 600],
            [870, 740]
          ]
        ],
        'rgba(90,96,90,0.4)',
        1.6
      );
      // White sleeve of the outstretched left arm reaching to the donkey
      white([
        [660, 600],
        [700, 620],
        [690, 690],
        [656, 720],
        [628, 714],
        [640, 650]
      ]);
      skin([
        [586, 704],
        [618, 694],
        [646, 704],
        [640, 724],
        [606, 728],
        [584, 722]
      ]);
      paint(
        [
          [
            [596, 712],
            [620, 716]
          ],
          [
            [600, 720],
            [626, 724]
          ]
        ],
        'rgba(110,70,50,0.6)',
        1.3
      );
      // Blue sash round the waist, its end hanging down the front
      S(
        [
          [700, 630],
          [760, 626],
          [820, 650],
          [826, 676],
          [760, 662],
          [704, 664]
        ],
        '#4f82f0',
        '#1a3eb0',
        3
      );
      S(
        [
          [808, 660],
          [836, 668],
          [852, 760],
          [826, 770]
        ],
        '#4a7cee',
        '#14329e',
        3
      );
      // Gourd flask in a gold net, held at the neck
      S(
        [
          [762, 640],
          [800, 630],
          [826, 664],
          [820, 700],
          [790, 712],
          [760, 700],
          [752, 668]
        ],
        '#fbe7a0',
        '#d8a83a'
      );
      ctx.save();
      ctx.beginPath();
      smooth([
        [762, 640],
        [800, 630],
        [826, 664],
        [820, 700],
        [790, 712],
        [760, 700],
        [752, 668]
      ])();
      ctx.clip();
      ctx.strokeStyle = 'rgba(120,80,20,0.75)';
      ctx.lineWidth = 1.6;
      for (let k = -80; k < 80; k += 12) {
        ctx.beginPath();
        ctx.moveTo(740 + k, 620);
        ctx.lineTo(820 + k, 720);
        ctx.moveTo(840 + k, 620);
        ctx.lineTo(760 + k, 720);
        ctx.stroke();
      }
      ctx.restore();
      S(
        [
          [768, 604],
          [780, 600],
          [786, 634],
          [772, 636]
        ],
        '#fbe7a0',
        '#d8a83a',
        2.6
      );
      skin([
        [766, 616],
        [806, 610],
        [814, 636],
        [790, 650],
        [764, 642]
      ]);
      paint(
        [
          [
            [774, 626],
            [800, 622]
          ],
          [
            [774, 636],
            [802, 632]
          ]
        ],
        'rgba(110,70,50,0.6)',
        1.3
      );
      // Sandalled feet
      for (const [fx, fy, dir] of [
        [680, 1004, -1],
        [860, 998, 1]
      ]) {
        skin([
          [fx - 40, fy - 6],
          [fx + 10, fy - 20],
          [fx + 40, fy - 4],
          [fx + 36, fy + 22],
          [fx - 30, fy + 24]
        ]);
        paint(
          [
            [
              [fx - 30, fy + 6],
              [fx + 30, fy - 6]
            ],
            [
              [fx - 20, fy + 18],
              [fx + 30, fy + 4]
            ],
            [
              [fx + dir * 30, fy - 10],
              [fx + dir * 30, fy + 22]
            ]
          ],
          'rgba(200,150,40,0.95)',
          3
        );
      }
      // Head in profile bent to the left: grey beard, gold-banded turban with a magenta crown
      skin([
        [632, 470],
        [670, 456],
        [702, 470],
        [708, 510],
        [690, 536],
        [656, 536],
        [632, 506]
      ]);
      S(
        [
          [640, 500],
          [664, 504],
          [690, 520],
          [686, 548],
          [664, 560],
          [640, 538],
          [628, 516]
        ],
        '#a58f78',
        '#5d4836',
        2.8
      );
      hatch(632, 504, 688, 556, 40, 1, 8, 'rgba(240,230,220,0.55)', 1);
      paint(
        [
          [
            [640, 484],
            [652, 482]
          ],
          [
            [630, 492],
            [624, 500],
            [632, 504]
          ]
        ],
        'rgba(60,40,30,0.8)',
        1.6
      );
      white([
        [604, 452],
        [636, 428],
        [690, 424],
        [730, 444],
        [720, 470],
        [670, 466],
        [630, 476]
      ]);
      paint(
        [
          [
            [620, 450],
            [700, 440]
          ],
          [
            [626, 462],
            [712, 456]
          ]
        ],
        'rgba(90,96,90,0.45)',
        1.6
      );
      S(
        [
          [630, 430],
          [656, 414],
          [690, 416],
          [698, 436],
          [660, 440]
        ],
        '#e05aa0',
        '#a0246a',
        3
      );
      S(
        [
          [654, 470],
          [710, 468],
          [748, 476],
          [744, 500],
          [700, 496],
          [660, 488]
        ],
        '#fbe382',
        '#d9a826',
        3
      );
      ctx.save();
      ctx.strokeStyle = 'rgba(40,30,20,0.75)';
      ctx.lineWidth = 1.2;
      for (let x = 664; x < 740; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x, 474);
        ctx.lineTo(x + 8, 494);
        ctx.moveTo(x + 8, 474);
        ctx.lineTo(x, 494);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ---- 3. Zigzag band & inscription panels ----
    P(
      [
        [xL - 4, zigY],
        [xR + 4, zigY],
        [xR + 4, textY],
        [xL - 4, textY]
      ],
      '#fbfbf2',
      '#e8e6d8',
      3
    );
    ctx.save();
    const tri = 18;
    for (let x = xL - 4, k = 0; x < xR + 4; x += tri, k++) {
      ctx.fillStyle = k % 3 === 1 ? '#efc63a' : '#1e1b18';
      ctx.beginPath();
      ctx.moveTo(x, zigY + 2);
      ctx.lineTo(x + tri, zigY + 2);
      ctx.lineTo(x + tri * 0.5, textY - 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    const panel = (x0, x1, lines, size = 21) => {
      P(
        [
          [x0, textY],
          [x1, textY],
          [x1, botY],
          [x0, botY]
        ],
        '#fbfbf0',
        '#e4e3d0',
        3.6
      );
      ctx.save();
      ctx.fillStyle = '#26221d';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      let fs = size;
      ctx.font = `${fs}px Georgia, 'Times New Roman', serif`;
      while (fs > 12 && Math.max(...lines.map(([text]) => ctx.measureText(text).width)) > x1 - x0 - 12) {
        fs -= 0.5;
        ctx.font = `${fs}px Georgia, 'Times New Roman', serif`;
      }
      lines.forEach(([text, , y]) => ctx.fillText(text, (x0 + x1) * 0.5, y));
      ctx.restore();
    };
    if (side === 'left') {
      panel(xL - 4, 290, [
        ['To the GLORY of', 112, 1084],
        ['of HORSENDEN', 112, 1114]
      ]);
      panel(290, 388, [
        ['GOD and in', 308, 1084],
        ['HOUSE.', 308, 1114]
      ]);
      panel(388, xR + 4, [
        ['memory', 392, 1084],
        ['Born', 410, 1114]
      ]);
    } else {
      panel(xL - 4, 744, [
        ['of MARY CLARA', 572, 1084],
        ['Mar. 31st 1849. Died', 566, 1114]
      ]);
      panel(
        744,
        852,
        [
          ['JAQUES', 754, 1084],
          ['Jan. 13th 1932.', 748, 1114]
        ],
        19
      );
      // Heraldic lozenge: blue shield with a gold bend between gold charges on a clear quarry
      P(
        [
          [852, textY - 14],
          [xR + 4, textY - 14],
          [xR + 4, botY],
          [852, botY]
        ],
        '#f4f6f2',
        '#d6dad6',
        3.2
      );
      P(
        [
          [886, 1052],
          [918, 1092],
          [886, 1132],
          [854, 1092]
        ],
        '#2a2622',
        '#2a2622',
        2
      );
      const sx = 886;
      const sy = 1094;
      S(
        [
          [sx - 18, sy - 22],
          [sx + 18, sy - 22],
          [sx + 16, sy + 4],
          [sx, sy + 24],
          [sx - 16, sy + 4]
        ],
        '#3c74f0',
        '#12339e',
        2.4
      );
      P(
        [
          [sx - 16, sy - 12],
          [sx + 16, sy + 10],
          [sx + 12, sy + 16],
          [sx - 16, sy - 4]
        ],
        '#fbe27a',
        '#d9a826',
        1.8
      );
      for (const [gx, gy] of [
        [sx - 10, sy - 36],
        [sx + 10, sy - 36],
        [sx, sy + 34]
      ])
        piece(
          () => ctx.arc(gx, gy, 6, 0, Math.PI * 2),
          glass(gx - 6, gy - 6, gx + 6, gy + 6, '#fbe27a', '#d9a826'),
          1.6
        );
    }

    drawSaddleBars(ctx, xL, xR, bars, 7);
    ctx.restore();

    // Outer lead frame around the light
    ctx.save();
    ctx.beginPath();
    traceCinquefoilLancetPath(ctx, cx, hw, topY, botY);
    ctx.strokeStyle = '#1d1a17';
    ctx.lineWidth = 7.5;
    ctx.stroke();
    ctx.restore();
  }

  addAntiqueGlassMottle(ctx, w, h, 1937, 0.06);
  return canvasTexture(c, { anisotropy: maxAniso });
}

// =========================================================================
// 4. CHANCEL SOUTH-WEST LANCET (Window 3) — Richard James Wilson (1938–2007) memorial
//    RAF badge (crowned eagle in a "PER ARDUA AD ASTRA" ring among gold stars) above lilac wings parting
//    onto a starry sky, clouds & a dawn glow over lilac crags; "TO THE GLORY OF GOD", the script
//    "for those that love the skies" on green glass and the name band along the foot.
//    Drawn in the photograph's pixel coordinates (glass x 95..435, y 185..1722), scaled to the texture.
// =========================================================================
export function createWilsonStainedGlassTexture(maxAniso = 8) {
  const w = 500;
  const h = 2048;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(2007);
  const LEAD = '#1a1714';
  const { smooth, polyPath, glass, piece, paint } = createGlassKit(ctx, rng, LEAD);

  fillWeatheredStoneSurround(ctx, w, h, 2007, '#a49a86');
  const px0 = 95;
  const py0 = 185;
  const sx = w / (435 - px0);
  const sy = h / (1722 - py0);
  ctx.setTransform(sx, 0, 0, sy, -px0 * sx, -py0 * sy);

  const bbox = (pts) => {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  };
  const S = (pts, a, b = a, lw = 3) => {
    const [x0, y0, x1, y1] = bbox(pts);
    piece(smooth(pts), glass(x0, y0, x1, y1, a, b), lw);
  };
  const P = (pts, a, b = a, lw = 3) => {
    const [x0, y0, x1, y1] = bbox(pts);
    piece(polyPath(pts), glass(x0, y0, x1, y1, a, b), lw);
  };
  const clipTo = (path, draw) => {
    ctx.save();
    ctx.beginPath();
    path();
    ctx.clip();
    draw();
    ctx.restore();
  };
  const star = (x, y, r, fill = '#ffffff') => {
    const pts = [];
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 ? r * 0.42 : r;
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    P(pts, fill, fill, 1.2);
  };
  const cloud = (x, y, wid, hgt) => {
    const pts = [];
    const n = 9;
    for (let k = 0; k < n; k++) {
      const a = Math.PI + (k / (n - 1)) * Math.PI;
      const bump = 1 + 0.18 * Math.sin(k * 2.3);
      pts.push([x + Math.cos(a) * wid * 0.5 * bump, y + Math.sin(a) * hgt * bump]);
    }
    pts.push([x + wid * 0.48, y + hgt * 0.25], [x - wid * 0.48, y + hgt * 0.25]);
    S(pts, '#ffffff', '#c8d4e4', 2.6);
    const arcs = [];
    for (let k = 0; k < 5; k++) {
      const cx = x - wid * 0.38 + (k * wid * 0.76) / 4;
      const cy = y - hgt * (0.25 + 0.35 * Math.sin((k / 4) * Math.PI));
      const r = hgt * 0.38;
      const arc = [];
      for (let j = 0; j <= 8; j++) {
        const a = Math.PI * 1.05 + (j / 8) * Math.PI * 0.9;
        arc.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      arcs.push(arc);
    }
    paint(arcs, 'rgba(110,120,150,0.55)', 1.2);
  };

  // Outline of the glass: cusped badge head narrowing over shoulders onto the straight-sided light
  const outline = [
    [97, 1722],
    [97, 560],
    [104, 520],
    [140, 474],
    [132, 380],
    [150, 300],
    [200, 230],
    [268, 186],
    [336, 230],
    [386, 300],
    [404, 380],
    [396, 474],
    [430, 520],
    [435, 560],
    [435, 1722]
  ];
  const outlinePath = smooth(outline);

  clipTo(outlinePath, () => {
    // ---- Lilac wings parting from the badge ----
    const divider = [
      [272, 480],
      [300, 540],
      [296, 600],
      [262, 660],
      [255, 705]
    ];
    const leftWing = [[97, 470], [272, 470], ...divider, [140, 860], [97, 920]];
    const rightWing = [[272, 470], [440, 470], [440, 900], [400, 860], [255, 705], ...divider.slice().reverse()];
    P(leftWing, '#e2d6f4', '#9a86c4', 3.4);
    P(rightWing, '#ddd0f2', '#9480c0', 3.4);
    const feathers = (path, x0, x1, y0, y1, dir) =>
      clipTo(polyPath(path), () => {
        const lines = [];
        for (let k = -30; k < 40; k++) {
          const bx = x0 + k * 9;
          const ln = [];
          for (let j = 0; j <= 10; j++) {
            const t = j / 10;
            ln.push([bx + dir * (t * t * (x1 - x0) * 0.7 + Math.sin(t * 2.6) * 22), y0 + t * (y1 - y0)]);
          }
          lines.push(ln);
        }
        paint(lines, 'rgba(60,40,100,0.55)', 1.4);
      });
    feathers(leftWing, 97, 300, 470, 930, -1);
    feathers(rightWing, 260, 440, 470, 930, 1);

    // ---- Starry sky fading to the dawn glow ----
    const skyPath = [
      [255, 705],
      [140, 860],
      [97, 920],
      [97, 1260],
      [435, 1260],
      [435, 900],
      [400, 860]
    ];
    const skyGrad = ctx.createLinearGradient(0, 705, 0, 1200);
    skyGrad.addColorStop(0, '#0c22c0');
    skyGrad.addColorStop(0.35, '#1c48e0');
    skyGrad.addColorStop(0.6, '#5c96ec');
    skyGrad.addColorStop(0.8, '#b8d8f4');
    skyGrad.addColorStop(1, '#f6eea8');
    piece(polyPath(skyPath), skyGrad, 3.2);
    for (const [x, y, r] of [
      [256, 722, 9],
      [228, 768, 11],
      [284, 768, 8],
      [176, 800, 9],
      [246, 842, 8],
      [300, 818, 7],
      [336, 796, 9],
      [256, 884, 9],
      [298, 902, 10]
    ])
      star(x, y, r);
    cloud(182, 858, 100, 26);
    cloud(338, 862, 110, 28);
    cloud(326, 1000, 210, 40);
    cloud(214, 1100, 150, 36);
    cloud(384, 1090, 110, 30);

    // ---- Lilac crags framing the sky, a peak in the centre ----
    const crag = (pts, seed) => {
      P(pts, '#ddd0ee', '#8e7cb8', 3.4);
      const r = mulberry32(seed);
      const [x0, y0, x1, y1] = bbox(pts);
      clipTo(polyPath(pts), () => {
        const lines = [];
        for (let k = 0; k < 70; k++) {
          const x = x0 + r() * (x1 - x0);
          const y = y0 + r() * (y1 - y0);
          lines.push([
            [x, y],
            [x + (r() - 0.5) * 6, y + 18 + r() * 30],
            [x + 8 + r() * 6, y + 26 + r() * 34]
          ]);
        }
        paint(lines, 'rgba(70,50,110,0.6)', 1.3);
      });
    };
    P(
      [
        [95, 1240],
        [437, 1240],
        [437, 1520],
        [95, 1520]
      ],
      '#b8a8dc',
      '#8e7cb8',
      0
    );
    crag(
      [
        [97, 1060],
        [130, 1040],
        [150, 1070],
        [178, 1062],
        [196, 1120],
        [228, 1150],
        [244, 1196],
        [252, 1280],
        [97, 1440]
      ],
      11
    );
    crag(
      [
        [435, 1080],
        [400, 1100],
        [372, 1150],
        [330, 1160],
        [300, 1190],
        [262, 1200],
        [252, 1280],
        [435, 1430]
      ],
      12
    );
    // Central peak, palest at its snowy summit
    P(
      [
        [250, 1286],
        [300, 1340],
        [360, 1400],
        [425, 1450],
        [250, 1440],
        [100, 1452],
        [170, 1380],
        [212, 1330]
      ],
      '#f4f2f8',
      '#8c88b8',
      3.4
    );
    paint(
      [
        [
          [250, 1290],
          [236, 1340],
          [214, 1400]
        ],
        [
          [252, 1292],
          [270, 1350],
          [300, 1410]
        ],
        [
          [246, 1310],
          [250, 1380],
          [244, 1430]
        ]
      ],
      'rgba(80,70,130,0.5)',
      1.4
    );

    // ---- "TO THE GLORY OF GOD" on the pale band, the lake below ----
    P(
      [
        [100, 1452],
        [250, 1428],
        [428, 1452],
        [402, 1508],
        [250, 1530],
        [110, 1506]
      ],
      '#fbf9ee',
      '#e6e0cc',
      3.2
    );
    ctx.save();
    ctx.fillStyle = '#1e1a16';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "26px Georgia, 'Times New Roman', serif";
    ctx.fillText('TO THE', 254, 1456);
    ctx.fillText('GLORY OF GOD', 254, 1490);
    ctx.restore();
    P(
      [
        [110, 1506],
        [250, 1530],
        [402, 1508],
        [252, 1628]
      ],
      '#b4b4dc',
      '#5c5c94',
      3.2
    );
    paint(
      [
        [
          [160, 1540],
          [250, 1548],
          [340, 1536]
        ],
        [
          [190, 1566],
          [250, 1574],
          [312, 1564]
        ],
        [
          [220, 1594],
          [252, 1600],
          [284, 1592]
        ]
      ],
      'rgba(240,240,255,0.6)',
      1.4
    );

    // ---- Green glass with the swirling script ----
    for (const s of [-1, 1]) {
      const edge = s < 0 ? 97 : 435;
      const inner = s < 0 ? 110 : 402;
      P(
        [
          [edge, 1500],
          [inner, 1508],
          [252, 1628],
          [252, 1694],
          [edge, 1694]
        ],
        '#c8eccc',
        '#78c08c',
        3.2
      );
    }
    ctx.save();
    ctx.fillStyle = '#1a2a1c';
    ctx.textBaseline = 'middle';
    ctx.font = "italic 30px 'Palatino Linotype', Georgia, serif";
    ctx.textAlign = 'left';
    ctx.fillText('for', 102, 1566);
    ctx.fillText('those', 104, 1608);
    ctx.fillText('that', 150, 1652);
    ctx.textAlign = 'right';
    ctx.fillText('skies', 430, 1566);
    ctx.fillText('the', 404, 1608);
    ctx.fillText('love', 386, 1652);
    ctx.font = '10px Georgia, serif';
    ctx.fillText('J.A.N.', 428, 1684);
    ctx.restore();
    // Curling flourishes around the script
    const spiral = (x, y, r, turns, dir) => {
      const pts = [];
      for (let k = 0; k <= 40; k++) {
        const t = k / 40;
        const a = dir * t * turns * Math.PI * 2;
        pts.push([x + Math.cos(a) * r * (1 - t * 0.85), y + Math.sin(a) * r * (1 - t * 0.85)]);
      }
      return pts;
    };
    paint(
      [
        spiral(128, 1530, 16, 1.6, 1),
        spiral(226, 1664, 12, 1.4, -1),
        spiral(404, 1530, 16, 1.6, -1),
        spiral(282, 1664, 12, 1.4, 1),
        spiral(200, 1600, 9, 1.2, 1),
        spiral(340, 1600, 9, 1.2, -1)
      ],
      'rgba(30,60,30,0.7)',
      1.6
    );

    // ---- Name band along the foot ----
    P(
      [
        [95, 1694],
        [437, 1694],
        [437, 1724],
        [95, 1724]
      ],
      '#7cc4f4',
      '#3c90dc',
      3
    );
    ctx.save();
    ctx.fillStyle = '#10223c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "17px Georgia, 'Times New Roman', serif";
    ctx.fillText('RICHARD JAMES WILSON 1938-2007', 266, 1710);
    ctx.restore();

    // ---- RAF badge on deep blue among gold stars ----
    P(
      [
        [80, 170],
        [460, 170],
        [460, 482],
        [80, 482]
      ],
      '#1626a8',
      '#0a1478',
      3
    );
    for (const [x, y] of [
      [166, 282],
      [146, 336],
      [150, 388],
      [190, 470],
      [370, 282],
      [386, 330],
      [384, 384],
      [352, 462],
      [214, 252],
      [324, 252]
    ])
      star(x, y, 8, '#f6d24a');
    const cx = 266;
    const cy = 392;
    const ring = (rx, ry) => () => ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    piece(ring(112, 100), glass(cx - 112, cy - 100, cx + 112, cy + 100, '#3048c8', '#14228a'), 4);
    ctx.save();
    ctx.strokeStyle = '#f2d25a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ring(106, 94)();
    ctx.stroke();
    ctx.beginPath();
    ring(78, 70)();
    ctx.stroke();
    ctx.restore();
    piece(ring(76, 68), glass(cx, cy - 68, cx, cy + 68, '#9cb4f4', '#2e4ed0'), 3);
    // Motto round the ring: PER (up the left), ARDUA AD (over the top), ASTRA (down the right)
    ctx.save();
    ctx.fillStyle = '#fbf4dc';
    ctx.font = "bold 22px Georgia, 'Times New Roman', serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const motto = 'PER ARDUA AD ASTRA';
    const a0 = Math.PI * 0.82;
    const a1 = Math.PI * 2.18;
    [...motto].forEach((ch, i) => {
      const a = a0 + ((i + 0.5) / motto.length) * (a1 - a0);
      ctx.save();
      ctx.translate(cx + Math.cos(a) * 92, cy + Math.sin(a) * 82);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
    ctx.restore();
    // Gold eagle with outspread wings across the ring
    for (const s of [-1, 1]) {
      const wing = [
        [cx + s * 10, 372],
        [cx + s * 60, 356],
        [cx + s * 98, 350],
        [cx + s * 90, 368],
        [cx + s * 80, 384],
        [cx + s * 40, 392],
        [cx + s * 12, 394]
      ];
      S(wing, '#fff2a8', '#d4a62c', 2.6);
      const quills = [];
      for (let k = 0; k < 7; k++) {
        const x = cx + s * (26 + k * 10);
        quills.push([
          [x, 362],
          [x + s * 8, 386]
        ]);
      }
      paint(quills, 'rgba(120,80,10,0.7)', 1.2);
    }
    S(
      [
        [cx - 14, 368],
        [cx + 12, 366],
        [cx + 14, 392],
        [cx + 20, 418],
        [cx - 20, 418],
        [cx - 14, 392]
      ],
      '#fff0a0',
      '#d0a028',
      2.6
    );
    S(
      [
        [cx - 24, 362],
        [cx - 8, 352],
        [cx + 4, 362],
        [cx - 10, 372]
      ],
      '#fff4b8',
      '#d8aa34',
      2.2
    );
    // Laurel sprig at the foot of the ring
    for (let k = 0; k < 4; k++) {
      S(
        [
          [cx - 30 + k * 14, 466],
          [cx - 22 + k * 14, 458],
          [cx - 14 + k * 14, 466],
          [cx - 22 + k * 14, 472]
        ],
        '#f6d24a',
        '#c8901c',
        1.6
      );
    }
    // Crown: gold band & arches over crimson, cross on top
    S(
      [
        [cx - 44, 228],
        [cx - 30, 206],
        [cx, 214],
        [cx + 30, 206],
        [cx + 44, 228],
        [cx + 40, 270],
        [cx - 40, 270]
      ],
      '#f04040',
      '#a01818',
      3
    );
    P(
      [
        [cx - 46, 266],
        [cx + 46, 266],
        [cx + 44, 288],
        [cx - 44, 288]
      ],
      '#fbe27a',
      '#c8901c',
      2.6
    );
    paint(
      [
        [
          [cx - 40, 266],
          [cx - 36, 222],
          [cx - 14, 210],
          [cx, 214]
        ],
        [
          [cx + 40, 266],
          [cx + 36, 222],
          [cx + 14, 210],
          [cx, 214]
        ],
        [
          [cx, 214],
          [cx, 266]
        ]
      ],
      '#f2c844',
      4
    );
    P(
      [
        [cx - 4, 190],
        [cx + 4, 190],
        [cx + 4, 198],
        [cx + 12, 198],
        [cx + 12, 204],
        [cx + 4, 204],
        [cx + 4, 214],
        [cx - 4, 214],
        [cx - 4, 204],
        [cx - 12, 204],
        [cx - 12, 198],
        [cx - 4, 198]
      ],
      '#fbe27a',
      '#c8901c',
      1.8
    );
  });

  ctx.save();
  ctx.beginPath();
  outlinePath();
  ctx.strokeStyle = '#1d1a17';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  addAntiqueGlassMottle(ctx, w, h, 2011, 0.05);
  return canvasTexture(c, { anisotropy: maxAniso });
}
