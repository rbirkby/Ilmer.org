import { canvas2d, canvasTexture, makeCanvas, mulberry32 } from './canvas-utils.ts';

// Procedurally painted interior wall memorials of St Peter's Church, Ilmer:
//  - A7: Carved oak plaque to Robert Harold Attenborough (1880–1968)
//  - Roll of Honour: Great War memorial stone tablet (South Nave wall)
//  - A4: Framed hand-lettered List of Donors for Mrs Jaques's Memorial Window

interface TextRun {
  t: string;
  sup?: boolean;
}

type FontForSize = (size: number) => string;

type RunAlign = 'center' | 'left' | 'right';

type RunPaint = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number) => void;

interface PlaqueMaps {
  map: ReturnType<typeof canvasTexture>;
  bumpMap: ReturnType<typeof canvasTexture>;
}

// Measure a run list: [{ t: 'TEXT', sup?: true }]
function measureRuns(ctx: CanvasRenderingContext2D, runs: TextRun[], font: FontForSize, size: number) {
  let total = 0;
  for (const r of runs) {
    ctx.font = font(r.sup ? size * 0.58 : size);
    total += ctx.measureText(r.t).width;
  }
  return total;
}

// Draw a line made of text runs (with optional superscripts), squeezed to maxWidth if needed.
// align: 'center' | 'left' | 'right'. paint(ctx, text, x, y) does the actual drawing per run.
function drawRuns(
  ctx: CanvasRenderingContext2D,
  runs: TextRun[],
  x: number,
  y: number,
  size: number,
  font: FontForSize,
  maxWidth: number,
  align: RunAlign,
  paint: RunPaint
) {
  const natural = measureRuns(ctx, runs, font, size);
  const squeeze = natural > maxWidth ? maxWidth / natural : 1;
  const width = natural * squeeze;
  let cursor = align === 'center' ? x - width * 0.5 : align === 'right' ? x - width : x;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (const r of runs) {
    const s = r.sup ? size * 0.58 : size;
    ctx.font = font(s);
    const w = ctx.measureText(r.t).width;
    ctx.save();
    ctx.translate(cursor, r.sup ? y - size * 0.38 : y);
    ctx.scale(squeeze, 1);
    paint(ctx, r.t, 0, 0);
    ctx.restore();
    cursor += w * squeeze;
  }
  ctx.restore();
}

// Paint incised (V-cut) lettering: dark shadowed groove, a light lower-right catch edge, and darkened fill
function incisedPainter(shadow: string, catchLight: string, fill: string): RunPaint {
  return (ctx: CanvasRenderingContext2D, text: string, x: number, y: number) => {
    ctx.fillStyle = catchLight;
    ctx.fillText(text, x + 1.4, y + 1.8);
    ctx.fillStyle = shadow;
    ctx.fillText(text, x - 0.8, y - 1.0);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  };
}

// Draw a line on both colour & bump canvases using the same transform logic
function drawIncisedLine(
  ctx: CanvasRenderingContext2D,
  bctx: CanvasRenderingContext2D,
  runs: TextRun[],
  x: number,
  y: number,
  size: number,
  font: FontForSize,
  maxWidth: number,
  align: RunAlign,
  paintColor: RunPaint
) {
  drawRuns(ctx, runs, x, y, size, font, maxWidth, align, paintColor);
  drawRuns(bctx, runs, x, y, size, font, maxWidth, align, (c, t, px, py) => {
    c.fillStyle = '#1e1e1e';
    c.fillText(t, px, py);
  });
}

// -------------------------------------------------------------------------
// A7: Carved oak memorial plaque — Robert Harold Attenborough
// -------------------------------------------------------------------------
export function createAttenboroughPlaqueMaps(maxAniso = 8): PlaqueMaps {
  const w = 1320;
  const h = 640;
  const col = makeCanvas(w, h);
  const bmp = makeCanvas(w, h);
  const ctx = canvas2d(col);
  const bctx = canvas2d(bmp);
  const rand = mulberry32(1968);

  // Limed / weathered mid-oak base
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, '#8a7b5c');
  base.addColorStop(0.5, '#93845f');
  base.addColorStop(1, '#7f7155');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#9a9a9a';
  bctx.fillRect(0, 0, w, h);

  // Gently sloping quarter-sawn oak grain with medullary ray flecks
  ctx.save();
  for (let i = 0; i < 260; i++) {
    const y0 = rand() * (h + 300) - 150;
    const slope = -0.12 + rand() * 0.06;
    const amp = 2 + rand() * 6;
    const freq = 0.004 + rand() * 0.006;
    const dark = rand() > 0.45;
    ctx.strokeStyle = dark ? `rgba(58,46,28,${0.1 + rand() * 0.18})` : `rgba(196,182,146,${0.06 + rand() * 0.1})`;
    ctx.lineWidth = 0.8 + rand() * 2.2;
    bctx.strokeStyle = dark ? 'rgba(70,70,70,0.25)' : 'rgba(190,190,190,0.2)';
    bctx.lineWidth = ctx.lineWidth;
    ctx.beginPath();
    bctx.beginPath();
    for (let x = 0; x <= w; x += 12) {
      const y = y0 + x * slope + Math.sin(x * freq + i) * amp;
      if (x === 0) {
        ctx.moveTo(x, y);
        bctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
        bctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    bctx.stroke();
  }
  for (let i = 0; i < 180; i++) {
    const x = rand() * w;
    const y = rand() * h;
    ctx.fillStyle = `rgba(206,192,152,${0.08 + rand() * 0.1})`;
    ctx.fillRect(x, y, 6 + rand() * 18, 1.5 + rand() * 1.5);
  }
  ctx.restore();

  // Moulded chamfered edge: light top/left bevel, dark bottom/right
  const bevel = 22;
  ctx.save();
  ctx.fillStyle = 'rgba(214,200,160,0.28)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w - bevel, bevel);
  ctx.lineTo(bevel, bevel);
  ctx.lineTo(bevel, h - bevel);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(30,22,12,0.34)';
  ctx.beginPath();
  ctx.moveTo(w, h);
  ctx.lineTo(0, h);
  ctx.lineTo(bevel, h - bevel);
  ctx.lineTo(w - bevel, h - bevel);
  ctx.lineTo(w - bevel, bevel);
  ctx.lineTo(w, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,30,16,0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(bevel, bevel, w - bevel * 2, h - bevel * 2);
  ctx.restore();
  bctx.fillStyle = '#d8d8d8';
  bctx.fillRect(0, 0, w, bevel);
  bctx.fillRect(0, 0, bevel, h);
  bctx.fillStyle = '#5a5a5a';
  bctx.fillRect(0, h - bevel, w, bevel);
  bctx.fillRect(w - bevel, 0, bevel, h);

  // Carved Arts-and-Crafts roman capitals (dark incised grooves with gilt-catching lower edges)
  const font = (s: number) =>
    `600 ${s}px "Copperplate", "Copperplate Gothic Light", "Trajan Pro", "Times New Roman", serif`;
  const painter = incisedPainter('rgba(28,20,8,0.9)', 'rgba(222,200,140,0.75)', '#4a3a1c');
  const cx = w * 0.5;
  const maxW = w - 150;
  const lines = [
    {
      runs: [{ t: 'THESE FOUR 18' }, { t: 'TH', sup: true }, { t: ' CENTURY CARVINGS WERE DEDICATED' }],
      y: 150,
      s: 40
    },
    { runs: [{ t: 'TO THE GLORY OF GOD' }], y: 228, s: 40 },
    { runs: [{ t: 'AND IN LOVING MEMORY OF' }], y: 306, s: 40 },
    { runs: [{ t: 'ROBERT HAROLD ATTENBOROUGH' }], y: 400, s: 66 },
    { runs: [{ t: '(1880 – 1968) OF ILMER HOUSE' }], y: 490, s: 58 },
    { runs: [{ t: 'BY HIS WIFE, CHILDREN AND GRANDCHILDREN' }], y: 566, s: 36 }
  ];
  for (const ln of lines) {
    drawIncisedLine(ctx, bctx, ln.runs, cx, ln.y, ln.s, font, maxW, 'center', painter);
  }

  return {
    map: canvasTexture(col, { anisotropy: maxAniso }),
    bumpMap: canvasTexture(bmp, { srgb: false, anisotropy: maxAniso })
  };
}

// -------------------------------------------------------------------------
// Roll of Honour: Great War memorial stone tablet
// -------------------------------------------------------------------------
export function createRollOfHonourMaps(maxAniso = 8): PlaqueMaps {
  const w = 1600;
  const h = 980;
  const col = makeCanvas(w, h);
  const bmp = makeCanvas(w, h);
  const ctx = canvas2d(col);
  const bctx = canvas2d(bmp);
  const rand = mulberry32(1918);

  // Cool grey-buff limestone / Hopton Wood stone with soft mottling and darker weathered edges
  ctx.fillStyle = '#8f8a7e';
  ctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#9c9c9c';
  bctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 6 + rand() * 60;
    const light = rand() > 0.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, light ? 'rgba(196,190,174,0.12)' : 'rgba(76,72,62,0.1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Fine speckle grain (colour + bump)
  for (let i = 0; i < 14000; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const v = rand();
    ctx.fillStyle = v > 0.5 ? 'rgba(210,204,190,0.18)' : 'rgba(60,56,48,0.16)';
    ctx.fillRect(x, y, 1.6, 1.6);
    const b = (120 + v * 70) | 0;
    bctx.fillStyle = `rgb(${b},${b},${b})`;
    bctx.fillRect(x, y, 1.6, 1.6);
  }
  const vign = ctx.createRadialGradient(w * 0.5, h * 0.48, h * 0.3, w * 0.5, h * 0.5, w * 0.62);
  vign.addColorStop(0, 'rgba(0,0,0,0)');
  vign.addColorStop(1, 'rgba(40,36,28,0.32)');
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, w, h);

  // Chamfered sunk margin around the inscribed field
  const m = 34;
  ctx.fillStyle = 'rgba(220,214,198,0.22)';
  ctx.fillRect(0, 0, w, m);
  ctx.fillRect(0, 0, m, h);
  ctx.fillStyle = 'rgba(30,26,20,0.3)';
  ctx.fillRect(0, h - m, w, m);
  ctx.fillRect(w - m, 0, m, h);
  ctx.strokeStyle = 'rgba(40,36,28,0.4)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(m, m, w - m * 2, h - m * 2);
  bctx.fillStyle = '#d0d0d0';
  bctx.fillRect(0, 0, w, m);
  bctx.fillRect(0, 0, m, h);
  bctx.fillStyle = '#585858';
  bctx.fillRect(0, h - m, w, m);
  bctx.fillRect(w - m, 0, m, h);

  // Incised, darkened Arts-and-Crafts sans capitals
  const font = (s: number) => `500 ${s}px "Gill Sans", "Gill Sans MT", Optima, Candara, "Trebuchet MS", sans-serif`;
  const painter = incisedPainter('rgba(18,16,12,0.85)', 'rgba(214,208,192,0.55)', '#2f2b24');
  const left = 92;
  const right = w - 92;
  const cx = w * 0.5;
  const full = right - left;

  drawIncisedLine(ctx, bctx, [{ t: 'IN LOVING MEMORY OF' }], cx, 132, 56, font, full, 'center', painter);

  const entries = [
    {
      name: [{ t: 'AUBREY · S · GOMME.' }],
      unit: [{ t: '21' }, { t: 'ST', sup: true }, { t: ' CANADIAN BATTALION' }],
      detail: [{ t: 'KILLED IN ACTION IN FRANCE APRIL 9' }, { t: 'TH', sup: true }, { t: ' 1917 AGED 24' }]
    },
    {
      name: [{ t: 'WILLIAM · J · CLAYDON ·' }],
      unit: [{ t: 'OXFORD & BUCKS L.I.' }],
      detail: [{ t: 'WOUNDED AND MISSING SINCE APRIL 28' }, { t: 'TH', sup: true }, { t: ' 1917   AGED 20' }]
    },
    {
      name: [{ t: 'FRANK · P · KINGHAM ·' }],
      unit: [{ t: 'GLOUCESTER REG' }, { t: 'T', sup: true }],
      detail: [{ t: 'WOUNDED AND MISSING SINCE AUG 27' }, { t: 'TH', sup: true }, { t: ' 1917   AGED 21' }]
    },
    {
      name: [{ t: 'ALBERT RICHARDSON' }],
      unit: [{ t: 'CORPORAL 13' }, { t: 'TH', sup: true }, { t: ' K.R.R.' }],
      detail: [
        { t: 'DIED OF WOUNDS IN FRANCE SEP' },
        { t: 'T', sup: true },
        { t: ' 11' },
        { t: 'TH', sup: true },
        { t: ' 1918 AGED 23' }
      ]
    }
  ];

  let y = 222;
  for (const e of entries) {
    drawIncisedLine(ctx, bctx, e.name, left, y, 50, font, full * 0.5, 'left', painter);
    drawIncisedLine(ctx, bctx, e.unit, right, y, 42, font, full * 0.46, 'right', painter);
    drawIncisedLine(ctx, bctx, e.detail, cx, y + 58, 38, font, full, 'center', painter);
    y += 162;
  }

  drawIncisedLine(
    ctx,
    bctx,
    [{ t: 'WHO GAVE THEIR LIVES FOR THEIR COUNTRY IN THE GREAT WAR' }],
    cx,
    h - 92,
    42,
    font,
    full,
    'center',
    painter
  );

  return {
    map: canvasTexture(col, { anisotropy: maxAniso }),
    bumpMap: canvasTexture(bmp, { srgb: false, anisotropy: maxAniso })
  };
}

// -------------------------------------------------------------------------
// A4: Framed List of Donors — Memorial Window to Mrs Jaques
// (the dark moulded frame itself is 3D geometry; this is the mount & hand-lettered sheet)
// -------------------------------------------------------------------------
const DONOR_COLUMNS = [
  [
    'Mrs C. Adams',
    'Mrs Antram',
    'Mr W.J. Allaway',
    'Miss Bailey',
    'Mr & Mrs F. Baker',
    'Mrs W. Baker',
    'Mrs G. Barnard',
    'Mrs Beechey',
    'Mrs Belgrove',
    'Mrs T. Belgrove & Family',
    'Captain Bellis',
    'The Revd & Mrs Berry',
    'Mrs Biggs',
    'Miss Bird',
    'Mr & Mrs Boswell',
    'Mr A.H. Bliss',
    'Mr Bowerman',
    'Mrs Brooks',
    'F.H.B.',
    'W.H.B.',
    'Mrs Chester',
    'Mrs Chilton',
    'Mr G. Claydon',
    'Mr & Mrs J. Claydon & Family',
    'Mrs Cooper',
    'Mrs Cowdray',
    'Mr Dannatt',
    'Mrs Denton',
    'Mr & Mrs Dickson',
    'Mr & Mrs Disraeli',
    'D.O. & T.O.',
    'Mr & Mrs Fieldwick',
    'Mr F. Folley',
    'Miss G. Folley',
    'Mrs W. Folley',
    'Miss M. Gamlen',
    'Miss C. Gamlen',
    'Miss Gedge',
    'Mrs Goff',
    'Mr G. Gomme',
    'Mrs G. Gomme',
    'Miss Gomme',
    'Mr C.A. Goldingham'
  ],
  [
    'Miss R. Gomme',
    'Mrs A. Goodchild',
    'Mr A. Goodchild',
    'Mr A. Goodchild',
    'Mr E.A. Goodchild',
    'Mrs T. Goodchild',
    'Mrs E. Green',
    'Miss Gurney',
    'A.G.',
    'Mr A. Howard',
    'Mrs Humble',
    'Mrs Alice Ives',
    "Ilmer Mothers' Union",
    'Mr E. Jaques',
    'Mrs E. Jaques',
    'Mr G. Jacobs',
    'Mrs Jackman',
    'Miss Jeffkin',
    'Mrs Johnson',
    'Miss Johnson',
    'Miss Kempson',
    'Mrs Kingham',
    'Mrs W. Kingham',
    'Mr E. Lacey',
    'Longwick School',
    'Longwick Church S. School',
    "Longwick Women's Institute",
    'Mrs Mathews',
    'Mr Mackintosh',
    'Mr A.H. Mead',
    'Mr J.W. Miller',
    'Mr & Mrs T.B. Morriss',
    'Miss L. Nelms',
    "The Rev. W. O'Connor",
    'Miss F. Pearmain',
    'Mrs Perceval',
    'The Misses Philps',
    'Mr J.G. Pitchford',
    'Mr & Mrs Pope',
    'Mr Powell',
    'Mr & Mrs E.G. Pursell',
    'Mr & Mrs G. Quint',
    'Miss C.M. Goldingham'
  ],
  [
    'Mr & Mrs G.H. Quint',
    'Mrs Randall',
    'Mr & Mrs F. Randall',
    'The Revd Ray',
    'Mr Stratfold Read',
    'Mrs Richardson',
    'Miss E. Ridgeley & Sisters',
    'Mrs Rixon',
    'Mr R. Roberts',
    'Mr Silsby',
    'Mr & Mrs Skilbeck',
    'Mrs Small',
    'Mrs Smith',
    'Mrs Stone',
    'Mrs Stone',
    'Mrs Stratton',
    'Mrs Syred',
    'Mrs Tapping',
    'Miss Taylor',
    'Mrs Hicks Tempest',
    'Mrs Thompson',
    'The Rev W. Tuke',
    'Mrs J. Walker',
    'Mr W. Walker & Family',
    'Mr & Mrs Ward',
    'Mrs Way',
    'Mr Webb',
    'Mrs West & Family',
    'Miss M. West',
    'Mrs E. White',
    'Mrs Williams',
    'Mrs Williams',
    'Mrs L. Williams',
    'Miss G. Williams',
    'Miss N. Williams',
    'Dr & Mrs Wills',
    'Witcher Bros.',
    'Mr A.B. Witney',
    'Miss Witton',
    'Mrs Wooster',
    '    and',
    'Others'
  ]
];

export function createJaquesDonorsTexture(maxAniso = 8): ReturnType<typeof canvasTexture> {
  const w = 1024;
  const h = 1536;
  const c = makeCanvas(w, h);
  const ctx = canvas2d(c);
  const rand = mulberry32(1933);

  // Pale grey-green card mount, slightly aged, with a few foxing spots
  const mount = ctx.createLinearGradient(0, 0, w, h);
  mount.addColorStop(0, '#e6e9e3');
  mount.addColorStop(0.6, '#dfe3dc');
  mount.addColorStop(1, '#d6dad2');
  ctx.fillStyle = mount;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 8 + rand() * 50;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rand() > 0.5 ? 'rgba(255,255,250,0.08)' : 'rgba(140,140,120,0.06)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Damp foxing at lower-left (visible in the photograph)
  for (let i = 0; i < 40; i++) {
    const x = 20 + rand() * 110;
    const y = h - 260 + rand() * 230;
    ctx.fillStyle = `rgba(150,140,110,${0.06 + rand() * 0.12})`;
    ctx.beginPath();
    ctx.arc(x, y, 2 + rand() * 9, 0, Math.PI * 2);
    ctx.fill();
  }
  // Inner bevel shadow where the mount meets the frame
  ctx.strokeStyle = 'rgba(60,60,50,0.28)';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, w - 10, h - 10);

  // Lettered sheet: off-white paper panel with gold & green twisted-rope double border
  const x0 = 142;
  const x1 = w - 142;
  const y0 = 160;
  const y1 = h - 190;
  ctx.fillStyle = '#f4f3ec';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  const ropeRect = (inset: number): [number, number, number, number] => {
    const rx0 = x0 + inset;
    const ry0 = y0 + inset;
    const rx1 = x1 - inset;
    const ry1 = y1 - inset;
    return [rx0, ry0, rx1, ry1];
  };
  const drawRopeEdge = (ax: number, ay: number, bx: number, by: number) => {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.floor(len / 9);
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    ctx.strokeStyle = '#4d5a2c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax - uy * 5, ay + ux * 5);
    ctx.lineTo(bx - uy * 5, by + ux * 5);
    ctx.moveTo(ax + uy * 5, ay - ux * 5);
    ctx.lineTo(bx + uy * 5, by - ux * 5);
    ctx.stroke();
    ctx.strokeStyle = '#b8962e';
    ctx.lineWidth = 2.4;
    for (let i = 0; i < n; i++) {
      const px = ax + ux * i * 9;
      const py = ay + uy * i * 9;
      ctx.beginPath();
      ctx.moveTo(px - uy * 4 - ux * 3, py + ux * 4 - uy * 3);
      ctx.lineTo(px + uy * 4 + ux * 3, py - ux * 4 + uy * 3);
      ctx.stroke();
    }
  };
  const [bx0, by0, bx1, by1] = ropeRect(18);
  drawRopeEdge(bx0, by0, bx1, by0);
  drawRopeEdge(bx1, by0, bx1, by1);
  drawRopeEdge(bx1, by1, bx0, by1);
  drawRopeEdge(bx0, by1, bx0, by0);
  // Corner diamonds
  ctx.fillStyle = '#2e3420';
  for (const [qx, qy] of [
    [bx0, by0],
    [bx1, by0],
    [bx1, by1],
    [bx0, by1]
  ]) {
    ctx.beginPath();
    ctx.moveTo(qx, qy - 9);
    ctx.lineTo(qx + 9, qy);
    ctx.lineTo(qx, qy + 9);
    ctx.lineTo(qx - 9, qy);
    ctx.closePath();
    ctx.fill();
  }

  // Title (Art Nouveau capitals with enlarged initials)
  const titleY = by0 + 92;
  const ruleY = by0 + 170;
  const titleFont = (s: number) =>
    `${s}px "Luminari", "Papyrus", "Herculanum", "Palatino Linotype", Palatino, Georgia, serif`;
  ctx.fillStyle = '#1f1d18';
  const titleRuns = (text: string, big: number) =>
    text.split(' ').flatMap((word, i, arr) => {
      const runs = [
        { t: word[0], s: big },
        { t: word.slice(1), s: big * 0.74 }
      ];
      if (i < arr.length - 1) runs.push({ t: ' ', s: big * 0.74 });
      return runs;
    });
  const drawTitle = (text: string, y: number, big: number) => {
    const runs = titleRuns(text, big);
    let total = 0;
    for (const r of runs) {
      ctx.font = titleFont(r.s);
      total += ctx.measureText(r.t).width;
    }
    const maxW = bx1 - bx0 - 60;
    const sq = Math.min(1, maxW / total);
    let cur = w * 0.5 - (total * sq) / 2;
    for (const r of runs) {
      ctx.font = titleFont(r.s);
      ctx.save();
      ctx.translate(cur, y);
      ctx.scale(sq, 1);
      ctx.fillText(r.t, 0, 0);
      ctx.restore();
      cur += ctx.measureText(r.t).width * sq;
    }
  };
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  drawTitle('MEMORIAL WINDOW TO MRS. JAQUES', titleY, 46);
  drawTitle('LIST OF DONORS', titleY + 58, 40);
  drawRopeEdge(bx0, ruleY, bx1, ruleY);

  // Three columns of hand-lettered donor names
  const nameFont = '21px "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
  ctx.font = nameFont;
  ctx.fillStyle = '#26231d';
  const colX = [bx0 + 26, bx0 + 26 + (bx1 - bx0) / 3, bx0 + 26 + ((bx1 - bx0) * 2) / 3];
  const colMax = (bx1 - bx0) / 3 - 30;
  const rowTop = ruleY + 40;
  const rowH = (by1 - 18 - rowTop) / 43;
  DONOR_COLUMNS.forEach((names, ci) => {
    names.forEach((name, ri) => {
      ctx.fillText(name, colX[ci], rowTop + ri * rowH, colMax);
    });
  });

  // Faint diagonal glass reflection across the glazed frame
  const glare = ctx.createLinearGradient(w * 0.55, h * 0.62, w * 0.95, h * 0.5);
  glare.addColorStop(0, 'rgba(255,255,255,0)');
  glare.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  glare.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save();
  ctx.translate(w * 0.75, h * 0.56);
  ctx.rotate(-0.42);
  ctx.fillStyle = glare;
  ctx.fillRect(-260, -6, 520, 12);
  ctx.restore();

  return canvasTexture(c, { anisotropy: maxAniso });
}
