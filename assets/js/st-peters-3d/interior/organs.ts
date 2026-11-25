// Modern pipe-organ console with animated manual/pedal keys & tambour roll-top, plus the 1900 pedal harmonium.
import * as THREE from 'three';
import { canvas2d, canvasTexture, makeCanvas } from '../canvas-utils.ts';
import { addBox } from '../mesh-utils.ts';
import { DIM } from '../dimensions.ts';
import type { ChurchMaterials } from '../textures.ts';
import { buildAnglepoiseLamp } from './lighting.ts';
import { markEra1900 } from './props.ts';

export type OrganNotes = { manual: Set<number>; pedal: Set<number> };

const SHARP_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);
const isSharpMidi = (m: number) => SHARP_PITCH_CLASSES.has(m % 12);

// Five-octave keyboard, C (MIDI 36) to C (96), each key pivoted at its back end so it dips when played.
// `axis: 'x'` lays the compass along +X with keys projecting towards +Z (harmonium);
// `axis: 'z'` lays the compass from +Z down to -Z with keys projecting towards -X (organ console).
function buildFiveOctaveKeyboard(
  parent: THREE.Object3D,
  mats: ChurchMaterials,
  {
    span,
    axis,
    pivotY,
    pivotDepth,
    natDepth,
    natHeight,
    sharpDepth,
    sharpHeight,
    castNaturalShadow = false
  }: {
    span: number;
    axis: 'x' | 'z';
    pivotY: number;
    pivotDepth: number;
    natDepth: number;
    natHeight: number;
    sharpDepth: number;
    sharpHeight: number;
    castNaturalShadow?: boolean;
  }
) {
  const lo = 36;
  const hi = 96;
  let naturals = 0;
  for (let m = lo; m <= hi; m++) if (!isSharpMidi(m)) naturals++;
  const kW = span / naturals;
  const natGeo =
    axis === 'x'
      ? new THREE.BoxGeometry(kW - 0.0016, natHeight, natDepth).translate(0, natHeight * 0.5, natDepth * 0.5)
      : new THREE.BoxGeometry(natDepth, natHeight, kW - 0.0016).translate(-natDepth * 0.5, natHeight * 0.5, 0);
  const sharpGeo =
    axis === 'x'
      ? new THREE.BoxGeometry(kW * 0.55, sharpHeight, sharpDepth).translate(
          0,
          natHeight + sharpHeight * 0.5,
          sharpDepth * 0.5
        )
      : new THREE.BoxGeometry(sharpDepth, sharpHeight, kW * 0.55).translate(
          -sharpDepth * 0.5,
          natHeight + sharpHeight * 0.5,
          0
        );
  const ebony = new THREE.MeshStandardMaterial({ color: 0x15110e, roughness: 0.35 });
  const keys = new Map<number, { pivot: THREE.Object3D; angle: number }>();
  let nIdx = 0;
  for (let m = lo; m <= hi; m++) {
    const sharp = isSharpMidi(m);
    const offset = sharp ? nIdx * kW : (nIdx + 0.5) * kW;
    if (!sharp) nIdx++;
    const pivot = new THREE.Group();
    if (axis === 'x') pivot.position.set(-span * 0.5 + offset, pivotY, pivotDepth);
    else pivot.position.set(pivotDepth, pivotY, span * 0.5 - offset);
    const key = new THREE.Mesh(sharp ? sharpGeo : natGeo, sharp ? ebony : mats.wax);
    if (castNaturalShadow && !sharp) key.castShadow = true;
    pivot.add(key);
    parent.add(pivot);
    keys.set(m, { pivot, angle: 0 });
  }
  return keys;
}

function createFretworkTexture(kind: string) {
  const c = makeCanvas(256, 128);
  const ctx = canvas2d(c);
  ctx.fillStyle = '#5a1e18';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#a8743e';
  ctx.lineWidth = 7;
  if (kind === 'arches') {
    // A row of round-headed openings (the frieze under the cornice)
    ctx.fillStyle = '#a8743e';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#1a120c';
    for (let i = 0; i < 8; i++) {
      const cx = 16 + i * 32;
      ctx.beginPath();
      ctx.moveTo(cx - 10, 118);
      ctx.lineTo(cx - 10, 50);
      ctx.arc(cx, 50, 10, Math.PI, 0);
      ctx.lineTo(cx + 10, 118);
      ctx.fill();
    }
  } else {
    // Diagonal trellis with small rosettes
    for (let k = -128; k < 256 + 128; k += 26) {
      ctx.beginPath();
      ctx.moveTo(k, 0);
      ctx.lineTo(k + 128, 128);
      ctx.moveTo(k, 128);
      ctx.lineTo(k + 128, 0);
      ctx.stroke();
    }
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 246, 118);
  }
  const tex = canvasTexture(c);
  return tex;
}

// Victorian oak pedal harmonium (American-style parlour reed organ, c. 1890) with its keys on pivots so they can
// follow the music; front faces +Z. Returns { group, keys: Map(midi -> { pivot, angle }), treadles }.
function buildHarmonium(mats: ChurchMaterials) {
  const g = new THREE.Group();
  const oak = mats.medOak;
  const dark = mats.darkOak;
  const add = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = g
  ) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const W = 1.16;
  const zBack = -0.25;
  // Back, sides & plinth
  add(new THREE.BoxGeometry(W, 2.0, 0.03), oak, 0, 1.0, zBack + 0.015);
  [-1, 1].forEach((s) => {
    add(new THREE.BoxGeometry(0.06, 0.98, 0.46), oak, s * (W * 0.5 - 0.03), 0.49, -0.02);
    // Turned front legs with block feet and a scrolled bracket under the key bed
    add(new THREE.BoxGeometry(0.1, 0.09, 0.1), dark, s * (W * 0.5 - 0.06), 0.045, 0.2);
    add(new THREE.CylinderGeometry(0.03, 0.036, 0.56, 12), oak, s * (W * 0.5 - 0.06), 0.37, 0.2);
    [0.16, 0.36, 0.56].forEach((y) =>
      add(new THREE.TorusGeometry(0.036, 0.008, 6, 14), oak, s * (W * 0.5 - 0.06), y, 0.2).rotateX(Math.PI / 2)
    );
    const bracket = add(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI / 2), oak, s * (W * 0.5 - 0.06), 0.6, 0.2);
    bracket.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
  });
  add(new THREE.BoxGeometry(W, 0.06, 0.48), dark, 0, 0.03, -0.01);
  // Bellows box behind the kneehole, under the key bed
  add(new THREE.BoxGeometry(W - 0.14, 0.5, 0.2), oak, 0, 0.42, -0.14);
  // Key bed with a fretwork rail across its front
  add(new THREE.BoxGeometry(W, 0.07, 0.52), oak, 0, 0.705, 0.0);
  const fret = new THREE.MeshStandardMaterial({ map: createFretworkTexture('trellis'), roughness: 0.7 });
  add(new THREE.PlaneGeometry(W - 0.2, 0.06), fret, 0, 0.705, 0.261);
  // Scrolled key cheeks
  [-1, 1].forEach((s) => {
    const cheek = add(new THREE.BoxGeometry(0.06, 0.16, 0.42), oak, s * (W * 0.5 - 0.06), 0.82, 0.03);
    cheek.castShadow = true;
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 14), oak, s * (W * 0.5 - 0.06), 0.84, 0.22).rotateZ(Math.PI / 2);
  });
  // Five-octave keyboard, C (MIDI 36) to C (96), keys pivoted at their back ends; low notes at -X (player's left)
  const keys = buildFiveOctaveKeyboard(g, mats, {
    span: W - 0.2,
    axis: 'x',
    pivotY: 0.74,
    pivotDepth: 0.1,
    natDepth: 0.14,
    natHeight: 0.018,
    sharpDepth: 0.085,
    sharpHeight: 0.014
  });
  // Stop rail with a row of round white stop knobs
  add(new THREE.BoxGeometry(W - 0.14, 0.07, 0.1), oak, 0, 0.8, 0.05);
  const knobGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.012, 12).rotateX(Math.PI / 2);
  for (let i = 0; i < 11; i++) add(knobGeo, mats.wax, -0.3 + i * 0.06, 0.805, 0.106);
  // Upper case over the action, with a moulded top
  add(new THREE.BoxGeometry(W - 0.06, 0.2, 0.32), oak, 0, 0.935, -0.08);
  add(new THREE.BoxGeometry(W + 0.04, 0.035, 0.38), dark, 0, 1.05, -0.07);
  // Music desk: a raised panel with an inlaid oval, flanked by fretwork panels, a small crest on top
  const desk = new THREE.Group();
  desk.position.set(0, 1.07, 0.02);
  desk.rotation.x = -0.12;
  g.add(desk);
  add(new THREE.BoxGeometry(0.5, 0.26, 0.03), oak, 0, 0.13, 0, desk);
  const oval = add(new THREE.CircleGeometry(0.1, 32), mats.warmOak, 0, 0.13, 0.016, desk);
  oval.scale.set(1.8, 0.75, 1);
  add(new THREE.BoxGeometry(0.5, 0.025, 0.06), dark, 0, 0.0, 0.03, desk); // ledge
  [-1, 1].forEach((s) => {
    add(new THREE.BoxGeometry(0.16, 0.2, 0.025), oak, s * 0.37, 0.1, -0.02, desk);
    add(new THREE.PlaneGeometry(0.13, 0.16), fret, s * 0.37, 0.1, -0.006, desk);
  });
  add(new THREE.ConeGeometry(0.05, 0.06, 3), oak, 0, 0.29, 0, desk);
  // Superstructure: side posts, shelf, central bevelled mirror between turned columns, frieze, cornice & pediment
  [-1, 1].forEach((s) => {
    add(new THREE.BoxGeometry(0.08, 0.92, 0.12), oak, s * (W * 0.5 - 0.06), 1.52, -0.18);
    add(new THREE.BoxGeometry(0.3, 0.6, 0.012), dark, s * 0.36, 1.62, -0.212);
  });
  add(new THREE.BoxGeometry(W - 0.1, 0.03, 0.18), oak, 0, 1.33, -0.15);
  const mirror = add(
    new THREE.PlaneGeometry(0.3, 0.38),
    new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 0.95, roughness: 0.06 }),
    0,
    1.6,
    -0.205
  );
  mirror.castShadow = false;
  [-1, 1].forEach((s) => {
    add(new THREE.CylinderGeometry(0.022, 0.026, 0.5, 12), oak, s * 0.19, 1.6, -0.18);
    add(new THREE.BoxGeometry(0.06, 0.04, 0.06), oak, s * 0.19, 1.37, -0.18);
    add(new THREE.BoxGeometry(0.06, 0.04, 0.06), oak, s * 0.19, 1.85, -0.18);
  });
  add(new THREE.BoxGeometry(0.42, 0.03, 0.1), oak, 0, 1.39, -0.19); // mirror shelf
  const frieze = new THREE.MeshStandardMaterial({ map: createFretworkTexture('arches'), roughness: 0.7 });
  add(new THREE.BoxGeometry(W, 0.16, 0.08), oak, 0, 1.96, -0.2);
  add(new THREE.PlaneGeometry(0.42, 0.13), frieze, 0, 1.96, -0.159);
  add(new THREE.BoxGeometry(W + 0.08, 0.05, 0.2), dark, 0, 2.065, -0.17);
  // Carved scrolled pediment crest
  const crest = new THREE.Shape();
  crest.moveTo(-0.5, 0);
  crest.bezierCurveTo(-0.42, 0.06, -0.3, 0.04, -0.22, 0.1);
  crest.bezierCurveTo(-0.14, 0.16, -0.08, 0.2, 0, 0.24);
  crest.bezierCurveTo(0.08, 0.2, 0.14, 0.16, 0.22, 0.1);
  crest.bezierCurveTo(0.3, 0.04, 0.42, 0.06, 0.5, 0);
  crest.closePath();
  const crestGeo = new THREE.ExtrudeGeometry(crest, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2
  });
  add(crestGeo, oak, 0, 2.09, -0.2);
  // Two treadles, carpeted with a lyre pattern, hinged at their heels
  const tc = makeCanvas(64, 128);
  const tctx = canvas2d(tc);
  tctx.fillStyle = '#6a1820';
  tctx.fillRect(0, 0, 64, 128);
  tctx.strokeStyle = '#d6b87a';
  tctx.lineWidth = 3;
  tctx.strokeRect(5, 5, 54, 118);
  tctx.beginPath();
  tctx.moveTo(18, 100);
  tctx.bezierCurveTo(4, 70, 14, 34, 24, 30);
  tctx.moveTo(46, 100);
  tctx.bezierCurveTo(60, 70, 50, 34, 40, 30);
  tctx.moveTo(18, 100);
  tctx.lineTo(46, 100);
  for (let i = 0; i < 4; i++) {
    tctx.moveTo(26 + i * 4, 98);
    tctx.lineTo(26 + i * 4, 40);
  }
  tctx.stroke();
  const tTex = canvasTexture(tc);
  const tMat = new THREE.MeshStandardMaterial({ map: tTex, roughness: 0.9 });
  const treadles = [-1, 1].map((s) => {
    const hinge = new THREE.Group();
    hinge.position.set(s * 0.13, 0.07, -0.02);
    const plate = addBox(hinge, [0.17, 0.02, 0.3], dark);
    plate.position.z = 0.15;
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.28), tMat);
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(0, 0.011, 0.15);
    hinge.add(carpet);
    hinge.rotation.x = -0.32;
    g.add(hinge);
    return hinge;
  });
  // Round adjustable stool in front
  const stool = new THREE.Group();
  stool.position.set(0, 0, 0.62);
  add(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 20), dark, 0, 0.5, 0, stool);
  add(new THREE.CylinderGeometry(0.03, 0.04, 0.42, 10), oak, 0, 0.27, 0, stool);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const foot = add(new THREE.BoxGeometry(0.035, 0.035, 0.24), oak, Math.sin(a) * 0.1, 0.06, Math.cos(a) * 0.1, stool);
    foot.rotation.y = a;
    foot.rotation.x = -0.25;
  }
  g.add(stool);
  return { group: g, keys, treadles };
}

export function buildOrganAndHarmonium(interiorGroup: THREE.Group, mats: ChurchMaterials) {
  const N = DIM.nave;
  const nfY = DIM.naveFloorY;
  // Wooden Organ Console, Pedalboard & Bench in NW Tower Bay (IMG_3941, 3942)
  const organG = new THREE.Group();
  // Case: full depth above the keys, set back below them to leave a kneehole over the pedalboard
  addBox(organG, [0.68, 0.4, 1.26], mats.medOak, [0, 1.04, 0], { cast: true });
  addBox(organG, [0.44, 0.84, 1.26], mats.medOak, [0.12, 0.42, 0], { cast: true });
  [-1, 1].forEach((sz) => {
    addBox(organG, [0.24, 0.84, 0.05], mats.medOak, [-0.22, 0.42, sz * 0.605], { cast: true });
  });
  addBox(organG, [0.26, 0.03, 1.16], mats.medOak, [-0.45, 0.825, 0]);
  // Five-octave manual, C (MIDI 36) to C (96). Each key hangs from a pivot at its back end so it can dip when
  // played; the player sits at -X, so low notes (their left) are at +Z
  const manualKeys = buildFiveOctaveKeyboard(organG, mats, {
    span: 0.92,
    axis: 'z',
    pivotY: 0.84,
    pivotDepth: -0.39,
    natDepth: 0.15,
    natHeight: 0.02,
    sharpDepth: 0.095,
    sharpHeight: 0.014,
    castNaturalShadow: true
  });

  // Roll-top (tambour) fall drawn down over the keyboard: a quarter-round of narrow oak slats running in
  // curved grooves in the two shaped cheeks, with a moulded lip on the bottom slat to lift it by
  const arcC = new THREE.Vector2(-0.34, 0.875); // centre of the quarter-round, against the case front
  const arcR = 0.24;
  const slats = 16;
  // The slats and lip turn together about the arc centre: opening rolls them up and back into the case
  const tambour = new THREE.Group();
  tambour.position.set(arcC.x, arcC.y, 0);
  organG.add(tambour);
  for (let k = 0; k < slats; k++) {
    const a0 = Math.PI / 2 + (k / slats) * (Math.PI / 2);
    const a1 = Math.PI / 2 + ((k + 1) / slats) * (Math.PI / 2);
    const am = (a0 + a1) * 0.5;
    const slat = addBox(
      tambour,
      [arcR * (a1 - a0) - 0.002, 0.012, 0.98],
      mats.warmOak,
      [Math.cos(am) * arcR, Math.sin(am) * arcR, 0],
      { cast: true }
    );
    slat.rotation.z = am - Math.PI / 2;
  }
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.98, 10), mats.darkOak);
  lip.rotation.x = Math.PI / 2;
  lip.position.set(-arcR - 0.004, 0.006, 0);
  tambour.add(lip);
  const cheekShape = new THREE.Shape();
  cheekShape.moveTo(0, 0);
  cheekShape.lineTo(0, arcR + 0.03);
  cheekShape.absarc(0, 0, arcR + 0.03, Math.PI / 2, Math.PI, false);
  cheekShape.lineTo(0, 0);
  const cheekGeo = new THREE.ExtrudeGeometry(cheekShape, { depth: 0.04, bevelEnabled: false, curveSegments: 16 });
  [-1, 1].forEach((sz) => {
    const tCheek = new THREE.Mesh(cheekGeo, mats.medOak);
    tCheek.position.set(arcC.x, arcC.y - 0.035, sz > 0 ? 0.49 : -0.53);
    tCheek.castShadow = true;
    organG.add(tCheek);
  });

  // Bench: a seat plank on two shaped end boards, so the pedalboard runs underneath it
  addBox(organG, [0.32, 0.04, 1.12], mats.medOak, [-0.8, 0.56, 0], { cast: true });
  [-1, 1].forEach((sz) => {
    addBox(organG, [0.3, 0.54, 0.035], mats.medOak, [-0.8, 0.27, sz * 0.54], { cast: true });
  });
  addBox(organG, [0.03, 0.08, 1.04], mats.medOak, [-0.92, 0.46, 0]);

  // Flat pedalboard of 32 wooden pedals (C to G): 19 long naturals with 13 raised dark-capped sharps at the
  // case end, all on a low frame
  const pedalFrame = new THREE.Group();
  addBox(pedalFrame, [0.62, 0.03, 1.04], mats.darkOak, [-0.43, 0.015, 0], { receive: true });
  addBox(pedalFrame, [0.06, 0.08, 1.04], mats.darkOak, [-0.11, 0.04, 0]);
  const naturalSpan = 0.98;
  const nW = naturalSpan / 19;
  const natGeo = new THREE.BoxGeometry(0.56, 0.028, nW - 0.016);
  const sharpGeo = new THREE.BoxGeometry(0.15, 0.03, nW - 0.022);
  const capGeo = new THREE.BoxGeometry(0.15, 0.008, nW - 0.022);
  const pedalWood = new THREE.MeshStandardMaterial({ color: 0xc9a574, roughness: 0.6 });
  const pedalCap = new THREE.MeshStandardMaterial({ color: 0x1d1712, roughness: 0.5 });
  const hasSharpAfter = [true, true, false, true, true, true, false]; // C D E F G A B
  // Pedals hinge at the bench end (x = -0.72) so their toes, under the case, dip when played. Compass C (MIDI 36)
  // to G (67); each entry keeps its pivot for the organ animator
  const pedalKeys = new Map<number, { pivot: THREE.Object3D; angle: number }>();
  const naturalSteps = [0, 2, 4, 5, 7, 9, 11];
  const pedalHingeX = -0.72;
  for (let n = 0; n < 19; n++) {
    // Player sits at -X, so their left (low notes) is +Z
    const z = naturalSpan * 0.5 - (n + 0.5) * nW;
    const midi = 36 + Math.floor(n / 7) * 12 + naturalSteps[n % 7];
    const natPivot = new THREE.Group();
    natPivot.position.set(pedalHingeX, 0.044, z);
    const nat = new THREE.Mesh(natGeo, pedalWood);
    nat.position.set(-0.44 - pedalHingeX, 0, 0);
    nat.castShadow = true;
    nat.receiveShadow = true;
    natPivot.add(nat);
    pedalFrame.add(natPivot);
    pedalKeys.set(midi, { pivot: natPivot, angle: 0 });
    if (n < 18 && hasSharpAfter[n % 7]) {
      const sharpPivot = new THREE.Group();
      sharpPivot.position.set(pedalHingeX, 0.073, z - nW * 0.5);
      const sharp = new THREE.Mesh(sharpGeo, pedalWood);
      sharp.position.set(-0.22 - pedalHingeX, 0, 0);
      sharp.castShadow = true;
      sharpPivot.add(sharp);
      const cap = new THREE.Mesh(capGeo, pedalCap);
      cap.position.set(-0.22 - pedalHingeX, 0.019, 0);
      sharpPivot.add(cap);
      pedalFrame.add(sharpPivot);
      pedalKeys.set(midi + 1, { pivot: sharpPivot, angle: 0 });
    }
  }
  organG.add(pedalFrame);
  // White anglepoise lamp standing on the organ case, its shade angled down over the music desk & keys
  const lamp = buildAnglepoiseLamp();
  lamp.position.set(0.04, 1.24, 0.36);
  lamp.rotation.y = Math.PI;
  lamp.userData.era = 'today'; // electric
  organG.add(lamp);
  organG.position.set(-4.32, nfY, -1.72);
  organG.rotation.y = 0;
  organG.userData.era = 'today'; // in 1900 a pedal harmonium at the front of the nave instead
  interiorGroup.add(organG);

  // 1900: pedal harmonium at the front of the nave against the South wall, beside the rood screen, facing North
  const harmonium = buildHarmonium(mats);
  markEra1900(harmonium.group);
  harmonium.group.position.set(2.42, nfY, N.zSouthInt - 0.27);
  harmonium.group.rotation.y = Math.PI;
  interiorGroup.add(harmonium.group);
  let treadlePhase = 0;

  // Organ animator: while the voluntary plays the tambour rolls open and the keys and pedals follow the notes;
  // when it stops they come to rest and the tambour rolls shut. `notes` is { manual: Set, pedal: Set } of MIDI.
  let tambourOpen = 0;
  const organAnimator = {
    update(dt: number, playing: boolean, notes?: OrganNotes | null) {
      const openTarget = playing ? 1 : 0;
      const step = dt / 1.4; // ~1.4s to roll fully open or shut
      tambourOpen += Math.max(-step, Math.min(step, openTarget - tambourOpen));
      const eased = tambourOpen * tambourOpen * (3 - 2 * tambourOpen);
      // A little past a quarter turn so the lifting lip tucks inside the case
      tambour.rotation.z = -eased * (Math.PI / 2 + 0.1);
      const k = Math.min(1, dt * 28);
      manualKeys.forEach((key, midi) => {
        const target = playing && notes?.manual.has(midi) ? 0.055 : 0;
        key.angle += (target - key.angle) * k;
        key.pivot.rotation.z = key.angle;
      });
      pedalKeys.forEach((key, midi) => {
        const target = playing && notes?.pedal.has(midi) ? -0.032 : 0;
        key.angle += (target - key.angle) * k;
        key.pivot.rotation.z = key.angle;
      });
      // The harmonium (1900) plays the manual part, its treadles pumping in turn while it sounds
      harmonium.keys.forEach((key, midi) => {
        const target = playing && notes?.manual.has(midi) ? -0.06 : 0;
        key.angle += (target - key.angle) * k;
        key.pivot.rotation.x = key.angle;
      });
      if (playing) treadlePhase += dt * 4.2;
      harmonium.treadles.forEach((t, i) => {
        const pump = playing ? 0.5 + 0.5 * Math.sin(treadlePhase + i * Math.PI) : 0.5;
        t.rotation.x = -0.18 - pump * 0.22;
      });
    }
  };

  return organAnimator;
}
