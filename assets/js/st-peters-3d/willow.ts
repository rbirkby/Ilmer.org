import * as THREE from 'three';
import { canvas2d, canvasTexture, makeCanvas, mulberry32 } from './canvas-utils.ts';
import { DIM } from './dimensions.ts';

export type WillowRunAnimation = 'running-left' | 'running-right' | 'running-front' | 'running-back';
export type WillowAnimation = 'failed' | 'idle' | 'jumping' | 'waving' | 'drinking' | WillowRunAnimation;

export interface WillowAnimationSpec {
  row: number;
  frames: number;
  fps: number;
  loop: boolean;
}

export const WILLOW_SPRITE_SHEET = {
  url: '/images/st-peters-willow.webp',
  cols: 8,
  rows: 9,
  cellWidth: 104,
  cellHeight: 112,
  /** Bottom-centre paw baseline inside each 112 px cell (6 px above the bottom edge). */
  anchorY: 0.055,
  /** World height of one full cell in metres (~0.55 m tall sitting cocker spaniel). */
  worldHeight: 0.62,
  /** The jumping frames are drawn smaller inside their cell to give headroom for the hop. */
  jumpScale: 1.26,
  animations: {
    failed: { row: 0, frames: 8, fps: 5.5, loop: false },
    idle: { row: 1, frames: 6, fps: 4.5, loop: true },
    jumping: { row: 2, frames: 5, fps: 6.5, loop: false },
    'running-left': { row: 3, frames: 8, fps: 11.5, loop: true },
    'running-right': { row: 4, frames: 8, fps: 11.5, loop: true },
    waving: { row: 5, frames: 4, fps: 5.0, loop: true },
    'running-front': { row: 6, frames: 4, fps: 9.0, loop: true },
    'running-back': { row: 7, frames: 4, fps: 9.0, loop: true },
    drinking: { row: 8, frames: 4, fps: 4.5, loop: true }
  } satisfies Record<WillowAnimation, WillowAnimationSpec>
} as const;

/**
 * Water bowl position tucked underneath the rearmost North nave pew (closest to the
 * North Porch front door, near the North interior wall).
 */
export const WILLOW_WATER_BOWL_POS = { x: -1.68, z: -2.14 } as const;

export const WILLOW_DRINK_SECONDS = 3.6;

export type WillowZone = 'vestry' | 'west-nave' | 'mid-nave' | 'east-nave';

export interface WillowWaypoint {
  id: string;
  x: number;
  z: number;
  zone: WillowZone;
  /** True for open landmarks where Willow can pause to sit, wave, or jump; false for pass-through corridors. */
  stop?: boolean;
  /** Nodes directly reachable along a clear, obstacle-free straight line inside the church. */
  neighbors: readonly string[];
}

/**
 * Connected floor graph spanning the full Today-era church interior west of the chancel:
 * - Vestry (crimson carpet behind the partition, through the central doorway)
 * - North & south arcs around the octagonal medieval font
 * - Central nave aisle between the North and South pews & North Porch entrance
 * - Open east nave crossing before the rood screen, pulpit, and lectern
 */
export const WILLOW_WAYPOINTS: readonly WillowWaypoint[] = [
  // West Vestry (behind partition at x = -5.18, crimson carpet)
  { id: 'vestry-south', x: -6.3, z: 1.35, zone: 'vestry', stop: true, neighbors: ['vestry-centre'] },
  { id: 'vestry-north', x: -6.19, z: -1.15, zone: 'vestry', stop: true, neighbors: ['vestry-centre'] },
  {
    id: 'vestry-centre',
    x: -6.22,
    z: 0.0,
    zone: 'vestry',
    stop: true,
    neighbors: ['vestry-doorway', 'vestry-north', 'vestry-south']
  },
  { id: 'vestry-doorway', x: -5.18, z: 0.0, zone: 'vestry', neighbors: ['vestry-centre', 'font-west'] },

  // Pass-through arcs around the octagonal font (-3.98, 0.0, radius 0.64)
  { id: 'font-west', x: -4.89, z: 0.0, zone: 'west-nave', neighbors: ['vestry-doorway', 'font-nw', 'font-sw'] },
  { id: 'font-nw', x: -4.74, z: -0.48, zone: 'west-nave', neighbors: ['font-west', 'font-north-w'] },
  { id: 'font-north-w', x: -4.34, z: -0.84, zone: 'west-nave', neighbors: ['font-nw', 'font-north-e'] },
  { id: 'font-north-e', x: -3.72, z: -0.82, zone: 'west-nave', neighbors: ['font-north-w', 'font-ne'] },
  { id: 'font-ne', x: -3.22, z: -0.5, zone: 'west-nave', neighbors: ['font-north-e', 'west-font'] },
  { id: 'font-sw', x: -4.74, z: 0.46, zone: 'west-nave', neighbors: ['font-west', 'font-south-w'] },
  { id: 'font-south-w', x: -4.34, z: 0.83, zone: 'west-nave', neighbors: ['font-sw', 'font-south-e'] },
  { id: 'font-south-e', x: -3.65, z: 0.83, zone: 'west-nave', neighbors: ['font-south-w', 'font-se'] },
  { id: 'font-se', x: -3.18, z: 0.46, zone: 'west-nave', neighbors: ['font-south-e', 'west-font'] },

  // Nave aisle between the pews, North Porch entrance & East crossing
  {
    id: 'west-font',
    x: -2.98,
    z: 0.02,
    zone: 'west-nave',
    stop: true,
    neighbors: ['font-ne', 'font-se', 'porch-junction']
  },
  { id: 'porch-junction', x: -2.35, z: -0.1, zone: 'west-nave', neighbors: ['west-font', 'north-door', 'mid-west'] },
  { id: 'north-door', x: -2.35, z: -1.6, zone: 'west-nave', stop: true, neighbors: ['porch-junction', 'water-bowl'] },
  { id: 'water-bowl', x: -2.04, z: -2.1, zone: 'west-nave', neighbors: ['north-door'] },
  { id: 'mid-west', x: -1.2, z: 0.14, zone: 'mid-nave', stop: true, neighbors: ['porch-junction', 'nave-centre'] },
  { id: 'nave-centre', x: 0.0, z: -0.12, zone: 'mid-nave', stop: true, neighbors: ['mid-west', 'mid-east'] },
  { id: 'mid-east', x: 1.15, z: 0.12, zone: 'mid-nave', stop: true, neighbors: ['nave-centre', 'east-crossing'] },
  {
    id: 'east-crossing',
    x: 2.02,
    z: -0.08,
    zone: 'east-nave',
    neighbors: ['mid-east', 'pulpit-nook', 'rood-centre']
  },
  {
    id: 'pulpit-nook',
    x: 2.15,
    z: -0.92,
    zone: 'east-nave',
    stop: true,
    neighbors: ['east-crossing', 'rood-centre']
  },
  {
    id: 'rood-centre',
    x: 2.52,
    z: 0.0,
    zone: 'east-nave',
    stop: true,
    neighbors: ['east-crossing', 'pulpit-nook', 'lectern-nook']
  },
  { id: 'lectern-nook', x: 2.56, z: 0.5, zone: 'east-nave', stop: true, neighbors: ['rood-centre'] }
];

const WAYPOINT_BY_ID = new Map(WILLOW_WAYPOINTS.map((wp) => [wp.id, wp]));
const STOP_WAYPOINTS = WILLOW_WAYPOINTS.filter((wp) => wp.stop);

export const WILLOW_RUN_SPEED = 1.45; // metres per second

export interface WillowState {
  name: 'Willow';
  revealed: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  currentNodeId: string;
  path: string[];
  mode: 'running' | 'idle' | 'waving' | 'jumping' | 'failed' | 'drinking';
  animation: WillowAnimation;
  runAnimation: WillowRunAnimation;
  drinkFacingRight: boolean;
  pendingDrink: boolean;
  frame: number;
  animTime: number;
  stateRemaining: number;
  greetToggle: boolean;
  reducedMotion: boolean;
  random: () => number;
}

export function createWillowState({
  seed = 202607,
  reducedMotion = false,
  revealed = false
}: { seed?: number; reducedMotion?: boolean; revealed?: boolean } = {}): WillowState {
  const random = mulberry32(seed);
  const start = WAYPOINT_BY_ID.get('water-bowl') ?? WILLOW_WAYPOINTS[0];
  return {
    name: 'Willow',
    revealed,
    x: start.x,
    z: start.z,
    vx: 0,
    vz: 0,
    currentNodeId: start.id,
    path: [],
    mode: 'drinking',
    animation: 'drinking',
    runAnimation: 'running-right',
    drinkFacingRight: true,
    pendingDrink: false,
    frame: 0,
    animTime: 0,
    stateRemaining: WILLOW_DRINK_SECONDS,
    greetToggle: false,
    reducedMotion,
    random
  };
}

/** Floor elevation beneath Willow (quarry tile nave floor, crimson vestry carpet, or gold rood-screen runner). */
export function willowFloorY(x: number, z: number): number {
  const onVestryCarpet = x <= DIM.tower.vestryPartitionX - 0.02 && x >= DIM.nave.xWestInt + 0.02;
  if (onVestryCarpet) return DIM.naveFloorY + 0.016;
  const onRoodCarpet = x >= 2.55 && x <= 3.22 && Math.abs(z) <= 0.64;
  return DIM.naveFloorY + (onRoodCarpet ? 0.018 : 0);
}

/**
 * Picks `'running-right'`, `'running-left'`, `'running-front'` (toward camera), or `'running-back'` (away from camera)
 * by projecting world velocity `(vx, vz)` onto the camera's horizontal right vector `(camRightX, camRightZ)` and
 * orthogonal horizontal forward vector `(camRightZ, -camRightX)`, with angular hysteresis to prevent diagonal flicker.
 */
export function pickRunAnimation(
  vx: number,
  vz: number,
  camRightX: number,
  camRightZ: number,
  previous: WillowRunAnimation
): WillowRunAnimation {
  const speed = Math.hypot(vx, vz);
  if (speed < 1e-4) return previous;
  const rightLen = Math.hypot(camRightX, camRightZ);
  if (rightLen < 1e-4) return previous;

  const ux = vx / speed;
  const uz = vz / speed;
  const rx = camRightX / rightLen;
  const rz = camRightZ / rightLen;
  // In Three.js right-handed coordinates (+Y up), horizontal camera-forward is (rx, 0, rz) × (0, -1, 0) = (rz, 0, -rx)
  const fx = rz;
  const fz = -rx;

  const rightDot = ux * rx + uz * rz;
  const awayDot = ux * fx + uz * fz;

  const hysteresis = 0.16;
  const candidates: readonly [WillowRunAnimation, number][] = [
    ['running-right', rightDot],
    ['running-left', -rightDot],
    ['running-back', awayDot],
    ['running-front', -awayDot]
  ];

  let best = previous;
  let bestScore = -Infinity;
  for (const [anim, rawScore] of candidates) {
    const score = rawScore + (anim === previous ? hysteresis : 0);
    if (score > bestScore) {
      bestScore = score;
      best = anim;
    }
  }
  return best;
}

/** Shortest path between two waypoints via BFS, randomly breaking ties (e.g. north vs south arc around the font). */
export function findWillowPath(fromId: string, toId: string, random: () => number = () => 0): string[] {
  if (fromId === toId) return [];
  const prev = new Map<string, string | null>([[fromId, null]]);
  const queue = [fromId];
  let head = 0;

  while (head < queue.length) {
    const curId = queue[head++];
    if (curId === toId) break;
    const node = WAYPOINT_BY_ID.get(curId);
    if (!node) continue;
    const neighbors = [...node.neighbors];
    // Fisher-Yates shuffle so symmetric routes (north/south around the font) alternate naturally
    for (let i = neighbors.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
    }
    for (const nextId of neighbors) {
      if (prev.has(nextId)) continue;
      prev.set(nextId, curId);
      queue.push(nextId);
    }
  }

  if (!prev.has(toId)) return [];
  const path: string[] = [];
  for (let cur: string | null = toId; cur && cur !== fromId; cur = prev.get(cur) ?? null) {
    path.push(cur);
  }
  path.reverse();
  return path;
}

const ZONE_WEIGHTS: Record<WillowZone, readonly [WillowZone, number][]> = {
  // From the vestry, usually dart all the way back up the nave (between the pews & to the rood screen)
  vestry: [
    ['east-nave', 0.45],
    ['mid-nave', 0.3],
    ['west-nave', 0.12],
    ['vestry', 0.13]
  ],
  // From the east nave, frequently sprint all the way down the nave and into the vestry
  'east-nave': [
    ['vestry', 0.42],
    ['mid-nave', 0.28],
    ['west-nave', 0.2],
    ['east-nave', 0.1]
  ],
  // From the central aisle between the pews, head into the vestry, up to the east nave, or along the pews
  'mid-nave': [
    ['vestry', 0.34],
    ['east-nave', 0.34],
    ['west-nave', 0.18],
    ['mid-nave', 0.14]
  ],
  'west-nave': [
    ['vestry', 0.36],
    ['east-nave', 0.34],
    ['mid-nave', 0.22],
    ['west-nave', 0.08]
  ]
};

function pickWeightedZone(currentZone: WillowZone, random: () => number): WillowZone {
  const roll = random();
  let acc = 0;
  for (const [zone, weight] of ZONE_WEIGHTS[currentZone]) {
    acc += weight;
    if (roll < acc) return zone;
  }
  return 'mid-nave';
}

function chooseNextPath(state: WillowState): string[] {
  const current = WAYPOINT_BY_ID.get(state.currentNodeId);
  const currentZone: WillowZone = current?.zone ?? 'mid-nave';
  const targetZone = pickWeightedZone(currentZone, state.random);
  const candidates = STOP_WAYPOINTS.filter((wp) => wp.zone === targetZone && wp.id !== state.currentNodeId);
  const pool = candidates.length > 0 ? candidates : STOP_WAYPOINTS.filter((wp) => wp.id !== state.currentNodeId);
  if (pool.length === 0) return [];
  const goal = pool[Math.floor(state.random() * pool.length)];
  return findWillowPath(state.currentNodeId, goal.id, state.random);
}

function enterPausePose(state: WillowState, nearViewer: boolean) {
  state.vx = 0;
  state.vz = 0;
  state.animTime = 0;
  state.frame = 0;

  const roll = state.random();
  const atDoor = state.currentNodeId === 'north-door';
  if ((nearViewer || atDoor) && roll < 0.44) {
    state.mode = 'waving';
    state.animation = 'waving';
    state.stateRemaining = 1.6 + state.random() * 0.8;
  } else if (roll < 0.66) {
    state.mode = 'jumping';
    state.animation = 'jumping';
    // Play 1 or 2 full hops cleanly
    const hops = state.random() < 0.45 ? 2 : 1;
    const spec = WILLOW_SPRITE_SHEET.animations.jumping;
    state.stateRemaining = (hops * spec.frames) / spec.fps;
  } else if (roll < 0.78) {
    state.mode = 'failed';
    state.animation = 'failed';
    const spec = WILLOW_SPRITE_SHEET.animations.failed;
    state.stateRemaining = spec.frames / spec.fps + 0.15;
  } else {
    state.mode = 'idle';
    state.animation = 'idle';
    state.stateRemaining = 2.0 + state.random() * 2.2;
  }
}

/**
 * Called when the visitor clicks the water bowl under the front-door pew.
 * First click reveals Willow right beside the bowl drinking water; later clicks call her back for another drink.
 */
export function summonWillowToBowl(state: WillowState) {
  const bowlSpot = WAYPOINT_BY_ID.get('water-bowl');
  if (!state.revealed || !bowlSpot || state.currentNodeId === 'water-bowl') {
    state.revealed = true;
    if (bowlSpot) {
      state.x = bowlSpot.x;
      state.z = bowlSpot.z;
      state.currentNodeId = bowlSpot.id;
    }
    state.path = [];
    state.vx = 0;
    state.vz = 0;
    state.pendingDrink = false;
    state.mode = 'drinking';
    state.animation = 'drinking';
    state.animTime = 0;
    state.frame = 0;
    state.stateRemaining = WILLOW_DRINK_SECONDS;
    return;
  }

  // Already revealed elsewhere in the church: run back to the water bowl and drink on arrival
  const route = findWillowPath(state.currentNodeId, 'water-bowl', state.random);
  if (route.length > 0) {
    state.path = route;
    state.pendingDrink = true;
    state.mode = 'running';
    state.animTime = 0;
    state.frame = 0;
  }
}

/** Triggered when the visitor clicks or taps Willow: she stops and greets them with a wave or joyful jump. */
export function triggerWillowGreet(state: WillowState) {
  state.path = [];
  state.pendingDrink = false;
  state.vx = 0;
  state.vz = 0;
  state.animTime = 0;
  state.frame = 0;
  state.greetToggle = !state.greetToggle;
  if (state.greetToggle) {
    state.mode = 'waving';
    state.animation = 'waving';
    state.stateRemaining = 2.0;
  } else {
    state.mode = 'jumping';
    state.animation = 'jumping';
    const spec = WILLOW_SPRITE_SHEET.animations.jumping;
    state.stateRemaining = (2 * spec.frames) / spec.fps;
  }
}

export function advanceWillowState(
  state: WillowState,
  dt: number,
  camRightX = 1,
  camRightZ = 0,
  cameraPos?: { x: number; z: number }
) {
  if (!state.revealed || !Number.isFinite(dt) || dt <= 0) return;

  if (state.mode === 'running') {
    let remainingStep = dt * WILLOW_RUN_SPEED;
    while (remainingStep > 0 && state.path.length > 0) {
      const targetId = state.path[0];
      const target = WAYPOINT_BY_ID.get(targetId);
      if (!target) {
        state.path.shift();
        continue;
      }
      const dx = target.x - state.x;
      const dz = target.z - state.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= remainingStep) {
        state.x = target.x;
        state.z = target.z;
        state.currentNodeId = targetId;
        state.path.shift();
        remainingStep -= dist;
        if (dist > 1e-4) {
          state.vx = (dx / dist) * WILLOW_RUN_SPEED;
          state.vz = (dz / dist) * WILLOW_RUN_SPEED;
        }
      } else {
        const inv = 1 / dist;
        state.vx = dx * inv * WILLOW_RUN_SPEED;
        state.vz = dz * inv * WILLOW_RUN_SPEED;
        state.x += dx * inv * remainingStep;
        state.z += dz * inv * remainingStep;
        remainingStep = 0;
      }
    }

    state.runAnimation = pickRunAnimation(state.vx, state.vz, camRightX, camRightZ, state.runAnimation);
    state.animation = state.runAnimation;

    if (state.path.length === 0) {
      if (state.pendingDrink && state.currentNodeId === 'water-bowl') {
        state.pendingDrink = false;
        state.vx = 0;
        state.vz = 0;
        state.mode = 'drinking';
        state.animation = 'drinking';
        state.animTime = 0;
        state.frame = 0;
        state.stateRemaining = WILLOW_DRINK_SECONDS;
      } else {
        const nearViewer = cameraPos ? Math.hypot(cameraPos.x - state.x, cameraPos.z - state.z) < 4.5 : false;
        enterPausePose(state, nearViewer);
      }
    }
  } else {
    if (state.mode === 'drinking') {
      const toBowlX = WILLOW_WATER_BOWL_POS.x - state.x;
      const toBowlZ = WILLOW_WATER_BOWL_POS.z - state.z;
      const bowlDot = toBowlX * camRightX + toBowlZ * camRightZ;
      if (Math.abs(bowlDot) > 1e-3) state.drinkFacingRight = bowlDot >= 0;
    }
    state.stateRemaining -= dt;
    if (state.stateRemaining <= 0) {
      if (state.reducedMotion) {
        state.mode = 'idle';
        state.animation = 'idle';
        state.animTime = 0;
        state.frame = 0;
        state.stateRemaining = Infinity;
      } else {
        const nextPath = chooseNextPath(state);
        if (nextPath.length > 0) {
          state.path = nextPath;
          state.mode = 'running';
          state.animTime = 0;
          state.frame = 0;
        } else {
          state.mode = 'idle';
          state.animation = 'idle';
          state.stateRemaining = 2.0;
        }
      }
    }
  }

  // Advance sprite frame clock
  const spec = WILLOW_SPRITE_SHEET.animations[state.animation];
  state.animTime += dt;
  const rawFrame = Math.floor(state.animTime * spec.fps);
  if (spec.loop || state.mode === 'jumping') {
    state.frame = rawFrame % spec.frames;
  } else {
    state.frame = Math.min(spec.frames - 1, rawFrame);
  }
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = makeCanvas(size, size);
  const ctx = canvas2d(canvas);
  const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(18, 12, 8, 0.44)');
  g.addColorStop(0.55, 'rgba(18, 12, 8, 0.22)');
  g.addColorStop(1, 'rgba(18, 12, 8, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvasTexture(canvas, { srgb: true });
}

const MOOD_TINT: Record<string, number> = {
  autumn: 0xf4eee6,
  golden: 0xf7dec0,
  evensong: 0x9b8976
};

function createWaterBowlTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 128;
  const canvas = makeCanvas(w, h);
  const ctx = canvas2d(canvas);

  // Warm stoneware ceramic glaze
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#f3ede0');
  grad.addColorStop(0.55, '#e8dfd0');
  grad.addColorStop(1, '#d6cab6');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Berry-pink rim band matching Willow's jumper
  ctx.fillStyle = '#c8346a';
  ctx.fillRect(0, 12, w, 14);
  ctx.fillStyle = '#9f2351';
  ctx.fillRect(0, 26, w, 4);

  // Hand-lettered "WILLOW" on the front of the bowl with a small paw dot flanking each side
  ctx.fillStyle = '#4a2824';
  ctx.font = 'bold 40px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('WILLOW', w * 0.5, 76);

  return canvasTexture(canvas, { srgb: true });
}

function buildWaterBowl() {
  const group = new THREE.Group();
  group.name = 'willow-water-bowl';
  group.userData.era = 'today';
  group.userData.waterBowl = true;
  group.userData.animated = true;

  // Flared stoneware bowl profile (hollow inside with thick rolled lip)
  const profile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.128, 0.0),
    new THREE.Vector2(0.126, 0.012),
    new THREE.Vector2(0.114, 0.056),
    new THREE.Vector2(0.11, 0.072),
    new THREE.Vector2(0.103, 0.076),
    new THREE.Vector2(0.097, 0.072),
    new THREE.Vector2(0.095, 0.022),
    new THREE.Vector2(0.088, 0.014),
    new THREE.Vector2(0.0, 0.014)
  ];
  const bowlGeo = new THREE.LatheGeometry(profile, 32);
  const bowlMat = new THREE.MeshStandardMaterial({
    map: createWaterBowlTexture(),
    roughness: 0.32,
    metalness: 0.04
  });
  const bowlMesh = new THREE.Mesh(bowlGeo, bowlMat);
  bowlMesh.castShadow = true;
  bowlMesh.receiveShadow = true;
  // Turn "WILLOW" lettering toward the doorway / nave aisle (-X, +Z)
  bowlMesh.rotation.y = Math.PI * 0.65;
  group.add(bowlMesh);

  // Dark rubber non-slip base ring
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x262423, roughness: 0.85 });
  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.127, 0.005, 8, 28), rubberMat);
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.004;
  group.add(baseRing);

  // Clear cool water inside the bowl
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0xaad8ea,
    emissive: 0x163644,
    emissiveIntensity: 0.25,
    roughness: 0.08,
    metalness: 0.16,
    transparent: true,
    opacity: 0.8
  });
  const waterDisc = new THREE.Mesh(new THREE.CircleGeometry(0.098, 28), waterMat);
  waterDisc.name = 'willow-water-surface';
  waterDisc.rotation.x = -Math.PI / 2;
  waterDisc.position.y = 0.056;
  group.add(waterDisc);

  // Soft concentric ripple ring shown while Willow laps from the bowl
  const rippleMat = new THREE.MeshBasicMaterial({
    color: 0xeaf7fc,
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.028, 24), rippleMat);
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.y = 0.058;
  ripple.visible = false;
  ripple.raycast = () => {};
  group.add(ripple);

  // Generous invisible click target so clicking the bowl tucked under the pew is effortless
  const hitTarget = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.19, 0.16, 16),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitTarget.position.y = 0.08;
  hitTarget.visible = false;
  group.add(hitTarget);

  group.position.set(WILLOW_WATER_BOWL_POS.x, DIM.naveFloorY, WILLOW_WATER_BOWL_POS.z);

  let ripplePhase = 0;
  function updateRipple(dt: number, drinking: boolean) {
    if (!drinking) {
      ripple.visible = false;
      rippleMat.opacity = 0;
      return;
    }
    ripple.visible = true;
    ripplePhase = (ripplePhase + dt * 1.65) % 1;
    const scale = 0.45 + ripplePhase * 2.75;
    ripple.scale.setScalar(scale);
    rippleMat.opacity = Math.sin(ripplePhase * Math.PI) * 0.55;
  }

  return { group, updateRipple };
}

export interface VisibilityFader {
  setVisible(obj: THREE.Object3D, show: boolean, instant?: boolean): void;
}

export interface WillowController {
  group: THREE.Group;
  bowlGroup: THREE.Group;
  state: WillowState;
  update(dt: number, camera: THREE.Camera): void;
  setMood(moodKey: string): void;
  setEra(era: 'today' | '1900', fader: VisibilityFader, instant?: boolean): void;
  summonFromBowl(fader: VisibilityFader): void;
  greet(): void;
}

export function buildWillow(): WillowController {
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const state = createWillowState({ reducedMotion, revealed: false });
  let currentEra: 'today' | '1900' = 'today';

  const group = new THREE.Group();
  group.name = 'willow';
  // Visibility is gated on BOTH Today era and the visitor clicking the water bowl (managed via setEra / summonFromBowl)
  group.visible = false;
  group.userData.willow = true;
  group.userData.animated = true;

  const bowl = buildWaterBowl();

  const { cols, rows, cellWidth, cellHeight, anchorY, worldHeight, jumpScale } = WILLOW_SPRITE_SHEET;
  const baseW = worldHeight * (cellWidth / cellHeight);
  const baseH = worldHeight;

  const texture = new THREE.TextureLoader().load(WILLOW_SPRITE_SHEET.url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1 / cols, 1 / rows);

  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    color: MOOD_TINT.autumn,
    transparent: true,
    alphaTest: 0.08,
    depthWrite: true
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.name = 'willow-sprite';
  sprite.center.set(0.5, anchorY);
  sprite.scale.set(baseW, baseH, 1);
  group.add(sprite);

  const shadowMat = new THREE.MeshBasicMaterial({
    map: createContactShadowTexture(),
    transparent: true,
    depthWrite: false
  });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.24, 24), shadowMat);
  shadow.name = 'willow-shadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  shadow.renderOrder = 1;
  // Let raycasts pass through the shadow disc to hit Willow's sprite cleanly
  shadow.raycast = () => {};
  group.add(shadow);

  const camRight = new THREE.Vector3();

  function syncVisuals() {
    const floorY = willowFloorY(state.x, state.z);
    group.position.set(state.x, floorY, state.z);

    const spec = WILLOW_SPRITE_SHEET.animations[state.animation];
    const flipX = state.animation === 'drinking' && !state.drinkFacingRight;
    texture.repeat.set(flipX ? -1 / cols : 1 / cols, 1 / rows);
    texture.offset.set(flipX ? (state.frame + 1) / cols : state.frame / cols, (rows - 1 - spec.row) / rows);

    const scaleBoost = state.animation === 'jumping' ? jumpScale : 1;
    sprite.scale.set(baseW * scaleBoost, baseH * scaleBoost, 1);

    // Ground contact shadow shrinks gently while Willow is airborne in a jump or elongates along her stride
    if (state.animation === 'jumping') {
      const airScale = state.frame === 2 ? 0.68 : state.frame === 1 || state.frame === 3 ? 0.84 : 1.0;
      shadow.scale.set(airScale, airScale, 1);
      shadow.rotation.z = 0;
    } else if (state.animation === 'drinking') {
      shadow.scale.set(1.12, 0.82, 1);
      shadow.rotation.z = 0;
    } else if (state.mode === 'running') {
      if (state.animation === 'running-front' || state.animation === 'running-back') {
        const hopScale = state.frame === 2 ? 0.8 : state.frame === 0 ? 0.9 : 1.0;
        shadow.scale.set(0.94 * hopScale, 0.9 * hopScale, 1);
        shadow.rotation.z = 0;
      } else {
        const strideStretch = state.frame === 0 || state.frame === 4 ? 1.18 : 1.06;
        shadow.scale.set(strideStretch, 0.78, 1);
        shadow.rotation.z = -Math.atan2(state.vz, state.vx);
      }
    } else {
      shadow.scale.set(1, 0.92, 1);
      shadow.rotation.z = 0;
    }
  }

  syncVisuals();

  return {
    group,
    bowlGroup: bowl.group,
    state,
    update(dt: number, camera: THREE.Camera) {
      const drinkingNow = group.visible && state.revealed && state.mode === 'drinking';
      bowl.updateRipple(dt, drinkingNow);
      if (!group.visible || !state.revealed) return;
      camRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
      advanceWillowState(state, dt, camRight.x, camRight.z, camera.position);
      syncVisuals();
    },
    setMood(moodKey: string) {
      const hex = MOOD_TINT[moodKey] ?? MOOD_TINT.autumn;
      spriteMat.color.setHex(hex);
      // If fade.ts currently holds a cloned copy material on the sprite, keep its tint in sync too
      if (sprite.material !== spriteMat && sprite.material instanceof THREE.SpriteMaterial) {
        sprite.material.color.setHex(hex);
      }
    },
    setEra(era: 'today' | '1900', fader: VisibilityFader, instant = false) {
      currentEra = era;
      fader.setVisible(group, era === 'today' && state.revealed, instant);
    },
    summonFromBowl(fader: VisibilityFader) {
      if (currentEra !== 'today') return;
      const wasRevealed = state.revealed;
      summonWillowToBowl(state);
      syncVisuals();
      if (!wasRevealed) fader.setVisible(group, true);
    },
    greet() {
      if (!state.revealed) return;
      triggerWillowGreet(state);
      syncVisuals();
    }
  };
}
