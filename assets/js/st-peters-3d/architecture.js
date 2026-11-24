import * as THREE from 'three';
import { addBox, boxMesh } from '/assets/js/st-peters-3d/mesh-utils.js';
import { DIM } from '/assets/js/st-peters-3d/dimensions.js';
import { createChancelReliefHeightMaps } from '/assets/js/st-peters-3d/plaques.js';
import { buildBellChamber } from '/assets/js/st-peters-3d/belfry.js';

// Box-projected world-space UVs so masonry & roof tiles never stretch on ExtrudeGeometry
export function applyBoxUVs(geometry, scale = 0.45) {
  geometry.computeVertexNormals();
  const pos = geometry.attributes.position;
  const norm = geometry.attributes.normal;
  const uvs = new Float32Array(pos.count * 2);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));

    let u = 0;
    let v = 0;
    if (ny >= nx && ny >= nz) {
      u = x * scale;
      v = z * scale;
    } else if (nx >= ny && nx >= nz) {
      u = z * scale;
      v = y * scale;
    } else {
      u = x * scale;
      v = y * scale;
    }
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geometry;
}

// Helper: sample points along a pointed Gothic arch or rectangular window contour (2D in local u, v)
function sampleOpeningPoints(spec, splayW = 0, splayTop = 0, splayBot = 0) {
  const hw = spec.width * 0.5 + splayW;
  const bot = spec.sillY - splayBot;
  const pts = [];

  if (spec.type === 'north-square-stained') {
    const top = spec.topY + splayTop;
    pts.push([-hw, bot], [hw, bot], [hw, top], [-hw, top]);
    return pts;
  }

  // Pointed Gothic arch
  const spring = spec.springY + splayTop * 0.35;
  const apex = spec.apexY + splayTop;
  pts.push([-hw, bot], [hw, bot], [hw, spring]);

  // Right arch curve from (hw, spring) to (0, apex)
  const segs = 10;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    // Smooth pointed gothic curve
    const u = hw * Math.pow(1 - t, 1.15);
    const v = spring + (apex - spring) * Math.sin((t * Math.PI) / 2);
    pts.push([i === segs ? 0 : u, v]);
  }
  // Left arch curve from (0, apex) down to (-hw, spring)
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const u = -hw * Math.pow(t, 1.15);
    const v = spring + (apex - spring) * Math.cos((t * Math.PI) / 2);
    pts.push([u, v]);
  }
  return pts;
}

// Convert 2D opening points into a THREE.Path hole centered at `centerU`
function makeOpeningHole(centerU, pts) {
  const path = new THREE.Path();
  path.moveTo(centerU + pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    path.lineTo(centerU + pts[i][0], pts[i][1]);
  }
  path.closePath();
  return path;
}

// Build a clean splayed reveal tunnel connecting two 2D contours along Z (local z0 -> z1).
// Faces point into the opening (towards the viewer looking through it). `gapY` = [y0, y1] leaves a horizontal
// band of the two vertical jamb faces open so carved panels can be set into them.
function buildRevealTunnel(centerU, ptsOuter, zOuter, ptsInner, zInner, material, uvScale = 0.5, gapY = null) {
  const positions = [];
  const uvs = [];
  const n = ptsOuter.length;

  const pushQuad = (a, b, c, d) => {
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  };
  const pushFace = (a, b, c, d) => {
    if (zInner > zOuter) {
      pushQuad(b, a, d, c);
    } else {
      pushQuad(a, b, c, d);
    }
  };
  // Point on a vertical edge (p -> q) at height y
  const atY = (p, q, y) => [p[0], y, p[2]];

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = [centerU + ptsOuter[i][0], ptsOuter[i][1], zOuter];
    const b = [centerU + ptsOuter[j][0], ptsOuter[j][1], zOuter];
    const c = [centerU + ptsInner[j][0], ptsInner[j][1], zInner];
    const d = [centerU + ptsInner[i][0], ptsInner[i][1], zInner];
    const verticalJamb = a[0] === b[0] && c[0] === d[0];
    if (gapY && verticalJamb) {
      const [y0, y1] = gapY;
      const aLow = a[1] < b[1];
      // Orient so lo* are the lower ends of the outer (a/b) and inner (d/c) edges
      const loO = aLow ? a : b;
      const hiO = aLow ? b : a;
      const loI = aLow ? d : c;
      const hiI = aLow ? c : d;
      const below = [loO, atY(loO, hiO, y0), atY(loI, hiI, y0), loI];
      const above = [atY(loO, hiO, y1), hiO, hiI, atY(loI, hiI, y1)];
      for (const [p0, p1, p2, p3] of [below, above]) {
        if (aLow) pushFace(p0, p1, p2, p3);
        else pushFace(p1, p0, p3, p2);
      }
      continue;
    }
    pushFace(a, b, c, d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  applyBoxUVs(geo, uvScale);

  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Carved relief cut into a flat face: a plane subdivided every ~2.5mm whose surface is flush with the face (z = 0)
// where the height field is 255 and sunk up to `depth` behind it where it is 0. The canvas is fitted into the face
// between `marginL` and `marginR` (metres); everything outside it is plain flush stone.
function buildCarvedFace(canvas, width, height, depth, marginL, marginR, material) {
  const cw = canvas.width;
  const ch = canvas.height;
  const px = canvas.getContext('2d').getImageData(0, 0, cw, ch).data;
  let hf = new Float32Array(cw * ch);
  for (let i = 0; i < cw * ch; i++) hf[i] = px[i * 4] / 255;

  // Two passes of a 5x5 box blur soften the drawn shapes into worn, rounded stone
  const blur = (src) => {
    const tmp = new Float32Array(src.length);
    const out = new Float32Array(src.length);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        let sum = 0;
        let cnt = 0;
        for (let k = -2; k <= 2; k++) {
          const xx = x + k;
          if (xx >= 0 && xx < cw) {
            sum += src[y * cw + xx];
            cnt++;
          }
        }
        tmp[y * cw + x] = sum / cnt;
      }
    }
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        let sum = 0;
        let cnt = 0;
        for (let k = -2; k <= 2; k++) {
          const yy = y + k;
          if (yy >= 0 && yy < ch) {
            sum += tmp[yy * cw + x];
            cnt++;
          }
        }
        out[y * cw + x] = sum / cnt;
      }
    }
    return out;
  };
  hf = blur(blur(hf));

  // Canvas pixels are millimetres: keep the carving's true width where it fits, centring it in the spare face
  const avail = width - marginL - marginR;
  const carvedW = Math.min(avail, cw * 0.001);
  const left = marginL + (avail - carvedW) * 0.5;
  const sample = (s, t) => {
    // s across the face (0..1), t down the face (0..1)
    const u = (s * width - left) / carvedW;
    if (u <= 0 || u >= 1) return 1;
    const fx = u * (cw - 1);
    const fy = Math.min(ch - 1.001, Math.max(0, t * (ch - 1)));
    const x0 = Math.min(cw - 2, Math.floor(fx));
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const a = hf[y0 * cw + x0] * (1 - tx) + hf[y0 * cw + x0 + 1] * tx;
    const b = hf[(y0 + 1) * cw + x0] * (1 - tx) + hf[(y0 + 1) * cw + x0 + 1] * tx;
    return a * (1 - ty) + b * ty;
  };

  const segX = Math.round(width / 0.0025);
  const segY = Math.round(height / 0.0025);
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const h = sample(uv.getX(i), 1 - uv.getY(i));
    pos.setZ(i, -(1 - h) * depth);
    const shade = 0.58 + 0.42 * Math.pow(h, 0.8);
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade * 0.98;
    colors[i * 3 + 2] = shade * 0.93;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // Tile the stone texture at the same scale as the reveal faces around it, rather than stretching it once
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * width * 0.45, uv.getY(i) * height * 0.45);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Build window glass, stone surround, and tracery mullions inside a window aperture
function buildWindowInsert(spec, mats) {
  const group = new THREE.Group();
  const hw = spec.width * 0.5;
  const pts = sampleOpeningPoints(spec, 0, 0, 0);

  // Glass pane shape
  const glassShape = new THREE.Shape();
  glassShape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) glassShape.lineTo(pts[i][0], pts[i][1]);
  glassShape.closePath();

  const glassGeo = new THREE.ShapeGeometry(glassShape, 12);
  // Normalize glass UVs 0..1 across window bounding box so stained glass fills perfectly!
  const pos = glassGeo.attributes.position;
  const topY = spec.type === 'north-square-stained' ? spec.topY : spec.apexY;
  const h = topY - spec.sillY;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uvs[i * 2] = (pos.getX(i) + hw) / spec.width;
    uvs[i * 2 + 1] = (pos.getY(i) - spec.sillY) / h;
  }
  glassGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  let glassMat = mats.glassClear;
  if (spec.type === 'east-stained') glassMat = mats.glassEast;
  else if (spec.type === 'sower-stained') glassMat = mats.glassSower;
  else if (spec.type === 'north-square-stained') glassMat = mats.glassNorthNave;
  else if (spec.type === 'wilson-stained') glassMat = mats.glassWilson;

  const glassMesh = new THREE.Mesh(glassGeo, glassMat);
  // None of the stained glass was there in 1900: main.js swaps in plain glazing for that era
  if (glassMat !== mats.glassClear) glassMesh.userData.stainedGlass = true;
  group.add(glassMesh);

  // Outer chamfered stone surround / dripstone hood mould
  const outerPts = sampleOpeningPoints(spec, 0.08, 0.09, 0.06);
  const surroundShape = new THREE.Shape();
  surroundShape.moveTo(outerPts[0][0], outerPts[0][1]);
  for (let i = 1; i < outerPts.length; i++) surroundShape.lineTo(outerPts[i][0], outerPts[i][1]);
  surroundShape.closePath();
  surroundShape.holes.push(makeOpeningHole(0, pts));

  const surrGeo = new THREE.ExtrudeGeometry(surroundShape, { depth: 0.14, bevelEnabled: false });
  surrGeo.translate(0, 0, -0.07);
  applyBoxUVs(surrGeo, 0.7);
  const surrMesh = new THREE.Mesh(surrGeo, mats.ashlarWarm);
  surrMesh.castShadow = true;
  surrMesh.receiveShadow = true;
  group.add(surrMesh);

  // Stone sill ledge
  addBox(group, [spec.width + 0.24, 0.1, 0.22], mats.ashlarWarm, [0, spec.sillY - 0.04, 0.02], {
    cast: true,
    receive: true
  });

  // Square-headed outer stone hood mould above Window 6 (North Nave Jaques Window, A3)
  // A1 (Sower), A2 (Altar/East) and A3 (Jaques) render procedurally painted stained-glass & stone tracery textures cleanly.
  if (spec.type === 'north-square-stained') {
    addBox(group, [spec.width + 0.34, 0.09, 0.12], mats.ashlarWarm, [0, spec.topY + 0.1, -0.08]);
  }

  return group;
}

// Build a stepped medieval ashlar stone buttress with sloped weathered caps
function buildButtress(width, depth, height, mats) {
  const g = new THREE.Group();

  // Base plinth
  addBox(g, [width + 0.12, 0.58, depth + 0.12], mats.ashlar, [0, 0.29, (depth + 0.12) * 0.5], {
    cast: true,
    receive: true
  });

  // Lower stage
  const stage1H = height * 0.58;
  addBox(g, [width, stage1H, depth], mats.ashlar, [0, 0.58 + stage1H * 0.5, depth * 0.5], {
    cast: true,
    receive: true
  });

  // Sloped top weather-cap (extruded triangle wedge)
  const capH = height * 0.34;
  const capShape = new THREE.Shape();
  capShape.moveTo(0, 0);
  capShape.lineTo(depth, 0);
  capShape.lineTo(0, capH);
  capShape.closePath();

  const capGeo = new THREE.ExtrudeGeometry(capShape, { depth: width + 0.04, bevelEnabled: false });
  capGeo.rotateY(-Math.PI / 2);
  capGeo.translate((width + 0.04) * 0.5, 0.58 + stage1H, 0);
  applyBoxUVs(capGeo, 0.7);
  const cap = new THREE.Mesh(capGeo, mats.stoneCapDark);
  cap.castShadow = true;
  cap.receiveShadow = true;
  g.add(cap);

  return g;
}

// Build a black cast-iron rainwater pipe (RWP) with hopper head
function buildRWP(height, mats) {
  const g = new THREE.Group();
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, height, 10), mats.iron);
  pipe.position.set(0, height * 0.5, 0.09);
  pipe.castShadow = true;
  g.add(pipe);

  // Cast-iron hopper head at eaves
  addBox(g, [0.24, 0.22, 0.2], mats.iron, [0, height - 0.12, 0.11], { cast: true });

  // Pipe mounting collars
  [0.7, height * 0.55].forEach((cy) => {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 10), mats.iron);
    collar.position.set(0, cy, 0.09);
    g.add(collar);
  });
  return g;
}

// Ordnance Survey cut benchmark carved into the West face (-X) of a corner quoin: a horizontal bar with a broad arrow
// beneath it pointing up to the bar, and a drilled hole at its North end. Returns a replacement quoin box whose
// West face is finely subdivided and pushed in along V-cut grooves, darkened towards the bottom of each cut.
// (u, v) on that face: u runs along +Z from the face centre, v up from the stone's centre.
function buildBenchmarkQuoin(qx, qy, qz, mat, mark) {
  const geo = new THREE.BoxGeometry(qx, qy, qz, 1, Math.round(qy / 0.0015), Math.round(qz / 0.0015));
  const segs = [
    [mark.u - 0.065, mark.v, mark.u + 0.065, mark.v], // bar
    [mark.u, mark.v - 0.018, mark.u, mark.v - 0.11], // arrow shaft
    [mark.u, mark.v - 0.018, mark.u - 0.04, mark.v - 0.1], // arrow legs
    [mark.u, mark.v - 0.018, mark.u + 0.04, mark.v - 0.1]
  ];
  const holeU = mark.u - 0.078;
  /** @type {(u: number, v: number, seg: number[]) => number} */
  const segDist = (u, v, [u0, v0, u1, v1]) => {
    const du = u1 - u0;
    const dv = v1 - v0;
    const t = Math.min(1, Math.max(0, ((u - u0) * du + (v - v0) * dv) / (du * du + dv * dv)));
    return Math.hypot(u - (u0 + du * t), v - (v0 + dv * t));
  };
  const halfW = 0.0065; // 13mm wide V-cuts
  const cutDepth = 0.0075;
  const depthAt = (u, v) => {
    let d = 0;
    for (const sg of segs) {
      const r = segDist(u, v, sg);
      if (r < halfW) d = Math.max(d, cutDepth * (1 - r / halfW));
    }
    const rh = Math.hypot(u - holeU, v - mark.v);
    if (rh < 0.013) d = Math.max(d, 0.03 * Math.min(1, (0.013 - rh) / 0.003)); // drilled hole, steep sides
    return d;
  };
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3).fill(1);
  for (let k = 0; k < pos.count; k++) {
    if (pos.getX(k) > -qx * 0.5 + 1e-6) continue;
    const d = depthAt(pos.getZ(k), pos.getY(k));
    if (d <= 0) continue;
    pos.setX(k, pos.getX(k) + d);
    const shade = 1 - 0.45 * Math.min(1, d / cutDepth);
    colors.set([shade, shade * 0.97, shade * 0.93], k * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const carvedMat = mat.clone();
  carvedMat.vertexColors = true;
  const q = new THREE.Mesh(geo, carvedMat);
  q.castShadow = true;
  q.receiveShadow = true;
  return q;
}

// Stove chimney (1900 era only): a pale cylindrical flue pipe rising through the South roof slope just above the
// wall head, with a lead flashing collar where it meets the tiles and a conical rain cap on top
function buildStoveChimney(x, N, mats) {
  const g = new THREE.Group();
  g.userData.era = '1900';
  g.visible = false;
  const pale = new THREE.MeshStandardMaterial({ color: 0xb9b6ae, roughness: 0.55, metalness: 0.45 });
  const zc = N.zSouthInt + 0.2;
  const run = N.zSouthExt + N.overhang;
  const roofRise = (N.ridgeY - N.eavesY) / run;
  const roofTopAt = (z) => N.eavesY + roofRise * (run - z) + 0.17; // tile surface (buildPitchedRoof slab top)
  const baseY = N.eavesY;
  const topY = roofTopAt(zc) + 0.95;
  const pipeR = 0.09;
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(pipeR, pipeR, topY - baseY, 20), pale);
  pipe.position.set(x, (baseY + topY) * 0.5, zc);
  pipe.castShadow = true;
  pipe.receiveShadow = true;
  g.add(pipe);
  // Socket joints along the exposed length
  [0.35, 0.7].forEach((t) => {
    const y = roofTopAt(zc) + (topY - roofTopAt(zc)) * t;
    const joint = new THREE.Mesh(new THREE.CylinderGeometry(pipeR + 0.012, pipeR + 0.012, 0.05, 20), pale);
    joint.position.set(x, y, zc);
    g.add(joint);
  });
  // Lead flashing collar sloping with the roof
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(pipeR + 0.03, pipeR + 0.1, 0.1, 20), mats.stoneCapDark);
  collar.position.set(x, roofTopAt(zc) + 0.03, zc);
  collar.rotation.x = Math.atan(roofRise) * 0.5;
  g.add(collar);
  // Conical rain cap on three short stays
  const cap = new THREE.Mesh(new THREE.ConeGeometry(pipeR * 2.1, 0.13, 20), pale);
  cap.position.set(x, topY + 0.12, zc);
  cap.castShadow = true;
  g.add(cap);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    addBox(g, [0.012, 0.09, 0.012], pale, [x + Math.cos(a) * pipeR * 0.9, topY + 0.03, zc + Math.sin(a) * pipeR * 0.9]);
  }
  // Stove smoke curling out from under the rain cap
  const smoke = buildChimneySmoke();
  smoke.position.set(x, topY + 0.06, zc);
  g.add(smoke);
  return g;
}

// Wisps of coal smoke from the stove pipe: one Points draw whose puffs rise, swell, drift East on the breeze and
// fade, all worked out in the vertex shader from the clock, so it costs no per-frame JavaScript beyond one uniform
const WHITE = new THREE.Color(1, 1, 1);
function buildChimneySmoke(count = 28) {
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) seeds[i] = i / count;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(1.2, 2.2, 0), 3.5);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPxScale: { value: 400 },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uVis: { value: 1 }
    },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float uTime;
      uniform float uPxScale;
      attribute float aSeed;
      varying float vAlpha;
      varying float vShade;
      const float LIFE = 7.0;
      void main() {
        float age = fract(uTime / LIFE + aSeed);
        float h = fract(sin(aSeed * 91.7) * 43758.5);
        vec3 p = vec3(0.0);
        p.y = 2.6 * age - 0.7 * age * age;
        p.x = 1.9 * age * age + 0.12 * sin(uTime * 0.9 + h * 6.28) * age;
        p.z = (h - 0.5) * 0.9 * age + 0.1 * cos(uTime * 0.7 + h * 9.0) * age;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = mix(0.22, 1.5, sqrt(age)) * (0.8 + 0.4 * h);
        gl_PointSize = size * uPxScale / -mv.z;
        vAlpha = smoothstep(0.0, 0.08, age) * pow(1.0 - age, 1.6) * 0.32;
        vShade = 0.3 + 0.1 * h + 0.12 * age;
      }
    `,
    fragmentShader: `
      uniform vec3 uTint;
      uniform float uVis;
      varying float vAlpha;
      varying float vShade;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = dot(c, c) * 4.0;
        float a = uVis * vAlpha * smoothstep(1.0, 0.0, d) * (0.75 + 0.25 * sin(gl_PointCoord.x * 9.0 + gl_PointCoord.y * 7.0));
        if (a < 0.004) discard;
        gl_FragColor = vec4(vShade * uTint, a);
        #include <colorspace_fragment>
      }
    `
  });
  const smoke = new THREE.Points(geo, mat);
  smoke.renderOrder = 5;
  const buf = new THREE.Vector2();
  smoke.onBeforeRender = (renderer, scene, camera) => {
    mat.uniforms.uTime.value = performance.now() / 1000;
    // Unlit, so follow the daylight through the mood's fog colour: warm at golden hour, gone after dark (Evensong)
    if (scene.fog) {
      const f = scene.fog.color;
      const lum = 0.2126 * f.r + 0.7152 * f.g + 0.0722 * f.b;
      mat.uniforms.uVis.value = THREE.MathUtils.smoothstep(lum, 0.06, 0.35);
      mat.uniforms.uTint.value
        .copy(f)
        .multiplyScalar(1 / Math.max(lum, 0.01))
        .lerp(WHITE, 0.6);
    }
    // Point sizes are in pixels: world size x (half the drawing height / tan(half the field of view))
    mat.uniforms.uPxScale.value = renderer.getDrawingBufferSize(buf).y * 0.5 * camera.projectionMatrix.elements[5];
  };
  return smoke;
}

// The West end's half hip as it was before the 1909 rebuild ('1900' era): a tiled hip slab rising from the old gable
// head at y = halfHipY to the ridge, stopping at the belfry's West wall. While it shows, main.js clips the clay
// roof slopes and ridge (mats.clayRoof) along the hip's plane, stored here as userData.clipPlane.
function buildHalfHip(N, halfHipY, mats) {
  const g = new THREE.Group();
  g.userData.era = '1900';
  g.visible = false;
  const thick = 0.14;
  const run = N.zSouthExt + N.overhang;
  const rise = N.ridgeY - N.eavesY;
  const k = rise / run; // the hip is pitched like the main slopes
  const lift = thick * 0.45 + thick * 0.5 * Math.hypot(1, k); // slab top above the slope line (buildPitchedRoof)
  const xe = N.xWestExt - 0.12; // eaves of the hip oversail the wall head
  const ye = halfHipY + lift - 0.12 * k;
  const yTop = N.ridgeY + lift;
  const zb = run * (1 - (ye - lift - N.eavesY) / rise); // where the hip's eave meets the side slopes
  const L = ((yTop - ye) / k) * Math.hypot(1, k);
  const shape = new THREE.Shape();
  shape.moveTo(0, -zb);
  shape.lineTo(L, 0);
  shape.lineTo(0, zb);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  const t = new THREE.Vector3(1, k, 0).normalize();
  const n = new THREE.Vector3(k, -1, 0).normalize(); // into the roof (East & down)
  geo.applyMatrix4(new THREE.Matrix4().makeBasis(t, new THREE.Vector3(0, 0, 1), n).setPosition(xe, ye, 0));
  applyBoxUVs(geo, 0.52);
  const hipMat = mats.clayRoof.clone();
  hipMat.clippingPlanes = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), DIM.tower.xCenter - DIM.tower.size * 0.5)];
  hipMat.clipShadows = true;
  const hip = new THREE.Mesh(geo, hipMat);
  hip.castShadow = true;
  hip.receiveShadow = true;
  g.add(hip);
  // Hip-ridge capping tiles along the two hip edges
  const apex = new THREE.Vector3(xe, ye, 0).addScaledVector(t, L);
  [-1, 1].forEach((side) => {
    const foot = new THREE.Vector3(xe, ye, side * zb);
    const len = foot.distanceTo(apex);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 8), hipMat);
    cap.position.copy(foot).lerp(apex, 0.5);
    cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), apex.clone().sub(foot).normalize());
    cap.castShadow = true;
    g.add(cap);
  });
  g.userData.clipPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(xe, ye, 0));
  return g;
}

// Build a carved limestone gable cross (East gable & North Porch gable)
function buildGableCross(scale, mats) {
  const g = new THREE.Group();
  const plinth = addBox(g, [0.28 * scale, 0.22 * scale, 0.24 * scale], mats.ashlar);
  plinth.position.y = 0.11 * scale;

  const shaft = addBox(g, [0.11 * scale, 0.65 * scale, 0.1 * scale], mats.ashlar, [0, 0, 0], { cast: true });
  shaft.position.y = 0.48 * scale;

  const arms = addBox(g, [0.44 * scale, 0.11 * scale, 0.1 * scale], mats.ashlar, [0, 0, 0], { cast: true });
  arms.position.y = 0.58 * scale;

  return g;
}

// Carved panels sunk into the two splayed jamb faces of an opening or recess, centred on u. Each jamb face runs
// from (±outerHW, zOuter) at the back to (±innerHW, zInner) at the room face.
function addCarvedJambPanels(group, u, outerHW, zOuter, innerHW, zInner, carved) {
  const [y0, y1] = carved.y;
  for (const jamb of carved.panels) {
    const sx = jamb.side; // -1 = left (low u) jamb, +1 = right jamb
    const po = new THREE.Vector3(u + sx * outerHW, 0, zOuter);
    const pi = new THREE.Vector3(u + sx * innerHW, 0, zInner);
    const along = pi.clone().sub(po);
    const faceW = along.length();
    along.normalize();
    // Face normal points into the opening, away from the jamb's masonry
    const normal = new THREE.Vector3(along.z, 0, -along.x).multiplyScalar(-sx);
    const up = new THREE.Vector3(0, 1, 0);
    const right = up.clone().cross(normal);
    // Margins keep the sunk carving clear of the masonry corners at either edge of the face
    const innerOnRight = right.dot(along) > 0;
    const mOuter = 0.03;
    const mInner = 0.06;
    const panel = buildCarvedFace(
      jamb.canvas,
      faceW,
      y1 - y0,
      carved.depth,
      innerOnRight ? mOuter : mInner,
      innerOnRight ? mInner : mOuter,
      jamb.material
    );
    panel.matrix.makeBasis(right, up, normal);
    panel.matrix.setPosition(
      po
        .clone()
        .add(pi)
        .multiplyScalar(0.5)
        .setY((y0 + y1) * 0.5)
    );
    panel.matrix.decompose(panel.position, panel.quaternion, panel.scale);
    group.add(panel);
  }
}

// Helper to build a two-layer pierced wall (outer limestone rubble + inner cream plaster + splayed window reveals)
/**
 * @param {{
 *   outlinePts?: number[][], outerOutlinePts?: number[][], innerOutlinePts?: number[][],
 *   outerMaterial?: THREE.Material | null, outerThick: number, innerThick: number,
 *   openings?: any[], niches?: any[], mats: any
 * }} options
 */
function buildCompositeWall({
  outlinePts,
  outerOutlinePts = outlinePts,
  innerOutlinePts = outlinePts,
  outerMaterial = null,
  outerThick,
  innerThick,
  openings = [], // [{ u, spec, isDoor, splayW, splayTop, splayBot, quoinSkipY, carvedJambs, seat }]
  niches = [], // [{ u, spec, depth }]: recesses cut into the inner leaf only (e.g. the chancel piscina)
  mats
}) {
  const group = new THREE.Group();

  // Outer masonry shape (z: 0 to outerThick)
  const outerShape = new THREE.Shape();
  outerShape.moveTo(outerOutlinePts[0][0], outerOutlinePts[0][1]);
  for (let i = 1; i < outerOutlinePts.length; i++) outerShape.lineTo(outerOutlinePts[i][0], outerOutlinePts[i][1]);
  outerShape.closePath();

  // Inner plaster shape (z: outerThick to outerThick + innerThick)
  const innerShape = new THREE.Shape();
  innerShape.moveTo(innerOutlinePts[0][0], innerOutlinePts[0][1]);
  for (let i = 1; i < innerOutlinePts.length; i++) innerShape.lineTo(innerOutlinePts[i][0], innerOutlinePts[i][1]);
  innerShape.closePath();

  for (const op of openings) {
    const outerPts = sampleOpeningPoints(op.spec, 0, 0, 0);
    const innerPts = sampleOpeningPoints(op.spec, op.splayW ?? 0.22, op.splayTop ?? 0.2, op.splayBot ?? 0.04);

    // A window with a stone seat beneath it: the glazing stays where it is, but the embrasure (its splayed jambs
    // and the inner opening) is carried down to the seat, with a plain stone back below the glass
    const seatY = op.seat?.y0 ?? null;
    const dropSill = (pts) => (seatY === null ? pts : pts.map(([x, y], k) => (k < 2 ? [x, seatY] : [x, y])));
    const carved = op.carvedJambs ?? op.seat?.carvedJambs ?? null;

    outerShape.holes.push(makeOpeningHole(op.u, outerPts));
    innerShape.holes.push(makeOpeningHole(op.u, dropSill(innerPts)));

    // Splayed plaster interior reveal connecting outer plane (z = outerThick) to inner face (z = outerThick + innerThick)
    const revealMat = op.isDoor ? mats.ashlarWarm : mats.plaster;
    const zIn = outerThick + innerThick;
    // A doorway's level reveal floor would lie exactly on the plaster leaf's sill face and flicker; lift it 3mm
    const liftFloor = (pts) => {
      if (!op.isDoor) return pts;
      const minY = Math.min(...pts.map((p) => p[1]));
      return pts.map(([x, y]) => [x, y <= minY + 1e-6 ? y + 0.003 : y]);
    };
    const reveal = buildRevealTunnel(
      op.u,
      liftFloor(dropSill(outerPts)),
      outerThick,
      liftFloor(dropSill(innerPts)),
      zIn,
      op.seat ? mats.ashlarWarm : revealMat,
      0.45,
      carved?.y ?? null
    );
    group.add(reveal);

    // Carved panels sunk into the splayed jamb faces
    if (carved) {
      addCarvedJambPanels(group, op.u, outerPts[1][0], outerThick, innerPts[1][0], zIn, carved);
    }

    if (op.seat) {
      // Plain dressed stone filling the embrasure's back beneath the glass, down to the seat
      const backW = outerPts[1][0] * 2;
      const backGeo = new THREE.PlaneGeometry(backW, op.spec.sillY - seatY);
      const backUV = backGeo.attributes.uv;
      for (let i = 0; i < backUV.count; i++) {
        backUV.setXY(i, backUV.getX(i) * backW * 0.45, backUV.getY(i) * (op.spec.sillY - seatY) * 0.45);
      }
      const back = new THREE.Mesh(backGeo, mats.ashlarWarm);
      back.position.set(op.u, (seatY + op.spec.sillY) * 0.5, outerThick + 0.002);
      group.add(back);
      // The seat: a dressed slab across the embrasure floor with a rounded nose just proud of the plaster
      const seatT = 0.07;
      const seatW = innerPts[1][0] * 2 + 0.06;
      const seatD = innerThick + 0.05;
      addBox(
        group,
        [seatW, seatT, seatD],
        mats.ashlarWarm,
        [op.u, seatY - seatT * 0.5 + 0.002, outerThick + seatD * 0.5],
        { cast: true, receive: true }
      );
      const nose = new THREE.Mesh(new THREE.CylinderGeometry(seatT * 0.5, seatT * 0.5, seatW, 12), mats.ashlarWarm);
      nose.rotation.z = Math.PI / 2;
      nose.position.set(op.u, seatY - seatT * 0.5 + 0.002, zIn + 0.05);
      group.add(nose);
    }

    // Outer stone jamb reveal (z = 0 to z = outerThick), inset 4mm so it lies just in front of the masonry's
    // own hole faces rather than on them
    const outerJambPts = sampleOpeningPoints(op.spec, -0.004, -0.004, -0.004);
    const outerReveal = buildRevealTunnel(op.u, outerJambPts, 0, outerJambPts, outerThick, mats.ashlarWarm, 0.55);
    group.add(outerReveal);

    // Window glazing + mullions (skip for open doorways)
    if (!op.isDoor) {
      const winInsert = buildWindowInsert(op.spec, mats);
      winInsert.position.set(op.u, 0, outerThick * 0.55);
      group.add(winInsert);

      // Decorative pale limestone interior quoin blocks along splayed reveal edge (seen in IMG_3938, 3949, 3950)
      const qBot = seatY ?? op.spec.sillY;
      const qH = (op.spec.topY ?? op.spec.springY) - qBot;
      const qCount = Math.max(3, Math.round(qH / 0.34));
      for (let q = 0; q < qCount; q++) {
        const qy = qBot + (q + 0.5) * (qH / qCount);
        // Leave room for carved panels set into the jamb (e.g. Window 7's medieval reliefs)
        const qHalf = qH / qCount / 2;
        if (op.quoinSkipY && qy + qHalf > op.quoinSkipY[0] && qy - qHalf < op.quoinSkipY[1]) continue;
        const qw = q % 2 === 0 ? 0.14 : 0.09;
        [-1, 1].forEach((side) => {
          const quoin = new THREE.Mesh(new THREE.BoxGeometry(qw, qH / qCount - 0.03, 0.035), mats.ashlarWarm);
          quoin.position.set(
            op.u + side * (op.spec.width * 0.5 + (op.splayW ?? 0.22) + qw * 0.45),
            qy,
            outerThick + innerThick + 0.005
          );
          group.add(quoin);
        });
      }
    }
  }

  // Stone-lined niches: a hole through the plaster leaf, lined 4mm inside its faces, closed by a back stone,
  // with a chamfered stone surround standing just proud of the plaster
  for (const ni of niches) {
    const zIn = outerThick + innerThick;
    const pts = sampleOpeningPoints(ni.spec, 0, 0, 0);
    innerShape.holes.push(makeOpeningHole(ni.u, pts));
    const liningPts = sampleOpeningPoints(ni.spec, -0.004, -0.004, -0.004);
    group.add(buildRevealTunnel(ni.u, liningPts, zIn - ni.depth, liningPts, zIn, mats.ashlarWarm, 0.45));
    const backShape = new THREE.Shape();
    backShape.moveTo(ni.u + pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) backShape.lineTo(ni.u + pts[i][0], pts[i][1]);
    backShape.closePath();
    const backGeo = new THREE.ShapeGeometry(backShape, 8);
    backGeo.translate(0, 0, zIn - ni.depth + 0.002);
    applyBoxUVs(backGeo, 0.45);
    group.add(new THREE.Mesh(backGeo, mats.ashlarWarm));
    const surrPts = sampleOpeningPoints(ni.spec, 0.06, 0.07, 0.05);
    const surrShape = new THREE.Shape();
    surrShape.moveTo(ni.u + surrPts[0][0], surrPts[0][1]);
    for (let i = 1; i < surrPts.length; i++) surrShape.lineTo(ni.u + surrPts[i][0], surrPts[i][1]);
    surrShape.closePath();
    surrShape.holes.push(makeOpeningHole(ni.u, pts));
    const surrGeo = new THREE.ExtrudeGeometry(surrShape, {
      depth: 0.03,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 1
    });
    surrGeo.translate(0, 0, zIn + 0.002);
    applyBoxUVs(surrGeo, 0.45);
    const surr = new THREE.Mesh(surrGeo, mats.ashlarWarm);
    surr.castShadow = true;
    group.add(surr);
    // Shallow round drain bowl sunk in the sill, its drain hole at the centre
    const bowlY = ni.spec.sillY + 0.0;
    const bowlZ = zIn - ni.depth * 0.5;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 24), mats.ashlarWarm);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(ni.u, bowlY + 0.006, bowlZ);
    group.add(rim);
    const dish = new THREE.Mesh(new THREE.CircleGeometry(0.072, 24), mats.stoneCapDark);
    dish.rotation.x = -Math.PI / 2;
    dish.position.set(ni.u, bowlY + 0.0055, bowlZ);
    group.add(dish);
    const drain = new THREE.Mesh(new THREE.CircleGeometry(0.012, 12), new THREE.MeshBasicMaterial({ color: 0x0b0a08 }));
    drain.rotation.x = -Math.PI / 2;
    drain.position.set(ni.u, bowlY + 0.0065, bowlZ);
    group.add(drain);
  }

  const outerGeo = new THREE.ExtrudeGeometry(outerShape, { depth: outerThick, bevelEnabled: false });
  applyBoxUVs(outerGeo, 0.42);
  const outerMesh = new THREE.Mesh(outerGeo, outerMaterial ?? mats.stoneWall);
  outerMesh.castShadow = true;
  outerMesh.receiveShadow = true;
  group.add(outerMesh);

  const innerGeo = new THREE.ExtrudeGeometry(innerShape, { depth: innerThick, bevelEnabled: false });
  innerGeo.translate(0, 0, outerThick);
  applyBoxUVs(innerGeo, 0.38);
  const innerMesh = new THREE.Mesh(innerGeo, mats.plaster);
  innerMesh.castShadow = true;
  innerMesh.receiveShadow = true;
  group.add(innerMesh);
  group.userData.innerMesh = innerMesh;

  return group;
}

// Build pitched roof slopes with overhang, ridge tiles, and eaves gutters
// cut: optional { x0, x1, zHalf } footprint (e.g. the belfry) that the slopes and ridge leave open
function buildPitchedRoof({ xStart, xEnd, zHalfExt, eavesY, ridgeY, overhang, mats, hasGutters = true, cut = null }) {
  const g = new THREE.Group();
  const len = xEnd - xStart;
  const run = zHalfExt + overhang;
  const rise = ridgeY - eavesY;
  const slopeLen = Math.hypot(run, rise);
  const angle = Math.atan2(rise, run);
  const thick = 0.14;

  // Full-slope pieces along x, plus (under a cut) the strip of slope between the cut's side and the eaves
  const pieces = cut
    ? [
        [xStart, cut.x0, 0],
        [cut.x0, cut.x1, cut.zHalf],
        [cut.x1, xEnd, 0]
      ]
    : [[xStart, xEnd, 0]];
  [-1, 1].forEach((side) => {
    pieces.forEach(([xa, xb, z0]) => {
      const pieceSlope = slopeLen * (1 - z0 / run);
      const slabGeo = new THREE.BoxGeometry(xb - xa, thick, pieceSlope);
      applyBoxUVs(slabGeo, 0.52);
      const slab = new THREE.Mesh(slabGeo, mats.clayRoof);
      const zMid = (z0 + run) * 0.5;
      const midY = eavesY + rise * (1 - zMid / run) + thick * 0.45;
      slab.position.set((xa + xb) * 0.5, midY, side * zMid);
      slab.rotation.x = side * angle;
      slab.castShadow = true;
      slab.receiveShadow = true;
      g.add(slab);
    });

    // Black cast-iron half-round eaves gutter
    if (hasGutters) {
      const gutter = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, len, 8, 1, false, 0, Math.PI), mats.iron);
      gutter.rotation.z = Math.PI / 2;
      gutter.rotation.x = Math.PI / 2;
      gutter.position.set((xStart + xEnd) * 0.5, eavesY - 0.06, side * (zHalfExt + overhang));
      g.add(gutter);
    }
  });

  // Clay ridge capping tiles
  const ridgeRuns = cut
    ? [
        [xStart - 0.02, cut.x0],
        [cut.x1, xEnd + 0.02]
      ]
    : [[xStart - 0.02, xEnd + 0.02]];
  ridgeRuns.forEach(([xa, xb]) => {
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, xb - xa, 8), mats.clayRoof);
    ridge.rotation.z = Math.PI / 2;
    ridge.position.set((xa + xb) * 0.5, ridgeY + 0.06, 0);
    ridge.castShadow = true;
    g.add(ridge);
  });

  return g;
}

// Build gable stone coping stones along the two pitched edges of a gable triangle
function buildGableCoping({ xPos, zHalf, eavesY, ridgeY, mats }) {
  const g = new THREE.Group();
  const rise = ridgeY - eavesY;
  const slopeLen = Math.hypot(zHalf + 0.12, rise + 0.08);
  const angle = Math.atan2(rise, zHalf);

  [-1, 1].forEach((side) => {
    const coping = addBox(
      g,
      [0.32, 0.12, slopeLen],
      mats.ashlar,
      [xPos, eavesY + rise * 0.5 + 0.08, side * (zHalf * 0.5)],
      { cast: true }
    );
    coping.rotation.x = side * angle;
  });
  return g;
}

// Build the iconic Timber Weatherboarded Bell-Turret & Oak-Shingled Broach Spire
function buildTowerAndSpire(mats) {
  const g = new THREE.Group();
  const t = DIM.tower;
  const s = t.size;
  const belfryH = t.eavesY - t.baseY;
  const hsBox = s * 0.5;

  // Square timber weatherboarded belfry: four boarded walls 10cm thick, open behind each louvre so daylight
  // and the bells' sound pass through, enclosing the bell chamber (belfry.js)
  const wallT = 0.1;
  const openings = [
    // [local hole outline in (along-wall, y)], N/S get a pointed head, E/W are square
    (along) =>
      along
        ? [
            [-0.4, t.eavesY - 1.24],
            [0.4, t.eavesY - 1.24],
            [0.4, t.eavesY - 0.6],
            [0, t.eavesY - 0.36],
            [-0.4, t.eavesY - 0.6]
          ]
        : [
            [-0.35, t.eavesY - 1.01],
            [0.35, t.eavesY - 1.01],
            [0.35, t.eavesY - 0.51],
            [-0.35, t.eavesY - 0.51]
          ]
  ];
  const belfryWalls = new THREE.Group();
  /** @type {[number, boolean][]} */ ([
    [0, true],
    [Math.PI, true],
    [Math.PI / 2, false],
    [-Math.PI / 2, false]
  ]).forEach(([rotY, northSouth]) => {
    const shape = new THREE.Shape();
    shape.moveTo(-hsBox, t.baseY);
    shape.lineTo(hsBox, t.baseY);
    shape.lineTo(hsBox, t.eavesY);
    shape.lineTo(-hsBox, t.eavesY);
    shape.closePath();
    const hole = new THREE.Path();
    openings[0](northSouth).forEach(([x, y], i) => (i === 0 ? hole.moveTo(x, y) : hole.lineTo(x, y)));
    hole.closePath();
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: wallT, bevelEnabled: false });
    // E/W walls stop short of the N/S walls' ends so the corners don't overlap
    if (!northSouth) geo.scale((s - 2 * wallT) / s, 1, 1);
    geo.translate(0, 0, hsBox - wallT);
    applyBoxUVs(geo, 0.42);
    const wall = new THREE.Mesh(geo, mats.weatherboard);
    wall.rotation.y = rotY;
    wall.position.set(t.xCenter, 0, t.zCenter);
    wall.castShadow = true;
    wall.receiveShadow = true;
    wall.userData.wideBoards1900 = true; // main.js boards it with mats.weatherboardWide in 1900
    belfryWalls.add(wall);
  });
  capSolidMasonry(belfryWalls);
  g.add(belfryWalls);
  const chamber = buildBellChamber(mats);
  capSolidMasonry(chamber.shell); // floor, ceiling & timbers stay solid as the tour camera rises through them
  capSolidMasonry(chamber.frame);
  g.add(chamber.shell);
  g.userData.bellFrame = chamber.frame;

  // Dark corner timber trim strips on belfry
  const hs = s * 0.5;
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ].forEach(([sx, sz]) => {
    const trim = addBox(g, [0.1, belfryH, 0.1], mats.darkOak, [
      t.xCenter + sx * hs,
      t.baseY + belfryH * 0.5,
      t.zCenter + sz * hs
    ]);
    trim.userData.era = 'today';
    // 1900: plain corner boards the same colour as the boarding
    const board = addBox(g, [0.1, belfryH, 0.1], mats.weatherboardWide);
    board.position.copy(trim.position);
    board.userData.era = '1900';
    board.visible = false;
  });

  // Lead flashing skirt where belfry meets the clay Nave roof
  // (a ring of four strips standing proud of the boarding, so the bell chamber floor stays clear inside)
  [-1, 1].forEach((side) => {
    addBox(g, [s + 0.18, 0.12, 0.09], mats.stoneCapDark, [t.xCenter, 5.25, t.zCenter + side * (hs + 0.045)]);
    addBox(g, [0.09, 0.12, s], mats.stoneCapDark, [t.xCenter + side * (hs + 0.045), 5.25, t.zCenter]);
  });

  // Louvered belfry windows:
  // North (-Z) and South (+Z): pointed Gothic 2-light louvered openings (IMG_3928, IMG_3932)
  [-1, 1].forEach((sideZ) => {
    const winG = new THREE.Group();

    // Pointed frame + central mullion + horizontal timber louvre slats
    [-0.44, 0, 0.44].forEach((lx) => {
      addBox(winG, [0.07, 0.72, 0.12], mats.weatherboard, [lx, -0.1, 0.03]);
    });
    for (let i = 0; i < 6; i++) {
      const slat = addBox(winG, [0.84, 0.05, 0.11], mats.weatherboard, [0, -0.36 + i * 0.12, 0.04]);
      slat.rotation.x = 0.45;
    }
    // Pointed gothic gablet trim at top of belfry window
    [-1, 1].forEach((sx) => {
      const archBar = addBox(winG, [0.56, 0.08, 0.13], mats.weatherboard, [sx * 0.22, 0.44, 0.03]);
      archBar.rotation.z = -sx * 0.68;
    });

    winG.position.set(t.xCenter, t.eavesY - 0.88, sideZ * (hs + 0.02));
    if (sideZ < 0) winG.rotation.y = Math.PI;
    winG.userData.era = 'today'; // in 1900 a single small louvre in the West wall instead
    g.add(winG);
  });

  // East (+X) and West (-X): square 2-light louvered belfry openings (IMG_3930, IMG_3934)
  [-1, 1].forEach((sideX) => {
    const winG = new THREE.Group();
    [-0.38, 0, 0.38].forEach((lx) => {
      addBox(winG, [0.06, 0.58, 0.11], mats.weatherboard, [lx, 0, 0.02]);
    });
    for (let i = 0; i < 5; i++) {
      const slat = addBox(winG, [0.74, 0.045, 0.1], mats.weatherboard, [0, -0.2 + i * 0.1, 0.03]);
      slat.rotation.x = 0.45;
    }
    winG.position.set(t.xCenter + sideX * (hs + 0.02), t.eavesY - 0.76, t.zCenter);
    winG.rotation.y = sideX > 0 ? Math.PI / 2 : -Math.PI / 2;
    winG.userData.era = 'today'; // in 1900 a single small louvre in the West wall instead
    g.add(winG);
  });

  // Belfry projecting eaves cornice
  const corniceSize = s + t.skirtOverhang * 2;
  const cornice = boxMesh([corniceSize, 0.12, corniceSize], mats.darkOak, [t.xCenter, t.eavesY, t.zCenter], {
    cast: true
  });
  cornice.userData.era = 'today'; // in 1900 the boarding ran straight up into the gables, with no cornice
  g.add(cornice);

  // Watertight flat-faceted English octagonal broach spire:
  // 4 cardinal skirt slopes + 4 triangular corner broaches meeting 8 crisp flat octagonal spire faces
  const halfEaves = corniceSize * 0.5;
  const broachY = t.skirtTopY;
  const tipY = t.spireTipY;
  const rOctBase = 0.98;
  const rOctTop = 0.086;

  const octRing = (radius, y) => {
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const ang = -Math.PI / 8 + (i * Math.PI) / 4;
      pts.push(new THREE.Vector3(Math.sin(ang) * radius, y, Math.cos(ang) * radius));
    }
    return pts;
  };

  const baseOct = octRing(rOctBase, broachY);
  const topOct = octRing(rOctTop, tipY);
  const eavesCorners = [
    new THREE.Vector3(-halfEaves, t.eavesY, halfEaves), // SW
    new THREE.Vector3(halfEaves, t.eavesY, halfEaves), // SE
    new THREE.Vector3(halfEaves, t.eavesY, -halfEaves), // NE
    new THREE.Vector3(-halfEaves, t.eavesY, -halfEaves) // NW
  ];

  const positions = [];
  const uvs = [];
  const uvScale = 0.62;

  const pushFlatTri = (a, b, c, refOrigin, horizAxis) => {
    const ab = new THREE.Vector3().subVectors(b, a);
    const ac = new THREE.Vector3().subVectors(c, a);
    const normal = new THREE.Vector3().crossVectors(ab, ac).normalize();
    const uAxis = horizAxis.clone().normalize();
    const vAxis = new THREE.Vector3().crossVectors(normal, uAxis).normalize();
    for (const p of [a, b, c]) {
      positions.push(p.x, p.y, p.z);
      const rel = new THREE.Vector3().subVectors(p, refOrigin);
      uvs.push(rel.dot(uAxis) * uvScale, rel.dot(vAxis) * uvScale);
    }
  };

  const pushFlatQuad = (a, b, c, d) => {
    const horiz = new THREE.Vector3().subVectors(b, a);
    pushFlatTri(a, b, c, a, horiz);
    pushFlatTri(a, c, d, a, horiz);
  };

  // 1. Four cardinal broach skirt trapezoids (South, East, North, West)
  for (let k = 0; k < 4; k++) {
    const c0 = eavesCorners[k];
    const c1 = eavesCorners[(k + 1) % 4];
    const v0 = baseOct[k * 2];
    const v1 = baseOct[k * 2 + 1];
    pushFlatQuad(c0, c1, v1, v0);
  }

  // 2. Four triangular diagonal corner broaches (SE, NE, NW, SW)
  for (let k = 0; k < 4; k++) {
    const corner = eavesCorners[(k + 1) % 4];
    const vLeft = baseOct[k * 2 + 1];
    const vRight = baseOct[(k * 2 + 2) % 8];
    const horiz = new THREE.Vector3().subVectors(vRight, vLeft);
    pushFlatTri(corner, vRight, vLeft, vLeft, horiz);
  }

  // 3. Eight crisp flat-faceted octagonal spire sides rising to the apex
  for (let i = 0; i < 8; i++) {
    const next = (i + 1) % 8;
    pushFlatQuad(baseOct[i], baseOct[next], topOct[next], topOct[i]);
  }

  const spireGeo = new THREE.BufferGeometry();
  spireGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  spireGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  spireGeo.computeVertexNormals();

  // The broach spire was added after 1900 ('today' era); before it the belfry had a low shingled pyramid cap
  // ('1900' era) with an iron finial. main.js shows one or the other.
  const spireG = new THREE.Group();
  spireG.userData.era = 'today';
  g.add(spireG);
  // 1900 (photo c. 1900): a low pitched roof, its ridge running East-West with weatherboarded gables at each end
  const capG = new THREE.Group();
  capG.userData.era = '1900';
  capG.visible = false;
  const rise = 0.62;
  const roofY0 = t.eavesY - 0.06; // slopes bear on the wall heads
  const halfSpan = corniceSize * 0.5 + 0.04;
  const slopeLen = Math.hypot(halfSpan, rise);
  const pitch = Math.atan2(rise, halfSpan);
  const roofLen = s + 0.36; // oversails the gables as a short barge
  [-1, 1].forEach((side) => {
    const slab = addBox(
      capG,
      [roofLen, 0.06, slopeLen],
      mats.shingles,
      [t.xCenter, roofY0 + rise * 0.5 + 0.03, t.zCenter + side * halfSpan * 0.5],
      { cast: true, receive: true }
    );
    slab.rotation.x = side * pitch;
  });
  addBox(capG, [roofLen, 0.06, 0.1], mats.weatherboard, [t.xCenter, roofY0 + rise + 0.05, t.zCenter]);
  // Gable triangles above the cornice, boarded like the walls below, with plain barge boards
  [-1, 1].forEach((sideX) => {
    const tri = new THREE.Shape();
    tri.moveTo(-hsBox, 0);
    tri.lineTo(hsBox, 0);
    tri.lineTo(0, roofY0 + rise - t.eavesY);
    tri.closePath();
    const triGeo = new THREE.ExtrudeGeometry(tri, { depth: wallT, bevelEnabled: false });
    triGeo.translate(0, 0, -wallT * 0.5);
    applyBoxUVs(triGeo, 0.42);
    const gable = new THREE.Mesh(triGeo, mats.weatherboardWide);
    gable.rotation.y = Math.PI / 2;
    gable.position.set(t.xCenter + sideX * (hsBox - wallT * 0.5), t.eavesY, t.zCenter);
    gable.castShadow = true;
    capG.add(gable);
    [-1, 1].forEach((side) => {
      const barge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, slopeLen + 0.06), mats.weatherboard);
      barge.position.set(
        t.xCenter + sideX * (roofLen * 0.5 - 0.015),
        roofY0 + rise * 0.5,
        t.zCenter + side * halfSpan * 0.5
      );
      barge.rotation.x = side * pitch;
      capG.add(barge);
    });
  });
  // Today's louvred openings were boarded over: weatherboard infill shaped to each hole
  /** @type {[number, boolean][]} */ ([
    [0, true],
    [Math.PI, true],
    [Math.PI / 2, false],
    [-Math.PI / 2, false]
  ]).forEach(([rotY, northSouth]) => {
    const fill = new THREE.Shape();
    openings[0](northSouth).forEach(([x, y], i) => (i === 0 ? fill.moveTo(x, y) : fill.lineTo(x, y)));
    fill.closePath();
    const geo = new THREE.ExtrudeGeometry(fill, { depth: wallT, bevelEnabled: false });
    if (!northSouth) geo.scale((s - 2 * wallT) / s, 1, 1);
    geo.translate(0, 0, hsBox - wallT);
    applyBoxUVs(geo, 0.42);
    const m = new THREE.Mesh(geo, mats.weatherboardWide);
    m.rotation.y = rotY;
    m.position.set(t.xCenter, 0, t.zCenter);
    capG.add(m);
  });
  // A louvre centred high in each of the East and West walls
  [-1, 1].forEach((sideX) => {
    const lw = 0.92;
    const lh = 0.72;
    const louvre = new THREE.Group();
    const back = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), new THREE.MeshBasicMaterial({ color: 0x0d0b09 }));
    back.position.z = 0.002;
    louvre.add(back);
    [
      [lw + 0.12, 0.07, 0, (lh + 0.07) * 0.5],
      [lw + 0.12, 0.07, 0, -(lh + 0.07) * 0.5],
      [0.07, lh, (lw + 0.07) * 0.5, 0],
      [0.07, lh, -(lw + 0.07) * 0.5, 0]
    ].forEach(([w, h, x, y]) => {
      addBox(louvre, [w, h, 0.06], mats.weatherboard, [x, y, 0.025]);
    });
    for (let i = 0; i < 8; i++) {
      const slat = addBox(louvre, [lw, 0.06, 0.08], mats.weatherboard, [0, -lh * 0.5 + 0.06 + i * 0.087, 0.03]);
      slat.rotation.x = 0.5;
    }
    louvre.rotation.y = sideX < 0 ? -Math.PI / 2 : Math.PI / 2;
    louvre.position.set(t.xCenter + sideX * (hsBox + 0.003), t.eavesY - 1.02, t.zCenter);
    capG.add(louvre);
  });
  g.add(capG);

  const spire = new THREE.Mesh(spireGeo, mats.shingles);
  spire.position.set(t.xCenter, 0, t.zCenter);
  spire.castShadow = true;
  spire.receiveShadow = true;
  spireG.add(spire);

  // Spire top mushroom dome cap, 4-leg wrought-iron base bracket, tall lightning spindle & pierced swallowtail banner weathervane
  const domeRim = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.092, 0.036, 16), mats.iron);
  domeRim.position.set(t.xCenter, tipY + 0.01, t.zCenter);
  spireG.add(domeRim);

  const domeCap = new THREE.Mesh(new THREE.SphereGeometry(0.126, 16, 12), mats.ashlar);
  domeCap.scale.set(1.0, 0.56, 1.0);
  domeCap.position.set(t.xCenter, tipY + 0.042, t.zCenter);
  domeCap.castShadow = true;
  spireG.add(domeCap);

  // 4 angled wrought-iron support legs rising from the dome cap to the spindle collar
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.19, 6), mats.iron);
    leg.position.set(t.xCenter + Math.cos(a) * 0.028, tipY + 0.165, t.zCenter + Math.sin(a) * 0.028);
    leg.rotation.z = Math.cos(a) * 0.24;
    leg.rotation.x = -Math.sin(a) * 0.24;
    spireG.add(leg);
  }
  const spindleCollar = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), mats.iron);
  spindleCollar.scale.set(1.0, 0.75, 1.0);
  spindleCollar.position.set(t.xCenter, tipY + 0.27, t.zCenter);
  spireG.add(spindleCollar);

  // Tall slender vertical spindle continuing above the weathervane as a sharp lightning spike
  const rodH = t.finialTopY - tipY + 0.08;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.013, rodH, 8), mats.iron);
  rod.position.set(t.xCenter, tipY + rodH * 0.5 + 0.02, t.zCenter);
  spireG.add(rod);

  // Pierced verdigris-copper swallowtail banner weathervane (matching user close-up photo)
  const vaneShape = new THREE.Shape();
  vaneShape.moveTo(-0.25, -0.115); // Bottom-left swallowtail tip
  vaneShape.lineTo(-0.145, -0.028);
  vaneShape.lineTo(-0.125, 0.0); // Inner swallowtail V-notch
  vaneShape.lineTo(-0.145, 0.028);
  vaneShape.lineTo(-0.25, 0.115); // Top-left swallowtail tip
  vaneShape.lineTo(0.072, 0.12); // Top horizontal bar across central plate
  vaneShape.lineTo(0.168, 0.032); // Upper converging pointer neck
  vaneShape.lineTo(0.192, 0.048); // Trefoil pointer upper lobe
  vaneShape.lineTo(0.222, 0.03);
  vaneShape.lineTo(0.255, 0.0); // Pointer nose tip
  vaneShape.lineTo(0.222, -0.03);
  vaneShape.lineTo(0.192, -0.048); // Trefoil pointer lower lobe
  vaneShape.lineTo(0.168, -0.032); // Lower converging pointer neck
  vaneShape.lineTo(0.072, -0.115); // Bottom horizontal bar across central plate
  vaneShape.closePath();

  // Right open cut-out between the central square plate and the converging pointer neck
  const rightHole = new THREE.Path();
  rightHole.moveTo(0.068, -0.082);
  rightHole.lineTo(0.068, 0.086);
  rightHole.lineTo(0.15, 0.018);
  rightHole.lineTo(0.15, -0.018);
  rightHole.closePath();
  vaneShape.holes.push(rightHole);

  // Upper-left & lower-left pierced swallowtail openings
  const upperTailHole = new THREE.Path();
  upperTailHole.moveTo(-0.185, 0.088);
  upperTailHole.lineTo(-0.088, 0.09);
  upperTailHole.lineTo(-0.088, 0.032);
  upperTailHole.lineTo(-0.132, 0.042);
  upperTailHole.closePath();
  vaneShape.holes.push(upperTailHole);

  const lowerTailHole = new THREE.Path();
  lowerTailHole.moveTo(-0.185, -0.088);
  lowerTailHole.lineTo(-0.132, -0.042);
  lowerTailHole.lineTo(-0.088, -0.032);
  lowerTailHole.lineTo(-0.088, -0.09);
  lowerTailHole.closePath();
  vaneShape.holes.push(lowerTailHole);

  const vaneGeo = new THREE.ExtrudeGeometry(vaneShape, { depth: 0.012, bevelEnabled: false });
  vaneGeo.translate(0, 0, -0.006);
  const vaneMat = new THREE.MeshStandardMaterial({
    color: 0x264644,
    roughness: 0.52,
    metalness: 0.62
  });
  const vane = new THREE.Mesh(vaneGeo, vaneMat);
  vane.position.set(t.xCenter, tipY + 0.68, t.zCenter);
  vane.rotation.y = 0.25;
  vane.castShadow = true;
  spireG.add(vane);

  return g;
}

// Build the complete exterior architecture + masonry shell
export function buildArchitecture(mats) {
  const wallsGroup = new THREE.Group();
  const roofGroup = new THREE.Group();
  const doorPivots = {};

  const N = DIM.nave;
  const C = DIM.chancel;
  const P = DIM.porch;
  const W = DIM.windows;

  const outerT = 0.28;
  const naveInnerT = N.wallT - outerT; // 0.42
  const chanInnerT = C.wallT - outerT; // 0.37

  // -------------------------------------------------------
  // 1. NAVE NORTH WALL (z: -3.30 to -2.60), x: -7.70 to +3.55
  //    Contains: Inner North Porch Doorway (x = -2.35) + Window 6 (x = +1.05)
  // -------------------------------------------------------
  const northDoorSpec = {
    sillY: DIM.porchFloorY,
    width: P.innerDoorW,
    springY: P.innerDoorSpringY,
    apexY: P.innerDoorApexY,
    type: 'door-arch'
  };
  const eastNaveOuterThick = 0.2;
  const naveOuterX0 = N.xWestExt + outerT; // Clean butt-joint against West gable outer leaf
  const naveOuterX1 = N.xEastExt - eastNaveOuterThick; // Clean butt-joint against Nave East gable outer leaf

  const naveNorthWall = buildCompositeWall({
    outerOutlinePts: [
      [naveOuterX0, 0],
      [naveOuterX1, 0],
      [naveOuterX1, N.eavesY],
      [naveOuterX0, N.eavesY]
    ],
    innerOutlinePts: [
      [N.xWestInt, 0],
      [N.xEastInt, 0],
      [N.xEastInt, N.eavesY],
      [N.xWestInt, N.eavesY]
    ],
    outerThick: outerT,
    innerThick: naveInnerT,
    openings: [
      { u: P.xCenter, spec: northDoorSpec, isDoor: true, splayW: 0.12, splayTop: 0.1, splayBot: 0 },
      { u: W.w6.x, spec: W.w6, splayW: 0.22, splayTop: 0.14, splayBot: 0.02 }
    ],
    mats
  });
  naveNorthWall.position.set(0, 0, N.zNorthExt);
  wallsGroup.add(naveNorthWall);

  // -------------------------------------------------------
  // 2. NAVE SOUTH WALL (z: +3.30 inward to +2.60), x: -7.70 to +3.55
  //    Contains: Window 4 ("Sower" Window at x = +0.45)
  // -------------------------------------------------------
  // Build in local space where +Z goes inward (North = -worldZ), then rotateY(PI)
  const naveSouthWall = buildCompositeWall({
    outerOutlinePts: [
      [-naveOuterX1, 0],
      [-naveOuterX0, 0],
      [-naveOuterX0, N.eavesY],
      [-naveOuterX1, N.eavesY]
    ],
    innerOutlinePts: [
      [-N.xEastInt, 0],
      [-N.xWestInt, 0],
      [-N.xWestInt, N.eavesY],
      [-N.xEastInt, N.eavesY]
    ],
    outerThick: outerT,
    innerThick: naveInnerT,
    openings: [{ u: -W.w4.x, spec: W.w4, splayW: 0.28, splayTop: 0.24, splayBot: 0.04 }],
    mats
  });
  naveSouthWall.rotation.y = Math.PI;
  naveSouthWall.position.set(0, 0, N.zSouthExt);
  wallsGroup.add(naveSouthWall);

  // Authentic blocked Norman/Medieval arched South Doorway outline in stone (seen in IMG_3932 & IMG_3933!)
  const blockedArchG = new THREE.Group();
  addBox(blockedArchG, [1.06, 1.85, 0.05], mats.stoneWall, [-3.15, 0.92, N.zSouthExt + 0.01]);
  const blockedVoussoir = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.09, 6, 14, Math.PI), mats.ashlarWarm);
  blockedVoussoir.position.set(-3.15, 1.48, N.zSouthExt + 0.02);
  blockedArchG.add(blockedVoussoir);
  wallsGroup.add(blockedArchG);

  // -------------------------------------------------------
  // 3. WEST GABLE WALL (x: -7.70 inward to -7.00), z: -3.30 to +3.30
  //    Contains: Window 5 (deeply splayed lancet at z = 0)
  //    Historic half-hip build line at y = 4.42m (west-gable.jpg & IMG_3934):
  //    darker weathered medieval rubble below vs paler coursed sandy-buff 1909 infill above
  // -------------------------------------------------------
  const halfHipY = 4.42;
  const halfHipFrac = (halfHipY - N.eavesY) / (N.ridgeY - N.eavesY);
  const halfHipZ = N.zSouthExt * (1 - halfHipFrac);

  const westWall = buildCompositeWall({
    outerOutlinePts: [
      [-N.zSouthExt, 0],
      [N.zSouthExt, 0],
      [N.zSouthExt, N.eavesY],
      [halfHipZ, halfHipY],
      [-halfHipZ, halfHipY],
      [-N.zSouthExt, N.eavesY]
    ],
    innerOutlinePts: [
      [-N.zSouthInt, 0],
      [N.zSouthInt, 0],
      [N.zSouthInt, N.eavesY],
      [0, N.ridgeY - 0.18],
      [-N.zSouthInt, N.eavesY]
    ],
    outerMaterial: mats.stoneWallWestLower,
    outerThick: outerT,
    innerThick: naveInnerT,
    openings: [{ u: 0, spec: W.w5, splayW: 0.42, splayTop: 0.44, splayBot: 0.08 }],
    mats
  });

  // Upper triangular 1909 gable infill masonry above the former half-hip line (west-gable.jpg)
  const westUpperShape = new THREE.Shape();
  westUpperShape.moveTo(-halfHipZ, halfHipY);
  westUpperShape.lineTo(halfHipZ, halfHipY);
  westUpperShape.lineTo(0, N.ridgeY);
  westUpperShape.closePath();
  const westUpperGeo = new THREE.ExtrudeGeometry(westUpperShape, { depth: outerT, bevelEnabled: false });
  applyBoxUVs(westUpperGeo, 0.48);
  const westUpperMesh = new THREE.Mesh(westUpperGeo, mats.stoneWallWestUpper);
  westUpperMesh.castShadow = true;
  westUpperMesh.receiveShadow = true;
  westUpperMesh.userData.era = 'today'; // 1909 rebuild: in 1900 the gable was half-hipped above y = 4.42
  westWall.add(westUpperMesh);

  // Subtle pale dressed limestone apex triangle & South-verge shoulder stone visible in west-gable.jpg
  const apexH = 0.34;
  const apexHW = halfHipZ * (apexH / (N.ridgeY - halfHipY));
  const apexShape = new THREE.Shape();
  apexShape.moveTo(-apexHW, N.ridgeY - apexH);
  apexShape.lineTo(apexHW, N.ridgeY - apexH);
  apexShape.lineTo(0, N.ridgeY);
  apexShape.closePath();
  const apexGeo = new THREE.ExtrudeGeometry(apexShape, { depth: 0.014, bevelEnabled: false });
  apexGeo.translate(0, 0, -0.008);
  applyBoxUVs(apexGeo, 0.7);
  const apexStone = new THREE.Mesh(apexGeo, mats.ashlarWarm);
  apexStone.userData.era = 'today'; // 1909 rebuild: in 1900 the gable was half-hipped above y = 4.42
  westWall.add(apexStone);

  const slopeHalfZ = (y) => N.zSouthExt * (1 - (y - N.eavesY) / (N.ridgeY - N.eavesY));
  const shY0 = halfHipY + (N.ridgeY - halfHipY) * 0.34;
  const shY1 = shY0 + 0.34;
  const shoulderShape = new THREE.Shape();
  shoulderShape.moveTo(-slopeHalfZ(shY0) + 0.02, shY0);
  shoulderShape.lineTo(-slopeHalfZ(shY0) + 0.32, shY0);
  shoulderShape.lineTo(-slopeHalfZ(shY0) + 0.32, shY1);
  shoulderShape.lineTo(-slopeHalfZ(shY1) + 0.02, shY1);
  shoulderShape.closePath();
  const shoulderGeo = new THREE.ExtrudeGeometry(shoulderShape, { depth: 0.014, bevelEnabled: false });
  shoulderGeo.translate(0, 0, -0.008);
  applyBoxUVs(shoulderGeo, 0.7);
  const shoulderStone = new THREE.Mesh(shoulderGeo, mats.ashlarWarm);
  shoulderStone.userData.era = 'today'; // 1909 rebuild: in 1900 the gable was half-hipped above y = 4.42
  westWall.add(shoulderStone);

  // In 1900 the plaster inner leaf stopped under the half hip too: main.js clips it along the hip's plane
  const westInner = westWall.userData.innerMesh;
  westInner.material = westInner.material.clone();
  westInner.material.clipShadows = true;
  westInner.userData.clipIn1900 = true;

  westWall.rotation.y = Math.PI / 2;
  westWall.position.set(N.xWestExt, 0, 0);
  wallsGroup.add(westWall);
  const westCoping = buildGableCoping({
    xPos: N.xWestExt + 0.14,
    zHalf: N.zSouthExt,
    eavesY: N.eavesY,
    ridgeY: N.ridgeY,
    mats
  });
  westCoping.userData.era = 'today';
  wallsGroup.add(westCoping);
  // 1900: the West end was half-hipped (jerkinhead): a tiled hip from the old wall head up to the ridge
  const halfHip = buildHalfHip(N, halfHipY, mats);
  roofGroup.add(halfHip);
  roofGroup.userData.halfHipClipPlane = halfHip.userData.clipPlane;

  // -------------------------------------------------------
  // 4. NAVE EAST GABLE / CHANCEL ARCH WALL (x: 3.20 to 3.55)
  //    Closes the step-in from Nave width (6.6m) to Chancel width (5.3m)
  //    and fills the gable spandrel above the Chancel barrel arch!
  // -------------------------------------------------------
  const eastNaveWallShape = new THREE.Shape();
  eastNaveWallShape.moveTo(-N.zSouthExt, 0);
  eastNaveWallShape.lineTo(N.zSouthExt, 0);
  eastNaveWallShape.lineTo(N.zSouthExt, N.eavesY);
  eastNaveWallShape.lineTo(0, N.ridgeY);
  eastNaveWallShape.lineTo(-N.zSouthExt, N.eavesY);
  eastNaveWallShape.closePath();

  // Wide barrel-arched Chancel opening matching the Chancel interior (z: -2.0 to +2.0, springY: 2.88, crown: 4.72).
  // Below the eaves the hole is cut out to the back of the Chancel side walls' plaster lining (|z| = 2.37), so that
  // lining runs on uninterrupted through the gable thickness (x: 3.20 to 3.55). Otherwise the hole's side faces
  // (stone outer leaf + plaster inner leaf) sit exactly on the Chancel plaster face and z-fight beside the rood screen.
  const chancelLiningZ = C.zSouthExt - outerT;
  const chancelOpenHole = new THREE.Path();
  chancelOpenHole.moveTo(-chancelLiningZ, 0);
  chancelOpenHole.lineTo(chancelLiningZ, 0);
  chancelOpenHole.lineTo(chancelLiningZ, C.eavesY);
  chancelOpenHole.lineTo(C.zSouthInt, C.eavesY);
  const archSegs = 20;
  for (let i = 0; i <= archSegs; i++) {
    const a = (i / archSegs) * Math.PI;
    const u = Math.cos(a) * C.zSouthInt;
    const v = C.eavesY + Math.sin(a) * 1.88;
    chancelOpenHole.lineTo(u, v);
  }
  chancelOpenHole.lineTo(-chancelLiningZ, C.eavesY);
  chancelOpenHole.closePath();
  eastNaveWallShape.holes.push(chancelOpenHole);

  const eastNaveOuterGeo = new THREE.ExtrudeGeometry(eastNaveWallShape, {
    depth: eastNaveOuterThick,
    bevelEnabled: false
  });
  applyBoxUVs(eastNaveOuterGeo, 0.42);
  const eastNaveOuter = new THREE.Mesh(eastNaveOuterGeo, mats.stoneWall);
  eastNaveOuter.rotation.y = -Math.PI / 2;
  eastNaveOuter.position.set(N.xEastExt, 0, 0);
  eastNaveOuter.castShadow = true;
  eastNaveOuter.receiveShadow = true;
  wallsGroup.add(eastNaveOuter);

  // The plaster leaf is open right across to the nave's South wall below the chancel eaves: the rood screen runs on
  // to meet that wall, with no return of the chancel arch wall beside it. Traced as one outline round the solid.
  const eastNaveInnerShape = new THREE.Shape();
  eastNaveInnerShape.moveTo(-N.zSouthInt, 0);
  eastNaveInnerShape.lineTo(-chancelLiningZ, 0);
  eastNaveInnerShape.lineTo(-chancelLiningZ, C.eavesY);
  for (let i = archSegs; i >= 0; i--) {
    const a = (i / archSegs) * Math.PI;
    eastNaveInnerShape.lineTo(Math.cos(a) * C.zSouthInt, C.eavesY + Math.sin(a) * 1.88);
  }
  eastNaveInnerShape.lineTo(N.zSouthInt, C.eavesY);
  eastNaveInnerShape.lineTo(N.zSouthInt, N.eavesY);
  eastNaveInnerShape.lineTo(0, N.ridgeY - 0.18);
  eastNaveInnerShape.lineTo(-N.zSouthInt, N.eavesY);
  eastNaveInnerShape.closePath();

  const eastNaveInnerGeo = new THREE.ExtrudeGeometry(eastNaveInnerShape, {
    depth: N.xEastExt - eastNaveOuterThick - N.xEastInt,
    bevelEnabled: false
  });
  applyBoxUVs(eastNaveInnerGeo, 0.38);
  const eastNaveInner = new THREE.Mesh(eastNaveInnerGeo, mats.plaster);
  eastNaveInner.rotation.y = -Math.PI / 2;
  eastNaveInner.position.set(N.xEastExt - eastNaveOuterThick, 0, 0);
  eastNaveInner.receiveShadow = true;
  wallsGroup.add(eastNaveInner);

  // -------------------------------------------------------
  // 5. CHANCEL NORTH WALL (z: -2.65 to -2.00), x: 3.55 to 9.42 (clean butt-joints at both ends)
  //    Contains: Window 7 (x = 4.65) and Window 8 (x = 7.25)
  // -------------------------------------------------------
  const chanOuterX0 = N.xEastExt;
  const chanOuterX1 = C.xEastExt - outerT;

  const chancelReliefs = createChancelReliefHeightMaps();
  // The reliefs are cut in the same warm dressed stone as the window surround they sit in
  const reliefMat = mats.ashlarWarm.clone();
  reliefMat.vertexColors = true;
  const chanNorthWall = buildCompositeWall({
    outerOutlinePts: [
      [chanOuterX0, 0],
      [chanOuterX1, 0],
      [chanOuterX1, C.eavesY],
      [chanOuterX0, C.eavesY]
    ],
    innerOutlinePts: [
      [C.xWestInt, 0],
      [C.xEastInt, 0],
      [C.xEastInt, C.eavesY],
      [C.xWestInt, C.eavesY]
    ],
    outerThick: outerT,
    innerThick: chanInnerT,
    openings: [
      {
        u: W.w7.x,
        spec: W.w7,
        splayW: 0.16,
        splayTop: 0.16,
        splayBot: 0.04,
        // A tall narrow lancet whose splayed stone embrasure runs down below the glass to a stone seat; the
        // medieval reliefs are carved into the embrasure's jambs just above the seat (close-up photographs;
        // Taunt & Co. 3017/3018): the Crucifixion on the West jamb, St Christopher on the East jamb
        seat: {
          y0: DIM.chancelFloorY + 0.48,
          carvedJambs: {
            y: [DIM.chancelFloorY + 0.6, DIM.chancelFloorY + 1.02],
            depth: 0.026,
            panels: [
              { side: -1, canvas: chancelReliefs.crucifixion, material: reliefMat },
              { side: 1, canvas: chancelReliefs.stChristopher, material: reliefMat }
            ]
          }
        }
      },
      { u: W.w8.x, spec: W.w8, splayW: 0.24, splayTop: 0.22, splayBot: 0.04 }
    ],
    mats
  });
  chanNorthWall.position.set(0, 0, C.zNorthExt);
  wallsGroup.add(chanNorthWall);

  // -------------------------------------------------------
  // 6. CHANCEL SOUTH WALL (z: +2.65 inward to +2.00), x: 3.55 to 9.42
  //    Contains: Window 3 (tall slim Wilson memorial lancet, x = 4.55) + Window 2 (x = 7.35)
  // -------------------------------------------------------
  const chanSouthWall = buildCompositeWall({
    outerOutlinePts: [
      [-chanOuterX1, 0],
      [-chanOuterX0, 0],
      [-chanOuterX0, C.eavesY],
      [-chanOuterX1, C.eavesY]
    ],
    // The plaster lining stops just behind the rood screen's South end, which now runs on to the nave's South wall
    innerOutlinePts: [
      [-C.xEastInt, 0],
      [-(C.xWestInt + 0.2), 0],
      [-(C.xWestInt + 0.2), C.eavesY],
      [-C.xEastInt, C.eavesY]
    ],
    outerThick: outerT,
    innerThick: chanInnerT,
    openings: [
      { u: -W.w3.x, spec: W.w3, splayW: 0.18, splayTop: 0.18, splayBot: 0.02 },
      // Window 2, beside the piscina, also has a stone seat in its embrasure
      { u: -W.w2.x, spec: W.w2, splayW: 0.24, splayTop: 0.24, splayBot: 0.04, seat: { y0: DIM.sanctuaryStep1Y + 0.44 } }
    ],
    // Piscina: small pointed niche with a drain bowl, between Window 2 and the altar
    niches: [
      {
        u: -8.17,
        spec: {
          sillY: DIM.sanctuaryStep2Y + 0.84,
          width: 0.3,
          springY: DIM.sanctuaryStep2Y + 1.16,
          apexY: DIM.sanctuaryStep2Y + 1.32
        },
        depth: 0.22
      }
    ],
    mats
  });
  chanSouthWall.rotation.y = Math.PI;
  chanSouthWall.position.set(0, 0, C.zSouthExt);
  wallsGroup.add(chanSouthWall);

  // -------------------------------------------------------
  // 7. CHANCEL EAST GABLE WALL (x: 9.70 inward to 9.00), z: -2.65 to +2.65
  //    Contains: Window 1 (2-light Gothic stained-glass East Window)
  // -------------------------------------------------------
  // The plaster leaf's gable top must clear the chancel's barrel vault (rise 0.94 x half-span) where it meets
  // the east wall; a plain triangle dips below the vault's haunches and leaves the roof tiles visible above the altar.
  function chancelEastInnerOutline() {
    const gableTop = C.ridgeY - 0.18;
    const vaultRise = C.zSouthInt * 0.94 + 0.12;
    const top = [];
    const segs = 24;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI;
      const z = Math.cos(a) * C.zSouthInt;
      const arcY = C.eavesY + Math.sin(a) * vaultRise;
      const gableY = C.eavesY + (1 - Math.abs(z) / C.zSouthInt) * (gableTop - C.eavesY);
      top.push([z, Math.max(arcY, gableY)]);
    }
    return [[-C.zSouthInt, 0], [C.zSouthInt, 0], ...top];
  }
  const eastWall = buildCompositeWall({
    outerOutlinePts: [
      [-C.zSouthExt, 0],
      [C.zSouthExt, 0],
      [C.zSouthExt, C.eavesY],
      [0, C.ridgeY],
      [-C.zSouthExt, C.eavesY]
    ],
    innerOutlinePts: chancelEastInnerOutline(),
    outerThick: outerT,
    innerThick: 0.42,
    openings: [{ u: 0, spec: W.w1, splayW: 0.3, splayTop: 0.28, splayBot: 0.04 }],
    mats
  });
  eastWall.rotation.y = -Math.PI / 2;
  eastWall.position.set(C.xEastExt, 0, 0);
  wallsGroup.add(eastWall);

  // East gable stone coping + stone cross at apex (IMG_3930, IMG_3931)
  wallsGroup.add(
    buildGableCoping({
      xPos: C.xEastExt - 0.12,
      zHalf: C.zSouthExt,
      eavesY: C.eavesY,
      ridgeY: C.ridgeY,
      mats
    })
  );
  const eastCross = buildGableCross(1.0, mats);
  eastCross.position.set(C.xEastExt - 0.12, C.ridgeY + 0.05, 0);
  eastCross.rotation.y = Math.PI / 2;
  wallsGroup.add(eastCross);

  // Corner ashlar quoins on East & West corners (projecting uniformly 1.8cm proud of both exterior faces)
  const addCornerQuoins = (cornerX, cornerZ, sx, sz, height, carved = null) => {
    const count = Math.floor(height / 0.34);
    const proud = 0.018;
    for (let i = 0; i < count; i++) {
      const longX = i % 2 === 0;
      const qx = longX ? 0.36 : 0.22;
      const qz = longX ? 0.22 : 0.36;
      const q =
        carved?.index === i
          ? buildBenchmarkQuoin(qx, 0.3, qz, mats.ashlar, carved.mark)
          : new THREE.Mesh(new THREE.BoxGeometry(qx, 0.3, qz), mats.ashlar);
      q.position.set(cornerX + sx * (proud - qx * 0.5), 0.18 + i * 0.34, cornerZ + sz * (proud - qz * 0.5));
      q.castShadow = true;
      q.receiveShadow = true;
      wallsGroup.add(q);
    }
  };
  addCornerQuoins(C.xEastExt, C.zNorthExt, 1, -1, C.eavesY - 0.1);
  addCornerQuoins(C.xEastExt, C.zSouthExt, 1, 1, C.eavesY - 0.1);
  // The West face of the second quoin up at the NW corner carries an Ordnance Survey cut benchmark, its bar about
  // 60cm above the ground and its drilled hole towards the corner
  addCornerQuoins(N.xWestExt, N.zNorthExt, -1, -1, N.eavesY - 0.1, { index: 1, mark: { u: -0.02, v: 0.08 } });
  addCornerQuoins(N.xWestExt, N.zSouthExt, -1, 1, N.eavesY - 0.1);

  // B6: 1860 Commemoration stone tablet set into lower NE Chancel wall (IMG_3930 / B6.md)
  const b6Group = new THREE.Group();
  b6Group.name = 'memorial-B6';
  b6Group.position.set(C.xEastExt - 0.52, 0.62, C.zNorthExt);
  b6Group.userData.memorialFocus = {
    id: 'B6',
    localTarget: [0, 0, -0.043],
    localCam: [0, 0.08, -1.25]
  };
  addBox(b6Group, [0.58, 0.68, 0.045], mats.ashlarWarm, [0, 0, -0.018]);
  const nePlaqueFace = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.66), mats.dedicationStone1860);
  nePlaqueFace.position.set(0, 0, -0.043);
  nePlaqueFace.rotation.y = Math.PI;
  b6Group.add(nePlaqueFace);
  wallsGroup.add(b6Group);

  // -------------------------------------------------------
  // 8. NORTH PORCH (x: -3.80 to -0.90, z: -5.45 to -3.30)
  //    Matching IMG_3928, IMG_3929, IMG_3935
  // -------------------------------------------------------
  const porchGroup = new THREE.Group();
  const pHalfW = P.widthExt * 0.5;
  const pLen = P.zSouth - P.zNorthExt; // 2.15m

  // Porch East & West rubble side walls (butt-jointed cleanly between Porch front wall and Nave North wall)
  const pSideLen = pLen - P.wallT;
  [-1, 1].forEach((side) => {
    const swGeo = new THREE.BoxGeometry(P.wallT, P.eavesY, pSideLen);
    applyBoxUVs(swGeo, 0.45);
    const sw = new THREE.Mesh(swGeo, mats.stoneWall);
    sw.position.set(
      P.xCenter + side * (pHalfW - P.wallT * 0.5),
      P.eavesY * 0.5,
      P.zNorthExt + P.wallT + pSideLen * 0.5
    );
    sw.castShadow = true;
    sw.receiveShadow = true;
    porchGroup.add(sw);
  });

  // Porch North Gable front wall with pointed stone archway
  const outerArchSpec = {
    sillY: 0.0,
    width: P.outerArchW,
    springY: P.outerArchSpringY,
    apexY: P.outerArchApexY,
    type: 'porch-arch'
  };
  const porchFrontShape = new THREE.Shape();
  porchFrontShape.moveTo(-pHalfW, 0);
  porchFrontShape.lineTo(pHalfW, 0);
  porchFrontShape.lineTo(pHalfW, P.eavesY);
  porchFrontShape.lineTo(0, P.ridgeY);
  porchFrontShape.lineTo(-pHalfW, P.eavesY);
  porchFrontShape.closePath();

  const outerArchPts = sampleOpeningPoints(outerArchSpec, 0, 0, 0);
  porchFrontShape.holes.push(makeOpeningHole(0, outerArchPts));

  const porchFrontGeo = new THREE.ExtrudeGeometry(porchFrontShape, { depth: P.wallT, bevelEnabled: false });
  applyBoxUVs(porchFrontGeo, 0.45);
  const porchFront = new THREE.Mesh(porchFrontGeo, mats.stoneWall);
  porchFront.position.set(P.xCenter, 0, P.zNorthExt);
  porchFront.castShadow = true;
  porchFront.receiveShadow = true;
  porchGroup.add(porchFront);

  // Dressed limestone arch reveal inside Porch outer archway
  // Inset 4mm so it lies just in front of the porch wall's own hole faces rather than on them
  const porchArchJambPts = sampleOpeningPoints(outerArchSpec, -0.004, -0.004, -0.004);
  const porchArchReveal = buildRevealTunnel(0, porchArchJambPts, 0, porchArchJambPts, P.wallT, mats.ashlarWarm, 0.55);
  porchArchReveal.position.set(P.xCenter, 0, P.zNorthExt);
  porchGroup.add(porchArchReveal);

  // Porch North Gable coping & small stone gable cross (IMG_3928)
  const porchRise = P.ridgeY - P.eavesY;
  const porchSlopeLen = Math.hypot(pHalfW + 0.12, porchRise + 0.08);
  const porchAngle = Math.atan2(porchRise, pHalfW);
  [-1, 1].forEach((side) => {
    const coping = addBox(porchGroup, [porchSlopeLen, 0.1, 0.28], mats.ashlar, [
      P.xCenter + side * (pHalfW * 0.5),
      P.eavesY + porchRise * 0.5 + 0.06,
      P.zNorthExt + 0.14
    ]);
    coping.rotation.z = -side * porchAngle;
  });
  const porchCross = buildGableCross(0.72, mats);
  porchCross.position.set(P.xCenter, P.ridgeY + 0.04, P.zNorthExt + 0.12);
  porchGroup.add(porchCross);

  // Hanging iron porch lantern above outer arch apex (IMG_3928)
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.22, 6), mats.iron);
  lantern.position.set(P.xCenter, P.outerArchApexY + 0.24, P.zNorthExt - 0.1);
  lantern.userData.era = 'today'; // electric: no porch light in 1900
  porchGroup.add(lantern);
  const lanternBulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), mats.glassShade);
  lanternBulb.position.set(P.xCenter, P.outerArchApexY + 0.22, P.zNorthExt - 0.1);
  lanternBulb.userData.era = 'today';
  porchGroup.add(lanternBulb);

  // Grey-painted Double Gothic Wooden Picket Gates inside Porch arch (IMG_3928, IMG_3935)
  const buildPorchGateLeaf = (isRight) => {
    const pivot = new THREE.Group();
    const leafW = P.outerArchW * 0.48;
    const sign = isRight ? -1 : 1;
    // Vertical rails & gothic trefoil pickets
    addBox(pivot, [leafW, 0.07, 0.05], mats.porchGateGrey, [sign * leafW * 0.5, 1.05, 0]);
    addBox(pivot, [leafW, 0.08, 0.05], mats.porchGateGrey, [sign * leafW * 0.5, 0.12, 0]);

    for (let i = 0; i < 4; i++) {
      const px = sign * (0.07 + i * ((leafW - 0.14) / 3));
      addBox(pivot, [0.055, 1.02, 0.04], mats.porchGateGrey, [px, 0.58, 0], { cast: true });
    }
    pivot.position.set(P.xCenter - sign * (P.outerArchW * 0.49), DIM.porchFloorY, P.zNorthExt + 0.22);
    return pivot;
  };
  doorPivots.gateLeft = buildPorchGateLeaf(false);
  doorPivots.gateRight = buildPorchGateLeaf(true);
  porchGroup.add(doorPivots.gateLeft, doorPivots.gateRight);

  // Inner Porch Doorway: Golden ashlar gothic surround with moulded imposts (IMG_3935!)
  const innerDoorPts = sampleOpeningPoints(northDoorSpec, 0, 0, 0);
  const innerSurrOuter = sampleOpeningPoints(northDoorSpec, 0.16, 0.16, 0);
  const innerSurrShape = new THREE.Shape();
  innerSurrShape.moveTo(innerSurrOuter[0][0], innerSurrOuter[0][1]);
  for (let i = 1; i < innerSurrOuter.length; i++) innerSurrShape.lineTo(innerSurrOuter[i][0], innerSurrOuter[i][1]);
  innerSurrShape.closePath();
  innerSurrShape.holes.push(makeOpeningHole(0, innerDoorPts));
  // Stands 8cm proud of the Nave north wall and stops at its face: its hole shares the doorway outline, so any
  // depth inside the wall would put its ashlar jambs on top of the wall's stone jambs (z-fighting).
  const innerSurrProud = 0.08;
  const innerSurrGeo = new THREE.ExtrudeGeometry(innerSurrShape, { depth: innerSurrProud, bevelEnabled: false });
  applyBoxUVs(innerSurrGeo, 0.7);
  const innerSurr = new THREE.Mesh(innerSurrGeo, mats.ashlarWarm);
  innerSurr.position.set(P.xCenter, 0, P.zSouth - innerSurrProud);
  porchGroup.add(innerSurr);

  // Moulded stone impost capitals at springline of inner door (IMG_3935)
  [-1, 1].forEach((side) => {
    addBox(porchGroup, [0.28, 0.09, 0.22], mats.ashlarWarm, [
      P.xCenter + side * (P.innerDoorW * 0.5 + 0.09),
      P.innerDoorSpringY,
      P.zSouth - 0.04
    ]);
  });

  // Inner Arched Oak Church Door (solid dark plank oak on both porch and Nave sides with horizontal ledges & ironwork)
  const doorPivot = new THREE.Group();
  const dShape = new THREE.Shape();
  const dPts = sampleOpeningPoints(
    {
      sillY: 0,
      width: P.innerDoorW - 0.03,
      springY: P.innerDoorSpringY - DIM.porchFloorY,
      apexY: P.innerDoorApexY - DIM.porchFloorY,
      type: 'door'
    },
    0,
    0,
    0
  );
  dShape.moveTo(dPts[0][0] + P.innerDoorW * 0.5, dPts[0][1]);
  for (let i = 1; i < dPts.length; i++) dShape.lineTo(dPts[i][0] + P.innerDoorW * 0.5, dPts[i][1]);
  dShape.closePath();

  const extDoorGeo = new THREE.ExtrudeGeometry(dShape, { depth: 0.04, bevelEnabled: false });
  applyBoxUVs(extDoorGeo, 0.8);
  const extDoor = new THREE.Mesh(extDoorGeo, mats.darkOak);
  extDoor.castShadow = true;
  doorPivot.add(extDoor);

  const intDoorGeo = new THREE.ExtrudeGeometry(dShape, { depth: 0.035, bevelEnabled: false });
  intDoorGeo.translate(0, 0, 0.04);
  applyBoxUVs(intDoorGeo, 0.8);
  const intDoor = new THREE.Mesh(intDoorGeo, mats.darkOak);
  intDoor.receiveShadow = true;
  doorPivot.add(intDoor);

  // Horizontal oak ledge battens & iron latch box on the interior (Nave) face of the wooden door
  [0.36, 0.92, 1.44].forEach((ly) => {
    addBox(doorPivot, [P.innerDoorW - 0.14, 0.085, 0.024], mats.medOak, [P.innerDoorW * 0.5 - 0.015, ly, 0.085]);
  });
  addBox(doorPivot, [0.16, 0.11, 0.03], mats.iron, [P.innerDoorW - 0.18, 0.98, 0.088]);

  // Wrought-iron strap hinges & ring latch on exterior porch face (IMG_3935)
  [0.42, 1.38].forEach((hy) => {
    addBox(doorPivot, [0.76, 0.06, 0.02], mats.iron, [0.42, hy, -0.01]);
  });
  const ringHandle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 16), mats.iron);
  ringHandle.position.set(P.innerDoorW - 0.16, 1.02, -0.03);
  doorPivot.add(ringHandle);

  // Hinge on the East jamb so door swings inward into the Nave
  doorPivot.position.set(P.xCenter - P.innerDoorW * 0.5, DIM.porchFloorY, P.zSouth + 0.18);
  doorPivots.mainDoor = doorPivot;
  porchGroup.add(doorPivot);

  // Porch interior diagonal quarry tile floor (IMG_3935)
  // Stops just short of the Nave north wall so it never overlaps the doorway reveal floor (no Z-fighting)
  const porchFloorNorth = P.zNorthExt - 0.05;
  const porchFloorSouth = P.zSouth - 0.02;
  const porchFloorGeo = new THREE.PlaneGeometry(P.widthInt + 0.2, porchFloorSouth - porchFloorNorth);
  porchFloorGeo.rotateX(-Math.PI / 2);
  applyBoxUVs(porchFloorGeo, 0.72);
  const porchFloor = new THREE.Mesh(porchFloorGeo, mats.quarryTile);
  porchFloor.position.set(P.xCenter, DIM.porchFloorY, (porchFloorNorth + porchFloorSouth) * 0.5);
  porchFloor.receiveShadow = true;
  porchGroup.add(porchFloor);

  // Solid limestone threshold hearth through the full depth of the North doorway.
  // Its top sits clearly above the porch floor & the coplanar wall-hole/reveal bottoms (y = porchFloorY),
  // and slightly below the Nave floor, and it is wider than the splayed reveal so its sides hide inside the wall.
  const hearthTopY = DIM.porchFloorY + 0.026;
  const hearthNorthZ = P.zSouth - 0.05;
  const hearthSouthZ = DIM.nave.zNorthInt - 0.02;
  const hearthGeo = new THREE.BoxGeometry(P.innerDoorW + 0.38, hearthTopY, hearthSouthZ - hearthNorthZ);
  applyBoxUVs(hearthGeo, 0.7);
  const hearth = new THREE.Mesh(hearthGeo, mats.ashlarWarm);
  hearth.position.set(P.xCenter, hearthTopY * 0.5, (hearthNorthZ + hearthSouthZ) * 0.5);
  hearth.receiveShadow = true;
  porchGroup.add(hearth);

  // Porch interior noticeboards on East and West side walls (IMG_3935)
  [-1, 1].forEach((side) => {
    addBox(porchGroup, [0.04, 0.72, 0.88], mats.darkOak, [
      P.xCenter + side * (P.widthInt * 0.5 - 0.03),
      1.38,
      P.zNorthExt + 1.15
    ]);
    // White paper notices pinned to board
    for (let p = 0; p < 3; p++) {
      const note = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.2), mats.wax);
      note.position.set(
        P.xCenter + side * (P.widthInt * 0.5 - 0.04),
        1.44 + (p % 2) * 0.12 - 0.08,
        P.zNorthExt + 0.88 + p * 0.26
      );
      porchGroup.add(note);
    }
  });

  wallsGroup.add(porchGroup);

  // Porch pitched roof of stone slates (old photo) — exact geometric trapezoid per slope so it meets the Nave roof
  // seamlessly on the exterior WITHOUT ever clipping inside the Nave North plaster wall!
  const porchRoofHalf = pHalfW + 0.16;
  const zNorthRoof = P.zNorthExt - 0.1;
  const zValleyEaves = P.zSouth + 0.04; // Stops right at Nave outer stone wall (-3.26), well outside zNorthInt (-2.60)
  const zValleyRidge = -2.74; // Intersects outer Nave roof slope at y = 3.92, still outside zNorthInt (-2.60)
  const thick = 0.12;

  [-1, 1].forEach((side) => {
    const xEaves = P.xCenter + side * porchRoofHalf;
    const xRidge = P.xCenter;
    const yEaves = P.eavesY + 0.04;
    const yRidge = P.ridgeY + 0.04;

    // 4 top corners & 4 bottom corners of sloped roof trapezoid
    const topPts = [
      [xEaves, yEaves + thick, zNorthRoof],
      [xRidge, yRidge + thick, zNorthRoof],
      [xRidge, yRidge + thick, zValleyRidge],
      [xEaves, yEaves + thick, zValleyEaves]
    ];
    const botPts = [
      [xEaves, yEaves, zNorthRoof],
      [xRidge, yRidge, zNorthRoof],
      [xRidge, yRidge, zValleyRidge],
      [xEaves, yEaves, zValleyEaves]
    ];
    const posArr = [];
    const pushQuad = (a, b, c, d) => posArr.push(...a, ...b, ...c, ...a, ...c, ...d);
    if (side > 0) {
      pushQuad(topPts[0], topPts[1], topPts[2], topPts[3]); // Top face
      pushQuad(botPts[3], botPts[2], botPts[1], botPts[0]); // Bottom soffit
      pushQuad(botPts[0], topPts[0], topPts[3], botPts[3]); // Eaves fascia
      pushQuad(botPts[1], botPts[0], topPts[0], topPts[1]); // North verge
    } else {
      pushQuad(topPts[3], topPts[2], topPts[1], topPts[0]);
      pushQuad(botPts[0], botPts[1], botPts[2], botPts[3]);
      pushQuad(botPts[3], topPts[3], topPts[0], botPts[0]);
      pushQuad(topPts[1], topPts[0], botPts[0], botPts[1]);
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    // UVs for the stone-slate texture, drawn for one whole slope: u along the porch, v up from the eaves to the
    // ridge, so its courses diminish towards the ridge as on the real roof
    const uvArr = [];
    for (let i = 0; i < posArr.length; i += 3) {
      const u = (posArr[i + 2] - zNorthRoof) / (zValleyEaves - zNorthRoof);
      const v = THREE.MathUtils.clamp((posArr[i + 1] - yEaves) / (yRidge - yEaves), 0, 1);
      uvArr.push(side > 0 ? 1 - u : u, v);
    }
    pGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
    pGeo.computeVertexNormals();
    const pMesh = new THREE.Mesh(pGeo, mats.stoneSlateRoof);
    pMesh.castShadow = true;
    pMesh.receiveShadow = true;
    roofGroup.add(pMesh);
  });

  const porchRidgeLen = zValleyRidge - zNorthRoof;
  const porchRidge = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, porchRidgeLen, 8), mats.stoneCapDark);
  porchRidge.rotation.x = Math.PI / 2;
  porchRidge.position.set(P.xCenter, P.ridgeY + 0.12, zNorthRoof + porchRidgeLen * 0.5);
  roofGroup.add(porchRidge);

  // -------------------------------------------------------
  // 9. ALL 6 STEPPED STONE BUTTRESSES (verified against floorplan + photos!)
  // -------------------------------------------------------
  // North side buttresses (facing -Z)
  const addButtress = (x, z, rotY, w, d, h) => {
    const b = buildButtress(w, d, h, mats);
    b.position.set(x, 0, z + (rotY === 0 ? -0.02 : 0.02));
    b.rotation.y = rotY;
    wallsGroup.add(b);
    return b;
  };
  // North-West bay buttress (IMG_3928)
  addButtress(-5.45, N.zNorthExt, Math.PI, 0.68, 0.72, 2.72);
  // North-East Nave corner buttress (IMG_3929, IMG_3930)
  addButtress(3.15, N.zNorthExt, Math.PI, 0.72, 0.8, 2.82);

  // South side buttresses (facing +Z, IMG_3932, IMG_3933, IMG_3934)
  // SW corner buttress
  // SW corner buttress: added after 1900, so hidden in the 1900 view
  addButtress(-7.22, N.zSouthExt, 0, 0.78, 0.92, 2.95).userData.era = 'today';
  // West-mid South buttress
  addButtress(-5.25, N.zSouthExt, 0, 0.74, 0.85, 2.85);
  // Mid-South buttress (just West of Sower window)
  addButtress(-1.45, N.zSouthExt, 0, 0.78, 0.92, 2.92);
  // SE Nave corner buttress
  addButtress(3.05, N.zSouthExt, 0, 0.76, 0.84, 2.86);

  // -------------------------------------------------------
  // 10. ALL 5 CAST-IRON RAINWATER PIPES (RWPs, verified on floorplan + photos!)
  // -------------------------------------------------------
  const addRWP = (x, z, rotY, h) => {
    const rwp = buildRWP(h, mats);
    rwp.position.set(x, 0, z);
    rwp.rotation.y = rotY;
    wallsGroup.add(rwp);
  };
  // North Chancel RWP (between windows 8 & 7)
  addRWP(5.65, C.zNorthExt, Math.PI, C.eavesY);
  // North Nave RWP (East of North Porch)
  addRWP(-0.55, N.zNorthExt, Math.PI, N.eavesY);
  // North Nave RWP (West of North Porch, IMG_3928)
  addRWP(-4.4, N.zNorthExt, Math.PI, N.eavesY);
  // South Nave RWP (just West of Mid-South buttress, IMG_3932)
  addRWP(-2.0, N.zSouthExt, 0, N.eavesY);
  // South Chancel RWP (between windows 3 & 2, IMG_3931)
  addRWP(5.78, C.zSouthExt, 0, C.eavesY);

  // -------------------------------------------------------
  // 11. NAVE & CHANCEL CLAY-TILE ROOFS + BELL-TURRET & BROACH SPIRE
  // -------------------------------------------------------
  const naveRoof = buildPitchedRoof({
    xStart: N.xWestExt + 0.08,
    xEnd: N.xEastExt + 0.08,
    zHalfExt: N.zSouthExt,
    eavesY: N.eavesY,
    ridgeY: N.ridgeY,
    overhang: N.overhang,
    mats,
    // Open under the belfry so the bell chamber is not crossed by the slopes
    cut: {
      x0: DIM.tower.xCenter - DIM.tower.size * 0.5,
      x1: DIM.tower.xCenter + DIM.tower.size * 0.5,
      zHalf: DIM.tower.size * 0.5
    }
  });
  roofGroup.add(naveRoof);

  const chancelRoof = buildPitchedRoof({
    xStart: N.xEastExt - 0.1,
    xEnd: C.xEastExt - 0.06,
    zHalfExt: C.zSouthExt,
    eavesY: C.eavesY,
    ridgeY: C.ridgeY,
    overhang: C.overhang,
    mats
  });
  roofGroup.add(chancelRoof);

  // 1900: chimney for the nave stove's flue, rising through the South roof slope just above the wall
  // head in line with the stove (x = -2.25); the flue runs up inside the South wall from the stove pipe
  roofGroup.add(buildStoveChimney(-2.25, N, mats));

  // Weatherboarded Bell-Turret & Oak-Shingled Broach Spire
  const towerSpire = buildTowerAndSpire(mats);
  roofGroup.add(towerSpire);
  // The bells & their frame belong with the walls, so the floorplan cutaway (which hides roofGroup) keeps them
  wallsGroup.add(towerSpire.userData.bellFrame);

  // Masonry is solid: when the camera's near plane slices into a wall, show its rubble core, not the far faces
  capSolidMasonry(wallsGroup);

  return { wallsGroup, roofGroup, doorPivots };
}

// Walls are closed solids (ExtrudeGeometry leaves, boxes), so their back faces are only ever seen from inside them.
// Each opaque single-sided material is swapped for a double-sided clone whose back faces paint a flat rubble-core
// colour: a camera passing through a wall sees a solid cut face, while every front face renders exactly as before.
// shadowSide stays BackSide so shadow casting is unchanged. The roof space is a real void and is left alone.
// Written after colour-space conversion, so given directly in sRGB
const SOLID_CORE_COLOUR = new THREE.Vector3(0x6b / 255, 0x63 / 255, 0x58 / 255);
export function capSolidMasonry(root, coreColour = SOLID_CORE_COLOUR) {
  const capped = new Map();
  const capMaterial = (m) => {
    if (!m || m.transparent || m.side !== THREE.FrontSide || m.userData.noSolidCap) return m;
    let c = capped.get(m);
    if (c) return c;
    c = m.clone();
    c.side = THREE.DoubleSide;
    c.shadowSide = THREE.BackSide;
    c.onBeforeCompile = (shader) => {
      shader.uniforms.solidCoreColour = { value: coreColour };
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform vec3 solidCoreColour;\nvoid main() {')
        .replace(
          '#include <dithering_fragment>',
          '#include <dithering_fragment>\n\tif (!gl_FrontFacing) gl_FragColor = vec4(solidCoreColour, 1.0);'
        );
    };
    c.customProgramCacheKey = () => 'solid-core';
    capped.set(m, c);
    return c;
  };
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(capMaterial) : capMaterial(o.material);
  });
}
