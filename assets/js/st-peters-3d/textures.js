import * as THREE from 'three';
import {
  createAttenboroughPlaqueMaps,
  createJaquesDonorsTexture,
  createRollOfHonourMaps
} from '/assets/js/st-peters-3d/plaques.js';
import {
  createEastStainedGlassTexture,
  createJaquesStainedGlassTexture,
  createSowerStainedGlassTexture,
  createWilsonStainedGlassTexture
} from '/assets/js/st-peters-3d/stained-glass.js';

// Deterministic seeded PRNG so textures look identical and crisp every reload
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

function finishTexture(canvas, { repeatX = 1, repeatY = 1, srgb = true, maxAniso = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAniso;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// 1. Buckinghamshire Coursed Limestone Rubble Wall (diffuse + bump)
function createStoneWallMaps(maxAniso) {
  const w = 512;
  const h = 512;
  const col = makeCanvas(w, h);
  const bmp = makeCanvas(w, h);
  const ctx = col.getContext('2d');
  const bctx = bmp.getContext('2d');
  const rand = mulberry32(1402);

  // Lime mortar base
  ctx.fillStyle = '#c5beae';
  ctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#4a4a4a';
  bctx.fillRect(0, 0, w, h);

  // Irregular coursed rubble stones (pale warm cream/grey limestone)
  const rows = 24;
  const rowH = h / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rand() * 24;
    const y = r * rowH;
    while (x < w + 24) {
      const sw = 26 + rand() * 52;
      const sh = rowH * (0.72 + rand() * 0.24);
      const sy = y + (rowH - sh) * 0.5 + (rand() - 0.5) * 1.5;

      // Subtle stone color variation: pale chalky limestone, warm buff, cool grey, occasional flint
      const tone = rand();
      let cr, cg, cb;
      if (tone < 0.55) {
        // Pale Buckinghamshire limestone
        const v = 186 + rand() * 34;
        cr = v + 6;
        cg = v + 2;
        cb = v - 10;
      } else if (tone < 0.82) {
        // Warm ochre-buff stone
        const v = 175 + rand() * 32;
        cr = v + 14;
        cg = v + 5;
        cb = v - 16;
      } else if (tone < 0.95) {
        // Cool grey weathered stone
        const v = 152 + rand() * 30;
        cr = v;
        cg = v + 2;
        cb = v + 3;
      } else {
        // Dark ironstone / flint nodule
        const v = 102 + rand() * 28;
        cr = v + 4;
        cg = v;
        cb = v - 6;
      }

      const drawPoly = (targetCtx, fillStyle) => {
        targetCtx.fillStyle = fillStyle;
        targetCtx.beginPath();
        const pad = 1.6;
        const x0 = x + pad;
        const y0 = sy + pad;
        const x1 = x + sw - pad;
        const y1 = sy + sh - pad;
        targetCtx.moveTo(x0 + rand() * 3, y0 + rand() * 2);
        targetCtx.lineTo(x1 - rand() * 3, y0 + rand() * 2);
        targetCtx.lineTo(x1 - rand() * 2, y1 - rand() * 2);
        targetCtx.lineTo(x0 + rand() * 2, y1 - rand() * 2);
        targetCtx.closePath();
        targetCtx.fill();
      };

      drawPoly(ctx, `rgb(${cr | 0},${cg | 0},${cb | 0})`);
      const bv = (145 + rand() * 85) | 0;
      drawPoly(bctx, `rgb(${bv},${bv},${bv})`);

      // Surface grain / lichen speckles
      for (let s = 0; s < 5; s++) {
        const sx = x + 4 + rand() * Math.max(4, sw - 8);
        const ssy = sy + 3 + rand() * Math.max(3, sh - 6);
        const rad = 1 + rand() * 3;
        ctx.fillStyle = rand() > 0.3 ? 'rgba(240,236,225,0.22)' : 'rgba(95,102,82,0.16)';
        ctx.beginPath();
        ctx.arc(sx, ssy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      x += sw;
    }
  }

  // Subtle limewash mottling across the wall (very characteristic of St Peter's Ilmer)
  for (let i = 0; i < 45; i++) {
    const gx = rand() * w;
    const gy = rand() * h;
    const gr = 24 + rand() * 68;
    const grad = ctx.createRadialGradient(gx, gy, 2, gx, gy, gr);
    const bright = rand() > 0.4;
    grad.addColorStop(0, bright ? 'rgba(232,228,218,0.18)' : 'rgba(128,125,108,0.13)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  }

  return {
    map: finishTexture(col, { srgb: true, maxAniso }),
    bumpMap: finishTexture(bmp, { srgb: false, maxAniso })
  };
}

// 1b. West Gable Masonry Contrast (west-gable.jpg): slightly cooler weathered medieval rubble below former half-hip
//     vs subtly lighter, warmer, more neatly coursed sandy-buff 1909 limestone infill above
function createWestGableLowerMaps(maxAniso) {
  const w = 512;
  const h = 512;
  const col = makeCanvas(w, h);
  const bmp = makeCanvas(w, h);
  const ctx = col.getContext('2d');
  const bctx = bmp.getContext('2d');
  const rand = mulberry32(19091);

  // Weathered lime mortar harmonized with the main church walls
  ctx.fillStyle = '#b4aea0';
  ctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#484848';
  bctx.fillRect(0, 0, w, h);

  // Uncoursed medieval rubblestone in natural weathered grey-buff tones (IMG_3934 & west-gable.jpg)
  const rows = 26;
  const rowH = h / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rand() * 28;
    const y = r * rowH;
    while (x < w + 28) {
      const sw = 24 + rand() * 52;
      const sh = rowH * (0.7 + rand() * 0.26);
      const sy = y + (rowH - sh) * 0.5 + (rand() - 0.5) * 2.0;
      const tone = rand();
      let cr, cg, cb;
      if (tone < 0.54) {
        // Weathered cool pale-grey limestone
        const v = 160 + rand() * 34;
        cr = v + 1;
        cg = v + 2;
        cb = v - 6;
      } else if (tone < 0.86) {
        // Aged warm grey-buff stone
        const v = 166 + rand() * 30;
        cr = v + 6;
        cg = v + 3;
        cb = v - 10;
      } else {
        // Occasional darker weathered rubble stone
        const v = 132 + rand() * 26;
        cr = v + 2;
        cg = v + 2;
        cb = v - 5;
      }

      const drawPoly = (targetCtx, fillStyle) => {
        targetCtx.fillStyle = fillStyle;
        targetCtx.beginPath();
        const pad = 1.6;
        targetCtx.moveTo(x + pad + rand() * 3.5, sy + pad + rand() * 2);
        targetCtx.lineTo(x + sw - pad - rand() * 3.5, sy + pad + rand() * 2);
        targetCtx.lineTo(x + sw - pad - rand() * 2.5, sy + sh - pad - rand() * 2);
        targetCtx.lineTo(x + pad + rand() * 2.5, sy + sh - pad - rand() * 2);
        targetCtx.closePath();
        targetCtx.fill();
      };

      drawPoly(ctx, `rgb(${cr | 0},${cg | 0},${cb | 0})`);
      const bv = (140 + rand() * 88) | 0;
      drawPoly(bctx, `rgb(${bv},${bv},${bv})`);
      x += sw;
    }
  }

  // Subtle pale grey-white lichen flecks across the older lower masonry (west-gable.jpg)
  for (let i = 0; i < 65; i++) {
    const lx = rand() * w;
    const ly = rand() * h;
    const lr = 2 + rand() * 6.5;
    ctx.fillStyle = rand() > 0.3 ? 'rgba(226,226,216,0.28)' : 'rgba(138,144,118,0.2)';
    ctx.beginPath();
    ctx.ellipse(lx, ly, lr, lr * (0.65 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft natural limewash mottling matching the rest of the church exterior
  for (let i = 0; i < 36; i++) {
    const gx = rand() * w;
    const gy = rand() * h;
    const gr = 24 + rand() * 60;
    const grad = ctx.createRadialGradient(gx, gy, 2, gx, gy, gr);
    const bright = rand() > 0.45;
    grad.addColorStop(0, bright ? 'rgba(226,222,212,0.14)' : 'rgba(126,124,112,0.12)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  }

  return {
    map: finishTexture(col, { srgb: true, maxAniso }),
    bumpMap: finishTexture(bmp, { srgb: false, maxAniso })
  };
}

function createWestGableUpperMaps(maxAniso) {
  const w = 512;
  const h = 512;
  const col = makeCanvas(w, h);
  const bmp = makeCanvas(w, h);
  const ctx = col.getContext('2d');
  const bctx = bmp.getContext('2d');
  const rand = mulberry32(19092);

  // Soft warm cream-buff lime mortar base
  ctx.fillStyle = '#c8bfa8';
  ctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#585858';
  bctx.fillRect(0, 0, w, h);

  // Neatly coursed, subtly warmer sandy-buff 1909 gable infill stonework (west-gable.jpg)
  const rows = 28;
  const rowH = h / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rand() * 18;
    const y = r * rowH;
    while (x < w + 18) {
      const sw = 28 + rand() * 44;
      const sh = rowH * (0.8 + rand() * 0.14);
      const sy = y + (rowH - sh) * 0.5 + (rand() - 0.5) * 0.8;
      const tone = rand();
      let cr, cg, cb;
      if (tone < 0.62) {
        // Warm sandy-buff limestone (only gently warmer/lighter than lower medieval rubble)
        const v = 184 + rand() * 22;
        cr = v + 9;
        cg = v + 3;
        cb = v - 18;
      } else if (tone < 0.88) {
        // Soft weathered buff-ochre limestone
        const v = 176 + rand() * 22;
        cr = v + 11;
        cg = v + 4;
        cb = v - 19;
      } else {
        // Muted warm grey-buff block
        const v = 166 + rand() * 20;
        cr = v + 4;
        cg = v + 2;
        cb = v - 11;
      }

      const drawBlock = (targetCtx, fillStyle) => {
        targetCtx.fillStyle = fillStyle;
        targetCtx.beginPath();
        const pad = 1.25;
        targetCtx.moveTo(x + pad + rand() * 1.5, sy + pad + rand() * 1);
        targetCtx.lineTo(x + sw - pad - rand() * 1.5, sy + pad + rand() * 1);
        targetCtx.lineTo(x + sw - pad - rand() * 1.2, sy + sh - pad - rand() * 1);
        targetCtx.lineTo(x + pad + rand() * 1.2, sy + sh - pad - rand() * 1);
        targetCtx.closePath();
        targetCtx.fill();
      };

      drawBlock(ctx, `rgb(${cr | 0},${cg | 0},${cb | 0})`);
      const bv = (160 + rand() * 62) | 0;
      drawBlock(bctx, `rgb(${bv},${bv},${bv})`);

      // Fine sandy limestone texture speckles
      for (let s = 0; s < 3; s++) {
        ctx.fillStyle = rand() > 0.45 ? 'rgba(240,234,218,0.18)' : 'rgba(132,122,98,0.14)';
        ctx.fillRect(x + 3 + rand() * Math.max(4, sw - 6), sy + 2 + rand() * Math.max(3, sh - 4), 2, 2);
      }
      x += sw;
    }
  }

  // Light century-old weathering mottling so the 1909 infill reads organically aged
  for (let i = 0; i < 28; i++) {
    const gx = rand() * w;
    const gy = rand() * h;
    const gr = 20 + rand() * 54;
    const grad = ctx.createRadialGradient(gx, gy, 2, gx, gy, gr);
    grad.addColorStop(0, rand() > 0.5 ? 'rgba(140,136,118,0.12)' : 'rgba(232,226,208,0.1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  }

  return {
    map: finishTexture(col, { srgb: true, maxAniso }),
    bumpMap: finishTexture(bmp, { srgb: false, maxAniso })
  };
}

// 2. Ashlar Dressed Limestone (quoins, buttresses, window surrounds, reredos, font)
function createAshlarMaps(maxAniso) {
  const w = 256;
  const h = 256;
  const col = makeCanvas(w, h);
  const bmp = makeCanvas(w, h);
  const ctx = col.getContext('2d');
  const bctx = bmp.getContext('2d');
  const rand = mulberry32(991);

  ctx.fillStyle = '#d3c8b2';
  ctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#909090';
  bctx.fillRect(0, 0, w, h);

  const rows = 6;
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * 42;
    for (let c = -1; c < 4; c++) {
      const x = c * 86 + offset;
      const y = r * rh;
      const v = 198 + (rand() - 0.5) * 24;
      ctx.fillStyle = `rgb(${(v + 12) | 0},${(v + 4) | 0},${(v - 14) | 0})`;
      ctx.fillRect(x + 1.5, y + 1.5, 83, rh - 3);
      const bv = (165 + rand() * 45) | 0;
      bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bctx.fillRect(x + 2, y + 2, 82, rh - 4);
    }
  }
  // Subtle weathering speckles
  for (let i = 0; i < 600; i++) {
    const px = rand() * w;
    const py = rand() * h;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,250,240,0.12)' : 'rgba(105,102,88,0.12)';
    ctx.fillRect(px, py, 2 + rand() * 3, 2 + rand() * 3);
  }

  return {
    map: finishTexture(col, { srgb: true, maxAniso }),
    bumpMap: finishTexture(bmp, { srgb: false, maxAniso })
  };
}

// 3. Weathered English Plain Clay Roof Tiles with mossy patches
function createClayRoofMaps(maxAniso) {
  const w = 512;
  const h = 512;
  const col = makeCanvas(w, h);
  const bmp = makeCanvas(w, h);
  const ctx = col.getContext('2d');
  const bctx = bmp.getContext('2d');
  const rand = mulberry32(3141);

  ctx.fillStyle = '#4a2b20';
  ctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#303030';
  bctx.fillRect(0, 0, w, h);

  const rows = 28;
  const cols = 18;
  const rh = h / rows;
  const cw = w / cols;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (cw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * cw + offset;
      const y = r * rh;
      // Rich mix of terracotta orange-red, aged russet brown, dark burnt clay, subtle moss
      const t = rand();
      let cr, cg, cb;
      if (t < 0.45) {
        cr = 128 + rand() * 34;
        cg = 64 + rand() * 20;
        cb = 44 + rand() * 14;
      } else if (t < 0.8) {
        cr = 92 + rand() * 28;
        cg = 48 + rand() * 18;
        cb = 36 + rand() * 14;
      } else if (t < 0.92) {
        // Dark weathered/sooty tile
        cr = 62 + rand() * 20;
        cg = 42 + rand() * 16;
        cb = 35 + rand() * 12;
      } else {
        // Mossy greenish-amber tile
        cr = 98 + rand() * 25;
        cg = 94 + rand() * 22;
        cb = 42 + rand() * 14;
      }

      ctx.fillStyle = `rgb(${cr | 0},${cg | 0},${cb | 0})`;
      ctx.fillRect(x + 1, y + 1, cw - 1.8, rh - 1.4);

      // Overlap shadow along bottom edge of each tile
      ctx.fillStyle = 'rgba(20,10,6,0.38)';
      ctx.fillRect(x, y + rh - 2.2, cw, 2.2);

      // Bump gradient (sloped tile face)
      const grad = bctx.createLinearGradient(0, y, 0, y + rh);
      grad.addColorStop(0, '#787878');
      grad.addColorStop(0.85, '#d8d8d8');
      grad.addColorStop(1, '#222222');
      bctx.fillStyle = grad;
      bctx.fillRect(x + 1, y, cw - 1.5, rh);
    }
  }

  // Mossy blotches typical of the lower/west slopes seen in IMG_3932
  for (let i = 0; i < 32; i++) {
    const gx = rand() * w;
    const gy = rand() * h;
    const gr = 18 + rand() * 44;
    const grad = ctx.createRadialGradient(gx, gy, 2, gx, gy, gr);
    grad.addColorStop(0, 'rgba(96,104,48,0.22)');
    grad.addColorStop(1, 'rgba(96,104,48,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  }

  return {
    map: finishTexture(col, { srgb: true, maxAniso }),
    bumpMap: finishTexture(bmp, { srgb: false, maxAniso })
  };
}

// 4. Weathered Horizontal Oak Weatherboarding (Bell-Turret)
function createWeatherboardMaps(maxAniso) {
  const w = 512;
  const h = 512;
  const col = makeCanvas(w, h);
  const bmp = makeCanvas(w, h);
  const ctx = col.getContext('2d');
  const bctx = bmp.getContext('2d');
  const rand = mulberry32(4821);

  const boards = 22;
  const bh = h / boards;

  for (let i = 0; i < boards; i++) {
    const y = i * bh;
    const warm = rand() < 0.28;
    const base = warm ? 128 + rand() * 28 : 138 + rand() * 28;
    const r = warm ? base + 12 : base + 4;
    const g = warm ? base + 2 : base + 2;
    const b = warm ? base - 16 : base - 4;

    const grad = ctx.createLinearGradient(0, y, 0, y + bh);
    grad.addColorStop(0, `rgb(${(r * 0.82) | 0},${(g * 0.82) | 0},${(b * 0.82) | 0})`);
    grad.addColorStop(0.22, `rgb(${r | 0},${g | 0},${b | 0})`);
    grad.addColorStop(0.86, `rgb(${(r * 0.96) | 0},${(g * 0.96) | 0},${(b * 0.96) | 0})`);
    grad.addColorStop(1, 'rgb(42,38,34)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, w, bh);

    // Fine horizontal wood grain streaks
    for (let s = 0; s < 14; s++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,252,245,0.08)' : 'rgba(35,30,25,0.12)';
      ctx.fillRect(0, y + rand() * (bh - 2), w, 1 + rand() * 1.5);
    }

    const bgrad = bctx.createLinearGradient(0, y, 0, y + bh);
    bgrad.addColorStop(0, '#555555');
    bgrad.addColorStop(0.85, '#e8e8e8');
    bgrad.addColorStop(1, '#181818');
    bctx.fillStyle = bgrad;
    bctx.fillRect(0, y, w, bh);
  }

  return {
    map: finishTexture(col, { srgb: true, maxAniso }),
    bumpMap: finishTexture(bmp, { srgb: false, maxAniso })
  };
}

// 5. Weathered Oak Spire Shingles (Silvery grey oak shingles with moss hint)
function createShingleMaps(maxAniso) {
  const w = 512;
  const h = 512;
  const col = makeCanvas(w, h);
  const bmp = makeCanvas(w, h);
  const ctx = col.getContext('2d');
  const bctx = bmp.getContext('2d');
  const rand = mulberry32(7717);

  ctx.fillStyle = '#6c6a63';
  ctx.fillRect(0, 0, w, h);

  const rows = 28;
  const cols = 20;
  const rh = h / rows;
  const cw = w / cols;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (cw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * cw + offset;
      const y = r * rh;
      const v = 118 + rand() * 44;
      const moss = rand() < 0.14 ? 10 : 0;
      ctx.fillStyle = `rgb(${(v - moss * 0.4) | 0},${(v + moss * 0.4) | 0},${(v - 4 - moss * 0.6) | 0})`;
      ctx.fillRect(x + 1, y + 1, cw - 1.5, rh - 1.5);
      ctx.fillStyle = 'rgba(20,20,18,0.42)';
      ctx.fillRect(x, y + rh - 2, cw, 2);

      const bv = (130 + rand() * 80) | 0;
      bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bctx.fillRect(x + 1, y + 1, cw - 1.5, rh - 2);
      bctx.fillStyle = '#202020';
      bctx.fillRect(x, y + rh - 2, cw, 2);
    }
  }

  return {
    map: finishTexture(col, { srgb: true, maxAniso }),
    bumpMap: finishTexture(bmp, { srgb: false, maxAniso })
  };
}

// 6. Diagonal Terracotta & Black Quarry Tiles (Nave & North Porch Floor)
function createQuarryTileMaps(maxAniso) {
  const size = 512;
  const col = makeCanvas(size, size);
  const bmp = makeCanvas(size, size);
  const ctx = col.getContext('2d');
  const bctx = bmp.getContext('2d');
  const rand = mulberry32(5501);

  ctx.fillStyle = '#4a4542';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#383838';
  bctx.fillRect(0, 0, size, size);

  // Rotate 45 deg for seamless diagonal checkerboard tiles
  const n = 4; // 4 diagonals per repeat -> seamless tiling!
  const step = size / n;

  ctx.save();
  bctx.save();

  for (let gx = -n; gx <= n * 2; gx++) {
    for (let gy = -n; gy <= n * 2; gy++) {
      const cx = (gx + gy) * (step * 0.5);
      const cy = (gy - gx) * (step * 0.5);
      if (cx < -step || cx > size + step || cy < -step || cy > size + step) continue;

      const isRed = ((gx + gy) & 1) === 0;
      let cr, cg, cb;
      if (isRed) {
        // Worn Victorian terracotta red / reddish-grey quarry tile
        const pick = rand();
        if (pick < 0.65) {
          cr = 136 + rand() * 26;
          cg = 74 + rand() * 18;
          cb = 62 + rand() * 16;
        } else {
          // Pale dusty buff-grey tile occasionally mixed in (seen in IMG_3935)
          cr = 128 + rand() * 24;
          cg = 114 + rand() * 20;
          cb = 104 + rand() * 18;
        }
      } else {
        // Charcoal slate black quarry tile
        const v = 54 + rand() * 22;
        cr = v + 3;
        cg = v + 2;
        cb = v + 4;
      }

      const drawDiamond = (c, style, inset) => {
        const hs = step * 0.5 - inset;
        c.fillStyle = style;
        c.beginPath();
        c.moveTo(cx, cy - hs);
        c.lineTo(cx + hs, cy);
        c.lineTo(cx, cy + hs);
        c.lineTo(cx - hs, cy);
        c.closePath();
        c.fill();
      };

      drawDiamond(ctx, `rgb(${cr | 0},${cg | 0},${cb | 0})`, 2.5);
      const bv = (195 + rand() * 35) | 0;
      drawDiamond(bctx, `rgb(${bv},${bv},${bv})`, 2.5);

      // Subtle worn dust sheen
      if (rand() > 0.4) {
        drawDiamond(ctx, 'rgba(220,210,198,0.08)', 8);
      }
    }
  }
  ctx.restore();
  bctx.restore();

  return {
    map: finishTexture(col, { srgb: true, maxAniso }),
    bumpMap: finishTexture(bmp, { srgb: false, maxAniso })
  };
}

// 7. Ornate Victorian Sanctuary Encaustic Tiles (seen in IMG_3938)
function createSanctuaryTileMap(maxAniso) {
  const s = 512;
  const col = makeCanvas(s, s);
  const ctx = col.getContext('2d');
  ctx.fillStyle = '#524943';
  ctx.fillRect(0, 0, s, s);

  const cells = 4;
  const cs = s / cells;
  for (let x = 0; x < cells; x++) {
    for (let y = 0; y < cells; y++) {
      const px = x * cs;
      const py = y * cs;
      const alt = (x + y) % 2 === 0;
      ctx.fillStyle = alt ? '#8c3d32' : '#2d2b2e';
      ctx.fillRect(px + 2, py + 2, cs - 4, cs - 4);

      // Geometric cream & gold Victorian diamond/rosette inlay
      const cx = px + cs * 0.5;
      const cy = py + cs * 0.5;
      ctx.fillStyle = alt ? '#d6be96' : '#8c3d32';
      ctx.beginPath();
      ctx.moveTo(cx, py + 12);
      ctx.lineTo(px + cs - 12, cy);
      ctx.lineTo(cx, py + cs - 12);
      ctx.lineTo(px + 12, cy);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = alt ? '#2e2b2e' : '#e0c89d';
      ctx.beginPath();
      ctx.arc(cx, cy, cs * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return finishTexture(col, { srgb: true, maxAniso });
}

// 8. Warm Blush-Cream Lime Plaster (Interior Walls, matching IMG_3936-3950)
function createPlasterMaps(maxAniso) {
  const s = 512;
  const col = makeCanvas(s, s);
  const bmp = makeCanvas(s, s);
  const ctx = col.getContext('2d');
  const bctx = bmp.getContext('2d');
  const rand = mulberry32(2203);

  ctx.fillStyle = '#efe0d6';
  ctx.fillRect(0, 0, s, s);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, s, s);

  for (let i = 0; i < 160; i++) {
    const x = rand() * s;
    const y = rand() * s;
    const r = 18 + rand() * 75;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, rand() > 0.5 ? 'rgba(255,248,242,0.14)' : 'rgba(204,182,168,0.10)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);

    const bgrad = bctx.createRadialGradient(x, y, 2, x, y, r * 0.6);
    bgrad.addColorStop(0, rand() > 0.5 ? 'rgba(175,175,175,0.22)' : 'rgba(90,90,90,0.22)');
    bgrad.addColorStop(1, 'rgba(128,128,128,0)');
    bctx.fillStyle = bgrad;
    bctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  return {
    map: finishTexture(col, { srgb: true, maxAniso }),
    bumpMap: finishTexture(bmp, { srgb: false, maxAniso })
  };
}

// 9. Aged Oak Timber Grain (variant: 'dark' for belfry/screen/ribs, 'warm' for pews/pulpit)
function createOakMaps(variant, maxAniso) {
  const w = 512;
  const h = 512;
  const col = makeCanvas(w, h);
  const bmp = makeCanvas(w, h);
  const ctx = col.getContext('2d');
  const bctx = bmp.getContext('2d');
  const rand = mulberry32(variant === 'dark' ? 8811 : 6611);

  if (variant === 'dark') {
    ctx.fillStyle = '#2d2018';
  } else if (variant === 'medium') {
    ctx.fillStyle = '#5c3b24';
  } else {
    ctx.fillStyle = '#6e4326';
  }
  ctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, w, h);

  // Longitudinal wood fibers
  for (let i = 0; i < 420; i++) {
    const y = rand() * h;
    const thick = 1 + rand() * 3.5;
    const light = rand() > 0.45;
    if (variant === 'dark') {
      ctx.fillStyle = light ? 'rgba(84,60,44,0.22)' : 'rgba(18,12,8,0.28)';
    } else {
      ctx.fillStyle = light ? 'rgba(154,102,58,0.22)' : 'rgba(58,32,16,0.24)';
    }
    ctx.fillRect(0, y, w, thick);
    bctx.fillStyle = light ? 'rgba(175,175,175,0.22)' : 'rgba(70,70,70,0.25)';
    bctx.fillRect(0, y, w, thick);
  }

  return {
    map: finishTexture(col, { srgb: true, maxAniso }),
    bumpMap: finishTexture(bmp, { srgb: false, maxAniso })
  };
}

// 9b. Diamond Oak Parquetry (Glastonbury sanctuary chair back panel, chancel-chair photo)
// Each lozenge is split into four triangles whose grain runs parallel to alternate edges, with fine dark joints.
function createParquetryMaps(maxAniso) {
  const w = 384;
  const h = 512;
  const col = makeCanvas(w, h);
  const bmp = makeCanvas(w, h);
  const ctx = col.getContext('2d');
  const bctx = bmp.getContext('2d');
  const rand = mulberry32(4417);

  const cols = 3.5; // lozenges across the panel
  const dw = w / cols;
  const dh = dw; // square-on-point lozenges
  const tones = ['#5a3a22', '#4a2e1a', '#674328', '#3f2716'];

  ctx.fillStyle = '#4a301c';
  ctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, w, h);

  const drawTri = (pts, tone, grainAng) => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[1][0], pts[1][1]);
    ctx.lineTo(pts[2][0], pts[2][1]);
    ctx.closePath();
    ctx.fillStyle = tone;
    ctx.fill();
    ctx.clip();
    // Grain streaks parallel to one lozenge edge
    const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3;
    const cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
    ctx.translate(cx, cy);
    ctx.rotate(grainAng);
    for (let i = 0; i < 22; i++) {
      const y = -dw * 0.6 + rand() * dw * 1.2;
      ctx.fillStyle = rand() > 0.5 ? 'rgba(140,96,56,0.22)' : 'rgba(20,12,6,0.25)';
      ctx.fillRect(-dw, y, dw * 2, 0.6 + rand() * 1.6);
    }
    ctx.restore();
  };

  const edgeAng = Math.atan2(dh * 0.5, dw * 0.5);
  for (let r = -1; r <= Math.ceil(h / dh) + 1; r++) {
    for (let c = -1; c <= Math.ceil(cols) + 1; c++) {
      // Staggered lozenge grid: centres on a half-offset lattice
      for (const off of [0, 0.5]) {
        const cx = (c + off) * dw + dw * 0.25;
        const cy = (r + off) * dh;
        const top = [cx, cy - dh * 0.5];
        const right = [cx + dw * 0.5, cy];
        const bot = [cx, cy + dh * 0.5];
        const left = [cx - dw * 0.5, cy];
        const mid = [cx, cy];
        const t0 = Math.floor(rand() * tones.length);
        drawTri([mid, top, right], tones[t0], -edgeAng);
        drawTri([mid, right, bot], tones[(t0 + 1) % 4], edgeAng);
        drawTri([mid, bot, left], tones[(t0 + 2) % 4], -edgeAng);
        drawTri([mid, left, top], tones[(t0 + 3) % 4], edgeAng);

        // Inlay joints (colour + bump grooves)
        for (const [g, style, lw] of [
          [ctx, 'rgba(22,13,7,0.85)', 1.6],
          [bctx, 'rgba(40,40,40,0.9)', 2.2]
        ]) {
          g.strokeStyle = style;
          g.lineWidth = lw;
          g.beginPath();
          g.moveTo(top[0], top[1]);
          g.lineTo(right[0], right[1]);
          g.lineTo(bot[0], bot[1]);
          g.lineTo(left[0], left[1]);
          g.closePath();
          g.moveTo(top[0], top[1]);
          g.lineTo(bot[0], bot[1]);
          g.moveTo(left[0], left[1]);
          g.lineTo(right[0], right[1]);
          g.stroke();
        }
      }
    }
  }

  return {
    map: finishTexture(col, { srgb: true, maxAniso }),
    bumpMap: finishTexture(bmp, { srgb: false, maxAniso })
  };
}

// 10. Stained Glass & Diamond Leaded Glass Textures
function createWindowGlassTexture(kind, maxAniso) {
  const w = 256;
  const h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rand = mulberry32(kind.length * 1013);

  if (kind === 'clear-diamond') {
    // Translucent bright sky-tinted glass with crisp lead cames (diamond quarries)
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#eef7ff');
    bg.addColorStop(0.6, '#ddecf6');
    bg.addColorStop(1, '#c8dce8');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Subtle antique glass mottling
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.16)' : 'rgba(155,180,195,0.12)';
      ctx.beginPath();
      ctx.arc(rand() * w, rand() * h, 10 + rand() * 25, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crisp diamond lead lines
    ctx.strokeStyle = '#2c2f33';
    ctx.lineWidth = 3.2;
    const step = 36;
    for (let x = -h; x < w + h; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h * 0.65, h);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + h * 0.65, 0);
      ctx.stroke();
    }
    // Horizontal saddle bars
    ctx.strokeStyle = '#222428';
    ctx.lineWidth = 4;
    for (let y = 80; y < h; y += 96) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  } else {
    // Rich Victorian Stained Glass ('east-stained', 'sower-stained', 'north-square-stained')
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#dff0ff');
    bg.addColorStop(0.35, '#8ec3f0');
    bg.addColorStop(1, '#d8e8f2');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Diamond quarry borders top & bottom
    ctx.strokeStyle = 'rgba(40,45,55,0.45)';
    ctx.lineWidth = 2;
    for (let x = -h; x < w + h; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h * 0.6, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + h * 0.6, 0);
      ctx.stroke();
    }

    const drawFigureLight = (cx, palette) => {
      // Gothic canopy arch
      ctx.fillStyle = palette.canopy;
      ctx.beginPath();
      ctx.arc(cx, 150, 48, Math.PI, 0);
      ctx.lineTo(cx + 48, 360);
      ctx.lineTo(cx - 48, 360);
      ctx.closePath();
      ctx.fill();

      // Robed biblical figure
      ctx.fillStyle = palette.robe1;
      ctx.beginPath();
      ctx.moveTo(cx - 32, 355);
      ctx.quadraticCurveTo(cx - 28, 235, cx, 215);
      ctx.quadraticCurveTo(cx + 28, 235, cx + 32, 355);
      ctx.closePath();
      ctx.fill();

      // Cloak/sash
      ctx.fillStyle = palette.robe2;
      ctx.beginPath();
      ctx.moveTo(cx - 12, 230);
      ctx.lineTo(cx + 28, 270);
      ctx.lineTo(cx + 18, 352);
      ctx.lineTo(cx - 20, 320);
      ctx.closePath();
      ctx.fill();

      // Halo + head
      ctx.fillStyle = '#ffd65c';
      ctx.beginPath();
      ctx.arc(cx, 192, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f5d4b8';
      ctx.beginPath();
      ctx.arc(cx, 194, 12, 0, Math.PI * 2);
      ctx.fill();

      // Foliage / golden wheat / ground details
      ctx.fillStyle = palette.accent;
      ctx.fillRect(cx - 42, 355, 84, 34);
    };

    if (kind === 'east-stained') {
      drawFigureLight(w * 0.27, { canopy: '#3b78d4', robe1: '#cc2929', robe2: '#f2c14e', accent: '#3d9956' });
      drawFigureLight(w * 0.73, { canopy: '#2d6ac7', robe1: '#2e5ec4', robe2: '#d93232', accent: '#4ba363' });
      // Top quatrefoil jewel in crimson & sapphire
      ctx.fillStyle = '#cf2a35';
      ctx.beginPath();
      ctx.arc(w * 0.5, 58, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd966';
      ctx.beginPath();
      ctx.arc(w * 0.5, 58, 12, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'sower-stained') {
      // Vivid golden-green-crimson Parable of the Sower window
      drawFigureLight(w * 0.27, { canopy: '#e3a82b', robe1: '#2e8c4d', robe2: '#d93b2b', accent: '#e0b33a' });
      drawFigureLight(w * 0.73, { canopy: '#3b9c5c', robe1: '#d92e2e', robe2: '#3268d6', accent: '#c9932c' });
    } else {
      // North square-headed 2-light stained glass (IMG_3949)
      drawFigureLight(w * 0.27, { canopy: '#2a7bc9', robe1: '#d4313e', robe2: '#399e5a', accent: '#356ac4' });
      drawFigureLight(w * 0.73, { canopy: '#2a7bc9', robe1: '#cc2929', robe2: '#f0be3c', accent: '#2f8c4e' });
    }

    // Crisp dark lead came grid over the stained glass
    ctx.strokeStyle = '#1b1d22';
    ctx.lineWidth = 3.5;
    for (let y = 40; y < h; y += 52) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, 0);
    ctx.lineTo(w * 0.5, h);
    ctx.stroke();
  }

  return finishTexture(c, { repeatX: 1, repeatY: 1, srgb: true, maxAniso });
}

// 11. Emerald Green Altar Frontal with Gold Orphreys & Embroidered Cross (IMG_3938)
function createAltarFrontalTexture(maxAniso) {
  const w = 512;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');

  // Rich emerald damask green
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#2e6f2c');
  grad.addColorStop(0.5, '#3b8236');
  grad.addColorStop(1, '#255c24');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle fabric fold shading
  for (let x = 0; x < w; x += 28) {
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(x, 0, 12, h);
  }

  // Vertical gold orphrey bands
  ctx.fillStyle = '#c9a63a';
  [54, 152, 344, 442].forEach((bx) => {
    ctx.fillRect(bx, 0, 14, h);
    ctx.fillStyle = '#e8cf6b';
    ctx.fillRect(bx + 4, 0, 6, h);
    ctx.fillStyle = '#c9a63a';
  });

  // Bottom gold fringe
  ctx.fillStyle = '#d4b347';
  ctx.fillRect(0, h - 18, w, 18);
  ctx.fillStyle = '#7a621c';
  for (let x = 0; x < w; x += 8) {
    ctx.fillRect(x, h - 16, 2, 16);
  }

  // Central gold embroidered Latin cross
  const cx = w * 0.5;
  ctx.fillStyle = '#ebd06a';
  ctx.fillRect(cx - 10, 42, 20, 145);
  ctx.fillRect(cx - 46, 80, 92, 20);
  ctx.strokeStyle = '#9e7d22';
  ctx.lineWidth = 3;
  ctx.strokeRect(cx - 10, 42, 20, 145);

  return finishTexture(c, { srgb: true, maxAniso });
}

// 12. White Lace Fair-Linen Altar Cloth Overlay
function createLaceClothTexture(maxAniso) {
  const w = 256;
  const h = 128;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f8f6f0';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#dcd7cc';
  ctx.lineWidth = 1.5;
  for (let x = 8; x < w; x += 16) {
    for (let y = 8; y < h; y += 16) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  return finishTexture(c, { repeatX: 3, repeatY: 1, srgb: true, maxAniso });
}

// Plain navy woven cloth for the hanging hassocks: one colour with no motif, just a fine twill weave and slight
// fibre mottling so the cushion still reads as fabric (diffuse + bump)
function createKneelerFabricMaps(maxAniso) {
  const [r0, g0, b0] = [44, 58, 96];
  const w = 256;
  const c = makeCanvas(w, w);
  const ctx = c.getContext('2d');
  const b = makeCanvas(w, w);
  const bctx = b.getContext('2d');
  const rng = mulberry32(410);
  const img = ctx.createImageData(w, w);
  const bimg = bctx.createImageData(w, w);
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      // 2/1 twill: diagonal ribs every 3px, with the warp & weft threads alternating across them
      const rib = (x + y) % 3 === 0 ? 0.82 : 1;
      const thread = (x % 2 === 0) !== (y % 2 === 0) ? 1.04 : 0.96;
      const k = rib * thread * (0.92 + rng() * 0.14);
      const i = (y * w + x) * 4;
      img.data[i] = Math.min(255, r0 * k);
      img.data[i + 1] = Math.min(255, g0 * k);
      img.data[i + 2] = Math.min(255, b0 * k);
      img.data[i + 3] = 255;
      const h = Math.min(255, 150 * rib * thread + rng() * 40);
      bimg.data[i] = bimg.data[i + 1] = bimg.data[i + 2] = h;
      bimg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bctx.putImageData(bimg, 0, 0);
  return {
    map: finishTexture(c, { srgb: true, maxAniso }),
    bumpMap: finishTexture(b, { srgb: false, maxAniso })
  };
}

// Churchyard path: grey-brown stable-block pavers with a raised diamond-chequer face, laid in courses running
// along the path with staggered joints; wide soil joints sprouting grass & weeds; the lawn spilling over both edges.
// One tile spans 1.8m of path (u, repeats along it) by its full 1.48m width (v). (diffuse + bump)
function createPathPaverMaps(maxAniso) {
  const pxPerM = 640;
  const W = Math.round(1.8 * pxPerM);
  const H = Math.round(1.48 * pxPerM);
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const b = makeCanvas(W, H);
  const bctx = b.getContext('2d');
  const rng = mulberry32(1866);
  const courses = 7;
  const courseH = H / courses;
  const joint = 9;
  const diamond = 15; // chequer pitch, ~2.3cm

  // Joint soil everywhere first
  ctx.fillStyle = '#3e3529';
  ctx.fillRect(0, 0, W, H);
  bctx.fillStyle = '#000';
  bctx.fillRect(0, 0, W, H);

  const blocks = [];
  for (let k = 0; k < courses; k++) {
    const n = Math.round(1.8 / 0.36);
    const raw = Array.from({ length: n }, () => 0.8 + rng() * 0.4);
    const sum = raw.reduce((a, v) => a + v, 0);
    let x = rng() * W;
    for (const r of raw) {
      const len = (r / sum) * W;
      blocks.push({ x0: x, x1: x + len, y0: k * courseH, y1: (k + 1) * courseH });
      x += len;
    }
  }
  // Draw each block (and its wrapped copy) inset by half a joint
  const drawBlock = (bl, dx) => {
    const x0 = bl.x0 + dx + joint * 0.5 + (rng() - 0.5) * 2;
    const x1 = bl.x1 + dx - joint * 0.5 + (rng() - 0.5) * 2;
    const y0 = bl.y0 + joint * 0.5 + (rng() - 0.5) * 2;
    const y1 = bl.y1 - joint * 0.5 + (rng() - 0.5) * 2;
    if (x1 < 0 || x0 > W) return;
    const tone = 0.88 + bl.tone * 0.24;
    const base = [134 * tone, 126 * tone, 118 * tone];
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    ctx.fillStyle = `rgb(${base[0] * 0.72},${base[1] * 0.72},${base[2] * 0.72})`;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    bctx.save();
    bctx.beginPath();
    bctx.rect(x0, y0, x1 - x0, y1 - y0);
    bctx.clip();
    bctx.fillStyle = '#5a5a5a';
    bctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Raised diamonds: lit upper-left facets, shaded lower-right, grooves between
    const hd = diamond * 0.5 - 1.6;
    for (let gy = y0 - diamond; gy < y1 + diamond; gy += diamond * 0.5) {
      const row = Math.round((gy - y0) / (diamond * 0.5));
      for (let gx = x0 - diamond + (row % 2) * diamond * 0.5; gx < x1 + diamond; gx += diamond) {
        const v = 0.9 + bl.rng() * 0.2;
        ctx.fillStyle = `rgb(${base[0] * 1.12 * v},${base[1] * 1.12 * v},${base[2] * 1.1 * v})`;
        ctx.beginPath();
        ctx.moveTo(gx, gy - hd);
        ctx.lineTo(gx - hd, gy);
        ctx.lineTo(gx, gy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = `rgb(${base[0] * 1.0 * v},${base[1] * 1.0 * v},${base[2] * v})`;
        ctx.beginPath();
        ctx.moveTo(gx, gy - hd);
        ctx.lineTo(gx + hd, gy);
        ctx.lineTo(gx, gy);
        ctx.lineTo(gx - hd, gy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = `rgb(${base[0] * 0.86 * v},${base[1] * 0.86 * v},${base[2] * 0.86 * v})`;
        ctx.beginPath();
        ctx.moveTo(gx - hd, gy);
        ctx.lineTo(gx, gy + hd);
        ctx.lineTo(gx + hd, gy);
        ctx.closePath();
        ctx.fill();
        bctx.fillStyle = '#e8e8e8';
        bctx.beginPath();
        bctx.moveTo(gx, gy - hd);
        bctx.lineTo(gx + hd, gy);
        bctx.lineTo(gx, gy + hd);
        bctx.lineTo(gx - hd, gy);
        bctx.closePath();
        bctx.fill();
      }
    }
    // Worn, darkened arrises & lichen speckle
    const edge = ctx.createLinearGradient(x0, y0, x0, y1);
    edge.addColorStop(0, 'rgba(30,26,22,0.35)');
    edge.addColorStop(0.08, 'rgba(30,26,22,0)');
    edge.addColorStop(0.92, 'rgba(30,26,22,0)');
    edge.addColorStop(1, 'rgba(30,26,22,0.35)');
    ctx.fillStyle = edge;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = bl.rng() > 0.5 ? 'rgba(200,196,170,0.25)' : 'rgba(40,36,30,0.25)';
      ctx.beginPath();
      ctx.arc(x0 + bl.rng() * (x1 - x0), y0 + bl.rng() * (y1 - y0), 1 + bl.rng() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    bctx.restore();
  };
  blocks.forEach((bl, i) => {
    bl.tone = rng();
    const seed = 900 + i;
    for (const dx of [-W, 0, W]) {
      bl.rng = mulberry32(seed);
      drawBlock(bl, dx);
    }
  });

  // Grass & little weeds sprouting from the joints
  const tuft = (x, y, n, len, spread) => {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (rng() - 0.5) * spread;
      const l = len * (0.5 + rng() * 0.7);
      ctx.strokeStyle = ['#6fa83e', '#8cc04c', '#4f8a30', '#a6c860'][Math.floor(rng() * 4)];
      ctx.lineWidth = 1.4 + rng() * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + Math.cos(a) * l * 0.5,
        y + Math.sin(a) * l * 0.4,
        x + Math.cos(a) * l,
        y + Math.sin(a) * l
      );
      ctx.stroke();
      bctx.strokeStyle = 'rgba(160,160,160,0.6)';
      bctx.lineWidth = 1.5;
      bctx.beginPath();
      bctx.moveTo(x, y);
      bctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      bctx.stroke();
    }
  };
  const rosette = (x, y, r) => {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rng();
      ctx.fillStyle = ['#5f9a3a', '#78b048', '#4a8030'][i % 3];
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.6, r * 0.22, a, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  // Long joints between courses
  for (let k = 1; k < courses; k++) {
    const y = k * courseH;
    for (let x = 0; x < W; x += 6 + rng() * 26) tuft(x, y + (rng() - 0.5) * 4, 2 + Math.floor(rng() * 3), 14, 2.4);
  }
  // Cross joints
  for (const bl of blocks) {
    const x = ((bl.x0 % W) + W) % W;
    for (let y = bl.y0 + 6; y < bl.y1 - 6; y += 10 + rng() * 18) tuft(x, y, 2, 12, 2.6);
  }
  for (let i = 0; i < 26; i++) rosette(rng() * W, Math.round(rng() * courses) * courseH, 10 + rng() * 14);

  // Lawn spilling over both edges of the path
  for (const edgeY of [0, H]) {
    const dir = edgeY === 0 ? 1 : -1;
    ctx.fillStyle = '#4f8a30';
    for (let x = -10; x < W + 10; x += 3) {
      const reach = 10 + Math.abs(Math.sin(x * 0.013) * 22) + rng() * 16;
      ctx.fillRect(x, edgeY === 0 ? 0 : H - reach * 0.4, 3, reach * 0.4);
      if (dir < 0) tuft(x, H, 2, reach, 1.2);
      if (dir > 0) {
        // blades lean inward onto the path
        ctx.strokeStyle = '#7ab044';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (rng() - 0.5) * 8, reach);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#7ab044';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, H);
        ctx.lineTo(x + (rng() - 0.5) * 8, H - reach);
        ctx.stroke();
      }
    }
  }

  return {
    map: finishTexture(c, { repeatX: 27.5 / 1.8, repeatY: 1, srgb: true, maxAniso }),
    bumpMap: finishTexture(b, { repeatX: 27.5 / 1.8, repeatY: 1, srgb: false, maxAniso })
  };
}

// 13. English Churchyard Grass
function createGrassTexture(maxAniso) {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const rand = mulberry32(3030);

  ctx.fillStyle = '#4e6c32';
  ctx.fillRect(0, 0, s, s);

  for (let i = 0; i < 4500; i++) {
    const x = rand() * s;
    const y = rand() * s;
    const h = 4 + rand() * 8;
    const t = rand();
    ctx.fillStyle = t < 0.45 ? 'rgba(94,126,54,0.45)' : t < 0.8 ? 'rgba(58,84,34,0.42)' : 'rgba(130,136,68,0.28)';
    ctx.fillRect(x, y, 2, h);
  }
  return finishTexture(c, { repeatX: 16, repeatY: 16, srgb: true, maxAniso });
}

// 14. Rainbow Stained Glass Caustic Decal (seen on the North wall in IMG_3949)
function createCausticTexture() {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, s, s);

  const blobs = [
    [90, 140, 56, 'rgba(255,195,90,0.42)'],
    [168, 136, 56, 'rgba(255,170,80,0.42)'],
    [82, 108, 36, 'rgba(255,105,115,0.34)'],
    [176, 110, 36, 'rgba(110,195,255,0.34)'],
    [92, 165, 34, 'rgba(130,240,145,0.28)'],
    [166, 162, 34, 'rgba(255,230,120,0.35)']
  ];
  blobs.forEach(([x, y, r, color]) => {
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 15. Speckled Grey Granite (for modern churchyard headstones, C9, C11, B1, etc.)
function createGraniteMaps(maxAniso) {
  const s = 256;
  const col = makeCanvas(s, s);
  const ctx = col.getContext('2d');
  const rand = mulberry32(9412);

  ctx.fillStyle = '#8b9094';
  ctx.fillRect(0, 0, s, s);

  for (let i = 0; i < 4200; i++) {
    const x = rand() * s;
    const y = rand() * s;
    const pick = rand();
    ctx.fillStyle =
      pick < 0.35 ? 'rgba(235,238,240,0.48)' : pick < 0.72 ? 'rgba(42,46,50,0.45)' : 'rgba(135,140,145,0.4)';
    ctx.fillRect(x, y, 1.5 + rand() * 2, 1.5 + rand() * 2);
  }
  return finishTexture(col, { repeatX: 1, repeatY: 1, srgb: true, maxAniso });
}

// 16. Small Stone Chippings & Pebbles inside Kerbed Graves (diffuse + bump map)
function createGravePebbleMaps(maxAniso) {
  const s = 512;
  const col = makeCanvas(s, s);
  const bmp = makeCanvas(s, s);
  const ctx = col.getContext('2d');
  const bctx = bmp.getContext('2d');
  const rand = mulberry32(6142);

  // Dark interstitial shadow bed between the stones
  ctx.fillStyle = '#3d3e3b';
  ctx.fillRect(0, 0, s, s);
  bctx.fillStyle = '#202020';
  bctx.fillRect(0, 0, s, s);

  const palettes = [
    [168, 166, 158], // Pale limestone chipping
    [142, 145, 148], // Silver-grey granite chipping
    [186, 180, 166], // Warm Cotswold/Buckinghamshire buff stone
    [118, 122, 126], // Dark flint/slate pebble
    [204, 202, 196] // Pale quartz/marble chip
  ];

  // Draw 1,450 tightly packed small polygonal/rounded stones with wrap-around tiling
  for (let i = 0; i < 1450; i++) {
    const cx = rand() * s;
    const cy = rand() * s;
    const rx = 4.5 + rand() * 7.5;
    const ry = 3.8 + rand() * 6.5;
    const rot = rand() * Math.PI;
    const base = palettes[(rand() * palettes.length) | 0];
    const jitter = (rand() - 0.5) * 24;
    const r = Math.max(50, Math.min(240, (base[0] + jitter) | 0));
    const g = Math.max(50, Math.min(240, (base[1] + jitter) | 0));
    const b = Math.max(50, Math.min(240, (base[2] + jitter) | 0));
    const bumpPeak = (165 + rand() * 85) | 0;

    // Tile across edges if close to border
    for (const ox of [0, -s, s]) {
      if (ox !== 0 && cx + ox < -16 && cx + ox > s + 16) continue;
      for (const oy of [0, -s, s]) {
        const px = cx + ox;
        const py = cy + oy;
        if (px < -18 || px > s + 18 || py < -18 || py > s + 18) continue;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        // Dark crevice outline around each stone
        ctx.beginPath();
        ctx.ellipse(0.8, 1.0, rx + 0.8, ry + 0.8, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(18, 18, 16, 0.72)';
        ctx.fill();

        // Shaded stone body
        const grad = ctx.createRadialGradient(-rx * 0.28, -ry * 0.28, 0.5, 0, 0, Math.max(rx, ry));
        grad.addColorStop(0, `rgb(${Math.min(255, r + 26)},${Math.min(255, g + 26)},${Math.min(255, b + 24)})`);
        grad.addColorStop(0.7, `rgb(${r},${g},${b})`);
        grad.addColorStop(1, `rgb(${Math.max(30, r - 34)},${Math.max(30, g - 34)},${Math.max(30, b - 34)})`);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();

        bctx.save();
        bctx.translate(px, py);
        bctx.rotate(rot);
        const bGrad = bctx.createRadialGradient(-rx * 0.2, -ry * 0.2, 0.5, 0, 0, Math.max(rx, ry));
        bGrad.addColorStop(0, `rgb(${bumpPeak},${bumpPeak},${bumpPeak})`);
        bGrad.addColorStop(0.78, 'rgb(125,125,125)');
        bGrad.addColorStop(1, 'rgb(28,28,28)');
        bctx.beginPath();
        bctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        bctx.fillStyle = bGrad;
        bctx.fill();
        bctx.restore();
      }
    }
  }

  return {
    map: finishTexture(col, { repeatX: 3.2, repeatY: 1.8, srgb: true, maxAniso }),
    bumpMap: finishTexture(bmp, { repeatX: 3.2, repeatY: 1.8, srgb: false, maxAniso })
  };
}

// Create and export the shared Material Palette
// B6: Procedurally carved 1860 limestone dedication tablet on the exterior NE Chancel wall (B6.md)
function createDedicationStone1860Maps(maxAniso = 4) {
  const w = 1024;
  const h = 1200;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const bc = makeCanvas(w, h);
  const bctx = bc.getContext('2d');

  const rand = mulberry32(1860);

  // Warm dressed Buckinghamshire limestone base with subtle top-to-bottom weathering gradient
  const grad = ctx.createLinearGradient(0, 0, w * 0.15, h);
  grad.addColorStop(0, '#c7bc9f');
  grad.addColorStop(0.55, '#beb292');
  grad.addColorStop(1, '#afa282');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  bctx.fillStyle = '#c8c8c8';
  bctx.fillRect(0, 0, w, h);

  // Subtle horizontal sedimentary bedding & chisel dressing marks
  for (let i = 0; i < 420; i++) {
    const y = rand() * h;
    const x = rand() * w;
    const len = 40 + rand() * 190;
    const dark = rand() > 0.5;
    ctx.fillStyle = dark ? 'rgba(98, 88, 66, 0.08)' : 'rgba(238, 231, 210, 0.09)';
    ctx.fillRect(x, y, len, 2 + rand() * 3);
    bctx.fillStyle = dark ? 'rgba(175, 175, 175, 0.2)' : 'rgba(218, 218, 218, 0.2)';
    bctx.fillRect(x, y, len, 2);
  }

  // Fine oolitic limestone grain speckles
  for (let i = 0; i < 9000; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const sz = 1 + rand() * 2.4;
    const light = rand() > 0.52;
    ctx.fillStyle = light ? 'rgba(242, 236, 218, 0.22)' : 'rgba(96, 86, 66, 0.18)';
    ctx.fillRect(x, y, sz, sz);
    bctx.fillStyle = light ? 'rgba(222, 222, 222, 0.25)' : 'rgba(155, 155, 155, 0.25)';
    bctx.fillRect(x, y, sz, sz);
  }

  // Natural pale-grey/white crustose lichen flecks concentrated near the upper-left corner
  for (let i = 0; i < 160; i++) {
    const lx = rand() * w * 0.62;
    const ly = rand() * h * 0.45;
    const weight = 1 - Math.hypot(lx / (w * 0.62), ly / (h * 0.45));
    if (weight <= 0 || rand() > weight * 0.9) continue;
    const r = 4 + rand() * 16;
    ctx.fillStyle = `rgba(218, 220, 212, ${(0.12 + rand() * 0.22).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(lx, ly, r, r * (0.65 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle weathered edge bevel where the ashlar tablet meets the surrounding rubble wall
  ctx.strokeStyle = 'rgba(74, 65, 48, 0.35)';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, w - 10, h - 10);

  // Authentic 11-line Latin inscription (monumental-inscriptions/B6.md)
  const lines = [
    'HANC ECCLESIAM',
    'INTER ANTIQUAS ANTIQUISSIMAM',
    'ANNORUM LONGA SERIE',
    'LABEFACTAM ET INCLINATAM',
    'PROPRIA CURÂ',
    'INSTAURAVIT AC ORNAVIT',
    'GUILIELMUS E. PARTRIDGE A.B.',
    'VICARIUS IDEM ET PATRONUS',
    'ANNO CHRISTI',
    'MDCCCLX',
    'SOLI DEO HONOR ET GLORIA'
  ];

  // Draw classical Roman capital text with gentle tracking so every line fits comfortably inside the margins
  function drawTrackedLine(targetCtx, text, cx, y, maxW, fontSize) {
    targetCtx.font = `500 ${fontSize}px Georgia, "Times New Roman", serif`;
    targetCtx.textAlign = 'left';
    targetCtx.textBaseline = 'middle';
    const baseTracking = fontSize * 0.08;
    const chars = [...text];
    const charWidths = chars.map((ch) => targetCtx.measureText(ch).width);
    const rawTotal = charWidths.reduce((sum, cw) => sum + cw, 0) + baseTracking * Math.max(0, chars.length - 1);
    const scale = rawTotal > maxW ? maxW / rawTotal : 1;
    const scaledSize = fontSize * scale;
    targetCtx.font = `500 ${scaledSize.toFixed(1)}px Georgia, "Times New Roman", serif`;
    const tracking = baseTracking * scale;
    const widths = chars.map((ch) => targetCtx.measureText(ch).width);
    const totalW = widths.reduce((sum, cw) => sum + cw, 0) + tracking * Math.max(0, chars.length - 1);
    let x = cx - totalW * 0.5;
    for (let i = 0; i < chars.length; i++) {
      targetCtx.fillText(chars[i], x, y);
      x += widths[i] + tracking;
    }
  }

  const maxTextW = w - 104;
  const startY = 128;
  const lineStep = (h - 240) / (lines.length - 1);
  const baseFontSize = 48;

  lines.forEach((line, idx) => {
    const y = startY + idx * lineStep;
    const fs = idx === 9 ? 52 : baseFontSize;

    // Lower-right sunlit V-cut bevel catchlight
    ctx.fillStyle = 'rgba(246, 240, 222, 0.56)';
    drawTrackedLine(ctx, line, w * 0.5 + 2.2, y + 2.2, maxTextW, fs);

    // Upper-left shadowed V-cut bevel
    ctx.fillStyle = 'rgba(64, 54, 38, 0.72)';
    drawTrackedLine(ctx, line, w * 0.5 - 1.6, y - 1.6, maxTextW, fs);

    // Deeply incised letter groove
    ctx.fillStyle = 'rgba(84, 72, 52, 0.68)';
    drawTrackedLine(ctx, line, w * 0.5, y, maxTextW, fs);

    // Matching recessed bump map stroke so raking sunlight catches the carved letters
    bctx.fillStyle = '#202020';
    drawTrackedLine(bctx, line, w * 0.5, y, maxTextW, fs);
  });

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAniso;

  const bumpMap = new THREE.CanvasTexture(bc);
  bumpMap.anisotropy = maxAniso;

  return { map, bumpMap };
}

export function createMaterials(renderer) {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const stoneMaps = createStoneWallMaps(maxAniso);
  const westGableLowerMaps = createWestGableLowerMaps(maxAniso);
  const westGableUpperMaps = createWestGableUpperMaps(maxAniso);
  const ashlarMaps = createAshlarMaps(maxAniso);
  const graniteMap = createGraniteMaps(maxAniso);
  const clayRoofMaps = createClayRoofMaps(maxAniso);
  const weatherboardMaps = createWeatherboardMaps(maxAniso);
  const shingleMaps = createShingleMaps(maxAniso);
  const quarryMaps = createQuarryTileMaps(maxAniso);
  const sanctuaryTileMap = createSanctuaryTileMap(maxAniso);
  const plasterMaps = createPlasterMaps(maxAniso);
  const darkOakMaps = createOakMaps('dark', maxAniso);
  const warmOakMaps = createOakMaps('warm', maxAniso);
  const medOakMaps = createOakMaps('medium', maxAniso);
  const parquetryMaps = createParquetryMaps(maxAniso);
  const kneelerMaps = createKneelerFabricMaps(maxAniso);
  const grassMap = createGrassTexture(maxAniso);
  const gravePebbleMaps = createGravePebbleMaps(maxAniso);
  const pathPaverMaps = createPathPaverMaps(maxAniso);

  // Procedurally painted stained glass windows matching St Peter's Church, Ilmer
  // A2: East / Altar stained glass window (Jesus calling Simon Peter & Andrew, 1909)
  const eastStainedGlassTex = createEastStainedGlassTexture(maxAniso);
  // A1: South Nave "Sower" stained glass window (Joseph Nuttgens 1991)
  const sowerStainedGlassTex = createSowerStainedGlassTexture(maxAniso);
  // Window 3: chancel south-west lancet, Richard James Wilson memorial with the RAF badge
  const wilsonStainedGlassTex = createWilsonStainedGlassTexture(maxAniso);
  // A3: North Nave "Jaques / Good Samaritan" stained glass window (J.E. Nuttgens 1933)
  const jaquesStainedGlassTex = createJaquesStainedGlassTexture(maxAniso);

  // Procedurally painted interior wall memorials
  // A4: Framed List of Donors for Mrs Jaques's Memorial Window
  const jaquesDonorsTex = createJaquesDonorsTexture(maxAniso);
  // A7: Carved oak memorial plaque to Robert Harold Attenborough
  const attenboroughMaps = createAttenboroughPlaqueMaps(maxAniso);
  // Roll of Honour: Great War memorial stone tablet
  const rollOfHonourMaps = createRollOfHonourMaps(maxAniso);
  // Medieval clunch/limestone jamb carvings on Chancel North-West window (Crucifixion & St. Christopher)
  // B6: Procedurally carved 1860 Commemoration stone tablet on exterior NE Chancel wall
  const dedication1860Maps = createDedicationStone1860Maps(maxAniso);

  // Set realistic tile repeats for standard meshes (walls use world-space UVs!)
  quarryMaps.map.repeat.set(1, 1);
  quarryMaps.bumpMap.repeat.set(1, 1);

  return {
    stoneWall: new THREE.MeshStandardMaterial({
      map: stoneMaps.map,
      bumpMap: stoneMaps.bumpMap,
      bumpScale: 0.055,
      roughness: 0.92,
      metalness: 0.02
    }),
    stoneWallWestLower: new THREE.MeshStandardMaterial({
      map: westGableLowerMaps.map,
      bumpMap: westGableLowerMaps.bumpMap,
      bumpScale: 0.062,
      roughness: 0.94,
      metalness: 0.02
    }),
    stoneWallWestUpper: new THREE.MeshStandardMaterial({
      map: westGableUpperMaps.map,
      bumpMap: westGableUpperMaps.bumpMap,
      bumpScale: 0.042,
      roughness: 0.88,
      metalness: 0.02
    }),
    ashlar: new THREE.MeshStandardMaterial({
      map: ashlarMaps.map,
      bumpMap: ashlarMaps.bumpMap,
      bumpScale: 0.028,
      roughness: 0.85,
      metalness: 0.02
    }),
    ashlarWarm: new THREE.MeshStandardMaterial({
      color: 0xe6d7b6,
      map: ashlarMaps.map,
      bumpMap: ashlarMaps.bumpMap,
      bumpScale: 0.025,
      roughness: 0.82
    }),
    granite: new THREE.MeshStandardMaterial({
      map: graniteMap,
      roughness: 0.48,
      metalness: 0.08
    }),
    stoneCapDark: new THREE.MeshStandardMaterial({
      color: 0x76746c,
      map: ashlarMaps.map,
      roughness: 0.94
    }),
    clayRoof: new THREE.MeshStandardMaterial({
      map: clayRoofMaps.map,
      bumpMap: clayRoofMaps.bumpMap,
      bumpScale: 0.05,
      roughness: 0.88,
      metalness: 0.03
    }),
    weatherboard: new THREE.MeshStandardMaterial({
      map: weatherboardMaps.map,
      bumpMap: weatherboardMaps.bumpMap,
      bumpScale: 0.045,
      roughness: 0.9
    }),
    shingles: new THREE.MeshStandardMaterial({
      map: shingleMaps.map,
      bumpMap: shingleMaps.bumpMap,
      bumpScale: 0.04,
      roughness: 0.91
    }),
    plaster: new THREE.MeshStandardMaterial({
      map: plasterMaps.map,
      bumpMap: plasterMaps.bumpMap,
      bumpScale: 0.015,
      roughness: 0.92
    }),
    naveCeilingBlue: new THREE.MeshStandardMaterial({
      color: 0xb9d7dc,
      roughness: 0.88,
      side: THREE.DoubleSide
    }),
    chancelPlaster: new THREE.MeshStandardMaterial({
      color: 0xe8ded5,
      roughness: 0.9,
      side: THREE.DoubleSide
    }),
    darkOak: new THREE.MeshStandardMaterial({
      map: darkOakMaps.map,
      bumpMap: darkOakMaps.bumpMap,
      bumpScale: 0.025,
      roughness: 0.78
    }),
    warmOak: new THREE.MeshStandardMaterial({
      map: warmOakMaps.map,
      bumpMap: warmOakMaps.bumpMap,
      bumpScale: 0.018,
      roughness: 0.46
    }),
    parquetryOak: new THREE.MeshStandardMaterial({
      map: parquetryMaps.map,
      bumpMap: parquetryMaps.bumpMap,
      bumpScale: 0.02,
      roughness: 0.55
    }),
    medOak: new THREE.MeshStandardMaterial({
      map: medOakMaps.map,
      bumpMap: medOakMaps.bumpMap,
      bumpScale: 0.02,
      roughness: 0.62
    }),
    northDoorBlue: new THREE.MeshStandardMaterial({
      color: 0x4b6478,
      bumpMap: darkOakMaps.bumpMap,
      bumpScale: 0.022,
      roughness: 0.72
    }),
    porchGateGrey: new THREE.MeshStandardMaterial({
      color: 0x575d66,
      roughness: 0.8
    }),
    quarryTile: new THREE.MeshStandardMaterial({
      map: quarryMaps.map,
      bumpMap: quarryMaps.bumpMap,
      bumpScale: 0.012,
      roughness: 0.65
    }),
    sanctuaryTile: new THREE.MeshStandardMaterial({
      map: sanctuaryTileMap,
      roughness: 0.55
    }),
    carpetGold: new THREE.MeshStandardMaterial({
      color: 0xc9a868,
      roughness: 0.95
    }),
    carpetCrimson: new THREE.MeshStandardMaterial({
      color: 0x6e141c,
      roughness: 0.96
    }),
    cushionCrimson: new THREE.MeshStandardMaterial({
      color: 0x9c1b2c,
      roughness: 0.85
    }),
    // Plain navy cloth hassocks, all alike
    kneelerFabric: new THREE.MeshStandardMaterial({
      map: kneelerMaps.map,
      bumpMap: kneelerMaps.bumpMap,
      bumpScale: 0.6,
      roughness: 0.95
    }),
    kneelerCord: new THREE.MeshStandardMaterial({
      color: 0x8a7650,
      roughness: 0.92
    }),
    purpleCloth: new THREE.MeshStandardMaterial({
      color: 0x4b1b94,
      roughness: 0.86,
      side: THREE.DoubleSide
    }),
    altarFrontal: new THREE.MeshStandardMaterial({
      map: createAltarFrontalTexture(maxAniso),
      roughness: 0.72
    }),
    laceCloth: new THREE.MeshStandardMaterial({
      map: createLaceClothTexture(maxAniso),
      roughness: 0.85
    }),
    brass: new THREE.MeshStandardMaterial({
      color: 0xd9b24c,
      roughness: 0.28,
      metalness: 0.86
    }),
    iron: new THREE.MeshStandardMaterial({
      color: 0x202226,
      roughness: 0.58,
      metalness: 0.68
    }),
    glassShade: new THREE.MeshStandardMaterial({
      color: 0xfbf7ee,
      emissive: 0xffe4b3,
      emissiveIntensity: 0.65,
      roughness: 0.35
    }),
    wax: new THREE.MeshStandardMaterial({
      color: 0xf5ecd6,
      roughness: 0.55
    }),
    grass: new THREE.MeshStandardMaterial({
      map: grassMap,
      roughness: 0.96
    }),
    gravelPath: new THREE.MeshStandardMaterial({
      color: 0x565a5e,
      roughness: 0.95
    }),
    // Diamond-chequer paver footpath (path-paving photo)
    pathPavers: new THREE.MeshStandardMaterial({
      map: pathPaverMaps.map,
      bumpMap: pathPaverMaps.bumpMap,
      bumpScale: 2.2,
      roughness: 0.9
    }),
    gravePebbles: new THREE.MeshStandardMaterial({
      map: gravePebbleMaps.map,
      bumpMap: gravePebbleMaps.bumpMap,
      bumpScale: 0.036,
      roughness: 0.88,
      metalness: 0.03
    }),
    glassClear: new THREE.MeshStandardMaterial({
      map: createWindowGlassTexture('clear-diamond', maxAniso),
      emissive: 0xcbe4fa,
      emissiveIntensity: 0.38,
      roughness: 0.22,
      metalness: 0.1,
      transparent: true,
      opacity: 0.86,
      side: THREE.DoubleSide
    }),
    glassEast: new THREE.MeshStandardMaterial({
      map: eastStainedGlassTex,
      emissiveMap: eastStainedGlassTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.72,
      roughness: 0.24,
      side: THREE.DoubleSide
    }),
    glassSower: new THREE.MeshStandardMaterial({
      map: sowerStainedGlassTex,
      emissiveMap: sowerStainedGlassTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.76,
      roughness: 0.24,
      side: THREE.DoubleSide
    }),
    glassWilson: new THREE.MeshStandardMaterial({
      map: wilsonStainedGlassTex,
      emissiveMap: wilsonStainedGlassTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.72,
      roughness: 0.24,
      side: THREE.DoubleSide
    }),
    glassNorthNave: new THREE.MeshStandardMaterial({
      map: jaquesStainedGlassTex,
      emissiveMap: jaquesStainedGlassTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.7,
      roughness: 0.24,
      side: THREE.DoubleSide
    }),
    jaquesDonors: new THREE.MeshStandardMaterial({
      map: jaquesDonorsTex,
      roughness: 0.32,
      metalness: 0.04
    }),
    attenboroughPlaque: new THREE.MeshStandardMaterial({
      map: attenboroughMaps.map,
      bumpMap: attenboroughMaps.bumpMap,
      bumpScale: 0.02,
      roughness: 0.6
    }),
    rollOfHonour: new THREE.MeshStandardMaterial({
      map: rollOfHonourMaps.map,
      bumpMap: rollOfHonourMaps.bumpMap,
      bumpScale: 0.02,
      roughness: 0.8
    }),
    // Opal-white frilled tulip glass shades of the nave pendant lamps
    opalGlass: new THREE.MeshStandardMaterial({
      color: 0xf7efec,
      emissive: 0xffe9dc,
      emissiveIntensity: 0.62,
      roughness: 0.38,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide
    }),
    opalGlassLip: new THREE.MeshStandardMaterial({
      color: 0xfdf6f2,
      emissive: 0xfff1e6,
      emissiveIntensity: 0.4,
      roughness: 0.15,
      transparent: true,
      opacity: 0.7
    }),
    dedicationStone1860: new THREE.MeshStandardMaterial({
      map: dedication1860Maps.map,
      bumpMap: dedication1860Maps.bumpMap,
      bumpScale: 0.018,
      roughness: 0.86
    }),
    causticDecal: new THREE.MeshBasicMaterial({
      map: createCausticTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.65
    })
  };
}
