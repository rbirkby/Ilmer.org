// Architectural interior structure: tiled floors, carpet runner, nave coved ceiling & carved angels,
// chancel wagon-ribbed barrel vault, medieval rood screen, and west tower timber substructure & vestry.
import * as THREE from 'three';
import { canvas2d, canvasTexture, makeCanvas } from '../canvas-utils.ts';
import { addBox, boxMesh } from '../mesh-utils.ts';
import { DIM } from '../dimensions.ts';
import { applyBoxUVs, capSolidMasonry } from '../architecture.ts';
import { buildSally, buildTwistedRope, createRopeMaterial } from '../belfry.ts';
import { buildPiercedCarvingFromField, canvasToBlurredHeightField, createCarvedAngelHeightMap } from '../reliefs.ts';
import type { ChurchMaterials } from '../textures.ts';
import { buildCeilingSpotlight } from './lighting.ts';
import { buildChimingFrame, buildHymnBookPile, buildTableCurtain, buildWaterExtinguisher } from './props.ts';

type Seam = [number, number, number, number];

function createTrefoilLightHole(
  uL: number,
  uR: number,
  vBotL: number,
  vBotR: number,
  vTop: number,
  bottomCurveFn: ((u: number) => number) | null = null
) {
  const path = new THREE.Path();
  const uMid = (uL + uR) * 0.5;
  const hw = (uR - uL) * 0.5;
  const vSpring = Math.max(Math.max(vBotL, vBotR) + 0.025, vTop - hw * 1.45);
  const vCusp = vSpring + (vTop - vSpring) * 0.42;

  path.moveTo(uL, vBotL);
  path.lineTo(uL, vSpring);
  // Left foil lobe curving in to left cusp
  path.quadraticCurveTo(uL + hw * 0.04, vSpring + (vCusp - vSpring) * 0.68, uL + hw * 0.34, vCusp);
  // Central pointed trefoil apex
  path.quadraticCurveTo(uL + hw * 0.24, vTop - (vTop - vCusp) * 0.35, uMid, vTop);
  path.quadraticCurveTo(uR - hw * 0.24, vTop - (vTop - vCusp) * 0.35, uR - hw * 0.34, vCusp);
  // Right foil lobe curving back to right springline
  path.quadraticCurveTo(uR - hw * 0.04, vSpring + (vCusp - vSpring) * 0.68, uR, vSpring);
  path.lineTo(uR, vBotR);

  if (bottomCurveFn) {
    const steps = 4;
    for (let s = steps - 1; s >= 1; s--) {
      const u = uL + (uR - uL) * (s / steps);
      path.lineTo(u, bottomCurveFn(u));
    }
  }
  path.closePath();
  return path;
}

// Build the Medieval 15th-Century Carved Oak Rood Screen & Dwarf Wall (IMG_3936, 3937, 3939, 3940)

export function buildRoodScreen(mats: ChurchMaterials) {
  const g = new THREE.Group();
  const xPos = DIM.nave.xEastInt + 0.02;
  const baseY = DIM.naveFloorY;
  const dwarfH = 1.02;
  const dwarfTopY = baseY + dwarfH;
  const sillH = 0.06;
  const sillTopY = dwarfTopY + sillH;
  const beamBottomY = baseY + 2.44; // Underside of rood beam soffit (y = 2.54)
  const openHalfW = 0.61; // 1.22m wide central doorway opening
  const maxZ = DIM.chancel.zSouthInt; // 2.00m: the North end, against the chancel arch wall
  // The South end runs on past the chancel arch to meet the nave's South wall
  const southMaxZ = DIM.nave.zSouthInt - 0.004;
  const endZ = (side: number) => (side > 0 ? southMaxZ : maxZ);
  const postW = 0.12;
  const sideStart = openHalfW + postW; // 0.73m
  const sideEnd = maxZ - postW; // 1.88m
  const sideSpan = sideEnd - sideStart; // 1.15m
  const bayCount = 5; // 5 tall slender open lights per side (IMG_3937, 3940)
  const bayW = sideSpan / bayCount; // 0.23m per bay

  // Double-chamfered Gothic vertical mullion cross-section (thicker front-to-back than wide)
  const mullionShape = new THREE.Shape();
  const mW = 0.022;
  const mD = 0.048;
  const mC = 0.012;
  mullionShape.moveTo(-mW + mC, -mD);
  mullionShape.lineTo(mW - mC, -mD);
  mullionShape.lineTo(mW, -mD + mC);
  mullionShape.lineTo(mW, mD - mC);
  mullionShape.lineTo(mW - mC, mD);
  mullionShape.lineTo(-mW + mC, mD);
  mullionShape.lineTo(-mW, mD - mC);
  mullionShape.lineTo(-mW, -mD + mC);
  mullionShape.closePath();

  const traceryY0 = beamBottomY - 0.46; // y = 2.08
  const mullionH = traceryY0 + 0.04 - sillTopY;
  const mullionGeo = new THREE.ExtrudeGeometry(mullionShape, { depth: mullionH, bevelEnabled: false });
  mullionGeo.rotateX(-Math.PI / 2);
  mullionGeo.rotateY(Math.PI / 2);
  applyBoxUVs(mullionGeo, 0.45);

  // Precision-cut pierced Gothic tracery head for a single side light (cusped cinquefoil arch + twin batement lights)
  const sideHeadH = beamBottomY - traceryY0; // 0.46m
  const halfBay = bayW * 0.5; // 0.115m
  const clearHW = halfBay - 0.022; // 0.093m clear light half-width
  const sideHeadShape = new THREE.Shape();
  sideHeadShape.moveTo(-halfBay, 0);
  sideHeadShape.lineTo(-clearHW, 0);
  sideHeadShape.lineTo(-clearHW, 0.065);
  // Left lower cusp foil
  sideHeadShape.quadraticCurveTo(-clearHW - 0.004, 0.118, -clearHW * 0.68, 0.138);
  // Left upper cusp foil
  sideHeadShape.quadraticCurveTo(-clearHW * 0.76, 0.184, -clearHW * 0.38, 0.205);
  // Pointed Gothic central apex
  sideHeadShape.quadraticCurveTo(-clearHW * 0.26, 0.242, 0, 0.262);
  sideHeadShape.quadraticCurveTo(clearHW * 0.26, 0.242, clearHW * 0.38, 0.205);
  // Right upper cusp foil
  sideHeadShape.quadraticCurveTo(clearHW * 0.76, 0.184, clearHW * 0.68, 0.138);
  // Right lower cusp foil
  sideHeadShape.quadraticCurveTo(clearHW + 0.004, 0.118, clearHW, 0.065);
  sideHeadShape.lineTo(clearHW, 0);
  sideHeadShape.lineTo(halfBay, 0);
  sideHeadShape.lineTo(halfBay, sideHeadH);
  sideHeadShape.lineTo(-halfBay, sideHeadH);
  sideHeadShape.closePath();

  // Twin pierced Perpendicular batement lights in the spandrel above each side arch (IMG_3939, 3940)
  sideHeadShape.holes.push(createTrefoilLightHole(-0.088, -0.016, 0.228, 0.285, 0.425));
  sideHeadShape.holes.push(createTrefoilLightHole(0.016, 0.088, 0.285, 0.228, 0.425));

  const traceryDepth = 0.062;
  const sideHeadGeo = new THREE.ExtrudeGeometry(sideHeadShape, {
    depth: traceryDepth,
    bevelEnabled: true,
    bevelThickness: 0.007,
    bevelSize: 0.005,
    bevelSegments: 2,
    curveSegments: 10
  });
  sideHeadGeo.translate(0, 0, -traceryDepth * 0.5);
  sideHeadGeo.rotateY(Math.PI / 2);
  applyBoxUVs(sideHeadGeo, 0.45);

  // Helper to build a stepped/moulded heavy oak structural standard post
  function addMouldedStandard(zCenter: number, yBot: number, yTop: number) {
    const h = yTop - yBot;
    const midY = (yBot + yTop) * 0.5;
    addBox(g, [0.16, h, postW], mats.darkOak, [xPos, midY, zCenter], { cast: true, receive: true });
    // Subtle raised inner/outer vertical chamfer beads catching light on both faces
    addBox(g, [0.185, h, postW * 0.56], mats.darkOak, [xPos, midY, zCenter]);
    // Moulded capital collar right beneath the rood beam soffit
    addBox(g, [0.2, 0.045, postW + 0.025], mats.darkOak, [xPos, yTop - 0.022, zCenter]);
  }

  // 1. Cream-plastered dwarf walls, dressed limestone jamb quoins, oak sill & 5-light side screens
  [-1, 1].forEach((side) => {
    const sideMaxZ = endZ(side);
    const segLen = sideMaxZ - openHalfW;
    // The screen is symmetrical: 5 identical lights each side of the doorway, framed at the chancel arch
    const bays = bayCount;
    const bayWs = bayW;
    const midZ = side * (openHalfW + segLen * 0.5);

    addBox(g, [0.36, dwarfH, segLen], mats.plaster, [xPos, baseY + dwarfH * 0.5, midZ], { cast: true, receive: true });

    // 5 courses of alternating long-and-short dressed limestone jamb quoins (IMG_3937, 3939, 3940)
    const quoinCourses = 5;
    const courseH = dwarfH / quoinCourses;
    for (let q = 0; q < quoinCourses; q++) {
      const qLen = q % 2 === 0 ? 0.25 : 0.14;
      addBox(
        g,
        [0.385, courseH - 0.012, qLen],
        mats.ashlarWarm,
        [xPos, baseY + (q + 0.5) * courseH, side * (openHalfW + qLen * 0.5 - 0.008)],
        { cast: true, receive: true }
      );
    }

    // Chamfered dark-oak sill plate along top of dwarf wall
    addBox(g, [0.16, sillH, segLen + 0.01], mats.darkOak, [xPos, dwarfTopY + sillH * 0.5, midZ], { cast: true });

    // Heavy moulded inner doorway standard (runs to floor) & outer wall standard
    addMouldedStandard(side * (openHalfW + postW * 0.5), baseY, beamBottomY);
    addMouldedStandard(side * (maxZ - postW * 0.5), dwarfTopY, beamBottomY);
    if (sideMaxZ > maxZ + 0.01) {
      // South of the chancel arch the screen runs on to the nave wall as a plain boarded oak panel
      const panelLen = sideMaxZ - maxZ;
      addBox(
        g,
        [0.07, beamBottomY - sillTopY, panelLen],
        mats.darkOak,
        [xPos, (sillTopY + beamBottomY) * 0.5, side * (maxZ + panelLen * 0.5)],
        { cast: true, receive: true }
      );
      addMouldedStandard(side * (sideMaxZ - postW * 0.5), dwarfTopY, beamBottomY);
    }

    // Slender chamfered intermediate mullions + pierced Gothic tracery heads (5 lights each side)
    for (let i = 1; i < bays; i++) {
      const mz = side * (sideStart + i * bayWs);
      const mullion = new THREE.Mesh(mullionGeo, mats.darkOak);
      mullion.position.set(xPos, sillTopY, mz);
      mullion.castShadow = true;
      g.add(mullion);
    }
    for (let i = 0; i < bays; i++) {
      const cz = side * (sideStart + (i + 0.5) * bayWs);
      const head = new THREE.Mesh(sideHeadGeo, mats.darkOak);
      head.position.set(xPos, traceryY0, cz);
      head.castShadow = true;
      g.add(head);
    }
  });

  // Two blue hymn books, like those in the vestry, resting on the North dwarf wall ledge (IMG_3939)
  const ledgeBooks = buildHymnBookPile(0, 0, 0, 0, {
    books: [
      { t: 0.03, colour: 0x2c5688 },
      { t: 0.028, colour: 0x2c5688 }
    ],
    seed: 3939
  });
  ledgeBooks.position.set(xPos + 0.11, sillTopY, -0.95);
  g.add(ledgeBooks);

  // 2. Central Doorway Depressed Four-Centered Tudor Arch + 8-Light Pierced Perpendicular Tracery Head (IMG_3937, 3940)
  const doorY0 = beamBottomY - 0.92; // y = 1.62
  const doorH = beamBottomY - doorY0; // 0.92m
  const archSpanHW = openHalfW + 0.005;
  const archRise = 0.5; // Crown at y = 2.12m
  const doorArchCurve = (u: number) => {
    const norm = Math.min(1, Math.abs(u) / archSpanHW);
    return archRise * Math.pow(Math.max(0, 1 - Math.pow(norm, 1.85)), 0.58);
  };

  const doorHeadShape = new THREE.Shape();
  doorHeadShape.moveTo(-archSpanHW, 0);
  const archSamples = 28;
  for (let i = 1; i <= archSamples; i++) {
    const u = -archSpanHW + (i / archSamples) * (archSpanHW * 2);
    doorHeadShape.lineTo(u, doorArchCurve(u));
  }
  doorHeadShape.lineTo(archSpanHW, doorH);
  doorHeadShape.lineTo(-archSpanHW, doorH);
  doorHeadShape.closePath();

  // 8 small trefoil-headed tracery lights above the central doorway arch (IMG_3937, 3940)
  const doorLights = 8;
  const doorInnerSpan = (openHalfW - 0.032) * 2;
  const doorCellW = doorInnerSpan / doorLights;
  const doorLightGap = 0.014;
  const doorBotFn = (u: number) => doorArchCurve(u) + 0.052;
  for (let i = 0; i < doorLights; i++) {
    const uL = -doorInnerSpan * 0.5 + i * doorCellW + doorLightGap;
    const uR = uL + doorCellW - doorLightGap * 2;
    doorHeadShape.holes.push(createTrefoilLightHole(uL, uR, doorBotFn(uL), doorBotFn(uR), doorH - 0.036, doorBotFn));
  }

  const doorHeadGeo = new THREE.ExtrudeGeometry(doorHeadShape, {
    depth: traceryDepth,
    bevelEnabled: true,
    bevelThickness: 0.007,
    bevelSize: 0.005,
    bevelSegments: 2,
    curveSegments: 10
  });
  doorHeadGeo.translate(0, 0, -traceryDepth * 0.5);
  doorHeadGeo.rotateY(Math.PI / 2);
  applyBoxUVs(doorHeadGeo, 0.45);
  const doorHead = new THREE.Mesh(doorHeadGeo, mats.darkOak);
  doorHead.position.set(xPos, doorY0, 0);
  doorHead.castShadow = true;
  g.add(doorHead);

  // Projecting moulded oak inner rib following the central Tudor doorway arch
  const archPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = -openHalfW + (i / 24) * (openHalfW * 2);
    archPts.push(new THREE.Vector3(0, doorY0 + doorArchCurve(u) + 0.018, u));
  }
  const archCurve = new THREE.CatmullRomCurve3(archPts);
  const archRibGeo = new THREE.TubeGeometry(archCurve, 28, 0.028, 6, false);
  archRibGeo.scale(1.65, 1, 1); // Moulded deeper front-to-back
  const archRib = new THREE.Mesh(archRibGeo, mats.darkOak);
  archRib.position.x = xPos;
  archRib.castShadow = true;
  g.add(archRib);

  // 3. Heavy Stepped, Moulded & Crenellated (Battlemented) Rood Beam Cornice across full width (IMG_3939, 3940)
  const fullW = maxZ + southMaxZ + 0.08;
  const beamMidZ = (southMaxZ - maxZ) * 0.5;
  // Lower moulded soffit rail
  addBox(g, [0.19, 0.055, fullW], mats.darkOak, [xPos, beamBottomY + 0.0275, beamMidZ], { cast: true });

  // Deep recessed cavetto / hollow frieze running across the beam
  const friezeY = beamBottomY + 0.112;
  addBox(g, [0.13, 0.115, fullW - 0.02], mats.darkOak, [xPos, friezeY, beamMidZ]);

  // Subtle carved square oak bosses / paterae recessed along the hollow frieze
  for (let bz = -maxZ + 0.18; bz <= southMaxZ - 0.18; bz += 0.28) {
    [-0.072, 0.072].forEach((bx) => {
      const boss = addBox(g, [0.024, 0.056, 0.056], mats.darkOak, [xPos + bx, friezeY, bz]);
      boss.rotation.x = Math.PI / 4;
    });
  }

  // Projecting stepped cornice mouldings above the frieze
  addBox(g, [0.24, 0.044, fullW + 0.02], mats.darkOak, [xPos, beamBottomY + 0.192, beamMidZ], { cast: true });

  addBox(g, [0.28, 0.054, fullW + 0.04], mats.darkOak, [xPos, beamBottomY + 0.241, beamMidZ], { cast: true });

  // Crisp battlemented (crenellated) oak merlons crowning the entire rood beam (IMG_3939, 3940)
  for (let mz = -maxZ + 0.09; mz <= southMaxZ - 0.09; mz += 0.255) {
    addBox(g, [0.22, 0.062, 0.135], mats.darkOak, [xPos, beamBottomY + 0.299, mz], { cast: true });
  }

  // 4. Arched Wooden Hymn Board mounted on the screen's South end standard (IMG_3937)
  const hymnG = new THREE.Group();
  addBox(hymnG, [0.036, 0.68, 0.3], mats.medOak);
  const hbArch = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.036, 12, 1, false, 0, Math.PI), mats.medOak);
  hbArch.rotation.z = Math.PI / 2;
  hbArch.position.y = 0.34;
  hymnG.add(hbArch);
  for (let r = 0; r < 5; r++) {
    addBox(hymnG, [0.05, 0.018, 0.28], mats.darkOak, [-0.008, -0.24 + r * 0.125, 0]);
  }
  // Hymn 59 (O Come, All Ye Faithful) on a painted number card resting on the top rail; main.js plays it when the
  // card is clicked
  const hymnCard = buildHymnNumberCard('59', 0.135 + 0.009);
  hymnCard.userData.hymnNumber = 59; // only the card is clickable, not the whole board
  hymnG.add(hymnCard);
  hymnG.position.set(xPos - 0.13, baseY + 1.84, southMaxZ - 0.16);
  hymnG.userData.era = 'today';
  g.add(hymnG);
  // 1900: the harmonium stood in front of the South end standard, so the board hung nearer the screen's centre
  const hymn1900 = hymnG.clone();
  hymn1900.userData.era = '1900';
  hymn1900.visible = false;
  hymn1900.position.z = 1.2;
  g.add(hymn1900);

  return g;
}

// A hymn board number card: cream-painted board with dark numerals, standing on a rail (railTopY) against the
// board's face (-X)
function buildHymnNumberCard(text: string, railTopY: number) {
  const canvas = makeCanvas(512, 192);
  const ctx = canvas2d(canvas);
  ctx.fillStyle = '#f1ead8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#cfc4a8';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
  ctx.fillStyle = '#1f1a15';
  ctx.font = 'bold 150px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 8);
  const tex = canvasTexture(canvas, { anisotropy: 4 });
  const h = 0.1;
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, h),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 })
  );
  card.rotation.y = -Math.PI / 2; // faces -X, numerals reading left to right
  card.position.set(-0.021, railTopY + h / 2, 0);
  return card;
}

export function buildWestTowerInterior(mats: ChurchMaterials, ceilingGroup: THREE.Group) {
  const g = new THREE.Group();
  const T = DIM.tower;
  const N = DIM.nave;
  const floorY = DIM.naveFloorY;
  const ceilY = T.belfryCeilingY;
  // Underside of the nave roof slopes (with a little clearance): the tower frame must stay beneath it, or its
  // timbers break out through the tiles either side of the belfry
  const roofRun = N.zSouthExt + 0.32;
  const roofUnderY = (z: number) => N.ridgeY - (Math.abs(z) / roofRun) * (N.ridgeY - N.eavesY) - 0.2;
  const sideTopY = roofUnderY(N.zSouthInt); // highest the wall-side framing can rise
  const kneeZ = (y: number) => ((N.ridgeY - 0.2 - y) / (N.ridgeY - N.eavesY)) * roofRun; // where the roof drops to y
  const postH = sideTopY - floorY;

  // 1. Four massive medieval dark oak vertical posts (0.30m x 0.30m)
  const postPositions = [
    [T.eastPostX, N.zNorthInt + 0.18],
    [T.eastPostX, N.zSouthInt - 0.18],
    [T.westPostX, N.zNorthInt + 0.18],
    [T.westPostX, N.zSouthInt - 0.18]
  ];
  postPositions.forEach(([px, pz]) => {
    addBox(g, [0.3, postH, 0.3], mats.darkOak, [px, floorY + postH * 0.5, pz], { cast: true, receive: true });
  });

  // Top tie-beams connecting the 4 posts: level under the belfry ceiling, their ends cranked down beneath the
  // roof slopes onto the post heads
  const buildTieBeam = (depth: number, width: number) => {
    const half = (N.zSouthInt - N.zNorthInt - 0.05) * 0.5;
    const kz = Math.min(half - 0.1, kneeZ(ceilY));
    const endTop = roofUnderY(half);
    const shape = new THREE.Shape();
    shape.moveTo(-half, endTop - depth);
    shape.lineTo(-half, endTop);
    shape.lineTo(-kz, ceilY);
    shape.lineTo(kz, ceilY);
    shape.lineTo(half, endTop);
    shape.lineTo(half, endTop - depth);
    shape.lineTo(kz, ceilY - depth);
    shape.lineTo(-kz, ceilY - depth);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
    geo.translate(0, 0, -width * 0.5);
    geo.rotateY(Math.PI / 2);
    applyBoxUVs(geo, 0.5);
    return new THREE.Mesh(geo, mats.darkOak);
  };
  const eastTie = buildTieBeam(0.28, 0.28);
  eastTie.position.set(T.eastPostX, 0, 0);
  g.add(eastTie);

  const westTie = buildTieBeam(0.26, 0.26);
  westTie.position.set(T.westPostX, 0, 0);
  g.add(westTie);

  // Longitudinal side beams & heavy mid-height horizontal rails (IMG_3942, 3943)
  const bayLen = T.eastPostX - T.westPostX;
  const midBayX = (T.eastPostX + T.westPostX) * 0.5;
  [-1, 1].forEach((sideZ) => {
    const zLine = sideZ * (N.zSouthInt - 0.18);
    // Top longitudinal plate
    addBox(g, [bayLen + 0.3, 0.26, 0.26], mats.darkOak, [midBayX, sideTopY - 0.13, zLine]);

    // Mid-height horizontal oak rail (y ≈ 2.65, IMG_3942, 3943)
    addBox(g, [bayLen, 0.22, 0.2], mats.darkOak, [midBayX, 2.65, zLine]);

    // Massive diagonal timber braces along North & South walls (IMG_3942, 3943, 3944)
    const diagLower = addBox(g, [2.65, 0.22, 0.18], mats.darkOak, [midBayX + 0.32, 1.48, zLine]);
    diagLower.rotation.z = 0.88;

    // Short upper brace between the mid rail and the top plate, kept below the roof slope
    const diagUpper = addBox(g, [1.1, 0.2, 0.18], mats.darkOak, [
      midBayX - 0.25,
      (2.76 + sideTopY - 0.26) * 0.5,
      zLine
    ]);
    diagUpper.rotation.z = -0.68;
  });

  // Grand Curved East Tower Arch framing the entrance to the tower bay (IMG_3941, 3947)
  const archSpan = N.zSouthInt - N.zNorthInt - 0.36;
  const archHalf = archSpan * 0.5;
  const archShape = new THREE.Shape();
  archShape.moveTo(-archHalf, 2.25);
  // Top edge level under the belfry ceiling, stepping down under the roof slopes at the sides
  const archKnee = Math.min(archHalf - 0.05, kneeZ(ceilY - 0.05));
  archShape.lineTo(-archHalf, roofUnderY(archHalf));
  archShape.lineTo(-archKnee, ceilY - 0.05);
  archShape.lineTo(archKnee, ceilY - 0.05);
  archShape.lineTo(archHalf, roofUnderY(archHalf));
  archShape.lineTo(archHalf, 2.25);
  // Elliptical/four-centered Tudor oak arch underside
  const segs = 24;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const ang = t * Math.PI;
    const uz = Math.cos(ang) * archHalf;
    const vy = 2.45 + Math.sin(ang) * 1.68;
    archShape.lineTo(uz, vy);
  }
  archShape.closePath();
  const towerArchGeo = new THREE.ExtrudeGeometry(archShape, { depth: 0.26, bevelEnabled: false });
  towerArchGeo.rotateY(Math.PI / 2);
  applyBoxUVs(towerArchGeo, 0.5);
  const towerArch = new THREE.Mesh(towerArchGeo, mats.darkOak);
  towerArch.position.set(T.eastPostX - 0.13, 0, 0);
  towerArch.castShadow = true;
  g.add(towerArch);

  // Carved wooden ceiling boss at the apex of the East tower arch (IMG_3947!)
  const archBoss = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13, 0), mats.darkOak);
  archBoss.position.set(T.eastPostX, 4.1, 0);
  g.add(archBoss);

  // Dramatic West Wall Chevron / V-Braces framing Window 5 (IMG_3946, 3947!)
  [-1, 1].forEach((sideZ) => {
    const brace = addBox(g, [0.22, 0.22, 3.15], mats.darkOak, [T.westPostX, 3.1, sideZ * 1.15]);
    brace.rotation.x = sideZ * 0.72;

    const upperBrace = addBox(g, [0.2, 0.2, 1.55], mats.darkOak, [T.westPostX, 3.82, sideZ * 1.75]);
    upperBrace.rotation.x = sideZ * 0.78;
  });

  // 9-Panel Coffered Boarded Belfry Ceiling + Recessed Centre Hatch + Three Bell Ropes (IMG_3946, 3947, tower-base photo)
  // Mid-brown tongue-and-groove boarded panels framed by slim moulded ribs, set within the black oak tie-beams & plates.
  // Placed in ceilingGroup so Roof Cutaway toggles it cleanly!
  const belfryCeil = new THREE.Group();
  const cWidth = bayLen - 0.1;
  const cDepth = 3.45;
  const cX0 = midBayX - cWidth * 0.5;
  const cZ0 = -cDepth * 0.5;
  const cellW = cWidth / 3;
  const cellD = cDepth / 3;
  const deckT = 0.04;
  const deckY = ceilY; // Underside of the boarding rests on the tie-beams & plates
  // Centre panel is a trap-door hatch set up into the ringing chamber: its underside sits just below the
  // belfry box's floor (y = T.baseY), so the well is as deep as the tower allows
  const hatchRise = T.baseY - deckY - 0.01;

  const boardSeamW = 0.008;
  const boardPitch = 0.115;
  const seams: Seam[] = [];
  const hatchSeams: Seam[] = [];
  for (let ix = 0; ix < 3; ix++) {
    for (let iz = 0; iz < 3; iz++) {
      const cx = cX0 + (ix + 0.5) * cellW;
      const cz = cZ0 + (iz + 0.5) * cellD;
      const isHatch = ix === 1 && iz === 1;
      const underY = deckY + (isHatch ? hatchRise : 0);
      addBox(belfryCeil, [cellW, deckT, cellD], mats.medOak, [cx, underY + deckT * 0.5, cz], { receive: true });

      // Boards run East-West (the hatch's run North-South); dark seams hang 1mm below so they never share its plane
      if (isHatch) {
        for (let bx = -cellW * 0.5 + boardPitch; bx < cellW * 0.5 - 0.04; bx += boardPitch) {
          hatchSeams.push([cx + bx, underY - 0.001, cz, cellD - 0.16]);
        }
      } else {
        for (let bz = -cellD * 0.5 + boardPitch; bz < cellD * 0.5 - 0.04; bz += boardPitch) {
          seams.push([cx, underY - 0.001, cz + bz, cellW - 0.06]);
        }
      }

      if (isHatch) {
        // Boarded lining around the recessed hatch opening
        [-1, 1].forEach((side) => {
          addBox(belfryCeil, [cellW, hatchRise, 0.025], mats.medOak, [
            cx,
            deckY + hatchRise * 0.5,
            cz + side * (cellD * 0.5 - 0.0125)
          ]);
          addBox(belfryCeil, [0.025, hatchRise, cellD - 0.05], mats.medOak, [
            cx + side * (cellW * 0.5 - 0.0125),
            deckY + hatchRise * 0.5,
            cz
          ]);
        });
        // The trap door's own ledged frame, a dark shadow gap where it sits in the opening
        const frameW = 0.06;
        const lip = deckY + hatchRise - 0.012;
        [-1, 1].forEach((side) => {
          addBox(belfryCeil, [cellW - 0.05, 0.022, frameW], mats.darkOak, [
            cx,
            lip,
            cz + side * (cellD * 0.5 - 0.025 - frameW * 0.5 - 0.012)
          ]);
          const fz = new THREE.Mesh(
            new THREE.BoxGeometry(frameW, 0.022, cellD - 0.05 - 0.024 - frameW * 2),
            mats.darkOak
          );
          fz.position.set(cx + side * (cellW * 0.5 - 0.025 - frameW * 0.5 - 0.012), lip, cz);
          belfryCeil.add(fz);
        });
        // Dark shadow gap between the trap door's frame and the lining of the opening
        const gapMat = new THREE.MeshBasicMaterial({ color: 0x0b0806 });
        [-1, 1].forEach((side) => {
          addBox(belfryCeil, [cellW - 0.05, 0.02, 0.012], gapMat, [
            cx,
            lip + 0.001,
            cz + side * (cellD * 0.5 - 0.025 - 0.006)
          ]);
          addBox(belfryCeil, [0.012, 0.02, cellD - 0.074], gapMat, [
            cx + side * (cellW * 0.5 - 0.025 - 0.006),
            lip + 0.001,
            cz
          ]);
        });
      }
    }
  }
  const seamGeo = new THREE.BoxGeometry(1, 0.004, boardSeamW);
  const seamMesh = new THREE.InstancedMesh(seamGeo, mats.darkOak, seams.length);
  const seamMat4 = new THREE.Matrix4();
  const seamPos = new THREE.Vector3();
  const seamQuat = new THREE.Quaternion();
  const seamScale = new THREE.Vector3();
  seams.forEach(([x, y, z, len], i) => {
    seamMat4.compose(seamPos.set(x, y, z), seamQuat, seamScale.set(len, 1, 1));
    seamMesh.setMatrixAt(i, seamMat4);
  });
  seamMesh.instanceMatrix.needsUpdate = true;
  belfryCeil.add(seamMesh);
  const hatchSeamGeo = new THREE.BoxGeometry(boardSeamW, 0.004, 1);
  const hatchSeamMesh = new THREE.InstancedMesh(hatchSeamGeo, mats.darkOak, hatchSeams.length);
  hatchSeams.forEach(([x, y, z, len], i) => {
    seamMat4.compose(seamPos.set(x, y, z), seamQuat, seamScale.set(1, 1, len));
    hatchSeamMesh.setMatrixAt(i, seamMat4);
  });
  hatchSeamMesh.instanceMatrix.needsUpdate = true;
  belfryCeil.add(hatchSeamMesh);

  // Slim moulded coffer ribs (4 x 4 grid), proud of the boarding
  const ribDrop = 0.09;
  for (let i = 0; i <= 3; i++) {
    addBox(belfryCeil, [0.07, ribDrop, cDepth], mats.medOak, [cX0 + i * cellW, deckY - ribDrop * 0.5, 0]);

    addBox(belfryCeil, [cWidth + 0.07, ribDrop - 0.01, 0.07], mats.medOak, [
      midBayX,
      deckY - ribDrop * 0.5 + 0.005,
      cZ0 + i * cellD
    ]);
  }

  // Three bell ropes drop through brass-bushed holes running in a slightly diagonal line down the North column
  // of coffers, one hole per panel (tower-base photo), and hang free, each ending in a whipped tail
  const ropeMat = createRopeMaterial();
  // Ropes & tails live with the interior, not the ceiling, so the floorplan cutaway shows them full length
  const bellRopes = new THREE.Group();
  bellRopes.userData.ringsBells = true; // clicking any rope rings the bells (main.js)
  const whippingMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5c, roughness: 0.9 });
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x0b0806 });
  const ropeEndY = floorY + 1.05;
  const ropeHoles = [
    [cX0 + cellW * 2.45, cZ0 + cellD * 0.5], // East panel, furthest North (above the organ)
    [cX0 + cellW * 1.35, cZ0 + cellD * 0.64], // Middle panel, towards its West rib (vestry)
    [cX0 + cellW * 0.75, cZ0 + cellD * 0.78] // West panel, closest to the centre (vestry)
  ];
  // The East rope is looped back over the vestry partition's capping rail so it hangs clear of the organ
  const capTop = floorY + T.vestryPartitionH + 0.04;
  const ropeR = 0.012;
  ropeHoles.forEach(([hx, hz], i) => {
    const boss = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 8, 20), mats.brass);
    boss.rotation.x = Math.PI / 2;
    boss.position.set(hx, deckY - 0.012, hz);
    belfryCeil.add(boss);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.034, 16), holeMat);
    hole.rotation.x = Math.PI / 2;
    hole.position.set(hx, deckY - 0.003, hz);
    belfryCeil.add(hole);

    let tailX = hx;
    if (i === 0) {
      const pX = T.vestryPartitionX;
      const overY = capTop + ropeR + 0.001;
      const eastLip = new THREE.Vector3(pX + 0.07, overY - 0.006, hz);
      const hangX = pX - 0.06 - ropeR - 0.002;
      tailX = hangX;
      const path = new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(hx, deckY, hz),
          new THREE.Vector3(hx, deckY - 0.12, hz),
          new THREE.Vector3()
            .lerpVectors(new THREE.Vector3(hx, deckY - 0.12, hz), eastLip, 0.5)
            .setY((deckY + overY) * 0.5 - 0.06),
          eastLip,
          new THREE.Vector3(pX, overY, hz),
          new THREE.Vector3(pX - 0.05, overY - 0.004, hz),
          new THREE.Vector3(hangX, capTop - 0.06, hz),
          new THREE.Vector3(hangX, capTop - 0.3, hz)
        ],
        false,
        'centripetal'
      );
      // The loop over the rail stays put (the rope slides over it); only the straight fall below it moves
      bellRopes.add(buildTwistedRope(0, ropeR, ropeMat, path));
    }
    // The fall carries a metre of spare rope above the hole (or the rail), clipped away there, so when the bell
    // swings main.js can slide the whole fall up and down without stretching its lay
    const fallTop = i === 0 ? capTop - 0.3 : deckY;
    const spare = 0.95;
    const ropeLen = fallTop + spare - ropeEndY;
    const fallMat = ropeMat.clone();
    fallMat.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), fallTop)];
    fallMat.clipShadows = true;
    const rope = buildTwistedRope(ropeLen, ropeR, fallMat);
    rope.position.set(tailX, ropeEndY + ropeLen * 0.5, hz);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.05, 12), whippingMat);
    tail.position.set(tailX, ropeEndY + 0.01, hz);
    const bellName = ['Tenor', 'Treble', 'Second'][i];
    rope.userData.bellRope = { bell: bellName, baseY: rope.position.y };
    // A thin rope is hard to click: an invisible 5cm-radius sleeve over the visible fall takes the clicks
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, ropeLen - spare, 6), ropeMat);
    sleeve.position.y = -spare * 0.5;
    sleeve.visible = false;
    rope.add(sleeve);
    // The striped woollen sally at hand height rides on the fall, so it rises & falls with the rope
    const sallyLen = 0.62;
    const sally = buildSally(sallyLen, 0.026, ropeR);
    sally.position.y = floorY + 1.62 - rope.position.y;
    rope.add(sally);
    tail.userData.bellRope = { bell: bellName, baseY: tail.position.y };
    bellRopes.add(rope, tail);
  });

  capSolidMasonry(belfryCeil); // the boarded tower ceiling is solid when the tour camera rises through it
  // 1900: the bells were chimed, not swung, so no ringing ropes (an Ellacombe chiming frame instead, below)
  bellRopes.userData.era = 'today';
  g.add(bellRopes);
  g.add(buildChimingFrame(mats, floorY));
  ceilingGroup.add(belfryCeil);

  // 2. Cream-plastered Vestry Partition Wall (x = -5.18, height = 2.25m, central doorway, IMG_3941, 3942)
  const pX = T.vestryPartitionX;
  const pH = T.vestryPartitionH;
  const doorHalf = 0.52;
  [-1, 1].forEach((sideZ) => {
    const segW = N.zSouthInt - doorHalf;
    addBox(g, [0.08, pH, segW], mats.plaster, [pX, floorY + pH * 0.5, sideZ * (doorHalf + segW * 0.5)], {
      cast: true,
      receive: true
    });

    // Dark timber vertical jamb & top capping rail
    addBox(g, [0.11, pH, 0.07], mats.darkOak, [pX, floorY + pH * 0.5, sideZ * doorHalf]);
  });
  addBox(g, [0.12, 0.08, N.zSouthInt * 2], mats.darkOak, [pX, floorY + pH, 0]);

  // 3. West Vestry Interior Contents (IMG_3944, IMG_3945)
  // Crimson vestry carpet
  const vestryLen = pX - N.xWestInt;
  const vCarpet = new THREE.Mesh(
    new THREE.BoxGeometry(vestryLen - 0.04, 0.015, N.zSouthInt * 2 - 0.04),
    mats.carpetCrimson
  );
  vCarpet.position.set(N.xWestInt + vestryLen * 0.5, floorY + 0.008, 0);
  vCarpet.receiveShadow = true;
  vCarpet.userData.era = 'today'; // no carpet in 1900
  g.add(vCarpet);

  // Vestry table with royal-purple pleated cloth, stacked blue hymn books & mirror (IMG_3944)
  addBox(g, [0.68, 0.05, 1.55], mats.medOak, [pX - 0.42, floorY + 0.78, -1.48], { cast: true });

  // Purple cloth curtain gathered on a rail beneath the tabletop, hanging to just above the carpet
  const curtain = buildTableCurtain(0.66, 1.53, 0.735, mats.purpleCloth, mats.iron);
  curtain.position.set(pX - 0.42, floorY + 0.755, -1.48);
  g.add(curtain);

  // Tall pile of blue hymn books on the vestry table (IMG_3944)
  g.add(buildHymnBookPile(pX - 0.35, floorY + 0.805, -1.95, 0.68));

  // Tilted mirror on vestry table
  const mirrorFrame = addBox(g, [0.04, 0.46, 0.32], mats.iron, [pX - 0.22, floorY + 1.02, -1.45]);
  mirrorFrame.rotation.z = -0.22;

  // Two oak vestry chairs along West wall (IMG_3944)
  [-1.95, -1.15].forEach((cz) => {
    const chair = new THREE.Group();
    const cSeat = addBox(chair, [0.44, 0.05, 0.44], mats.carpetGold);
    cSeat.position.y = 0.46;
    addBox(chair, [0.05, 0.54, 0.42], mats.darkOak, [-0.2, 0.72, 0]);
    [
      [-0.18, -0.18],
      [0.18, -0.18],
      [-0.18, 0.18],
      [0.18, 0.18]
    ].forEach(([lx, lz]) => {
      addBox(chair, [0.04, 0.46, 0.04], mats.darkOak, [lx, 0.23, lz]);
    });
    chair.position.set(N.xWestInt + 0.34, floorY, cz);
    g.add(chair);
  });

  // Tall grey metal safe/cabinet (IMG_3945)
  const safeMat = new THREE.MeshStandardMaterial({ color: 0x62737c, roughness: 0.55, metalness: 0.35 });
  addBox(g, [0.55, 1.8, 0.82], safeMat, [pX - 0.36, floorY + 0.9, 1.15], { cast: true });

  // Dark wooden vestry cupboard against South wall (IMG_3945)
  addBox(g, [1.15, 1.85, 0.52], mats.darkOak, [N.xWestInt + 0.92, floorY + 0.92, N.zSouthInt - 0.3], { cast: true });

  // Electrical Meter Board on SW wall (marked "Meters" on 1974 plan & seen in IMG_3945!)
  const meterPanel = boxMesh([0.06, 0.72, 0.62], mats.medOak, [N.xWestInt + 0.04, floorY + 1.55, 1.85]);
  meterPanel.userData.era = 'today'; // electrical consumer unit
  g.add(meterPanel);
  const meterBox = boxMesh([0.14, 0.26, 0.22], mats.wax, [N.xWestInt + 0.1, floorY + 1.48, 1.82]);
  meterBox.userData.era = 'today'; // electrical consumer unit
  g.add(meterBox);

  // Detailed British 2kg CO2 Fire Extinguisher beside vestry doorway + wall ID sign (IMG_3942)
  const extG = new THREE.Group();
  const extRedMat = new THREE.MeshStandardMaterial({ color: 0xc8161d, roughness: 0.24, metalness: 0.28 });
  const extBlackMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.55, metalness: 0.15 });
  const extMetalMat = new THREE.MeshStandardMaterial({ color: 0xbec4ca, roughness: 0.3, metalness: 0.85 });
  const extPinMat = new THREE.MeshStandardMaterial({ color: 0xf0c420, roughness: 0.42, metalness: 0.25 });

  // Smooth spun-steel tank with rounded dome shoulder & neck collar
  const tankPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.058, 0.0),
    new THREE.Vector2(0.062, 0.012),
    new THREE.Vector2(0.062, 0.365),
    new THREE.Vector2(0.059, 0.395),
    new THREE.Vector2(0.049, 0.422),
    new THREE.Vector2(0.032, 0.442),
    new THREE.Vector2(0.018, 0.452),
    new THREE.Vector2(0.018, 0.474),
    new THREE.Vector2(0.0, 0.474)
  ];
  const tankMesh = new THREE.Mesh(new THREE.LatheGeometry(tankPts, 20), extRedMat);
  tankMesh.castShadow = true;
  tankMesh.receiveShadow = true;
  extG.add(tankMesh);

  // Subtle black rubber base ring
  const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(0.0635, 0.0645, 0.018, 20), extBlackMat);
  baseRing.position.y = 0.009;
  extG.add(baseRing);

  // Curved UK BS EN 3 CO2 front label decal (black CO2 band + white instruction graphic)
  const lblCanvas = makeCanvas(256, 256);
  const lctx = canvas2d(lblCanvas);
  lctx.fillStyle = '#c8161d';
  lctx.fillRect(0, 0, 256, 256);
  // Black CO2 identification band
  lctx.fillStyle = '#141618';
  lctx.fillRect(14, 16, 228, 66);
  lctx.fillStyle = '#ffffff';
  lctx.font = 'bold 42px sans-serif';
  lctx.textAlign = 'center';
  lctx.fillText('CO2', 128, 63);
  // White instruction box & fire-class icons
  lctx.fillStyle = '#f4f2ec';
  lctx.fillRect(20, 94, 216, 144);
  lctx.fillStyle = '#1c1c1e';
  lctx.font = 'bold 16px sans-serif';
  lctx.fillText('FIRE EXTINGUISHER', 128, 118);
  lctx.fillStyle = '#44464a';
  for (let i = 0; i < 4; i++) {
    lctx.fillRect(34, 132 + i * 14, 188, 5);
  }
  // Small safety pictogram squares
  ['#c8161d', '#1c1c1e', '#1e7b34'].forEach((col, i) => {
    lctx.fillStyle = col;
    lctx.fillRect(42 + i * 62, 196, 46, 30);
    lctx.fillStyle = '#ffffff';
    lctx.fillRect(54 + i * 62, 204, 22, 14);
  });
  const lblTex = canvasTexture(lblCanvas);
  const lblMat = new THREE.MeshStandardMaterial({ map: lblTex, roughness: 0.35, metalness: 0.1 });
  const lblMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.063, 0.063, 0.19, 18, 1, true, -0.95, 1.9), lblMat);
  lblMesh.position.y = 0.21;
  extG.add(lblMesh);

  // Brass neck hex nut & chrome valve assembly
  const neckNut = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.018, 6), mats.brass);
  neckNut.position.y = 0.48;
  extG.add(neckNut);
  const valveBody = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.017, 0.044, 12), extMetalMat);
  valveBody.position.y = 0.51;
  extG.add(valveBody);

  // Yellow safety pull-pin & ring on the side of the valve
  const pinRing = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0024, 6, 14), extPinMat);
  pinRing.position.set(0.024, 0.518, -0.008);
  pinRing.rotation.y = Math.PI / 3;
  extG.add(pinRing);

  // Lower fixed red carry handle + upper angled squeeze-grip operating lever (IMG_3942)
  const carryHandle = addBox(extG, [0.014, 0.013, 0.105], extRedMat, [0, 0.506, -0.056]);
  carryHandle.rotation.x = 0.12;

  const squeezeLever = addBox(extG, [0.016, 0.012, 0.118], extRedMat, [0, 0.548, -0.056]);
  squeezeLever.rotation.x = -0.38;

  // Brass swivel elbow + matte-black flared conical CO2 discharge horn (concentric assembly pivoted at swivel)
  const swivel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.032, 8), mats.brass);
  swivel.rotation.x = Math.PI / 2;
  swivel.position.set(0, 0.506, 0.024);
  extG.add(swivel);

  const hornGroup = new THREE.Group();
  hornGroup.position.set(0, 0.506, 0.038);
  hornGroup.rotation.set(-0.22, 0, 0.2);
  const hornElbow = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 8), extBlackMat);
  hornGroup.add(hornElbow);
  const hornStem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.0085, 0.075, 10), extBlackMat);
  hornStem.position.y = -0.038;
  hornGroup.add(hornStem);
  const hornCone = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.031, 0.21, 16, 1, false), extBlackMat);
  hornCone.position.y = -0.175;
  hornCone.castShadow = true;
  hornGroup.add(hornCone);
  const hornRim = new THREE.Mesh(new THREE.TorusGeometry(0.0305, 0.003, 6, 16), extBlackMat);
  hornRim.rotation.x = Math.PI / 2;
  hornRim.position.y = -0.28;
  hornGroup.add(hornRim);
  extG.add(hornGroup);

  extG.position.set(pX + 0.14, floorY, -0.72);
  extG.rotation.y = Math.PI * 0.42; // Front label, squeeze levers & black CO2 horn facing out toward Nave/Organ
  extG.userData.era = 'today';
  g.add(extG);

  // Small UK CO2 fire-extinguisher wall sign mounted right above it on the vestry partition (IMG_3942)
  const signCanvas = makeCanvas(128, 96);
  const sctx = canvas2d(signCanvas);
  sctx.fillStyle = '#f2f0ea';
  sctx.fillRect(0, 0, 128, 96);
  sctx.fillStyle = '#141618';
  sctx.fillRect(6, 6, 54, 84);
  sctx.fillStyle = '#c8161d';
  sctx.fillRect(66, 6, 56, 38);
  sctx.fillStyle = '#1e7b34';
  sctx.fillRect(66, 50, 56, 40);
  sctx.fillStyle = '#ffffff';
  sctx.font = 'bold 20px sans-serif';
  sctx.textAlign = 'center';
  sctx.fillText('CO2', 33, 56);
  const signTex = canvasTexture(signCanvas);
  const signMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.11, 0.085),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.45 })
  );
  signMesh.rotation.y = Math.PI / 2;
  signMesh.position.set(pX + 0.046, floorY + 0.78, -0.74);
  signMesh.userData.era = 'today';
  g.add(signMesh);

  // 9-litre water extinguisher on the other (South, left-hand) side of the vestry doorway: all red, with a red
  // identification band, a black hose looped down the side to a nozzle clipped near the base
  const waterG = buildWaterExtinguisher();
  waterG.position.set(pX + 0.16, floorY, 0.72);
  waterG.rotation.y = Math.PI * 0.58; // label & hose facing out toward the nave
  waterG.userData.era = 'today';
  g.add(waterG);

  // Matching water-extinguisher ID sign above it on the partition
  const wsCanvas = makeCanvas(128, 96);
  const wsctx = canvas2d(wsCanvas);
  wsctx.fillStyle = '#f2f0ea';
  wsctx.fillRect(0, 0, 128, 96);
  wsctx.fillStyle = '#c8161d';
  wsctx.fillRect(6, 6, 54, 84);
  wsctx.fillStyle = '#ffffff';
  wsctx.font = 'bold 15px sans-serif';
  wsctx.textAlign = 'center';
  wsctx.fillText('WATER', 33, 54);
  wsctx.fillStyle = '#1e7b34';
  wsctx.fillRect(66, 6, 56, 38);
  wsctx.fillStyle = '#c8161d';
  wsctx.fillRect(66, 50, 56, 40);
  const wsTex = canvasTexture(wsCanvas);
  const wSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.11, 0.085),
    new THREE.MeshStandardMaterial({ map: wsTex, roughness: 0.45 })
  );
  wSign.rotation.y = Math.PI / 2;
  wSign.position.set(pX + 0.046, floorY + 0.86, 0.74);
  wSign.userData.era = 'today';
  g.add(wSign);

  return g;
}

export function buildFloorsAndCeilings(interiorGroup: THREE.Group, ceilingGroup: THREE.Group, mats: ChurchMaterials) {
  const N = DIM.nave;
  const C = DIM.chancel;
  const T = DIM.tower;
  // -------------------------------------------------------
  // 1. FLOORS, STEPS & CARPET RUNNER
  // -------------------------------------------------------
  // Nave diagonal terracotta/black quarry tile floor
  const naveW = N.xEastInt - N.xWestInt + 0.2;
  const naveD = N.zSouthInt - N.zNorthInt + 0.1;
  const naveFloorGeo = new THREE.PlaneGeometry(naveW, naveD);
  naveFloorGeo.rotateX(-Math.PI / 2);
  applyBoxUVs(naveFloorGeo, 0.76);
  const naveFloor = new THREE.Mesh(naveFloorGeo, mats.quarryTile);
  naveFloor.position.set((N.xWestInt + N.xEastInt) * 0.5, DIM.naveFloorY, 0);
  naveFloor.receiveShadow = true;
  interiorGroup.add(naveFloor);

  // Chancel lower floor (x: 3.20 to 6.25, y = 0.26)
  const chanLowLen = 6.25 - C.xWestInt;
  const chanW = C.zSouthInt - C.zNorthInt + 0.1;
  // Chancel floor stops at the side walls' plaster faces so its west riser doesn't overlap the walls' end faces
  const chanLowGeo = new THREE.BoxGeometry(chanLowLen, DIM.chancelFloorY, C.zSouthInt - C.zNorthInt);
  applyBoxUVs(chanLowGeo, 0.76);
  const chanLow = new THREE.Mesh(chanLowGeo, mats.quarryTile);
  chanLow.position.set(C.xWestInt + chanLowLen * 0.5, DIM.chancelFloorY * 0.5, 0);
  chanLow.receiveShadow = true;
  interiorGroup.add(chanLow);

  // Sanctuary Step 1 (x: 6.25 to 7.40, y = 0.40) — Ornate Victorian Encaustic Tiles!
  const step1Len = 7.4 - 6.25;
  const step1Geo = new THREE.BoxGeometry(step1Len, DIM.sanctuaryStep1Y, chanW);
  applyBoxUVs(step1Geo, 1.05);
  const step1 = new THREE.Mesh(step1Geo, mats.sanctuaryTile);
  step1.position.set(6.25 + step1Len * 0.5, DIM.sanctuaryStep1Y * 0.5, 0);
  step1.receiveShadow = true;
  interiorGroup.add(step1);

  // Sanctuary Step 2 / Altar Platform (x: 7.40 to 9.05, y = 0.54)
  const step2Len = C.xEastInt - 7.4 + 0.08;
  const step2Geo = new THREE.BoxGeometry(step2Len, DIM.sanctuaryStep2Y, chanW);
  applyBoxUVs(step2Geo, 1.05);
  const step2 = new THREE.Mesh(step2Geo, mats.sanctuaryTile);
  step2.position.set(7.4 + step2Len * 0.5, DIM.sanctuaryStep2Y * 0.5, 0);
  step2.receiveShadow = true;
  interiorGroup.add(step2);

  // The two sanctuary steps are fronted with dressed stone, not tiles
  [
    [6.25, DIM.chancelFloorY, DIM.sanctuaryStep1Y],
    [7.4, DIM.sanctuaryStep1Y, DIM.sanctuaryStep2Y]
  ].forEach(([sx, y0, y1]) => {
    const faceGeo = new THREE.BoxGeometry(0.016, y1 - y0 + 0.004, chanW);
    applyBoxUVs(faceGeo, 0.45);
    const face = new THREE.Mesh(faceGeo, mats.ashlarWarm);
    face.position.set(sx - 0.008, (y0 + y1) * 0.5 + 0.002, 0);
    face.receiveShadow = true;
    interiorGroup.add(face);
  });

  // Warm cream-gold carpet runner through Rood Screen & up the Sanctuary steps (IMG_3937, 3938)
  // One width all the way from the doorway to the altar, filling the screen opening between its quoins
  const runW = 1.2;
  const addRunner = (x0: number, x1: number, y: number, w = runW) => {
    const r = boxMesh([x1 - x0, 0.018, w], mats.carpetGold, [(x0 + x1) * 0.5, y + 0.01, 0], { receive: true });
    r.userData.era = 'today'; // no carpet in 1900
    interiorGroup.add(r);
  };
  addRunner(2.55, 3.22, DIM.naveFloorY, 1.28);
  // Either side of the opening the nave carpet carries on, left and right, along the front of the rood screen's
  // dwarf walls to the side walls
  const dwarfFaceX = N.xEastInt + 0.02 - 0.18 - 0.002;
  [-1, 1].forEach((side) => {
    const z0 = 0.64;
    const z1 = N.zSouthInt - 0.01;
    const strip = addBox(
      interiorGroup,
      [dwarfFaceX - 2.55, 0.018, z1 - z0],
      mats.carpetGold,
      [(2.55 + dwarfFaceX) * 0.5, DIM.naveFloorY + 0.01, side * (z0 + z1) * 0.5],
      { receive: true }
    );
    strip.userData.era = 'today';
  });
  addRunner(C.xWestInt - 0.021, 6.26, DIM.chancelFloorY); // wraps over the riser's top edge
  addRunner(6.25 - 0.037, 7.41, DIM.sanctuaryStep1Y);
  addRunner(7.4 - 0.037, 8.2, DIM.sanctuaryStep2Y);
  // Vertical carpet risers on each step
  [
    [C.xWestInt - 0.011, DIM.naveFloorY + 0.019, DIM.chancelFloorY + 0.019, runW], // nave -> chancel, proud of the step face
    [6.25 - 0.027, DIM.chancelFloorY + 0.019, DIM.sanctuaryStep1Y + 0.019, runW], // over the stone step face
    [7.4 - 0.027, DIM.sanctuaryStep1Y + 0.019, DIM.sanctuaryStep2Y + 0.019, runW]
  ].forEach(([rx, y0, y1, rw]) => {
    const riser = addBox(interiorGroup, [0.02, y1 - y0, rw], mats.carpetGold, [rx, (y0 + y1) * 0.5, 0]);
    riser.userData.era = 'today';
  });

  // -------------------------------------------------------
  // 2. NAVE COVED DUCK-EGG BLUE CEILING & CHANCEL WAGON-RIBBED BARREL VAULT
  //    (Placed in ceilingGroup so Roof Cutaway hides them cleanly!)
  // -------------------------------------------------------
  // Nave Coved Duck-Egg Blue Ceiling (x: -3.72 to 3.20, IMG_3936, 3941, 3948)
  const naveCeilLen = N.xEastInt - T.eastPostX;
  const naveCeilPts = [
    new THREE.Vector2(-N.zSouthInt, N.eavesY),
    new THREE.Vector2(-1.68, 4.38),
    new THREE.Vector2(-0.85, 5.05),
    new THREE.Vector2(0, 5.26),
    new THREE.Vector2(0.85, 5.05),
    new THREE.Vector2(1.68, 4.38),
    new THREE.Vector2(N.zSouthInt, N.eavesY)
  ];
  const naveCeilPos: number[] = [];
  for (let i = 0; i < naveCeilPts.length - 1; i++) {
    const a = naveCeilPts[i];
    const b = naveCeilPts[i + 1];
    // Quad spanning x: T.eastPostX -> N.xEastInt
    const p0 = [T.eastPostX, a.y, a.x];
    const p1 = [N.xEastInt, a.y, a.x];
    const p2 = [N.xEastInt, b.y, b.x];
    const p3 = [T.eastPostX, b.y, b.x];
    naveCeilPos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
  }
  const naveCeilGeo = new THREE.BufferGeometry();
  naveCeilGeo.setAttribute('position', new THREE.Float32BufferAttribute(naveCeilPos, 3));
  naveCeilGeo.computeVertexNormals();
  const naveCeilMesh = new THREE.Mesh(naveCeilGeo, mats.naveCeilingBlue);
  naveCeilMesh.receiveShadow = true;
  ceilingGroup.add(naveCeilMesh);

  // Dark oak wall plates along Nave N & S eaves
  [-1, 1].forEach((sideZ) => {
    addBox(ceilingGroup, [naveCeilLen + 0.1, 0.14, 0.14], mats.darkOak, [
      (T.eastPostX + N.xEastInt) * 0.5,
      N.eavesY - 0.04,
      sideZ * (N.zSouthInt - 0.05)
    ]);
  });

  // Central Nave Tie-Beam + King-Post + Y-Struts + Ridge Beam (IMG_3948!)
  const tieX = -0.52;
  addBox(ceilingGroup, [0.24, 0.24, N.zSouthInt * 2 + 0.05], mats.darkOak, [tieX, N.eavesY + 0.04, 0], { cast: true });

  const kingH = 5.2 - (N.eavesY + 0.12);
  addBox(ceilingGroup, [0.16, kingH, 0.16], mats.darkOak, [tieX, N.eavesY + 0.12 + kingH * 0.5, 0]);

  // Y-shaped diagonal struts on king-post (IMG_3948)
  [-1, 1].forEach((sideZ) => {
    const strut = addBox(ceilingGroup, [0.11, 0.95, 0.11], mats.darkOak, [tieX, 4.55, sideZ * 0.34]);
    strut.rotation.x = sideZ * 0.72;
  });

  addBox(ceilingGroup, [naveCeilLen, 0.14, 0.14], mats.darkOak, [(T.eastPostX + N.xEastInt) * 0.5, 5.18, 0]);

  // Carved limewood angels standing on the South wall-plate above the Attenborough plaque & the Roll of Honour.
  // It leans back against the coved ceiling, parallel to its first facet, its lobed base resting on the plate.
  {
    // Darkened, aged oak tone
    const angelMat = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.8, vertexColors: true });
    const angelField = canvasToBlurredHeightField(createCarvedAngelHeightMap());
    const angel = buildPiercedCarvingFromField(angelField, 0.045, angelMat);
    const cove0 = new THREE.Vector3(0, naveCeilPts[6].y, naveCeilPts[6].x); // eaves, South
    const cove1 = new THREE.Vector3(0, naveCeilPts[5].y, naveCeilPts[5].x);
    const upSlope = cove1.clone().sub(cove0).normalize();
    const intoRoom = new THREE.Vector3(0, upSlope.z, -upSlope.y); // perpendicular to the cove, facing the nave
    const across = upSlope.clone().cross(intoRoom); // -X: the viewer's right when facing the South wall
    const plateTopY = N.eavesY - 0.04 + 0.07;
    const sBase = (plateTopY + 0.005 - cove0.y) / upSlope.y; // distance up the cove to the plate top
    const centre = cove0
      .clone()
      .addScaledVector(upSlope, sBase + 0.21)
      .addScaledVector(intoRoom, 0.006);
    // One over the Attenborough plaque, its twin at the same height over the Roll of Honour (x = -2.32)
    [1.88, -2.32].forEach((x, k) => {
      const a = k === 0 ? angel : angel.clone();
      a.matrix.makeBasis(across, upSlope, intoRoom);
      a.matrix.setPosition(centre.clone().setX(x));
      a.matrix.decompose(a.position, a.quaternion, a.scale);
      a.userData.era = 'today'; // the angels came after 1900
      ceilingGroup.add(a);
    });

    // Two half angels on the North wall-plate above the doorway: the same carving split down its centre line, each
    // half with one outspread wing, set either side of the door with their cut edges towards each other
    const nCove0 = new THREE.Vector3(0, naveCeilPts[0].y, naveCeilPts[0].x); // eaves, North
    const nCove1 = new THREE.Vector3(0, naveCeilPts[1].y, naveCeilPts[1].x);
    const nUp = nCove1.clone().sub(nCove0).normalize();
    const nInto = new THREE.Vector3(0, -nUp.z, nUp.y); // facing the nave (+Z)
    const nAcross = nUp.clone().cross(nInto); // +X: the viewer's right when facing the North wall
    const nBase = (plateTopY + 0.005 - nCove0.y) / nUp.y;
    const nCentre = nCove0
      .clone()
      .addScaledVector(nUp, nBase + 0.21)
      .addScaledVector(nInto, 0.006);
    const halfW = angelField.cw / 2;
    const doorX = DIM.porch.xCenter;
    [
      { srcX: 0, x: doorX - 0.22 - halfW * 0.0005 }, // left half (West wing) West of the door
      { srcX: halfW, x: doorX + 0.22 + halfW * 0.0005 } // right half (East wing) East of the door
    ].forEach(({ srcX, x }) => {
      const h = buildPiercedCarvingFromField(angelField, 0.045, angelMat, 1, { srcX, width: halfW });
      h.matrix.makeBasis(nAcross, nUp, nInto);
      h.matrix.setPosition(nCentre.clone().setX(x));
      h.matrix.decompose(h.position, h.quaternion, h.scale);
      h.userData.era = 'today';
      ceilingGroup.add(h);
    });
  }

  // Chancel Dark Oak Wagon-Ribbed Barrel Vault (x: 3.20 to 9.00, IMG_3936, 3937, 3938!)
  // Built explicitly with world-space (x, y, z) quads arching cleanly UPWARD from z=-2.00 to z=+2.00
  const chanLen = C.xEastInt - C.xWestInt;
  const vaultR = C.zSouthInt; // 2.00m half-span
  const vaultRise = vaultR * 0.94;
  const vSegs = 24;
  const vaultPos: number[] = [];
  for (let i = 0; i < vSegs; i++) {
    const a0 = (i / vSegs) * Math.PI;
    const a1 = ((i + 1) / vSegs) * Math.PI;
    const z0 = -Math.cos(a0) * vaultR;
    const y0 = C.eavesY + Math.sin(a0) * vaultRise;
    const z1 = -Math.cos(a1) * vaultR;
    const y1 = C.eavesY + Math.sin(a1) * vaultRise;

    const p0 = [C.xWestInt, y0, z0];
    const p1 = [C.xEastInt + 0.04, y0, z0];
    const p2 = [C.xEastInt + 0.04, y1, z1];
    const p3 = [C.xWestInt, y1, z1];
    vaultPos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
  }
  const vaultGeo = new THREE.BufferGeometry();
  vaultGeo.setAttribute('position', new THREE.Float32BufferAttribute(vaultPos, 3));
  vaultGeo.computeVertexNormals();
  const vaultMesh = new THREE.Mesh(vaultGeo, mats.chancelPlaster);
  ceilingGroup.add(vaultMesh);

  // 15 closely-spaced curved dark oak wagon vault ribs along the Chancel!
  const ribCount = 15;
  for (let i = 0; i < ribCount; i++) {
    const rx = C.xWestInt + 0.18 + (i / (ribCount - 1)) * (chanLen - 0.36);
    const rib = new THREE.Mesh(new THREE.TorusGeometry(vaultR - 0.04, 0.055, 6, 26, Math.PI), mats.darkOak);
    rib.rotation.y = Math.PI / 2;
    rib.scale.set(1, 0.94, 1);
    rib.position.set(rx, C.eavesY, 0);
    ceilingGroup.add(rib);
  }

  // Two black spotlights fixed to the underside of the wooden chancel arch frame, low on its curve, trained on the
  // altar. The arch frame (built below) is a torus of radius vaultR + 0.04 and tube 0.14, squashed to 0.94 high.
  const altarAim = new THREE.Vector3(8.3, DIM.sanctuaryStep2Y + 0.95, 0);
  const soffitR = vaultR + 0.04 - 0.14;
  const soffitRise = soffitR * 0.94;
  [-1, 1].forEach((sideZ) => {
    // About a third of the way up the arch from its springing
    const a = sideZ < 0 ? Math.PI * 0.17 : Math.PI * 0.83;
    const surf = new THREE.Vector3(C.xWestInt + 0.04, C.eavesY + Math.sin(a) * soffitRise, -Math.cos(a) * soffitR);
    const inward = new THREE.Vector3(0, -Math.sin(a) * soffitR, Math.cos(a) * soffitRise).normalize();
    const spot = buildCeilingSpotlight(altarAim, surf, inward);
    spot.userData.era = 'today'; // electric
    ceilingGroup.add(spot);
  });

  // Heavy dark oak wall plates & longitudinal purlins on Chancel vault
  [-1, 1].forEach((sideZ) => {
    const cPlate = new THREE.Mesh(new THREE.BoxGeometry(chanLen - 0.01, 0.14, 0.16), mats.darkOak); // 5mm clear of the end walls (no z-fighting)
    cPlate.position.set(C.xWestInt + chanLen * 0.5, C.eavesY - 0.04, sideZ * (C.zSouthInt - 0.06));
    ceilingGroup.add(cPlate);
  });

  // Heavy chamfered dark oak Chancel Arch Frame at West entrance to Chancel (IMG_3936, 3937)
  const cArchFrame = new THREE.Mesh(new THREE.TorusGeometry(vaultR + 0.04, 0.14, 6, 26, Math.PI), mats.darkOak);
  cArchFrame.rotation.y = Math.PI / 2;
  cArchFrame.scale.set(1, 0.94, 1);
  cArchFrame.position.set(C.xWestInt + 0.04, C.eavesY, 0);
  ceilingGroup.add(cArchFrame);
}
