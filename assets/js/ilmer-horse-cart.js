// Horse, two-wheeled tip cart (tumbril) and carter for the 1839 village reconstruction.
//
// The rig follows what a Buckinghamshire farm turnout of the 1830s looked like:
// - a heavy cart horse (the "Old English Black" type that became the Shire) of about 16 hands, dark bay with black
//   points, white feathers and a blaze, its tail docked short as cart horses' tails usually were;
// - shaft harness: a leather collar with hames, cart saddle with ridge chain carrying the shafts, belly band,
//   breeching round the quarters, and a blinkered bridle with bit and reins;
// - a tumbril with plank sides, flared raves and a tailboard on 5 ft wheels with iron tyres, painted in the
//   blue body and red wheels of south-Midlands farm vehicles;
// - a carter in a linen smock-frock, neckerchief, low wide-brimmed felt hat, corduroy breeches and leather
//   gaiters, holding the reins and a carter's whip.
//
// Units are metres. Each group's origin is on the ground; local -z points forward along the road.

/** Distance from the cart's axle to the horse's centre, along the road. */
export const HORSE_OFFSET = 2.95;
/** Cart wheel radius (a 5 ft wheel). */
export const CART_WHEEL_RADIUS = 0.76;
/** Ground covered by one complete four-beat walk cycle of a heavy horse. */
export const WALK_STRIDE = 1.85;

/**
 * Phase of each leg within the four-beat walk (left hind, left fore, right hind, right fore), as a fraction of the
 * stride. Exported for tests.
 */
export const WALK_PHASES = { lh: 0, lf: 0.25, rh: 0.5, rf: 0.75 };

/** Fraction of each leg's cycle spent with the hoof on the ground. */
export const STANCE = 0.62;

/**
 * Swing angle (about the shoulder or hip) and lower-leg flexion for a leg at the given phase of the walk.
 * Positive swing moves the hoof forward; flexion is 0 on the ground and peaks mid-swing.
 */
export function walkPose(phase, reach) {
  const p = ((phase % 1) + 1) % 1;
  if (p < STANCE) return { swing: reach * (1 - (2 * p) / STANCE), flex: 0 };
  const w = (p - STANCE) / (1 - STANCE);
  const eased = w * w * (3 - 2 * w);
  return { swing: -reach + 2 * reach * eased, flex: Math.sin(Math.PI * w) };
}

export function createHorseAndCart(THREE, { timber }) {
  const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
  const coat = material(0x5b3822, { roughness: 0.75 });
  const points = material(0x1f1814, { roughness: 0.85 });
  const white = material(0xe6dfd0);
  const hoof = material(0x3b342e);
  const eye = material(0x0d0b0a, { roughness: 0.3 });
  const leather = material(0x2b1d14, { roughness: 0.6 });
  const collarLining = material(0x8c6a44);
  const brass = material(0xb8913f, { metalness: 0.7, roughness: 0.35 });
  const iron = material(0x2f2f2f, { metalness: 0.5, roughness: 0.6 });
  const cartBlue = material(0x5f7d98, { roughness: 0.85 });
  const cartRed = material(0xa4462d, { roughness: 0.85 });
  const smock = material(0xd9d0b4);
  const smocking = material(0xc8bd9c);
  const neckerchief = material(0x9b2e24);
  const felt = material(0x3a3029);
  const skin = material(0xc89874);
  const hair = material(0x5a4430);
  const corduroy = material(0x6f5c3d);
  const gaiter = material(0x4d3525, { roughness: 0.6 });
  const boot = material(0x1e1915, { roughness: 0.6 });
  const sacking = material(0xb9a47a);
  const straw = material(0xd1b66a);

  function add(parent, geometry, mat, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const box = (parent, w, h, d, x, y, z, mat) => add(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  function ellipsoid(parent, rx, ry, rz, x, y, z, mat) {
    const mesh = add(parent, new THREE.SphereGeometry(1, 18, 12), mat, x, y, z);
    mesh.scale.set(rx, ry, rz);
    return mesh;
  }
  // A tapered round section between two points, rTop at `b`
  function rod(parent, a, b, rA, rB, mat, segments = 10) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const length = start.distanceTo(end);
    const mesh = add(parent, new THREE.CylinderGeometry(rB, rA, length, segments), mat);
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    return mesh;
  }
  function pivot(parent, x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    parent.add(group);
    return group;
  }

  // ---------------------------------------------------------------- Horse
  const horse = new THREE.Group();
  horse.name = 'horse';
  // Body: barrel, deep shoulder and chest, rounded quarters, withers
  ellipsoid(horse, 0.36, 0.37, 0.78, 0, 1.24, 0.05, coat);
  ellipsoid(horse, 0.37, 0.43, 0.4, 0, 1.3, -0.58, coat);
  ellipsoid(horse, 0.3, 0.3, 0.22, 0, 1.12, -0.86, coat);
  ellipsoid(horse, 0.39, 0.38, 0.44, 0, 1.3, 0.62, coat);
  ellipsoid(horse, 0.16, 0.13, 0.34, 0, 1.57, -0.46, coat);
  ellipsoid(horse, 0.3, 0.12, 0.3, 0, 1.6, 0.66, coat);

  // Neck: local +y runs from the shoulder to the poll, the crest (mane side) is local +z
  const neck = pivot(horse, 0, 1.42, -0.74);
  neck.rotation.x = -0.82;
  const neckMesh = rod(neck, [0, 0, 0], [0, 0.92, 0], 0.36, 0.2, coat, 14);
  neckMesh.scale.x = 0.62;
  ellipsoid(neck, 0.13, 0.42, 0.13, 0, 0.5, 0.15, coat);
  // Hogged-short mane lying along the crest, from the withers to the poll
  rod(neck, [0, 0.02, 0.3], [0, 0.94, 0.17], 0.06, 0.045, points, 8).scale.x = 0.55;

  // Collar and hames sit at the base of the neck against the shoulders
  const collar = add(neck, new THREE.TorusGeometry(0.33, 0.085, 8, 22), leather, 0, 0.14, 0.02);
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(0.82, 1.2, 1);
  const lining = add(neck, new THREE.TorusGeometry(0.29, 0.045, 6, 22), collarLining, 0, 0.11, 0.02);
  lining.rotation.x = Math.PI / 2;
  lining.scale.set(0.82, 1.2, 1);
  for (const side of [-1, 1]) {
    const hame = rod(neck, [side * 0.29, 0.13, -0.32], [side * 0.27, 0.19, 0.42], 0.022, 0.018, brass, 6);
    hame.rotation.z += side * 0.04;
    add(neck, new THREE.SphereGeometry(0.035, 8, 6), brass, side * 0.26, 0.2, 0.46);
  }

  // Head: local -z runs from the poll to the muzzle, the face (blaze side) is local +y
  // (relative to the neck it hangs about 49 degrees below horizontal, as a horse walking into its collar carries it)
  const HEAD_CARRIAGE = -0.03;
  const head = pivot(neck, 0, 0.96, 0.02);
  head.rotation.x = HEAD_CARRIAGE;
  const skull = head;
  ellipsoid(skull, 0.15, 0.15, 0.2, 0, -0.02, -0.12, coat);
  ellipsoid(skull, 0.13, 0.15, 0.17, 0, -0.08, -0.2, coat);
  rod(skull, [0, 0, -0.18], [0, -0.01, -0.56], 0.125, 0.1, coat, 12).scale.x = 0.95;
  ellipsoid(skull, 0.105, 0.1, 0.11, 0, -0.02, -0.57, coat);
  const blaze = box(skull, 0.06, 0.012, 0.4, 0, 0.1, -0.37, white);
  blaze.rotation.x = -0.07;
  ellipsoid(skull, 0.05, 0.03, 0.035, 0, 0.06, -0.64, white);
  for (const side of [-1, 1]) {
    const ear = add(skull, new THREE.ConeGeometry(0.045, 0.16, 8), coat, side * 0.08, 0.1, 0.04);
    ear.rotation.set(-0.5, 0, -side * 0.25);
    ellipsoid(skull, 0.022, 0.026, 0.03, side * 0.135, 0.05, -0.15, eye);
    ellipsoid(skull, 0.018, 0.02, 0.012, side * 0.05, 0.04, -0.665, eye);
    // Blinkers, cheekpieces and brass rosettes of the bridle
    box(skull, 0.015, 0.13, 0.15, side * 0.175, 0.06, -0.14, leather);
    box(skull, 0.012, 0.025, 0.5, side * 0.15, -0.02, -0.32, leather);
    add(skull, new THREE.SphereGeometry(0.025, 8, 6), brass, side * 0.155, 0.06, 0.02);
    add(skull, new THREE.TorusGeometry(0.03, 0.007, 5, 10), iron, side * 0.12, -0.07, -0.55).rotation.y = Math.PI / 2;
  }
  const forelock = box(skull, 0.08, 0.02, 0.16, 0, 0.13, -0.05, points);
  forelock.rotation.x = 0.2;
  const browband = add(skull, new THREE.TorusGeometry(0.16, 0.012, 5, 16, Math.PI), leather, 0, 0.0, -0.02);
  browband.scale.set(1, 0.9, 1);
  const noseband = add(skull, new THREE.TorusGeometry(0.12, 0.014, 5, 18), leather, 0, -0.03, -0.44);
  noseband.scale.set(1, 0.95, 1);
  const bit = rod(skull, [-0.12, -0.07, -0.55], [0.12, -0.07, -0.55], 0.01, 0.01, iron, 6);
  bit.castShadow = false;

  // Legs: an upper pivot at the elbow or stifle swings the leg; a lower pivot at the knee or hock flexes it
  const legs = {};
  function buildLeg(key, x, z, fore) {
    const top = pivot(horse, x, fore ? 1.1 : 1.16, z);
    if (fore) rod(top, [0, 0.05, 0], [0, -0.5, 0], 0.12, 0.08, coat);
    else {
      ellipsoid(top, 0.13, 0.26, 0.18, 0, -0.08, 0.02, coat);
      rod(top, [0, -0.08, 0.04], [0, -0.52, 0.16], 0.12, 0.075, coat);
    }
    const joint = pivot(top, 0, fore ? -0.5 : -0.52, fore ? 0 : 0.16);
    ellipsoid(joint, 0.075, 0.07, 0.08, 0, 0, 0, fore ? coat : points);
    rod(joint, [0, 0, 0], [0, fore ? -0.4 : -0.44, 0], 0.062, 0.06, points, 8);
    const fetlockY = fore ? -0.4 : -0.44;
    // Heavy white feathers round the fetlock and pastern, then the hoof
    rod(joint, [0, fetlockY + 0.16, 0], [0, fetlockY - 0.09, 0.01], 0.07, 0.125, white, 10);
    rod(joint, [0, fetlockY - 0.09, 0.01], [0, fetlockY - 0.2, -0.01], 0.095, 0.11, hoof, 10);
    legs[key] = { top, joint, fore, baseY: top.position.y };
  }
  buildLeg('lf', -0.2, -0.62, true);
  buildLeg('rf', 0.2, -0.62, true);
  buildLeg('lh', -0.21, 0.66, false);
  buildLeg('rh', 0.21, 0.66, false);

  // Docked tail with its hair
  const tail = pivot(horse, 0, 1.6, 0.98);
  tail.rotation.x = 0.35;
  rod(tail, [0, 0, 0], [0, -0.2, 0.05], 0.06, 0.05, coat, 8);
  rod(tail, [0, -0.08, 0.04], [0, -0.48, 0.1], 0.05, 0.1, points, 8);

  // Cart saddle with its ridge channel and chain, belly band, breeching and loin strap
  box(horse, 0.5, 0.1, 0.36, 0, 1.64, -0.22, leather);
  ellipsoid(horse, 0.27, 0.07, 0.2, 0, 1.6, -0.22, leather);
  box(horse, 0.1, 0.06, 0.32, 0, 1.71, -0.22, iron);
  for (const z of [-0.36, -0.08]) add(horse, new THREE.SphereGeometry(0.03, 8, 6), brass, 0, 1.7, z);
  const bellyBand = add(horse, new THREE.TorusGeometry(0.385, 0.03, 6, 24), leather, 0, 1.24, -0.22);
  bellyBand.scale.set(0.98, 1.03, 1);
  const breeching = add(horse, new THREE.TorusGeometry(0.43, 0.035, 6, 20, Math.PI), leather, 0, 1.12, 0.58);
  breeching.rotation.x = Math.PI / 2;
  const loinStrap = add(horse, new THREE.TorusGeometry(0.4, 0.025, 6, 20, Math.PI), leather, 0, 1.24, 0.4);
  loinStrap.scale.set(1.0, 1.05, 1);
  const crupper = box(horse, 0.04, 0.02, 1.15, 0, 1.69, 0.36, leather);
  crupper.rotation.x = -0.03;

  // ---------------------------------------------------------------- Cart
  const cart = new THREE.Group();
  cart.name = 'cart';
  const wheelY = CART_WHEEL_RADIUS;
  // Axle and axle-bed
  rod(cart, [-1.1, wheelY, 0], [1.1, wheelY, 0], 0.045, 0.045, iron, 8);
  box(cart, 1.5, 0.12, 0.14, 0, wheelY + 0.12, 0, cartRed);

  const wheels = [];
  for (const side of [-1, 1]) {
    const wheel = pivot(cart, side * 1.0, wheelY, 0);
    const tyre = add(wheel, new THREE.TorusGeometry(CART_WHEEL_RADIUS - 0.02, 0.03, 6, 32), iron);
    tyre.rotation.y = Math.PI / 2;
    const felloe = add(wheel, new THREE.TorusGeometry(CART_WHEEL_RADIUS - 0.075, 0.05, 6, 28), cartRed);
    felloe.rotation.y = Math.PI / 2;
    felloe.scale.set(1, 1, 1.3);
    rod(wheel, [-0.17, 0, 0], [0.17, 0, 0], 0.12, 0.1, cartRed, 12);
    for (const x of [-0.13, 0.11]) {
      const hoop = add(wheel, new THREE.TorusGeometry(0.115, 0.012, 5, 16), iron, x, 0, 0);
      hoop.rotation.y = Math.PI / 2;
    }
    for (let spoke = 0; spoke < 12; spoke++) {
      const angle = (spoke * Math.PI * 2) / 12;
      const reach = CART_WHEEL_RADIUS - 0.1;
      rod(
        wheel,
        [-side * 0.03, Math.cos(angle) * 0.11, Math.sin(angle) * 0.11],
        [side * 0.03, Math.cos(angle) * reach, Math.sin(angle) * reach],
        0.03,
        0.022,
        cartRed,
        6
      );
    }
    wheels.push(wheel);
  }

  // Body: floor, plank sides with the boards picked out, flared raves over the wheels, head and tail boards
  const floorY = wheelY + 0.24;
  box(cart, 1.42, 0.07, 2.5, 0, floorY, 0, timber);
  for (const side of [-1, 1]) {
    for (let plank = 0; plank < 3; plank++)
      box(cart, 0.05, 0.17, 2.5, side * 0.71, floorY + 0.12 + plank * 0.18, 0, cartBlue);
    for (const z of [-1.2, -0.6, 0, 0.6, 1.2]) {
      const standard = box(cart, 0.06, 0.62, 0.06, side * 0.76, floorY + 0.3, z, cartRed);
      standard.rotation.z = side * -0.18;
    }
    box(cart, 0.09, 0.06, 2.62, side * 0.86, floorY + 0.62, 0, cartRed);
    box(cart, 0.08, 0.1, 2.5, side * 0.7, floorY - 0.06, 0, cartRed);
  }
  for (const [z, h] of [
    [-1.24, 0.62],
    [1.24, 0.5]
  ]) {
    box(cart, 1.42, h, 0.06, 0, floorY + h / 2, z, cartBlue);
    box(cart, 1.5, 0.06, 0.09, 0, floorY + h, z, cartRed);
    for (const x of [-0.5, 0.5]) box(cart, 0.05, h, 0.08, x, floorY + h / 2, z + Math.sign(z) * 0.04, iron);
  }
  // Shafts run under the body to the horse's shoulders, with tug hooks for the ridge chain
  const shaftTipZ = -(HORSE_OFFSET + 0.72);
  for (const side of [-1, 1]) {
    rod(cart, [side * 0.6, floorY - 0.12, 1.1], [side * 0.6, floorY - 0.1, -1.3], 0.055, 0.05, cartRed, 8);
    rod(cart, [side * 0.6, floorY - 0.1, -1.3], [side * 0.56, 1.22, shaftTipZ], 0.05, 0.035, cartRed, 8);
    rod(cart, [side * 0.56, 1.22, shaftTipZ], [side * 0.55, 1.3, shaftTipZ - 0.12], 0.035, 0.03, cartRed, 6);
    // Tug hook under the cart saddle and the ridge chain over it that carries the shafts
    const tugZ = -(HORSE_OFFSET + 0.22);
    box(cart, 0.05, 0.1, 0.08, side * 0.57, 1.2, tugZ, iron);
    rod(cart, [side * 0.56, 1.24, tugZ], [side * 0.14, 1.7, tugZ], 0.012, 0.012, iron, 5);
  }
  // Footboard on the shafts for the carter, and his seat across the front
  box(cart, 1.0, 0.04, 0.32, 0, floorY - 0.05, -1.48, timber);
  box(cart, 1.42, 0.06, 0.3, 0, floorY + 0.64, -1.05, timber);
  // A light load: two corn sacks and loose straw
  ellipsoid(cart, 0.26, 0.36, 0.22, -0.3, floorY + 0.34, 0.55, sacking).rotation.z = 0.15;
  ellipsoid(cart, 0.26, 0.34, 0.22, 0.25, floorY + 0.32, 0.75, sacking).rotation.z = -0.2;
  box(cart, 1.3, 0.06, 1.6, 0, floorY + 0.05, 0.3, straw);

  // ---------------------------------------------------------------- Carter
  const driver = new THREE.Group();
  driver.name = 'driver';
  cart.add(driver);
  const seatY = floorY + 0.67;
  const seatZ = -1.05;
  // Smock-frock: loose body, gathered smocking panel on the chest, falling over the lap
  rod(driver, [0, seatY + 0.04, seatZ + 0.02], [0, seatY + 0.6, seatZ - 0.02], 0.22, 0.19, smock, 14);
  ellipsoid(driver, 0.2, 0.08, 0.27, 0, seatY + 0.08, seatZ - 0.2, smock);
  box(driver, 0.24, 0.24, 0.02, 0, seatY + 0.42, seatZ - 0.2, smocking);
  ellipsoid(driver, 0.24, 0.07, 0.17, 0, seatY + 0.6, seatZ - 0.02, smock);
  add(driver, new THREE.TorusGeometry(0.075, 0.03, 6, 14), neckerchief, 0, seatY + 0.66, seatZ - 0.03).rotation.x =
    Math.PI / 2;
  box(driver, 0.06, 0.1, 0.02, 0.02, seatY + 0.58, seatZ - 0.11, neckerchief);
  // Head with side whiskers and a low-crowned, wide-brimmed felt hat
  rod(driver, [0, seatY + 0.62, seatZ - 0.03], [0, seatY + 0.72, seatZ - 0.04], 0.055, 0.05, skin, 8);
  ellipsoid(driver, 0.1, 0.12, 0.11, 0, seatY + 0.8, seatZ - 0.05, skin);
  ellipsoid(driver, 0.02, 0.03, 0.025, 0, seatY + 0.79, seatZ - 0.16, skin);
  for (const side of [-1, 1]) {
    box(driver, 0.015, 0.06, 0.035, side * 0.098, seatY + 0.77, seatZ - 0.05, hair);
    ellipsoid(driver, 0.012, 0.012, 0.008, side * 0.04, seatY + 0.82, seatZ - 0.15, eye);
  }
  rod(driver, [0, seatY + 0.86, seatZ - 0.05], [0, seatY + 0.875, seatZ - 0.05], 0.23, 0.23, felt, 20);
  rod(driver, [0, seatY + 0.87, seatZ - 0.05], [0, seatY + 1.0, seatZ - 0.05], 0.12, 0.115, felt, 16);
  rod(driver, [0, seatY + 0.875, seatZ - 0.05], [0, seatY + 0.91, seatZ - 0.05], 0.123, 0.122, leather, 16);
  // Arms reaching forward to the reins; the right hand also holds the whip
  const hands = [];
  for (const side of [-1, 1]) {
    const shoulder = [side * 0.21, seatY + 0.55, seatZ - 0.02];
    const elbow = [side * 0.25, seatY + 0.3, seatZ - 0.16];
    const hand = [side * 0.13, seatY + 0.26, seatZ - 0.42];
    rod(driver, shoulder, elbow, 0.065, 0.058, smock, 8);
    rod(driver, elbow, hand, 0.058, 0.048, smock, 8);
    add(driver, new THREE.SphereGeometry(0.045, 8, 6), skin, ...hand);
    hands.push(new THREE.Vector3(...hand));
    // Thighs forward along the seat, shins down over the front board to the footboard
    const hip = [side * 0.11, seatY + 0.06, seatZ + 0.02];
    const knee = [side * 0.13, seatY + 0.08, seatZ - 0.42];
    const ankle = [side * 0.14, floorY + 0.08, seatZ - 0.5];
    rod(driver, hip, knee, 0.085, 0.075, corduroy, 8);
    ellipsoid(driver, 0.085, 0.06, 0.1, side * 0.12, seatY + 0.1, seatZ - 0.22, smock);
    rod(driver, knee, ankle, 0.07, 0.06, gaiter, 8);
    box(driver, 0.1, 0.08, 0.24, side * 0.14, floorY + 0.03, seatZ - 0.56, boot);
  }
  const whip = rod(
    driver,
    [0.13, seatY + 0.2, seatZ - 0.42],
    [0.42, seatY + 1.55, seatZ - 0.75],
    0.012,
    0.006,
    timber,
    6
  );
  whip.castShadow = false;
  rod(driver, [0.42, seatY + 1.55, seatZ - 0.75], [0.62, seatY + 1.05, seatZ - 0.62], 0.004, 0.003, leather, 4);

  // ---------------------------------------------------------------- Animation
  const reinHands = hands;
  const bitRings = [new THREE.Vector3(-0.12, -0.07, -0.55), new THREE.Vector3(0.12, -0.07, -0.55)];
  const scratch = new THREE.Vector3();

  /** Turns the wheels and walks the horse for the cart's distance along the road. */
  function update(distance) {
    for (const wheel of wheels) wheel.rotation.x = -distance / CART_WHEEL_RADIUS;
    const cycle = distance / WALK_STRIDE;
    for (const [key, leg] of Object.entries(legs)) {
      const pose = walkPose(cycle + WALK_PHASES[key], leg.fore ? 0.3 : 0.26);
      leg.top.rotation.x = pose.swing;
      leg.joint.rotation.x = -pose.flex * (leg.fore ? 1.15 : 0.55);
    }
    // The head nods twice per stride, in time with the forefeet
    head.rotation.x = HEAD_CARRIAGE + Math.sin(cycle * Math.PI * 4) * 0.05;
    tail.rotation.z = Math.sin(cycle * Math.PI * 2) * 0.12;
  }

  /** World positions of the carter's hands and the bit rings, for drawing the reins. */
  function reinPoints() {
    const out = [];
    for (let i = 0; i < 2; i++) {
      out.push(cart.localToWorld(scratch.copy(reinHands[i])).clone());
      out.push(skull.localToWorld(scratch.copy(bitRings[i])).clone());
    }
    return out;
  }

  update(0);
  return { horse, cart, driver, wheels, update, reinPoints };
}
