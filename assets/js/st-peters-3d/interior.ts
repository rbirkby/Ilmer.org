// Main interior orchestrator for St Peter's Church, Ilmer.
// Sub-modules under ./interior/ own structure, furniture, organs, lighting and props.
import * as THREE from 'three';
import { addBox } from './mesh-utils.ts';
import { DIM } from './dimensions.ts';
import type { ChurchMaterials } from './textures.ts';
import { buildNaveFurniture, buildPew, buildSanctuaryAndChancel } from './interior/furniture.ts';
import { buildChandelier, buildOilPendant, buildOilWallLamp, createCandleRig } from './interior/lighting.ts';
import { buildOrganAndHarmonium } from './interior/organs.ts';
import { buildDonationPlate, buildTortoiseStove, buildVisitorBook, markEra1900 } from './interior/props.ts';
import { buildFloorsAndCeilings, buildRoodScreen, buildWestTowerInterior } from './interior/structure.ts';

export function buildInterior(mats: ChurchMaterials) {
  const interiorGroup = new THREE.Group();
  const ceilingGroup = new THREE.Group();
  const chandelierLights: THREE.PointLight[] = [];
  const oilLights: THREE.PointLight[] = []; // 1900 paraffin lamps (main.ts)

  const N = DIM.nave;
  const nfY = DIM.naveFloorY;

  // 1 & 2. Floors, steps, carpet runner, nave coved ceiling, carved angels & chancel wagon vault
  buildFloorsAndCeilings(interiorGroup, ceilingGroup, mats);

  // 3. Medieval carved oak rood screen & dwarf wall
  interiorGroup.add(buildRoodScreen(mats));

  // Shared GLSL flickering candle & 1900 oil flame rig
  const candleRig = createCandleRig(interiorGroup);

  // 4. Sanctuary & chancel furnishings (reredos, altar, candles, missal desk, Paschal stand, choir stalls)
  buildSanctuaryAndChancel(interiorGroup, mats, candleRig);

  // 5. Nave furnishings (pulpit, lectern, nave pews, font) & organ / 1900 harmonium
  buildNaveFurniture(interiorGroup, mats, candleRig);
  const organAnimator = buildOrganAndHarmonium(interiorGroup, mats);

  // Pew in front (East) of the organ, facing the altar, with the open visitor book & a pen lying on its cushion
  // 1900: a pew stood where the organ is now
  const organPew = buildPew(1.3, mats, { includeKneelers: false });
  organPew.position.set(-4.1, nfY, -1.6);
  markEra1900(organPew);
  interiorGroup.add(organPew);
  const visitorPew = buildPew(1.3, mats, { includeKneelers: false });
  visitorPew.position.set(-3.3, nfY, -1.6);
  interiorGroup.add(visitorPew);
  const visitorBook = buildVisitorBook(mats, -3.27, nfY + 0.518, -1.9);
  visitorBook.userData.era = 'today'; // no visitor book in 1900
  interiorGroup.add(visitorBook);

  // Hinged iron donation plate with two coin slots, a keyhole & a taped 'Donations' label, on the North wall right (East) of the door, above the front pew
  const donation = buildDonationPlate(mats);
  donation.scale.setScalar(0.7);
  donation.position.set(-1.45, nfY + 0.95, N.zNorthInt); // clear of the door jamb
  donation.userData.era = 'today';
  interiorGroup.add(donation);

  // 6. West tower timber substructure & vestry
  interiorGroup.add(buildWestTowerInterior(mats, ceilingGroup));

  // -------------------------------------------------------
  // 7. FOUR SUSPENDED PENDANT CLUSTERS (3 nave, 1 chancel), WALL MEMORIALS & STAINED-GLASS CAUSTIC
  // -------------------------------------------------------
  // Nave pendants spaced evenly under the nave ceiling, the westernmost kept clear of the bell tower frame
  [
    [-2.45, 5.08, 2.38, 1.6],
    [-0.2, 5.08, 2.38, 1.65],
    [1.95, 5.08, 2.38, 1.65],
    [5.45, 4.66, 2.05, 1.7]
  ].forEach(([cx, topY, drop, intensity]) => {
    const ch = buildChandelier(drop, mats, intensity);
    ch.group.position.set(cx, topY, 0);
    ch.group.userData.era = 'today'; // electric
    ceilingGroup.add(ch.group);
    chandelierLights.push(ch.light);
    // 1900: the same wrought-iron saddle hung the other way up, its three ends chained to the ceiling and a
    // single paraffin lamp in the central ring
    const oil = buildOilPendant(drop, mats);
    oil.group.position.set(cx, topY, 0);
    ceilingGroup.add(oil.group);
    oilLights.push(oil.light);
    candleRig.addOilFlame(oil);
  });

  // 1900: two paraffin wall lamps on the North wall between the doorway and Window 6
  [-1.2, -0.35].forEach((x) => {
    const wl = buildOilWallLamp(mats);
    wl.group.position.set(x, nfY + 1.95, N.zNorthInt);
    interiorGroup.add(wl.group);
    oilLights.push(wl.light);
    candleRig.addOilFlame(wl);
  });

  // 1900: Tortoise slow-combustion stove South of the aisle, its flue out of the back, up the wall & into it
  interiorGroup.add(buildTortoiseStove(mats, -2.25, nfY, 1.75, N.zSouthInt));

  // Soft Sanctuary highlight light so altar frontal & reredos glow warmly
  const sanctuaryLight = new THREE.PointLight(0xffe7c2, 1.35, 7.5, 1.6);
  sanctuaryLight.position.set(7.65, 2.85, 0);
  sanctuaryLight.userData.era = 'today'; // electric
  interiorGroup.add(sanctuaryLight);
  chandelierLights.push(sanctuaryLight);

  // Roll of Honour War Dead Stone Plaque + Remembrance Poppy Wreath on South Nave Wall (IMG_3943, 3950 / RollOfHonour.md)
  const rollG = new THREE.Group();
  addBox(rollG, [0.8, 0.51, 0.036], mats.ashlar, [0, 0, 0], { cast: true, receive: true });
  addBox(rollG, [0.76, 0.47, 0.044], mats.ashlar);
  const rollFace = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.46), mats.rollOfHonour);
  rollFace.position.z = -0.024;
  rollFace.rotation.y = Math.PI;
  rollG.add(rollFace);
  rollG.position.set(-2.32, 2.08, N.zSouthInt - 0.022);
  rollG.userData.era = 'today'; // after the Great War
  interiorGroup.add(rollG);

  // Small iron shelf & brackets beneath the Roll of Honour
  const poppyShelf = addBox(interiorGroup, [0.56, 0.025, 0.14], mats.iron, [-2.32, 1.5, N.zSouthInt - 0.07]);
  poppyShelf.userData.era = 'today';
  [-0.2, 0.2].forEach((bx) => {
    const br = addBox(interiorGroup, [0.025, 0.12, 0.025], mats.iron, [-2.32 + bx, 1.44, N.zSouthInt - 0.02]);
    br.userData.era = 'today';
  });

  // Detailed Remembrance Poppy Wreath (green laurel ring + 20 crimson poppies with black centres)
  const wreathG = new THREE.Group();
  const wreathLeafMat = new THREE.MeshStandardMaterial({ color: 0x1f4722, roughness: 0.85 });
  const poppyPetalMat = new THREE.MeshStandardMaterial({ color: 0xcc141c, roughness: 0.65 });
  const poppyCenterMat = new THREE.MeshStandardMaterial({ color: 0x161618, roughness: 0.5 });

  const wreathBase = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.036, 8, 22), wreathLeafMat);
  wreathG.add(wreathBase);
  const poppyCount = 20;
  for (let i = 0; i < poppyCount; i++) {
    const a = (i / poppyCount) * Math.PI * 2;
    const r = 0.155 + (i % 2 === 0 ? 0.012 : -0.012);
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    const pz = -0.028 - (i % 2) * 0.012;
    const flower = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.032, 0.018, 7), poppyPetalMat);
    flower.rotation.x = Math.PI / 2;
    flower.position.set(px, py, pz);
    wreathG.add(flower);

    const center = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), poppyCenterMat);
    center.position.set(px, py, pz - 0.01);
    wreathG.add(center);
  }
  wreathG.position.set(-2.32, 1.7, N.zSouthInt - 0.075);
  wreathG.userData.era = 'today';
  interiorGroup.add(wreathG);

  // A7: Carved Oak Memorial Plaque to Robert Harold Attenborough on SE Nave Wall (to the left/East of Sower Window)
  const attenG = new THREE.Group();
  addBox(attenG, [0.66, 0.34, 0.028], mats.medOak, [0, 0, 0], { cast: true, receive: true });
  addBox(attenG, [0.63, 0.31, 0.036], mats.medOak);
  const attenFace = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.3), mats.attenboroughPlaque);
  attenFace.position.z = -0.02;
  attenFace.rotation.y = Math.PI;
  attenG.add(attenFace);
  attenG.position.set(1.88, 1.85, N.zSouthInt - 0.02);
  attenG.userData.era = 'today';
  interiorGroup.add(attenG);

  // A4: Framed List of Donors for Mrs Jaques's Memorial Window on North Nave Wall (next to Jaques Window A3)
  const donorsG = new THREE.Group();
  const frameW = 0.5;
  const frameH = 0.72;
  const railT = 0.034;
  // 4-piece moulded dark walnut/oak picture frame
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(frameW, railT, 0.038), mats.darkOak);
  topRail.position.y = (frameH - railT) * 0.5;
  const botRail = new THREE.Mesh(new THREE.BoxGeometry(frameW, railT, 0.038), mats.darkOak);
  botRail.position.y = -(frameH - railT) * 0.5;
  const leftRail = new THREE.Mesh(new THREE.BoxGeometry(railT, frameH, 0.038), mats.darkOak);
  leftRail.position.x = -(frameW - railT) * 0.5;
  const rightRail = new THREE.Mesh(new THREE.BoxGeometry(railT, frameH, 0.038), mats.darkOak);
  rightRail.position.x = (frameW - railT) * 0.5;
  const backBoard = new THREE.Mesh(new THREE.BoxGeometry(frameW - 0.02, frameH - 0.02, 0.016), mats.darkOak);
  backBoard.position.z = -0.008;
  const donorsArt = new THREE.Mesh(
    new THREE.PlaneGeometry(frameW - railT * 1.8, frameH - railT * 1.8),
    mats.jaquesDonors
  );
  donorsArt.position.z = 0.008;
  donorsG.add(topRail, botRail, leftRail, rightRail, backBoard, donorsArt);
  donorsG.scale.set(0.5, 0.5, 1); // half size
  donorsG.position.set(-0.08, 1.92, N.zNorthInt + 0.02); // just west of the Jaques window reveal
  donorsG.userData.era = 'today';
  interiorGroup.add(donorsG);

  // Rainbow Stained-Glass Sunlight Caustic projected onto the North Nave Wall (IMG_3949!)
  const causticMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.45), mats.causticDecal);
  causticMesh.position.set(-0.65, 1.28, N.zNorthInt + 0.025);
  causticMesh.userData.era = 'today'; // stained-glass colour on the wall
  interiorGroup.add(causticMesh);

  return {
    interiorGroup,
    ceilingGroup,
    chandelierLights,
    oilLights,
    causticMesh,
    candleEffect: candleRig.candleEffect,
    organAnimator
  };
}
