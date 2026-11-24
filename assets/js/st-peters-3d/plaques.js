import { canvasTexture, makeCanvas, mulberry32 } from '/assets/js/st-peters-3d/canvas-utils.js';

// Procedurally painted interior wall memorials of St Peter's Church, Ilmer:
//  - A7: Carved oak plaque to Robert Harold Attenborough (1880–1968)
//  - Roll of Honour: Great War memorial stone tablet (South Nave wall)
//  - A4: Framed hand-lettered List of Donors for Mrs Jaques's Memorial Window

// Measure a run list: [{ t: 'TEXT', sup?: true }]
function measureRuns(ctx, runs, font, size) {
  let total = 0;
  for (const r of runs) {
    ctx.font = font(r.sup ? size * 0.58 : size);
    total += ctx.measureText(r.t).width;
  }
  return total;
}

// Draw a line made of text runs (with optional superscripts), squeezed to maxWidth if needed.
// align: 'center' | 'left' | 'right'. paint(ctx, text, x, y) does the actual drawing per run.
function drawRuns(ctx, runs, x, y, size, font, maxWidth, align, paint) {
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

// Paint incised (V-cut) lettering: dark shadowed groove, a light lower-right catch edge, and a bump-map groove
function incisedPainter(shadow, catchLight, fill, bctx) {
  return {
    color(ctx, text, x, y) {
      ctx.fillStyle = catchLight;
      ctx.fillText(text, x + 1.4, y + 1.8);
      ctx.fillStyle = shadow;
      ctx.fillText(text, x - 0.8, y - 1.0);
      ctx.fillStyle = fill;
      ctx.fillText(text, x, y);
    },
    bump(text, x, y) {
      bctx.fillStyle = '#1e1e1e';
      bctx.fillText(text, x, y);
    }
  };
}

// Draw a line on both colour & bump canvases using the same transform logic
function drawIncisedLine(ctx, bctx, runs, x, y, size, font, maxWidth, align, painter) {
  drawRuns(ctx, runs, x, y, size, font, maxWidth, align, (c, t, px, py) => painter.color(c, t, px, py));
  drawRuns(bctx, runs, x, y, size, font, maxWidth, align, (c, t, px, py) => {
    c.fillStyle = '#1e1e1e';
    c.fillText(t, px, py);
  });
}

// -------------------------------------------------------------------------
// A7: Carved oak memorial plaque — Robert Harold Attenborough
// -------------------------------------------------------------------------
export function createAttenboroughPlaqueMaps(maxAniso = 8) {
  const w = 1320;
  const h = 640;
  const col = makeCanvas(w, h);
  const bmp = makeCanvas(w, h);
  const ctx = col.getContext('2d');
  const bctx = bmp.getContext('2d');
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
  const font = (s) => `600 ${s}px "Copperplate", "Copperplate Gothic Light", "Trajan Pro", "Times New Roman", serif`;
  const painter = incisedPainter('rgba(28,20,8,0.9)', 'rgba(222,200,140,0.75)', '#4a3a1c', bctx);
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
export function createRollOfHonourMaps(maxAniso = 8) {
  const w = 1600;
  const h = 980;
  const col = makeCanvas(w, h);
  const bmp = makeCanvas(w, h);
  const ctx = col.getContext('2d');
  const bctx = bmp.getContext('2d');
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
  const font = (s) => `500 ${s}px "Gill Sans", "Gill Sans MT", Optima, Candara, "Trebuchet MS", sans-serif`;
  const painter = incisedPainter('rgba(18,16,12,0.85)', 'rgba(214,208,192,0.55)', '#2f2b24', bctx);
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

export function createJaquesDonorsTexture(maxAniso = 8) {
  const w = 1024;
  const h = 1536;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
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

  const ropeRect = (inset) => {
    const rx0 = x0 + inset;
    const ry0 = y0 + inset;
    const rx1 = x1 - inset;
    const ry1 = y1 - inset;
    return [rx0, ry0, rx1, ry1];
  };
  const drawRopeEdge = (ax, ay, bx, by) => {
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
  const titleFont = (s) => `${s}px "Luminari", "Papyrus", "Herculanum", "Palatino Linotype", Palatino, Georgia, serif`;
  ctx.fillStyle = '#1f1d18';
  const titleRuns = (text, big) =>
    text.split(' ').flatMap((word, i, arr) => {
      const runs = [
        { t: word[0], s: big },
        { t: word.slice(1), s: big * 0.74 }
      ];
      if (i < arr.length - 1) runs.push({ t: ' ', s: big * 0.74 });
      return runs;
    });
  const drawTitle = (text, y, big) => {
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

// -------------------------------------------------------------------------
// Medieval Chancel Window Jamb Carvings (Window 7 — North-West Chancel Lancet next to Rood Screen)
// Close-up photographs (2026) & Taunt & Co. postcards 3017 / 3018:
//  - West jamb: The Crucifixion. Nimbed God the Father with raised hands at the top, carved
//    rosettes either side, the Dove with fanned wings, Christ on the cross-beam, St Mary (left)
//    and St John (right), a plain roll-moulded left border and a zig-zag (chevron) border right.
//  - East jamb + corner return: St Christopher. Huge bearded head in a rolled cap, the Christ
//    Child on his shoulder, hand gripping the staff, clasped hands & robe, wading through rippled
//    water; on the return a round arch over the hermitage and the small hooded Hermit below.
// These are HEIGHT FIELDS (1px = 1mm, 0 = deepest recess, 255 = front of the frame); interior.js
// displaces a finely subdivided plane with them so the worn relief is real geometry that catches light.
// -------------------------------------------------------------------------
// Shared height-field drawing helpers for the carved reliefs below
const grey = (v) => `rgb(${v},${v},${v})`;

// Raise a rounded form: radial-gradient dome clipped to the path, merged with 'lighten' (higher wins)
const makeForm = (ctx) => (path, peak, edge, cx, cy, r) => {
  ctx.save();
  ctx.globalCompositeOperation = 'lighten';
  ctx.beginPath();
  path(ctx);
  if (r) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, grey(peak));
    g.addColorStop(1, grey(edge));
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = grey(peak);
  }
  ctx.fill();
  ctx.restore();
};
// Cut a groove / fold (darken locally by a fixed amount)
const makeCut =
  (ctx) =>
  (path, width, alpha = 0.35) => {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    path(ctx);
    ctx.stroke();
    ctx.restore();
  };
const ellipse =
  (x, y, rx, ry, rot = 0) =>
  (c) =>
    c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
const poly = (pts) => (c) => {
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
};
const line = (pts) => (c) => {
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
};
// A limb / staff as a capsule between two points
const limb = (form, a, b, r, peak, edge) => {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const nx = -Math.sin(ang) * r;
  const ny = Math.cos(ang) * r;
  form(
    (c) => {
      c.moveTo(a[0] + nx, a[1] + ny);
      c.lineTo(b[0] + nx, b[1] + ny);
      c.arc(b[0], b[1], r, ang + Math.PI / 2, ang - Math.PI / 2, true);
      c.lineTo(a[0] - nx, a[1] - ny);
      c.arc(a[0], a[1], r, ang - Math.PI / 2, ang + Math.PI / 2, true);
    },
    peak,
    edge,
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
    Math.hypot(b[0] - a[0], b[1] - a[1]) / 2 + r
  );
};
const rosette = (form, cut, x, y, r) => {
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * r * 0.55;
    const py = y + Math.sin(a) * r * 0.55;
    form(ellipse(px, py, r * 0.5, r * 0.36, a), 168, 128, px, py, r * 0.55);
  }
  form(ellipse(x, y, r * 0.3, r * 0.3), 218, 170, x, y, r * 0.32);
  cut((c) => c.arc(x, y, r * 0.3, 0, Math.PI * 2), 2, 0.25);
};
const background = (ctx, w, h, frame) => {
  ctx.fillStyle = grey(255);
  ctx.fillRect(0, 0, w, h);
  // Recessed field with a soft chamfer into the frame
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, grey(34));
  g.addColorStop(1, grey(46));
  ctx.fillStyle = grey(120);
  ctx.fillRect(frame.l - 3, frame.t - 3, w - frame.l - frame.r + 6, h - frame.t - frame.b + 6);
  ctx.fillStyle = g;
  ctx.fillRect(frame.l, frame.t, w - frame.l - frame.r, h - frame.t - frame.b);
};
// Pitting & erosion: the carvings are badly worn clunch
const weather = (ctx, w, h, seed) => {
  const rand = mulberry32(seed);
  for (let i = 0; i < 1400; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 0.8 + rand() * rand() * 5;
    ctx.fillStyle = rand() > 0.35 ? `rgba(0,0,0,${0.05 + rand() * 0.12})` : `rgba(255,255,255,${0.04 + rand() * 0.06})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
};

export function createChancelReliefHeightMaps() {
  // ---- 1. THE CRUCIFIXION (west splayed jamb, 280 x 420 mm) ----
  const cw = 280;
  const ch = 420;
  const crux = makeCanvas(cw, ch);
  {
    const ctx = crux.getContext('2d');
    const form = makeForm(ctx);
    const cut = makeCut(ctx);
    background(ctx, cw, ch, { l: 46, r: 40, t: 16, b: 12 });

    // Left border: broad roll moulding standing proud of the field
    form((c) => c.rect(20, 16, 24, ch - 28), 236, 150, 32, ch / 2, 14);
    // Right border band with incised chevrons (lower two-thirds)
    form((c) => c.rect(cw - 40, 16, 22, ch - 28), 212, 212);
    for (let y = 150; y < ch - 20; y += 16) {
      cut(
        line([
          [cw - 37, y],
          [cw - 29, y + 8],
          [cw - 21, y]
        ]),
        2.2,
        0.45
      );
    }
    // Lintel shadow line under the top frame
    cut(
      line([
        [46, 18],
        [cw - 40, 18]
      ]),
      3,
      0.3
    );

    // God the Father: rayed nimbus, head, raised hands, torso
    form(ellipse(140, 62, 34, 34), 150, 132, 140, 62, 36);
    for (let a = 0; a < 18; a++) {
      const t = (a / 18) * Math.PI * 2;
      cut(
        line([
          [140 + Math.cos(t) * 22, 62 + Math.sin(t) * 22],
          [140 + Math.cos(t) * 33, 62 + Math.sin(t) * 33]
        ]),
        1.6,
        0.3
      );
    }
    form(ellipse(140, 64, 17, 21), 236, 176, 136, 58, 22);
    limb(form, [122, 104], [96, 52], 8, 200, 150); // raised left arm
    form(ellipse(94, 44, 10, 14, -0.3), 214, 160, 94, 44, 14); // open palm
    limb(form, [160, 104], [190, 46], 8, 200, 150); // raised right arm
    form(ellipse(192, 40, 9, 12, 0.3), 206, 160, 192, 40, 12);
    form(
      poly([
        [118, 88],
        [162, 88],
        [168, 150],
        [112, 150]
      ]),
      214,
      160,
      140,
      112,
      44
    );
    cut(
      line([
        [124, 112],
        [156, 112]
      ]),
      3,
      0.35
    ); // girdle
    cut(
      line([
        [130, 128],
        [126, 148]
      ]),
      2,
      0.25
    );
    cut(
      line([
        [150, 128],
        [154, 148]
      ]),
      2,
      0.25
    );

    // Rosettes flanking God the Father
    rosette(form, cut, 82, 128, 28);
    rosette(form, cut, 208, 132, 26);

    // The Dove: wings fanned like a scallop, between God and the cross
    form((c) => c.ellipse(140, 186, 40, 24, 0, Math.PI, 0), 186, 140, 140, 190, 42);
    for (let r = 0; r < 9; r++) {
      const t = Math.PI + (r / 8) * Math.PI;
      cut(
        line([
          [140, 190],
          [140 + Math.cos(t) * 38, 186 + Math.sin(t) * 22]
        ]),
        1.4,
        0.3
      );
    }

    // Cross-beam with Christ's arms along it, drooping head, body, loincloth & legs
    form((c) => c.rect(50, 206, 186, 16), 196, 196);
    limb(form, [70, 212], [132, 226], 7, 222, 176);
    limb(form, [214, 212], [150, 226], 7, 222, 176);
    form(ellipse(141, 226, 12, 15, 0.2), 238, 180, 141, 222, 15);
    form(
      poly([
        [126, 236],
        [156, 236],
        [152, 300],
        [130, 300]
      ]),
      232,
      172,
      141,
      262,
      36
    );
    form(
      poly([
        [124, 298],
        [158, 298],
        [154, 322],
        [128, 322]
      ]),
      220,
      180,
      141,
      310,
      22
    );
    cut(
      line([
        [128, 306],
        [154, 312]
      ]),
      2,
      0.3
    );
    limb(form, [136, 320], [140, 392], 8, 214, 168);
    limb(form, [146, 320], [142, 392], 8, 210, 164);
    form((c) => c.rect(136, 222, 10, 182), 150, 150); // upright of the cross behind

    // St Mary (left): veiled head, long robe with vertical folds
    form(ellipse(80, 248, 14, 17), 218, 160, 80, 244, 18);
    form(
      poly([
        [64, 260],
        [98, 260],
        [110, 400],
        [52, 400]
      ]),
      196,
      140,
      80,
      320,
      80
    );
    cut(
      line([
        [72, 280],
        [66, 396]
      ]),
      2.2,
      0.3
    );
    cut(
      line([
        [84, 284],
        [86, 396]
      ]),
      2.2,
      0.3
    );
    cut(
      line([
        [96, 290],
        [104, 396]
      ]),
      2.2,
      0.3
    );
    limb(form, [92, 282], [118, 260], 6, 200, 160); // hand raised in grief

    // St John (right): hooded head, robe, hand to cheek
    form(
      poly([
        [204, 238],
        [222, 246],
        [226, 270],
        [202, 270]
      ]),
      214,
      160,
      214,
      254,
      20
    );
    form(
      poly([
        [196, 268],
        [230, 268],
        [238, 400],
        [184, 400]
      ]),
      194,
      140,
      212,
      330,
      80
    );
    cut(
      line([
        [204, 288],
        [196, 396]
      ]),
      2.2,
      0.3
    );
    cut(
      line([
        [218, 290],
        [222, 396]
      ]),
      2.2,
      0.3
    );
    limb(form, [200, 292], [176, 264], 6, 200, 160);

    // Ground line
    form((c) => c.rect(46, 400, cw - 86, 8), 120, 120);
    weather(ctx, cw, ch, 3018);
  }

  // ---- 2. ST CHRISTOPHER (east splay 0..246mm + corner return 246..385mm, 420 mm high) ----
  const sw = 385;
  const sh = 420;
  const corner = 246;
  const chris = makeCanvas(sw, sh);
  {
    const ctx = chris.getContext('2d');
    const form = makeForm(ctx);
    const cut = makeCut(ctx);
    background(ctx, sw, sh, { l: 14, r: 12, t: 16, b: 10 });

    // Rippled water across the foot of the whole panel
    for (let i = 0; i < 5; i++) {
      const y0 = 352 + i * 13;
      form(
        (c) => {
          c.moveTo(14, y0 + 8);
          for (let x = 14; x <= sw - 12; x += 4) c.lineTo(x, y0 + Math.sin(x / 15 + i) * 4);
          c.lineTo(sw - 12, y0 + 12);
          c.lineTo(14, y0 + 12);
        },
        118 + i * 6,
        118 + i * 6
      );
      cut(line(Array.from({ length: 92 }, (_, k) => [14 + k * 4, y0 + Math.sin((14 + k * 4) / 15 + i) * 4])), 2, 0.3);
    }

    // Legs wading (knee-deep)
    limb(form, [96, 300], [86, 372], 15, 196, 150);
    limb(form, [150, 298], [168, 372], 15, 200, 150);
    // Long robe hitched up, broad folds
    form(
      poly([
        [62, 188],
        [196, 176],
        [210, 304],
        [70, 314]
      ]),
      206,
      150,
      134,
      236,
      96
    );
    cut(
      line([
        [96, 206],
        [92, 306]
      ]),
      2.6,
      0.3
    );
    cut(
      line([
        [150, 200],
        [160, 300]
      ]),
      2.6,
      0.3
    );
    cut(
      line([
        [178, 196],
        [196, 296]
      ]),
      2.4,
      0.28
    );
    cut(
      line([
        [70, 300],
        [208, 292]
      ]),
      3,
      0.35
    ); // hem
    // Hands clasped at the waist (left of centre)
    form(ellipse(84, 222, 22, 16, -0.4), 232, 176, 84, 220, 22);
    cut(
      line([
        [72, 220],
        [96, 226]
      ]),
      1.6,
      0.25
    );

    // Huge bearded head in a rolled cap
    form(ellipse(136, 108, 50, 64), 240, 168, 128, 96, 64);
    form(
      poly([
        [86, 52],
        [178, 40],
        [186, 66],
        [92, 78]
      ]),
      246,
      196,
      134,
      58,
      50
    ); // rolled brim
    form(
      poly([
        [100, 18],
        [170, 16],
        [178, 44],
        [92, 56]
      ]),
      228,
      184,
      136,
      34,
      48
    ); // crown of cap
    for (let k = 0; k < 6; k++)
      cut(
        line([
          [104 + k * 13, 20],
          [100 + k * 14, 52]
        ]),
        1.6,
        0.22
      );
    cut(
      line([
        [116, 96],
        [132, 94]
      ]),
      3,
      0.4
    ); // eyes
    cut(
      line([
        [144, 94],
        [158, 98]
      ]),
      3,
      0.4
    );
    cut(
      line([
        [136, 102],
        [134, 122]
      ]),
      2,
      0.25
    ); // nose
    form(
      poly([
        [100, 128],
        [172, 126],
        [150, 178],
        [120, 180]
      ]),
      222,
      170,
      136,
      146,
      40
    ); // beard
    for (let k = 0; k < 6; k++)
      cut(
        line([
          [108 + k * 11, 134],
          [124 + k * 5, 176]
        ]),
        1.5,
        0.25
      );

    // The Christ Child on his (right) shoulder, upper left
    form(ellipse(44, 54, 15, 18), 226, 170, 44, 50, 18);
    form(
      poly([
        [28, 70],
        [62, 68],
        [70, 150],
        [30, 156]
      ]),
      206,
      156,
      48,
      108,
      48
    );
    limb(form, [60, 84], [84, 60], 5, 200, 160); // blessing hand
    cut(
      line([
        [40, 80],
        [38, 150]
      ]),
      2,
      0.25
    );

    // Right arm gripping the staff; staff rises up the right of the splay
    limb(form, [182, 170], [210, 128], 12, 210, 160);
    form(ellipse(214, 124, 14, 20, 0.2), 230, 170, 214, 122, 20); // fist
    for (let k = 0; k < 3; k++)
      cut(
        line([
          [204, 114 + k * 8],
          [224, 116 + k * 8]
        ]),
        1.4,
        0.3
      );
    limb(form, [216, 20], [222, 340], 7, 188, 150);

    // Corner shaft separating splay from return
    form((c) => c.rect(corner - 8, 16, 14, sh - 26), 214, 150, corner - 1, sh / 2, 12);

    // Return face: round arch with voussoirs over the hermitage
    const ax = (corner + sw - 12) / 2 + 2;
    form(
      (c) => {
        c.moveTo(corner + 6, 150);
        c.lineTo(corner + 6, 82);
        c.arc(ax, 82, (sw - 12 - corner - 6) / 2, Math.PI, 0);
        c.lineTo(sw - 12, 150);
        c.lineTo(sw - 24, 150);
        c.lineTo(sw - 24, 84);
        c.arc(ax, 84, (sw - 24 - corner - 18) / 2, 0, Math.PI, true);
        c.lineTo(corner + 18, 150);
        c.closePath();
      },
      206,
      206
    );
    for (let k = 0; k <= 8; k++) {
      const t = Math.PI + (k / 8) * Math.PI;
      const rr = (sw - 12 - corner - 6) / 2;
      cut(
        line([
          [ax + Math.cos(t) * (rr - 12), 82 + Math.sin(t) * (rr - 12)],
          [ax + Math.cos(t) * rr, 82 + Math.sin(t) * rr]
        ]),
        1.6,
        0.3
      );
    }
    // Hermitage: small gabled chapel / doorway block under the arch
    form(
      poly([
        [corner + 30, 150],
        [corner + 30, 112],
        [ax + 8, 96],
        [sw - 36, 112],
        [sw - 36, 150]
      ]),
      178,
      150,
      ax,
      126,
      40
    );
    form((c) => c.rect(sw - 66, 118, 24, 32), 120, 120);
    // Ledge under the arch
    form((c) => c.rect(corner + 6, 150, sw - corner - 18, 10), 220, 220);

    // The Hermit: hooded figure with lantern
    form(
      poly([
        [corner + 30, 176],
        [corner + 58, 170],
        [corner + 66, 198],
        [corner + 34, 204]
      ]),
      216,
      160,
      corner + 48,
      186,
      24
    );
    form(
      poly([
        [corner + 26, 200],
        [corner + 72, 198],
        [corner + 86, 344],
        [corner + 18, 346]
      ]),
      196,
      140,
      corner + 52,
      270,
      80
    );
    cut(
      line([
        [corner + 40, 220],
        [corner + 36, 340]
      ]),
      2.2,
      0.3
    );
    cut(
      line([
        [corner + 58, 220],
        [corner + 64, 340]
      ]),
      2.2,
      0.3
    );
    limb(form, [corner + 70, 230], [corner + 98, 214], 6, 200, 160);
    form((c) => c.rect(corner + 94, 202, 16, 22), 206, 170, corner + 102, 212, 14); // lantern
    weather(ctx, sw, sh, 3017);
  }

  return { crucifixion: crux, stChristopher: chris };
}

// -------------------------------------------------------------------------
// Carved limewood angel on the South Nave wall-plate above the Attenborough plaque (photograph, 2026):
// a frontal, nimbed angel with outspread feathered wings, robed, holding a scroll across the body,
// standing on a small lobed base. Height field (1px = 1mm, 800 x 420); 0 = cut away (transparent).
// -------------------------------------------------------------------------
export function createCarvedAngelHeightMap() {
  const aw = 800;
  const ah = 420;
  const canvas = makeCanvas(aw, ah);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = grey(0);
  ctx.fillRect(0, 0, aw, ah);
  const form = makeForm(ctx);
  const cut = makeCut(ctx);
  const cx = aw / 2;
  const rand = mulberry32(1880);

  // Outspread wings: broad, overlapping primaries fanning down and outwards beneath a thick covert mass
  // that sweeps up to an upturned outer tip
  [-1, 1].forEach((s) => {
    const armAt = (t) => [cx + s * (70 + t * 300), 182 - t * 120 - Math.sin(t * Math.PI) * 26];
    for (let k = 0; k < 13; k++) {
      const t = 0.08 + (k / 12) * 0.92;
      const [px, py] = armAt(t);
      const ang = 0.5 + t * 0.75; // primaries swing from downward to outward along the wing
      const len = 64 + t * 58 + rand() * 10;
      const end = [px + s * Math.sin(ang) * len, py + Math.cos(ang) * len * 0.8];
      limb(form, [px, py], end, 19 - t * 6, 172 + rand() * 16, 128);
      cut(
        line([
          [px + s * 4, py + 8],
          [end[0] - s * 4, end[1] - 4]
        ]),
        1.2,
        0.25
      ); // feather shaft
    }
    const top = [];
    const bot = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      const [px, py] = armAt(t);
      const thick = 58 - t * 34;
      top.push([px, py - thick * 0.55]);
      bot.unshift([px - s * 6, py + thick * 0.45]);
    }
    top.push([cx + s * 392, 10]); // upturned tip
    form(poly([...top, ...bot]), 216, 178, cx + s * 180, 120, 170);
    // Scalloped covert feathers
    for (let k = 1; k < 10; k++) {
      const [px, py] = armAt(k / 10);
      cut((c) => c.arc(px, py + 4, 16, Math.PI * 0.1, Math.PI * 0.9), 1.6, 0.3);
    }
  });

  // Robed body with hood folds
  form(
    poly([
      [cx - 78, 108],
      [cx + 78, 108],
      [cx + 96, 250],
      [cx - 96, 250]
    ]),
    208,
    160,
    cx,
    170,
    110
  );
  for (const dx of [-40, -14, 14, 40])
    cut(
      line([
        [cx + dx * 0.7, 130],
        [cx + dx, 240]
      ]),
      2,
      0.3
    );
  form(ellipse(cx, 122, 66, 24), 216, 170, cx, 122, 66); // gathered collar

  // Nimbus and head
  form(ellipse(cx, 62, 50, 50), 150, 132, cx, 62, 52);
  cut((c) => c.arc(cx, 62, 44, 0, Math.PI * 2), 2, 0.3);
  form(ellipse(cx, 68, 26, 32), 238, 180, cx - 4, 62, 32);
  cut(
    line([
      [cx - 9, 62],
      [cx - 4, 63]
    ]),
    2,
    0.35
  );
  cut(
    line([
      [cx + 4, 63],
      [cx + 9, 62]
    ]),
    2,
    0.35
  );
  for (let k = 0; k < 7; k++)
    cut(
      line([
        [cx - 20 + k * 6, 44],
        [cx - 22 + k * 6, 56]
      ]),
      1.4,
      0.25
    ); // curls

  // Hands holding the scroll across the body; one end of the scroll curls down at the left
  form(ellipse(cx - 18, 214, 16, 12), 230, 180, cx - 18, 214, 16);
  form(
    poly([
      [cx - 104, 238],
      [cx + 96, 236],
      [cx + 100, 292],
      [cx - 100, 296]
    ]),
    210,
    178,
    cx,
    264,
    110
  );
  for (const y of [254, 270, 284]) {
    const pts = [];
    for (let x = cx - 86; x <= cx + 84; x += 8) pts.push([x, y + Math.sin(x / 7) * 2]);
    cut(line(pts), 1.6, 0.35); // worn lettering
  }
  form(ellipse(cx - 108, 238, 16, 22), 220, 170, cx - 108, 236, 22);
  limb(form, [cx - 110, 226], [cx - 124, 192], 10, 214, 170);
  form(ellipse(cx + 102, 264, 12, 30), 220, 170, cx + 102, 264, 30);

  // Lobed base standing on the wall-plate
  form(
    poly([
      [cx - 72, 296],
      [cx + 72, 296],
      [cx + 66, 352],
      [cx - 66, 352]
    ]),
    196,
    160,
    cx,
    320,
    80
  );
  for (const dx of [-50, -17, 17, 50]) form(ellipse(cx + dx, 368, 17, 18), 200, 150, cx + dx, 364, 18);
  cut(
    line([
      [cx - 72, 300],
      [cx + 72, 300]
    ]),
    2,
    0.3
  );

  weather(ctx, aw, ah, 1880);
  return canvas;
}
