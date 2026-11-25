import {
  MAP,
  CHURCH_PORCH_SIDE,
  CHURCH_PLAN,
  mapPoint,
  buildingRoofCovering,
  timberPlinthHeight,
  footprintEvidence,
  spacedWindowCentres,
  places,
  buildings,
  tracks,
  roadEvidence,
  boundaryEvidence,
  roadEdges,
  roadPolygons,
  fieldBoundaries,
  easternField,
  churchyard,
  tenementGarden,
  ponds
} from './ilmer-1839-data.ts';
import { compassHeading, createGeoReference, gpsToMapPixel, observeCompassAvailability } from './ilmer-ar.ts';
import { validateTerrain, historicalTerrain, terrainHeight } from './ilmer-terrain.ts';
import type { MeasuredTerrain } from './ilmer-terrain.ts';
import { validateTrees, validatePlacedTrees, circleOverlapsTriangles, createTreeCrown } from './ilmer-trees.ts';
import type { PlacedTree, Triangle } from './ilmer-trees.ts';
import { drapeMapPolygon, drapeTrack } from './ilmer-ground-drape.ts';
import {
  rideCircuitPoint,
  rideCircuitLength,
  rideLength,
  rideStart,
  rideEnd,
  rideSpeed,
  ridePoint
} from './ilmer-ride.ts';
import { SIGNPOSTS, createFingerpost, signpostPlacement } from './ilmer-signpost.ts';
import { cameraFloor, cameraGroundClearance } from './ilmer-camera.ts';
import {
  flightStops,
  advanceFlight as advanceFlightDistance,
  blendIn,
  smoothClearance,
  stopAtDistance
} from './ilmer-flight.ts';
import { createVillageAudio } from './ilmer-ride-audio.ts';
import type { Emitter } from './ilmer-ride-audio.ts';
import { AUTUMN_SUN, createVillageSky } from './ilmer-sky.ts';
import { createHorseAndCart, HORSE_OFFSET } from './ilmer-horse-cart.ts';
import { livestockFields, createLivestock, advanceLivestock, withinField } from './ilmer-livestock.ts';
import { bindFullscreenToggle } from './scene-fullscreen.ts';
import { canvas2d } from './st-peters-3d/canvas-utils.ts';
import './st-peters-3d/walk-joystick.ts';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

type DeviceOrientationEventConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<PermissionState>;
};

interface DrapedSurface {
  geometry: THREE.BufferGeometry;
  maxDrapeError: number;
}

interface GableParts {
  roofMesh: THREE.Mesh;
  endMesh: THREE.Mesh;
}

interface AnimalState {
  id: string;
  x: number;
  z: number;
  heading: number;
  mode: string;
  phase: number;
  travelled: number;
}

interface AnimalBatch {
  species: string;
  animals: AnimalState[];
  mesh: THREE.InstancedMesh;
  position: [number, number, number];
  scale: [number, number, number];
  motion: string;
  rotation: number;
}

interface ViewFlight {
  from: THREE.Vector3;
  to: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  elapsed: number;
  time: number | null;
  duration: number;
  arc: number;
}

interface FlightBlend {
  position: THREE.Vector3;
  target: THREE.Vector3;
  elapsed: number;
  duration: number;
}

interface ARSession {
  cameraPosition: THREE.Vector3;
  cameraQuaternion: THREE.Quaternion;
  cameraTarget: THREE.Vector3;
  cameraFov: number;
  controlsEnabled: boolean;
  clearAlpha: number;
  groundVisible: boolean;
  baseVisible: boolean;
  skirtVisible: boolean;
  mappedGroundVisible: boolean;
  mapPlaneVisible: boolean;
  waterFeaturesVisible: boolean;
  landscapeVisible: boolean;
  structuresVisible: boolean;
  labelsVisible: boolean;
  livestockVisible: boolean;
  watchId: number | null;
  stream: MediaStream | null;
  fullscreenActive: boolean;
  resolveLocation: ((position: GeolocationPosition) => void) | null;
  rejectLocation: ((reason?: unknown) => void) | null;
  resolveOrientation: (() => void) | null;
  rejectOrientation: ((reason?: unknown) => void) | null;
  orientationObserved: boolean;
  locationTimeout: number | null;
  orientationTimeout: number | null;
}

// The village page always includes the scene host, status line and control buttons.
const host = document.getElementById('village-scene')!;
const status = document.getElementById('scene-status')!;

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function start() {
  const terrainResponse = await fetch('/assets/ilmer-terrain.json');
  if (!terrainResponse.ok) throw new Error(`Measured terrain could not load: HTTP ${terrainResponse.status}`);
  const terrainText = await terrainResponse.text();
  const terrain = historicalTerrain(validateTerrain<MeasuredTerrain>(JSON.parse(terrainText)));
  const geoReference = createGeoReference(terrain.source.landmarks);
  const treeResponse = await fetch('/assets/ilmer-trees.json');
  if (!treeResponse.ok) throw new Error(`Detected tree symbols could not load: HTTP ${treeResponse.status}`);
  const treeText = await treeResponse.text();
  const treeData = validateTrees(JSON.parse(treeText));
  const placedUrl = host.dataset.placedTrees;
  if (!placedUrl) throw new Error('Placed tree data is not configured');
  const placedResponse = await fetch(placedUrl);
  if (!placedResponse.ok) throw new Error(`Placed trees could not load: HTTP ${placedResponse.status}`);
  const placed = validatePlacedTrees(await placedResponse.json());
  if (placed.detectionsSha256 !== (await sha256Hex(treeText)))
    throw new Error('Placed trees do not match the detected tree symbols');
  if (placed.terrainSha256 !== (await sha256Hex(terrainText)))
    throw new Error('Placed trees do not match the measured terrain');
  const groundHeight = (x: number, z: number): number => terrainHeight(terrain, x, z);
  let maxSurfaceDrapeError = 0;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Buildings, trees and hedges stand still, so the 2048² shadow map is drawn when their visibility changes
  // (the tithe-map overlay, or AR) rather than every frame. Sheep, poultry and the horse and cart move
  // constantly and do not cast: a frozen shadow would sit where they started, and redrawing the map for
  // them costs about half the frame.
  renderer.shadowMap.autoUpdate = false;
  let shadowsDirty = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // The church model's cinematic Autumn Sun look: filmic tone mapping, a low warm sun and blue haze
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = AUTUMN_SUN.exposure;
  renderer.setClearColor(AUTUMN_SUN.fogColor, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);
  const arVideo = document.createElement('video');
  arVideo.className = 'ar-video';
  arVideo.autoplay = true;
  arVideo.muted = true;
  arVideo.playsInline = true;
  arVideo.setAttribute('aria-hidden', 'true');
  host.insertBefore(arVideo, renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(43, 1, 0.5, 1800);
  const controls = new OrbitControls(camera, renderer.domElement);
  let navigationMode = 'orbit';
  const movementKeys = new Set<string>();
  const flyKeys = new Set(['w', 'a', 's', 'd', 'q', 'e', 'shift', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown']);
  // Analog fly input from the on-screen joystick (x: right, y: forward, each -1..1)
  const flyStick = { x: 0, y: 0 };
  controls.enableDamping = false;
  controls.minDistance = 22;
  controls.maxDistance = 800;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.target.set(0, 0, 40);
  const landscape = new THREE.Group();
  const mappedGround = new THREE.Group();
  const waterFeatures = new THREE.Group();
  const structures = new THREE.Group();
  const labels = new THREE.Group();
  scene.add(landscape, mappedGround, waterFeatures, structures, labels);
  const villageFog = new THREE.FogExp2(AUTUMN_SUN.fogColor, AUTUMN_SUN.fogDensity);
  scene.fog = villageFog;
  const sky = createVillageSky(1500);
  scene.add(sky.mesh);
  scene.add(new THREE.HemisphereLight(AUTUMN_SUN.hemiSky, AUTUMN_SUN.hemiGround, AUTUMN_SUN.hemiIntensity));
  const sun = new THREE.DirectionalLight(AUTUMN_SUN.sunColor, AUTUMN_SUN.sunIntensity);
  const [sunX, sunY, sunZ] = AUTUMN_SUN.sunDirection;
  sun.position.set(sunX, sunY, sunZ).setLength(420);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -380, right: 380, top: 330, bottom: -330, near: 1, far: 900 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.3;
  scene.add(sun);
  const material = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 1, ...extra });

  function texture(kind: string) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas2d(canvas);
    if (kind === 'brick') {
      ctx.fillStyle = '#b6a18d';
      ctx.fillRect(0, 0, 128, 128);
      for (let row = 0; row < 4; row++)
        for (let col = -1; col < 4; col++) {
          const tone = (row * 13 + col * 7 + 70) % 23;
          ctx.fillStyle = `rgb(${139 + tone},${70 + tone},${48 + tone})`;
          ctx.fillRect(col * 32 + (row % 2) * 16, row * 32, 30, 28);
        }
      const result = new THREE.CanvasTexture(canvas);
      result.colorSpace = THREE.SRGBColorSpace;
      result.wrapS = result.wrapT = THREE.RepeatWrapping;
      return result;
    }
    if (kind === 'thatch') {
      ctx.fillStyle = '#a99667';
      ctx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 700; i++) {
        const x = (i * 47) % 128;
        const y = (i * 31) % 128;
        ctx.strokeStyle = i % 2 ? '#c6b582' : '#8b794f';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (i % 3) - 1, y + 7 + (i % 11));
        ctx.stroke();
      }
      const result = new THREE.CanvasTexture(canvas);
      result.colorSpace = THREE.SRGBColorSpace;
      result.wrapS = result.wrapT = THREE.RepeatWrapping;
      return result;
    }
    ctx.fillStyle = kind === 'stone' ? '#b2afa0' : kind === 'roof' ? '#735143' : '#655443';
    ctx.fillRect(0, 0, 128, 128);
    for (let row = 0; row < 16; row++) {
      if (kind === 'wood') {
        const tone = (row * 13) % 23;
        ctx.fillStyle = `rgb(${70 + tone},${55 + tone},${42 + tone})`;
        ctx.fillRect(0, row * 8, 128, 7);
        continue;
      }
      for (let col = -1; col < 9; col++) {
        const tone = (row * 13 + col * 7 + 70) % 23;
        ctx.fillStyle =
          kind === 'stone'
            ? `rgb(${151 + tone},${148 + tone},${131 + tone})`
            : kind === 'roof'
              ? `rgb(${90 + tone},${61 + tone},${48 + tone})`
              : `rgb(${70 + tone},${55 + tone},${42 + tone})`;
        ctx.fillRect(col * 16 + (row % 2) * 8, row * 8, 15, kind === 'wood' ? 7 : 6);
      }
    }
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    result.wrapS = result.wrapT = THREE.RepeatWrapping;
    return result;
  }
  const stone = material(0xffffff, { map: texture('stone') });
  const roof = material(0xffffff, { map: texture('roof'), side: THREE.DoubleSide });
  const thatch = material(0xffffff, { map: texture('thatch'), side: THREE.DoubleSide });
  const timber = material(0xffffff, { map: texture('wood') });
  const brick = material(0xffffff, { map: texture('brick') });
  const whiteboard = material(0xd0cbbc);
  const plaster = material(0xe3ddc9);
  const frameMaterial = material(0x392a22);
  const dark = material(0x302e26);
  const hedgeMaterial = material(0x69774d);
  const trunkMaterial = material(0x78634a);
  const leafMaterials = [0x41652c, 0x34582b, 0x527535].map((color) =>
    material(color, { vertexColors: true, transparent: true, opacity: 0.38, depthWrite: false })
  );
  const groundGeometry = new THREE.PlaneGeometry(terrain.width, terrain.depth, terrain.columns - 1, terrain.rows - 1);
  groundGeometry.rotateX(-Math.PI / 2);
  const groundVertices = groundGeometry.attributes.position;
  for (let i = 0; i < groundVertices.count; i++) {
    groundVertices.setY(i, groundHeight(groundVertices.getX(i), groundVertices.getZ(i)));
  }
  groundGeometry.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeometry, material(0xa9b382));
  ground.receiveShadow = true;
  scene.add(ground);
  const base = new THREE.Mesh(new THREE.BoxGeometry(terrain.width, 3, terrain.depth), material(0x8a8063));
  base.position.y = -1.55;
  scene.add(base);
  const skirtVertices = [];
  for (const side of [
    [
      [-320, -141.12],
      [320, -141.12]
    ],
    [
      [320, -141.12],
      [320, 141.12]
    ],
    [
      [320, 141.12],
      [-320, 141.12]
    ],
    [
      [-320, 141.12],
      [-320, -141.12]
    ]
  ]) {
    const [[ax, az], [bx, bz]] = side;
    for (let i = 0; i < 200; i++) {
      const x0 = ax + ((bx - ax) * i) / 200;
      const z0 = az + ((bz - az) * i) / 200;
      const x1 = ax + ((bx - ax) * (i + 1)) / 200;
      const z1 = az + ((bz - az) * (i + 1)) / 200;
      skirtVertices.push(
        x0,
        -0.05,
        z0,
        x1,
        -0.05,
        z1,
        x1,
        groundHeight(x1, z1),
        z1,
        x0,
        -0.05,
        z0,
        x1,
        groundHeight(x1, z1),
        z1,
        x0,
        groundHeight(x0, z0),
        z0
      );
    }
  }
  const skirtGeometry = new THREE.BufferGeometry();
  skirtGeometry.setAttribute('position', new THREE.Float32BufferAttribute(skirtVertices, 3));
  skirtGeometry.computeVertexNormals();
  const skirt = new THREE.Mesh(skirtGeometry, material(0x8a8063, { side: THREE.DoubleSide }));
  scene.add(skirt);

  function rememberDrape(draped: DrapedSurface) {
    maxSurfaceDrapeError = Math.max(maxSurfaceDrapeError, draped.maxDrapeError);
    return draped.geometry;
  }

  function flatPolygon(
    points: readonly (readonly number[])[],
    mat: THREE.Material,
    elevation = 0.04,
    parent: THREE.Object3D = mappedGround,
    fixedHeight: null = null
  ) {
    const geometry = rememberDrape(drapeMapPolygon(terrain, groundHeight, mapPoint, points, elevation, fixedHeight));
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  flatPolygon(livestockFields[1].outline, material(0xb9bc85));
  flatPolygon(easternField, material(0xb7ad7b));
  flatPolygon(livestockFields[0].outline, material(0xb5bc8d));
  flatPolygon(churchyard, material(0xb4bf94), 0.09);
  flatPolygon(tenementGarden, material(0xb5bc8d));
  const pondSurfaces: THREE.Mesh[] = [];
  const pondPolygons = ponds.map((pond) => pond.map(([x, y]) => mapPoint(x, y)));
  for (const pond of ponds) {
    // Ponds follow the modern ground: a flat surface at the lowest vertex would bury most of a pond on a slope.
    pondSurfaces.push(
      flatPolygon(pond, material(0x7eaaa5, { roughness: 0.4, side: THREE.DoubleSide }), 0.08, waterFeatures, null)
    );
  }

  const roadTriangles: Triangle[] = [];
  function pathMesh(
    points: readonly (readonly number[])[],
    width: number,
    mat: THREE.Material,
    elevation = 0.14,
    road = false
  ) {
    const geometry = rememberDrape(drapeTrack(terrain, groundHeight, mapPoint, points, width, elevation));
    if (road) {
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i += 3)
        roadTriangles.push([0, 1, 2].map((offset) => [positions.getX(i + offset), positions.getZ(i + offset)]));
    }
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.receiveShadow = true;
    mappedGround.add(mesh);
  }
  for (const polygon of roadPolygons) {
    const road = flatPolygon(polygon, material(0xd4c5a3, { side: THREE.DoubleSide }), 0.14);
    const positions = road.geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 3)
      roadTriangles.push([0, 1, 2].map((offset) => [positions.getX(i + offset), positions.getZ(i + offset)]));
  }
  for (const track of tracks) pathMesh(track, 1.5, material(0xc8ba97, { side: THREE.DoubleSide }), 0.14, true);

  function box(
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    if (mat === brick) {
      const { position, normal, uv } = mesh.geometry.attributes;
      for (let i = 0; i < position.count; i++) {
        const horizontal = Math.abs(normal.getX(i)) > 0.5 ? position.getZ(i) : position.getX(i);
        const vertical = Math.abs(normal.getY(i)) > 0.5 ? position.getZ(i) : position.getY(i) + y;
        uv.setXY(i, horizontal / 1.2, vertical / 0.3);
      }
    }
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function foundation(
    parent: THREE.Object3D,
    length: number,
    width: number,
    addPlinth = true,
    plinthMaterial: THREE.Material = stone,
    aboveGround = 0
  ) {
    const supportPoints = [
      [0, 0],
      [-length / 2, -width / 2],
      [length / 2, -width / 2],
      [length / 2, width / 2],
      [-length / 2, width / 2]
    ];
    if (aboveGround > 0) {
      const columns = Math.ceil(length / 2);
      const rows = Math.ceil(width / 2);
      for (let i = 0; i <= columns; i++)
        for (let j = 0; j <= rows; j++)
          supportPoints.push([-length / 2 + (i * length) / columns, -width / 2 + (j * width) / rows]);
    }
    parent.updateWorldMatrix(true, false);
    const elevations = supportPoints.map(([x, z]) => {
      const point = parent.localToWorld(new THREE.Vector3(x, 0, z));
      return groundHeight(point.x, point.z);
    });
    const top = Math.max(...elevations) + 0.05;
    const bottom = Math.min(...elevations) - (aboveGround > 0 ? 0.3 : 0.05);
    parent.position.y = top;
    const depth = top - bottom;
    if (addPlinth) {
      const lip = aboveGround > 0 ? 0.04 : 0;
      box(parent, length + lip, depth + aboveGround, width + lip, 0, (aboveGround - depth) / 2, 0, plinthMaterial);
    }
    return top - bottom;
  }

  function gable(
    parent: THREE.Object3D,
    length: number,
    width: number,
    height: number,
    mat: THREE.Material,
    rise = width * 0.46,
    roofMaterial: THREE.Material = roof,
    westHalfHip = false
  ): GableParts {
    box(parent, length, height, width, 0, height / 2, 0, mat);
    const overhang = roofMaterial === thatch ? 0.55 : 0.2;
    const l = length / 2 + overhang;
    const w = width / 2 + overhang;
    const vertices = [
      -l,
      height,
      -w,
      l,
      height,
      -w,
      l,
      height + rise,
      0,
      -l,
      height + rise,
      0,
      -l,
      height,
      w,
      l,
      height,
      w
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex([0, 3, 2, 0, 2, 1, 4, 5, 2, 4, 2, 3]);
    geometry.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute(
        [0, 0, length / 4, 0, length / 4, width / 4, 0, width / 4, 0, width / 2, length / 4, width / 2],
        2
      )
    );
    if (westHalfHip) {
      const hip = 1.9;
      const hipHeight = height + rise * 0.5;
      const hipWidth = w * 0.5;
      const positions = [
        -l,
        height,
        -w,
        l,
        height,
        -w,
        l,
        height + rise,
        0,
        -l + hip,
        height + rise,
        0,
        -l,
        hipHeight,
        -hipWidth,
        -l,
        height,
        w,
        l,
        height,
        w,
        -l,
        hipHeight,
        hipWidth
      ];
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex([0, 3, 2, 0, 2, 1, 0, 4, 3, 5, 6, 2, 5, 2, 3, 5, 3, 7, 4, 7, 3]);
      geometry.setAttribute(
        'uv',
        new THREE.Float32BufferAttribute(
          [
            0,
            0,
            length / 4,
            0,
            length / 4,
            width / 4,
            hip / 4,
            width / 4,
            0,
            width / 8,
            0,
            width / 2,
            length / 4,
            width / 2,
            0,
            (width * 3) / 8
          ],
          2
        )
      );
    }
    geometry.computeVertexNormals();
    const roofMesh = new THREE.Mesh(geometry, roofMaterial);
    roofMesh.castShadow = true;
    parent.add(roofMesh);
    if (roofMaterial === thatch) {
      const profile = new THREE.Shape();
      profile.moveTo(-w, height);
      profile.lineTo(0, height + rise);
      profile.lineTo(w, height);
      profile.lineTo(w, height - 0.8);
      profile.lineTo(0, height + rise - 0.8);
      profile.lineTo(-w, height - 0.8);
      profile.closePath();
      const thickRoof = new THREE.ExtrudeGeometry(profile, { depth: l * 2, bevelEnabled: false });
      thickRoof.rotateY(Math.PI / 2);
      thickRoof.translate(-l, 0, 0);
      roofMesh.geometry.dispose();
      roofMesh.geometry = thickRoof;
      const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, length + 1.1, 12), thatch);
      ridge.rotation.z = Math.PI / 2;
      ridge.position.y = height + rise;
      ridge.castShadow = true;
      parent.add(ridge);
      for (const side of [-1, 1]) {
        const eaves = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, length + 1.1, 12), thatch);
        eaves.rotation.z = Math.PI / 2;
        eaves.position.set(0, height - 0.4, side * (w - 0.12));
        eaves.castShadow = true;
        parent.add(eaves);
      }
    }
    const ends = new THREE.BufferGeometry();
    ends.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          -length / 2,
          height,
          -width / 2,
          -length / 2,
          height + rise,
          0,
          -length / 2,
          height,
          width / 2,
          length / 2,
          height,
          width / 2,
          length / 2,
          height + rise,
          0,
          length / 2,
          height,
          -width / 2
        ],
        3
      )
    );
    ends.setIndex([2, 1, 0, 5, 4, 3]);
    ends.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0.5, 1, 1, 0, 0, 0, 0.5, 1, 1, 0], 2));
    if (westHalfHip) {
      ends.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          [
            -length / 2,
            height,
            -width / 2,
            -length / 2,
            height + rise * 0.5,
            -width / 4,
            -length / 2,
            height + rise * 0.5,
            width / 4,
            -length / 2,
            height,
            width / 2,
            length / 2,
            height,
            width / 2,
            length / 2,
            height + rise,
            0,
            length / 2,
            height,
            -width / 2
          ],
          3
        )
      );
      ends.setIndex([2, 1, 0, 3, 2, 0, 6, 5, 4]);
      ends.setAttribute(
        'uv',
        new THREE.Float32BufferAttribute([0, 0, 0.25, 0.5, 0.75, 0.5, 1, 0, 0, 0, 0.5, 1, 1, 0], 2)
      );
    }
    ends.computeVertexNormals();
    if (mat === brick) {
      const { position, uv } = ends.attributes;
      for (let i = 0; i < position.count; i++) uv.setXY(i, position.getZ(i) / 1.2, position.getY(i) / 0.3);
    }
    const endMesh = new THREE.Mesh(ends, mat);
    endMesh.castShadow = true;
    parent.add(endMesh);
    return { roofMesh, endMesh };
  }

  function beam(
    parent: THREE.Object3D,
    a: readonly number[],
    b: readonly number[],
    thickness: number,
    mat: THREE.Material
  ) {
    const start = new THREE.Vector3(a[0], a[1], a[2]);
    const end = new THREE.Vector3(b[0], b[1], b[2]);
    const mesh = box(parent, thickness, start.distanceTo(end), thickness, 0, 0, 0, mat);
    mesh.position.copy(start.clone().add(end).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    return mesh;
  }

  function distressedChancel(parent: THREE.Object3D, originalRoof: THREE.Mesh) {
    parent.remove(originalRoof);
    originalRoof.geometry.dispose();
    const vertices = [];
    const uvs = [];
    const roofHeight = (x: number, t: number) => 5 + 3.8 * t - 0.7 * Math.sin((x / 5.6 + 0.5) * Math.PI) * t;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 12; i++) {
        for (let j = 0; j < 4; j++) {
          const x0 = -2.8 + (i * 5.6) / 12;
          const x1 = x0 + 5.6 / 12;
          const t0 = j / 4;
          const t1 = (j + 1) / 4;
          const point = (x: number, t: number) => [x, roofHeight(x, t), side * 3.2 * (1 - t)];
          vertices.push(
            ...point(x0, t0),
            ...point(x1, t0),
            ...point(x1, t1),
            ...point(x0, t0),
            ...point(x1, t1),
            ...point(x0, t1)
          );
          uvs.push(x0 / 3, t0, x1 / 3, t0, x1 / 3, t1, x0 / 3, t0, x1 / 3, t1, x0 / 3, t1);
        }
      }
      for (let i = 0; i < 8; i++) {
        const x = -2.6 + (i * 5.2) / 7;
        beam(parent, [x, 5, side * 3], [x, roofHeight(x, 1) - 0.15, 0], 0.13, timber);
      }
      const z = side * 3.05;
      for (const [a, b] of [
        [
          [-0.5, 4.6, z],
          [0, 3.8, z]
        ],
        [
          [0, 3.8, z],
          [-0.2, 2.9, z]
        ],
        [
          [-0.2, 2.9, z],
          [0.4, 2.1, z]
        ],
        [
          [0.4, 2.1, z],
          [0.2, 0.6, z]
        ],
        [
          [1.6, 4.7, z],
          [2, 3.7, z]
        ],
        [
          [2, 3.7, z],
          [1.65, 2.5, z]
        ]
      ])
        beam(parent, a, b, 0.09, dark);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    const damaged = new THREE.Mesh(geometry, roof);
    damaged.castShadow = true;
    parent.add(damaged);
    for (let i = 0; i < 9; i++) {
      const x = -1.7 + i * 0.42;
      const t = 0.12 + (i % 3) * 0.13;
      const tile = box(parent, 0.36, 0.07, 0.46, x, roofHeight(x, t) + 0.07, -3.2 * (1 - t), roof);
      tile.rotation.x = Math.atan2(3.8, 3.2) + 0.08 * (i % 2);
      tile.rotation.z = ((i % 3) - 1) * 0.1;
    }
    for (let i = 0; i < 16; i++) {
      const rubble = box(
        parent,
        0.3 + (i % 3) * 0.12,
        0.22,
        0.3,
        2.9 + (i % 4) * 0.32,
        0.12,
        -2.6 + Math.floor(i / 4) * 0.85,
        stone
      );
      rubble.rotation.y = i * 0.7;
    }
    return damaged;
  }

  function windowPanel(parent: THREE.Object3D, x: number, y: number, z: number, width = 1.3, height = 1.5) {
    box(parent, width + 0.22, height + 0.22, 0.08, x, y, z, whiteboard);
    box(parent, width, height, 0.1, x, y, z + Math.sign(z) * 0.05, dark);
    for (const offset of [-width / 4, width / 4]) {
      box(parent, 0.06, height, 0.14, x + offset, y, z + Math.sign(z) * 0.08, whiteboard);
    }
    box(parent, width, 0.06, 0.14, x, y, z + Math.sign(z) * 0.08, whiteboard);
  }

  function dwellingFacade(parent: THREE.Object3D, length: number, width: number, frontDoors: number) {
    const doorZ = width / 2 + 0.12;
    const bayLength = length / frontDoors;
    const doors = Array.from({ length: frontDoors }, (_, i) => -length / 2 + bayLength * (i + 0.5));
    for (const x of doors) {
      box(parent, 1.22, 2.35, 0.12, x, 1.175, doorZ, whiteboard);
      box(parent, 1, 2.15, 0.14, x, 1.075, doorZ + 0.06, frameMaterial);
      box(parent, 0.08, 0.08, 0.08, x + 0.34, 1.05, doorZ + 0.16, trunkMaterial);
      box(parent, 1.35, 0.12, 0.45, x, 0.06, doorZ + 0.12, stone);
    }
    const bays = Math.max(1, Math.floor(length / 8));
    for (const side of [-1, 1]) {
      const positions =
        side === 1
          ? doors.flatMap((door) =>
              spacedWindowCentres(bayLength, 1.1, Math.max(2, (bays * 2) / frontDoors), 1.22).map((x) => x + door)
            )
          : spacedWindowCentres(length, 1.1, bays * 2);
      for (const x of positions) windowPanel(parent, x, 1.65, side * (width / 2 + 0.09), 1.1, 1.35);
      const end = new THREE.Group();
      end.position.x = side * (length / 2 + 0.09);
      end.rotation.y = (side * Math.PI) / 2;
      windowPanel(end, 0, 1.65, 0.02, 1.1, 1.35);
      parent.add(end);
    }
  }

  function tudorFacade(parent: THREE.Object3D, length: number, width: number, height: number) {
    for (const side of [-1, 1]) {
      const z = side * (width / 2 + 0.07);
      for (const level of [0.3, height * 0.45, height * 0.57, height - 0.15]) {
        box(parent, length, 0.23, 0.18, 0, level, z, frameMaterial);
      }
      const bays = Math.max(4, Math.round(length / 2));
      for (let i = 0; i <= bays; i++) {
        const x = -length / 2 + (i * length) / bays;
        box(parent, 0.2, height, 0.2, x, height / 2, z, frameMaterial);
      }
      for (const x of spacedWindowCentres(length, 1.7, 2, side === 1 ? Math.min(length * 0.33, 3) : 0)) {
        windowPanel(parent, x, height * 0.28, z + side * 0.12, 1.7, 1.7);
        windowPanel(parent, x, height * 0.77, z + side * 0.12, 1.7, 1.5);
      }
    }
    // The unseen end elevations are an interpretation of the photographed timber framing.
    for (const side of [-1, 1]) {
      for (const level of [0.3, height * 0.45, height * 0.57, height - 0.15]) {
        box(parent, 0.18, 0.23, width, side * (length / 2 + 0.07), level, 0, frameMaterial);
      }
      for (const z of [-width * 0.45, -width * 0.2, width * 0.2, width * 0.45]) {
        box(parent, 0.2, height, 0.2, side * (length / 2 + 0.07), height / 2, z, frameMaterial);
      }
    }
  }

  function climbingIvy(parent: THREE.Object3D, length: number, width: number, height: number) {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.22);
    for (const [x, y] of [
      [-0.2, -0.02],
      [-0.11, 0.05],
      [-0.22, 0.17],
      [-0.07, 0.15],
      [0, 0.32],
      [0.07, 0.15],
      [0.22, 0.17],
      [0.11, 0.05],
      [0.2, -0.02]
    ])
      shape.lineTo(x, y);
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape);
    const leaves = material(0xffffff, { side: THREE.DoubleSide });
    const stem = material(0x4d5031);
    const stemGeometry = new THREE.CylinderGeometry(0.0175, 0.025, 1, 5);
    const up = new THREE.Vector3(0, 1, 0);
    const direction = new THREE.Vector3();
    const dummy = new THREE.Object3D();
    const colour = new THREE.Color();
    const counts: number[] = [];
    const ivyWalls: [number, number, number, number, boolean][] = [
      [length, 0, width / 2 + 0.08, 0, false],
      [length, 0, -width / 2 - 0.08, Math.PI, false],
      [width, length / 2 + 0.08, 0, Math.PI / 2, true],
      [width, -length / 2 - 0.08, 0, -Math.PI / 2, true]
    ];
    for (const [span, x, z, angle, end] of ivyWalls) {
      const wall = new THREE.Group();
      wall.position.set(x, 0, z);
      wall.rotation.y = angle;
      parent.add(wall);
      const points = [];
      const columns = Math.ceil(span / 0.22);
      const rows = Math.ceil((height + (end ? width * 0.46 : 0)) / 0.22);
      const opening = (u: number, v: number) =>
        (end ? [0] : [-length * 0.3, length * 0.3]).some(
          (centre) =>
            Math.abs(u - centre) < 0.83 && [height * 0.25, height * 0.73].some((level) => Math.abs(v - level) < 0.9)
        ) ||
        (!end && angle === 0 && Math.abs(u) < 1.65 && v < 2.85);
      for (let col = 0; col < columns; col++) {
        for (let row = 0; row < rows; row++) {
          const seed = col * 127 + row * 53 + angle * 29;
          const u = -span / 2 + ((col + 0.5 + 0.4 * Math.sin(seed)) * span) / columns;
          const v = (row + 0.5 + 0.4 * Math.cos(seed * 1.7)) * 0.22;
          const top = height + (end ? Math.max(0, 1 - (Math.abs(u) * 2) / span) * width * 0.46 : 0);
          if (v > top - 0.12 || opening(u, v)) continue;
          // Uneven climbing patches leave masonry visible between the stems.
          if (Math.sin(u * 1.5 + Math.sin(v * 0.8)) + Math.cos(v * 1.2 - u * 0.7) < -0.7) continue;
          points.push([u, v, seed]);
        }
      }
      const stems = [];
      for (let i = 0; i < Math.ceil(span / 1.4); i++) {
        const u = -span / 2 + ((i + 0.5) * span) / Math.ceil(span / 1.4);
        for (let row = 0; row < height / 0.65; row++) {
          const v = row * 0.65;
          const a = u + Math.sin(v * 0.8 + i) * 0.2;
          const b = u + Math.sin((v + 0.65) * 0.8 + i) * 0.2;
          if (!opening(a, v + 0.3)) stems.push([a, v, b, Math.min(v + 0.65, height)]);
        }
      }
      const vines = new THREE.InstancedMesh(stemGeometry, stem, stems.length);
      stems.forEach(([a, v, b, top], index) => {
        direction.set(b - a, top - v, 0.02);
        dummy.position.set((a + b) / 2, (v + top) / 2, 0.01);
        dummy.quaternion.setFromUnitVectors(up, direction.clone().normalize());
        dummy.scale.set(1, direction.length(), 1);
        dummy.updateMatrix();
        vines.setMatrixAt(index, dummy.matrix);
      });
      wall.add(vines);
      const mesh = new THREE.InstancedMesh(geometry, leaves, points.length);
      points.forEach(([u, v, seed], index) => {
        dummy.position.set(u, v, 0.03 + 0.07 * (1 + Math.sin(seed)));
        dummy.rotation.set(0.25 * Math.sin(seed), 0.3 * Math.cos(seed), 0.7 * Math.sin(seed * 0.8));
        dummy.scale.setScalar(0.75 + 0.45 * (1 + Math.cos(seed * 1.3)));
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        colour.setHSL(0.24 + 0.03 * Math.sin(seed), 0.4, 0.16 + 0.06 * (1 + Math.cos(seed)));
        mesh.setColorAt(index, colour);
      });
      mesh.receiveShadow = true;
      wall.add(mesh);
      counts.push(points.length);
    }
    return counts;
  }

  const selectable: THREE.Group[] = [];
  for (const building of buildings) {
    const group = new THREE.Group();
    group.userData.place = building.place;
    group.userData.architecture = building.architecture ?? 'timber';
    group.userData.storeys = building.storeys ?? null;
    group.userData.chimneys = 0;
    const dwelling =
      building.place === 'cottages' || building.place === 'tenements' || building.architecture === 'stone-house';
    group.userData.dwelling = dwelling;
    group.userData.frontDoors = dwelling ? (building.frontDoors ?? 1) : 0;
    group.userData.roofs = [];
    group.userData.brickPlinths = [];
    group.userData.groundBoarded = 0;
    group.userData.ivyLeavesByWall = [];
    group.userData.projections = [];
    const covering = buildingRoofCovering(building.place, building.architecture) === 'thatch' ? thatch : roof;
    for (const [partIndex, [x, y, length, width, angle, height]] of building.parts.entries()) {
      const part = new THREE.Group();
      const [wx, wz] = mapPoint(x, y);
      part.position.set(wx, 0, wz);
      part.rotation.y = (-angle * Math.PI) / 180;
      const l = length * MAP.scale;
      const w = width * MAP.scale;
      const barn = !building.architecture;
      const barnPlinthHeight = barn ? timberPlinthHeight(length, width) : 0;
      const foundationDepth = foundation(
        part,
        l,
        w,
        true,
        barn ? (barnPlinthHeight ? brick : timber) : stone,
        barnPlinthHeight
      );
      if (barn && barnPlinthHeight)
        group.userData.brickPlinths.push({ height: barnPlinthHeight, buriedDepth: foundationDepth });
      if (barn && !barnPlinthHeight) group.userData.groundBoarded++;
      const tudor = building.architecture === 'tudor';
      const vicarage = building.architecture === 'vicarage';
      const stoneHouse = building.architecture === 'stone-house';
      const roofRise = w * (vicarage ? 0.75 : tudor ? 0.65 : 0.46);
      const shell = gable(
        part,
        l,
        w,
        height,
        tudor ? plaster : vicarage ? brick : stoneHouse ? stone : timber,
        roofRise,
        covering
      );
      group.userData.roofs.push(shell.roofMesh.material === thatch ? 'thatch' : 'tile');
      if (!vicarage && !dwelling)
        box(
          part,
          Math.min(l * 0.33, 3),
          barn ? height * 0.76 : 2.7,
          0.08,
          0,
          barn ? height * 0.38 : 1.35,
          w / 2 + 0.03,
          dark
        );
      if (tudor) {
        tudorFacade(part, l, w, height);
        if (partIndex === 0) {
          if (building.storeys === 3) {
            for (const side of [-1, 1]) {
              const gableEnd = new THREE.Group();
              gableEnd.position.x = side * (l / 2 + 0.09);
              gableEnd.rotation.y = (side * Math.PI) / 2;
              windowPanel(gableEnd, 0, height + roofRise * 0.35, 0.02, 1.7, 1.5);
              part.add(gableEnd);
            }
          }
          const ridge = height + roofRise;
          box(part, 1.15, 4.8, 1.15, 0, ridge + 1.6, 0, brick);
          box(part, 1.35, 0.16, 1.35, 0, ridge + 4.08, 0, brick);
          for (const x of [-0.28, 0.28]) box(part, 0.25, 0.22, 0.35, x, ridge + 4.25, 0, dark);
          group.userData.chimneys++;
        }
      } else if (vicarage) {
        box(part, l + 0.08, height * 0.32, w + 0.08, 0, height * 0.16, 0, stone);
        box(part, 1.15, 3.1, 1.15, -l * 0.24, height + roofRise + 0.7, 0, brick);
        group.userData.chimneys++;
        const groundWindowCentre = height / 3;
        const upperWindowCentre = height + roofRise * 0.32;
        for (const side of [-1, 1]) {
          for (const x of [-l * 0.3, l * 0.3]) windowPanel(part, x, groundWindowCentre, side * (w / 2 + 0.09));
          const gableEnd = new THREE.Group();
          gableEnd.position.x = side * (l / 2 + 0.09);
          gableEnd.rotation.y = (side * Math.PI) / 2;
          for (const level of [groundWindowCentre, upperWindowCentre]) windowPanel(gableEnd, 0, level, 0.02);
          part.add(gableEnd);
        }
        const entry = new THREE.Group();
        entry.position.set(0, 0, -w / 2 - 0.65);
        box(entry, l * 0.5, 2.8, 1.7, 0, 1.4, 0, stone);
        box(entry, 1.5, 2.6, 0.1, 0, 1.3, -0.91, dark);
        const canopy = box(entry, l * 0.6, 0.45, 2.3, 0, 3, -0.15, thatch);
        canopy.rotation.x = 0.14;
        part.add(entry);
      } else if (stoneHouse) {
        const doorZ = w / 2 + 0.12;
        box(part, 1.22, 2.35, 0.12, 0, 1.175, doorZ, whiteboard);
        box(part, 1, 2.15, 0.14, 0, 1.075, doorZ + 0.06, frameMaterial);
        box(part, 0.08, 0.08, 0.08, 0.34, 1.05, doorZ + 0.16, trunkMaterial);
        for (const side of [-1, 1]) {
          const levels = building.storeys === 2 ? [height * 0.25, height * 0.73] : [1.65];
          for (const level of levels) {
            for (const x of spacedWindowCentres(l, 1.25, 2, side === 1 ? 1.22 : 0))
              windowPanel(part, x, level, side * (w / 2 + 0.09), 1.25, 1.4);
          }
          const endWindow = new THREE.Group();
          endWindow.position.x = side * (l / 2 + 0.09);
          endWindow.rotation.y = (side * Math.PI) / 2;
          for (const level of levels) windowPanel(endWindow, 0, level, 0.02, 1.25, 1.4);
          part.add(endWindow);
        }
        if (building.place === 'lower') group.userData.ivyLeavesByWall = climbingIvy(part, l, w, height);
      } else if (dwelling) {
        dwellingFacade(part, l, w, group.userData.frontDoors);
      } else if (barn) {
        for (const xOffset of [-l * 0.42, l * 0.42])
          box(
            part,
            0.22,
            height - barnPlinthHeight,
            0.15,
            xOffset,
            (height + barnPlinthHeight) / 2,
            w / 2 + 0.08,
            trunkMaterial
          );
      }
      if (dwelling || stoneHouse) {
        const ridge = height + w * 0.46;
        box(part, 1, 2.4, 0.9, -l * 0.25, ridge + 0.7, 0, brick);
        box(part, 1.18, 0.15, 1.08, -l * 0.25, ridge + 1.97, 0, brick);
        for (const offset of [-0.23, 0.23]) box(part, 0.22, 0.04, 0.28, -l * 0.25 + offset, ridge + 2.06, 0, dark);
        group.userData.chimneys++;
      }
      group.add(part);
    }
    for (const [x, y, length, width, angle, height, fall] of building.projections ?? []) {
      const part = new THREE.Group();
      const [wx, wz] = mapPoint(x, y);
      part.position.set(wx, 0, wz);
      part.rotation.y = (-angle * Math.PI) / 180;
      const l = length * MAP.scale;
      const w = width * MAP.scale;
      const wallMaterial = building.architecture === 'tudor' ? plaster : building.architecture ? stone : timber;
      foundation(part, l, w, true, wallMaterial);
      const top = (z: number) => height - 0.35 * (1 + (fall * z) / (w / 2));
      const profile = new THREE.Shape();
      profile.moveTo(-w / 2, 0);
      profile.lineTo(w / 2, 0);
      profile.lineTo(w / 2, top(-w / 2));
      profile.lineTo(-w / 2, top(w / 2));
      profile.closePath();
      const walls = new THREE.ExtrudeGeometry(profile, { depth: l, bevelEnabled: false });
      walls.rotateY(Math.PI / 2);
      walls.translate(-l / 2, 0, 0);
      const shell = new THREE.Mesh(walls, wallMaterial);
      shell.castShadow = shell.receiveShadow = true;
      part.add(shell);
      const pitch = Math.atan(0.7 / w) * fall;
      const coveringMesh = box(
        part,
        l + 0.3,
        covering === thatch ? 0.45 : 0.16,
        (w + 0.3) / Math.cos(pitch),
        0,
        height - 0.35,
        0,
        covering
      );
      coveringMesh.rotation.x = pitch;
      if (dwelling) {
        const face = (fall * w) / 2 + fall * 0.08;
        const doorHeight = Math.min(2, height - 0.8);
        box(part, 1.15, doorHeight + 0.15, 0.12, 0, (doorHeight + 0.15) / 2, face, whiteboard);
        box(part, 0.95, doorHeight, 0.14, 0, doorHeight / 2, face + fall * 0.06, frameMaterial);
      }
      group.add(part);
      group.userData.projections.push({
        outline: [x, y, length, width, angle],
        roof: 'inferred lean-to',
        covering: covering === thatch ? 'thatch' : 'tile'
      });
    }
    structures.add(group);
    selectable.push(group);
  }

  const church = new THREE.Group();
  church.userData.place = 'church';
  church.userData.architecture = 'stone-and-boarded-turret';
  const [churchX, churchZ] = mapPoint(...CHURCH_PLAN.centre);
  church.position.set(churchX, 0, churchZ);
  church.rotation.y = (-CHURCH_PLAN.angle * Math.PI) / 180;
  church.scale.z = CHURCH_PLAN.widthScale;
  const churchFoundation = foundation(church, 22, 12, false);
  box(church, 11.5, churchFoundation, 7.2, 0, -churchFoundation / 2, 0, stone);
  box(church, 5.2, churchFoundation, 6, 8.1, -churchFoundation / 2, 0, stone);
  box(church, 3.3, churchFoundation, 3.1, -0.5, -churchFoundation / 2, CHURCH_PORCH_SIDE * 5, stone);
  const nave = gable(church, 11.5, 7.2, 6.1, stone, 4.7, roof, true);
  const westWindow = box(church, 0.08, 2.7, 1.1, -5.8, 3.8, 0, dark);
  box(church, 0.1, 2.7, 0.08, -5.86, 3.8, 0, whiteboard);
  box(church, 0.1, 0.08, 1.1, -5.86, 3.8, 0, whiteboard);
  const chancel = new THREE.Group();
  chancel.position.x = 8.1;
  const chancelParts = gable(chancel, 5.2, 6, 5, stone, 3.8);
  const damagedChancelRoof = distressedChancel(chancel, chancelParts.roofMesh);
  const eastWindow = new THREE.Group();
  eastWindow.position.x = 2.64;
  box(eastWindow, 0.1, 2.8, 1.8, 0, 3.2, 0, whiteboard);
  box(eastWindow, 0.1, 2.5, 1.5, 0.06, 3.2, 0, dark);
  box(eastWindow, 0.12, 2.5, 0.1, 0.12, 3.2, 0, whiteboard);
  box(eastWindow, 0.12, 0.1, 1.5, 0.12, 3.2, 0, whiteboard);
  chancel.add(eastWindow);
  church.add(chancel);
  const porch = new THREE.Group();
  porch.position.set(-0.5, 0, CHURCH_PORCH_SIDE * 5);
  porch.rotation.y = (CHURCH_PORCH_SIDE * Math.PI) / 2;
  gable(porch, 3.1, 3.3, 3.3, stone, 2.4);
  const arch = new THREE.Shape();
  arch.moveTo(-0.85, 0);
  arch.lineTo(0.85, 0);
  arch.lineTo(0.85, 2.2);
  arch.quadraticCurveTo(0.45, 2.9, 0, 3.2);
  arch.quadraticCurveTo(-0.45, 2.9, -0.85, 2.2);
  arch.closePath();
  const door = new THREE.Mesh(new THREE.ShapeGeometry(arch), dark);
  door.rotation.y = -Math.PI / 2;
  door.position.x = -1.57;
  porch.add(door);
  church.add(porch);
  const blockedDoorway = new THREE.Group();
  blockedDoorway.position.set(-0.5, 0.05, -CHURCH_PORCH_SIDE * 3.62);
  if (CHURCH_PORCH_SIDE > 0) blockedDoorway.rotation.y = Math.PI;
  const blockedSurround = new THREE.Mesh(door.geometry, whiteboard);
  blockedSurround.scale.set(1.16, 1.05, 1);
  blockedDoorway.add(blockedSurround);
  const blockedInfillGeometry = door.geometry.clone();
  const { position: infillPosition, uv: infillUV } = blockedInfillGeometry.attributes;
  for (let i = 0; i < infillPosition.count; i++) {
    infillUV.setXY(
      i,
      (infillPosition.getX(i) - CHURCH_PORCH_SIDE * blockedDoorway.position.x + 11.5 / 2) / 11.5,
      (infillPosition.getY(i) + blockedDoorway.position.y) / 6.1
    );
  }
  const blockedInfill = new THREE.Mesh(blockedInfillGeometry, stone);
  blockedInfill.position.z = 0.02;
  blockedDoorway.add(blockedInfill);
  church.add(blockedDoorway);
  const turret = new THREE.Group();
  turret.position.set(-2.4, 8.5, 0);
  box(turret, 3.8, 5.8, 4, 0, 2.9, 0, whiteboard);
  for (let i = 0; i < 20; i++) {
    box(turret, 3.85, 0.045, 4.04, 0, i * 0.29 + 0.15, 0, material(0xaaa99b));
  }
  for (const side of [-1, 1]) {
    box(turret, 1.2, 1.5, 0.07, 0, 4.2, side * 2.04, dark);
    for (let i = 0; i < 7; i++) box(turret, 1.22, 0.06, 0.1, 0, 3.6 + i * 0.19, side * 2.09, whiteboard);
    box(turret, 0.07, 1.5, 1.2, side * 1.94, 4.2, 0, dark);
  }
  const turretCap = new THREE.Group();
  turretCap.position.y = 5.8;
  gable(turretCap, 4, 4.2, 0.1, whiteboard, 0.85);
  turret.add(turretCap);
  church.add(turret);
  for (const x of [-3.8, 3.8, 8.1]) {
    for (const side of [-1, 1]) {
      const z = side * (x > 6 ? 3.04 : 3.64);
      box(church, 0.65, 2.2, 0.07, x, 3.3, z, dark);
      box(church, 0.08, 2.2, 0.12, x, 3.3, z + side * 0.04, whiteboard);
    }
  }
  for (const x of [-5.2, 2.7, 5.2]) {
    for (const side of [-1, 1]) box(church, 0.55, 4.5, 0.8, x, 2.25, side * 3.65, stone);
  }
  structures.add(church);
  selectable.push(church);

  // Positions were cleared of roads, the cart route and ponds when assets/ilmer-placed-trees.json was built.
  const { trees: mappedTrees, excluded: excludedTrees } = placed;
  const { geometry: treeCrown, leavesPerCrown } = createTreeCrown();
  const treeSize = (tree: PlacedTree) => (tree.orchard ? 3.5 : 5.5 + (tree.renderIndex % 3) * 0.5);
  const treeTrunks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), trunkMaterial, mappedTrees.length);
  const treeCrowns = leafMaterials.map(
    (mat, index) =>
      new THREE.InstancedMesh(
        treeCrown,
        mat,
        mappedTrees.filter((tree: PlacedTree) => !tree.conifer && tree.renderIndex % leafMaterials.length === index)
          .length
      )
  );
  const coniferCrowns = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1, 1, 8),
    material(0x34582b, { transparent: true, opacity: 0.38, depthWrite: false }),
    mappedTrees.filter((tree: PlacedTree) => tree.conifer).length
  );
  const treeTransform = new THREE.Object3D();
  const crownCounts = leafMaterials.map(() => 0);
  let coniferCount = 0;
  let maxTreeGroundingError = 0;
  mappedTrees.forEach((tree: PlacedTree, index: number) => {
    const { x, y, conifer, renderIndex } = tree;
    const [wx, wz] = mapPoint(x, y);
    const groundY = groundHeight(wx, wz);
    const size = treeSize(tree);
    treeTransform.position.set(wx, groundY + size * 0.25, wz);
    treeTransform.scale.set(0.35, size * 0.5, 0.35);
    treeTransform.updateMatrix();
    treeTrunks.setMatrixAt(index, treeTransform.matrix);
    const matrix = treeTrunks.instanceMatrix.array;
    maxTreeGroundingError = Math.max(
      maxTreeGroundingError,
      Math.abs(matrix[index * 16 + 13] - matrix[index * 16 + 5] / 2 - groundY)
    );
    treeTransform.position.y = groundY + size * 0.72;
    treeTransform.scale.set(size * 0.4, size * 0.38, size * 0.4);
    treeTransform.updateMatrix();
    if (conifer) {
      treeTransform.scale.set(size * 0.3, size * 0.85, size * 0.3);
      treeTransform.updateMatrix();
      coniferCrowns.setMatrixAt(coniferCount++, treeTransform.matrix);
    } else {
      const colour = renderIndex % leafMaterials.length;
      treeCrowns[colour].setMatrixAt(crownCounts[colour]++, treeTransform.matrix);
    }
  });
  for (const mesh of [treeTrunks, ...treeCrowns, coniferCrowns]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    landscape.add(mesh);
  }
  const hedgeVertices: number[] = [];
  let maxHedgeAlignmentError = 0;
  const mappedRoadPolygons = roadPolygons.map((polygon) => polygon.map(([x, y]) => mapPoint(x, y)));
  const hedgeFootprints = buildings.flatMap((building) => [...building.parts, ...(building.projections ?? [])]);
  const hedgeLine = (a: readonly number[], b: readonly number[]) => {
    const [ax, az] = mapPoint(a[0], a[1]);
    const [bx, bz] = mapPoint(b[0], b[1]);
    const length = Math.hypot(bx - ax, bz - az);
    if (length < 1e-8) return;
    const pieces = Math.ceil(length / 0.6);
    const nx = (-(bz - az) / length) * 0.32;
    const nz = ((bx - ax) / length) * 0.32;
    for (let j = 0; j < pieces; j++) {
      const mx = ax + ((bx - ax) * (j + 0.5)) / pieces;
      const mz = az + ((bz - az) * (j + 0.5)) / pieces;
      const onBuilding = hedgeFootprints.some(([cx, cy, length, width, angle]) => {
        const [x, z] = mapPoint(cx, cy);
        const rotation = (angle * Math.PI) / 180;
        const u = (mx - x) * Math.cos(rotation) + (mz - z) * Math.sin(rotation);
        const v = -(mx - x) * Math.sin(rotation) + (mz - z) * Math.cos(rotation);
        return Math.abs(u) < (length * MAP.scale) / 2 + 0.2 && Math.abs(v) < (width * MAP.scale) / 2 + 0.2;
      });
      if (
        onBuilding ||
        mappedRoadPolygons.some((polygon) => withinField(polygon, mx, mz, 0.2)) ||
        pondPolygons.some((polygon) => withinField(polygon, mx, mz))
      )
        continue;
      const points = [j / pieces, (j + 1) / pieces].flatMap((t) => {
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        maxHedgeAlignmentError = Math.max(
          maxHedgeAlignmentError,
          Math.abs((x - ax) * (bz - az) - (z - az) * (bx - ax)) / length
        );
        return [-1, 1].flatMap((side) => {
          const px = Math.max(-terrain.width / 2, Math.min(terrain.width / 2, x + side * nx));
          const pz = Math.max(-terrain.depth / 2, Math.min(terrain.depth / 2, z + side * nz));
          const y = groundHeight(px, pz);
          return [
            [px, y - 0.05, pz],
            [px, y + 1, pz]
          ];
        });
      });
      for (const [a, b, c, d] of [
        [0, 4, 5, 1],
        [2, 3, 7, 6],
        [1, 5, 7, 3],
        [0, 1, 3, 2],
        [4, 6, 7, 5]
      ]) {
        for (const index of [a, c, b, a, d, c]) hedgeVertices.push(...points[index]);
      }
    }
  };
  for (const boundary of fieldBoundaries) {
    for (let i = 1; i < boundary.length; i++) {
      hedgeLine(boundary[i - 1], boundary[i]);
    }
  }

  const hedgeGeometry = new THREE.BufferGeometry();
  hedgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(hedgeVertices, 3));
  hedgeGeometry.computeVertexNormals();
  const hedgeMesh = new THREE.Mesh(hedgeGeometry, hedgeMaterial);
  hedgeMesh.castShadow = true;
  hedgeMesh.receiveShadow = true;
  landscape.add(hedgeMesh);
  // Fingerposts at the two ends of the village road: east past Lower Farm to Longwick, west to Towersey
  const signposts = SIGNPOSTS.map(({ id, end, text }) => {
    const [endDistance, inwardDistance] = end === 'east' ? [rideLength - 3, rideLength - 9] : [3, 9];
    const { x, z, heading } = signpostPlacement(
      ridePoint(endDistance),
      ridePoint(inwardDistance),
      (px: number, pz: number) => mappedRoadPolygons.some((polygon) => withinField(polygon, px, pz, 0.3))
    );
    const post = createFingerpost(text);
    post.name = `signpost-${id}`;
    post.position.set(x, groundHeight(x, z) - 0.05, z);
    post.rotation.y = -heading;
    structures.add(post);
    return { id, text, position: [x, z], heading };
  });

  const fieldObstacles = new Map(
    livestockFields.map((field) => {
      const points = field.outline.map(([x, y]) => mapPoint(x, y));
      const xs = points.map(([x]) => x),
        zs = points.map(([, z]) => z);
      const minX = Math.min(...xs) - 2,
        maxX = Math.max(...xs) + 2;
      const minZ = Math.min(...zs) - 2,
        maxZ = Math.max(...zs) + 2;
      return [
        field.id,
        roadTriangles.filter(
          (triangle) =>
            Math.max(...triangle.map(([x]) => x)) >= minX &&
            Math.min(...triangle.map(([x]) => x)) <= maxX &&
            Math.max(...triangle.map(([, z]) => z)) >= minZ &&
            Math.min(...triangle.map(([, z]) => z)) <= maxZ
        )
      ];
    })
  );
  const buildingBounds = selectable.map((group) => new THREE.Box3().setFromObject(group));
  const treeCentres: [number, number][] = mappedTrees.map(({ x, y }: PlacedTree) => mapPoint(x, y));
  const animalBlocked = (x: number, z: number, radius: number, field: string) =>
    circleOverlapsTriangles(x, z, radius, fieldObstacles.get(field) ?? []) ||
    buildingBounds.some(
      (bounds) =>
        x > bounds.min.x - radius && x < bounds.max.x + radius && z > bounds.min.z - radius && z < bounds.max.z + radius
    ) ||
    pondPolygons.some(
      (polygon, index) => !(field === 'cross-road-ducks' && index === 0) && withinField(polygon, x, z)
    ) ||
    treeCentres.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < radius + 0.3);
  const herds = createLivestock(animalBlocked);
  const livestock = new THREE.Group();
  scene.add(livestock);
  const wool = material(0xdcd6bd);
  const animalDark = material(0x484238);
  const feathers = material(0xffffff);
  const comb = material(0xac3528);
  const beak = material(0xc99735);
  const animalSphere = new THREE.IcosahedronGeometry(1, 1);
  const animalCube = new THREE.BoxGeometry(1, 1, 1);
  const animalCone = new THREE.ConeGeometry(1, 1, 5);
  const animalBatches: AnimalBatch[] = [];
  function animalPart(
    species: string,
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    position: [number, number, number],
    scale: [number, number, number],
    motion = 'body',
    rotation = 0
  ) {
    const animals = herds.filter((herd) => herd.species === species).flatMap((herd) => herd.animals);
    const mesh = new THREE.InstancedMesh(geometry, mat, animals.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Moving animals stay out of the frozen shadow map; they still receive the trees' and buildings' shadows.
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    if (mat === feathers) {
      const palette = [0xc3a17b, 0x9c633c, 0xe9dfbd, 0x8c704e];
      animals.forEach((_, index) => mesh.setColorAt(index, new THREE.Color(palette[index % palette.length])));
    }
    livestock.add(mesh);
    animalBatches.push({ species, animals, mesh, position, scale, motion, rotation });
  }
  for (const z of [-0.35, 0, 0.35]) animalPart('sheep', animalSphere, wool, [0, 0.91, z], [0.52, 0.49, 0.6]);
  animalPart('sheep', animalSphere, animalDark, [0, 1.12, 0.86], [0.23, 0.26, 0.32], 'head');
  animalPart('sheep', animalSphere, wool, [0, 1.33, 0.77], [0.25, 0.15, 0.23], 'head');
  for (const side of [-1, 1]) {
    animalPart('sheep', animalSphere, animalDark, [side * 0.31, 1.19, 0.85], [0.18, 0.07, 0.1], 'head');
    animalPart('sheep', animalSphere, wool, [side * 0.21, 1.2, 1], [0.035, 0.035, 0.035], 'head');
    for (const z of [-0.43, 0.43])
      animalPart('sheep', animalCube, animalDark, [side * 0.3, 0.3, z], [0.12, 0.6, 0.12], 'leg');
  }
  animalPart('sheep', animalSphere, wool, [0, 0.86, -0.91], [0.12, 0.23, 0.13]);
  animalPart('chicken', animalSphere, feathers, [0, 0.43, 0], [0.28, 0.29, 0.4]);
  animalPart('chicken', animalSphere, feathers, [0, 0.69, 0.27], [0.14, 0.26, 0.17], 'head');
  animalPart('chicken', animalSphere, feathers, [0, 0.91, 0.36], [0.16, 0.17, 0.17], 'head');
  animalPart('chicken', animalCone, beak, [0, 0.89, 0.58], [0.07, 0.2, 0.07], 'head', Math.PI / 2);
  for (const z of [0.27, 0.36, 0.45])
    animalPart('chicken', animalSphere, comb, [0, 1.07, z], [0.055, 0.1, 0.07], 'head');
  animalPart('chicken', animalSphere, comb, [0, 0.77, 0.45], [0.06, 0.1, 0.06], 'head');
  for (const side of [-1, 1]) {
    animalPart('chicken', animalSphere, feathers, [side * 0.25, 0.45, -0.03], [0.07, 0.21, 0.3], 'wing');
    animalPart('chicken', animalSphere, animalDark, [side * 0.14, 0.95, 0.43], [0.025, 0.025, 0.025], 'head');
    animalPart('chicken', animalCube, beak, [side * 0.13, 0.13, 0], [0.035, 0.26, 0.035], 'leg');
    animalPart('chicken', animalCube, beak, [side * 0.13, 0.025, 0.07], [0.07, 0.04, 0.18], 'foot');
    animalPart('chicken', animalSphere, animalDark, [side * 0.07, 0.7, -0.4], [0.065, 0.31, 0.12], 'body', -0.6);
  }
  const duckFeathers = material(0x877862);
  const duckHead = material(0x315e45);
  animalPart('duck', animalSphere, duckFeathers, [0, 0.28, 0], [0.42, 0.3, 0.65]);
  animalPart('duck', animalSphere, wool, [0, 0.5, 0.38], [0.19, 0.12, 0.18], 'head');
  animalPart('duck', animalSphere, duckHead, [0, 0.72, 0.48], [0.22, 0.26, 0.23], 'head');
  animalPart('duck', animalCube, beak, [0, 0.67, 0.76], [0.24, 0.08, 0.32], 'head');
  animalPart('duck', animalSphere, animalDark, [0, 0.4, -0.6], [0.2, 0.12, 0.3]);
  for (const side of [-1, 1]) {
    animalPart('duck', animalSphere, animalDark, [side * 0.39, 0.32, -0.08], [0.08, 0.18, 0.43], 'wing');
    animalPart('duck', animalSphere, animalDark, [side * 0.2, 0.79, 0.56], [0.025, 0.025, 0.025], 'head');
  }
  const animalRoot = new THREE.Object3D();
  const animalPose = new THREE.Object3D();
  const animalMatrix = new THREE.Matrix4();
  function updateAnimalMeshes() {
    for (const batch of animalBatches) {
      batch.animals.forEach((animal: AnimalState, index: number) => {
        const sheep = batch.species === 'sheep';
        const walking = animal.mode === 'walking';
        const bob = Math.sin(animal.phase);
        const feeding = !walking ? (sheep ? 0.85 + bob * 0.06 : (1 + bob) * 0.5) : 0;
        const [x, y, z] = batch.position;
        animalRoot.position.set(
          animal.x,
          groundHeight(animal.x, animal.z) + (batch.species === 'duck' ? 0.08 : 0),
          animal.z
        );
        animalRoot.rotation.set(0, animal.heading, 0);
        animalRoot.updateMatrix();
        animalPose.position.set(x, y, z);
        animalPose.rotation.set(batch.rotation, 0, 0);
        animalPose.scale.set(...batch.scale);
        if (batch.motion === 'head') {
          animalPose.position.y -= feeding * (sheep ? 0.8 : 0.58);
          animalPose.position.z += feeding * 0.12;
          animalPose.rotation.x += feeding * 0.45;
          const wx = animal.x + x * Math.cos(animal.heading) + animalPose.position.z * Math.sin(animal.heading);
          const wz = animal.z - x * Math.sin(animal.heading) + animalPose.position.z * Math.cos(animal.heading);
          const extent = Math.hypot(
            batch.scale[1] * Math.cos(animalPose.rotation.x),
            batch.scale[2] * Math.sin(animalPose.rotation.x)
          );
          animalPose.position.y = Math.max(
            animalPose.position.y,
            groundHeight(wx, wz) - animalRoot.position.y + extent + 0.02
          );
        } else if (batch.motion === 'leg' || batch.motion === 'foot') {
          const stride = walking ? Math.sin(animal.phase + ((sheep ? x * z > 0 : x > 0) ? Math.PI : 0)) : 0;
          const wx = animal.x + x * Math.cos(animal.heading) + z * Math.sin(animal.heading);
          const wz = animal.z - x * Math.sin(animal.heading) + z * Math.cos(animal.heading);
          animalPose.position.y += groundHeight(wx, wz) - animalRoot.position.y + Math.max(0, stride) * 0.1;
          animalPose.rotation.x = stride * 0.35;
          const bottomExtent =
            (batch.scale[1] * Math.abs(Math.cos(animalPose.rotation.x)) +
              batch.scale[2] * Math.abs(Math.sin(animalPose.rotation.x))) /
            2;
          animalPose.position.y += Math.max(0, bottomExtent - y);
        } else if (batch.motion === 'wing') animalPose.rotation.z = Math.sin(animal.phase * 0.4) * 0.08;
        animalPose.updateMatrix();
        animalMatrix.multiplyMatrices(animalRoot.matrix, animalPose.matrix);
        batch.mesh.setMatrixAt(index, animalMatrix);
      });
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  updateAnimalMeshes();

  function label(text: string, x: number, y: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas2d(canvas);
    ctx.fillStyle = '#f7f4e7';
    ctx.fillRect(0, 0, 512, 96);
    ctx.strokeStyle = '#c5c5a9';
    ctx.strokeRect(2, 2, 508, 92);
    ctx.font = '48px Georgia';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#344938';
    ctx.fillText(text, 256, 60, 480);
    const sprite = new THREE.Sprite(
      // Labels keep their own colours, unaffected by the haze and filmic grading
      Object.assign(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, depthWrite: false }),
        {
          fog: false,
          toneMapped: false
        }
      )
    );
    sprite.renderOrder = 1000;
    const [wx, wz] = mapPoint(x, y);
    sprite.position.set(wx, groundHeight(wx, wz) + 19, wz);
    sprite.scale.set(39, 7.3, 1);
    labels.add(sprite);
    return sprite;
  }
  label("St Peter's", 960, 478);
  label('Upper Farm barns', 747, 690);
  label('Middle Farm', 1175, 622);
  label('Lower Farm', 1460, 645);
  label('Two Cottages & Gardens', 750, 165);
  label('Three Tenements & Gardens', 970, 296);
  label('Old Vicarage', 1037, 552);

  const mapTexture = await new THREE.TextureLoader().loadAsync('/images/ilmer-1839/tithe-map.avif');
  mapTexture.colorSpace = THREE.SRGBColorSpace;
  const mapGeometry = groundGeometry.clone();
  for (let i = 0; i < mapGeometry.attributes.position.count; i++) {
    mapGeometry.attributes.position.setY(i, mapGeometry.attributes.position.getY(i) + 0.2);
  }
  const mapPlane = new THREE.Mesh(mapGeometry, new THREE.MeshBasicMaterial({ map: mapTexture }));
  mapPlane.visible = false;
  mapPlane.receiveShadow = true;
  scene.add(mapPlane);

  const { cart, horse, driver, update: animateHorseAndCart, reinPoints } = createHorseAndCart({ timber });
  scene.add(cart, horse);
  cart.visible = horse.visible = false;
  const reinsGeometry = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 4 }, () => new THREE.Vector3()));
  const reins = new THREE.LineSegments(reinsGeometry, new THREE.LineBasicMaterial({ color: 0x392a22 }));
  scene.add(reins);
  reins.visible = false;
  const rideButton = document.getElementById('ride-pause') as HTMLButtonElement;
  const rideStatus = document.getElementById('ride-status')!;
  // Village sounds, like the church's organ: they start with your first click, tap or key press (browsers
  // block sound until then) and the speaker button mutes them. Each comes from its source and grows louder
  // as the camera nears it.
  const villageAudio = createVillageAudio();
  const soundButton = document.getElementById('btn-sound')!;
  const soundOnIcon = soundButton.querySelector('[data-icon="sound-on"]')!;
  const soundOffIcon = soundButton.querySelector('[data-icon="sound-off"]')!;
  function setSoundMuted(isMuted: boolean) {
    villageAudio.setMuted(isMuted);
    soundButton.setAttribute('aria-pressed', String(isMuted));
    const label = isMuted ? 'Unmute village sounds' : 'Mute village sounds';
    soundButton.setAttribute('aria-label', label);
    soundButton.title = `${label} (V)`;
    soundOnIcon.toggleAttribute('hidden', isMuted);
    soundOffIcon.toggleAttribute('hidden', !isMuted);
  }
  function toggleSound() {
    // If the browser held sound back until this click, start it rather than muting it
    if (!villageAudio.isMuted() && !villageAudio.isRunning()) {
      setSoundMuted(false);
      void villageAudio.start();
      return;
    }
    setSoundMuted(!villageAudio.isMuted());
  }
  soundButton.addEventListener('click', toggleSound);
  const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'click', 'keydown', 'wheel', 'touchstart'];
  function removeUnlockListeners() {
    for (const type of UNLOCK_EVENTS) window.removeEventListener(type, unlockVillageAudio, true);
  }
  function unlockVillageAudio(event: Event) {
    if (villageAudio.isMuted() || villageAudio.isRunning()) {
      removeUnlockListeners();
      return;
    }
    if (event?.target instanceof Node && soundButton.contains(event.target)) return;
    void villageAudio.start().then((ok) => ok && removeUnlockListeners());
  }
  for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlockVillageAudio, { capture: true, passive: true });
  void villageAudio.start().then((ok) => ok && removeUnlockListeners());
  const listenerRight = new THREE.Vector3();
  function updateVillageAudio() {
    listenerRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const emitters = herds.map((herd): Emitter => {
      const x = herd.animals.reduce((sum, animal) => sum + animal.x, 0) / herd.animals.length;
      const z = herd.animals.reduce((sum, animal) => sum + animal.z, 0) / herd.animals.length;
      return { id: herd.id, kind: herd.species, position: [x, groundHeight(x, z) + 0.5, z] };
    });
    // The horse and cart are heard only while they are moving
    if (riding && cart.visible)
      emitters.push({
        id: 'cart',
        kind: 'cart',
        position: [
          (cart.position.x + horse.position.x) / 2,
          cart.position.y + 1,
          (cart.position.z + horse.position.z) / 2
        ]
      });
    villageAudio.update({ position: camera.position.toArray(), right: listenerRight.toArray() }, emitters);
  }
  const RIDE_CHASE_BEHIND = 7.5;
  const RIDE_CHASE_HEIGHT = 4.4;
  const RIDE_CHASE_AHEAD = 2.2;
  const RIDE_CHASE_SIDE = 1.1;
  let riding = false;
  let rideMode = 'village';
  let rideState = 'idle';
  let rideDistance = rideStart;
  let rideFrame = 0;
  let ridePreviousTime: number | null = null;
  function seatOnRoad(group: THREE.Object3D, distance: number) {
    const [x, z] = rideCircuitPoint(distance);
    const [ax, az] = rideCircuitPoint(distance - 0.1);
    const [bx, bz] = rideCircuitPoint(distance + 0.1);
    group.position.set(x, groundHeight(x, z), z);
    group.rotation.set(
      Math.atan2(groundHeight(bx, bz) - groundHeight(ax, az), Math.hypot(bx - ax, bz - az)),
      Math.atan2(ax - bx, az - bz),
      0,
      'YXZ'
    );
    group.updateMatrixWorld(true);
  }
  function positionRide() {
    seatOnRoad(cart, rideDistance);
    seatOnRoad(horse, rideDistance + HORSE_OFFSET);
    if (rideMode === 'rider') {
      // Follow a few paces behind along the road and a little to the right, high enough to see the carter,
      // the cart and the horse ahead of him
      const [cx, cz] = rideCircuitPoint(rideDistance - RIDE_CHASE_BEHIND);
      const [px, pz] = rideCircuitPoint(rideDistance - RIDE_CHASE_BEHIND - 0.5);
      const along = Math.hypot(cx - px, cz - pz) || 1;
      const sx = cx - ((cz - pz) / along) * RIDE_CHASE_SIDE;
      const sz = cz + ((cx - px) / along) * RIDE_CHASE_SIDE;
      camera.position.set(sx, Math.max(groundHeight(sx, sz), cart.position.y) + RIDE_CHASE_HEIGHT, sz);
      const [x, z] = rideCircuitPoint(rideDistance + RIDE_CHASE_AHEAD);
      controls.target.set(x, groundHeight(x, z) + 0.9, z);
      camera.lookAt(controls.target);
    }
    animateHorseAndCart(rideDistance);
    horse.updateMatrixWorld(true);
    reinsGeometry.setFromPoints(reinPoints());
  }
  function pauseRide() {
    riding = false;
    rideState = 'paused';
    cancelAnimationFrame(rideFrame);
    ridePreviousTime = null;
    controls.enabled = navigationMode === 'orbit';
    rideButton.textContent = 'Resume cart journey';
    rideButton.setAttribute('aria-pressed', 'false');
    rideStatus.textContent = 'Journey paused. Choose a view or press Escape to leave.';
  }
  function stopRide() {
    riding = false;
    rideState = 'idle';
    cancelAnimationFrame(rideFrame);
    ridePreviousTime = null;
    controls.enabled = navigationMode === 'orbit';
    cart.visible = horse.visible = reins.visible = false;
    rideButton.hidden = true;
    rideButton.textContent = 'Pause cart journey';
    rideButton.setAttribute('aria-pressed', 'false');
    rideStatus.textContent = '';
  }
  function advanceRide(time: number) {
    if (!riding) return;
    if (ridePreviousTime !== null)
      rideDistance = (rideDistance + Math.min((time - ridePreviousTime) / 1000, 0.15) * rideSpeed) % rideCircuitLength;
    ridePreviousTime = time;
    positionRide();
    if (!flying && !viewTransition) render();
    rideFrame = requestAnimationFrame(advanceRide);
  }
  rideButton.disabled = false;
  function startCartRide() {
    stopViewFlight();
    stopFlight();
    if (riding && rideMode === 'rider') {
      pauseRide();
      return;
    }
    cancelAnimationFrame(rideFrame);
    if (rideMode !== 'village' && rideState !== 'paused') rideDistance = 0;
    rideMode = 'rider';
    riding = true;
    rideState = 'riding';
    ridePreviousTime = null;
    controls.enabled = false;
    cart.visible = horse.visible = reins.visible = driver.visible = true;
    labels.visible = false;
    setMapLayer(false);
    selected = null;
    host.setAttribute('aria-label', 'Riding through Ilmer on a horse and cart');
    for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', 'false');
    setPresetsExpanded(false);
    rideButton.hidden = false;
    rideButton.textContent = 'Pause cart journey';
    rideButton.setAttribute('aria-pressed', 'true');
    rideStatus.textContent = '';
    positionRide();
    render();
    rideFrame = requestAnimationFrame(advanceRide);
  }
  rideButton.addEventListener('click', startCartRide);
  document.addEventListener('visibilitychange', () => {
    villageAudio.setHidden(document.hidden);
    if (document.hidden && flying) pauseFlight();
    if (rideMode === 'village') {
      if (document.hidden) {
        cancelAnimationFrame(rideFrame);
        riding = false;
      } else startVillageCart();
    } else if (document.hidden && riding) pauseRide();
  });
  function startVillageCart() {
    cancelAnimationFrame(rideFrame);
    rideMode = 'village';
    riding = true;
    rideState = 'touring';
    ridePreviousTime = null;
    cart.visible = horse.visible = reins.visible = driver.visible = true;
    positionRide();
    rideFrame = requestAnimationFrame(advanceRide);
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && (rideMode === 'rider' || flightState !== 'idle')) {
      setView('village');
      event.preventDefault();
    }
  });

  let selected: THREE.Object3D | null = null;
  function select(group: THREE.Object3D) {
    selected = group;
    const place = group.userData.place as keyof typeof places;
    host.setAttribute('aria-label', `Interactive 3D reconstruction of Ilmer. Selected: ${places[place].title}`);
  }
  const views = {
    village: { target: [0, 0, 48], position: [155, 185, 255] },
    church: { target: [churchX, 5, churchZ], position: [churchX + 32, 23, churchZ - 26], place: 'church' },
    west: { target: [churchX - 2, 7, churchZ], position: [churchX - 39, 21, churchZ - 14], place: 'church' },
    chancel: { target: [churchX + 8, 4, churchZ], position: [churchX + 29, 18, churchZ - 28], place: 'church' },
    barns: { target: [-68, 2, 62], position: [-30, 66, 137], place: 'barns' },
    middle: { target: [48, 5, 57], position: [77, 26, 104], place: 'middle' },
    vicarage: { target: [14.4, 3, 30.4], position: [45, 20, 50], place: 'vicarage' },
    lower: { target: [150, 4, 65], position: [166, 30, 117], place: 'lower' },
    cottages: { target: [-87, 3, -62], position: [-43, 40, -20], place: 'cottages' },
    tenements: { target: [-8, 3, -46], position: [30, 27, -10], place: 'tenements' },
    plan: { target: [0, 0, 0], position: [0, 490, 0.1] }
  };
  let activeView: keyof typeof views = 'village';
  let viewFrame = 0;
  let viewTransition: ViewFlight | null = null;
  function stopViewFlight() {
    cancelAnimationFrame(viewFrame);
    viewTransition = null;
  }
  function advanceViewFlight(time: number) {
    if (!viewTransition) return;
    const flight = viewTransition;
    if (flight.time !== null) flight.elapsed += Math.max(0, Math.min((time - flight.time) / 1000, 0.1));
    flight.time = time;
    const t = Math.min(1, flight.elapsed / flight.duration);
    const ease = t * t * (3 - 2 * t);
    camera.position.lerpVectors(flight.from, flight.to, ease);
    camera.position.y += Math.sin(Math.PI * ease) * flight.arc;
    controls.target.lerpVectors(flight.fromTarget, flight.toTarget, ease);
    for (const bounds of roofBounds) {
      if (
        camera.position.x >= bounds.min.x - 2 &&
        camera.position.x <= bounds.max.x + 2 &&
        camera.position.z >= bounds.min.z - 2 &&
        camera.position.z <= bounds.max.z + 2
      )
        camera.position.y = Math.max(camera.position.y, bounds.max.y + 2);
    }
    camera.lookAt(controls.target);
    render();
    if (t === 1) {
      viewTransition = null;
      controls.enabled = navigationMode === 'orbit';
      controls.update();
    } else viewFrame = requestAnimationFrame(advanceViewFlight);
  }
  const flightButton = document.getElementById('flight-toggle') as HTMLButtonElement;
  const flightStatus = document.getElementById('flight-status')!;
  const stops = flightStops();
  const flightPoints = stops.map((stop) => {
    const [x, y, z] = stop.position;
    const ground = groundHeight(stop.target[0], stop.target[2]);
    return new THREE.Vector3(x, ground + y, z);
  });
  const flightTargets = stops.map(
    (stop) =>
      new THREE.Vector3(stop.target[0], groundHeight(stop.target[0], stop.target[2]) + stop.target[1], stop.target[2])
  );
  const flightCurve = new THREE.CatmullRomCurve3(flightPoints, true, 'centripetal');
  const targetCurve = new THREE.CatmullRomCurve3(flightTargets, true, 'centripetal');
  const roofBounds = selectable.map((group) => new THREE.Box3().setFromObject(group));
  // The tour flies at a steady speed along the route's true length (arc length), not its uneven spline parameter.
  flightCurve.arcLengthDivisions = 4000;
  const flightLength = flightCurve.getLength();
  const stopDistances = (() => {
    const lengths = flightCurve.getLengths(4000);
    return stops.map((_, index) => lengths[Math.round((index / stops.length) * 4000)]);
  })();
  // Height the camera must climb along the route to clear roofs and ground, smoothed so it never jumps
  const clearanceSamples = 2400;
  const clearance = smoothClearance(
    Array.from({ length: clearanceSamples }, (_, i) => {
      const point = flightCurve.getPointAt(i / clearanceSamples);
      let floor = cameraFloor(terrain, point.x, point.z) + 1;
      for (const bounds of roofBounds) {
        if (
          point.x >= bounds.min.x - 3 &&
          point.x <= bounds.max.x + 3 &&
          point.z >= bounds.min.z - 3 &&
          point.z <= bounds.max.z + 3
        )
          floor = Math.max(floor, bounds.max.y + 2.5);
      }
      return Math.max(0, floor - point.y);
    }),
    Math.ceil((30 / flightLength) * clearanceSamples)
  );
  function flightPose(distance: number, position: THREE.Vector3, target: THREE.Vector3) {
    const u = (((distance % flightLength) + flightLength) % flightLength) / flightLength;
    flightCurve.getPointAt(u, position);
    const sample = u * clearanceSamples;
    const i = Math.floor(sample);
    const lift =
      clearance[i % clearanceSamples] * (1 - (sample - i)) + clearance[(i + 1) % clearanceSamples] * (sample - i);
    position.y += lift;
    targetCurve.getPoint(flightCurve.getUtoTmapping(u, 0), target);
  }
  let flying = false;
  let flightState = 'idle';
  let flightElapsed = 0;
  let flightTravel = { distance: 0, throttle: 0 };
  let flightBlend: FlightBlend | null = null;
  let flightTime: number | null = null;
  let flightFrame = 0;
  const flightPosition = new THREE.Vector3();
  const flightTarget = new THREE.Vector3();
  const visitedFlightStops = new Set<string>();
  function stopFlight() {
    cancelAnimationFrame(flightFrame);
    flying = false;
    flightState = 'idle';
    flightTime = null;
    flightBlend = null;
    controls.enabled = navigationMode === 'orbit';
    flightButton.textContent = 'Historic Tour';
    flightButton.setAttribute('aria-pressed', 'false');
    flightStatus.textContent = '';
  }
  function pauseFlight() {
    cancelAnimationFrame(flightFrame);
    flying = false;
    flightState = 'paused';
    flightTime = null;
    flightBlend = null;
    controls.enabled = navigationMode === 'orbit';
    flightButton.textContent = 'Resume Historic Tour';
    flightButton.setAttribute('aria-pressed', 'false');
    flightStatus.textContent = 'Flight paused. Resume, explore, or choose another view.';
  }
  function advanceFlight(time: number) {
    if (!flying) return;
    const seconds = flightTime === null ? 0 : Math.max(0, Math.min((time - flightTime) / 1000, 0.1));
    flightTime = time;
    flightElapsed += seconds;
    flightTravel = advanceFlightDistance(flightTravel, seconds);
    flightPose(flightTravel.distance, flightPosition, flightTarget);
    if (flightBlend) {
      // Glide from wherever the viewer was onto the moving route, as the church tour sets off from the current view
      flightBlend.elapsed += seconds;
      const weight = blendIn(flightBlend.elapsed, flightBlend.duration);
      flightPosition.lerpVectors(flightBlend.position, flightPosition, weight);
      flightTarget.lerpVectors(flightBlend.target, flightTarget, weight);
      if (weight === 1) flightBlend = null;
    }
    camera.position.copy(flightPosition);
    controls.target.copy(flightTarget);
    camera.lookAt(controls.target);
    const index = stopAtDistance(stopDistances, flightTravel.distance, flightLength);
    visitedFlightStops.add(stops[index].id);
    const upcoming = stops[(index + 1) % stops.length];
    const along = ((flightTravel.distance % flightLength) + flightLength) % flightLength;
    const nextDistance = index + 1 < stops.length ? stopDistances[index + 1] : flightLength;
    const current = nextDistance - along < (nextDistance - stopDistances[index]) / 2 ? upcoming : stops[index];
    const message = `Flying · ${current.title} · ${visitedFlightStops.size} of ${stops.length} buildings visited`;
    if (flightStatus.textContent !== message) flightStatus.textContent = message;
    render();
    flightFrame = requestAnimationFrame(advanceFlight);
  }
  flightButton.disabled = false;
  flightButton.addEventListener('click', toggleHistoricTour);
  function toggleHistoricTour() {
    stopViewFlight();
    if (flying) {
      pauseFlight();
      return;
    }
    if (rideMode === 'rider') {
      stopRide();
      startVillageCart();
    }
    if (flightState !== 'paused') {
      flightElapsed = 0;
      flightTravel = { distance: 0, throttle: 0 };
      visitedFlightStops.clear();
    }
    // Ease up to speed and glide onto the route from the current view, whether starting or resuming
    flightTravel = { distance: flightTravel.distance, throttle: 0 };
    flightPose(flightTravel.distance, flightPosition, flightTarget);
    flightBlend = {
      position: camera.position.clone(),
      target: controls.target.clone(),
      elapsed: 0,
      duration: Math.min(6, 2.5 + camera.position.distanceTo(flightPosition) / 80)
    };
    applyNavigationMode('orbit');
    flying = true;
    flightState = 'flying';
    flightTime = null;
    controls.enabled = false;
    labels.visible = false;
    selected = null;
    host.setAttribute('aria-label', 'Flying around every mapped property in Ilmer');
    for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', 'false');
    setPresetsExpanded(false);
    flightButton.textContent = 'Pause Historic Tour';
    flightButton.setAttribute('aria-pressed', 'true');
    advanceFlight(performance.now());
  }
  function setView(name: keyof typeof views, animate = true) {
    applyNavigationMode('orbit');
    movementKeys.clear();
    stopViewFlight();
    stopFlight();
    stopRide();
    rideMode = 'village';
    activeView = name;
    const view = views[name];
    labels.visible = !mapPlane.visible && !('place' in view && view.place);
    const targetY = groundHeight(view.target[0], view.target[2]);
    const destination = new THREE.Vector3(view.position[0], view.position[1] + targetY, view.position[2]);
    const target = new THREE.Vector3(view.target[0], view.target[1] + targetY, view.target[2]);
    if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const distance = camera.position.distanceTo(destination);
      viewTransition = {
        from: camera.position.clone(),
        to: destination,
        fromTarget: controls.target.clone(),
        toTarget: target,
        elapsed: 0,
        time: null,
        duration: Math.min(3, 1.2 + distance / 180),
        arc: Math.min(45, 5 + distance * 0.08)
      };
      controls.enabled = false;
      viewFrame = requestAnimationFrame(advanceViewFlight);
    } else {
      controls.target.copy(target);
      camera.position.copy(destination);
      controls.update();
    }
    for (const button of document.querySelectorAll('[data-view]')) {
      if (!(button instanceof HTMLElement)) continue;
      button.setAttribute('aria-pressed', String(button.dataset.view === name));
    }
    setPresetsExpanded(false);
    if ('place' in view && view.place) select(selectable.find((group) => group.userData.place === view.place)!);
    else {
      selected = null;
      host.setAttribute('aria-label', 'Interactive 3D reconstruction of Ilmer');
    }
    startVillageCart();
    render();
  }
  function render() {
    const floor = cameraFloor(terrain, camera.position.x, camera.position.z);
    if (camera.position.y < floor) {
      camera.position.y = floor;
      camera.lookAt(controls.target);
    }
    for (const sprite of labels.children) {
      const pixelScale =
        (2 * camera.position.distanceTo(sprite.position) * Math.tan((camera.fov * Math.PI) / 360)) / host.clientHeight;
      sprite.scale.set(pixelScale * 144, pixelScale * 27, 1);
    }
    // AR shows the camera feed behind the buildings, so no sky or haze there
    const ar = document.body.classList.contains('ar-active');
    sky.mesh.visible = !ar;
    scene.fog = ar ? null : villageFog;
    sky.mesh.position.copy(camera.position);
    sky.material.uniforms.uTime.value = performance.now() / 1000;
    if (shadowsDirty) {
      renderer.shadowMap.needsUpdate = true;
      shadowsDirty = false;
    }
    renderer.render(scene, camera);
  }
  function freeFlightAvailable() {
    return (
      navigationMode === 'fly' && !viewTransition && !flying && rideMode !== 'rider' && host.dataset.state !== 'error'
    );
  }
  function rotateFreeCamera(yaw: number, pitch: number) {
    const direction = camera.getWorldDirection(new THREE.Vector3());
    const rotation = new THREE.Euler(
      Math.max(-1.5, Math.min(1.5, Math.asin(direction.y) + pitch)),
      Math.atan2(-direction.x, -direction.z) + yaw,
      0,
      'YXZ'
    );
    camera.quaternion.setFromEuler(rotation);
    controls.target.copy(camera.position).addScaledVector(camera.getWorldDirection(direction), 50);
  }
  function advanceFreeFlight(seconds: number) {
    const stickPush = Math.hypot(flyStick.x, flyStick.y);
    const stickActive = stickPush > 0.08;
    if (!freeFlightAvailable() || (!movementKeys.size && !stickActive)) return;
    const value = (positive: string, negative: string) =>
      Number(movementKeys.has(positive)) - Number(movementKeys.has(negative));
    rotateFreeCamera(value('arrowleft', 'arrowright') * seconds, value('arrowup', 'arrowdown') * seconds);
    const direction = camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(direction, camera.up).normalize();
    const forwardInput = value('w', 's') + (stickActive ? flyStick.y : 0);
    const sideInput = value('d', 'a') + (stickActive ? flyStick.x : 0);
    const movement = direction.multiplyScalar(forwardInput).addScaledVector(right, sideInput);
    movement.y += value('e', 'q');
    if (movement.lengthSq()) {
      // Keys fly at full pace; the joystick scales with how far it is pushed, quickening near the rim
      const throttle = movementKeys.size ? 1 : Math.min(1, stickPush) * (stickPush > 0.9 ? 1.6 : 1);
      movement.normalize().multiplyScalar(seconds * (movementKeys.has('shift') ? 50 : 22) * throttle);
      camera.position.add(movement);
      camera.position.x = Math.max(-terrain.width / 2 + 0.5, Math.min(terrain.width / 2 - 0.5, camera.position.x));
      camera.position.z = Math.max(-terrain.depth / 2 + 0.5, Math.min(terrain.depth / 2 - 0.5, camera.position.z));
      camera.position.y = Math.max(camera.position.y, cameraFloor(terrain, camera.position.x, camera.position.z));
      for (const bounds of roofBounds) {
        if (
          camera.position.x >= bounds.min.x - 1 &&
          camera.position.x <= bounds.max.x + 1 &&
          camera.position.z >= bounds.min.z - 1 &&
          camera.position.z <= bounds.max.z + 1
        )
          camera.position.y = Math.max(camera.position.y, bounds.max.y + cameraGroundClearance);
      }
      controls.target.copy(camera.position).addScaledVector(camera.getWorldDirection(new THREE.Vector3()), 50);
    }
  }
  // Updates the navigation mode and its overlay controls, like the church model's Orbit/Walk toggle
  function applyNavigationMode(mode: string) {
    if (mode !== navigationMode) movementKeys.clear();
    navigationMode = mode;
    const isFly = mode === 'fly';
    controls.enabled = !isFly;
    const modeButton = document.getElementById('btn-fly')!;
    modeButton.setAttribute('aria-pressed', String(isFly));
    modeButton.textContent = isFly ? 'Mode: Fly' : 'Mode: Orbit';
    document.getElementById('fly-hint')!.hidden = !isFly;
    // The thumb stick only shows on touch screens (see CSS); it flies where the camera looks, so tilting climbs
    document.getElementById('fly-joystick')!.hidden = !isFly;
    if (!isFly) flyStick.x = flyStick.y = 0;
  }
  function setNavigationMode(mode: string) {
    stopViewFlight();
    stopFlight();
    stopRide();
    rideMode = 'village';
    applyNavigationMode(mode);
    const currentView = views[activeView];
    labels.visible = !mapPlane.visible && !('place' in currentView && currentView.place);
    startVillageCart();
    render();
  }
  document.getElementById('btn-fly')!.addEventListener('click', () => {
    setNavigationMode(navigationMode === 'fly' ? 'orbit' : 'fly');
  });
  document.getElementById('fly-joystick')!.addEventListener('joystickmove', (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as { x: number; y: number };
    flyStick.x = detail.x;
    flyStick.y = detail.y;
  });
  window.addEventListener('keyup', (event) => movementKeys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => movementKeys.clear());
  host.addEventListener('blur', () => movementKeys.clear());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      movementKeys.clear();
      if (arSession) void stopAR();
    }
  });
  controls.addEventListener('change', render);
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  });
  resize.observe(host);
  for (const button of document.querySelectorAll('[data-view]')) {
    if (!(button instanceof HTMLElement)) continue;
    button.addEventListener('click', () => setView(button.dataset.view as keyof typeof views));
  }

  // On narrow screens the views collapse behind a "Views: …" toggle, as on the church model
  const presetBar = document.getElementById('preset-bar')!;
  const presetsToggleButton = document.getElementById('btn-presets-toggle')!;
  function setPresetsExpanded(expanded: boolean) {
    presetBar.classList.toggle('is-expanded', expanded);
    presetsToggleButton.setAttribute('aria-expanded', String(expanded));
    const active = presetBar.querySelector('[data-view][aria-pressed="true"]');
    presetsToggleButton.textContent = `Views: ${active ? active.textContent!.trim() : 'Select'} ${expanded ? '▴' : '▾'}`;
  }
  presetsToggleButton.addEventListener('click', () => setPresetsExpanded(!presetBar.classList.contains('is-expanded')));

  const mapButton = document.getElementById('map-layer')!;
  // On the original map the trees, hedges and other planting are hidden so the 1839 drawing shows through; the
  // buildings can be shown or hidden over it
  const mapBuildingsButton = document.getElementById('map-buildings')!;
  let mapBuildingsShown = true;
  function syncMapButton() {
    mapButton.setAttribute('aria-pressed', String(mapPlane.visible));
    mapBuildingsButton.hidden = !mapPlane.visible;
    mapBuildingsButton.setAttribute('aria-pressed', String(mapBuildingsShown));
    mapBuildingsButton.textContent = mapBuildingsShown ? 'Buildings: Shown' : 'Buildings: Hidden';
  }
  function setMapLayer(showMap: boolean) {
    mapPlane.visible = showMap;
    mappedGround.visible = !showMap;
    waterFeatures.visible = !showMap;
    landscape.visible = !showMap;
    structures.visible = !showMap || mapBuildingsShown;
    shadowsDirty = true;
    syncMapButton();
  }
  function toggleMapLayer() {
    const showMap = !mapPlane.visible;
    if (rideMode === 'rider' || flightState !== 'idle') setView(activeView);
    setMapLayer(showMap);
    const currentView = views[activeView];
    labels.visible = !mapPlane.visible && !('place' in currentView && currentView.place);
    render();
  }
  function toggleMapBuildings() {
    mapBuildingsShown = !mapBuildingsShown;
    setMapLayer(mapPlane.visible);
    render();
  }
  mapButton.addEventListener('click', toggleMapLayer);
  mapBuildingsButton.addEventListener('click', toggleMapBuildings);

  const fullscreenButton = document.getElementById('btn-fullscreen');
  const fullscreen = bindFullscreenToggle({
    button: fullscreenButton instanceof HTMLButtonElement ? fullscreenButton : null,
    stage: host.closest('.reconstruction-stage') || host,
    onChange: undefined
  });

  // Keyboard shortcuts work anywhere on the page, as on the church model
  function isEditableTarget(target: EventTarget | null) {
    return (
      target instanceof HTMLElement &&
      (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
    );
  }
  window.addEventListener('keydown', (event) => {
    if (isEditableTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (arSession || host.dataset.state === 'error') return;
    const key = event.key.toLowerCase();
    if (freeFlightAvailable() && flyKeys.has(key)) {
      movementKeys.add(key);
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (key === 'c') startCartRide();
    else if (key === 't') toggleHistoricTour();
    else if (key === 'f') setNavigationMode(navigationMode === 'fly' ? 'orbit' : 'fly');
    else if (key === 'm') toggleMapLayer();
    else if (key === 'v') toggleSound();
    else if (key === 'r') setView('village');
    else if (key === 'escape' && fullscreen.isPseudoFullscreen()) fullscreen.exit();
    else return;
    event.preventDefault();
  });
  const arStartButton = document.getElementById('ar-start') as HTMLButtonElement;
  const arStartStatus = document.getElementById('ar-start-status')!;
  const arOverlay = document.getElementById('ar-overlay')!;
  const arLiveStatus = document.getElementById('ar-live-status')!;
  if (window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === 'function' && navigator.geolocation) {
    const stopObservingCompass = observeCompassAvailability(window, () => {
      document.getElementById('ar-controls')!.hidden = false;
    });
    window.addEventListener('pagehide', stopObservingCompass, { once: true });
  }
  let arSession: ARSession | null = null;
  const deviceEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const deviceFix = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);
  const screenAxis = new THREE.Vector3(0, 0, 1);
  const screenFix = new THREE.Quaternion();

  function setARFeaturesVisible(visible: boolean) {
    if (
      landscape.visible !== false ||
      structures.visible !== visible ||
      livestock.visible !== visible ||
      waterFeatures.visible !== visible
    )
      shadowsDirty = true;
    landscape.visible = false;
    structures.visible = visible;
    livestock.visible = visible;
    waterFeatures.visible = visible;
  }

  function setARStatus(message: string) {
    arLiveStatus.textContent = message;
  }

  function handleAROrientation(event: DeviceOrientationEvent) {
    if (!arSession) return;
    const alpha = compassHeading(event);
    if (alpha === null) return;

    const radians = Math.PI / 180;
    const screenAngle = window.screen.orientation?.angle ?? 0;
    deviceEuler.set((event.beta ?? 0) * radians, alpha * radians, -(event.gamma ?? 0) * radians, 'YXZ');
    camera.quaternion
      .setFromEuler(deviceEuler)
      .multiply(deviceFix)
      .multiply(screenFix.setFromAxisAngle(screenAxis, (-screenAngle * Math.PI) / 180));
    controls.target.copy(camera.position).addScaledVector(camera.getWorldDirection(new THREE.Vector3()), 50);
    if (arSession.resolveOrientation) {
      clearTimeout(arSession.orientationTimeout as number);
      arSession.resolveOrientation();
      arSession.resolveOrientation = null;
      arSession.rejectOrientation = null;
    }
    arSession.orientationObserved = true;
    render();
  }

  function updateARLocation(position: GeolocationPosition) {
    if (!arSession) return;
    const { latitude, longitude, accuracy } = position.coords;
    if (!Number.isFinite(accuracy) || accuracy > 30) {
      setARFeaturesVisible(false);
      setARStatus(`Waiting for GPS accuracy within 30 metres (current accuracy: ±${Math.round(accuracy)} m).`);
      return;
    }
    const pixel = gpsToMapPixel(geoReference, latitude, longitude);
    if (pixel.x < 0 || pixel.x > MAP.width || pixel.y < 0 || pixel.y > MAP.height) {
      setARFeaturesVisible(false);
      setARStatus(
        'Your GPS position is outside the area covered by this historic map. Move into the mapped village to view the overlay.'
      );
      return;
    }
    const [x, z] = mapPoint(pixel.x, pixel.y);
    camera.position.set(x, groundHeight(x, z) + 1.6, z);
    setARFeaturesVisible(true);
    setARStatus(
      `Approximate AR alignment · GPS accuracy ±${Math.round(accuracy)} m · Historic map registration is not survey-grade.`
    );
    render();
  }

  function watchARLocation(session: ARSession) {
    return new Promise((resolve, reject) => {
      session.resolveLocation = resolve;
      session.rejectLocation = reject;
      session.locationTimeout = setTimeout(() => {
        if (!session.rejectLocation) return;
        session.rejectLocation(new Error('Timed out waiting for a GPS location. Check location access and try again.'));
        session.rejectLocation = null;
      }, 20000);
      session.watchId = navigator.geolocation.watchPosition(
        (position) => {
          updateARLocation(position);
          if (session.resolveLocation) {
            clearTimeout(session.locationTimeout as number);
            session.resolveLocation(position);
            session.resolveLocation = null;
            session.rejectLocation = null;
          }
        },
        (error) => {
          const message =
            error.code === 1
              ? 'Location permission is required for the AR view.'
              : `GPS location is unavailable: ${error.message}`;
          if (session.rejectLocation) {
            clearTimeout(session.locationTimeout as number);
            session.rejectLocation(new Error(message));
            session.rejectLocation = null;
          } else setARStatus(message);
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
      );
    });
  }

  async function stopAR() {
    const session = arSession;
    if (!session) return;
    arSession = null;
    clearTimeout(session.locationTimeout as number);
    clearTimeout(session.orientationTimeout as number);
    if (session.watchId !== null) navigator.geolocation.clearWatch(session.watchId);
    window.removeEventListener('deviceorientation', handleAROrientation);
    window.removeEventListener('deviceorientationabsolute', handleAROrientation);
    if (session.stream) session.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    arVideo.pause();
    arVideo.srcObject = null;
    if (session.rejectLocation) {
      session.rejectLocation(new Error('The AR view was closed.'));
      session.rejectLocation = null;
    }
    if (session.rejectOrientation) {
      session.rejectOrientation(new Error('The AR view was closed.'));
      session.rejectOrientation = null;
    }
    camera.position.copy(session.cameraPosition);
    camera.quaternion.copy(session.cameraQuaternion);
    camera.fov = session.cameraFov;
    camera.updateProjectionMatrix();
    controls.target.copy(session.cameraTarget);
    controls.enabled = session.controlsEnabled;
    renderer.setClearAlpha(session.clearAlpha);
    const restoredVisibility: [THREE.Object3D, boolean][] = [
      [ground, session.groundVisible],
      [base, session.baseVisible],
      [skirt, session.skirtVisible],
      [mappedGround, session.mappedGroundVisible],
      [waterFeatures, session.waterFeaturesVisible],
      [mapPlane, session.mapPlaneVisible],
      [landscape, session.landscapeVisible],
      [structures, session.structuresVisible],
      [labels, session.labelsVisible],
      [livestock, session.livestockVisible]
    ];
    for (const [object, visible] of restoredVisibility) object.visible = visible;
    shadowsDirty = true;
    renderer.domElement.style.pointerEvents = '';
    document.body.classList.remove('ar-active');
    arOverlay.hidden = true;
    arStartButton.disabled = false;
    host.setAttribute('aria-label', 'Interactive 3D reconstruction of Ilmer');
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        arStartStatus.textContent = 'AR ended, but the browser could not exit full-screen mode.';
      }
    }
    render();
  }

  async function startAR() {
    if (arSession) return;
    arStartStatus.textContent = '';
    if (!window.isSecureContext) {
      arStartStatus.textContent = 'Camera AR requires a secure HTTPS connection.';
      return;
    }
    if (
      typeof navigator.mediaDevices?.getUserMedia !== 'function' ||
      !navigator.geolocation ||
      !window.DeviceOrientationEvent
    ) {
      arStartStatus.textContent = 'This browser needs camera, GPS location and device-compass support for AR.';
      return;
    }

    const orientationApi: DeviceOrientationEventConstructor = window.DeviceOrientationEvent;
    const session: ARSession = {
      cameraPosition: camera.position.clone(),
      cameraQuaternion: camera.quaternion.clone(),
      cameraTarget: controls.target.clone(),
      cameraFov: camera.fov,
      controlsEnabled: controls.enabled,
      clearAlpha: renderer.getClearAlpha(),
      groundVisible: ground.visible,
      baseVisible: base.visible,
      skirtVisible: skirt.visible,
      mappedGroundVisible: mappedGround.visible,
      mapPlaneVisible: mapPlane.visible,
      waterFeaturesVisible: waterFeatures.visible,
      landscapeVisible: landscape.visible,
      structuresVisible: structures.visible,
      labelsVisible: labels.visible,
      livestockVisible: livestock.visible,
      watchId: null,
      stream: null,
      fullscreenActive: false,
      resolveLocation: null,
      rejectLocation: null,
      resolveOrientation: null,
      rejectOrientation: null,
      orientationObserved: false,
      locationTimeout: null,
      orientationTimeout: null
    };
    arSession = session;
    arStartButton.disabled = true;
    arOverlay.hidden = false;
    document.body.classList.add('ar-active');
    host.setAttribute('aria-label', 'Augmented reality view of the 1839 Ilmer reconstruction');
    controls.enabled = false;
    ground.visible = false;
    base.visible = false;
    skirt.visible = false;
    mappedGround.visible = false;
    mapPlane.visible = false;
    labels.visible = false;
    setARFeaturesVisible(false);
    renderer.setClearAlpha(0);
    renderer.domElement.style.pointerEvents = 'none';
    camera.fov = 65;
    camera.updateProjectionMatrix();
    setARStatus('Allow camera, location and compass access to start the AR view.');
    render();

    try {
      const stage = host.closest('.reconstruction-stage');
      let orientationPermission = Promise.resolve('granted');
      if (typeof orientationApi.requestPermission === 'function')
        orientationPermission = orientationApi.requestPermission();
      window.addEventListener('deviceorientation', handleAROrientation);
      window.addEventListener('deviceorientationabsolute', handleAROrientation);
      if (stage?.requestFullscreen) {
        void stage.requestFullscreen().then(
          () => {
            if (arSession === session) session.fullscreenActive = document.fullscreenElement === stage;
            else if (document.fullscreenElement === stage) {
              void document.exitFullscreen().catch(() => {
                arStartStatus.textContent = 'AR ended, but the browser could not exit full-screen mode.';
              });
            }
          },
          () => {
            if (arSession === session)
              setARStatus('Browser full-screen was denied; the AR view is using the full window.');
          }
        );
      }
      const permission = await orientationPermission;
      if (arSession !== session) return;
      if (permission !== 'granted') {
        document.getElementById('ar-controls')!.hidden = true;
        throw new Error('Compass permission is required for the AR view.');
      }
      const orientationReady = new Promise<void>((resolve, reject) => {
        if (session.orientationObserved) resolve();
        else {
          session.resolveOrientation = resolve;
          session.rejectOrientation = reject;
          session.orientationTimeout = setTimeout(() => {
            document.getElementById('ar-controls')!.hidden = true;
            session.rejectOrientation?.(
              new Error('A compass heading is unavailable. Enable device motion and compass access, then try again.')
            );
            session.rejectOrientation = null;
          }, 15000);
        }
      });
      const streamReady = navigator.mediaDevices
        .getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } })
        .then(async (stream) => {
          session.stream = stream;
          if (arSession !== session) {
            stream.getTracks().forEach((track) => track.stop());
            return stream;
          }
          arVideo.srcObject = stream;
          await arVideo.play();
          return stream;
        });
      const locationReady = watchARLocation(session);
      const [stream] = await Promise.all([streamReady, locationReady, orientationReady]);
      if (!stream.getVideoTracks().length) throw new Error('No camera video track is available for AR.');
      if (arSession === session) render();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Camera AR could not start.';
      const wasActive = arSession === session;
      await stopAR();
      if (wasActive) arStartStatus.textContent = message;
    }
  }

  arStartButton.addEventListener('click', startAR);
  document.getElementById('ar-exit')!.addEventListener('click', () => void stopAR());
  document.addEventListener('fullscreenchange', () => {
    if (arSession?.fullscreenActive && !document.fullscreenElement) void stopAR();
  });
  const raycaster = new THREE.Raycaster();
  let pointerStart: [number, number] | null = null;
  let flyDrag: { id: number; x: number; y: number } | null = null;
  function pointAtScene(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1
      ),
      camera
    );
  }
  function pointsAtCart() {
    const hitPoint = new THREE.Vector3();
    const distances = [cart, horse].flatMap((group) => {
      const bounds = new THREE.Box3().setFromObject(group).expandByScalar(0.45);
      return raycaster.ray.intersectBox(bounds, hitPoint) ? [hitPoint.distanceTo(camera.position)] : [];
    });
    const buildingHit = raycaster.intersectObjects(selectable, true)[0];
    return cart.visible && distances.length > 0 && (!buildingHit || Math.min(...distances) < buildingHit.distance);
  }
  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !event.isPrimary) {
      pointerStart = null;
      return;
    }
    pointerStart = [event.clientX, event.clientY];
    if (freeFlightAvailable()) {
      host.focus({ preventScroll: true });
      renderer.domElement.setPointerCapture(event.pointerId);
      flyDrag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!flyDrag || flyDrag.id !== event.pointerId || !freeFlightAvailable()) return;
    rotateFreeCamera((flyDrag.x - event.clientX) * 0.004, (flyDrag.y - event.clientY) * 0.004);
    flyDrag.x = event.clientX;
    flyDrag.y = event.clientY;
    render();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
    renderer.domElement.addEventListener(type, () => {
      flyDrag = null;
      if (type !== 'pointerup') pointerStart = null;
    });
  renderer.domElement.addEventListener('pointerup', (event) => {
    const start = pointerStart;
    pointerStart = null;
    if (
      !start ||
      event.button !== 0 ||
      !event.isPrimary ||
      Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 6
    )
      return;
    pointAtScene(event);
    if (rideMode !== 'rider' && pointsAtCart()) {
      startCartRide();
      event.preventDefault();
      return;
    }
    const hit = raycaster.intersectObjects(selectable, true)[0];
    if (hit) {
      let group = hit.object;
      while (!group.userData.place && group.parent) group = group.parent;
      select(group);
      render();
    }
  });
  host.addEventListener('keydown', (event) => {
    if (event.target !== host && event.target !== renderer.domElement) return;
    // Letter shortcuts and fly keys are handled by the page-wide shortcut listener
    if (freeFlightAvailable() || viewTransition || flying || (riding && rideMode === 'rider')) return;
    const offset = camera.position.clone().sub(controls.target);
    const sphere = new THREE.Spherical().setFromVector3(offset);
    if (event.key === 'ArrowLeft') sphere.theta -= 0.12;
    else if (event.key === 'ArrowRight') sphere.theta += 0.12;
    else if (event.key === 'ArrowUp') sphere.phi = Math.max(0.05, sphere.phi - 0.1);
    else if (event.key === 'ArrowDown') sphere.phi = Math.min(controls.maxPolarAngle, sphere.phi + 0.1);
    else if (event.key === '+' || event.key === '=')
      sphere.radius = Math.max(controls.minDistance, sphere.radius * 0.88);
    else if (event.key === '-') sphere.radius = Math.min(controls.maxDistance, sphere.radius * 1.12);
    else return;
    event.preventDefault();
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sphere));
    controls.update();
  });
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    stopViewFlight();
    if (flying) pauseFlight();
    flightButton.disabled = true;
    if (riding && rideMode === 'rider') pauseRide();
    else {
      cancelAnimationFrame(rideFrame);
      riding = false;
    }
    rideButton.disabled = true;
    status.hidden = false;
    status.textContent = 'The graphics context was lost. Reload this page to restore the model.';
    host.dataset.state = 'error';
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    rideButton.disabled = false;
    flightButton.disabled = false;
    status.hidden = true;
    host.dataset.state = 'ready';
    // The restored context has no shadow map, and autoUpdate will not draw one on its own.
    shadowsDirty = true;
    if (rideMode === 'village') startVillageCart();
    render();
  });
  rideDistance = rideLength * 0.48;
  setView('village', false);
  let animalTime: number | null = null;
  function animateAnimals(time: number) {
    if (!document.hidden && host.dataset.state !== 'error') {
      const seconds = animalTime === null ? 0 : Math.max(0, Math.min((time - animalTime) / 1000, 0.1));
      advanceFreeFlight(seconds);
      advanceLivestock(herds, seconds);
      updateAnimalMeshes();
      updateVillageAudio();
      if (!riding && !flying && !viewTransition) render();
      animalTime = time;
    } else animalTime = null;
    requestAnimationFrame(animateAnimals);
  }
  requestAnimationFrame(animateAnimals);
  status.hidden = true;
  host.dataset.state = 'ready';
  host.dataset.buildings = String(selectable.length);
  host.dataset.engine = `Three.js r${THREE.REVISION}`;
  // Read-only scene diagnostics make browser validation independent of screenshots.
  const ilmer1839 = () => ({
    navigationMode,
    livestock: herds.map((herd) => ({
      field: herd.id,
      species: herd.species,
      boundary: herd.polygon,
      animals: herd.animals.map(({ id, x, z, mode, travelled }) => ({
        id,
        x,
        z,
        mode,
        travelled,
        y: groundHeight(x, z) + (herd.species === 'duck' ? 0.08 : 0),
        contained: withinField(herd.polygon, x, z, herd.radius),
        blocked: animalBlocked(x, z, herd.radius, herd.id)
      }))
    })),
    buildings: selectable.length,
    viewTransition: viewTransition !== null,
    flight: {
      state: flightState,
      elapsed: flightElapsed,
      distance: flightTravel.distance,
      routeLength: flightLength,
      stops: stops.length,
      stopIds: stops.map((stop) => stop.id),
      visited: [...visitedFlightStops],
      controlsEnabled: controls.enabled,
      roofClearance: roofBounds.reduce(
        (minimum, bounds) =>
          camera.position.x >= bounds.min.x - 2 &&
          camera.position.x <= bounds.max.x + 2 &&
          camera.position.z >= bounds.min.z - 2 &&
          camera.position.z <= bounds.max.z + 2
            ? Math.min(minimum, camera.position.y - bounds.max.y)
            : minimum,
        Infinity
      )
    },
    signposts,
    ride: {
      audio: villageAudio.diagnostics(),
      state: rideState,
      mode: rideMode,
      driverVisible: driver.visible && cart.visible,
      distance: rideDistance,
      start: rideStart,
      end: rideEnd,
      routeLength: rideLength,
      circuitLength: rideCircuitLength,
      cartPosition: cart.position.toArray(),
      horsePosition: horse.position.toArray(),
      visible: cart.visible && horse.visible,
      controlsEnabled: controls.enabled
    },
    trees: {
      count: mappedTrees.length,
      leavesPerCrown,
      foliageOpacity: leafMaterials[0].opacity,
      transparentFoliage: leafMaterials.every((mat) => mat.transparent && !mat.depthWrite),
      orchard: mappedTrees.filter((tree: PlacedTree) => tree.orchard).length,
      sourceMap: treeData.source.map,
      detected: treeData.detections.length,
      excluded: excludedTrees,
      orientation: treeData.registration.rotationDegrees,
      scale: treeData.registration.scale,
      trunkInstances: treeTrunks.count,
      crownInstances: treeCrowns.reduce((sum, mesh) => sum + mesh.count, coniferCrowns.count),
      maxGroundingError: maxTreeGroundingError,
      sourceSymbols: mappedTrees.map((tree: PlacedTree) => tree.source)
    },
    selected: selected?.userData.place ?? null,
    mapVisible: mapPlane.visible,
    landscapeVisible: landscape.visible,
    camera: camera.position.toArray(),
    cameraTarget: controls.target.toArray(),
    cameraGroundClearance:
      camera.position.y - cameraFloor(terrain, camera.position.x, camera.position.z) + cameraGroundClearance,
    drawCalls: renderer.info.render.calls,
    porchSide: CHURCH_PORCH_SIDE,
    porchWorld: porch.getWorldPosition(new THREE.Vector3()).toArray(),
    blockedDoorwayWorld: blockedDoorway.getWorldPosition(new THREE.Vector3()).toArray(),
    roadEvidence,
    roadPolygons,
    hedges: { boundaries: fieldBoundaries, evidence: boundaryEvidence, maxAlignmentError: maxHedgeAlignmentError },
    roadEdges,
    footprintEvidence,
    ponds: ponds.map((outline, index) => ({
      outline,
      surfaceVertices: pondSurfaces[index].geometry.attributes.position.count
    })),
    cottagesPond: {
      outline: ponds[0],
      surfaceVertices: pondSurfaces[0].geometry.attributes.position.count,
      minSurfaceClearance: Math.min(
        ...Array.from({ length: pondSurfaces[0].geometry.attributes.position.count }, (_, i) => {
          const vertices = pondSurfaces[0].geometry.attributes.position;
          return vertices.getY(i) - groundHeight(vertices.getX(i), vertices.getZ(i));
        })
      )
    },
    terrain: {
      source: terrain.source.name,
      min: terrain.minElevation,
      max: terrain.maxElevation,
      church: groundHeight(churchX, churchZ) + terrain.baseElevation,
      exaggeration: 1,
      historicalCorrection: terrain.historicalCorrection,
      maxSurfaceDrapeError
    },
    churchGeometry: {
      westRoofVertices: nave.roofMesh.geometry.attributes.position.count,
      westRoofNormals: nave.roofMesh.geometry.attributes.normal.count,
      westRoofTriangles: nave.roofMesh.geometry.index!.count / 3,
      westGableVertices: nave.endMesh.geometry.attributes.position.count,
      westGableNormals: nave.endMesh.geometry.attributes.normal.count,
      turretAttached: turret.parent === church,
      exposedWestHipDepth: 11.5 / 2 + 0.2 + turret.position.x - 3.8 / 2,
      westWindowX: westWindow.position.x,
      eastWindowX: chancel.position.x + eastWindow.position.x,
      eastWindowOnChancel: eastWindow.parent === chancel,
      chancelRoofVertices: damagedChancelRoof.geometry.attributes.position.count
    },
    architecture: selectable.map((group) => ({
      place: group.userData.place,
      style: group.userData.architecture,
      storeys: group.userData.storeys,
      dwelling: group.userData.dwelling ?? false,
      chimneys: group.userData.chimneys ?? 0,
      frontDoors: group.userData.frontDoors ?? 0,
      roofs: group.userData.roofs,
      brickPlinths: group.userData.brickPlinths,
      groundBoarded: group.userData.groundBoarded,
      ivyLeavesByWall: group.userData.ivyLeavesByWall,
      projections: group.userData.projections ?? []
    }))
  });
  (window as Window & { ilmer1839?: typeof ilmer1839 }).ilmer1839 = ilmer1839;
}

if (host) {
  start().catch((error) => {
    console.error('Ilmer 1839 reconstruction could not start:', error);
    host.dataset.state = 'error';
    status.hidden = false;
    status.textContent =
      'The 3D view could not load its graphics, measured terrain or tree data. It needs WebGL and a browser supporting JavaScript modules and import maps. Visit Fields & farming for the tithe apportionment.';
  });
}
