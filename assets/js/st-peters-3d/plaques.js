import * as THREE from 'three';

// Procedurally painted interior wall memorials of St Peter's Church, Ilmer:
//  - A7: Carved oak plaque to Robert Harold Attenborough (1880–1968)
//  - Roll of Honour: Great War memorial stone tablet (South Nave wall)
//  - A4: Framed hand-lettered List of Donors for Mrs Jaques's Memorial Window

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finish(canvas, srgb, maxAniso) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = maxAniso;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

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

  return { map: finish(col, true, maxAniso), bumpMap: finish(bmp, false, maxAniso) };
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

  return { map: finish(col, true, maxAniso), bumpMap: finish(bmp, false, maxAniso) };
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

  return finish(c, true, maxAniso);
}

// -------------------------------------------------------------------------
// Medieval Chancel Window Jamb Carvings (Window 7 — North-West Chancel Lancet next to Rood Screen)
// Taunt & Co. postcard (3018 & 3017):
//  - Left (West) jamb: The Crucifixion (Christ on the Cross, St Mary & St John with nimbi,
//    God the Father in a circular cloud cutting above, Holy Dove, and triple colonnette shafts)
//  - Right (East) jamb corner: The Legend of St. Christopher (giant bearded St. Christopher
//    wading through wavy stream with tree staff & Infant Christ on shoulder, plus Hermit &
//    gabled Hermitage chapel under a pointed arch on the corner return)
// -------------------------------------------------------------------------
export function createChancelCarvingMaps(maxAniso = 8) {
  // Helper: paint a soft multi-stop radial/linear height & colour relief blob on both diffuse and bump canvases
  const paintReliefForm = (ctx, bctx, drawPath, heightVal, lightBias = 0) => {
    const shade = Math.max(40, Math.min(245, Math.round(115 + heightVal * 0.52 + lightBias)));
    const r = Math.min(255, Math.round(shade * 1.04));
    const g = Math.min(255, Math.round(shade * 0.99));
    const b = Math.min(255, Math.round(shade * 0.87));

    ctx.save();
    ctx.beginPath();
    drawPath(ctx);
    // Drop shadow to lower-left inside deep niche
    ctx.shadowColor = 'rgba(24, 20, 15, 0.62)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = -4;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(42, 36, 28, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    bctx.save();
    bctx.beginPath();
    drawPath(bctx);
    const bv = Math.max(0, Math.min(255, Math.round(heightVal)));
    bctx.shadowColor = 'rgba(0,0,0,0.8)';
    bctx.shadowBlur = 8;
    bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bctx.fill();
    bctx.restore();
  };

  const addWeatheredClunchGrain = (ctx, bctx, w, h, seed) => {
    const rand = mulberry32(seed);
    for (let i = 0; i < 4200; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const sz = 1.2 + rand() * 3.2;
      const bright = rand() > 0.48;
      ctx.fillStyle = bright ? 'rgba(242,235,216,0.12)' : 'rgba(46,40,32,0.14)';
      ctx.fillRect(x, y, sz, sz);
      bctx.fillStyle = bright ? 'rgba(220,220,220,0.15)' : 'rgba(50,50,50,0.15)';
      bctx.fillRect(x, y, sz, sz);
    }
  };

  // =======================================================================
  // 1. WEST JAMB NICHE: THE CRUCIFIXION (Taunt & Co. 3018)
  // =======================================================================
  const cw = 512;
  const ch = 768;
  const cCol = makeCanvas(cw, ch);
  const cBmp = makeCanvas(cw, ch);
  const cctx = cCol.getContext('2d');
  const cbctx = cBmp.getContext('2d');

  // Outer splayed plaster/limestone margin around the deeply recessed niche
  cctx.fillStyle = '#c4ba9e';
  cctx.fillRect(0, 0, cw, ch);
  cbctx.fillStyle = '#c8c8c8';
  cbctx.fillRect(0, 0, cw, ch);

  // Deeply recessed shadowy stone niche cavity
  paintReliefForm(
    cctx,
    cbctx,
    (c) => {
      c.moveTo(54, 704);
      c.lineTo(54, 150);
      c.quadraticCurveTo(68, 66, 175, 58);
      c.lineTo(436, 72);
      c.lineTo(446, 708);
      c.closePath();
    },
    38,
    -36
  );

  // Three slender clustered Gothic colonnette shafts & capitals along right border of niche
  [392, 412, 430].forEach((sx, idx) => {
    paintReliefForm(
      cctx,
      cbctx,
      (c) => {
        c.roundRect(sx - 8, 128, 16, 565, 7);
      },
      188 + idx * 12,
      14
    );
    // Moulded bell capital at top of each shaft
    paintReliefForm(
      cctx,
      cbctx,
      (c) => {
        c.roundRect(sx - 11, 118, 22, 26, 5);
      },
      210,
      18
    );
  });

  // Circular cloud cutting at top-center containing God the Father with raised hands & nimbus
  paintReliefForm(
    cctx,
    cbctx,
    (c) => {
      c.arc(248, 152, 68, 0, Math.PI * 2);
    },
    95,
    -12
  );
  // Nebuly cloud rim & radiated nimbus
  paintReliefForm(
    cctx,
    cbctx,
    (c) => {
      c.arc(248, 146, 48, 0, Math.PI * 2);
    },
    185,
    12
  );
  // Half-length figure of God the Father with both hands raised in blessing
  paintReliefForm(
    cctx,
    cbctx,
    (c) => {
      c.moveTo(212, 206);
      c.lineTo(196, 148);
      c.lineTo(214, 142);
      c.lineTo(226, 172);
      c.lineTo(270, 172);
      c.lineTo(282, 142);
      c.lineTo(298, 148);
      c.lineTo(284, 206);
      c.closePath();
    },
    208,
    18
  );
  paintReliefForm(
    cctx,
    cbctx,
    (c) => {
      c.ellipse(248, 148, 22, 28, 0, 0, Math.PI * 2);
    },
    228,
    24
  );

  // Holy Dove in upper-left spandrel above the cross
  paintReliefForm(
    cctx,
    cbctx,
    (c) => {
      c.arc(146, 114, 26, 0, Math.PI * 2);
    },
    172,
    8
  );
  paintReliefForm(
    cctx,
    cbctx,
    (c) => {
      c.moveTo(124, 116);
      c.quadraticCurveTo(146, 96, 170, 108);
      c.quadraticCurveTo(152, 132, 124, 116);
      c.closePath();
    },
    212,
    20
  );

  // Rough-hewn Latin Cross rising from stepped socket base
  paintReliefForm(
    cctx,
    cbctx,
    (c) => {
      c.roundRect(198, 672, 104, 30, 6);
    },
    190,
    10
  );
  paintReliefForm(
    cctx,
    cbctx,
    (c) => {
      c.roundRect(228, 226, 44, 456, 10);
    },
    196,
    14
  );
  paintReliefForm(
    cctx,
    cbctx,
    (c) => {
      c.roundRect(118, 294, 264, 38, 8);
    },
    192,
    12
  );

  // Crucified figure of Christ (weathered high-relief corpus on the cross)
  // Radiated nimbus & inclined head
  paintReliefForm(
    cctx,
    cbctx,
    (c) => {
      c.arc(248, 258, 34, 0, Math.PI * 2);
    },
    212,
    16
  );
  paintReliefForm(
    cctx,
    cbctx,
    (c) => {
      c.ellipse(246, 262, 21, 26, -0.15, 0, Math.PI * 2);
    },
    236,
    24
  );
  // Outstretched arms along crossbeam
  paintReliefForm(
    cctx,
    cbctx,
    (c) => {
      c.moveTo(132, 304);
      c.lineTo(248, 314);
      c.lineTo(366, 304);
      c.lineTo(366, 326);
      c.lineTo(248, 342);
      c.lineTo(132, 326);
      c.closePath();
    },
    224,
    20
  );
  // Weathered ribcage, waist, loincloth & legs descending the cross shaft
  paintReliefForm(
    cctx,
    cbctx,
    (c) => {
      c.moveTo(222, 318);
      c.quadraticCurveTo(212, 382, 224, 442);
      c.quadraticCurveTo(218, 550, 232, 658);
      c.lineTo(268, 658);
      c.quadraticCurveTo(280, 550, 274, 442);
      c.quadraticCurveTo(286, 382, 276, 318);
      c.closePath();
    },
    238,
    24
  );

  // Flanking figure on Left: St Mary with circular nimbus & draped cloak
  paintReliefForm(
    cctx,
    cbctx,
    (c) => {
      c.arc(146, 246, 32, 0, Math.PI * 2);
    },
    168,
    6
  );
  paintReliefForm(
    cctx,
    cbctx,
    (c) => {
      c.moveTo(118, 360);
      c.quadraticCurveTo(146, 340, 174, 364);
      c.lineTo(184, 654);
      c.lineTo(110, 654);
      c.closePath();
    },
    176,
    8
  );

  // Flanking figure on Right: St John with circular nimbus & pleated mantle
  paintReliefForm(
    cctx,
    cbctx,
    (c) => {
      c.arc(338, 256, 34, 0, Math.PI * 2);
    },
    182,
    10
  );
  paintReliefForm(
    cctx,
    cbctx,
    (c) => {
      c.moveTo(308, 420);
      c.quadraticCurveTo(340, 396, 370, 424);
      c.lineTo(374, 668);
      c.lineTo(298, 668);
      c.closePath();
    },
    194,
    14
  );

  addWeatheredClunchGrain(cctx, cbctx, cw, ch, 3018);

  // =======================================================================
  // 2. EAST JAMB CORNER: ST. CHRISTOPHER & THE HERMIT (Taunt & Co. 3017)
  //    u = 0..0.64: Splayed jamb face (St. Christopher wading with Christ Child)
  //    u = 0.64..1.0: Corner staff & return face under pointed arch (Hermit & Chapel)
  // =======================================================================
  const sw = 640;
  const sh = 768;
  const sCol = makeCanvas(sw, sh);
  const sBmp = makeCanvas(sw, sh);
  const sctx = sCol.getContext('2d');
  const sbctx = sBmp.getContext('2d');

  sctx.fillStyle = '#c5bba1';
  sctx.fillRect(0, 0, sw, sh);
  sbctx.fillStyle = '#c4c4c4';
  sbctx.fillRect(0, 0, sw, sh);

  // Recessed niche on splayed face (left) & pointed-arch niche on return face (right)
  paintReliefForm(
    sctx,
    sbctx,
    (c) => {
      c.roundRect(38, 66, 368, 636, 18);
    },
    58,
    -26
  );
  paintReliefForm(
    sctx,
    sbctx,
    (c) => {
      c.moveTo(418, 662);
      c.lineTo(418, 200);
      c.quadraticCurveTo(450, 96, 512, 82);
      c.quadraticCurveTo(574, 96, 598, 200);
      c.lineTo(598, 662);
      c.closePath();
    },
    66,
    -22
  );

  // Wavy horizontal water ridges of the stream at St. Christopher's feet (y: 590..695)
  for (let wy = 602; wy <= 686; wy += 16) {
    paintReliefForm(
      sctx,
      sbctx,
      (c) => {
        c.moveTo(64, wy);
        c.bezierCurveTo(140, wy - 10, 220, wy + 12, 305, wy - 8);
        c.bezierCurveTo(355, wy - 14, 392, wy + 8, 412, wy);
        c.lineTo(412, wy + 11);
        c.lineTo(64, wy + 11);
        c.closePath();
      },
      188 + ((wy * 3) % 24),
      12
    );
  }

  // St. Christopher's two sturdy striding legs wading through the stream
  paintReliefForm(
    sctx,
    sbctx,
    (c) => {
      c.roundRect(142, 470, 56, 155, 22);
    },
    212,
    16
  );
  paintReliefForm(
    sctx,
    sbctx,
    (c) => {
      c.moveTo(222, 466);
      c.lineTo(280, 466);
      c.lineTo(314, 622);
      c.lineTo(254, 630);
      c.closePath();
    },
    224,
    20
  );

  // Pleated belted medieval knee-length tunic
  paintReliefForm(
    sctx,
    sbctx,
    (c) => {
      c.moveTo(144, 294);
      c.lineTo(310, 294);
      c.lineTo(324, 488);
      c.lineTo(132, 482);
      c.closePath();
    },
    220,
    18
  );
  // Vertical tunic pleats
  for (const px of [172, 206, 240, 274]) {
    paintReliefForm(
      sctx,
      sbctx,
      (c) => {
        c.roundRect(px, 344, 16, 134, 6);
      },
      236,
      22
    );
  }

  // Tall raguly/forked palm-tree staff along the corner angle (x ≈ 385..425)
  paintReliefForm(
    sctx,
    sbctx,
    (c) => {
      c.moveTo(364, 588);
      c.lineTo(400, 174);
      c.lineTo(356, 78);
      c.lineTo(388, 72);
      c.lineTo(422, 146);
      c.lineTo(466, 74);
      c.lineTo(486, 86);
      c.lineTo(432, 182);
      c.lineTo(404, 588);
      c.closePath();
    },
    232,
    22
  );

  // St. Christopher's left arm reaching across to grip the tree staff (with 4 carved fingers!)
  paintReliefForm(
    sctx,
    sbctx,
    (c) => {
      c.moveTo(278, 304);
      c.quadraticCurveTo(338, 326, 396, 232);
      c.lineTo(426, 254);
      c.quadraticCurveTo(362, 376, 272, 360);
      c.closePath();
    },
    236,
    22
  );
  for (let fy = 204; fy <= 252; fy += 15) {
    paintReliefForm(
      sctx,
      sbctx,
      (c) => {
        c.roundRect(392, fy, 36, 12, 5);
      },
      248,
      26
    );
  }

  // St. Christopher's right arm bent with hand resting on his belt/hip
  paintReliefForm(
    sctx,
    sbctx,
    (c) => {
      c.moveTo(148, 312);
      c.lineTo(84, 344);
      c.lineTo(156, 412);
      c.lineTo(182, 384);
      c.lineTo(132, 344);
      c.closePath();
    },
    226,
    18
  );

  // Giant bearded head of St. Christopher + vertical fluted medieval headband/cap
  paintReliefForm(
    sctx,
    sbctx,
    (c) => {
      c.ellipse(238, 214, 78, 92, -0.08, 0, Math.PI * 2);
    },
    238,
    22
  );
  // Fluted headband across brow (iconic detail in Taunt 3017 photo!)
  paintReliefForm(
    sctx,
    sbctx,
    (c) => {
      c.moveTo(156, 134);
      c.quadraticCurveTo(242, 102, 318, 162);
      c.lineTo(306, 198);
      c.quadraticCurveTo(234, 144, 152, 170);
      c.closePath();
    },
    248,
    26
  );
  for (let hx = 166; hx <= 302; hx += 16) {
    sctx.strokeStyle = 'rgba(48, 40, 30, 0.55)';
    sctx.lineWidth = 3;
    sctx.beginPath();
    sctx.moveTo(hx, 122 + (hx - 166) * 0.22);
    sctx.lineTo(hx - 6, 162 + (hx - 166) * 0.22);
    sctx.stroke();
  }

  // Infant Christ Child seated on St. Christopher's right shoulder (top-left of niche)
  paintReliefForm(
    sctx,
    sbctx,
    (c) => {
      c.roundRect(72, 166, 68, 146, 24);
    },
    224,
    18
  );
  paintReliefForm(
    sctx,
    sbctx,
    (c) => {
      c.arc(106, 126, 32, 0, Math.PI * 2);
    },
    234,
    22
  );

  // RIGHT RETURN FACE (u = 0.66..0.95): Little Gabled Hermitage Chapel above & Hooded Hermit with Lantern below
  // Gabled Hermitage Chapel (y: 120..366)
  paintReliefForm(
    sctx,
    sbctx,
    (c) => {
      c.moveTo(436, 224);
      c.lineTo(504, 124);
      c.lineTo(578, 224);
      c.lineTo(578, 368);
      c.lineTo(436, 368);
      c.closePath();
    },
    214,
    16
  );
  // Recessed doorway & small square window in the Hermitage wall
  paintReliefForm(
    sctx,
    sbctx,
    (c) => {
      c.roundRect(442, 274, 42, 82, 16);
    },
    125,
    -14
  );
  paintReliefForm(
    sctx,
    sbctx,
    (c) => {
      c.rect(512, 268, 48, 56);
    },
    170,
    -4
  );

  // Hooded Hermit standing below the Hermitage chapel (y: 382..648)
  paintReliefForm(
    sctx,
    sbctx,
    (c) => {
      c.ellipse(498, 424, 34, 42, 0, 0, Math.PI * 2);
    },
    218,
    16
  );
  paintReliefForm(
    sctx,
    sbctx,
    (c) => {
      c.moveTo(458, 464);
      c.lineTo(536, 464);
      c.lineTo(546, 646);
      c.lineTo(450, 646);
      c.closePath();
    },
    222,
    18
  );

  addWeatheredClunchGrain(sctx, sbctx, sw, sh, 3017);

  return {
    crucifixion: {
      map: finish(cCol, true, maxAniso),
      bumpMap: finish(cBmp, false, maxAniso)
    },
    stChristopher: {
      map: finish(sCol, true, maxAniso),
      bumpMap: finish(sBmp, false, maxAniso)
    }
  };
}
