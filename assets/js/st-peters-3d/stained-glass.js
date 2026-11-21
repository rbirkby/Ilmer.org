import * as THREE from 'three';

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

function finishGlassTexture(canvas, maxAniso) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = maxAniso;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

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

// Helper: draw leaded polygon from array of [x, y] points
function drawLeadPoly(ctx, pts, fillStyle, leadW = 4.2) {
  drawLeadedPiece(
    ctx,
    () => {
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
    },
    fillStyle,
    leadW
  );
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

// Helper: draw a Gothic cusped trefoil-headed lancet clipping path
function traceTrefoilLancetPath(ctx, cx, w, topY, botY, springY) {
  const hw = w * 0.5;
  const xL = cx - hw;
  const xR = cx + hw;
  const lobeR = w * 0.27;
  const topR = w * 0.27;
  const midY = springY - lobeR * 0.72;
  const cuspX = w * 0.21;
  const cuspY = topY + topR * 1.48;

  ctx.moveTo(xL, botY);
  ctx.lineTo(xL, springY);
  // Left foil curve up to left cusp
  ctx.bezierCurveTo(xL - 4, midY - lobeR * 0.5, cx - cuspX - 18, midY - lobeR * 0.9, cx - cuspX, cuspY);
  // Central tall pointed trefoil lobe
  ctx.bezierCurveTo(cx - topR * 1.15, topY + topR * 0.78, cx - topR * 0.55, topY + 12, cx, topY);
  ctx.bezierCurveTo(cx + topR * 0.55, topY + 12, cx + topR * 1.15, topY + topR * 0.78, cx + cuspX, cuspY);
  // Right foil curve down to spring line
  ctx.bezierCurveTo(cx + cuspX + 18, midY - lobeR * 0.9, xR + 4, midY - lobeR * 0.5, xR, springY);
  ctx.lineTo(xR, botY);
  ctx.closePath();
}

// Helper: paint kiln-fired shaded drapery folds inside a garment region
function drawDraperyFolds(ctx, lines, color = 'rgba(28,16,12,0.45)', width = 2.4) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  for (const seg of lines) {
    ctx.beginPath();
    ctx.moveTo(seg[0], seg[1]);
    if (seg.length === 6) {
      ctx.quadraticCurveTo(seg[2], seg[3], seg[4], seg[5]);
    } else {
      ctx.lineTo(seg[2], seg[3]);
    }
    ctx.stroke();
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

// =========================================================================
// 1. EAST / ALTAR WINDOW (A2) — Jesus calling Simon Peter & Andrew (1909)
//    Two trefoil-headed Gothic lights + upper quatrefoil medallion
//    "Follow me and I will make you fishers of men" / Martha Belgrove 1909
// =========================================================================
export function createEastStainedGlassTexture(maxAniso = 8) {
  const w = 1024;
  const h = 1536;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');

  // Weathered dressed limestone tracery surround
  fillWeatheredStoneSurround(ctx, w, h, 2011, '#928876');

  // Subtle carved stone bevel / recessed tracery arch moulding around upper lights
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

  // ---- UPPER QUATREFOIL MEDALLION ----
  const qx = w * 0.5;
  const qy = 196;
  const qR = 66;
  const traceQuatrefoil = (scale = 1) => {
    const r = qR * scale;
    const o = 50 * scale;
    ctx.beginPath();
    ctx.arc(qx, qy - o, r, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.arc(qx + o, qy, r, -Math.PI * 0.35, Math.PI * 0.35);
    ctx.arc(qx, qy + o, r, Math.PI * 0.15, Math.PI * 0.85);
    ctx.arc(qx - o, qy, r, Math.PI * 0.65, Math.PI * 1.35);
    ctx.closePath();
  };

  // Carved stone recess ring around quatrefoil
  ctx.save();
  traceQuatrefoil(1.16);
  ctx.fillStyle = '#7b7161';
  ctx.fill();
  ctx.restore();

  ctx.save();
  traceQuatrefoil(1.0);
  ctx.clip();
  drawDiamondQuarries(ctx, qx - 140, qy - 140, qx + 140, qy + 140, 28, 34, {
    bg: '#eef5f7',
    leadW: 2.8,
    rosette: false,
    tintBlue: true
  });
  // Ruby-red stained glass inner border ribbon following the 4 lobes
  ctx.strokeStyle = '#c82028';
  ctx.lineWidth = 15;
  traceQuatrefoil(0.82);
  ctx.stroke();
  ctx.strokeStyle = '#181615';
  ctx.lineWidth = 3.5;
  traceQuatrefoil(0.89);
  ctx.stroke();
  traceQuatrefoil(0.75);
  ctx.stroke();
  // Central silver-stain floral sun roundel
  drawLeadedPiece(
    ctx,
    () => {
      ctx.arc(qx, qy, 34, 0, Math.PI * 2);
    },
    '#eef4f2',
    4
  );
  drawLeadedPiece(
    ctx,
    () => {
      ctx.arc(qx, qy, 20, 0, Math.PI * 2);
    },
    '#e4bc42',
    3.5
  );
  ctx.restore();

  ctx.save();
  traceQuatrefoil(1.0);
  ctx.strokeStyle = '#25211c';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.restore();

  // ---- TWO MAIN TREFOIL-HEADED GOTHIC LANCETS ----
  const lancets = [
    { cx: 298, side: 'left' },
    { cx: 726, side: 'right' }
  ];
  const lancetW = 344;
  const topY = 338;
  const springY = 508;
  const botY = 1482;

  for (const lancet of lancets) {
    const cx = lancet.cx;
    const xL = cx - lancetW * 0.5;
    const xR = cx + lancetW * 0.5;

    // Carved stone chamfer recess
    ctx.save();
    ctx.beginPath();
    traceTrefoilLancetPath(ctx, cx, lancetW + 24, topY - 14, botY + 10, springY - 4);
    ctx.fillStyle = '#756c5d';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    traceTrefoilLancetPath(ctx, cx, lancetW, topY, botY, springY);
    ctx.clip();

    // 1. Upper diamond quarry background (head & Gothic architectural canopy)
    drawDiamondQuarries(ctx, xL, topY, xR, 650, 34, 42, { bg: '#f1f6f7', leadW: 2.8, tintBlue: true });

    // Ruby-red undulating trefoil head border ribbon (iconic A2 motif)
    ctx.save();
    ctx.strokeStyle = '#cb1e28';
    ctx.lineWidth = 14;
    ctx.beginPath();
    traceTrefoilLancetPath(ctx, cx, lancetW - 26, topY + 15, springY + 34, springY + 6);
    ctx.stroke();
    ctx.strokeStyle = '#181615';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    traceTrefoilLancetPath(ctx, cx, lancetW - 14, topY + 9, springY + 34, springY + 6);
    ctx.stroke();
    ctx.beginPath();
    traceTrefoilLancetPath(ctx, cx, lancetW - 38, topY + 21, springY + 34, springY + 6);
    ctx.stroke();
    ctx.restore();

    // Golden-silver architectural canopy finials & crocketed pinnacles (y: 470..650)
    // Side buttress shafts (ivory & silver-stain gold)
    for (const bx of [xL + 8, xR - 38]) {
      drawLeadedPiece(
        ctx,
        () => {
          ctx.rect(bx, 540, 30, 620);
        },
        '#f4f0e0',
        3.5
      );
      // Horizontal canopy bands & golden crockets on side shafts
      for (let py = 570; py < 1130; py += 95) {
        drawLeadedPiece(
          ctx,
          () => {
            ctx.rect(bx + 3, py, 24, 24);
          },
          '#e9c962',
          2.6
        );
      }
    }

    // Central Gothic golden crown & canopy arch
    drawLeadPoly(
      ctx,
      [
        [cx, 488],
        [cx + 34, 530],
        [cx + 18, 558],
        [cx - 18, 558],
        [cx - 34, 530]
      ],
      '#e5be48',
      3.5
    );
    drawLeadedPiece(
      ctx,
      () => {
        ctx.moveTo(xL + 36, 560);
        ctx.lineTo(xR - 36, 560);
        ctx.lineTo(xR - 36, 616);
        ctx.quadraticCurveTo(cx, 578, xL + 36, 616);
        ctx.closePath();
      },
      '#f5efd4',
      3.8
    );
    // Golden filigree arches beneath canopy
    ctx.save();
    ctx.strokeStyle = '#c89b2c';
    ctx.lineWidth = 3.5;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.arc(cx + k * 66, 608, 30, Math.PI, 0);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Central narrative scene panel (y: 626..1180)
    const sceneTop = 626;

    // Deep jewel cobalt-blue arched canopy sky behind the figures
    const skyGrad = ctx.createLinearGradient(xL, sceneTop, xL, 860);
    skyGrad.addColorStop(0, '#1950b4');
    skyGrad.addColorStop(0.55, '#2b6fd2');
    skyGrad.addColorStop(1, '#4c94e4');
    drawLeadedPiece(
      ctx,
      () => {
        ctx.moveTo(xL + 34, 875);
        ctx.lineTo(xL + 34, 710);
        ctx.quadraticCurveTo(xL + 56, 672, cx - 54, 668);
        ctx.quadraticCurveTo(cx, 620, cx + 54, 668);
        ctx.quadraticCurveTo(xR - 56, 672, xR - 34, 710);
        ctx.lineTo(xR - 34, 875);
        ctx.closePath();
      },
      skyGrad,
      4.2
    );

    // Subtle damask foliage scroll pattern etched on blue glass
    ctx.save();
    ctx.strokeStyle = 'rgba(18, 42, 96, 0.3)';
    ctx.lineWidth = 2;
    for (let gy = 678; gy < 840; gy += 30) {
      for (let gx = xL + 56; gx < xR - 50; gx += 42) {
        ctx.beginPath();
        ctx.arc(gx, gy, 11, 0, Math.PI * 1.4);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Distant green lakeside shore & calm blue-teal Sea of Galilee water
    drawLeadedPiece(
      ctx,
      () => {
        ctx.rect(xL + 34, 845, lancetW - 68, 72);
      },
      '#58a24a',
      3.5
    );
    drawLeadedPiece(
      ctx,
      () => {
        ctx.rect(xL + 34, 912, lancetW - 68, 266);
      },
      '#dce7d4',
      3.5
    );

    if (lancet.side === 'left') {
      // ---- LEFT LIGHT: JESUS ON THE SHORE CALLING THE DISCIPLES ----
      // Olive-green lakeside tree behind left shoulder
      drawLeadPoly(
        ctx,
        [
          [xL + 60, 885],
          [xL + 78, 885],
          [xL + 75, 810],
          [xL + 63, 810]
        ],
        '#6d4b31',
        3.5
      );
      drawLeadedPiece(
        ctx,
        () => {
          ctx.arc(xL + 76, 764, 42, 0, Math.PI * 2);
          ctx.arc(xL + 98, 782, 30, 0, Math.PI * 2);
        },
        '#729c34',
        4
      );
      // Second small trunk on right
      drawLeadPoly(
        ctx,
        [
          [xR - 66, 895],
          [xR - 52, 895],
          [xR - 54, 822],
          [xR - 64, 822]
        ],
        '#6d4b31',
        3.5
      );

      // Golden cruciform halo behind Jesus's head
      const hx = cx + 10;
      const hy = 720;
      drawLeadedPiece(
        ctx,
        () => {
          ctx.arc(hx, hy, 54, 0, Math.PI * 2);
        },
        '#f4eaad',
        4.5
      );
      ctx.save();
      ctx.strokeStyle = '#c89b2e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(hx, hy, 44, 0, Math.PI * 2);
      ctx.moveTo(hx - 48, hy);
      ctx.lineTo(hx + 48, hy);
      ctx.moveTo(hx, hy - 48);
      ctx.lineTo(hx, hy + 48);
      ctx.stroke();
      ctx.restore();

      // Jesus's ivory under-robe (tunic) reaching to bare feet
      const robeGrad = ctx.createLinearGradient(cx - 50, 760, cx + 65, 1110);
      robeGrad.addColorStop(0, '#fcfbf4');
      robeGrad.addColorStop(0.6, '#ece8d8');
      robeGrad.addColorStop(1, '#d8d2be');
      drawLeadPoly(
        ctx,
        [
          [cx - 34, 760],
          [cx + 50, 760],
          [cx + 68, 1085],
          [cx - 56, 1085]
        ],
        robeGrad,
        4.2
      );
      drawDraperyFolds(ctx, [
        [cx - 28, 1000, cx - 34, 1045, cx - 38, 1078],
        [cx - 6, 995, cx - 8, 1045, cx - 10, 1078],
        [cx + 18, 998, cx + 22, 1042, cx + 26, 1078],
        [cx + 42, 995, cx + 48, 1040, cx + 52, 1078]
      ]);

      // Outstretched right arm (pointing left/blessing) & raised left hand
      drawLeadPoly(
        ctx,
        [
          [cx - 34, 772],
          [xL + 40, 788],
          [xL + 42, 818],
          [cx - 30, 824]
        ],
        '#f7f3e4',
        3.8
      );
      drawLeadPoly(
        ctx,
        [
          [cx + 44, 772],
          [xR - 42, 796],
          [xR - 46, 838],
          [cx + 36, 842]
        ],
        '#f7f3e4',
        3.8
      );
      // Hands
      drawLeadedPiece(
        ctx,
        () => {
          ctx.ellipse(xL + 48, 804, 16, 11, -0.2, 0, Math.PI * 2);
        },
        '#f4e3ce',
        3
      );
      drawLeadedPiece(
        ctx,
        () => {
          ctx.ellipse(xR - 46, 784, 13, 18, 0.25, 0, Math.PI * 2);
        },
        '#f4e3ce',
        3
      );

      // Rich vermilion-scarlet cloak draped across Jesus's shoulder & waist (signature A2 red!)
      const cloakGrad = ctx.createLinearGradient(cx - 75, 765, cx + 65, 1035);
      cloakGrad.addColorStop(0, '#f03a28');
      cloakGrad.addColorStop(0.5, '#d21e16');
      cloakGrad.addColorStop(1, '#9c100d');
      drawLeadedPiece(
        ctx,
        () => {
          ctx.moveTo(cx - 26, 760);
          ctx.quadraticCurveTo(cx - 72, 790, cx - 64, 868);
          ctx.quadraticCurveTo(cx - 46, 945, cx - 58, 1002);
          ctx.quadraticCurveTo(cx + 12, 1045, cx + 56, 1020);
          ctx.quadraticCurveTo(cx + 68, 935, cx + 48, 862);
          ctx.quadraticCurveTo(cx + 8, 868, cx - 18, 840);
          ctx.quadraticCurveTo(cx - 10, 790, cx - 26, 760);
          ctx.closePath();
        },
        cloakGrad,
        4.5
      );
      // Golden-ochre cloak lining peeking on left hip
      drawLeadPoly(
        ctx,
        [
          [cx - 60, 910],
          [cx - 32, 926],
          [cx - 46, 1012],
          [cx - 68, 992]
        ],
        '#e8bd42',
        3.5
      );
      drawDraperyFolds(
        ctx,
        [
          [cx - 36, 858, cx - 12, 916, cx + 22, 992],
          [cx - 12, 866, cx + 14, 922, cx + 44, 996],
          [cx - 46, 902, cx - 26, 948, cx - 10, 998]
        ],
        'rgba(62, 6, 4, 0.5)',
        2.8
      );

      // Painted face of Jesus
      drawPaintedFace(ctx, hx, hy + 4, 24, 30, {
        facing: 0.2,
        beard: true,
        hairColor: '#9c7548',
        skinColor: '#f5e4cf'
      });

      // Dark-blue wooden fishing boat prow & golden woven fishing net at bottom-left
      const boatGrad = ctx.createLinearGradient(xL + 34, 980, cx + 20, 1175);
      boatGrad.addColorStop(0, '#3a5d8e');
      boatGrad.addColorStop(0.5, '#1e3864');
      boatGrad.addColorStop(1, '#102140');
      drawLeadedPiece(
        ctx,
        () => {
          ctx.moveTo(xL + 36, 976);
          ctx.quadraticCurveTo(xL + 84, 1030, cx + 10, 1105);
          ctx.lineTo(cx + 28, 1175);
          ctx.lineTo(xL + 36, 1175);
          ctx.closePath();
        },
        boatGrad,
        4.5
      );
      // Golden cross-hatched fishing net spilling over boat gunwale
      drawLeadedPiece(
        ctx,
        () => {
          ctx.moveTo(cx - 16, 1084);
          ctx.quadraticCurveTo(cx + 68, 1094, xR - 36, 1112);
          ctx.lineTo(xR - 36, 1175);
          ctx.lineTo(cx + 18, 1175);
          ctx.closePath();
        },
        '#dfb86c',
        4
      );
      // Net mesh hatching
      ctx.save();
      ctx.strokeStyle = 'rgba(72, 46, 18, 0.52)';
      ctx.lineWidth = 1.6;
      for (let nx = cx - 8; nx < xR - 38; nx += 14) {
        ctx.beginPath();
        ctx.moveTo(nx, 1090);
        ctx.lineTo(nx + 28, 1175);
        ctx.moveTo(nx + 28, 1090);
        ctx.lineTo(nx, 1175);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      // ---- RIGHT LIGHT: SIMON PETER (CRIMSON) & ANDREW (INDIGO BLUE) ----
      // Bright apple-green tree on left of right light
      drawLeadPoly(
        ctx,
        [
          [xL + 56, 945],
          [xL + 78, 945],
          [xL + 86, 822],
          [xL + 66, 822]
        ],
        '#6e4b34',
        3.8
      );
      drawLeadedPiece(
        ctx,
        () => {
          ctx.arc(xL + 90, 764, 52, 0, Math.PI * 2);
          ctx.arc(xL + 56, 784, 34, 0, Math.PI * 2);
        },
        '#72bd34',
        4.2
      );

      // Andrew (standing upright behind Peter in deep ultramarine-indigo tunic)
      const ahx = cx + 10;
      const ahy = 816;
      drawLeadedPiece(
        ctx,
        () => {
          ctx.arc(ahx, ahy, 48, 0, Math.PI * 2);
        },
        '#f4eaad',
        4.2
      );
      const indigoGrad = ctx.createLinearGradient(cx - 25, 845, cx + 110, 1150);
      indigoGrad.addColorStop(0, '#1e2c8a');
      indigoGrad.addColorStop(0.6, '#141d64');
      indigoGrad.addColorStop(1, '#0b1040');
      drawLeadPoly(
        ctx,
        [
          [cx - 32, 862],
          [cx + 96, 868],
          [cx + 112, 1142],
          [cx - 38, 1142]
        ],
        indigoGrad,
        4.5
      );
      // Andrew's gesture arms (left arm raised toward Jesus, right arm reaching down)
      drawLeadPoly(
        ctx,
        [
          [cx - 30, 880],
          [cx - 72, 864],
          [cx - 66, 896],
          [cx - 24, 916]
        ],
        '#f5e5cf',
        3.5
      );
      drawLeadPoly(
        ctx,
        [
          [cx + 78, 922],
          [xR - 36, 1020],
          [xR - 58, 1038],
          [cx + 58, 954]
        ],
        '#f5e5cf',
        3.5
      );
      drawPaintedFace(ctx, ahx - 4, ahy + 2, 22, 28, {
        facing: -0.5,
        beard: true,
        hairColor: '#c9c2b2',
        skinColor: '#f5e4cf'
      });

      // Simon Peter (kneeling in foreground, rich deep crimson-claret tunic, hauling the net)
      const phx = cx + 14;
      const phy = 918;
      drawLeadedPiece(
        ctx,
        () => {
          ctx.arc(phx, phy, 46, 0, Math.PI * 2);
        },
        '#f4eaad',
        4.2
      );
      const claretGrad = ctx.createLinearGradient(cx - 88, 940, cx + 65, 1140);
      claretGrad.addColorStop(0, '#b81a1e');
      claretGrad.addColorStop(0.55, '#8c1015');
      claretGrad.addColorStop(1, '#5c080c');
      drawLeadedPiece(
        ctx,
        () => {
          ctx.moveTo(cx - 84, 962);
          ctx.quadraticCurveTo(cx - 25, 932, cx + 52, 956);
          ctx.quadraticCurveTo(cx + 70, 1018, cx + 44, 1126);
          ctx.lineTo(cx - 94, 1126);
          ctx.quadraticCurveTo(cx - 108, 1036, cx - 84, 962);
          ctx.closePath();
        },
        claretGrad,
        4.5
      );
      drawDraperyFolds(
        ctx,
        [
          [cx - 60, 968, cx - 42, 1024, cx - 32, 1110],
          [cx - 12, 965, cx + 6, 1030, cx + 22, 1110],
          [cx - 80, 1025, cx - 22, 1044, cx + 38, 1042]
        ],
        'rgba(38, 4, 4, 0.5)',
        2.8
      );
      // Peter's bare forearms reaching down into the golden net
      drawLeadPoly(
        ctx,
        [
          [cx + 38, 1005],
          [xR - 54, 1118],
          [xR - 78, 1126],
          [cx + 12, 1034]
        ],
        '#f5e4cf',
        3.6
      );
      drawLeadPoly(
        ctx,
        [
          [cx - 78, 996],
          [xL + 38, 1098],
          [xL + 58, 1106],
          [cx - 62, 1025]
        ],
        '#f5e4cf',
        3.6
      );
      drawPaintedFace(ctx, phx - 6, phy + 2, 22, 27, {
        facing: -0.45,
        beard: true,
        hairColor: '#b59a74',
        skinColor: '#f5e4cf'
      });

      // Golden woven fishing net hauled across the foreground
      drawLeadedPiece(
        ctx,
        () => {
          ctx.moveTo(xL + 34, 1112);
          ctx.quadraticCurveTo(cx, 1100, xR - 76, 1124);
          ctx.lineTo(xR - 94, 1175);
          ctx.lineTo(xL + 34, 1175);
          ctx.closePath();
        },
        '#dfb76b',
        4.2
      );
      ctx.save();
      ctx.strokeStyle = 'rgba(72, 46, 18, 0.52)';
      ctx.lineWidth = 1.6;
      for (let nx = xL + 40; nx < xR - 86; nx += 15) {
        ctx.beginPath();
        ctx.moveTo(nx, 1104);
        ctx.lineTo(nx + 28, 1175);
        ctx.moveTo(nx + 28, 1104);
        ctx.lineTo(nx, 1175);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Lower diamond quarry panel with ruby side stripes & Gothic motto scroll (y: 1180..1414)
    drawDiamondQuarries(ctx, xL + 22, 1184, xR - 22, 1412, 38, 46, { bg: '#f0f6f5', leadW: 3.2 });
    // Ruby-red vertical framing stripes
    drawLeadedPiece(
      ctx,
      () => {
        ctx.rect(xL + 10, 1184, 14, 228);
      },
      '#c81c26',
      3
    );
    drawLeadedPiece(
      ctx,
      () => {
        ctx.rect(xR - 24, 1184, 14, 228);
      },
      '#c81c26',
      3
    );
    // Horizontal white/gold checkered architectural plinth bar at y=1178
    drawLeadedPiece(
      ctx,
      () => {
        ctx.rect(xL, 1172, lancetW, 22);
      },
      '#f4efe0',
      3.5
    );

    // Scrolled parchment banner reading "Follow me and I will" / "make you fishers of men"
    drawLeadedPiece(
      ctx,
      () => {
        ctx.roundRect(xL + 28, 1272, lancetW - 56, 56, 10);
      },
      '#f7f2dc',
      4.2
    );
    ctx.fillStyle = '#3b2b18';
    ctx.font = 'bold 26px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(lancet.side === 'left' ? 'Follow me and I will' : 'make you fishers of men', cx, 1301);

    // 4. Bottom golden dedication strip (Martha Belgrove, 1909)
    drawLeadedPiece(
      ctx,
      () => {
        ctx.rect(xL, 1414, lancetW, 68);
      },
      '#f2e5b4',
      4
    );
    ctx.fillStyle = '#4e3914';
    ctx.font = 'bold 17px Georgia, serif';
    ctx.textAlign = 'center';
    if (lancet.side === 'left') {
      ctx.fillText('To the glory of God and in memory of', cx, 1437);
      ctx.fillText('organist of this Church · died 1909', cx, 1461);
    } else {
      ctx.fillText('Martha Belgrove · for many years', cx, 1437);
      ctx.fillText('erected by Parishioners and friends', cx, 1461);
    }

    // Iron saddle bars
    drawSaddleBars(ctx, xL, xR, [626, 774, 922, 1070, 1226, 1364], 5.5);

    ctx.restore();

    // Outer lead frame stroke around lancet
    ctx.save();
    ctx.beginPath();
    traceTrefoilLancetPath(ctx, cx, lancetW, topY, botY, springY);
    ctx.strokeStyle = '#1f1c19';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.restore();
  }

  addAntiqueGlassMottle(ctx, w, h, 2029, 0.08);
  return finishGlassTexture(c, maxAniso);
}

// =========================================================================
// 2. SOUTH NAVE "SOWER" WINDOW (A1) — Joseph Nuttgens (1991)
//    Left light: The Sower ("The Sower Soweth the Word")
//    Right light: Ilmer farmyard animals — white & brown cows, woolly sheep,
//                 rooster, goose & duck beneath dusty-rose barn & leafy tree
//                 ("Given by Patricia & John Maude 1991")
// =========================================================================
export function createSowerStainedGlassTexture(maxAniso = 8) {
  const w = 1024;
  const h = 1180;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');

  // Weathered dressed stone surround + central mullion matching A1.jpg
  fillWeatheredStoneSurround(ctx, w, h, 1991, '#948a78');

  const topApexY = 38;
  const springY = 378;
  const botY = 1134;
  const xMidL = 446;
  const xMidR = 578;
  const xOuterL = 56;
  const xOuterR = w - 56;

  // Pointed half-arch clipping paths matching the real 2-light Gothic South Nave window
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

  // Helper: draw cobalt-blue & warm-cream diagonal striped outer border
  const drawStripedBorder = (bx, sideDir) => {
    const bw = 22;
    const step = 42;
    for (let y = springY - 12; y < botY - 46; y += step) {
      const isBlue = Math.floor((y - springY) / step) % 2 === 0;
      const tilt = sideDir * 10;
      drawLeadPoly(
        ctx,
        [
          [bx, y],
          [bx + bw, y + tilt],
          [bx + bw, y + step + tilt],
          [bx, y + step]
        ],
        isBlue ? '#286be0' : '#f4e0b2',
        3.5
      );
    }
  };

  // Helper: draw leafy overhanging emerald-green tree branches along top arch
  const drawLeafyBranch = (pts, leafR = 16) => {
    ctx.save();
    ctx.strokeStyle = '#181614';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();

    for (let i = 0; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) * 0.5;
      const my = (pts[i][1] + pts[i + 1][1]) * 0.5;
      const ang = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]);
      for (const s of [-1, 1]) {
        drawLeadedPiece(
          ctx,
          () => {
            ctx.ellipse(
              mx + Math.cos(ang + s * 1.1) * leafR,
              my + Math.sin(ang + s * 1.1) * leafR,
              leafR * 1.15,
              leafR * 0.52,
              ang + s * 0.75,
              0,
              Math.PI * 2
            );
          },
          s > 0 ? '#55b268' : '#7cc876',
          3.2
        );
      }
    }
    ctx.restore();
  };

  // =========================
  // LEFT LIGHT: THE SOWER
  // =========================
  ctx.save();
  ctx.beginPath();
  traceLeftLight();
  ctx.clip();

  // Sky, tiled roof, pink-violet timber barn wall, golden cornfield, green meadow, brown furrowed soil
  drawLeadedPiece(
    ctx,
    () => {
      ctx.rect(xOuterL, topApexY, xMidL - xOuterL, 215);
    },
    '#7bb5e4',
    0
  );
  // White/grey barn roof tiles
  drawLeadPoly(
    ctx,
    [
      [xOuterL + 85, 222],
      [xMidL, 142],
      [xMidL, 245],
      [xOuterL, 245]
    ],
    '#dde4e8',
    3.5
  );
  // Dusty pink-violet timber barn interior
  const roseGrad = ctx.createLinearGradient(xOuterL, 236, xMidL, 425);
  roseGrad.addColorStop(0, '#c880aa');
  roseGrad.addColorStop(0.55, '#dfa4c2');
  roseGrad.addColorStop(1, '#ecc8d8');
  drawLeadedPiece(
    ctx,
    () => {
      ctx.rect(xOuterL, 236, xMidL - xOuterL, 185);
    },
    roseGrad,
    3.8
  );
  // Timber barn posts & beam
  drawLeadedPiece(
    ctx,
    () => {
      ctx.rect(xOuterL, 246, xMidL - xOuterL, 18);
    },
    '#7c4846',
    3.5
  );
  drawLeadedPiece(
    ctx,
    () => {
      ctx.rect(xMidL - 82, 260, 22, 160);
    },
    '#7c4846',
    3.5
  );

  // Golden wheat field band (y: 416..570)
  const wheatGrad = ctx.createLinearGradient(xOuterL, 416, xMidL, 570);
  wheatGrad.addColorStop(0, '#ead09e');
  wheatGrad.addColorStop(1, '#d8b472');
  drawLeadedPiece(
    ctx,
    () => {
      ctx.rect(xOuterL, 416, xMidL - xOuterL, 155);
    },
    wheatGrad,
    3.8
  );

  // Vibrant lime-green pasture grass (y: 568..865)
  const grassGradL = ctx.createLinearGradient(xOuterL, 568, xOuterL, 865);
  grassGradL.addColorStop(0, '#a6d25a');
  grassGradL.addColorStop(1, '#68b24c');
  drawLeadedPiece(
    ctx,
    () => {
      ctx.rect(xOuterL, 568, xMidL - xOuterL, 310);
    },
    grassGradL,
    3.8
  );

  // Warm terracotta-brown furrowed soil with wavy leaded clods (y: 850..1085)
  const soilGradL = ctx.createLinearGradient(xOuterL, 850, xOuterL, 1085);
  soilGradL.addColorStop(0, '#d89c78');
  soilGradL.addColorStop(1, '#bd7b58');
  drawLeadedPiece(
    ctx,
    () => {
      ctx.rect(xOuterL, 848, xMidL - xOuterL, 242);
    },
    soilGradL,
    4
  );
  // Furrowed earth lead lines
  ctx.strokeStyle = '#221c18';
  ctx.lineWidth = 3.5;
  for (let fy = 895; fy <= 1055; fy += 38) {
    ctx.beginPath();
    ctx.moveTo(xOuterL + 22, fy);
    ctx.bezierCurveTo(xOuterL + 115, fy - 18, xMidL - 120, fy + 20, xMidL, fy - 6);
    ctx.stroke();
  }

  // Overhanging leafy branch along upper left arch
  drawLeafyBranch(
    [
      [xOuterL + 12, 365],
      [xOuterL + 75, 250],
      [xOuterL + 185, 162],
      [xMidL - 25, 112]
    ],
    17
  );

  // ---- THE SOWER FIGURE ----
  const sx = 248;

  // Segmented rose-pink & ivory radiating halo
  const shx = sx;
  const shy = 398;
  drawLeadedPiece(
    ctx,
    () => {
      ctx.arc(shx, shy, 68, 0, Math.PI * 2);
    },
    '#f6edf0',
    4.5
  );
  for (let k = 0; k < 8; k++) {
    const a0 = -Math.PI + k * 0.42;
    if (k % 2 === 0) {
      drawLeadedPiece(
        ctx,
        () => {
          ctx.moveTo(shx, shy);
          ctx.arc(shx, shy, 66, a0, a0 + 0.32);
          ctx.closePath();
        },
        '#dc8cb2',
        3.2
      );
    }
  }

  // Flowing rose-mauve outer cloak billowing behind body
  drawLeadedPiece(
    ctx,
    () => {
      ctx.moveTo(sx - 56, 468);
      ctx.quadraticCurveTo(sx - 110, 560, sx - 86, 720);
      ctx.lineTo(sx - 44, 710);
      ctx.lineTo(sx + 58, 725);
      ctx.quadraticCurveTo(sx + 135, 815, sx + 152, 742);
      ctx.quadraticCurveTo(sx + 118, 668, sx + 106, 565);
      ctx.quadraticCurveTo(sx + 98, 488, sx + 62, 462);
      ctx.closePath();
    },
    '#c87b92',
    4.5
  );

  // Golden-ochre shoulder mantle
  drawLeadedPiece(
    ctx,
    () => {
      ctx.moveTo(sx - 14, 444);
      ctx.lineTo(sx + 18, 444);
      ctx.quadraticCurveTo(sx + 92, 468, sx + 116, 526);
      ctx.quadraticCurveTo(sx + 64, 522, sx + 20, 488);
      ctx.quadraticCurveTo(sx - 46, 514, sx - 94, 534);
      ctx.quadraticCurveTo(sx - 76, 466, sx - 14, 444);
      ctx.closePath();
    },
    '#e4bc62',
    4.2
  );

  // Bare striding legs & feet on brown earth
  drawLeadPoly(
    ctx,
    [
      [sx - 48, 845],
      [sx - 20, 845],
      [sx - 42, 926],
      [sx - 96, 944],
      [sx - 92, 958],
      [sx - 28, 950],
      [sx - 16, 868]
    ],
    '#f2dec0',
    3.8
  );
  drawLeadPoly(
    ctx,
    [
      [sx + 48, 845],
      [sx + 78, 845],
      [sx + 88, 946],
      [sx + 60, 974],
      [sx + 46, 964],
      [sx + 60, 932]
    ],
    '#f2dec0',
    3.8
  );

  // Luminous cerulean-blue tunic & swirling pale sky-blue apron folds
  const blueTunicGrad = ctx.createLinearGradient(sx - 70, 470, sx + 85, 860);
  blueTunicGrad.addColorStop(0, '#5a9be8');
  blueTunicGrad.addColorStop(0.55, '#86bce8');
  blueTunicGrad.addColorStop(1, '#68a2de');
  drawLeadedPiece(
    ctx,
    () => {
      ctx.moveTo(sx - 56, 488);
      ctx.lineTo(sx + 56, 488);
      ctx.lineTo(sx + 76, 610);
      ctx.quadraticCurveTo(sx + 102, 742, sx + 106, 864);
      ctx.quadraticCurveTo(sx + 12, 882, sx - 82, 856);
      ctx.quadraticCurveTo(sx - 72, 730, sx - 42, 608);
      ctx.closePath();
    },
    blueTunicGrad,
    4.5
  );
  // Sweeping pale-blue apron gather across the hip
  drawLeadedPiece(
    ctx,
    () => {
      ctx.moveTo(sx - 22, 594);
      ctx.quadraticCurveTo(sx + 64, 600, sx + 78, 695);
      ctx.quadraticCurveTo(sx + 88, 795, sx + 94, 854);
      ctx.quadraticCurveTo(sx + 18, 818, sx - 28, 696);
      ctx.closePath();
    },
    '#c8dcf0',
    4
  );
  drawDraperyFolds(
    ctx,
    [
      [sx - 44, 670, sx - 52, 760, sx - 60, 845],
      [sx - 12, 685, sx + 18, 765, sx + 56, 842],
      [sx + 24, 635, sx + 52, 718, sx + 78, 816]
    ],
    'rgba(22, 46, 88, 0.45)',
    2.5
  );

  // Wooden seed bowl held in left arm, brimming with golden grain
  drawLeadedPiece(
    ctx,
    () => {
      ctx.ellipse(sx + 56, 526, 48, 17, -0.18, 0, Math.PI * 2);
    },
    '#e8cf62',
    3.8
  );
  drawLeadedPiece(
    ctx,
    () => {
      ctx.moveTo(sx + 10, 532);
      ctx.quadraticCurveTo(sx + 58, 550, sx + 102, 518);
      ctx.quadraticCurveTo(sx + 100, 578, sx + 58, 586);
      ctx.quadraticCurveTo(sx + 16, 584, sx + 10, 532);
      ctx.closePath();
    },
    '#c69874',
    4.2
  );
  // Right arm dipping down to scatter seeds
  drawLeadPoly(
    ctx,
    [
      [sx - 66, 545],
      [sx - 34, 545],
      [sx - 22, 628],
      [sx + 6, 646],
      [sx - 12, 664],
      [sx - 56, 632]
    ],
    '#f2dec0',
    3.8
  );

  // Expressive painted Sower head (smooth classical features, chin-length fair-brown hair)
  drawPaintedFace(ctx, shx + 2, shy + 4, 28, 36, {
    facing: 0.25,
    beard: false,
    hairColor: '#a89680',
    skinColor: '#f4e6d8'
  });

  // Little songbirds pecking seeds on the brown soil at the Sower's feet
  const drawSmallBird = (bx, by, dir, col) => {
    drawLeadedPiece(
      ctx,
      () => {
        ctx.ellipse(bx, by, 24, 11, dir * 0.22, 0, Math.PI * 2);
      },
      col,
      3.2
    );
    drawLeadPoly(
      ctx,
      [
        [bx - dir * 18, by - 4],
        [bx - dir * 42, by - 14],
        [bx - dir * 24, by + 6]
      ],
      col,
      2.8
    );
  };
  drawSmallBird(166, 1006, 1, '#e0a88a');
  drawSmallBird(326, 1044, -1, '#e6b874');

  // Cobalt & cream diagonal outer border
  drawStripedBorder(xOuterL, 1);

  // Horizontal iron saddle bar
  drawSaddleBars(ctx, xOuterL, xMidL, [578], 6.5);

  // Bottom cream inscription banner
  drawLeadedPiece(
    ctx,
    () => {
      ctx.rect(xOuterL, 1084, xMidL - xOuterL, 50);
    },
    '#f4ecd2',
    4
  );
  ctx.fillStyle = '#3c2c18';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('The Sower Soweth the Word', (xOuterL + xMidL) * 0.5, 1110);
  ctx.restore();

  // =========================
  // RIGHT LIGHT: ILMER FARMYARD ANIMALS
  // =========================
  ctx.save();
  ctx.beginPath();
  traceRightLight();
  ctx.clip();

  // Sky, tiled barn roof, pink-violet timber barn, golden field, green pasture, brown soil
  drawLeadedPiece(
    ctx,
    () => {
      ctx.rect(xMidR, topApexY, xOuterR - xMidR, 215);
    },
    '#7ab5e4',
    0
  );
  drawLeadPoly(
    ctx,
    [
      [xMidR, 145],
      [xOuterR - 80, 224],
      [xOuterR, 245],
      [xMidR, 245]
    ],
    '#dde4e8',
    3.5
  );
  drawLeadedPiece(
    ctx,
    () => {
      ctx.rect(xMidR, 236, xOuterR - xMidR, 185);
    },
    roseGrad,
    3.8
  );
  // Barn roof beam & upright timber posts
  drawLeadedPiece(
    ctx,
    () => {
      ctx.rect(xMidR, 246, xOuterR - xMidR, 18);
    },
    '#7c4846',
    3.5
  );
  drawLeadedPiece(
    ctx,
    () => {
      ctx.rect(xMidR + 178, 260, 24, 155);
    },
    '#7c4846',
    3.5
  );

  // Golden straw/wheat band
  drawLeadedPiece(
    ctx,
    () => {
      ctx.rect(xMidR, 416, xOuterR - xMidR, 158);
    },
    wheatGrad,
    3.8
  );
  // Lush green meadow
  drawLeadedPiece(
    ctx,
    () => {
      ctx.rect(xMidR, 570, xOuterR - xMidR, 305);
    },
    grassGradL,
    3.8
  );
  // Brown furrowed farmyard earth
  drawLeadedPiece(
    ctx,
    () => {
      ctx.rect(xMidR, 848, xOuterR - xMidR, 242);
    },
    soilGradL,
    4
  );
  ctx.strokeStyle = '#221c18';
  ctx.lineWidth = 3.5;
  for (let fy = 895; fy <= 1055; fy += 38) {
    ctx.beginPath();
    ctx.moveTo(xMidR, fy - 4);
    ctx.bezierCurveTo(xMidR + 110, fy + 16, xOuterR - 110, fy - 18, xOuterR - 22, fy + 4);
    ctx.stroke();
  }

  // Overhanging leafy branch along upper-right arch
  drawLeafyBranch(
    [
      [xMidR + 14, 130],
      [xMidR + 140, 148],
      [xOuterR - 95, 218],
      [xOuterR - 22, 340]
    ],
    17
  );

  // ---- 1. UPPER WHITE/CREAM COW (facing viewer-left with curved horns) ----
  drawLeadedPiece(
    ctx,
    () => {
      ctx.moveTo(670, 355);
      ctx.lineTo(868, 352);
      ctx.quadraticCurveTo(918, 365, 916, 412);
      ctx.lineTo(892, 462);
      ctx.lineTo(682, 456);
      ctx.closePath();
    },
    '#ebe4de',
    4.5
  );
  // Cow head, ears, golden horns & muzzle
  drawLeadPoly(
    ctx,
    [
      [626, 342],
      [660, 326],
      [682, 344],
      [676, 404],
      [656, 420],
      [632, 412],
      [624, 376]
    ],
    '#f5eee6',
    4.2
  );
  // Curved horns
  drawLeadPoly(
    ctx,
    [
      [624, 340],
      [608, 322],
      [632, 330]
    ],
    '#e4c254',
    3
  );
  drawLeadPoly(
    ctx,
    [
      [674, 334],
      [692, 316],
      [684, 344]
    ],
    '#e4c254',
    3
  );
  // Cow eyes & nostrils
  ctx.fillStyle = '#241e1a';
  ctx.beginPath();
  ctx.arc(642, 366, 3.5, 0, Math.PI * 2);
  ctx.arc(664, 365, 3.5, 0, Math.PI * 2);
  ctx.arc(644, 404, 2.5, 0, Math.PI * 2);
  ctx.arc(656, 404, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // ---- 2. MIDDLE RUSSET-BROWN COW (raised head looking left, four legs) ----
  // Four legs behind body
  for (const lx of [688, 720, 840, 876]) {
    drawLeadPoly(
      ctx,
      [
        [lx, 558],
        [lx + 18, 558],
        [lx + 12, 650],
        [lx - 2, 650]
      ],
      '#c87f68',
      3.8
    );
  }
  // Brown cow torso & raised neck/head
  drawLeadedPiece(
    ctx,
    () => {
      ctx.moveTo(604, 452); // muzzle tip
      ctx.lineTo(646, 434); // crown
      ctx.lineTo(676, 452); // neck top
      ctx.lineTo(724, 480); // shoulder
      ctx.lineTo(862, 476); // back
      ctx.quadraticCurveTo(914, 486, 916, 538);
      ctx.lineTo(904, 588); // hind
      ctx.quadraticCurveTo(796, 598, 692, 578); // belly
      ctx.lineTo(654, 496); // throat
      ctx.lineTo(608, 472); // jaw
      ctx.closePath();
    },
    '#d89278',
    4.5
  );
  ctx.fillStyle = '#241e1a';
  ctx.beginPath();
  ctx.arc(642, 454, 3.8, 0, Math.PI * 2);
  ctx.fill();

  // Sweeping diagonal green branch across middle of farmyard (exact A1 detail!)
  drawLeafyBranch(
    [
      [xMidR + 8, 636],
      [694, 560],
      [818, 514],
      [xOuterR - 30, 536]
    ],
    14
  );

  // ---- 3. TWO WOOLLY SHEEP / RAMS IN THE GREEN PASTURE ----
  // Rear sheep (facing right, head slightly lowered)
  drawLeadedPiece(
    ctx,
    () => {
      ctx.moveTo(744, 646);
      ctx.quadraticCurveTo(836, 622, 912, 666);
      ctx.lineTo(926, 732);
      ctx.lineTo(902, 746);
      ctx.lineTo(748, 738);
      ctx.closePath();
    },
    '#eae2d4',
    4.2
  );
  // Front ram (cream fleece, curled golden horns, four legs)
  for (const lx of [618, 650, 748, 782]) {
    drawLeadPoly(
      ctx,
      [
        [lx, 736],
        [lx + 18, 736],
        [lx + 10, 816],
        [lx - 4, 816]
      ],
      '#ded4c2',
      3.6
    );
  }
  drawLeadedPiece(
    ctx,
    () => {
      ctx.moveTo(614, 684);
      ctx.quadraticCurveTo(688, 660, 774, 672);
      ctx.quadraticCurveTo(806, 706, 786, 756);
      ctx.quadraticCurveTo(702, 772, 616, 752);
      ctx.quadraticCurveTo(596, 718, 614, 684);
      ctx.closePath();
    },
    '#dfd4c0',
    4.5
  );
  // Ram head facing front-right with curled horns
  drawLeadPoly(
    ctx,
    [
      [754, 668],
      [796, 654],
      [822, 678],
      [804, 728],
      [776, 728],
      [756, 696]
    ],
    '#ece4d6',
    4
  );
  // Curled horns
  ctx.save();
  ctx.strokeStyle = '#c8a65a';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(754, 668, 12, Math.PI * 0.4, Math.PI * 1.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(822, 676, 12, -Math.PI * 0.9, Math.PI * 0.6);
  ctx.stroke();
  ctx.strokeStyle = '#1b1816';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(754, 668, 15, Math.PI * 0.4, Math.PI * 1.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(822, 676, 15, -Math.PI * 0.9, Math.PI * 0.6);
  ctx.stroke();
  ctx.restore();

  // ---- 4. BLUE-GREY DUCK behind the rooster ----
  drawLeadedPiece(
    ctx,
    () => {
      ctx.moveTo(648, 762);
      ctx.quadraticCurveTo(712, 814, 834, 834);
      ctx.quadraticCurveTo(778, 892, 694, 876);
      ctx.quadraticCurveTo(664, 830, 648, 762);
      ctx.closePath();
    },
    '#8fa5b4',
    4
  );

  // ---- 5. PROUD ROOSTER / COCKEREL (golden neck, red comb, dark-green tail plumes) ----
  // Tall curved dark-green tail plumes
  drawLeadedPiece(
    ctx,
    () => {
      ctx.moveTo(724, 882);
      ctx.quadraticCurveTo(758, 804, 818, 858);
      ctx.quadraticCurveTo(828, 912, 768, 932);
      ctx.closePath();
    },
    '#346b32',
    4.2
  );
  // Legs & claws
  ctx.strokeStyle = '#c89c46';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(698, 962);
  ctx.lineTo(688, 1020);
  ctx.moveTo(726, 962);
  ctx.lineTo(738, 1024);
  ctx.stroke();
  // Russet feathered body & wing
  drawLeadedPiece(
    ctx,
    () => {
      ctx.ellipse(706, 932, 56, 38, 0.14, 0, Math.PI * 2);
    },
    '#be7a3c',
    4.2
  );
  // Golden hackle neck & head
  drawLeadedPiece(
    ctx,
    () => {
      ctx.moveTo(640, 840);
      ctx.quadraticCurveTo(676, 840, 692, 910);
      ctx.quadraticCurveTo(656, 938, 636, 900);
      ctx.quadraticCurveTo(632, 864, 640, 840);
      ctx.closePath();
    },
    '#d8b862',
    4
  );
  // Bright crimson comb & wattle
  drawLeadPoly(
    ctx,
    [
      [632, 838],
      [642, 814],
      [656, 822],
      [668, 814],
      [674, 836],
      [642, 846]
    ],
    '#d42422',
    3.2
  );
  drawLeadedPiece(
    ctx,
    () => {
      ctx.arc(636, 864, 9, 0, Math.PI * 2);
    },
    '#d42422',
    2.8
  );

  // ---- 6. WHITE GOOSE BENDING DOWN TO PECK AT BOTTOM-RIGHT ----
  drawLeadedPiece(
    ctx,
    () => {
      ctx.moveTo(918, 870); // tail tip
      ctx.quadraticCurveTo(860, 916, 804, 976); // back
      ctx.lineTo(754, 1022); // neck stretching down
      ctx.lineTo(738, 1044); // beak
      ctx.lineTo(774, 1034); // throat
      ctx.quadraticCurveTo(846, 1028, 892, 980); // belly
      ctx.quadraticCurveTo(924, 932, 918, 870);
      ctx.closePath();
    },
    '#e4ecee',
    4.2
  );
  // Goose orange beak & webbed feet
  drawLeadPoly(
    ctx,
    [
      [754, 1024],
      [734, 1054],
      [764, 1042]
    ],
    '#e09238',
    3
  );
  drawLeadPoly(
    ctx,
    [
      [832, 1018],
      [848, 1052],
      [874, 1048],
      [846, 1016]
    ],
    '#d89642',
    3
  );

  // Cobalt & cream diagonal striped outer right border
  drawStripedBorder(xOuterR - 22, -1);

  // Horizontal iron saddle bar
  drawSaddleBars(ctx, xMidR, xOuterR, [578], 6.5);

  // Bottom cream inscription banner
  drawLeadedPiece(
    ctx,
    () => {
      ctx.rect(xMidR, 1084, xOuterR - xMidR, 50);
    },
    '#f4ecd2',
    4
  );
  ctx.fillStyle = '#3c2c18';
  ctx.font = 'bold 23px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Given by Patricia & John Maude 1991', (xMidR + xOuterR) * 0.5, 1110);
  ctx.restore();

  // Outer black lead frame strokes around both lights
  ctx.save();
  ctx.strokeStyle = '#1d1a18';
  ctx.lineWidth = 7;
  ctx.beginPath();
  traceLeftLight();
  ctx.stroke();
  ctx.beginPath();
  traceRightLight();
  ctx.stroke();
  ctx.restore();

  addAntiqueGlassMottle(ctx, w, h, 1997, 0.075);
  return finishGlassTexture(c, maxAniso);
}

// =========================================================================
// 3. NORTH NAVE "JAQUES / GOOD SAMARITAN" WINDOW (A3) — J.E. Nuttgens (1933)
//    Square-headed stone frame with twin cusped trefoil Gothic lights
//    Left:  "AND WHEN HE SAW HIM" — Priest, Levite, donkey head & wounded man
//    Right: "HE HAD COMPASSION ON HIM" — Good Samaritan with oil flask & donkey
//    Bottom: Mary Clara Jaques (1849–1932) of Horsenden House + heraldic shield
// =========================================================================
export function createJaquesStainedGlassTexture(maxAniso = 8) {
  const w = 1024;
  const h = 1280;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');

  // Weathered warm grey-taupe limestone surround matching A3.jpg
  fillWeatheredStoneSurround(ctx, w, h, 1933, '#978d7e');

  const lancets = [
    { cx: 282, side: 'left' },
    { cx: 742, side: 'right' }
  ];
  const lancetW = 356;
  const topY = 122;
  const springY = 342;
  const botY = 1138;

  // Helper: draw dark emerald flowering foliage with crisp white 5-petalled blossoms
  const drawFloweringBush = (cx, cy, rx, ry, seed) => {
    const rng = mulberry32(seed);
    drawLeadedPiece(
      ctx,
      () => {
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      },
      '#1e6b36',
      4.2
    );
    // Individual pointed green leaves
    for (let i = 0; i < 22; i++) {
      const lx = cx + (rng() - 0.5) * rx * 1.75;
      const ly = cy + (rng() - 0.5) * ry * 1.75;
      const ang = rng() * Math.PI;
      drawLeadedPiece(
        ctx,
        () => {
          ctx.ellipse(lx, ly, 16, 7.5, ang, 0, Math.PI * 2);
        },
        rng() > 0.4 ? '#2b8a42' : '#40a250',
        2.4
      );
    }
    // Crisp white & gold blossoms
    for (let i = 0; i < 9; i++) {
      const fx = cx + (rng() - 0.5) * rx * 1.4;
      const fy = cy + (rng() - 0.5) * ry * 1.4;
      ctx.fillStyle = '#f8f6ec';
      ctx.strokeStyle = '#1b1815';
      ctx.lineWidth = 1.6;
      for (let p = 0; p < 5; p++) {
        const a = (p * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.arc(fx + Math.cos(a) * 6, fy + Math.sin(a) * 6, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#e8ba3a';
      ctx.beginPath();
      ctx.arc(fx, fy, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  for (const lancet of lancets) {
    const cx = lancet.cx;
    const xL = cx - lancetW * 0.5;
    const xR = cx + lancetW * 0.5;

    // Carved sunken Gothic arch hood mould in stone around each trefoil head
    ctx.save();
    ctx.strokeStyle = 'rgba(54, 46, 36, 0.36)';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(xL - 28, botY + 18);
    ctx.lineTo(xL - 28, springY + 12);
    ctx.quadraticCurveTo(xL - 22, topY - 40, cx, topY - 64);
    ctx.quadraticCurveTo(xR + 22, topY - 40, xR + 28, springY + 12);
    ctx.lineTo(xR + 28, botY + 18);
    ctx.stroke();
    ctx.restore();

    // Inner stone reveal chamfer
    ctx.save();
    ctx.beginPath();
    traceTrefoilLancetPath(ctx, cx, lancetW + 22, topY - 12, botY + 10, springY - 4);
    ctx.fillStyle = '#756c5e';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    traceTrefoilLancetPath(ctx, cx, lancetW, topY, botY, springY);
    ctx.clip();

    // ---- 1. UPPER CUSPED TREFOIL HEAD WITH DIAMOND QUARRIES & MOTTO RIBBON ----
    drawDiamondQuarries(ctx, xL, topY, xR, 386, 38, 46, {
      bg: '#e8f1f5',
      leadW: 3.4,
      rosette: false,
      tintBlue: true
    });

    // Two-tier scrolled white & gold parchment ribbon banners
    // Gold ribbon curls behind
    drawLeadPoly(
      ctx,
      [
        [cx - 115, 290],
        [cx + 115, 232],
        [cx + 120, 266],
        [cx - 110, 324]
      ],
      '#e8c454',
      3.5
    );
    // Upper arched parchment scroll
    drawLeadedPiece(
      ctx,
      () => {
        ctx.roundRect(cx - 118, 212, 236, 48, 16);
      },
      '#f5f2e4',
      4
    );
    // Lower arched parchment scroll
    drawLeadedPiece(
      ctx,
      () => {
        ctx.roundRect(cx - 126, 286, 252, 48, 16);
      },
      '#f5f2e4',
      4
    );
    ctx.fillStyle = '#2e261d';
    ctx.font = 'bold 24px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (lancet.side === 'left') {
      ctx.fillText('"AND WHEN', cx, 237);
      ctx.fillText('HE SAW HIM', cx, 311);
    } else {
      ctx.fillText('COMPASSION ON', cx, 237);
      ctx.fillText('HE HAD · HIM"', cx, 311);
    }

    // ---- 2. MAIN NARRATIVE SCENE (y: 382..1052) ----
    // Distant sky & Judean hills
    const skyGrad = ctx.createLinearGradient(xL, 382, xL, 535);
    skyGrad.addColorStop(0, '#89b4dc');
    skyGrad.addColorStop(1, '#c8ddec');
    drawLeadedPiece(
      ctx,
      () => {
        ctx.rect(xL, 382, lancetW, 175);
      },
      skyGrad,
      3.5
    );
    // Rolling green hillside & rocky road
    drawLeadedPiece(
      ctx,
      () => {
        ctx.rect(xL, 530, lancetW, 524);
      },
      '#4f9e46',
      3.5
    );

    if (lancet.side === 'left') {
      // ======== LEFT LIGHT: PRIEST, LEVITE, DONKEY HEAD & WOUNDED TRAVELLER ========
      // Distant Levite walking away up the road (top-center-right)
      drawLeadPoly(
        ctx,
        [
          [cx + 6, 446],
          [cx + 46, 440],
          [cx + 62, 548],
          [cx + 6, 554]
        ],
        '#ebe5d4',
        3.5
      );
      drawLeadPoly(
        ctx,
        [
          [cx + 2, 424],
          [cx + 38, 422],
          [cx + 52, 492],
          [cx - 8, 532]
        ],
        '#cc222a',
        3.8
      );
      drawLeadedPiece(
        ctx,
        () => {
          ctx.arc(cx + 24, 412, 16, 0, Math.PI * 2);
        },
        '#f2dec4',
        3
      );

      // Flowering dark-green Judean bush along right edge
      drawFloweringBush(xR - 28, 560, 72, 155, 3101);

      // Priest walking away uphill (left-upper): magenta-plum robe, cream shawl, red cap
      // Plum cloak
      drawLeadedPiece(
        ctx,
        () => {
          ctx.moveTo(xL + 26, 474);
          ctx.lineTo(xL + 132, 468);
          ctx.lineTo(xL + 186, 688);
          ctx.lineTo(xL + 66, 670);
          ctx.closePath();
        },
        '#c24e82',
        4.2
      );
      // Cream striped stole / mantle over Priest's shoulder
      drawLeadPoly(
        ctx,
        [
          [xL + 36, 466],
          [xL + 114, 456],
          [xL + 148, 520],
          [xL + 72, 514]
        ],
        '#ece7d8',
        3.8
      );
      drawLeadPoly(
        ctx,
        [
          [xL + 98, 506],
          [xL + 124, 506],
          [xL + 162, 650],
          [xL + 134, 652]
        ],
        '#ece7d8',
        3.5
      );
      // Crimson sleeve & cap
      drawLeadPoly(
        ctx,
        [
          [xL + 24, 494],
          [xL + 66, 510],
          [xL + 60, 568],
          [xL + 20, 558]
        ],
        '#d62c2e',
        3.8
      );
      drawPaintedFace(ctx, xL + 66, 434, 22, 24, {
        facing: -0.6,
        beard: true,
        hairColor: '#cabba2',
        skinColor: '#f2e0c8'
      });
      drawLeadedPiece(
        ctx,
        () => {
          ctx.ellipse(xL + 68, 408, 28, 12, -0.1, 0, Math.PI * 2);
        },
        '#d22628',
        3.5
      );

      // Donkey head & ears peeking in from the right edge (y: 590..780)
      drawLeadPoly(
        ctx,
        [
          [xR - 102, 594],
          [xR - 46, 628],
          [xR - 58, 652]
        ],
        '#c8c0b4',
        3.8
      );
      drawLeadPoly(
        ctx,
        [
          [xR - 44, 580],
          [xR - 14, 626],
          [xR - 36, 646]
        ],
        '#c8c0b4',
        3.8
      );
      drawLeadedPiece(
        ctx,
        () => {
          ctx.moveTo(xR, 636);
          ctx.lineTo(xR - 64, 642);
          ctx.lineTo(xR - 92, 744);
          ctx.quadraticCurveTo(xR - 72, 774, xR - 34, 764);
          ctx.lineTo(xR, 738);
          ctx.closePath();
        },
        '#d6cfc4',
        4.2
      );
      // Golden leather bridle & eye
      drawLeadPoly(
        ctx,
        [
          [xR - 76, 672],
          [xR - 6, 668],
          [xR - 6, 684],
          [xR - 80, 688]
        ],
        '#e2bc4e',
        3.2
      );
      ctx.fillStyle = '#241d18';
      ctx.beginPath();
      ctx.arc(xR - 64, 698, 5, 0, Math.PI * 2);
      ctx.fill();

      // ---- WOUNDED TRAVELLER RECLINING ON GRASS & PEBBLES (y: 660..1040) ----
      // Pebbled roadside foreground
      for (let px = xL + 20; px < xR - 12; px += 44) {
        drawLeadedPiece(
          ctx,
          () => {
            ctx.ellipse(px, 1020 + ((px * 7) % 18), 24, 11, 0, 0, Math.PI * 2);
          },
          px % 88 === 0 ? '#52a648' : '#d2c29e',
          3
        );
      }

      // Cobalt-blue mantle draped around shoulders & hips
      const blueMantleGrad = ctx.createLinearGradient(xL + 20, 740, cx + 110, 1020);
      blueMantleGrad.addColorStop(0, '#1444b8');
      blueMantleGrad.addColorStop(0.55, '#1d5ee0');
      blueMantleGrad.addColorStop(1, '#0e3088');
      drawLeadedPiece(
        ctx,
        () => {
          ctx.moveTo(xL + 28, 768);
          ctx.lineTo(cx + 12, 772);
          ctx.lineTo(cx + 42, 854);
          ctx.lineTo(xL + 18, 868);
          ctx.closePath();
        },
        blueMantleGrad,
        4.2
      );

      // Bare pale torso & bent right arm supporting himself on ground
      const fleshGrad = ctx.createLinearGradient(xL + 40, 770, cx + 80, 960);
      fleshGrad.addColorStop(0, '#faebd4');
      fleshGrad.addColorStop(1, '#dfc4a4');
      drawLeadedPiece(
        ctx,
        () => {
          ctx.moveTo(xL + 58, 792);
          ctx.lineTo(cx + 16, 804);
          ctx.quadraticCurveTo(cx + 38, 864, cx + 28, 926);
          ctx.lineTo(xL + 46, 944);
          ctx.quadraticCurveTo(xL + 42, 862, xL + 58, 792);
          ctx.closePath();
        },
        fleshGrad,
        4
      );
      // Right arm reaching down to the ground
      drawLeadPoly(
        ctx,
        [
          [xL + 42, 822],
          [xL + 72, 838],
          [xL + 52, 996],
          [xL + 18, 996]
        ],
        fleshGrad,
        3.8
      );
      // Golden yellow sash / lining across waist
      drawLeadPoly(
        ctx,
        [
          [xL + 54, 892],
          [cx + 30, 902],
          [cx + 18, 940],
          [xL + 48, 934]
        ],
        '#e8c448',
        3.6
      );
      // Cobalt-blue waist wrap & lower robe folds
      drawLeadedPiece(
        ctx,
        () => {
          ctx.moveTo(xL + 52, 926);
          ctx.lineTo(cx + 68, 916);
          ctx.lineTo(cx + 114, 1022);
          ctx.lineTo(xL + 48, 1024);
          ctx.closePath();
        },
        blueMantleGrad,
        4.2
      );
      // Bent bare right leg & golden sandal reaching toward right edge
      drawLeadedPiece(
        ctx,
        () => {
          ctx.moveTo(cx + 18, 892);
          ctx.quadraticCurveTo(cx + 72, 846, cx + 106, 876);
          ctx.lineTo(xR - 10, 976);
          ctx.lineTo(xR - 32, 1004);
          ctx.lineTo(cx + 66, 922);
          ctx.lineTo(cx + 22, 948);
          ctx.closePath();
        },
        fleshGrad,
        4.2
      );
      // Golden laced sandal
      drawLeadPoly(
        ctx,
        [
          [xR - 46, 964],
          [xR - 8, 968],
          [xR - 6, 1026],
          [xR - 36, 1024]
        ],
        '#e2bc4a',
        3.5
      );
      // Wounded traveller's blond head tilted slightly right with eyes closed
      drawPaintedFace(ctx, xL + 84, 728, 32, 38, {
        facing: 0.2,
        beard: false,
        hairColor: '#e4bd54',
        skinColor: '#f6e4cc',
        eyesClosed: true,
        tilt: 0.25
      });
    } else {
      // ======== RIGHT LIGHT: GOOD SAMARITAN, OIL FLASK & DONKEY ========
      // Walled city of Jericho along distant blue-gold skyline
      drawLeadPoly(
        ctx,
        [
          [xL + 74, 434],
          [xR, 424],
          [xR, 456],
          [xL + 74, 456]
        ],
        '#c2d6e8',
        3
      );
      // Flowering dark-green Judean foliage behind Samaritan
      drawFloweringBush(xL + 56, 518, 66, 118, 3202);
      drawFloweringBush(xR - 36, 526, 62, 112, 3209);

      // Pebbled foreground path
      for (let px = xL + 24; px < xR - 14; px += 46) {
        drawLeadedPiece(
          ctx,
          () => {
            ctx.ellipse(px, 1024 + ((px * 5) % 16), 26, 11, 0, 0, Math.PI * 2);
          },
          px % 92 === 0 ? '#50a246' : '#d4c39c',
          3
        );
      }

      // Donkey body, saddle cloth & standing legs on left side behind Samaritan
      drawLeadPoly(
        ctx,
        [
          [xL, 648],
          [xL + 104, 658],
          [xL + 98, 822],
          [xL, 826]
        ],
        '#d6cfc4',
        4.2
      );
      // Orange-ochre & black/white checkered saddle blanket
      drawLeadPoly(
        ctx,
        [
          [xL + 14, 632],
          [xL + 102, 650],
          [xL + 92, 742],
          [xL + 8, 728]
        ],
        '#de7b2a',
        3.8
      );
      // Donkey hind/front legs standing on pebbles
      drawLeadPoly(
        ctx,
        [
          [xL + 12, 816],
          [xL + 46, 816],
          [xL + 50, 998],
          [xL + 16, 998]
        ],
        '#cfc8bc',
        3.8
      );
      drawLeadPoly(
        ctx,
        [
          [xL + 58, 816],
          [xL + 86, 816],
          [xL + 78, 998],
          [xL + 48, 998]
        ],
        '#beb6a8',
        3.8
      );

      // ---- GOOD SAMARITAN FIGURE ----
      // Pleated ivory-cream undertunic reaching to golden sandals
      drawLeadPoly(
        ctx,
        [
          [cx - 64, 524],
          [cx + 114, 540],
          [cx + 128, 976],
          [cx - 72, 976]
        ],
        '#f2eee0',
        4.2
      );
      drawDraperyFolds(ctx, [
        [cx - 40, 880, cx - 42, 932, cx - 44, 972],
        [cx - 10, 880, cx - 8, 932, cx - 6, 972],
        [cx + 42, 880, cx + 48, 932, cx + 54, 972],
        [cx + 84, 880, cx + 92, 932, cx + 100, 972]
      ]);

      // Golden sandals on pebbles
      drawLeadPoly(
        ctx,
        [
          [cx - 76, 976],
          [cx - 22, 976],
          [cx - 14, 1022],
          [cx - 102, 1022]
        ],
        '#e5bf48',
        3.8
      );
      drawLeadPoly(
        ctx,
        [
          [cx + 76, 976],
          [cx + 126, 976],
          [cx + 144, 1026],
          [cx + 58, 1026]
        ],
        '#e5bf48',
        3.8
      );

      // Rich ruby-crimson open over-robe with vertical lead folds (signature A3 red!)
      const samRedGrad = ctx.createLinearGradient(cx - 75, 510, cx + 125, 955);
      samRedGrad.addColorStop(0, '#d21e28');
      samRedGrad.addColorStop(0.5, '#a8121c');
      samRedGrad.addColorStop(1, '#780a12');
      // Left front panel of crimson robe
      drawLeadedPiece(
        ctx,
        () => {
          ctx.moveTo(cx - 56, 514);
          ctx.lineTo(cx + 8, 524);
          ctx.lineTo(cx - 8, 944);
          ctx.lineTo(cx - 78, 932);
          ctx.closePath();
        },
        samRedGrad,
        4.5
      );
      // Right sweeping panel of crimson robe
      drawLeadedPiece(
        ctx,
        () => {
          ctx.moveTo(cx + 16, 512);
          ctx.lineTo(cx + 106, 546);
          ctx.quadraticCurveTo(cx + 138, 740, cx + 132, 934);
          ctx.lineTo(cx + 18, 948);
          ctx.closePath();
        },
        samRedGrad,
        4.5
      );
      drawDraperyFolds(
        ctx,
        [
          [cx + 42, 680, cx + 56, 800, cx + 68, 930],
          [cx + 76, 680, cx + 92, 800, cx + 104, 922],
          [cx - 42, 680, cx - 48, 800, cx - 54, 922]
        ],
        'rgba(46, 4, 8, 0.55)',
        3
      );

      // Flowing cream sleeves (right arm reaching leftward toward wounded man; left arm holding flask)
      drawLeadPoly(
        ctx,
        [
          [cx - 52, 560],
          [cx - 12, 588],
          [xL + 64, 738],
          [xL + 36, 706]
        ],
        '#f2eee0',
        4
      );
      // Tender outstretched right hand
      drawLeadedPiece(
        ctx,
        () => {
          ctx.ellipse(xL + 32, 728, 28, 13, -0.22, 0, Math.PI * 2);
        },
        '#f2dec4',
        3.5
      );

      // Cobalt-blue waist sash with trailing knot
      drawLeadPoly(
        ctx,
        [
          [cx - 32, 650],
          [cx + 76, 656],
          [cx + 104, 760],
          [cx + 68, 766],
          [cx + 48, 694],
          [cx - 36, 686]
        ],
        '#1b62d8',
        4.2
      );

      // Left cream sleeve + hand holding golden cross-hatched oil/wine flask
      drawLeadPoly(
        ctx,
        [
          [cx + 68, 560],
          [cx + 144, 594],
          [cx + 122, 692],
          [cx + 42, 682],
          [cx + 46, 646],
          [cx + 96, 646]
        ],
        '#f2eee0',
        4
      );
      drawLeadedPiece(
        ctx,
        () => {
          ctx.ellipse(cx + 40, 662, 20, 14, -0.1, 0, Math.PI * 2);
        },
        '#f2dec4',
        3.2
      );
      // Golden wicker-covered oil/wine flask
      drawLeadedPiece(
        ctx,
        () => {
          ctx.ellipse(cx + 48, 712, 24, 34, -0.18, 0, Math.PI * 2);
        },
        '#e8c452',
        4
      );
      ctx.save();
      ctx.strokeStyle = 'rgba(84, 52, 16, 0.55)';
      ctx.lineWidth = 1.6;
      for (let k = -18; k <= 18; k += 9) {
        ctx.beginPath();
        ctx.moveTo(cx + 48 + k, 684);
        ctx.lineTo(cx + 48 + k + 12, 740);
        ctx.moveTo(cx + 48 + k + 12, 684);
        ctx.lineTo(cx + 48 + k, 740);
        ctx.stroke();
      }
      ctx.restore();

      // Good Samaritan's compassionate bearded head leaning left + striped turban & magenta crown
      drawPaintedFace(ctx, cx - 56, 514, 28, 34, {
        facing: -0.65,
        beard: true,
        hairColor: '#967654',
        skinColor: '#efd9bc',
        tilt: -0.22
      });
      // Striped cream/gold turban wrap & magenta crown cap
      drawLeadedPiece(
        ctx,
        () => {
          ctx.ellipse(cx - 56, 468, 42, 18, -0.15, 0, Math.PI * 2);
        },
        '#c23664',
        3.8
      );
      drawLeadedPiece(
        ctx,
        () => {
          ctx.ellipse(cx - 56, 484, 48, 16, 0.08, 0, Math.PI * 2);
        },
        '#efe8d6',
        4
      );
      // Golden flowing turban tail across shoulder
      drawLeadPoly(
        ctx,
        [
          [cx - 32, 488],
          [cx + 6, 502],
          [cx - 6, 526],
          [cx - 44, 510]
        ],
        '#e4be4a',
        3.5
      );
    }

    // ---- 3. BOTTOM DEDICATION STRIP (Mary Clara Jaques, 1849–1932) ----
    drawLeadedPiece(
      ctx,
      () => {
        ctx.rect(xL, 1054, lancetW, 84);
      },
      '#f2edd8',
      4.5
    );
    // Decorative black-and-white checkered Gothic border along top of dedication strip
    for (let cxTile = xL; cxTile < xR; cxTile += 18) {
      ctx.fillStyle = Math.floor((cxTile - xL) / 18) % 2 === 0 ? '#24201c' : '#e6cf74';
      ctx.fillRect(cxTile, 1054, 18, 9);
    }

    ctx.fillStyle = '#2d241b';
    ctx.font = 'bold 19px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (lancet.side === 'left') {
      ctx.fillText('To the GLORY of GOD and in memory', cx, 1086);
      ctx.fillText('of HORSENDEN HOUSE.  Born', cx, 1114);
    } else {
      ctx.fillText('of MARY CLARA JAQUES', cx - 28, 1086);
      ctx.fillText('Mar. 31st 1849. Died Jan. 13th 1932.', cx - 28, 1114);

      // Ornate blue & gold heraldic coat-of-arms shield in bottom-right corner
      const sx = xR - 40;
      const sy = 1098;
      drawLeadedPiece(
        ctx,
        () => {
          ctx.moveTo(sx - 26, sy - 30);
          ctx.lineTo(sx + 26, sy - 30);
          ctx.lineTo(sx + 24, sy + 6);
          ctx.quadraticCurveTo(sx, sy + 32, sx, sy + 32);
          ctx.quadraticCurveTo(sx, sy + 32, sx - 24, sy + 6);
          ctx.closePath();
        },
        '#1b58c8',
        3.2
      );
      // Gold diagonal bend across shield
      drawLeadPoly(
        ctx,
        [
          [sx - 24, sy - 16],
          [sx + 22, sy + 14],
          [sx + 16, sy + 24],
          [sx - 24, sy - 2]
        ],
        '#ebca4a',
        2.5
      );
    }

    // Heavy horizontal iron saddle bars (matching the 4 prominent bars in A3.jpg!)
    drawSaddleBars(ctx, xL, xR, [384, 560, 744, 932], 7.5);

    ctx.restore();

    // Outer lead frame stroke around lancet
    ctx.save();
    ctx.beginPath();
    traceTrefoilLancetPath(ctx, cx, lancetW, topY, botY, springY);
    ctx.strokeStyle = '#1d1a17';
    ctx.lineWidth = 7.5;
    ctx.stroke();
    ctx.restore();
  }

  addAntiqueGlassMottle(ctx, w, h, 1937, 0.08);
  return finishGlassTexture(c, maxAniso);
}
