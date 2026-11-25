// Interior lighting fixtures (electric pendants, spotlights, anglepoise lamps, 1900 paraffin lamps)
// and custom GLSL flickering candle / oil flame rig.
import * as THREE from 'three';
import { canvas2d, canvasTexture, makeCanvas } from '../canvas-utils.ts';
import { addBox } from '../mesh-utils.ts';
import type { ChurchMaterials } from '../textures.ts';
import { markEra1900 } from './props.ts';

type PendantGeometries = {
  shadeGeo: THREE.BufferGeometry;
  lipGeo: THREE.BufferGeometry;
  capGeo: THREE.BufferGeometry;
  bulbGeo: THREE.BufferGeometry;
  linkGeo: THREE.BufferGeometry;
  armGeo: THREE.BufferGeometry;
  upperScrollGeo: THREE.BufferGeometry;
  underScrollGeo: THREE.BufferGeometry;
  fleurGeo: THREE.BufferGeometry;
  collarGeo: THREE.BufferGeometry;
  ringGeo: THREE.BufferGeometry;
  bossGeo: THREE.BufferGeometry;
  roseGeo: THREE.BufferGeometry;
  hookGeo: THREE.BufferGeometry;
};

type OilLampAssets = {
  fontGeo: THREE.BufferGeometry;
  chimneyGeo: THREE.BufferGeometry;
  burnerGeo: THREE.BufferGeometry;
  flameGeo: THREE.BufferGeometry;
  chimneyMat: THREE.Material;
  flameMat: THREE.Material;
};

type LitCandle = {
  flamePivot: THREE.Group;
  flameMat: THREE.ShaderMaterial;
  halo: THREE.Sprite;
  light: THREE.PointLight;
  scale: number;
  phase: number;
  baseIntensity: number;
  baseHalo: number;
};

type OilFlame = {
  flameMat: THREE.ShaderMaterial;
  light: THREE.PointLight;
  phase: number;
};

type Vec3Pair = [THREE.Vector3, THREE.Vector3];

export function buildAnglepoiseLamp() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.35, metalness: 0.05 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.35, metalness: 0.8 });
  const add = (mesh: THREE.Mesh) => {
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  const base = add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.03, 28), white));
  base.position.y = 0.015;
  const step = add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.015, 24), white));
  step.position.y = 0.037;
  const knuckle = add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.04, 12), steel));
  knuckle.rotation.x = Math.PI / 2;
  knuckle.position.y = 0.058;

  // An arm section of two parallel bars from a to b, with a coiled spring alongside
  const arm = (a: THREE.Vector3, b: THREE.Vector3) => {
    const d = b.clone().sub(a);
    const len = d.length();
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const ang = Math.atan2(d.y, d.x) - Math.PI / 2;
    [-0.011, 0.011].forEach((z) => {
      const bar = add(new THREE.Mesh(new THREE.BoxGeometry(0.008, len, 0.005), white));
      bar.position.set(mid.x, mid.y, z);
      bar.rotation.z = ang;
    });
    const springPts: THREE.Vector3[] = [];
    const turns = 22;
    for (let i = 0; i <= turns * 8; i++) {
      const t = i / (turns * 8);
      const a2 = t * turns * Math.PI * 2;
      springPts.push(new THREE.Vector3(Math.cos(a2) * 0.005, (t - 0.5) * len * 0.45, Math.sin(a2) * 0.005));
    }
    const spring = add(
      new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPts), turns * 8, 0.0012, 4), steel)
    );
    spring.position.set(mid.x + Math.cos(ang) * 0.016, mid.y + Math.sin(ang) * 0.016, 0);
    spring.rotation.z = ang;
    const joint = add(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.03, 12), steel));
    joint.rotation.x = Math.PI / 2;
    joint.position.copy(b);
  };
  const p0 = new THREE.Vector3(0, 0.058, 0);
  const p1 = new THREE.Vector3(0.1, 0.33, 0); // elbow
  const p2 = new THREE.Vector3(0.36, 0.38, 0); // wrist
  arm(p0, p1);
  arm(p1, p2);

  // Conical shade hanging from the wrist, mouth tipped down & outwards
  const shadeG = new THREE.Group();
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.07, 0.12, 28, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide })
  );
  shade.castShadow = true;
  shade.position.y = -0.06;
  shadeG.add(shade);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), white);
  shadeG.add(cap);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xffe4b0, emissiveIntensity: 2.2, roughness: 0.3 })
  );
  bulb.position.y = -0.085;
  shadeG.add(bulb);
  // Switched on: a warm pool of light thrown down out of the shade, with a soft glow inside it
  const spot = new THREE.SpotLight(0xffd8a0, 2.2, 2.2, 0.62, 0.55, 1.6);
  spot.position.y = -0.07;
  spot.target.position.set(0, -1, 0);
  shadeG.add(spot, spot.target);
  const glow = new THREE.PointLight(0xffd8a0, 0.12, 0.5, 2);
  glow.position.y = -0.1;
  shadeG.add(glow);
  shadeG.position.copy(p2).add(new THREE.Vector3(0.02, -0.01, 0));
  shadeG.rotation.z = 0.22; // mouth faces down, a little out along +X, over the keys
  g.add(shadeG);
  return g;
}

let pendantGeoCache: PendantGeometries | null = null;
function getPendantGeometries() {
  if (pendantGeoCache) return pendantGeoCache;

  // Opal-white tulip bell shade with a hand-crimped, ruffled (frilled) rim (user photo of the nave lamps)
  const profile = [
    [0.016, 0.0],
    [0.028, -0.004],
    [0.042, -0.018],
    [0.052, -0.042],
    [0.058, -0.075],
    [0.06, -0.11],
    [0.064, -0.14],
    [0.074, -0.162],
    [0.092, -0.18],
    [0.108, -0.19],
    [0.114, -0.194]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const shadeGeo = new THREE.LatheGeometry(profile, 72);
  const pos = shadeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp((-0.15 - y) / 0.044, 0, 1);
    if (t <= 0) continue;
    const theta = Math.atan2(x, z);
    // 11 soft scalloped crimps around the rim, rising & falling, with slight in/out flutter
    const wave = Math.sin(theta * 11);
    const radial = 1 + 0.035 * t * Math.cos(theta * 11);
    pos.setX(i, x * radial);
    pos.setZ(i, z * radial);
    pos.setY(i, y + 0.016 * t * t * wave);
  }
  shadeGeo.computeVertexNormals();

  // Thin clear-glass crimped lip around the very edge of the frill
  const lipPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 96; i++) {
    const theta = (i / 96) * Math.PI * 2;
    const r = 0.114 * (1 + 0.035 * Math.cos(theta * 11));
    lipPts.push(new THREE.Vector3(Math.sin(theta) * r, -0.194 + 0.016 * Math.sin(theta * 11), Math.cos(theta) * r));
  }
  const lipGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lipPts, true), 120, 0.0035, 5, true);

  // Cast-iron gallery cap that grips the shade neck
  const capGeo = new THREE.CylinderGeometry(0.014, 0.024, 0.032, 12);
  const bulbGeo = new THREE.SphereGeometry(0.028, 10, 8);

  // Single forged chain link (elongated oval ring)
  const linkGeo = new THREE.TorusGeometry(0.0095, 0.0026, 4, 10);
  linkGeo.scale(1, 1.55, 1);

  // Scrolled wrought-iron arm (local +X direction) connecting the central circular ring to each lamp
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.145, 0.0, 0),
    new THREE.Vector3(0.21, 0.034, 0),
    new THREE.Vector3(0.29, 0.07, 0),
    new THREE.Vector3(0.365, 0.082, 0),
    new THREE.Vector3(0.42, 0.064, 0),
    new THREE.Vector3(0.45, 0.024, 0),
    new THREE.Vector3(0.456, -0.02, 0)
  ]);
  const armGeo = new THREE.TubeGeometry(armCurve, 40, 0.0085, 6, false);

  // Spiral C-scroll curls forming the lateral petals of the wrought-iron fleur-de-lys bracket
  const spiralCurve = (
    cx: number,
    cy: number,
    startAng: number,
    r0: number,
    r1: number,
    turns: number,
    dir: number
  ) => {
    const pts: THREE.Vector3[] = [];
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = startAng + dir * t * turns * Math.PI * 2;
      const r = r0 + (r1 - r0) * t;
      pts.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0));
    }
    return new THREE.CatmullRomCurve3(pts);
  };
  const upperScrollGeo = new THREE.TubeGeometry(
    spiralCurve(0.37, 0.122, -Math.PI / 2, 0.042, 0.011, 1.15, -1),
    36,
    0.0065,
    6,
    false
  );
  const underScrollGeo = new THREE.TubeGeometry(
    spiralCurve(0.275, 0.032, Math.PI / 2, 0.034, 0.009, 1.1, 1),
    36,
    0.0058,
    6,
    false
  );

  // Sculpted wrought-iron fleur-de-lys crest bridging between the central circular mount ring and each lamp
  const fleurShape = new THREE.Shape();
  fleurShape.moveTo(0, -0.032);
  fleurShape.quadraticCurveTo(0.014, -0.014, 0.007, 0.004);
  // Right curved lateral lily petal
  fleurShape.bezierCurveTo(0.032, 0.008, 0.048, 0.036, 0.036, 0.056);
  fleurShape.bezierCurveTo(0.026, 0.068, 0.013, 0.052, 0.011, 0.028);
  // Tall pointed central spearhead petal
  fleurShape.bezierCurveTo(0.015, 0.052, 0.011, 0.078, 0, 0.098);
  fleurShape.bezierCurveTo(-0.011, 0.078, -0.015, 0.052, -0.011, 0.028);
  // Left curved lateral lily petal
  fleurShape.bezierCurveTo(-0.013, 0.052, -0.026, 0.068, -0.036, 0.056);
  fleurShape.bezierCurveTo(-0.048, 0.036, -0.032, 0.008, -0.007, 0.004);
  fleurShape.quadraticCurveTo(-0.014, -0.014, 0, -0.032);
  const fleurGeo = new THREE.ExtrudeGeometry(fleurShape, {
    depth: 0.007,
    bevelEnabled: true,
    bevelThickness: 0.0018,
    bevelSize: 0.0015,
    bevelSegments: 2
  });
  fleurGeo.translate(0, 0, -0.0035);

  // Forged iron tie-collar wrapping the base of the fleur-de-lys onto the arm
  const collarGeo = new THREE.BoxGeometry(0.022, 0.012, 0.014);

  const ringGeo = new THREE.TorusGeometry(0.15, 0.011, 8, 40);
  ringGeo.rotateX(Math.PI / 2);
  const bossGeo = new THREE.SphereGeometry(0.018, 8, 6);
  bossGeo.scale(1, 0.7, 1.35);

  const roseGeo = new THREE.CylinderGeometry(0.05, 0.065, 0.035, 16);
  const hookGeo = new THREE.TorusGeometry(0.016, 0.004, 6, 12);

  pendantGeoCache = {
    shadeGeo,
    lipGeo,
    capGeo,
    bulbGeo,
    linkGeo,
    armGeo,
    upperScrollGeo,
    underScrollGeo,
    fleurGeo,
    collarGeo,
    ringGeo,
    bossGeo,
    roseGeo,
    hookGeo
  };
  return pendantGeoCache;
}

// Build a 3-light Edwardian wrought-iron pendant:
// ceiling rose & hook, 3 forged link chains descending to the central circular mount ring, and 3 equidistant
// lamps spaced 120° apart around the ring with wrought-iron fleur-de-lys brackets connecting the ring to each lamp.

export function buildChandelier(dropHeight: number, mats: ChurchMaterials, lightIntensity = 1.6) {
  const g = new THREE.Group();
  const geo = getPendantGeometries();
  const ringY = -dropHeight;

  // Ceiling rose & suspension hook
  const rose = new THREE.Mesh(geo.roseGeo, mats.iron);
  rose.position.y = -0.0175;
  g.add(rose);
  const hook = new THREE.Mesh(geo.hookGeo, mats.iron);
  hook.position.y = -0.05;
  g.add(hook);

  // Opal glass shade + clear crimped lip + iron gallery cap + glowing lamp inside
  const addShade = (x: number, y: number, z: number, scale: number) => {
    const sg = new THREE.Group();
    const cap = new THREE.Mesh(geo.capGeo, mats.iron);
    cap.position.y = 0.006;
    sg.add(cap);
    const shade = new THREE.Mesh(geo.shadeGeo, mats.opalGlass);
    shade.position.y = -0.008;
    sg.add(shade);
    const lip = new THREE.Mesh(geo.lipGeo, mats.opalGlassLip);
    lip.position.y = -0.008;
    sg.add(lip);
    const bulb = new THREE.Mesh(geo.bulbGeo, mats.glassShade);
    bulb.position.y = -0.08;
    sg.add(bulb);
    sg.position.set(x, y, z);
    sg.scale.setScalar(scale);
    g.add(sg);
  };

  // Central horizontal circular wrought-iron mount ring
  const ring = new THREE.Mesh(geo.ringGeo, mats.iron);
  ring.position.y = ringY;
  g.add(ring);

  // 3 equidistant lamps (120° apart) around the central circular mount ring,
  // each connected from the ring by a scrolled wrought-iron arm + fleur-de-lys motif
  const chainRuns: Vec3Pair[] = [];
  for (let i = 0; i < 3; i++) {
    const ang = (i * Math.PI * 2) / 3 + Math.PI / 6;
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);

    // Decorative cast boss on the circular ring between the 3 arm junctions
    const midAng = ang + Math.PI / 3;
    const boss = new THREE.Mesh(geo.bossGeo, mats.iron);
    boss.position.set(Math.cos(midAng) * 0.15, ringY - 0.005, Math.sin(midAng) * 0.15);
    boss.rotation.y = -midAng;
    g.add(boss);

    // Radial arm + fleur-de-lys connecting the central ring to the lamp
    const arm = new THREE.Group();
    arm.add(new THREE.Mesh(geo.armGeo, mats.iron));
    arm.add(new THREE.Mesh(geo.upperScrollGeo, mats.iron));
    arm.add(new THREE.Mesh(geo.underScrollGeo, mats.iron));

    // Inner fleur-de-lys at the ring-to-arm junction + outer fleur-de-lys crest along the arm
    const ringFleur = new THREE.Mesh(geo.fleurGeo, mats.iron);
    ringFleur.position.set(0.185, 0.022, 0);
    ringFleur.rotation.z = -0.42;
    ringFleur.scale.setScalar(0.78);
    arm.add(ringFleur);

    const crestFleur = new THREE.Mesh(geo.fleurGeo, mats.iron);
    crestFleur.position.set(0.345, 0.078, 0);
    crestFleur.rotation.z = -0.12;
    arm.add(crestFleur);

    const collar = new THREE.Mesh(geo.collarGeo, mats.iron);
    collar.position.set(0.345, 0.08, 0);
    arm.add(collar);

    arm.position.y = ringY;
    arm.rotation.y = -ang;
    g.add(arm);

    // Equidistant lamp hanging from the outer tip of the fleur-de-lys arm
    const lampR = 0.456;
    addShade(cosA * lampR, ringY - 0.032, sinA * lampR, 1);

    // Forged suspension chain from the ceiling rose down to this arm's mount point on the circular ring
    chainRuns.push([
      new THREE.Vector3(cosA * 0.016, -0.06, sinA * 0.016),
      new THREE.Vector3(cosA * 0.15, ringY + 0.012, sinA * 0.15)
    ]);
  }
  const linkPitch = 0.024;
  let linkCount = 0;
  chainRuns.forEach(([a, b]) => {
    linkCount += Math.max(2, Math.floor(a.distanceTo(b) / linkPitch));
  });
  const chain = new THREE.InstancedMesh(geo.linkGeo, mats.iron, linkCount);
  const up = new THREE.Vector3(0, 1, 0);
  const dirV = new THREE.Vector3();
  const alignQ = new THREE.Quaternion();
  const twistQ = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  let li = 0;
  chainRuns.forEach(([a, b]) => {
    const n = Math.max(2, Math.floor(a.distanceTo(b) / linkPitch));
    dirV.subVectors(b, a).normalize();
    alignQ.setFromUnitVectors(up, dirV);
    for (let k = 0; k < n; k++) {
      p.lerpVectors(a, b, (k + 0.5) / n);
      twistQ.setFromAxisAngle(up, k % 2 === 0 ? 0 : Math.PI / 2);
      const q = alignQ.clone().multiply(twistQ);
      m.compose(p, q, one);
      chain.setMatrixAt(li++, m);
    }
  });
  chain.instanceMatrix.needsUpdate = true;
  g.add(chain);

  // Warm interior pendant PointLight
  const light = new THREE.PointLight(0xffdfb0, lightIntensity, 10.5, 1.7);
  light.position.set(0, ringY - 0.2, 0);
  light.castShadow = false;
  g.add(light);

  return { group: g, light };
}

// Helper to build a smoothly curved, subtly creased botanical blade (leaf or cupped flower petal)

export function buildCeilingSpotlight(aim: THREE.Vector3, mountPos: THREE.Vector3, inward: THREE.Vector3) {
  const black = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.45, metalness: 0.55 });
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0xfff1d6,
    emissive: 0xffe2b0,
    emissiveIntensity: 1.6,
    roughness: 0.2
  });
  const g = new THREE.Group();

  // Ceiling plate and drop rod, aligned to the ceiling normal
  const mount = new THREE.Group();
  mount.position.copy(mountPos);
  mount.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), inward);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 20), black);
  plate.position.y = -0.006;
  mount.add(plate);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 8), black);
  rod.position.y = -0.06;
  mount.add(rod);
  g.add(mount);

  // Pivot at the end of the rod, from which the can points at the target
  const pivotPos = mountPos.clone().addScaledVector(inward, 0.11);
  const head = new THREE.Group();
  head.position.copy(pivotPos);
  head.lookAt(aim); // local +z now points at the target
  const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 16, Math.PI), black);
  yoke.rotation.z = Math.PI / 2;
  head.add(yoke);
  const canGeo = new THREE.CylinderGeometry(0.042, 0.038, 0.15, 20, 1, true);
  canGeo.rotateX(Math.PI / 2);
  const can = new THREE.Mesh(
    canGeo,
    new THREE.MeshStandardMaterial({
      color: 0x141414,
      roughness: 0.45,
      metalness: 0.55,
      side: THREE.DoubleSide
    })
  );
  head.add(can);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.01, 20), black);
  back.rotation.x = Math.PI / 2;
  back.position.z = -0.075;
  head.add(back);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.036, 20), lensMat);
  lens.position.z = 0.05;
  head.add(lens);
  // Cooling fins round the back of the can
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.003, 4, 20), black);
    fin.position.z = -0.06 + i * 0.016;
    head.add(fin);
  }
  g.add(head);

  // The light itself: a narrow warm beam from the lens onto the altar
  const lensWorld = pivotPos.clone().addScaledVector(aim.clone().sub(pivotPos).normalize(), 0.06);
  const light = new THREE.SpotLight(0xffe4bc, 3.2, 9, 0.2, 0.5, 1.2);
  light.position.copy(lensWorld);
  light.target.position.copy(aim);
  g.add(light, light.target);
  return g;
}

let oilLampAssets: OilLampAssets | null = null;
function getOilLampAssets() {
  if (oilLampAssets) return oilLampAssets;
  const fontProfile = [
    [0.0, 0.0],
    [0.03, 0.0],
    [0.05, 0.012],
    [0.085, 0.04],
    [0.098, 0.07],
    [0.09, 0.1],
    [0.06, 0.122],
    [0.026, 0.13],
    [0.024, 0.15]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const chimneyProfile = [
    [0.024, 0.0],
    [0.026, 0.02],
    [0.042, 0.06],
    [0.042, 0.085],
    [0.024, 0.13],
    [0.022, 0.25]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  oilLampAssets = {
    fontGeo: new THREE.LatheGeometry(fontProfile, 28),
    chimneyGeo: new THREE.LatheGeometry(chimneyProfile, 24),
    burnerGeo: new THREE.CylinderGeometry(0.03, 0.034, 0.03, 16),
    flameGeo: new THREE.SphereGeometry(0.014, 10, 8).scale(1, 2.2, 1),
    chimneyMat: new THREE.MeshStandardMaterial({
      color: 0xf4f1e8,
      roughness: 0.05,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false
    }),
    flameMat: new THREE.MeshBasicMaterial({ color: 0xffc46a })
  };
  return oilLampAssets;
}

function buildParaffinLamp(mats: ChurchMaterials) {
  const a = getOilLampAssets();
  const g = new THREE.Group();
  const font = new THREE.Mesh(a.fontGeo, mats.brass);
  font.castShadow = true;
  g.add(font);
  const burner = new THREE.Mesh(a.burnerGeo, mats.brass);
  burner.position.y = 0.165;
  g.add(burner);
  const flame = new THREE.Mesh(a.flameGeo, a.flameMat);
  flame.position.y = 0.205;
  g.add(flame);
  g.userData.flame = flame; // buildInterior swaps in the flickering candle-flame shader
  const chimney = new THREE.Mesh(a.chimneyGeo, a.chimneyMat);
  chimney.position.y = 0.18;
  g.add(chimney);
  return g;
}

// The nave & chancel pendants as they were lit by paraffin: the same three-armed wrought-iron saddle turned the
// other way up, its three arm ends chained to the ceiling rose and a single lamp standing in the central ring

export function buildOilPendant(dropHeight: number, mats: ChurchMaterials) {
  const g = markEra1900(new THREE.Group());
  const geo = getPendantGeometries();
  const ringY = -dropHeight + 0.35; // the lamp stands above the ring, so the ring hangs a little higher

  const rose = new THREE.Mesh(geo.roseGeo, mats.iron);
  rose.position.y = -0.0175;
  g.add(rose);
  const hook = new THREE.Mesh(geo.hookGeo, mats.iron);
  hook.position.y = -0.05;
  g.add(hook);

  // Saddle: ring, bosses and the three scrolled arms with their fleurs-de-lys, then turned upside down
  const saddle = new THREE.Group();
  saddle.add(new THREE.Mesh(geo.ringGeo, mats.iron));
  const tips: THREE.Vector3[] = [];
  for (let i = 0; i < 3; i++) {
    const ang = (i * Math.PI * 2) / 3 + Math.PI / 6;
    const midAng = ang + Math.PI / 3;
    const boss = new THREE.Mesh(geo.bossGeo, mats.iron);
    boss.position.set(Math.cos(midAng) * 0.15, -0.005, Math.sin(midAng) * 0.15);
    boss.rotation.y = -midAng;
    saddle.add(boss);
    const arm = new THREE.Group();
    arm.add(new THREE.Mesh(geo.armGeo, mats.iron));
    arm.add(new THREE.Mesh(geo.upperScrollGeo, mats.iron));
    arm.add(new THREE.Mesh(geo.underScrollGeo, mats.iron));
    const ringFleur = new THREE.Mesh(geo.fleurGeo, mats.iron);
    ringFleur.position.set(0.185, 0.022, 0);
    ringFleur.rotation.z = -0.42;
    ringFleur.scale.setScalar(0.78);
    arm.add(ringFleur);
    const crestFleur = new THREE.Mesh(geo.fleurGeo, mats.iron);
    crestFleur.position.set(0.345, 0.078, 0);
    crestFleur.rotation.z = -0.12;
    arm.add(crestFleur);
    arm.rotation.y = -ang;
    saddle.add(arm);
    // Arm end (0.456, -0.02) in the saddle; turned over (rotation.x = PI) that is (x, +0.02, -z)
    tips.push(new THREE.Vector3(Math.cos(ang) * 0.456, ringY + 0.02, -Math.sin(ang) * 0.456));
  }
  saddle.rotation.x = Math.PI;
  saddle.position.y = ringY;
  g.add(saddle);

  // Small eye on each upturned arm end, and a chain from the rose down to it
  const chainRuns = tips.map((tip) => {
    const eye = new THREE.Mesh(geo.hookGeo, mats.iron);
    eye.position.copy(tip).setY(tip.y + 0.012);
    eye.rotation.y = Math.atan2(tip.z, tip.x);
    g.add(eye);
    return [new THREE.Vector3(tip.x * 0.035, -0.06, tip.z * 0.035), tip.clone().setY(tip.y + 0.024)];
  });
  const linkPitch = 0.024;
  const counts = chainRuns.map(([a, b]) => Math.max(2, Math.floor(a.distanceTo(b) / linkPitch)));
  const chain = new THREE.InstancedMesh(
    geo.linkGeo,
    mats.iron,
    counts.reduce((n, c) => n + c, 0)
  );
  const up = new THREE.Vector3(0, 1, 0);
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  let li = 0;
  chainRuns.forEach(([a, b], r) => {
    const alignQ = new THREE.Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize());
    for (let k = 0; k < counts[r]; k++) {
      p.lerpVectors(a, b, (k + 0.5) / counts[r]);
      const q = alignQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(up, k % 2 ? Math.PI / 2 : 0));
      chain.setMatrixAt(li++, m.compose(p, q, one));
    }
  });
  chain.instanceMatrix.needsUpdate = true;
  g.add(chain);

  // The lamp's font sits down in the ring
  const lamp = buildParaffinLamp(mats);
  lamp.position.y = ringY - 0.06;
  lamp.scale.setScalar(1.15);
  g.add(lamp);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), mats.brass);
  finial.position.y = ringY - 0.075;
  g.add(finial);

  const light = new THREE.PointLight(0xffb866, 1.2, 8.5, 1.8);
  light.position.y = ringY + 0.3;
  g.add(light);
  return { group: g, light, flame: lamp.userData.flame };
}

// Paraffin bracket lamp on a wall (faces +Z, back on the wall at z = 0): iron back plate with a silvered
// reflector, a scrolled arm and a ring holding the lamp

export function buildOilWallLamp(mats: ChurchMaterials) {
  const g = markEra1900(new THREE.Group());
  addBox(g, [0.1, 0.22, 0.012], mats.iron, [0, 0.02, 0.006]);
  const reflector = new THREE.Mesh(
    new THREE.CircleGeometry(0.1, 28),
    new THREE.MeshStandardMaterial({ color: 0xe8e6e0, metalness: 0.9, roughness: 0.18 })
  );
  reflector.position.set(0, 0.2, 0.016);
  g.add(reflector);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.006, 6, 28), mats.brass);
  rim.position.set(0, 0.2, 0.016);
  g.add(rim);
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.06, 0.012),
    new THREE.Vector3(0, -0.07, 0.08),
    new THREE.Vector3(0, -0.035, 0.15),
    new THREE.Vector3(0, -0.005, 0.19)
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(armCurve, 24, 0.008, 6, false), mats.iron));
  const curl = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.005, 6, 16, Math.PI * 1.5), mats.iron);
  curl.rotation.y = Math.PI / 2;
  curl.position.set(0, -0.085, 0.05);
  g.add(curl);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 8, 24), mats.iron);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0, 0.19);
  g.add(ring);
  const lamp = buildParaffinLamp(mats);
  lamp.position.set(0, -0.04, 0.19);
  g.add(lamp);
  const light = new THREE.PointLight(0xffb866, 0.7, 5, 1.8);
  light.position.set(0, 0.2, 0.25);
  g.add(light);
  return { group: g, light, flame: lamp.userData.flame };
}

// Octagonal cast-iron 'Tortoise' slow-combustion stove (Charles Portway & Son, Halstead), its feed door facing the
// aisle (-Z). The flue leaves the back, rises to three-quarters of the way up the South wall and turns into it.

export function createCandleRig(interiorGroup: THREE.Group) {
  // Smooth high-resolution teardrop geometry + custom GLSL semi-transparent flickering candle flame shader
  const flameProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.0055, 0.004),
    new THREE.Vector2(0.0105, 0.011),
    new THREE.Vector2(0.0138, 0.021),
    new THREE.Vector2(0.0136, 0.032),
    new THREE.Vector2(0.0114, 0.045),
    new THREE.Vector2(0.008, 0.058),
    new THREE.Vector2(0.0042, 0.07),
    new THREE.Vector2(0.0014, 0.078),
    new THREE.Vector2(0.0, 0.082)
  ];
  const flameGeo = new THREE.LatheGeometry(flameProfile, 20);
  const wickGeo = new THREE.CylinderGeometry(0.0018, 0.0024, 0.018, 6);
  const wickMat = new THREE.MeshBasicMaterial({ color: 0x1a110a });
  const emberGeo = new THREE.SphereGeometry(0.0025, 8, 6);
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xff6b1c, toneMapped: false });

  function createFlameShaderMaterial(phase: number) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPhase: { value: phase },
        uBoost: { value: 1.0 }
      },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      vertexShader: `
        uniform float uTime;
        uniform float uPhase;
        varying float vH;
        varying vec3 vViewNormal;
        varying vec3 vViewDir;

        void main() {
          vec3 pos = position;
          float h = clamp(pos.y / 0.082, 0.0, 1.0);
          vH = h;

          // Organic travelling convection wave & church draught bend (base pinned cleanly at wick)
          float bend = pow(h, 1.45);
          float swayX = (sin(uTime * 3.4 + uPhase) * 0.0055
            + sin(uTime * 8.9 - h * 5.2 + uPhase * 1.7) * 0.0036
            + sin(uTime * 17.3 - h * 8.5 + uPhase * 2.9) * 0.0016) * bend;
          float swayZ = (cos(uTime * 2.9 + uPhase * 0.8) * 0.0055
            + cos(uTime * 7.8 - h * 4.8 + uPhase * 2.1) * 0.0034
            + sin(uTime * 15.6 - h * 7.6 + uPhase * 3.1) * 0.0015) * bend;

          // Subtle breathing width & rising stretch flicker
          float breath = 1.0 + sin(uTime * 10.4 - h * 4.5 + uPhase) * 0.085 * h
            + sin(uTime * 19.2 + uPhase * 2.3) * 0.045 * h;
          float stretch = 1.0 + sin(uTime * 6.8 + uPhase) * 0.09
            + sin(uTime * 15.1 + uPhase * 1.6) * 0.055;

          pos.x = pos.x * breath + swayX;
          pos.z = pos.z * breath + swayZ;
          pos.y *= stretch;

          vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
          vViewNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uPhase;
        uniform float uBoost;
        varying float vH;
        varying vec3 vViewNormal;
        varying vec3 vViewDir;

        void main() {
          // Soft Fresnel silhouette falloff so edges dissolve semi-transparently instead of hard cones
          float ndotv = clamp(abs(dot(normalize(vViewNormal), normalize(vViewDir))), 0.0, 1.0);
          float softEdge = pow(ndotv, 1.35);
          float hotCore = pow(ndotv, 2.8);

          // Animated internal convection shimmer
          float shimmer = 0.92 + 0.08 * sin(vH * 15.0 - uTime * 17.5 + uPhase)
            + 0.05 * sin(uTime * 23.0 + uPhase * 2.1);

          // Realistic candle flame thermal zones: translucent blue base -> golden body -> white-hot heart -> orange tip
          vec3 blueZone = vec3(0.22, 0.48, 1.0);
          vec3 amberEdge = vec3(1.0, 0.44, 0.06);
          vec3 goldBody = vec3(1.0, 0.78, 0.24);
          vec3 whiteHeart = vec3(1.0, 0.99, 0.9);
          vec3 tipOrange = vec3(1.0, 0.34, 0.04);

          vec3 col = mix(blueZone, goldBody, smoothstep(0.06, 0.28, vH));
          col = mix(col, tipOrange, smoothstep(0.62, 0.96, vH));
          // Outer thin mantle stays warmer amber while thick center glows incandescent white-gold
          col = mix(amberEdge, col, smoothstep(0.08, 0.55, ndotv));
          float heartMask = smoothstep(0.18, 0.42, vH) * smoothstep(0.84, 0.48, vH);
          col = mix(col, whiteHeart, hotCore * heartMask * 0.92);
          col *= shimmer * (0.94 + 0.14 * uBoost);

          // Semi-transparent alpha profile: airy blue base, soft feathered edges, translucent body, dissolving tip
          float baseFade = smoothstep(0.0, 0.12, vH);
          float tipFade = smoothstep(1.0, 0.64, vH);
          // Slightly more transparent in the lower dark-mantle zone around the wick so the wick peeks through
          float lowerSheath = mix(0.42, 0.84, smoothstep(0.08, 0.42, vH));
          float alpha = softEdge * baseFade * tipFade * lowerSheath * shimmer;
          // Boost opacity slightly only at the luminous incandescent heart
          alpha = clamp(alpha + hotCore * heartMask * 0.22, 0.0, 0.88);

          gl_FragColor = vec4(col, alpha);
        }
      `
    });
  }

  const haloCanvas = makeCanvas(64, 64);
  const hctx = canvas2d(haloCanvas);
  const hGrad = hctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  hGrad.addColorStop(0.0, 'rgba(255, 244, 196, 0.72)');
  hGrad.addColorStop(0.24, 'rgba(255, 174, 60, 0.36)');
  hGrad.addColorStop(0.58, 'rgba(255, 112, 20, 0.12)');
  hGrad.addColorStop(1.0, 'rgba(255, 90, 10, 0.0)');
  hctx.fillStyle = hGrad;
  hctx.fillRect(0, 0, 64, 64);
  const haloTex = canvasTexture(haloCanvas);

  // Smooth top-to-bottom gradient texture so the subsurface wax glow fades seamlessly down the shaft
  const waxGlowCanvas = makeCanvas(4, 64);
  const wgCtx = canvas2d(waxGlowCanvas);
  const wgGrad = wgCtx.createLinearGradient(0, 0, 0, 64);
  wgGrad.addColorStop(0.0, 'rgba(255, 198, 96, 0.9)');
  wgGrad.addColorStop(0.35, 'rgba(255, 168, 62, 0.42)');
  wgGrad.addColorStop(1.0, 'rgba(255, 140, 40, 0.0)');
  wgCtx.fillStyle = wgGrad;
  wgCtx.fillRect(0, 0, 4, 64);
  const waxGlowTex = canvasTexture(waxGlowCanvas);

  const waxGlowMat = new THREE.MeshBasicMaterial({
    map: waxGlowTex,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });

  const litCandles: LitCandle[] = [];
  // 1900 paraffin lamps: the lamp's flame becomes the same flickering shader flame as the candles, and its light
  // flickers with it (main.js keeps the mood level in light.userData.moodIntensity)
  const oilFlames: OilFlame[] = [];
  function addOilFlame({ flame, light }: { flame: THREE.Mesh; light: THREE.PointLight }) {
    const phase = oilFlames.length * 1.9 + 0.7;
    const flameMat = createFlameShaderMaterial(phase);
    flame.geometry = flameGeo;
    flame.material = flameMat;
    flame.renderOrder = 3;
    flame.position.y = 0.176; // wick top in the burner
    flame.scale.set(1.05, 0.8, 1.05);
    oilFlames.push({ flameMat, light, phase });
  }
  function addLitCandleFlame(
    x: number,
    topY: number,
    z: number,
    {
      scale = 1.0,
      phase = 0,
      baseIntensity = 0.65,
      distance = 3.2,
      waxRadius = 0.022
    }: {
      scale?: number;
      phase?: number;
      baseIntensity?: number;
      distance?: number;
      waxRadius?: number;
    } = {}
  ) {
    // Charred wick + glowing orange ember tip visible through the translucent blue flame base
    const wick = new THREE.Mesh(wickGeo, wickMat);
    wick.position.set(x, topY + 0.008 * scale, z);
    wick.scale.setScalar(scale);
    interiorGroup.add(wick);

    const ember = new THREE.Mesh(emberGeo, emberMat);
    ember.position.set(x, topY + 0.017 * scale, z);
    ember.scale.setScalar(scale);
    interiorGroup.add(ember);

    // Subtle warm subsurface wax glow collar fading smoothly down the top of the candle
    const waxGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(waxRadius * 1.02, waxRadius * 1.02, 0.055 * scale, 14, 1, true),
      waxGlowMat
    );
    waxGlow.position.set(x, topY - 0.0275 * scale, z);
    interiorGroup.add(waxGlow);

    const flamePivot = new THREE.Group();
    flamePivot.position.set(x, topY + 0.009 * scale, z);

    const flameMat = createFlameShaderMaterial(phase);
    const flameMesh = new THREE.Mesh(flameGeo, flameMat);
    flameMesh.renderOrder = 3;
    flamePivot.add(flameMesh);

    flamePivot.scale.setScalar(scale);
    interiorGroup.add(flamePivot);

    const haloMat = new THREE.SpriteMaterial({
      map: haloTex,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const halo = new THREE.Sprite(haloMat);
    halo.position.set(x, topY + 0.044 * scale, z);
    halo.renderOrder = 4;
    const baseHalo = 0.26 * scale;
    halo.scale.set(baseHalo, baseHalo, 1);
    interiorGroup.add(halo);

    const light = new THREE.PointLight(0xffa43c, baseIntensity, distance, 1.8);
    light.position.set(x, topY + 0.07 * scale, z);
    interiorGroup.add(light);

    litCandles.push({ flamePivot, flameMat, halo, light, scale, phase, baseIntensity, baseHalo });
  }

  let candleLightScale = 0.88;
  let candleHaloScale = 1.0;
  let candleFlameBoost = 1.0;

  const candleEffect = {
    setMood(moodKey: string) {
      if (moodKey === 'evensong') {
        candleLightScale = 1.95;
        candleHaloScale = 1.45;
        candleFlameBoost = 1.5;
      } else if (moodKey === 'golden') {
        candleLightScale = 1.15;
        candleHaloScale = 1.15;
        candleFlameBoost = 1.18;
      } else {
        candleLightScale = 0.88;
        candleHaloScale = 1.0;
        candleFlameBoost = 1.0;
      }
      for (const c of [...litCandles, ...oilFlames]) {
        c.flameMat.uniforms.uBoost.value = candleFlameBoost;
      }
    },
    update(elapsed: number) {
      for (const c of litCandles) {
        const p = c.phase;
        c.flameMat.uniforms.uTime.value = elapsed;

        const f1 = Math.sin(elapsed * 7.3 + p);
        const f2 = Math.sin(elapsed * 14.9 + p * 1.7);
        const f3 = Math.sin(elapsed * 23.1 + p * 2.9);
        const flicker = 1 + f1 * 0.12 + f2 * 0.075 + f3 * 0.045;

        const haloSize = c.baseHalo * candleHaloScale * (0.9 + flicker * 0.14);
        c.halo.scale.set(haloSize, haloSize, 1);
        c.halo.material.opacity = Math.min(0.92, (0.42 + flicker * 0.14) * candleHaloScale);
        c.light.intensity = c.baseIntensity * candleLightScale * (0.78 + flicker * 0.26);
      }
      for (const o of oilFlames) {
        if (!o.light.parent?.visible) continue; // 1900 only
        const p = o.phase;
        o.flameMat.uniforms.uTime.value = elapsed;
        const flicker =
          1 +
          Math.sin(elapsed * 7.3 + p) * 0.12 +
          Math.sin(elapsed * 14.9 + p * 1.7) * 0.075 +
          Math.sin(elapsed * 23.1 + p * 2.9) * 0.045;
        const mood = o.light.userData.moodIntensity ?? o.light.intensity;
        o.light.intensity = (mood * (0.78 + flicker * 0.26)) / 1.04;
      }
    }
  };

  return { addOilFlame, addLitCandleFlame, candleEffect };
}

export type CandleRig = ReturnType<typeof createCandleRig>;
