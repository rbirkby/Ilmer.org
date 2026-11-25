// Height-field relief carvings of St Peter's Church, Ilmer:
//  - Shared separable 5x5 heightfield blur & pierced-carving geometry builder
//  - Window 7 medieval chancel jamb carvings (Crucifixion & St Christopher)
//  - Carved limewood angels on the nave wall-plates
//  - Pierced oak lectern front panel
import * as THREE from 'three';
import { canvas2d, canvasTexture, makeCanvas, mulberry32 } from './canvas-utils.ts';

type ReliefPath = (ctx: CanvasRenderingContext2D) => void;
type ReliefForm = (path: ReliefPath, peak: number, edge: number, cx?: number, cy?: number, r?: number) => void;
type ReliefCut = (path: ReliefPath, width: number, alpha?: number) => void;

interface ReliefFrame {
  l: number;
  r: number;
  t: number;
  b: number;
}

export interface ChancelReliefHeightMaps {
  crucifixion: HTMLCanvasElement;
  stChristopher: HTMLCanvasElement;
}

export interface BlurredHeightField {
  hf: Float32Array<ArrayBuffer>;
  cw: number;
  ch: number;
}

/** One separable 5x5 box-blur pass (horizontal then vertical) over a cw x ch scalar height field. */
export function blurHeightField(src: Float32Array<ArrayBuffer>, cw: number, ch: number): Float32Array<ArrayBuffer> {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < ch; y++) {
    const row = y * cw;
    for (let x = 0; x < cw; x++) {
      let sum = 0;
      let cnt = 0;
      const x0 = Math.max(0, x - 2);
      const x1 = Math.min(cw - 1, x + 2);
      for (let xx = x0; xx <= x1; xx++) {
        sum += src[row + xx];
        cnt++;
      }
      tmp[row + x] = sum / cnt;
    }
  }
  for (let y = 0; y < ch; y++) {
    const y0 = Math.max(0, y - 2);
    const y1 = Math.min(ch - 1, y + 2);
    const cnt = y1 - y0 + 1;
    const row = y * cw;
    for (let x = 0; x < cw; x++) {
      let sum = 0;
      for (let yy = y0; yy <= y1; yy++) sum += tmp[yy * cw + x];
      out[row + x] = sum / cnt;
    }
  }
  return out;
}

/** Extracts the red channel of a height-field canvas and softens it with two separable 5x5 blur passes. */
export function canvasToBlurredHeightField(canvas: HTMLCanvasElement): BlurredHeightField {
  const cw = canvas.width;
  const ch = canvas.height;
  const px = canvas2d(canvas).getImageData(0, 0, cw, ch).data;
  const raw = new Float32Array(cw * ch);
  for (let i = 0; i < cw * ch; i++) raw[i] = px[i * 4] / 255;
  const hf = blurHeightField(blurHeightField(raw, cw, ch), cw, ch);
  return { hf, cw, ch };
}

/**
 * Builds a pierced (cut-out) carving mesh from a pre-blurred height field (optionally slicing a horizontal sub-region
 * `[srcX, srcX + sliceW)` so a full carving and its halves share one height-map draw and blur pass).
 * Front faces +Z, back sits flat at z = 0; anything below a small height is cut away via alphaMap.
 */
export function buildPiercedCarvingFromField(
  field: BlurredHeightField,
  depth: number,
  material: THREE.MeshStandardMaterial,
  pxPerMm = 1,
  slice?: { srcX: number; width: number }
): THREE.Mesh {
  const srcX = slice?.srcX ?? 0;
  const cw = slice?.width ?? field.cw;
  const ch = field.ch;
  const fullW = field.cw;
  const hf = field.hf;

  // Alpha mask from the softened silhouette
  const mask = makeCanvas(cw, ch);
  const mctx = canvas2d(mask);
  const img = mctx.createImageData(cw, ch);
  for (let y = 0; y < ch; y++) {
    const srcRow = y * fullW + srcX;
    const dstRow = y * cw;
    for (let x = 0; x < cw; x++) {
      const v = hf[srcRow + x] > 0.12 ? 255 : 0;
      const idx = (dstRow + x) * 4;
      img.data[idx] = v;
      img.data[idx + 1] = v;
      img.data[idx + 2] = v;
      img.data[idx + 3] = 255;
    }
  }
  mctx.putImageData(img, 0, 0);
  const alphaMap = canvasTexture(mask, { srgb: false });

  const width = (cw * 0.001) / pxPerMm;
  const height = (ch * 0.001) / pxPerMm;
  // Subdivide every ~4 mm in world space regardless of pxPerMm (the alphaMap carries sub-millimetre edge detail)
  const segX = Math.max(4, Math.round(width / 0.004));
  const segY = Math.max(4, Math.round(height / 0.004));
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = Math.min(cw - 1, Math.round(uv.getX(i) * (cw - 1)));
    const y = Math.min(ch - 1, Math.round((1 - uv.getY(i)) * (ch - 1)));
    const hv = hf[y * fullW + srcX + x];
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

/** Pierced carving from a height-field canvas (1px = 1mm at pxPerMm = 1). */
export function buildPiercedCarving(
  canvas: HTMLCanvasElement,
  depth: number,
  material: THREE.MeshStandardMaterial,
  pxPerMm = 1
): THREE.Mesh {
  return buildPiercedCarvingFromField(canvasToBlurredHeightField(canvas), depth, material, pxPerMm);
}

// -------------------------------------------------------------------------
// Shared height-field drawing helpers for the carved reliefs below
// -------------------------------------------------------------------------
const grey = (v: number) => `rgb(${v},${v},${v})`;

// Raise a rounded form: radial-gradient dome clipped to the path, merged with 'lighten' (higher wins)
const makeForm =
  (ctx: CanvasRenderingContext2D): ReliefForm =>
  (path, peak, edge, cx, cy, r) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighten';
    ctx.beginPath();
    path(ctx);
    if (r && cx !== undefined && cy !== undefined) {
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
  (ctx: CanvasRenderingContext2D): ReliefCut =>
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
  (x: number, y: number, rx: number, ry: number, rot = 0): ReliefPath =>
  (c) =>
    c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);

const poly =
  (pts: number[][]): ReliefPath =>
  (c) => {
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
  };

const line =
  (pts: number[][]): ReliefPath =>
  (c) => {
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  };

// A limb / staff as a capsule between two points
const limb = (form: ReliefForm, a: number[], b: number[], r: number, peak: number, edge: number) => {
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

const rosette = (form: ReliefForm, cut: ReliefCut, x: number, y: number, r: number) => {
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * r * 0.55;
    const py = y + Math.sin(a) * r * 0.55;
    form(ellipse(px, py, r * 0.5, r * 0.36, a), 168, 128, px, py, r * 0.55);
  }
  form(ellipse(x, y, r * 0.3, r * 0.3), 218, 170, x, y, r * 0.32);
  cut((c) => c.arc(x, y, r * 0.3, 0, Math.PI * 2), 2, 0.25);
};

const background = (ctx: CanvasRenderingContext2D, w: number, h: number, frame: ReliefFrame) => {
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
const weather = (ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) => {
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

// -------------------------------------------------------------------------
// Medieval Chancel Window Jamb Carvings (Window 7 — North-West Chancel Lancet next to Rood Screen)
// Close-up photographs (2026) & Taunt & Co. postcards 3017 / 3018:
//  - West jamb: The Crucifixion. Nimbed God the Father with raised hands at the top, carved
//    rosettes either side, the Dove with fanned wings, Christ on the cross-beam, St Mary (left)
//    and St John (right), a plain roll-moulded left border and a zig-zag (chevron) border right.
//  - East jamb + corner return: St Christopher. Huge bearded head in a rolled cap, the Christ
//    Child on his shoulder, hand gripping the staff, clasped hands & robe, wading through rippled
//    water; on the return a round arch over the hermitage and the small hooded Hermit below.
// Height fields (1px = 1mm, 0 = deepest recess, 255 = front of the frame); architecture.ts
// displaces a finely subdivided plane with them so the worn relief is real geometry that catches light.
// -------------------------------------------------------------------------
export function createChancelReliefHeightMaps(): ChancelReliefHeightMaps {
  // ---- 1. THE CRUCIFIXION (west splayed jamb, 280 x 420 mm) ----
  const cw = 280;
  const ch = 420;
  const crux = makeCanvas(cw, ch);
  {
    const ctx = canvas2d(crux);
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
    const ctx = canvas2d(chris);
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
export function createCarvedAngelHeightMap(): HTMLCanvasElement {
  const aw = 800;
  const ah = 420;
  const canvas = makeCanvas(aw, ah);
  const ctx = canvas2d(canvas);
  ctx.fillStyle = grey(0);
  ctx.fillRect(0, 0, aw, ah);
  const form = makeForm(ctx);
  const cut = makeCut(ctx);
  const cx = aw / 2;
  const rand = mulberry32(1880);

  // Outspread wings: broad, overlapping primaries fanning down and outwards beneath a thick covert mass
  // that sweeps up to an upturned outer tip
  [-1, 1].forEach((s) => {
    const armAt = (t: number): number[] => [cx + s * (70 + t * 300), 182 - t * 120 - Math.sin(t * Math.PI) * 26];
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
    const top: number[][] = [];
    const bot: number[][] = [];
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
    const pts: number[][] = [];
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

/**
 * Pierced oak lectern front panel height map: four corner quatrefoil roundels framing a central cross crosslet inside
 * a laurel wreath tied at the bottom with a ribbon bow. Black is cut right through; brighter is higher.
 */
export function createLecternPanelHeightMap(w: number, h: number, pxPerMm = 1): HTMLCanvasElement {
  const c = makeCanvas(w * pxPerMm, h * pxPerMm);
  const ctx = canvas2d(c);
  ctx.scale(pxPerMm, pxPerMm);
  const tone = (v: number) => {
    const g = Math.round(Math.max(0, Math.min(1, v)) * 255);
    return `rgb(${g},${g},${g})`;
  };
  const circle = (x: number, y: number, r: number, v: number) => {
    ctx.fillStyle = tone(v);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  // Flat board field
  ctx.fillStyle = tone(0.55);
  ctx.fillRect(0, 0, w, h);
  // Moulded border just inside the edge
  ctx.strokeStyle = tone(0.42);
  ctx.lineWidth = 2;
  ctx.strokeRect(9, 9, w - 18, h - 18);

  // Pierced quatrefoil with its lobes on the diagonals, as a path for filling or stroking
  const quatrefoilPath = (cx: number, cy: number, lobeR: number, lobeD: number, coreR: number) => {
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      ctx.moveTo(cx + Math.cos(a) * lobeD + lobeR, cy + Math.sin(a) * lobeD);
      ctx.arc(cx + Math.cos(a) * lobeD, cy + Math.sin(a) * lobeD, lobeR, 0, Math.PI * 2);
    }
    ctx.moveTo(cx + coreR, cy);
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
  };
  const r = 50;
  const corners = [
    [95, 72],
    [w - 95, 72],
    [95, h - 72],
    [w - 95, h - 72]
  ];
  corners.forEach(([cx, cy]) => {
    // Incised outer ring, then a sunk roundel field
    circle(cx, cy, r + 2, 0.36);
    circle(cx, cy, r - 1, 0.58);
    circle(cx, cy, r - 6, 0.4);
    // Raised moulding following the quatrefoil, with pointed cusps where the lobes meet
    quatrefoilPath(cx, cy, 21, 20, 14);
    ctx.fillStyle = tone(0.82);
    ctx.fill();
    quatrefoilPath(cx, cy, 15.5, 20, 9);
    ctx.fillStyle = tone(0);
    ctx.fill();
  });

  // Centre: laurel wreath, stud ring and pierced roundel with a cross crosslet
  const cx = w * 0.5;
  const cy = 128;
  circle(cx, cy, 70, 0.4);
  const leaves = 26;
  for (let i = 0; i < leaves; i++) {
    // Leaves run up both sides from the ribbon at the bottom to meet at the top
    const side = i < leaves / 2 ? -1 : 1;
    const t = (i % (leaves / 2)) / (leaves / 2);
    const a = Math.PI / 2 + side * (0.25 + t * 2.7);
    for (const ring of [56, 63]) {
      const lx = cx + Math.cos(a) * ring;
      const ly = cy + Math.sin(a) * ring;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(a + side * (Math.PI / 2 + 0.5));
      ctx.fillStyle = tone(ring === 56 ? 0.8 : 0.95);
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 4.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = tone(0.64);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(8, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
  // Plain raised band carrying the studs
  circle(cx, cy, 51, 0.7);
  circle(cx, cy, 40, 0.5);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    circle(cx + Math.cos(a) * 45.5, cy + Math.sin(a) * 45.5, 2.6, 1);
  }
  circle(cx, cy, 37, 0);
  // Cross crosslet left standing in the opening
  ctx.fillStyle = tone(0.78);
  const bar = 5;
  const arm = 36;
  ctx.fillRect(cx - bar / 2, cy - arm, bar, arm * 2);
  ctx.fillRect(cx - arm, cy - bar / 2, arm * 2, bar);
  for (let k = 0; k < 4; k++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((k * Math.PI) / 2);
    ctx.fillRect(-8, -arm + 7, 16, bar - 1);
    ctx.restore();
  }
  // Ribbon bow tying the wreath at the bottom, its two tails flaring out below
  circle(cx, cy + 66, 6, 0.9);
  ctx.strokeStyle = tone(0.84);
  ctx.lineCap = 'round';
  [-1, 1].forEach((side) => {
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(cx + side * 3, cy + 70);
    ctx.bezierCurveTo(cx + side * 10, cy + 88, cx + side * 20, cy + 98, cx + side * 40, cy + 104);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + side * 2, cy + 64);
    ctx.quadraticCurveTo(cx + side * 16, cy + 58, cx + side * 12, cy + 70);
    ctx.stroke();
  });
  return c;
}
