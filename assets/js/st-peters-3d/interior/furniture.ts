// Interior church furnishings: pews, kneelers, Glastonbury chairs, sanctuary/chancel fittings,
// pulpit, lectern and medieval octagonal font.
import * as THREE from 'three';
import { addBox } from '../mesh-utils.ts';
import { DIM } from '../dimensions.ts';
import { applyBoxUVs } from '../architecture.ts';
import { buildPiercedCarving, createLecternPanelHeightMap } from '../reliefs.ts';
import type { ChurchMaterials } from '../textures.ts';
import { buildAnglepoiseLamp, type CandleRig } from './lighting.ts';
import { buildFireExtinguisher, buildFlowerArrangement, buildOldBible, spiralPts } from './props.ts';

type KneelerGeometries = {
  body: THREE.BufferGeometry;
  stem: THREE.BufferGeometry;
  hook: THREE.BufferGeometry;
  loop: THREE.BufferGeometry;
  height: number;
};

let kneelerGeoCache: KneelerGeometries | null = null;
function getKneelerGeometries() {
  if (kneelerGeoCache) return kneelerGeoCache;
  const depth = 0.1;
  const height = 0.27;
  const width = 0.24;
  const body = new THREE.BoxGeometry(depth, height, width, 8, 18, 16);
  const pos = body.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) / (depth * 0.5);
    const ny = pos.getY(i) / (height * 0.5);
    const nz = pos.getZ(i) / (width * 0.5);
    // Squash the thickness towards the edges and round off the corners, like a stuffed cushion
    const puff = Math.sqrt(Math.max(0, (1 - Math.pow(Math.abs(ny), 4)) * (1 - Math.pow(Math.abs(nz), 4))));
    const corner = 1 - 0.08 * Math.pow(Math.abs(ny * nz), 2);
    pos.setX(i, nx * depth * 0.5 * (0.45 + 0.55 * puff));
    pos.setY(i, ny * height * 0.5 * corner * (1 - 0.03 * nx * nx));
    pos.setZ(i, nz * width * 0.5 * corner * (1 - 0.03 * nx * nx));
  }
  body.computeVertexNormals();
  const stem = new THREE.CylinderGeometry(0.004, 0.004, 0.026, 8);
  stem.rotateZ(Math.PI / 2);
  const hook = new THREE.TorusGeometry(0.012, 0.0035, 6, 12, Math.PI);
  hook.rotateZ(Math.PI); // a U, open side up, its inner arm on the stem
  const loop = new THREE.TorusGeometry(0.045, 0.003, 5, 20);
  loop.scale(0.32, 1, 1);
  kneelerGeoCache = { body, stem, hook, loop, height };
  return kneelerGeoCache;
}

// Shared geometries for the Edwardian wrought-iron pendant lamps (built once, reused by every fixture)

export function buildPew(
  length: number,
  mats: ChurchMaterials,
  { includeKneelers = true }: { includeKneelers?: boolean } = {}
) {
  const g = new THREE.Group();
  const seatH = 0.44;
  const seatD = 0.42;
  const backH = 0.9;

  // Seat plank
  addBox(g, [seatD, 0.045, length], mats.warmOak, [0, seatH, 0], { cast: true, receive: true });

  // Crimson velvet seat cushion
  addBox(g, [seatD - 0.05, 0.055, length - 0.08], mats.cushionCrimson, [0.01, seatH + 0.048, 0], {
    cast: true,
    receive: true
  });

  // Slanted open backrest + top rail + book ledge behind
  const backLower = addBox(g, [0.035, 0.24, length - 0.04], mats.warmOak, [-seatD * 0.45, seatH + 0.16, 0], {
    cast: true
  });
  backLower.rotation.z = 0.1;

  addBox(g, [0.05, 0.09, length - 0.02], mats.warmOak, [-seatD * 0.5, backH - 0.04, 0], { cast: true });

  addBox(g, [0.11, 0.025, length - 0.06], mats.warmOak, [-seatD * 0.58, backH - 0.2, 0]);

  // Shaped / scalloped Victorian oak bench ends
  const endShape = new THREE.Shape();
  endShape.moveTo(-seatD * 0.56, 0);
  endShape.lineTo(seatD * 0.5, 0);
  endShape.lineTo(seatD * 0.5, seatH + 0.12);
  endShape.quadraticCurveTo(seatD * 0.18, seatH + 0.22, 0.02, backH - 0.06);
  endShape.lineTo(-seatD * 0.46, backH + 0.04);
  endShape.lineTo(-seatD * 0.58, backH - 0.04);
  endShape.closePath();

  const endGeo = new THREE.ExtrudeGeometry(endShape, { depth: 0.055, bevelEnabled: false });
  [-1, 1].forEach((side) => {
    const endMesh = new THREE.Mesh(endGeo, mats.warmOak);
    endMesh.position.set(0, 0, side * (length * 0.5) - (side > 0 ? 0.055 : 0));
    endMesh.castShadow = true;
    endMesh.receiveShadow = true;
    g.add(endMesh);
  });

  // Needlepoint hassocks hanging by a cord loop from brass hooks on the back of the pew (IMG_3949 & IMG_3950)
  if (includeKneelers) {
    // Kept in their own group so a pew can lose them when the pew behind it is gone (main.js eras)
    const kneelersG = new THREE.Group();
    g.add(kneelersG);
    g.userData.kneelers = kneelersG;
    const kg = getKneelerGeometries();
    const kCount = length >= 1.8 ? 4 : Math.max(2, Math.floor(length / 0.52)); // four on each long pew
    const backX = -seatD * 0.5 - 0.004; // rear face of the lower back board
    for (let i = 0; i < kCount; i++) {
      const kz = -length * 0.36 + (i / Math.max(1, kCount - 1)) * (length * 0.72);
      const hookY = seatH + 0.075;
      // Brass screw hook: a short stem out of the back board turning up into a hook
      const stem = new THREE.Mesh(kg.stem, mats.brass);
      stem.position.set(backX - 0.012, hookY, kz);
      kneelersG.add(stem);
      const hook = new THREE.Mesh(kg.hook, mats.brass);
      hook.position.set(backX - 0.024, hookY + 0.012, kz);
      kneelersG.add(hook);
      // Cord loop over the hook, down to the hassock's top edge
      const loop = new THREE.Mesh(kg.loop, mats.kneelerCord);
      loop.position.set(backX - 0.03, hookY - 0.045, kz);
      kneelersG.add(loop);
      const kneeler = new THREE.Mesh(kg.body, mats.kneelerFabric);
      const topY = hookY - 0.085;
      kneeler.position.set(backX - 0.066, topY - kg.height * 0.5, kz);
      kneeler.rotation.z = -0.06;
      kneeler.rotation.y = (((i * 7) % 5) - 2) * 0.03;
      kneeler.castShadow = true;
      kneeler.receiveShadow = true;
      kneelersG.add(kneeler);
    }
  }

  return g;
}

// Open visitor book: red cloth boards, two cream ruled pages bowing up from the spine with lines of signatures,
// and a ballpoint pen lying across the right-hand page

export // Victorian "Glastonbury" oak sanctuary chair (chancel-chair photo): X-frame side legs, plain plank seat,
// broad arm boards sweeping from the top of the back down to the front of the seat with rolled scroll ends,
// and a raked back with a diamond-parquetry panel. Local space: sitter faces -X, back at +X, width along Z.
function buildGlastonburyChair(mats: ChurchMaterials) {
  const chair = new THREE.Group();
  const oak = mats.warmOak;
  const seatY = 0.45;
  const seatD = 0.46;
  const seatW = 0.56;
  const halfW = seatW * 0.5;
  const rake = 0.12; // Back leans ~7 degrees

  // Plank seat with moulded front & side edge rails
  addBox(chair, [seatD, 0.035, seatW - 0.06], oak, [0, seatY, 0], { cast: true });
  [-1, 1].forEach((side) => {
    addBox(chair, [seatD + 0.02, 0.075, 0.03], oak, [0, seatY - 0.012, side * (halfW - 0.015)]);
  });

  // X-frame legs on each side (side elevation), each crossing under the seat rail and ending in a short foot
  const legLen = Math.hypot(seatD + 0.06, seatY - 0.03);
  const legAng = Math.atan2(seatY - 0.03, seatD + 0.06);
  [-1, 1].forEach((side) => {
    const z = side * (halfW - 0.045);
    [-1, 1].forEach((dir) => {
      const leg = addBox(chair, [legLen, 0.055, 0.04], oak, [0, (seatY - 0.03) * 0.5, z + dir * 0.022], { cast: true });
      leg.rotation.z = dir * legAng;
    });
    // Pegged pivot boss where the legs cross
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.11, 10), oak);
    peg.rotation.x = Math.PI / 2;
    peg.position.set(0, (seatY - 0.03) * 0.5, z);
    chair.add(peg);
  });

  // Raked back: side stiles, top rail and the parquetry panel
  const backH = 0.6;
  const back = new THREE.Group();
  back.position.set(seatD * 0.5 - 0.02, seatY, 0);
  back.rotation.z = -Math.atan2(rake, backH);
  [-1, 1].forEach((side) => {
    addBox(back, [0.045, backH, 0.05], oak, [0, backH * 0.5, side * (halfW - 0.045)]);
  });
  addBox(back, [0.045, 0.09, seatW - 0.14], oak, [0, backH - 0.045, 0]);
  const panelH = backH - 0.13;
  const panelW = seatW - 0.14;
  addBox(back, [0.02, panelH, panelW], oak, [0.005, 0.02 + panelH * 0.5, 0]);
  const parquetry = new THREE.Mesh(new THREE.PlaneGeometry(panelW - 0.01, panelH - 0.01), mats.parquetryOak);
  parquetry.rotation.y = -Math.PI / 2; // Faces the sitter (-X)
  parquetry.position.set(-0.007, 0.02 + panelH * 0.5, 0);
  back.add(parquetry);
  chair.add(back);

  // Top of the back (in chair space) where the arms spring from
  const backTopX = seatD * 0.5 - 0.02 + rake;
  const backTopY = seatY + backH;

  // Broad sweeping arm boards (side elevation profile extruded across Z)
  const armT = 0.032;
  const frontX = -seatD * 0.5 - 0.03;
  const armShape = new THREE.Shape();
  armShape.moveTo(frontX + 0.06, seatY - 0.02);
  armShape.lineTo(frontX, seatY - 0.02);
  armShape.splineThru([
    new THREE.Vector2(frontX - 0.01, seatY + 0.12),
    new THREE.Vector2(frontX + 0.03, seatY + 0.24),
    new THREE.Vector2(frontX + 0.1, seatY + 0.25),
    new THREE.Vector2(frontX + 0.2, seatY + 0.26),
    new THREE.Vector2(backTopX - 0.2, backTopY - 0.24),
    new THREE.Vector2(backTopX - 0.07, backTopY - 0.07),
    new THREE.Vector2(backTopX + 0.01, backTopY + 0.01)
  ]);
  armShape.lineTo(backTopX - 0.05, backTopY + 0.02);
  armShape.splineThru([
    new THREE.Vector2(backTopX - 0.12, backTopY - 0.1),
    new THREE.Vector2(backTopX - 0.24, backTopY - 0.3),
    new THREE.Vector2(frontX + 0.22, seatY + 0.13),
    new THREE.Vector2(frontX + 0.1, seatY + 0.04),
    new THREE.Vector2(frontX + 0.06, seatY - 0.02)
  ]);
  const armGeo = new THREE.ExtrudeGeometry(armShape, { depth: armT, bevelEnabled: false, curveSegments: 6 });
  applyBoxUVs(armGeo, 0.9);
  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(armGeo, oak);
    // Sits just outside the seat rail / stiles
    arm.position.z = side > 0 ? halfW + 0.002 : -halfW - 0.002 - armT;
    arm.castShadow = true;
    chair.add(arm);

    const zMid = side * (halfW + 0.002 + armT * 0.5);
    // Rolled scroll ends (end grain facing forward): at the front of the seat (arm foot) and at the top of the back
    const frontRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.07, 14), oak);
    frontRoll.rotation.z = Math.PI / 2; // Scroll faces forward
    frontRoll.position.set(frontX + 0.01, seatY - 0.005, zMid);
    chair.add(frontRoll);
    const topRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 14), oak);
    topRoll.rotation.z = Math.PI / 2; // Scroll faces forward
    topRoll.position.set(backTopX - 0.02, backTopY - 0.005, zMid);
    chair.add(topRoll);
    // Rolled seat-rail ends at the back, at the foot of the stiles
    const backRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12), oak);
    backRoll.rotation.z = Math.PI / 2; // Scroll faces forward
    backRoll.position.set(seatD * 0.5 + 0.025, seatY - 0.01, side * (halfW - 0.015));
    chair.add(backRoll);
  });

  return chair;
}

// A large old leather-bound Bible lying closed: worn dark-brown leather boards with a blind-tooled border, a rounded
// spine with raised bands, aged gilt page edges, brass corner pieces and a brass clasp across the fore-edge.
// Spine along -X, origin at the centre of its base.

/**
 * Sloping lectern book desk on top of the stem at `baseY`. The tall front edge faces the congregation (-X) and is
 * the pierced, carved panel; the desk slopes down towards the reader at +X onto a book ledge.
 */
export function buildLecternDesk(oak: THREE.MeshStandardMaterial, baseY: number) {
  const g = new THREE.Group();
  const deskW = 0.58; // along Z
  const deskD = 0.4; // along X
  const frontH = 0.29;
  const backH = 0.1;
  const t = 0.02;
  const x0 = -deskD * 0.5;
  const x1 = deskD * 0.5;

  // Carved front panel: the carving's back sits on the box line, its relief stands proud towards the congregation
  const panelMat = oak.clone();
  panelMat.side = THREE.DoubleSide;
  const panel = buildPiercedCarving(createLecternPanelHeightMap(580, 290, 2), 0.024, panelMat, 2);
  panel.rotation.y = -Math.PI / 2;
  panel.position.set(x0 + t * 0.5, baseY + frontH * 0.5, 0);
  g.add(panel);

  // Trapezoid side cheeks
  const sideShape = new THREE.Shape();
  sideShape.moveTo(x0, 0);
  sideShape.lineTo(x1, 0);
  sideShape.lineTo(x1, backH);
  sideShape.lineTo(x0, frontH);
  sideShape.closePath();
  [-1, 1].forEach((side) => {
    const geo = new THREE.ExtrudeGeometry(sideShape, { depth: t, bevelEnabled: false });
    geo.translate(0, 0, -t * 0.5);
    applyBoxUVs(geo, 0.45);
    const cheek = new THREE.Mesh(geo, oak);
    cheek.position.set(0, baseY, side * (deskW * 0.5 - t * 0.5));
    cheek.castShadow = true;
    g.add(cheek);
  });

  // Bottom, low back board and the sloping desk top with a book ledge along its lower edge
  addBox(g, [deskD, t, deskW], oak, [0, baseY + t * 0.5, 0]);
  addBox(g, [t, backH, deskW - 2 * t], oak, [x1 - t * 0.5, baseY + backH * 0.5, 0]);
  const slopeLen = Math.hypot(deskD, frontH - backH);
  const top = addBox(g, [slopeLen + 0.03, t, deskW + 0.02], oak, [0, baseY + (frontH + backH) * 0.5 + t * 0.5, 0], {
    cast: true
  });
  top.rotation.z = -Math.atan2(frontH - backH, deskD);
  addBox(g, [0.03, 0.045, deskW + 0.02], oak, [x1 + 0.012, baseY + backH + 0.03, 0]);
  return g;
}

export function buildSanctuaryAndChancel(interiorGroup: THREE.Group, mats: ChurchMaterials, candleRig: CandleRig) {
  const C = DIM.chancel;
  const altY = DIM.sanctuaryStep2Y;

  // Carved Limestone Reredos behind Altar (IMG_3938)
  const reredosG = new THREE.Group();
  addBox(reredosG, [0.18, 1.02, 2.38], mats.ashlarWarm, [C.xEastInt - 0.1, altY + 1.05, 0], { cast: true });

  // Battlemented stone cornice along top of reredos
  addBox(reredosG, [0.24, 0.1, 2.48], mats.ashlarWarm, [C.xEastInt - 0.11, altY + 1.58, 0]);
  for (let rz = -1.16; rz <= 1.16; rz += 0.16) {
    addBox(reredosG, [0.18, 0.06, 0.08], mats.ashlarWarm, [C.xEastInt - 0.11, altY + 1.66, rz]);
  }

  // Central circular alabaster medallion with dark-stone Greek cross (IMG_3938!)
  const medDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 24), mats.wax);
  medDisc.rotation.z = Math.PI / 2;
  medDisc.position.set(C.xEastInt - 0.19, altY + 1.08, 0);
  reredosG.add(medDisc);

  addBox(reredosG, [0.06, 0.56, 0.11], mats.stoneCapDark, [C.xEastInt - 0.2, altY + 1.08, 0]);
  addBox(reredosG, [0.06, 0.11, 0.56], mats.stoneCapDark, [C.xEastInt - 0.2, altY + 1.08, 0]);

  // Flanking carved stone rosettes
  [-0.76, 0.76].forEach((rz) => {
    const ros = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 14), mats.ashlar);
    ros.rotation.y = Math.PI / 2;
    ros.position.set(C.xEastInt - 0.2, altY + 1.18, rz);
    reredosG.add(ros);
  });
  interiorGroup.add(reredosG);

  // Altar Table with Emerald Green Frontal & White Lace Fair-Linen Cloth (IMG_3938)
  const altarX = C.xEastInt - 0.56;
  const altarW = 2.02;
  const altarD = 0.76;
  const altarH = 0.98;

  addBox(interiorGroup, [altarD, altarH, altarW], mats.altarFrontal, [altarX, altY + altarH * 0.5, 0], {
    cast: true,
    receive: true
  });

  // White lace fair-linen top & overhanging upper valence
  addBox(interiorGroup, [altarD + 0.06, 0.04, altarW + 0.08], mats.laceCloth, [altarX, altY + altarH + 0.02, 0]);

  addBox(interiorGroup, [0.03, 0.38, altarW + 0.1], mats.laceCloth, [
    altarX - altarD * 0.5 - 0.015,
    altY + altarH - 0.17,
    0
  ]);

  // Brass Altar Cross + Pair of Brass Candlesticks + Missal Book-Rest (IMG_3938)
  const crossBase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.12, 10), mats.brass);
  crossBase.position.set(altarX + 0.12, altY + altarH + 0.1, 0);
  interiorGroup.add(crossBase);
  addBox(interiorGroup, [0.03, 0.48, 0.045], mats.brass, [altarX + 0.12, altY + altarH + 0.38, 0]);
  addBox(interiorGroup, [0.03, 0.045, 0.28], mats.brass, [altarX + 0.12, altY + altarH + 0.46, 0]);

  [-0.68, 0.68].forEach((cz, idx) => {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 0.24, 10), mats.brass);
    stick.position.set(altarX + 0.12, altY + altarH + 0.16, cz);
    interiorGroup.add(stick);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 8), mats.wax);
    candle.position.set(altarX + 0.12, altY + altarH + 0.36, cz);
    interiorGroup.add(candle);
    candleRig.addLitCandleFlame(altarX + 0.12, altY + altarH + 0.46, cz, {
      scale: 1.05,
      phase: idx * 2.4,
      baseIntensity: 0.68,
      distance: 3.4,
      waxRadius: 0.022
    });
  });

  // Brass altar lectern (missal desk): a moulded foot, a short turned stem and a sloping desk with a book ledge,
  // tilted towards the priest standing at the West of the altar
  const bookRest = new THREE.Group();
  const deskFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.018, 24), mats.brass);
  deskFoot.position.y = 0.009;
  bookRest.add(deskFoot);
  const deskStem = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.03, 0.018),
        new THREE.Vector2(0.016, 0.04),
        new THREE.Vector2(0.024, 0.07),
        new THREE.Vector2(0.013, 0.1),
        new THREE.Vector2(0.018, 0.13),
        new THREE.Vector2(0.0, 0.135)
      ],
      16
    ),
    mats.brass
  );
  bookRest.add(deskStem);
  const desk = new THREE.Group();
  desk.position.set(0, 0.14, 0);
  desk.rotation.z = 0.5; // the desk face looks West (-X) and up
  addBox(desk, [0.24, 0.006, 0.32], mats.brass);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.32), mats.brass);
  [-1, 1].forEach((sx) => {
    const r = rim.clone();
    r.position.set(sx * 0.116, 0.006, 0);
    desk.add(r);
  });
  addBox(desk, [0.014, 0.03, 0.3], mats.brass, [-0.122, 0.016, 0]);
  // Pierced quatrefoil boss in the middle of the desk
  const boss = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 8, 24), mats.brass);
  boss.rotation.x = Math.PI / 2;
  boss.position.y = 0.004;
  desk.add(boss);
  bookRest.add(desk);
  bookRest.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  bookRest.position.set(altarX - 0.06, altY + altarH + 0.04, -0.34);
  interiorGroup.add(bookRest);

  // Flanking Stone Brackets with Floral Arrangements & Sanctuary Oak Chairs (IMG_3938)
  [-1.52, 1.52].forEach((sz, idx) => {
    addBox(interiorGroup, [0.26, 0.09, 0.56], mats.ashlarWarm, [C.xEastInt - 0.14, altY + 1.18, sz]);

    const flowers = buildFlowerArrangement(idx + 1);
    flowers.position.set(C.xEastInt - 0.15, altY + 1.225, sz);
    interiorGroup.add(flowers);

    // Oak Glastonbury sanctuary chair (chancel-chair photo)
    const chair = buildGlastonburyChair(mats);
    // Angled ~30 degrees in towards the centre line, facing down the church
    chair.position.set(C.xEastInt - 0.52, altY, sz);
    chair.rotation.y = -Math.sign(sz) * (Math.PI / 6);
    interiorGroup.add(chair);
  });

  // Tall Wrought-Iron Paschal Candle Stand on North Sanctuary side (IMG_3938)
  // Ornate black wrought-iron stand: a slender shaft with knops and a barley-twist collar on three splayed legs.
  // Each leg ends in a scroll and ball foot, carries an S-scroll, a knee volute and a lyre of C-scrolls, and
  // scrolled brackets and a crown of small curls carry the drip pan under the candle
  const paschalStand = new THREE.Group();
  const standTop = 1.01;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, standTop - 0.28, 10), mats.iron);
  shaft.position.y = 0.28 + (standTop - 0.28) * 0.5;
  paschalStand.add(shaft);
  [0.32, 0.62, 0.9].forEach((ky) => {
    const knop = new THREE.Mesh(new THREE.SphereGeometry(0.028, 14, 10), mats.iron);
    knop.scale.y = 0.6;
    knop.position.y = ky;
    paschalStand.add(knop);
  });
  const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.06, 0.025, 20), mats.iron);
  pan.position.y = standTop - 0.012;
  paschalStand.add(pan);
  const scroll = (pts: THREE.Vector3[]) =>
    new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.008, 6), mats.iron);
  for (let k = 0; k < 3; k++) {
    const ang = (k / 3) * Math.PI * 2;
    const leg = new THREE.Group();
    // In the leg's own plane: x outward, y up
    const legPts = [
      new THREE.Vector3(0.01, 0.34, 0),
      new THREE.Vector3(0.06, 0.24, 0),
      new THREE.Vector3(0.14, 0.12, 0),
      new THREE.Vector3(0.21, 0.008, 0)
    ];
    // Curl outwards, up and back in over itself at the foot
    const footR = 0.034;
    for (let i = 1; i <= 14; i++) {
      const t = (i / 14) * Math.PI * 1.6;
      const r = footR * (1 - (0.55 * i) / 14);
      legPts.push(new THREE.Vector3(0.21 + Math.sin(t) * r, 0.008 + footR - Math.cos(t) * r, 0));
    }
    leg.add(scroll(legPts));
    // C-scroll swirl between the leg and the shaft
    const cPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * Math.PI * 1.7;
      const r = 0.05 * (1 - i / 26);
      cPts.push(new THREE.Vector3(0.05 + Math.sin(t) * r, 0.36 + Math.cos(t) * r, 0));
    }
    leg.add(scroll(cPts));
    // Facing C-scroll curling the other way, so the pair forms a lyre beside the shaft
    const c2Pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * Math.PI * 1.7;
      const r = 0.042 * (1 - i / 26);
      c2Pts.push(new THREE.Vector3(0.05 + Math.sin(t) * r, 0.46 - Math.cos(t) * r, 0));
    }
    leg.add(scroll(c2Pts));
    // S-scroll sprung from the inside of the leg, curling down towards the floor and up against the shaft
    leg.add(
      scroll([
        ...spiralPts(0.112, 0.085, 0.028, Math.PI, Math.PI * 1.5, -1, 0.55).reverse(),
        ...spiralPts(0.05, 0.24, 0.026, 0, Math.PI * 1.5, 1, 0.55)
      ])
    );
    // Small volute on the outside of the leg at its knee
    leg.add(scroll(spiralPts(0.135, 0.175, 0.022, Math.PI * 0.75, Math.PI * 1.6, -1, 0.6)));
    // Ball feet inside the foot scrolls
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), mats.iron);
    ball.position.set(0.21, 0.008 + footR, 0);
    leg.add(ball);
    leg.rotation.y = ang;
    paschalStand.add(leg);

    // Three scrolled brackets cradling the drip pan, set between the legs
    const bracket = new THREE.Group();
    const bPts = [new THREE.Vector3(0.016, standTop - 0.15, 0), new THREE.Vector3(0.024, standTop - 0.1, 0)];
    bPts.push(...spiralPts(0.05, standTop - 0.06, 0.026, Math.PI, Math.PI * 1.6, -1, 0.55).slice(1));
    bracket.add(scroll(bPts));
    bracket.add(scroll(spiralPts(0.035, standTop - 0.13, 0.016, 0, Math.PI * 1.5, 1, 0.55)));
    bracket.rotation.y = ang + Math.PI / 3;
    paschalStand.add(bracket);
  }
  // Barley-twist iron wrapped around the middle of the shaft
  const twistPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    const a = t * Math.PI * 2 * 6;
    twistPts.push(new THREE.Vector3(Math.cos(a) * 0.02, 0.42 + t * 0.16, Math.sin(a) * 0.02));
  }
  paschalStand.add(
    new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(twistPts), 240, 0.0045, 5), mats.iron)
  );
  // Collars either side of the twist
  [0.415, 0.585].forEach((cy) => {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.005, 6, 18), mats.iron);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = cy;
    paschalStand.add(collar);
  });
  // Crown of small scrolls around the drip pan rim
  for (let k = 0; k < 8; k++) {
    const curl = new THREE.Group();
    curl.add(scroll(spiralPts(0.093, standTop + 0.012, 0.012, Math.PI, Math.PI * 1.5, 1, 0.6)));
    curl.rotation.y = (k / 8) * Math.PI * 2;
    paschalStand.add(curl);
  }
  paschalStand.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  paschalStand.position.set(7.68, altY, -1.68);
  interiorGroup.add(paschalStand);
  const paschalCandle = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.045, 0.95, 10), mats.wax);
  paschalCandle.position.set(7.68, altY + 1.48, -1.68);
  interiorGroup.add(paschalCandle);
  // Subtle crimson wax cross emblem on the front face of the Paschal candle (IMG_3938)
  const paschalCrossMat = new THREE.MeshStandardMaterial({ color: 0xb82228, roughness: 0.65 });
  addBox(interiorGroup, [0.014, 0.14, 0.018], paschalCrossMat, [7.64, altY + 1.24, -1.68]);
  addBox(interiorGroup, [0.014, 0.018, 0.075], paschalCrossMat, [7.64, altY + 1.26, -1.68]);
  candleRig.addLitCandleFlame(7.68, altY + 1.955, -1.68, {
    scale: 1.4,
    phase: 4.8,
    baseIntensity: 0.95,
    distance: 4.4,
    waxRadius: 0.042
  });

  // Wooden Communion Rails with Crimson Kneelers (IMG_3938). Both stand on the first sanctuary step: the kneeling
  // cushions along its front edge, and the rail behind them on a moulded oak base board
  const railBaseY = DIM.sanctuaryStep1Y;
  const railX = 6.7;
  [-1, 1].forEach((sideZ) => {
    const rLen = C.zSouthInt - 0.56;
    const midZ = sideZ * (0.56 + rLen * 0.5);
    addBox(interiorGroup, [0.12, 0.07, rLen], mats.medOak, [railX, railBaseY + 0.68, midZ], { cast: true });

    // Oak base: a deep plinth board with a moulded top capping, which the posts rise from
    const baseH = 0.1;
    addBox(interiorGroup, [0.1, baseH, rLen], mats.medOak, [railX, railBaseY + baseH * 0.5, midZ], {
      cast: true,
      receive: true
    });
    addBox(interiorGroup, [0.12, 0.022, rLen + 0.01], mats.medOak, [railX, railBaseY + baseH + 0.011, midZ], {
      cast: true
    });

    [0.08, rLen * 0.5, rLen - 0.08].forEach((off) => {
      const postH = 0.68 - baseH - 0.022;
      addBox(
        interiorGroup,
        [0.06, postH, 0.06],
        mats.medOak,
        [railX, railBaseY + baseH + 0.022 + postH * 0.5, sideZ * (0.56 + off)],
        { cast: true }
      );
    });

    // Crimson velvet communion kneeler cushion on top of the step, in front of the rail
    addBox(
      interiorGroup,
      [0.3, 0.07, rLen - 0.06],
      mats.cushionCrimson,
      [6.25 + 0.02 + 0.15, railBaseY + 0.035, midZ],
      { cast: true, receive: true }
    );
  });

  // North Chancel Choir Pews (two parallel rows facing South into chancel aisle, clear of the altar rail cushion) + Bible Table (IMG_3938, 3939)
  [
    { x: 4.82, z: -1.68, len: 1.44 },
    { x: 4.42, z: -0.94, len: 1.56 }
  ].forEach(({ x, z, len }) => {
    const cPew = buildPew(len, mats, { includeKneelers: false });
    cPew.position.set(x, DIM.chancelFloorY, z);
    cPew.rotation.y = -Math.PI / 2; // Local +X (seat front) faces +Z (South into chancel aisle)
    interiorGroup.add(cPew);
  });
  addBox(interiorGroup, [0.54, 0.72, 0.62], mats.medOak, [3.66, DIM.chancelFloorY + 0.36, -1.58]);
  const bigBible = buildOldBible(mats);
  bigBible.position.set(3.66, DIM.chancelFloorY + 0.72, -1.58);
  bigBible.rotation.y = 0.05;
  interiorGroup.add(bigBible);

  // South Chancel Carved Oak Clergy Prayer Desk / Stall on Raised Dais (IMG_3940!)
  const deskG = new THREE.Group();
  addBox(deskG, [1.32, 0.14, 1.02], mats.medOak, [4.15, DIM.chancelFloorY + 0.07, 1.44]);
  addBox(deskG, [1.26, 0.88, 0.14], mats.medOak, [4.15, DIM.chancelFloorY + 0.56, 1.0], { cast: true });
  const stallSeat = buildPew(1.12, mats, { includeKneelers: false });
  stallSeat.position.set(4.15, DIM.chancelFloorY + 0.14, 1.66);
  stallSeat.rotation.y = Math.PI / 2; // Local +X (seat front) faces -Z (North toward prayer desk)
  deskG.add(stallSeat);

  // Water fire extinguisher standing against the chancel South wall, East of the choir stall
  const chancelExt = buildFireExtinguisher('water');
  chancelExt.position.set(5.05, DIM.chancelFloorY, C.zSouthInt - 0.12);
  chancelExt.rotation.y = Math.PI + 0.35; // label towards the chancel aisle and the nave
  chancelExt.userData.era = 'today';
  interiorGroup.add(chancelExt);
  interiorGroup.add(deskG);
}

export function buildNaveFurniture(interiorGroup: THREE.Group, mats: ChurchMaterials, candleRig: CandleRig) {
  const nfY = DIM.naveFloorY;

  // Octagonal Open-Topped Dark Oak Pulpit with Rear Stone Steps in NE corner of Nave
  const pulpitG = new THREE.Group();
  const octR = 0.54;
  const wallT = 0.068;
  const apothem = octR * Math.cos(Math.PI / 8); // ~0.499m
  const faceW = 2 * octR * Math.sin(Math.PI / 8); // ~0.413m
  const plinthH = 0.35;
  const parapetH = 1.1; // y: 0.35 -> 1.45

  // 1. Dressed pale limestone base plinth with moulded bullnose top edge (visible in user photo)
  addBox(pulpitG, [1.14, plinthH - 0.04, 1.14], mats.ashlar, [-0.02, (plinthH - 0.04) * 0.5, -0.02], {
    cast: true,
    receive: true
  });

  addBox(pulpitG, [1.2, 0.045, 1.2], mats.ashlarWarm, [-0.02, plinthH - 0.02, -0.02], { cast: true, receive: true });

  // 2. Two stone steps at the East (+X) rear of the pulpit, their risers facing South into the middle of the
  // church: the lower step by the aisle, the upper one a landing outside the rear door. From the landing the
  // plinth's edge makes the final step up through the door into the pulpit.
  const stepSpecs = [
    { z: 0.36, h: 0.12, wZ: 0.26 },
    { z: 0.0, h: 0.24, wZ: 0.48 }
  ];
  const stepX0 = 0.58; // the plinth cap's East edge
  const stepWX = 0.36;
  stepSpecs.forEach(({ z, h, wZ }) => {
    addBox(pulpitG, [stepWX, h - 0.03, wZ], mats.ashlar, [stepX0 + stepWX * 0.5, (h - 0.03) * 0.5, z], {
      cast: true,
      receive: true
    });

    // bullnose tread oversailing the riser towards the aisle
    addBox(pulpitG, [stepWX + 0.02, 0.034, wZ + 0.03], mats.ashlarWarm, [stepX0 + stepWX * 0.5, h - 0.015, z + 0.015], {
      cast: true,
      receive: true
    });
  });

  // 3. Internal dark-oak floorboards inside the open-topped pulpit
  const innerFloor = new THREE.Mesh(new THREE.CylinderGeometry(octR - 0.04, octR - 0.04, 0.03, 8), mats.darkOak);
  innerFloor.rotation.y = Math.PI / 8;
  innerFloor.position.y = plinthH + 0.015;
  innerFloor.receiveShadow = true;
  pulpitG.add(innerFloor);

  // 4. Open-topped octagonal dark-oak parapet walls: 7 panelled facets plus a full-height hinged door in the East rear
  // Facet angles: 0 = West (-X), 1 = SW (-X,+Z), 2 = South (+Z), 3 = SE (+X,+Z),
  //               4 = East (+X, rear door), 5 = NE (+X,-Z), 6 = North (-Z), 7 = NW (-X,-Z)
  const holeMatDark = new THREE.MeshBasicMaterial({ color: 0x0d0907 });
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    // Direction vector pointing outward from pulpit centre for facet i (0 = West = -X, 2 = South = +Z)
    const nx = -Math.cos(ang);
    const nz = Math.sin(ang);

    const facetG = new THREE.Group();
    facetG.position.set(nx * (apothem - wallT * 0.5), plinthH, nz * (apothem - wallT * 0.5));
    facetG.rotation.y = Math.atan2(nx, nz);

    // Main oak wall core (visible from both outside and inside the open top)
    const core = addBox(facetG, [faceW + 0.02, parapetH, wallT], mats.darkOak, [0, 0, 0], {
      cast: true,
      receive: true
    });
    core.position.y = parapetH * 0.5;

    // Moulded stepped oak base skirting & chamfered plinth moulding
    const skirtLow = addBox(facetG, [faceW + 0.06, 0.14, wallT + 0.044], mats.darkOak, [0, 0, 0], { cast: true });
    skirtLow.position.y = 0.07;

    const skirtMould = addBox(facetG, [faceW + 0.04, 0.04, wallT + 0.026], mats.darkOak);
    skirtMould.position.y = 0.16;

    // Framing stiles (left & right vertical ribs) and top/bottom rails around the sunken panel
    [-1, 1].forEach((s) => {
      addBox(facetG, [0.065, 0.78, 0.022], mats.darkOak, [s * (faceW * 0.5 - 0.03), 0.57, wallT * 0.5 + 0.008]);
    });
    [0.21, 0.93].forEach((ry) => {
      addBox(facetG, [faceW, 0.065, 0.022], mats.darkOak, [0, ry, wallT * 0.5 + 0.008]);
    });

    // Raised fielded inner panel with mitred moulding frame
    addBox(facetG, [faceW - 0.15, 0.61, 0.014], mats.darkOak, [0, 0.57, wallT * 0.5 + 0.004]);

    addBox(facetG, [faceW - 0.21, 0.53, 0.02], mats.darkOak, [0, 0.57, wallT * 0.5 + 0.009], { cast: true });

    // Moulded top cornice & coping rail along top of this parapet facet (leaving the pulpit top OPEN)
    const corniceLow = addBox(facetG, [faceW + 0.05, 0.04, wallT + 0.034], mats.darkOak);
    corniceLow.position.y = parapetH - 0.04;

    const copingTop = addBox(facetG, [faceW + 0.08, 0.045, wallT + 0.064], mats.darkOak, [0, 0, 0], { cast: true });
    copingTop.position.y = parapetH;

    if (i === 4) {
      // The rear facet is the door: shadow gaps down both edges, iron strap hinges on the North edge, brass knob
      const outZ = wallT * 0.5 + 0.034;
      [-1, 1].forEach((s) => {
        addBox(facetG, [0.006, parapetH - 0.02, 0.07], holeMatDark, [
          s * (faceW * 0.5 + 0.006),
          parapetH * 0.5,
          wallT * 0.5 - 0.02
        ]);
      });
      [0.24, 0.86].forEach((hy) => {
        addBox(facetG, [0.13, 0.024, 0.006], mats.iron, [faceW * 0.5 - 0.06, hy, outZ - 0.004]);
        const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.06, 10), mats.iron);
        knuckle.position.set(faceW * 0.5 + 0.004, hy, outZ - 0.008);
        facetG.add(knuckle);
      });
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 10), mats.brass);
      knob.position.set(-faceW * 0.5 + 0.05, 0.62, outZ + 0.008);
      facetG.add(knob);
    }

    pulpitG.add(facetG);
  }

  // 5. Flared dark-oak reading desk / bookboard & green damask pulpit fall on the congregation-facing facet (i = 1, SW/West)
  const deskAng = Math.PI / 5.5;
  const deskNx = -Math.cos(deskAng);
  const deskNz = Math.sin(deskAng);
  const pulpitDeskG = new THREE.Group();
  pulpitDeskG.position.set(deskNx * (apothem + 0.01), plinthH + parapetH, deskNz * (apothem + 0.01));
  pulpitDeskG.rotation.y = Math.atan2(deskNx, deskNz);

  // Projecting bevelled bookrest cornice shelf
  const bookShelf = addBox(pulpitDeskG, [0.54, 0.045, 0.26], mats.darkOak, [0, 0.03, -0.02], { cast: true });
  bookShelf.rotation.x = -0.14;

  // Draped green damask pulpit fall with gold Latin cross & bottom gold fringe
  addBox(pulpitDeskG, [0.46, 0.38, 0.024], mats.altarFrontal, [0, -0.17, 0.052], { cast: true });

  // Pair of small brass candlesticks with lit flickering white taper candles on the pulpit rail
  const pulpitCandleSticks: THREE.Group[] = [];
  [-0.24, 0.24].forEach((cx) => {
    const cStick = new THREE.Group();
    const cFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.032, 0.025, 10), mats.brass);
    cFoot.position.y = 0.012;
    const cStem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.01, 0.075, 8), mats.brass);
    cStem.position.y = 0.06;
    const cCup = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.012, 0.02, 10), mats.brass);
    cCup.position.y = 0.1;
    const cTaper = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.01, 0.12, 12), mats.wax);
    cTaper.position.y = 0.165;
    cStick.add(cFoot, cStem, cCup, cTaper);
    cStick.position.set(cx, 0.035, -0.02);
    pulpitDeskG.add(cStick);
    pulpitCandleSticks.push(cStick);
  });

  pulpitG.add(pulpitDeskG);
  // White anglepoise lamp clamped on the pulpit's North parapet by the wall, switched on over the reading desk
  const pulpitLamp = buildAnglepoiseLamp();
  pulpitLamp.scale.setScalar(0.85);
  pulpitLamp.position.set(0.05, plinthH + parapetH + 0.0225, -(apothem - wallT * 0.5));
  pulpitLamp.rotation.y = -Math.PI / 2 - 0.35; // arm reaches in over the pulpit towards the desk
  pulpitLamp.userData.era = 'today'; // electric
  pulpitG.add(pulpitLamp);
  pulpitG.position.set(2.26, nfY, -1.92);
  pulpitG.updateMatrixWorld(true);
  pulpitCandleSticks.forEach((cStick, idx) => {
    const tip = cStick.localToWorld(new THREE.Vector3(0, 0.225, 0));
    candleRig.addLitCandleFlame(tip.x, tip.y, tip.z, {
      scale: 0.62,
      phase: 3.1 + idx * 1.9,
      baseIntensity: 0.34,
      distance: 2.2,
      waxRadius: 0.0085
    });
  });
  interiorGroup.add(pulpitG);

  // Golden oak Lectern in SE Nave (IMG_3936, 3940, 3941): pedestal stem carrying a sloping book desk whose front
  // panel, facing the congregation, is pierced and carved (lectern-carving photo)
  const lecternG = new THREE.Group();
  const lBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.1, 14), mats.medOak);
  lBase.position.y = 0.05;
  lecternG.add(lBase);
  const lStem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 1.12, 12), mats.medOak);
  lStem.position.y = 0.62;
  lStem.castShadow = true;
  lecternG.add(lStem);
  lecternG.add(buildLecternDesk(mats.medOak, 1.16));
  lecternG.position.set(2.46, nfY, 1.22);
  interiorGroup.add(lecternG);

  // Nave Oak Pews with Crimson Cushions & Blue Kneelers!
  // North block: 6 rows between the Pulpit & the North Doorway (the rearmost stops at the door's East jamb)
  const northFront = 1.4;
  const northBack = -1.57;
  // Hassocks hang on a pew's back for the row behind, so the rearmost pew of each block has none
  for (let k = 0; k < 6; k++) {
    const pew = buildPew(1.86, mats, { includeKneelers: k < 5 });
    pew.position.set(northFront + ((northBack - northFront) * k) / 5, nfY, -1.52);
    interiorGroup.add(pew);
  }

  // South block: 7 full-length rows between the Lectern & the Font, then 4 narrow pews continuing beside the
  // Font back towards the vestry partition, all on one pitch and clear of the font & the tower post
  const southFront = 1.95;
  const southPitch = 0.685;
  for (let k = 0; k < 11; k++) {
    const narrow = k >= 7;
    const pew = buildPew(narrow ? 1.2 : 1.86, mats, { includeKneelers: k < 10 });
    pew.position.set(southFront - k * southPitch, nfY, narrow ? 1.62 : 1.52);
    // In 1900 the Tortoise stove stood where the seventh pew is now, in line with the Roll of Honour
    // and the front pew gave way to the harmonium against the South wall by the rood screen
    if (k === 6 || k === 0) pew.userData.era = 'today';
    // ...so in 1900 the pew in front of the stove had no pew behind it for its hassocks
    if (k === 5) pew.userData.kneelers.userData.era = 'today';
    interiorGroup.add(pew);
  }

  // Octagonal Medieval Limestone Font with 4-Rib Curved Ogee Oak Cover (matching close-up photo & IMG_3941/3943)
  const fontG = new THREE.Group();

  // Helper to build crisp flat-faceted 8-sided carved limestone lathe geometry aligned with cardinal faces
  const makeOctagonalStone = (pts: THREE.Vector2[], mat: THREE.Material) => {
    const raw = new THREE.LatheGeometry(pts, 8);
    raw.rotateY(Math.PI / 8);
    const geo = raw.toNonIndexed();
    geo.computeVertexNormals();
    applyBoxUVs(geo, 0.58);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // 1. Broad low octagonal weathered limestone base step
  const fPlinth = makeOctagonalStone(
    [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.64, 0.0),
      new THREE.Vector2(0.64, 0.13),
      new THREE.Vector2(0.6, 0.165),
      new THREE.Vector2(0.0, 0.165)
    ],
    mats.ashlar
  );
  fontG.add(fPlinth);

  // 2. Sculpted octagonal limestone foot, sturdy tapered stem, chamfered flare & tall vertical bowl
  const fBody = makeOctagonalStone(
    [
      new THREE.Vector2(0.0, 0.16),
      new THREE.Vector2(0.45, 0.16),
      new THREE.Vector2(0.45, 0.22),
      new THREE.Vector2(0.405, 0.255),
      new THREE.Vector2(0.355, 0.295),
      new THREE.Vector2(0.34, 0.345),
      new THREE.Vector2(0.33, 0.65),
      new THREE.Vector2(0.37, 0.695),
      new THREE.Vector2(0.425, 0.745),
      new THREE.Vector2(0.435, 1.18),
      new THREE.Vector2(0.0, 1.18)
    ],
    mats.ashlarWarm
  );
  fontG.add(fBody);

  // 3. Flat overhanging octagonal dark-oak lid
  const lidTopY = 1.212;
  const fLid = new THREE.Mesh(new THREE.CylinderGeometry(0.455, 0.455, 0.032, 8), mats.darkOak);
  fLid.rotation.y = Math.PI / 8;
  fLid.position.y = 1.196;
  fLid.castShadow = true;
  fLid.receiveShadow = true;
  fontG.add(fLid);

  // 4. Four gracefully curved S-shaped (ogee) oak flying ribs rising from the lid and joining in the center
  const ribShape = new THREE.Shape();
  ribShape.moveTo(0.365, 0.0);
  ribShape.lineTo(0.365, 0.095);
  ribShape.bezierCurveTo(0.365, 0.185, 0.285, 0.215, 0.215, 0.26);
  ribShape.bezierCurveTo(0.145, 0.305, 0.068, 0.375, 0.048, 0.455);
  ribShape.lineTo(0.0, 0.455);
  ribShape.lineTo(0.0, 0.365);
  ribShape.lineTo(0.042, 0.365);
  ribShape.bezierCurveTo(0.065, 0.3, 0.135, 0.245, 0.205, 0.205);
  ribShape.bezierCurveTo(0.268, 0.168, 0.305, 0.14, 0.305, 0.075);
  ribShape.lineTo(0.305, 0.0);
  ribShape.closePath();

  const ribDepth = 0.046;
  const ribGeo = new THREE.ExtrudeGeometry(ribShape, {
    depth: ribDepth,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 2,
    curveSegments: 16
  });
  ribGeo.translate(0, 0, -ribDepth * 0.5);
  applyBoxUVs(ribGeo, 0.65);

  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(ribGeo, mats.darkOak);
    rib.position.y = lidTopY;
    rib.rotation.y = (i * Math.PI) / 2;
    rib.castShadow = true;
    rib.receiveShadow = true;
    fontG.add(rib);
  }

  // 5. Turned oak central finial hub & pointed diamond/acorn bud where the 4 curved ribs join (open center below)
  const finialPts = [
    new THREE.Vector2(0.0, 0.36),
    new THREE.Vector2(0.046, 0.385),
    new THREE.Vector2(0.044, 0.455),
    new THREE.Vector2(0.028, 0.49),
    new THREE.Vector2(0.024, 0.545),
    new THREE.Vector2(0.038, 0.565),
    new THREE.Vector2(0.02, 0.585),
    new THREE.Vector2(0.044, 0.625),
    new THREE.Vector2(0.026, 0.655),
    new THREE.Vector2(0.0, 0.68)
  ];
  const finialGeo = new THREE.LatheGeometry(finialPts, 14);
  const fFinial = new THREE.Mesh(finialGeo, mats.darkOak);
  fFinial.position.y = lidTopY;
  fFinial.castShadow = true;
  fontG.add(fFinial);

  fontG.position.set(-3.98, nfY, 0.0);
  interiorGroup.add(fontG);
}
