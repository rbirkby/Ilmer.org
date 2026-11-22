import * as THREE from 'three';
import { DIM, getGroundHeight, isChristmasSeason } from '/assets/js/st-peters-3d/dimensions.js';
import { CHURCHYARD_MEMORIALS, surveyGridToWorld } from '/assets/js/st-peters-3d/memorials-data.js';

function pickStoneMat(stone, mats) {
  if (stone === 'granite') return mats.granite;
  if (stone === 'buff') return mats.ashlarWarm;
  if (stone === 'wood') return mats.medOak;
  return mats.ashlar;
}

// Deterministic tiny hash for per-stone subtle weathering grain
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Render authentic carved-stone inscription canvas texture (transparent overlay on stone; solid metal on brass plates)
function createInscriptionMaterial(
  lines,
  stone,
  { id = 'M', widthPx = 384, heightPx = 512, isBrass = false, showBorder = false } = {}
) {
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, widthPx, heightPx);

  let ink = 'rgba(62, 56, 46, 0.66)';
  let highlight = 'rgba(250, 244, 228, 0.28)';
  let outline = null;
  let border = 'rgba(68, 60, 48, 0.24)';
  const isGranite = !isBrass && stone === 'granite';

  if (isBrass) {
    // Solid brushed brass nameplate mounted on wooden cross markers
    ctx.fillStyle = '#bfa052';
    ctx.fillRect(0, 0, widthPx, heightPx);
    let s = hashSeed(id) || 1;
    const rand = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < 600; i++) {
      const px = rand() * widthPx;
      const py = rand() * heightPx;
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,245,205,0.16)' : 'rgba(90,68,20,0.12)';
      ctx.fillRect(px, py, 2, 2);
    }
    ink = '#1c1407';
    highlight = 'rgba(255,245,200,0.45)';
    border = 'rgba(52,38,12,0.5)';
  } else if (isGranite) {
    // Dark speckled granite memorials: muted, weathered silver-grey carved lettering with a soft dark V-cut shadow
    ink = 'rgba(214, 220, 228, 0.84)';
    highlight = 'rgba(12, 15, 18, 0.76)';
    outline = 'rgba(12, 15, 18, 0.65)';
    border = 'rgba(190, 196, 204, 0.35)';
  } else if (stone === 'buff') {
    ink = 'rgba(72, 60, 44, 0.66)';
    highlight = 'rgba(252, 244, 224, 0.28)';
    border = 'rgba(82, 68, 50, 0.24)';
  }

  // Half the previous edge margin so carved uppercase serif lettering can be significantly larger
  const pad = Math.round(Math.min(widthPx, heightPx) * 0.0275);
  if (isBrass || showBorder) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.strokeRect(pad, pad, widthPx - pad * 2, heightPx - pad * 2);
  }

  // Gravestone inscriptions are always carved in uppercase Roman serif capitals
  const cleanLines = (lines || []).filter((l) => l !== undefined).map((l) => String(l).toUpperCase());
  const innerW = widthPx - pad * 3.2;
  const innerH = heightPx - pad * 3.6;
  const serifStack = 'Georgia, "Times New Roman", Times, serif';

  const wrapAll = (fs) => {
    ctx.font = `600 ${fs}px ${serifStack}`;
    const wrapped = [];
    for (const raw of cleanLines) {
      if (!raw.trim()) {
        wrapped.push('');
        continue;
      }
      if (ctx.measureText(raw).width <= innerW) {
        wrapped.push(raw);
        continue;
      }
      const words = raw.split(/\s+/);
      let cur = '';
      for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        if (ctx.measureText(test).width <= innerW || !cur) {
          cur = test;
        } else {
          wrapped.push(cur);
          cur = w;
        }
      }
      if (cur) wrapped.push(cur);
    }
    return wrapped;
  };

  // Start with a generous target font size and step down until all wrapped lines fit innerW & innerH
  let fontSize = Math.min(44, Math.max(15, Math.floor(innerH / Math.max(cleanLines.length + 0.5, 3.4) / 1.16)));
  let finalLines = wrapAll(fontSize);
  const fitsWidth = (arr, fs) => {
    ctx.font = `700 ${fs}px ${serifStack}`;
    return arr.every((line) => !line || ctx.measureText(line).width <= innerW);
  };
  while (fontSize > 12 && (finalLines.length * fontSize * 1.18 > innerH || !fitsWidth(finalLines, fontSize))) {
    fontSize -= 1;
    finalLines = wrapAll(fontSize);
  }

  const lineH = fontSize * 1.18;
  const totalH = finalLines.length * lineH;
  const startY = (heightPx - totalH) * 0.5 + fontSize * 0.82;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Tiny engraved cross flourish near top only when there is clear room above the first line's cap height
  const topOfTextY = startY - fontSize * 0.9;
  if (!isBrass && topOfTextY > pad + 24) {
    const cy = pad + (topOfTextY - pad) * 0.5;
    const cx = widthPx * 0.5;
    ctx.fillStyle = highlight;
    ctx.fillRect(cx - 0.5, cy - 7, 3, 16);
    ctx.fillRect(cx - 5, cy - 2.5, 12, 3);
    ctx.fillStyle = ink;
    ctx.fillRect(cx - 1.5, cy - 8, 3, 16);
    ctx.fillRect(cx - 6, cy - 3.5, 12, 3);
  }

  finalLines.forEach((line, idx) => {
    if (!line) return;
    const y = startY + idx * lineH;
    // Emphasize primary name/heading lines slightly while keeping all lines in uppercase Roman serif
    const isPrimaryLine = idx <= 1 || /\b(MEMORY|SACRED|BELOVED|DIED|AGED)\b/.test(line);
    ctx.font = `${isPrimaryLine ? '700' : '600'} ${fontSize}px ${serifStack}`;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    // Subtle groove outline on dark granite only
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1.6, fontSize * 0.07);
      ctx.strokeText(line, widthPx * 0.5 - 0.3, y - 0.3);
    }
    // Subtle directional chisel bevel
    ctx.fillStyle = highlight;
    ctx.fillText(line, widthPx * 0.5 + (isGranite ? -1.1 : 1.0), y + (isGranite ? -1.1 : 1.0));
    // Main carved lettering fill
    ctx.fillStyle = ink;
    ctx.fillText(line, widthPx * 0.5, y);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;

  if (isBrass) {
    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.35,
      metalness: 0.72
    });
  }

  return new THREE.MeshStandardMaterial({
    map: tex,
    emissive: isGranite ? new THREE.Color(0xc8d0da) : new THREE.Color(0x000000),
    emissiveMap: isGranite ? tex : null,
    emissiveIntensity: isGranite ? 0.08 : 0,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    roughness: isGranite ? 0.52 : 0.88,
    metalness: isGranite ? 0.08 : 0.02
  });
}

// Helper: create a flat inscribed top-facing plane whose text reads left-to-right from East (+X) looking West (-X)
function createTopInscriptionMesh(wZ, hX, mat) {
  const geo = new THREE.PlaneGeometry(wZ, hX);
  geo.rotateX(-Math.PI / 2);
  geo.rotateY(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// Helper: create an upright inscribed plane facing East (+X), reading left-to-right when viewed from East
function createEastInscriptionMesh(wZ, hY, mat) {
  const geo = new THREE.PlaneGeometry(wZ, hY);
  geo.rotateY(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// Compute ideal local-space [target, camera] coordinates directly facing a memorial's carved inscription
function getMemorialCameraOffsets(spec) {
  switch (spec.kind) {
    case 'celtic-cross-chains':
      return { localTarget: [-0.06, 0.44, 0], localCam: [1.08, 0.62, 0] };
    case 'cross-kerbs':
      return { localTarget: [-0.08, 0.34, 0], localCam: [1.14, 0.62, 0] };
    case 'cross-headstone':
      return { localTarget: [-0.3, 0.5, 0], localCam: [1.08, 0.66, 0] };
    case 'open-book-kerbs':
      return { localTarget: [-0.33, 0.42, 0], localCam: [0.24, 1.32, 0] };
    case 'open-book':
      return { localTarget: [-0.33, 0.3, 0], localCam: [0.24, 1.2, 0] };
    case 'headstone-kerbs':
      return { localTarget: [-0.4, 0.54, 0], localCam: [1.05, 0.7, 0] };
    case 'headstone-small':
      return { localTarget: [0.05, 0.36, 0], localCam: [1.16, 0.54, 0] };
    case 'headstone-fallen':
      return { localTarget: [-0.52, 0.11, 0], localCam: [-0.14, 1.38, 0] };
    case 'plaque':
      return { localTarget: [0, 0.06, 0], localCam: [0.26, 0.94, 0] };
    case 'plaque-angled':
      return { localTarget: [0.02, 0.14, 0], localCam: [0.38, 1.02, 0] };
    case 'marker':
      return { localTarget: [0.03, 0.46, 0], localCam: [0.76, 0.54, 0] };
    default:
      return { localTarget: [0.05, 0.5, 0], localCam: [1.4, 0.66, 0] };
  }
}

// Shared faceted 3D stone chipping geometry for kerbed grave beds
let graveChippingGeo = null;
function getGraveChippingGeometry() {
  if (!graveChippingGeo) {
    graveChippingGeo = new THREE.DodecahedronGeometry(0.022, 0);
    graveChippingGeo.scale(1.18, 0.62, 0.96);
  }
  return graveChippingGeo;
}

// Build an authentic 3D gravestone/monument matching the Monumental Inscriptions survey, photos & transcriptions
function buildMemorial(spec, mats) {
  const g = new THREE.Group();
  const stoneMat = pickStoneMat(spec.stone, mats);
  const kerbMat = spec.stone === 'granite' ? mats.granite : mats.stoneCapDark;

  const addKerbs = (lenX = 1.82, widZ = 0.86) => {
    const kerbH = 0.14;
    const wallT = 0.1;
    const north = new THREE.Mesh(new THREE.BoxGeometry(lenX, kerbH, wallT), kerbMat);
    north.position.set(0.35, kerbH * 0.5, -widZ * 0.5);
    const south = new THREE.Mesh(new THREE.BoxGeometry(lenX, kerbH, wallT), kerbMat);
    south.position.set(0.35, kerbH * 0.5, widZ * 0.5);
    const east = new THREE.Mesh(new THREE.BoxGeometry(wallT, kerbH, widZ + wallT), kerbMat);
    east.position.set(0.35 + lenX * 0.5, kerbH * 0.5, 0);
    const west = new THREE.Mesh(new THREE.BoxGeometry(wallT, kerbH, widZ + wallT), kerbMat);
    west.position.set(0.35 - lenX * 0.5, kerbH * 0.5, 0);

    // Layer of small stone chippings/pebbles inside the kerb boundary
    const innerLenX = lenX - wallT;
    const innerWidZ = widZ - wallT;
    const bedH = 0.088;
    const bed = new THREE.Mesh(new THREE.BoxGeometry(innerLenX, bedH, innerWidZ), mats.gravePebbles || mats.gravelPath);
    bed.position.set(0.35, bedH * 0.5, 0);
    bed.receiveShadow = true;

    // Scatter a 3D layer of individual faceted small stones across the top of the kerb bed
    const pebbleCount = Math.round(126 * innerLenX * innerWidZ); // ~126 chippings per square metre of bed
    const pebbles = new THREE.InstancedMesh(getGraveChippingGeometry(), mats.gravePebbles || stoneMat, pebbleCount);
    let seed = hashSeed(`${spec.id}-pebbles`) || 17;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const dummyM = new THREE.Matrix4();
    const posV = new THREE.Vector3();
    const rotE = new THREE.Euler();
    const quat = new THREE.Quaternion();
    const scaleV = new THREE.Vector3();
    const spanX = innerLenX - 0.06;
    const spanZ = innerWidZ - 0.06;
    for (let i = 0; i < pebbleCount; i++) {
      const px = 0.35 + (rand() - 0.5) * spanX;
      const pz = (rand() - 0.5) * spanZ;
      const py = bedH + 0.004 + rand() * 0.008;
      posV.set(px, py, pz);
      rotE.set((rand() - 0.5) * 0.7, rand() * Math.PI * 2, (rand() - 0.5) * 0.7);
      quat.setFromEuler(rotE);
      const sx = 0.7 + rand() * 0.75;
      const sy = 0.65 + rand() * 0.6;
      const sz = 0.7 + rand() * 0.75;
      scaleV.set(sx, sy, sz);
      dummyM.compose(posV, quat, scaleV);
      pebbles.setMatrixAt(i, dummyM);
    }
    pebbles.instanceMatrix.needsUpdate = true;
    pebbles.castShadow = true;
    pebbles.receiveShadow = true;

    [north, south, east, west].forEach((m) => {
      m.castShadow = true;
      m.receiveShadow = true;
    });
    g.add(north, south, east, west, bed, pebbles);
  };

  const addOpenBook = (baseY) => {
    const bookG = new THREE.Group();
    const rest = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.68), stoneMat);
    rest.position.set(0, 0.11, 0);
    rest.castShadow = true;
    bookG.add(rest);

    const pages = spec.pages || [spec.inscription || [], []];
    // Left page (South, +Z when facing West) & Right page (North, -Z when facing West)
    [
      [1, pages[0], 'L'],
      [-1, pages[1], 'R']
    ].forEach(([side, pageLines, suffix]) => {
      const pagePivot = new THREE.Group();
      const pageMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.32), stoneMat);
      pageMesh.castShadow = true;
      pageMesh.receiveShadow = true;
      pagePivot.add(pageMesh);

      if (pageLines && pageLines.length > 0) {
        const pageMat = createInscriptionMaterial(pageLines, spec.stone, {
          id: `${spec.id}-${suffix}`,
          widthPx: 256,
          heightPx: 320
        });
        const face = createTopInscriptionMesh(0.29, 0.37, pageMat);
        face.position.y = 0.033;
        pagePivot.add(face);
      }

      pagePivot.position.set(0.02, 0.28, side * 0.165);
      pagePivot.rotation.z = -0.54;
      pagePivot.rotation.x = side * 0.1;
      bookG.add(pagePivot);
    });

    bookG.position.set(-0.35, baseY, 0);
    g.add(bookG);
  };

  const addHeadstoneSlab = (h = 0.88, hw = 0.3, xOff = -0.35, lines = spec.inscription) => {
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, hw * 2 + 0.14), stoneMat);
    plinth.position.set(xOff, 0.06, 0);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    g.add(plinth);

    const shape = new THREE.Shape();
    shape.moveTo(-hw, 0);
    shape.lineTo(hw, 0);
    shape.lineTo(hw, h - hw * 0.72);
    shape.quadraticCurveTo(hw * 0.65, h, 0, h + 0.06);
    shape.quadraticCurveTo(-hw * 0.65, h, -hw, h - hw * 0.72);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
    geo.rotateY(Math.PI / 2);
    const slab = new THREE.Mesh(geo, stoneMat);
    slab.position.set(xOff - 0.05, 0.1, 0);
    slab.castShadow = true;
    slab.receiveShadow = true;
    g.add(slab);

    // Carved inscription face mounted cleanly on the East (+X) front face of the headstone
    if (lines && lines.length > 0) {
      const faceW = hw * 1.91;
      const faceH = (h - hw * 0.42) * 0.96;
      const inscMat = createInscriptionMaterial(lines, spec.stone, {
        id: spec.id,
        widthPx: 384,
        heightPx: Math.round(384 * (faceH / faceW))
      });
      const face = createEastInscriptionMesh(faceW, faceH, inscMat);
      face.position.set(xOff + 0.053, 0.12 + faceH * 0.5, 0);
      g.add(face);
    }
  };

  switch (spec.kind) {
    case 'celtic-cross-chains': {
      // C11: Celtic cross on stepped plinth inside a square kerb surround, corner posts & iron chains
      addKerbs(2.05, 2.05);
      const crossG = new THREE.Group();
      const step1 = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.24, 0.68), stoneMat);
      step1.position.y = 0.12;
      const step2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.52), stoneMat);
      step2.position.y = 0.4;
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.38, 0.18), stoneMat);
      shaft.position.y = 1.22;
      const arms = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.17, 0.68), stoneMat);
      arms.position.y = 1.54;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 6, 16), stoneMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.y = 1.54;
      [step1, step2, shaft, arms, ring].forEach((m) => {
        m.castShadow = true;
        m.receiveShadow = true;
        crossG.add(m);
      });

      // Carved inscription on the East face of the pedestal block
      if (spec.inscription?.length) {
        const inscMat = createInscriptionMaterial(spec.inscription, spec.stone, {
          id: spec.id,
          widthPx: 384,
          heightPx: 288
        });
        const face = createEastInscriptionMesh(0.46, 0.32, inscMat);
        face.position.set(0.254, 0.4, 0);
        crossG.add(face);
      }

      crossG.position.set(-0.32, 0.02, 0);
      crossG.rotation.x = 0.09;
      g.add(crossG);

      // 4 high corner stone posts & sagging catenary wrought-iron link chains
      const corners = [
        [-0.68, -1.03],
        [1.38, -1.03],
        [1.38, 1.03],
        [-0.68, 1.03]
      ];
      corners.forEach(([px, pz]) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.52, 0.14), stoneMat);
        post.position.set(px, 0.26, pz);
        post.castShadow = true;
        post.receiveShadow = true;
        g.add(post);
      });

      // Build interlocking oval chain links sagging along a catenary curve between each pair of corner posts
      const linkGeo = new THREE.TorusGeometry(0.018, 0.0052, 5, 12);
      linkGeo.scale(1.45, 1.0, 1.0); // Elongated oval link along local +X
      const linkPitch = 0.036;
      const anchorY = 0.44;
      const chainTransforms = [];
      const xAxis = new THREE.Vector3(1, 0, 0);
      const tangent = new THREE.Vector3();
      const alignQ = new THREE.Quaternion();
      const twistQ = new THREE.Quaternion();
      const posV = new THREE.Vector3();
      const scaleV = new THREE.Vector3(1, 1, 1);

      for (let i = 0; i < 4; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % 4];
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const span = Math.hypot(dx, dz);
        const ux = dx / span;
        const uz = dz / span;
        // Start and end just outside the 0.14m square stone posts
        const startDist = 0.075;
        const endDist = span - 0.075;
        const chainSpan = endDist - startDist;
        const sag = Math.min(0.18, chainSpan * 0.11);
        const nLinks = Math.max(4, Math.round(chainSpan / linkPitch));

        for (let k = 0; k < nLinks; k++) {
          const t = (k + 0.5) / nLinks;
          const d = startDist + t * chainSpan;
          const px = a[0] + ux * d;
          const pz = a[1] + uz * d;
          // Parabolic/catenary sag curve: 0 at posts, -sag at midpoint
          const py = anchorY - sag * 4 * t * (1 - t);
          // Slope dy/dd = -sag * 4 * (1 - 2t) / chainSpan
          const dy = (-sag * 4 * (1 - 2 * t)) / chainSpan;
          tangent.set(ux, dy, uz).normalize();
          alignQ.setFromUnitVectors(xAxis, tangent);
          twistQ.setFromAxisAngle(xAxis, k % 2 === 0 ? 0 : Math.PI / 2);
          const m = new THREE.Matrix4();
          posV.set(px, py, pz);
          m.compose(posV, alignQ.clone().multiply(twistQ), scaleV);
          chainTransforms.push(m);
        }
      }

      const chainMesh = new THREE.InstancedMesh(linkGeo, mats.iron, chainTransforms.length);
      chainTransforms.forEach((m, idx) => chainMesh.setMatrixAt(idx, m));
      chainMesh.instanceMatrix.needsUpdate = true;
      chainMesh.castShadow = true;
      g.add(chainMesh);
      break;
    }

    case 'cross-kerbs': {
      // C24 / C25: Tall cross on 3-stepped pedestal inside kerbs (+ flanking plaques on C24)
      addKerbs(1.9, 0.92);
      const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.18, 0.66), stoneMat);
      s1.position.set(-0.34, 0.09, 0);
      const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 0.52), stoneMat);
      s2.position.set(-0.34, 0.3, 0);
      const s3 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.38), stoneMat);
      s3.position.set(-0.34, 0.54, 0);
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.28, 0.14), stoneMat);
      shaft.position.set(-0.34, 1.24, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.15, 0.62), stoneMat);
      arm.position.set(-0.34, 1.54, 0);
      [s1, s2, s3, shaft, arm].forEach((m) => {
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
      });

      // Main inscription on East face of pedestal
      if (spec.inscription?.length) {
        const inscMat = createInscriptionMaterial(spec.inscription, spec.stone, {
          id: spec.id,
          widthPx: 384,
          heightPx: 256
        });
        const face = createEastInscriptionMesh(0.46, 0.24, inscMat);
        face.position.set(-0.34 + 0.254, 0.3, 0);
        g.add(face);
      }

      // Flanking stone plaques for C24 (William & Winifred Richardson; Ruth & Frank Rogers)
      if (spec.plaques?.length) {
        [
          [0.56, spec.plaques[0], 'P1'],
          [-0.56, spec.plaques[1], 'P2']
        ].forEach(([pz, pLines, suffix]) => {
          const pSlab = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.38), stoneMat);
          pSlab.position.set(-0.18, 0.04, pz);
          pSlab.receiveShadow = true;
          g.add(pSlab);
          const pMat = createInscriptionMaterial(pLines, spec.stone, {
            id: `${spec.id}-${suffix}`,
            widthPx: 288,
            heightPx: 288
          });
          const pFace = createTopInscriptionMesh(0.35, 0.37, pMat);
          pFace.position.set(-0.18, 0.078, pz);
          g.add(pFace);
        });
      }
      break;
    }

    case 'cross-headstone': {
      // C22: Martha Belgrove — cross on headstone & footstone
      addHeadstoneSlab(0.84, 0.3, -0.35);
      const topCrossV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.08), stoneMat);
      topCrossV.position.set(-0.35, 1.08, 0);
      const topCrossH = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.24), stoneMat);
      topCrossH.position.set(-0.35, 1.14, 0);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.32), stoneMat);
      foot.position.set(1.1, 0.17, 0);
      g.add(topCrossV, topCrossH, foot);
      break;
    }

    case 'open-book-kerbs': {
      // C9 / C27: Sculpted open book on tiered base inside kerbs
      addKerbs(1.88, 0.9);
      addOpenBook(0.12);
      break;
    }

    case 'open-book': {
      // C23 / C28 / C31: Open book headstone on stone base
      addOpenBook(0.0);
      break;
    }

    case 'headstone-kerbs': {
      // C10 / C12 / C18 / C21: Upright headstone with kerb surround
      addKerbs(1.85, 0.88);
      addHeadstoneSlab(0.92, 0.32, -0.45);
      break;
    }

    case 'headstone-small': {
      addHeadstoneSlab(0.58, 0.26, 0);
      break;
    }

    case 'headstone-fallen': {
      // C13 & C14: Fallen pointed-arch headstone lying flat on the grass with carved face upward
      const h = 0.9;
      const hw = 0.31;

      // Low weathered original stone socket/plinth still embedded in the turf
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, hw * 2 + 0.14), stoneMat);
      plinth.position.set(0.06, 0.04, 0);
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      g.add(plinth);

      // Headstone slab toppled backward onto the grass (local +X front face rotates to +Y skyward)
      const fallenPivot = new THREE.Group();
      const shape = new THREE.Shape();
      shape.moveTo(-hw, 0);
      shape.lineTo(hw, 0);
      shape.lineTo(hw, h - hw * 0.72);
      shape.quadraticCurveTo(hw * 0.65, h, 0, h + 0.06);
      shape.quadraticCurveTo(-hw * 0.65, h, -hw, h - hw * 0.72);
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
      geo.rotateY(Math.PI / 2);
      const slab = new THREE.Mesh(geo, stoneMat);
      slab.position.set(-0.05, 0, 0);
      slab.castShadow = true;
      slab.receiveShadow = true;
      fallenPivot.add(slab);

      if (spec.inscription?.length) {
        const faceW = hw * 1.91;
        const faceH = (h - hw * 0.42) * 0.96;
        const inscMat = createInscriptionMaterial(spec.inscription, spec.stone, {
          id: spec.id,
          widthPx: 384,
          heightPx: Math.round(384 * (faceH / faceW))
        });
        const face = createEastInscriptionMesh(faceW, faceH, inscMat);
        face.position.set(0.053, 0.02 + faceH * 0.5, 0);
        fallenPivot.add(face);
      }

      fallenPivot.position.set(-0.06, 0.065, 0);
      fallenPivot.rotation.z = Math.PI / 2 - 0.03;
      g.add(fallenPivot);
      break;
    }

    case 'plaque': {
      // Flat square cremation tablet set flush in the churchyard grass (B7, C5, C15, C16, C29, C35-C43)
      const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.055, 0.48), stoneMat);
      tablet.position.y = 0.028;
      tablet.receiveShadow = true;
      g.add(tablet);

      if (spec.inscription?.length) {
        const inscMat = createInscriptionMaterial(spec.inscription, spec.stone, {
          id: spec.id,
          widthPx: 320,
          heightPx: 320
        });
        const face = createTopInscriptionMesh(0.44, 0.44, inscMat);
        face.position.y = 0.058;
        g.add(face);
      }
      break;
    }

    case 'plaque-angled': {
      // C33: Stone plaque set at an angle on a low wedge
      const wedgePivot = new THREE.Group();
      const wedge = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.5), stoneMat);
      wedge.castShadow = true;
      wedge.receiveShadow = true;
      wedgePivot.add(wedge);

      if (spec.inscription?.length) {
        const inscMat = createInscriptionMaterial(spec.inscription, spec.stone, {
          id: spec.id,
          widthPx: 320,
          heightPx: 320
        });
        const face = createTopInscriptionMesh(0.46, 0.44, inscMat);
        face.position.y = 0.073;
        wedgePivot.add(face);
      }

      wedgePivot.position.y = 0.09;
      wedgePivot.rotation.z = -0.35;
      g.add(wedgePivot);
      break;
    }

    case 'marker': {
      // Small wooden cross marker with engraved brass nameplate (C3, C7, C30)
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.05), mats.medOak);
      post.position.y = 0.31;
      post.castShadow = true;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.38), mats.medOak);
      bar.position.y = 0.46;
      bar.castShadow = true;
      g.add(post, bar);

      if (spec.inscription?.length) {
        const plateMat = createInscriptionMaterial(spec.inscription, 'wood', {
          id: spec.id,
          widthPx: 256,
          heightPx: 96,
          isBrass: true
        });
        const plate = createEastInscriptionMesh(0.28, 0.068, plateMat);
        plate.position.set(0.028, 0.46, 0);
        g.add(plate);
      }
      break;
    }

    default: {
      // Standard upright English headstone (B1-B5, C1-C2, C4, C6, C8, C13-C14, C17, C19-C20, C26, C34)
      addHeadstoneSlab(0.88, 0.31, 0);
      break;
    }
  }

  return g;
}

// Build a weathered wooden churchyard memorial bench (seen beside West wall in IMG_3928 & 3934)
function buildGardenBench(mats) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.05, 0.46), mats.weatherboard);
  seat.position.y = 0.44;
  seat.castShadow = true;
  g.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.46, 0.05), mats.weatherboard);
  back.position.set(0, 0.72, -0.22);
  back.rotation.x = -0.15;
  back.castShadow = true;
  g.add(back);

  [-0.68, 0.68].forEach((lx) => {
    const legF = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.07), mats.weatherboard);
    legF.position.set(lx, 0.31, 0.18);
    g.add(legF);
    const legB = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.92, 0.07), mats.weatherboard);
    legB.position.set(lx, 0.46, -0.2);
    g.add(legB);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.46), mats.weatherboard);
    arm.position.set(lx, 0.62, 0);
    g.add(arm);
  });
  return g;
}

// Cache procedural alpha-cutout leaf-cluster materials per color so trees build instantaneously
const leafMatCache = new Map();

function getLeafClusterMaterial(foliageHex, isEvergreen) {
  const key = `${foliageHex}-${isEvergreen ? 'ev' : 'dec'}`;
  if (leafMatCache.has(key)) return leafMatCache.get(key);

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const base = new THREE.Color(foliageHex);
  const br = Math.round(base.r * 255);
  const bg = Math.round(base.g * 255);
  const bb = Math.round(base.b * 255);

  let seed = hashSeed(key) || 1;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Delicate dark branching twigs inside the foliage spray
  ctx.strokeStyle = 'rgba(54, 42, 32, 0.85)';
  ctx.lineCap = 'round';
  const cx = size * 0.5;
  const cy = size * 0.5;
  for (let t = 0; t < 7; t++) {
    const ang = (t / 7) * Math.PI * 2 + (rand() - 0.5) * 0.4;
    const len = 46 + rand() * 52;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
    ctx.stroke();
  }

  // Individual overlapping botanical leaves leaving ~40% airy open sky gaps
  const leafCount = isEvergreen ? 115 : 82;
  for (let i = 0; i < leafCount; i++) {
    const dist = Math.pow(rand(), 0.72) * (size * 0.44);
    const theta = rand() * Math.PI * 2;
    const lx = cx + Math.cos(theta) * dist;
    const ly = cy + Math.sin(theta) * dist;

    // Natural sunlit-to-shaded tonal variation per leaf
    const shade = 0.74 + rand() * 0.54;
    const warmShift = isEvergreen ? 0 : (rand() - 0.35) * 26;
    const r = Math.min(255, Math.max(0, Math.round(br * shade + warmShift)));
    const g = Math.min(255, Math.max(0, Math.round(bg * shade + warmShift * 0.5)));
    const b = Math.min(255, Math.max(0, Math.round(bb * shade)));
    const alpha = isEvergreen ? 0.78 + rand() * 0.18 : 0.62 + rand() * 0.28;

    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(rand() * Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;

    if (isEvergreen) {
      // Fine yew needle sprigs
      const len = 10 + rand() * 9;
      const wid = 3.2 + rand() * 2.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, len, wid, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Pointed deciduous oak/beech autumn leaf silhouette
      const len = 11 + rand() * 11;
      const wid = 5 + rand() * 5.5;
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.quadraticCurveTo(0, -wid, len, 0);
      ctx.quadraticCurveTo(0, wid, -len, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    opacity: isEvergreen ? 0.9 : 0.8,
    alphaTest: 0.22,
    side: THREE.DoubleSide,
    roughness: 0.88,
    metalness: 0.0
  });
  leafMatCache.set(key, mat);
  return mat;
}

// Build a natural, leafy, semi-transparent English churchyard tree or clipped yew bush
function buildTree(height, foliageColor, isEvergreen = false) {
  const g = new THREE.Group();
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x453a30, roughness: 0.95 });
  const leafMat = getLeafClusterMaterial(foliageColor, isEvergreen);

  let seed = hashSeed(`${height}-${foliageColor}-${isEvergreen}`) || 1;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const addLeafCluster = (x, y, z, radius) => {
    // Pair of crossed & tilted foliage cards so every leaf cluster has 3D volume from all viewing angles
    const cardGeo = new THREE.PlaneGeometry(radius * 2, radius * 2);
    const c1 = new THREE.Mesh(cardGeo, leafMat);
    c1.position.set(x, y, z);
    c1.rotation.set((rand() - 0.5) * 0.85, rand() * Math.PI, (rand() - 0.5) * 0.65);
    c1.castShadow = true;
    c1.receiveShadow = true;
    g.add(c1);

    const c2 = new THREE.Mesh(cardGeo, leafMat);
    c2.position.set(x, y, z);
    c2.rotation.set((rand() - 0.5) * 0.85, c1.rotation.y + Math.PI * 0.5 + (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.65);
    c2.castShadow = true;
    c2.receiveShadow = true;
    g.add(c2);
  };

  if (isEvergreen) {
    // Clipped yew bush: woody inner stems + soft semi-transparent dark-green foliage dome & 28 feathery outer sprays
    const innerCoreMat = new THREE.MeshStandardMaterial({
      color: foliageColor,
      roughness: 0.95,
      transparent: true,
      opacity: 0.58
    });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(height * 0.34, 2), innerCoreMat);
    core.scale.set(1.12, 0.82, 1.12);
    core.position.y = height * 0.36;
    g.add(core);

    const rx = height * 0.46;
    const ry = height * 0.34;
    for (let i = 0; i < 28; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / 28);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const sx = Math.sin(phi) * Math.cos(theta) * rx * (0.8 + rand() * 0.28);
      const sy = height * 0.38 + Math.cos(phi) * ry * (0.82 + rand() * 0.25);
      const sz = Math.sin(phi) * Math.sin(theta) * rx * (0.8 + rand() * 0.28);
      if (sy < 0.35) continue;
      addLeafCluster(sx, sy, sz, height * (0.16 + rand() * 0.08));
    }
    return g;
  }

  // Deciduous churchyard tree: tapered trunk + spreading primary limbs + twigs + airy semi-transparent leafy crown
  const trunkH = height * 0.44;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.24, trunkH, 7), barkMat);
  trunk.position.y = trunkH * 0.5;
  trunk.castShadow = true;
  g.add(trunk);

  // 5 spreading primary limbs + sub-branches visible through the semi-transparent foliage
  const branchTips = [];
  for (let i = 0; i < 5; i++) {
    const az = (i / 5) * Math.PI * 2 + (rand() - 0.5) * 0.35;
    const tilt = 0.42 + rand() * 0.32;
    const limbLen = height * (0.3 + rand() * 0.1);
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.088, limbLen, 6), barkMat);
    const dirX = Math.sin(tilt) * Math.cos(az);
    const dirY = Math.cos(tilt);
    const dirZ = Math.sin(tilt) * Math.sin(az);
    const baseY = trunkH * (0.82 + rand() * 0.16);
    limb.position.set(dirX * limbLen * 0.5, baseY + dirY * limbLen * 0.5, dirZ * limbLen * 0.5);
    limb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dirX, dirY, dirZ).normalize());
    limb.castShadow = true;
    g.add(limb);

    const tipX = dirX * limbLen;
    const tipY = baseY + dirY * limbLen;
    const tipZ = dirZ * limbLen;
    branchTips.push([tipX, tipY, tipZ]);

    // Secondary twig forking off each main limb
    const twigAz = az + (rand() > 0.5 ? 0.65 : -0.65);
    const twigLen = limbLen * 0.55;
    const tx = Math.sin(tilt + 0.25) * Math.cos(twigAz);
    const ty = Math.cos(tilt + 0.15);
    const tz = Math.sin(tilt + 0.25) * Math.sin(twigAz);
    const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.038, twigLen, 5), barkMat);
    twig.position.set(
      tipX * 0.68 + tx * twigLen * 0.5,
      baseY + (tipY - baseY) * 0.68 + ty * twigLen * 0.5,
      tipZ * 0.68 + tz * twigLen * 0.5
    );
    twig.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(tx, ty, tz).normalize());
    twig.castShadow = true;
    g.add(twig);
    branchTips.push([
      tipX * 0.68 + tx * twigLen,
      baseY + (tipY - baseY) * 0.68 + ty * twigLen,
      tipZ * 0.68 + tz * twigLen
    ]);
  }

  // Upper crown apex tip
  branchTips.push([0, height * 0.84, 0], [0, height * 0.72, 0]);

  // Populate airy, semi-transparent leafy clusters around every branch tip
  branchTips.forEach(([bx, by, bz]) => {
    const clusterCount = 2;
    for (let c = 0; c < clusterCount; c++) {
      const jitter = height * 0.09;
      addLeafCluster(
        bx + (rand() - 0.5) * jitter,
        by + (rand() - 0.35) * jitter,
        bz + (rand() - 0.5) * jitter,
        height * (0.14 + rand() * 0.08)
      );
    }
  });

  return g;
}

// Create cinematic atmospheric sky dome shader with sun Mie glow, wispy autumn clouds & Evensong stars
export function createSkyDome() {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x2d66b8) },
      horizonColor: { value: new THREE.Color(0xc8dcf0) },
      bottomColor: { value: new THREE.Color(0x6e8562) },
      sunDir: { value: new THREE.Vector3(-16, 15, 20).normalize() },
      sunColor: { value: new THREE.Color(0xfff1d0) },
      sunHaloStrength: { value: 0.55 },
      cloudColor: { value: new THREE.Color(0xf8f3ea) },
      cloudStrength: { value: 0.36 },
      starStrength: { value: 0.0 },
      uTime: { value: 0.0 }
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 bottomColor;
      uniform vec3 sunDir;
      uniform vec3 sunColor;
      uniform float sunHaloStrength;
      uniform vec3 cloudColor;
      uniform float cloudStrength;
      uniform float starStrength;
      uniform float uTime;
      varying vec3 vWorldPos;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 4; i++) {
          v += amp * noise(p);
          p = p * 2.05 + vec2(11.3, 7.1);
          amp *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 dir = normalize(vWorldPos);
        float h = dir.y;
        vec3 col = h >= 0.0
          ? mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), 0.55))
          : mix(horizonColor, bottomColor, clamp(-h * 4.0, 0.0, 1.0));

        if (h > 0.0) {
          // Warm solar Mie scattering halo + crisp sun disc
          float sunDot = max(dot(dir, normalize(sunDir)), 0.0);
          float halo = pow(sunDot, 7.0) * 0.42 + pow(sunDot, 48.0) * 0.55 + smoothstep(0.9975, 0.9994, sunDot) * 1.1;
          col += sunColor * halo * sunHaloStrength;

          // Subtle wispy late-afternoon clouds drifting slowly across the sky
          vec2 cloudUv = (dir.xz / (h + 0.16)) * 0.55 + vec2(uTime * 0.0025, uTime * 0.0012);
          float n = fbm(cloudUv * vec2(1.6, 0.85));
          float wisps = smoothstep(0.48, 0.78, n) * smoothstep(0.02, 0.24, h) * (1.0 - smoothstep(0.55, 0.95, h));
          vec3 litCloud = mix(cloudColor, sunColor, pow(sunDot, 4.0) * 0.55);
          col = mix(col, litCloud, wisps * cloudStrength);

          // Delicate twilight stars in Evensong mode
          if (starStrength > 0.01) {
            vec2 starCell = floor((dir.xz / (h + 0.25)) * 120.0);
            float starRand = hash21(starCell);
            float star = step(0.9955, starRand) * smoothstep(0.18, 0.55, h);
            col += vec3(0.88, 0.93, 1.0) * star * starStrength;
          }
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 20), skyMat);
  return { mesh, material: skyMat };
}

export function buildChurchyard(mats) {
  const g = new THREE.Group();

  // 1. Wide rolling English churchyard lawn (completely level y=0 across the entire mapped graveyard!)
  const groundGeo = new THREE.PlaneGeometry(120, 120, 56, 56);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const hill = getGroundHeight(pos.getX(i), pos.getZ(i));
    if (hill !== 0) pos.setY(i, hill);
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, mats.grass);
  ground.receiveShadow = true;
  g.add(ground);

  // 2. Churchyard footpath of diamond-chequer pavers (survey plan: straight E-W path along the North side, its
  //    South edge running right up to the North Porch, so no separate spur is needed)
  const mainPath = new THREE.Mesh(new THREE.BoxGeometry(27.5, 0.03, 1.48), [
    mats.gravelPath,
    mats.gravelPath,
    mats.pathPavers,
    mats.gravelPath,
    mats.gravelPath,
    mats.gravelPath
  ]);
  mainPath.position.set(-1.1, 0.015, -6.22);
  mainPath.receiveShadow = true;
  g.add(mainPath);

  // 3. Weathered wooden garden bench beside West gable wall (IMG_3928 & IMG_3934)
  const bench = buildGardenBench(mats);
  bench.position.set(DIM.nave.xWestExt - 0.65, 0, -1.55);
  bench.rotation.y = -Math.PI / 2;
  g.add(bench);

  // 4. All 49 Plotted Churchyard Gravestones & Memorials with Carved Inscriptions
  const memorialGroups = [];
  CHURCHYARD_MEMORIALS.forEach((m, idx) => {
    const { x, z } = surveyGridToWorld(m.col, m.row);
    const monument = buildMemorial(m, mats);
    monument.name = `memorial-${m.id}`;
    monument.position.set(x, 0, z);
    const subtleYaw = (((idx * 37) % 11) - 5) * 0.012;
    // Memorials face East by default; those turned towards the church face South (north side) or North (south side)
    const churchYaw = z < 0 ? -Math.PI / 2 : Math.PI / 2;
    monument.rotation.y = m.facesChurch ? churchYaw : subtleYaw;
    monument.userData.memorialFocus = {
      id: m.id,
      ...getMemorialCameraOffsets(m)
    };
    g.add(monument);
    memorialGroups.push(monument);

    if (m.benchOnLeft) {
      // Wooden bench to the memorial's left as you stand reading it, facing the same way as the inscription
      const memBench = buildGardenBench(mats);
      const yaw = monument.rotation.y;
      // Bench faces local +z; turn it to face along the memorial's front (local +x)
      memBench.rotation.y = yaw + Math.PI / 2;
      // Reader looks along -front, so their left is the memorial's local +z
      const side = new THREE.Vector3(0, 0, 2.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const fwd = new THREE.Vector3(0.15, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      memBench.position.set(x + side.x + fwd.x, 0, z + side.z + fwd.z);
      g.add(memBench);
    }
  });

  // 5. Characteristic Clipped Yew Bushes & Perimeter Autumn/Winter Trees
  const yewNE = buildTree(5.0, 0x26441d, true);
  yewNE.position.set(14.8, 0, -10.8);
  g.add(yewNE);

  const yewSE = buildTree(4.6, 0x2a4a20, true);
  yewSE.position.set(17.4, 0, 7.2);
  g.add(yewSE);

  const trees = [
    [-21.5, -5.5, 8.8, 0x8f6b32],
    [-19.5, 11.5, 7.8, 0x6e5430],
    [-26.5, -14.5, 9.2, 0x5c6838],
    [24.5, -15.5, 10.2, 0x8c682c],
    [25.5, 3.5, 8.8, 0x9b722b],
    [16.5, 24.5, 9.6, 0x6b5b34],
    [-8.5, 27.5, 10.5, 0x7d6535],
    [6.5, 27.5, 8.6, 0x5e6234]
  ];
  trees.forEach(([tx, tz, th, col]) => {
    const tree = buildTree(th, col, false);
    tree.position.set(tx, 0, tz);
    g.add(tree);
  });

  // 6. December Festive Christmas Tree outside the North Porch with twinkling fairy lights
  let christmasEffect = null;
  const searchStr = typeof window !== 'undefined' ? window.location.search : '';
  if (isChristmasSeason(new Date(), searchStr)) {
    christmasEffect = buildChristmasTree(mats);
    christmasEffect.group.position.set(-0.2, 0, -4.55);
    g.add(christmasEffect.group);
  }

  return { group: g, christmasEffect, memorialGroups };
}

// Build a festive Norway Spruce Christmas tree in a wooden planter with twinkling fairy lights & golden star
function buildChristmasTree(mats) {
  const group = new THREE.Group();
  group.name = 'december-christmas-tree';

  // Wooden half-barrel planter & iron hoops at base
  const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.36, 12), mats.medOak);
  tub.position.y = 0.18;
  tub.castShadow = true;
  tub.receiveShadow = true;
  group.add(tub);

  [0.09, 0.28].forEach((hy) => {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.295, 0.012, 6, 18), mats.iron);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = hy;
    group.add(hoop);
  });

  // Tapered spruce trunk
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3f2d20, roughness: 0.95 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.09, 2.7, 8), trunkMat);
  trunk.position.y = 1.62;
  trunk.castShadow = true;
  group.add(trunk);

  // Layered spruce needle boughs (inner cones + feathery alpha-cutout evergreen leaf sprays)
  const spruceMat = new THREE.MeshStandardMaterial({
    color: 0x183d21,
    roughness: 0.9,
    flatShading: true
  });
  const sprayMat = getLeafClusterMaterial(0x1f4f28, true);

  const tiers = [
    { y: 0.88, r: 0.84, h: 0.92 },
    { y: 1.32, r: 0.72, h: 0.84 },
    { y: 1.74, r: 0.59, h: 0.76 },
    { y: 2.12, r: 0.46, h: 0.68 },
    { y: 2.46, r: 0.33, h: 0.58 },
    { y: 2.75, r: 0.21, h: 0.46 }
  ];

  tiers.forEach((tier, tIdx) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(tier.r * 0.86, tier.h, 9), spruceMat);
    cone.position.y = tier.y;
    cone.rotation.y = tIdx * 0.42;
    cone.castShadow = true;
    cone.receiveShadow = true;
    group.add(cone);

    // Feathery spruce branch sprays around each tier edge
    const sprayCount = Math.max(4, Math.round(tier.r * 10));
    for (let s = 0; s < sprayCount; s++) {
      const a = (s / sprayCount) * Math.PI * 2 + tIdx * 0.5;
      const sr = tier.r * 0.74;
      const spraySize = 0.26 + tier.r * 0.34;
      const card = new THREE.Mesh(new THREE.PlaneGeometry(spraySize, spraySize), sprayMat);
      card.position.set(Math.cos(a) * sr, tier.y - tier.h * 0.26, Math.sin(a) * sr);
      card.rotation.set(0.35, -a + Math.PI / 2, (s % 2 === 0 ? 1 : -1) * 0.2);
      card.castShadow = true;
      group.add(card);
    }
  });

  // Spiraling Christmas fairy lights (warm white/gold + festive red, amber, blue, emerald bulbs)
  const palette = [0xffe49e, 0xff4545, 0xffb340, 0x55b0ff, 0x4ae67b, 0xfff0c2];
  const bulbGeo = new THREE.SphereGeometry(0.032, 8, 8);
  const bulbEntries = [];
  const bulbCount = 58;

  for (let i = 0; i < bulbCount; i++) {
    const t = i / (bulbCount - 1); // 0 = bottom boughs, 1 = near star
    const y = 0.54 + t * 2.34;
    const radius = THREE.MathUtils.lerp(0.84, 0.14, Math.pow(t, 0.92));
    const angle = t * Math.PI * 11.5; // ~5.75 spiral turns around the spruce
    const colHex = palette[i % palette.length];
    const bulbMat = new THREE.MeshStandardMaterial({
      color: colHex,
      emissive: colHex,
      emissiveIntensity: 1.6,
      roughness: 0.2
    });
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    group.add(bulb);
    bulbEntries.push({ mat: bulbMat, phase: i * 0.85, speed: 2.2 + (i % 4) * 0.55 });
  }

  // Glowing 5-pointed golden star topper
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.16 : 0.068;
    const a = (i * Math.PI) / 5 + Math.PI / 2;
    const sx = Math.cos(a) * r;
    const sy = Math.sin(a) * r;
    if (i === 0) starShape.moveTo(sx, sy);
    else starShape.lineTo(sx, sy);
  }
  starShape.closePath();
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.035, bevelEnabled: false });
  starGeo.translate(0, 0, -0.0175);
  const starMat = new THREE.MeshStandardMaterial({
    color: 0xffe484,
    emissive: 0xffc83d,
    emissiveIntensity: 1.8,
    roughness: 0.25,
    metalness: 0.5
  });
  const star = new THREE.Mesh(starGeo, starMat);
  star.position.set(0, 3.12, 0);
  group.add(star);

  // Warm festive glow PointLight illuminating the North Porch stonework & lawn
  const treeLight = new THREE.PointLight(0xffd28a, 1.5, 9.5, 1.6);
  treeLight.position.set(0, 1.85, -0.45);
  group.add(treeLight);

  let baseLightIntensity = 1.5;
  let baseEmissiveScale = 1.0;

  return {
    group,
    setMood(moodKey) {
      if (moodKey === 'evensong') {
        baseLightIntensity = 3.2;
        baseEmissiveScale = 1.65;
      } else if (moodKey === 'golden') {
        baseLightIntensity = 2.1;
        baseEmissiveScale = 1.3;
      } else {
        baseLightIntensity = 1.2;
        baseEmissiveScale = 1.05;
      }
      starMat.emissiveIntensity = 1.65 * baseEmissiveScale;
    },
    update(elapsed) {
      for (let i = 0; i < bulbEntries.length; i++) {
        const b = bulbEntries[i];
        const twinkle = 0.72 + 0.55 * (0.5 + 0.5 * Math.sin(elapsed * b.speed + b.phase));
        b.mat.emissiveIntensity = 1.35 * baseEmissiveScale * twinkle;
      }
      treeLight.intensity = baseLightIntensity * (0.94 + 0.06 * Math.sin(elapsed * 2.4));
    }
  };
}
