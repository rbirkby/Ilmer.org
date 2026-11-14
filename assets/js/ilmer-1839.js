import {
  MAP,
  CHURCH_PORCH_SIDE,
  CHURCH_PLAN,
  mapPoint,
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
  ponds
} from './ilmer-1839-data.js';
import { validateTerrain, historicalTerrain, terrainHeight } from './ilmer-terrain.js';
import { validateTrees, historicalTrees, circleOverlapsTriangles } from './ilmer-trees.js';
import { rideCircuitPoint, rideCircuitLength, rideLength, rideStart, rideEnd, rideSpeed } from './ilmer-ride.js';
import { cameraFloor, cameraGroundClearance } from './ilmer-camera.js';
import { flightStops, flightProgress } from './ilmer-flight.js';
import { createRideAudio } from './ilmer-ride-audio.js';
import { livestockFields, createLivestock, advanceLivestock, withinField } from './ilmer-livestock.js';

const host = document.getElementById('village-scene');
const status = document.getElementById('scene-status');

async function start() {
  const terrainResponse = await fetch('/assets/ilmer-terrain.json');
  if (!terrainResponse.ok) throw new Error(`Measured terrain could not load: HTTP ${terrainResponse.status}`);
  const terrain = historicalTerrain(validateTerrain(await terrainResponse.json()));
  const treeResponse = await fetch('/assets/ilmer-trees.json');
  if (!treeResponse.ok) throw new Error(`Detected tree symbols could not load: HTTP ${treeResponse.status}`);
  const treeData = validateTrees(await treeResponse.json());
  const groundHeight = (x, z) => terrainHeight(terrain, x, z);
  let maxSurfaceDrapeError = 0;
  const THREE = await import('three');
  const { OrbitControls } = await import('/assets/vendor/three/OrbitControls.js');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0xe3e8dc);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(43, 1, 0.5, 1800);
  const controls = new OrbitControls(camera, renderer.domElement);
  let navigationMode = 'orbit';
  const movementKeys = new Set();
  const flyKeys = new Set(['w', 'a', 's', 'd', 'q', 'e', 'shift', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown']);
  const sceneHelp = document.getElementById('scene-help');
  const orbitHelp = sceneHelp.textContent;
  controls.enableDamping = false;
  controls.minDistance = 22;
  controls.maxDistance = 800;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.target.set(0, 0, 40);
  const landscape = new THREE.Group();
  const mappedGround = new THREE.Group();
  const structures = new THREE.Group();
  const labels = new THREE.Group();
  scene.add(landscape, mappedGround, structures, labels);
  scene.add(new THREE.HemisphereLight(0xffffee, 0x6e806b, 2.3));
  const sun = new THREE.DirectionalLight(0xffedc6, 3);
  sun.position.set(-140, 240, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -350, right: 350, top: 250, bottom: -250, near: 1, far: 650 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.3;
  scene.add(sun);
  const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 1, ...extra });

  function texture(kind) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
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
  scene.add(new THREE.Mesh(skirtGeometry, material(0x8a8063, { side: THREE.DoubleSide })));

  function surfaceGeometry(sourceGeometry, elevation, fixedHeight = null) {
    const position = sourceGeometry.attributes.position;
    const vertices = [];
    const dx = terrain.width / (terrain.columns - 1);
    const dz = terrain.depth / (terrain.rows - 1);
    function clippedPolygon(polygon, clip) {
      const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      const sign = Math.sign(cross(clip[0], clip[1], clip[2]));
      let result = polygon;
      for (let edge = 0; edge < 3; edge++) {
        const a = clip[edge];
        const b = clip[(edge + 1) % 3];
        const input = result;
        result = [];
        for (let j = 0; j < input.length; j++) {
          const start = input[j];
          const end = input[(j + 1) % input.length];
          const d0 = cross(a, b, start) * sign;
          const d1 = cross(a, b, end) * sign;
          if (d0 >= -1e-8) result.push(start);
          if (d0 >= -1e-8 !== d1 >= -1e-8) {
            const t = d0 / (d0 - d1);
            result.push([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t]);
          }
        }
      }
      return result;
    }
    for (let i = 0; i < position.count; i += 3) {
      const corners = [0, 1, 2].map((offset) => [position.getX(i + offset), -position.getY(i + offset)]);
      const minCol = Math.max(0, Math.floor((Math.min(...corners.map((p) => p[0])) + terrain.width / 2) / dx));
      const maxCol = Math.min(
        terrain.columns - 2,
        Math.floor((Math.max(...corners.map((p) => p[0])) + terrain.width / 2) / dx)
      );
      const minRow = Math.max(0, Math.floor((Math.min(...corners.map((p) => p[1])) + terrain.depth / 2) / dz));
      const maxRow = Math.min(
        terrain.rows - 2,
        Math.floor((Math.max(...corners.map((p) => p[1])) + terrain.depth / 2) / dz)
      );
      // Clip field faces to the same triangles as the DTM, avoiding layers cutting through hills.
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          const a = [-terrain.width / 2 + col * dx, -terrain.depth / 2 + row * dz];
          const b = [a[0], a[1] + dz];
          const c = [a[0] + dx, a[1] + dz];
          const d = [a[0] + dx, a[1]];
          for (const face of [
            [a, b, d],
            [b, c, d]
          ]) {
            const polygon = clippedPolygon(corners, face);
            for (let j = 1; j < polygon.length - 1; j++) {
              for (const [x, z] of [polygon[0], polygon[j], polygon[j + 1]]) {
                vertices.push(x, (fixedHeight ?? groundHeight(x, z)) + elevation, z);
              }
            }
          }
        }
      }
    }
    sourceGeometry.dispose();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    if (fixedHeight === null) {
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        maxSurfaceDrapeError = Math.max(
          maxSurfaceDrapeError,
          Math.abs(positions.getY(i) - groundHeight(positions.getX(i), positions.getZ(i)) - elevation)
        );
      }
    }
    return geometry;
  }

  function flatPolygon(points, mat, elevation = 0.04, parent = mappedGround, fixedHeight = null) {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) => {
      const [wx, wz] = mapPoint(x, y);
      if (i === 0) shape.moveTo(wx, -wz);
      else shape.lineTo(wx, -wz);
    });
    shape.closePath();
    const outline = new THREE.ShapeGeometry(shape);
    const geometry = surfaceGeometry(outline.toNonIndexed(), elevation, fixedHeight);
    outline.dispose();
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  flatPolygon(livestockFields[1].outline, material(0xb9bc85));
  flatPolygon(easternField, material(0xb7ad7b));
  flatPolygon(livestockFields[0].outline, material(0xb5bc8d));
  flatPolygon(churchyard, material(0xb4bf94), 0.09);
  const pondSurfaces = [];
  const pondPolygons = ponds.map((pond) => pond.map(([x, y]) => mapPoint(x, y)));
  for (const [index, pond] of ponds.entries()) {
    const waterLevel = Math.min(...pond.map(([x, y]) => groundHeight(...mapPoint(x, y))));
    // The historic cottages outline spans modern sloping ground; do not bury it at its lowest vertex.
    pondSurfaces.push(
      flatPolygon(
        pond,
        material(0x7eaaa5, { roughness: 0.4, side: THREE.DoubleSide }),
        0.08,
        mappedGround,
        index === 0 || index >= 3 ? null : waterLevel
      )
    );
  }

  const roadTriangles = [];
  function pathMesh(points, width, mat, elevation = 0.14, road = false) {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, y]) => {
        const [wx, wz] = mapPoint(x, y);
        return new THREE.Vector3(wx, elevation, wz);
      }),
      false,
      'centripetal'
    );
    const samples = curve.getPoints(Math.max(points.length * 12, Math.ceil(curve.getLength())));
    const vertices = [];
    const indices = [];
    samples.forEach((p, i) => {
      const tangent = samples[Math.min(i + 1, samples.length - 1)]
        .clone()
        .sub(samples[Math.max(i - 1, 0)])
        .normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(width / 2);
      for (const sign of [1, -1]) {
        const x = Math.max(-terrain.width / 2, Math.min(terrain.width / 2, p.x + sign * side.x));
        const z = Math.max(-terrain.depth / 2, Math.min(terrain.depth / 2, p.z + sign * side.z));
        vertices.push(x, groundHeight(x, z) + elevation, z);
      }
      if (i < samples.length - 1) {
        const n = i * 2;
        indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    const flat = geometry.toNonIndexed();
    const flatPositions = flat.attributes.position;
    for (let i = 0; i < flatPositions.count; i++) {
      flatPositions.setXYZ(i, flatPositions.getX(i), -flatPositions.getZ(i), 0);
    }
    const draped = surfaceGeometry(flat, elevation);
    if (road) {
      const positions = draped.attributes.position;
      for (let i = 0; i < positions.count; i += 3)
        roadTriangles.push([0, 1, 2].map((offset) => [positions.getX(i + offset), positions.getZ(i + offset)]));
    }
    geometry.dispose();
    const mesh = new THREE.Mesh(draped, mat);
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

  function box(parent, w, h, d, x, y, z, mat) {
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

  function foundation(parent, length, width, addPlinth = true, plinthMaterial = stone, aboveGround = 0) {
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

  function gable(parent, length, width, height, mat, rise = width * 0.46, roofMaterial = roof, westHalfHip = false) {
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

  function beam(parent, a, b, thickness, mat) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const mesh = box(parent, thickness, start.distanceTo(end), thickness, 0, 0, 0, mat);
    mesh.position.copy(start.clone().add(end).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    return mesh;
  }

  function distressedChancel(parent, originalRoof) {
    parent.remove(originalRoof);
    originalRoof.geometry.dispose();
    const vertices = [];
    const uvs = [];
    const roofHeight = (x, t) => 5 + 3.8 * t - 0.7 * Math.sin((x / 5.6 + 0.5) * Math.PI) * t;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 12; i++) {
        for (let j = 0; j < 4; j++) {
          const x0 = -2.8 + (i * 5.6) / 12;
          const x1 = x0 + 5.6 / 12;
          const t0 = j / 4;
          const t1 = (j + 1) / 4;
          const point = (x, t) => [x, roofHeight(x, t), side * 3.2 * (1 - t)];
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

  function windowPanel(parent, x, y, z, width = 1.3, height = 1.5) {
    box(parent, width + 0.22, height + 0.22, 0.08, x, y, z, whiteboard);
    box(parent, width, height, 0.1, x, y, z + Math.sign(z) * 0.05, dark);
    for (const offset of [-width / 4, width / 4]) {
      box(parent, 0.06, height, 0.14, x + offset, y, z + Math.sign(z) * 0.08, whiteboard);
    }
    box(parent, width, 0.06, 0.14, x, y, z + Math.sign(z) * 0.08, whiteboard);
  }

  function dwellingFacade(parent, length, width, frontDoors) {
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

  function tudorFacade(parent, length, width, height) {
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

  function climbingIvy(parent, length, width, height) {
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
    const counts = [];
    for (const [span, x, z, angle, end] of [
      [length, 0, width / 2 + 0.08, 0, false],
      [length, 0, -width / 2 - 0.08, Math.PI, false],
      [width, length / 2 + 0.08, 0, Math.PI / 2, true],
      [width, -length / 2 - 0.08, 0, -Math.PI / 2, true]
    ]) {
      const wall = new THREE.Group();
      wall.position.set(x, 0, z);
      wall.rotation.y = angle;
      parent.add(wall);
      const points = [];
      const columns = Math.ceil(span / 0.22);
      const rows = Math.ceil((height + (end ? width * 0.46 : 0)) / 0.22);
      const opening = (u, v) =>
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

  const selectable = [];
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
      const shell = gable(
        part,
        l,
        w,
        height,
        tudor ? plaster : vicarage ? brick : stoneHouse ? stone : timber,
        tudor ? w * 0.65 : w * 0.46,
        tudor ? thatch : roof
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
          const ridge = height + w * 0.65;
          box(part, 1.15, 4.8, 1.15, 0, ridge + 1.6, 0, brick);
          box(part, 1.35, 0.16, 1.35, 0, ridge + 4.08, 0, brick);
          for (const x of [-0.28, 0.28]) box(part, 0.25, 0.22, 0.35, x, ridge + 4.25, 0, dark);
          group.userData.chimneys++;
        }
      } else if (vicarage) {
        box(part, l + 0.08, height * 0.32, w + 0.08, 0, height * 0.16, 0, stone);
        box(part, 1.15, 3.1, 1.15, -l * 0.24, height + w * 0.43, 0, brick);
        group.userData.chimneys++;
        for (const side of [-1, 1]) {
          for (const level of [height * 0.25, height * 0.73]) {
            for (const x of [-l * 0.3, l * 0.3]) windowPanel(part, x, level, side * (w / 2 + 0.09));
          }
        }
        const entry = new THREE.Group();
        entry.position.set(0, 0, -w / 2 - 0.65);
        box(entry, l * 0.5, 2.8, 1.7, 0, 1.4, 0, stone);
        box(entry, 1.5, 2.6, 0.1, 0, 1.3, -0.91, dark);
        const canopy = box(entry, l * 0.6, 0.18, 2.3, 0, 3, -0.15, roof);
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
      const top = (z) => height - 0.35 * (1 + (fall * z) / (w / 2));
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
      const covering = building.architecture === 'tudor' ? thatch : roof;
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
      group.userData.projections.push({ outline: [x, y, length, width, angle], roof: 'inferred lean-to' });
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

  const { trees: detectedTrees, excluded: excludedTrees } = historicalTrees(treeData);
  const foliagePositions = [];
  const foliageNormals = [];
  const foliageColors = [];
  function foliagePart(geometry, x, y, z, sx, sy, sz, shade) {
    geometry.scale(sx, sy, sz);
    geometry.translate(x, y, z);
    const expanded = geometry.index ? geometry.toNonIndexed() : geometry;
    foliagePositions.push(...expanded.attributes.position.array);
    foliageNormals.push(...expanded.attributes.normal.array);
    for (let i = 0; i < expanded.attributes.position.count; i++) foliageColors.push(shade, shade, shade);
    geometry.dispose();
    if (expanded !== geometry) expanded.dispose();
  }
  for (let i = 0; i < 9; i++) {
    const angle = i * 2.4;
    const radius = i === 0 ? 0 : 0.48;
    foliagePart(
      new THREE.IcosahedronGeometry(1, 1),
      Math.cos(angle) * radius,
      i === 0 ? 0.3 : Math.sin(i * 1.7) * 0.25,
      Math.sin(angle) * radius,
      0.64,
      0.68,
      0.64,
      0.8 + (i % 3) * 0.1
    );
  }
  const leavesPerCrown = 180;
  for (let i = 0; i < leavesPerCrown; i++) {
    const lobe = i % 9;
    const y = 1 - (2 * (Math.floor(i / 9) + 0.5)) / (leavesPerCrown / 9);
    const radius = Math.sqrt(1 - y * y);
    const angle = i * 2.399963;
    const leaf = new THREE.IcosahedronGeometry(1, 0);
    leaf.rotateY(angle);
    leaf.rotateZ(i * 0.7);
    foliagePart(
      leaf,
      Math.cos(lobe * 2.4) * (lobe === 0 ? 0 : 0.48) + Math.cos(angle) * radius * 0.64,
      (lobe === 0 ? 0.3 : Math.sin(lobe * 1.7) * 0.25) + y * 0.68,
      Math.sin(lobe * 2.4) * (lobe === 0 ? 0 : 0.48) + Math.sin(angle) * radius * 0.64,
      0.14,
      0.055,
      0.22,
      0.72 + (i % 5) * 0.07
    );
  }
  const treeCrown = new THREE.BufferGeometry();
  treeCrown.setAttribute('position', new THREE.Float32BufferAttribute(foliagePositions, 3));
  treeCrown.setAttribute('normal', new THREE.Float32BufferAttribute(foliageNormals, 3));
  treeCrown.setAttribute('color', new THREE.Float32BufferAttribute(foliageColors, 3));
  treeCrown.computeBoundingSphere();
  const crownPositions = treeCrown.attributes.position;
  let crownRadius = 0;
  for (let i = 0; i < crownPositions.count; i++)
    crownRadius = Math.max(crownRadius, Math.hypot(crownPositions.getX(i), crownPositions.getZ(i)));
  const cartCorridor = [];
  for (let distance = 0; distance < rideCircuitLength; distance += 0.5) {
    const a = rideCircuitPoint(distance),
      b = rideCircuitPoint(distance + 0.5);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = (-(b[1] - a[1]) / length) * 1.2,
      nz = ((b[0] - a[0]) / length) * 1.2;
    const leftA = [a[0] + nx, a[1] + nz],
      rightA = [a[0] - nx, a[1] - nz];
    const leftB = [b[0] + nx, b[1] + nz],
      rightB = [b[0] - nx, b[1] - nz];
    cartCorridor.push([leftA, leftB, rightA], [rightA, leftB, rightB]);
  }
  const treeSize = (tree) => (tree.orchard ? 3.5 : 5.5 + (tree.renderIndex % 3) * 0.5);
  const dryTrees = detectedTrees.filter(
    (tree) => !pondPolygons.some((polygon) => withinField(polygon, ...mapPoint(tree.x, tree.y)))
  );
  excludedTrees.water = detectedTrees.length - dryTrees.length;
  const mappedTrees = dryTrees
    .map((tree, renderIndex) => ({ ...tree, renderIndex }))
    .filter((tree) => {
      const [x, z] = mapPoint(tree.x, tree.y);
      const radius = treeSize(tree) * (tree.conifer ? 0.3 : 0.4 * crownRadius);
      return (
        !circleOverlapsTriangles(x, z, radius, roadTriangles) && !circleOverlapsTriangles(x, z, radius, cartCorridor)
      );
    });
  excludedTrees.road = dryTrees.length - mappedTrees.length;
  const treeTrunks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), trunkMaterial, mappedTrees.length);
  const treeCrowns = leafMaterials.map(
    (mat, index) =>
      new THREE.InstancedMesh(
        treeCrown,
        mat,
        mappedTrees.filter((tree) => !tree.conifer && tree.renderIndex % leafMaterials.length === index).length
      )
  );
  const coniferCrowns = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1, 1, 8),
    material(0x34582b, { transparent: true, opacity: 0.38, depthWrite: false }),
    mappedTrees.filter((tree) => tree.conifer).length
  );
  const treeTransform = new THREE.Object3D();
  const crownCounts = leafMaterials.map(() => 0);
  let coniferCount = 0;
  let maxTreeGroundingError = 0;
  mappedTrees.forEach((tree, index) => {
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
  const hedgeVertices = [];
  let maxHedgeAlignmentError = 0;
  const mappedRoadPolygons = roadPolygons.map((polygon) => polygon.map(([x, y]) => mapPoint(x, y)));
  const hedgeFootprints = buildings.flatMap((building) => [...building.parts, ...(building.projections ?? [])]);
  const hedgeLine = (a, b) => {
    const [ax, az] = mapPoint(...a);
    const [bx, bz] = mapPoint(...b);
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
  const treeCentres = mappedTrees.map(({ x, y }) => mapPoint(x, y));
  const animalBlocked = (x, z, radius, field) =>
    circleOverlapsTriangles(x, z, radius, fieldObstacles.get(field)) ||
    buildingBounds.some(
      (bounds) =>
        x > bounds.min.x - radius && x < bounds.max.x + radius && z > bounds.min.z - radius && z < bounds.max.z + radius
    ) ||
    pondPolygons.some(
      (polygon, index) => !(field === 'cross-road-ducks' && index === 3) && withinField(polygon, x, z)
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
  const animalBatches = [];
  function animalPart(species, geometry, mat, position, scale, motion = 'body', rotation = 0) {
    const animals = herds.filter((herd) => herd.species === species).flatMap((herd) => herd.animals);
    const mesh = new THREE.InstancedMesh(geometry, mat, animals.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = mesh.receiveShadow = true;
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
      batch.animals.forEach((animal, index) => {
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

  function label(text, x, y) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f7f4e7';
    ctx.fillRect(0, 0, 512, 96);
    ctx.strokeStyle = '#c5c5a9';
    ctx.strokeRect(2, 2, 508, 92);
    ctx.font = '48px Georgia';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#344938';
    ctx.fillText(text, 256, 60, 480);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, depthWrite: false })
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

  const cart = new THREE.Group();
  const horse = new THREE.Group();
  scene.add(cart, horse);
  cart.visible = horse.visible = false;
  box(cart, 1.8, 0.2, 2.8, 0, 0.95, 0, timber);
  box(cart, 1.85, 0.55, 0.16, 0, 1.32, 1.35, timber);
  box(cart, 1.85, 0.35, 0.16, 0, 1.65, -1.35, timber);
  box(cart, 1.7, 0.16, 0.5, 0, 1.45, 0.4, timber);
  for (const side of [-1, 1]) {
    box(cart, 0.12, 0.55, 2.8, side * 0.9, 1.32, 0, timber);
    box(cart, 0.09, 0.1, 4.2, side * 0.65, 1.1, -2.5, timber);
  }
  const wheels = [];
  for (const side of [-1, 1]) {
    const wheel = new THREE.Group();
    wheel.position.set(side * 1.05, 0.7, 0.4);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.075, 6, 20), dark);
    rim.rotation.y = Math.PI / 2;
    wheel.add(rim);
    for (let spoke = 0; spoke < 8; spoke++) {
      const bar = box(wheel, 0.08, 1.25, 0.07, 0, 0, 0, timber);
      bar.rotation.x = (spoke * Math.PI) / 8;
    }
    cart.add(wheel);
    wheels.push(wheel);
  }
  const horseCoat = material(0x72503a);
  const mane = material(0x30271f);
  const driver = new THREE.Group();
  cart.add(driver);
  const coat = material(0x465b70);
  const skin = material(0xc69b78);
  box(driver, 0.62, 0.8, 0.42, 0, 1.94, 0.4, coat);
  box(driver, 0.4, 0.42, 0.4, 0, 2.56, 0.38, skin);
  box(driver, 0.65, 0.06, 0.6, 0, 2.8, 0.38, mane);
  box(driver, 0.42, 0.24, 0.4, 0, 2.92, 0.38, mane);
  for (const side of [-1, 1]) {
    box(driver, 0.22, 0.2, 0.65, side * 0.2, 1.48, 0.05, coat);
    box(driver, 0.2, 0.55, 0.22, side * 0.2, 1.12, -0.22, dark);
    box(driver, 0.22, 0.18, 0.38, side * 0.2, 0.87, -0.3, mane);
    const arm = box(driver, 0.18, 0.18, 0.68, side * 0.36, 1.95, 0.02, coat);
    arm.rotation.x = -0.15;
    box(driver, 0.16, 0.16, 0.16, side * 0.36, 1.9, -0.32, skin);
  }
  box(horse, 0.85, 0.85, 1.8, 0, 1.65, 0, horseCoat);
  const neck = box(horse, 0.6, 1.25, 0.65, 0, 2.08, -0.75, horseCoat);
  neck.rotation.x = -0.3;
  box(horse, 0.52, 0.6, 0.95, 0, 2.65, -1.05, horseCoat);
  box(horse, 0.55, 0.32, 0.35, 0, 2.43, -1.56, mane);
  box(horse, 0.18, 1, 0.18, 0, 2.2, -0.43, mane);
  const legs = [];
  for (const side of [-1, 1]) {
    box(horse, 0.15, 0.4, 0.18, side * 0.2, 3.05, -0.84, horseCoat);
    box(horse, 0.07, 0.08, 0.12, side * 0.28, 2.72, -1.26, dark);
    for (const end of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.3, 1.4, end * 0.6);
      box(leg, 0.19, 1.1, 0.22, 0, -0.55, 0, horseCoat);
      box(leg, 0.22, 0.2, 0.3, 0, -1.25, -0.02, mane);
      horse.add(leg);
      legs.push(leg);
    }
    box(horse, 0.04, 0.06, 1.9, side * 0.46, 1.75, 0, dark);
  }
  const tail = box(horse, 0.2, 1.1, 0.2, 0, 1.25, 0.95, mane);
  tail.rotation.x = -0.25;
  const reinsGeometry = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 4 }, () => new THREE.Vector3()));
  const reins = new THREE.LineSegments(reinsGeometry, new THREE.LineBasicMaterial({ color: 0x392a22 }));
  scene.add(reins);
  reins.visible = false;
  const rideButton = document.getElementById('ride-pause');
  const rideStatus = document.getElementById('ride-status');
  const soundStatus = document.getElementById('ride-sound-status');
  const rideAudio = createRideAudio();
  function audioError(error) {
    console.error('Horse and cart audio could not start:', error);
    soundStatus.textContent = 'Ride sound unavailable. Check your browser audio permissions.';
  }
  let riding = false;
  let rideMode = 'village';
  let rideState = 'idle';
  let rideDistance = rideStart;
  let rideFrame = 0;
  let ridePreviousTime = null;
  function seatOnRoad(group, distance) {
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
    seatOnRoad(horse, rideDistance + 4.6);
    if (rideMode === 'rider') {
      camera.position.copy(cart.localToWorld(new THREE.Vector3(0, 2.7, 1.1)));
      const [x, z] = rideCircuitPoint(rideDistance + 13);
      controls.target.set(x, groundHeight(x, z) + 2.2, z);
      camera.lookAt(controls.target);
    }
    const points = [];
    for (const side of [-1, 1]) {
      points.push(cart.localToWorld(new THREE.Vector3(side * 0.36, 1.9, -0.32)));
      points.push(horse.localToWorld(new THREE.Vector3(side * 0.35, 2.4, -1.2)));
    }
    reinsGeometry.setFromPoints(points);
    wheels.forEach((wheel) => (wheel.rotation.x = -rideDistance / 0.65));
    legs.forEach((leg, i) => (leg.rotation.x = Math.sin(rideDistance * 2.8 + (i % 3 ? Math.PI : 0)) * 0.22));
  }
  function pauseRide() {
    rideAudio.stop();
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
    rideAudio.stop();
    soundStatus.textContent = '';
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
  function advanceRide(time) {
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
    soundStatus.textContent = '';
    rideAudio.start().catch(audioError);
    ridePreviousTime = null;
    controls.enabled = false;
    cart.visible = horse.visible = reins.visible = true;
    driver.visible = false;
    labels.visible = false;
    mapPlane.visible = false;
    document.getElementById('map-layer').checked = false;
    mappedGround.visible = true;
    selected = null;
    host.setAttribute('aria-label', 'Riding through Ilmer on a horse and cart');
    for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', 'false');
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

  let selected = null;
  function select(group) {
    selected = group;
    host.setAttribute(
      'aria-label',
      `Interactive 3D reconstruction of Ilmer. Selected: ${places[group.userData.place].title}`
    );
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
  let activeView = 'village';
  let viewFrame = 0;
  let viewTransition = null;
  function stopViewFlight() {
    cancelAnimationFrame(viewFrame);
    viewTransition = null;
  }
  function advanceViewFlight(time) {
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
  const flightButton = document.getElementById('flight-toggle');
  const flightStatus = document.getElementById('flight-status');
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
  let flying = false;
  let flightState = 'idle';
  let flightElapsed = 0;
  let flightTime = null;
  let flightFrame = 0;
  const visitedFlightStops = new Set();
  function stopFlight() {
    cancelAnimationFrame(flightFrame);
    flying = false;
    flightState = 'idle';
    flightTime = null;
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
    controls.enabled = navigationMode === 'orbit';
    flightButton.textContent = 'Resume Historic Tour';
    flightButton.setAttribute('aria-pressed', 'false');
    flightStatus.textContent = 'Flight paused. Resume, explore, or choose another view.';
  }
  function advanceFlight(time) {
    if (!flying) return;
    if (flightTime !== null) flightElapsed += Math.max(0, Math.min((time - flightTime) / 1000, 0.15));
    flightTime = time;
    const progress = flightProgress(flightElapsed, stops.length);
    visitedFlightStops.add(stops[progress.index].id);
    const parameter = (progress.index + progress.fraction) / stops.length;
    camera.position.copy(flightCurve.getPoint(parameter));
    for (const bounds of roofBounds) {
      if (
        camera.position.x >= bounds.min.x - 2 &&
        camera.position.x <= bounds.max.x + 2 &&
        camera.position.z >= bounds.min.z - 2 &&
        camera.position.z <= bounds.max.z + 2
      )
        camera.position.y = Math.max(camera.position.y, bounds.max.y + 2);
    }
    controls.target.copy(targetCurve.getPoint(parameter));
    camera.lookAt(controls.target);
    const message = `Flying · ${stops[progress.fraction === 1 ? progress.next : progress.index].title} · ${visitedFlightStops.size} of ${stops.length} buildings visited`;
    if (flightStatus.textContent !== message) flightStatus.textContent = message;
    render();
    flightFrame = requestAnimationFrame(advanceFlight);
  }
  flightButton.disabled = false;
  flightButton.addEventListener('click', () => {
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
      visitedFlightStops.clear();
    }
    flying = true;
    flightState = 'flying';
    flightTime = null;
    controls.enabled = false;
    labels.visible = false;
    selected = null;
    host.setAttribute('aria-label', 'Flying around every mapped property in Ilmer');
    for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', 'false');
    flightButton.textContent = 'Pause Historic Tour';
    flightButton.setAttribute('aria-pressed', 'true');
    advanceFlight(performance.now());
  });
  function setView(name, animate = true) {
    movementKeys.clear();
    stopViewFlight();
    stopFlight();
    stopRide();
    rideMode = 'village';
    activeView = name;
    labels.visible = !mapPlane.visible && !views[name].place;
    const view = views[name];
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
      button.setAttribute('aria-pressed', String(button.dataset.view === name));
    }
    if (view.place) select(selectable.find((group) => group.userData.place === view.place));
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
    renderer.render(scene, camera);
  }
  function freeFlightAvailable() {
    return (
      navigationMode === 'fly' && !viewTransition && !flying && rideMode !== 'rider' && host.dataset.state !== 'error'
    );
  }
  function rotateFreeCamera(yaw, pitch) {
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
  function advanceFreeFlight(seconds) {
    if (!freeFlightAvailable() || !movementKeys.size) return;
    const value = (positive, negative) => Number(movementKeys.has(positive)) - Number(movementKeys.has(negative));
    rotateFreeCamera(value('arrowleft', 'arrowright') * seconds, value('arrowup', 'arrowdown') * seconds);
    const direction = camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(direction, camera.up).normalize();
    const movement = direction.multiplyScalar(value('w', 's')).addScaledVector(right, value('d', 'a'));
    movement.y += value('e', 'q');
    if (movement.lengthSq()) {
      movement.normalize().multiplyScalar(seconds * (movementKeys.has('shift') ? 50 : 22));
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
  document.getElementById('navigation-mode').addEventListener('change', (event) => {
    movementKeys.clear();
    stopViewFlight();
    stopFlight();
    stopRide();
    rideMode = 'village';
    navigationMode = event.target.value;
    controls.enabled = navigationMode === 'orbit';
    document.getElementById('free-flight-controls').hidden = navigationMode !== 'fly';
    sceneHelp.textContent =
      navigationMode === 'fly'
        ? 'Drag to look. Fly with W/A/S/D, Q down, E up, Shift faster; arrows turn. On touch, hold a direction button. C rides the cart; choose a view or press Escape to leave the ride or tour.'
        : orbitHelp;
    labels.visible = !mapPlane.visible && !views[activeView].place;
    startVillageCart();
    host.focus({ preventScroll: true });
    render();
  });
  for (const button of document.querySelectorAll('[data-fly-key]')) {
    button.addEventListener('pointerdown', (event) => {
      if (!freeFlightAvailable()) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      movementKeys.add(button.dataset.flyKey);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      button.addEventListener(type, () => movementKeys.delete(button.dataset.flyKey));
  }
  window.addEventListener('keyup', (event) => movementKeys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => movementKeys.clear());
  host.addEventListener('blur', () => movementKeys.clear());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) movementKeys.clear();
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
    button.addEventListener('click', () => setView(button.dataset.view));
  }
  document.getElementById('map-layer').addEventListener('change', (event) => {
    if (rideMode === 'rider' || flightState !== 'idle') setView(activeView);
    mapPlane.visible = event.target.checked;
    mappedGround.visible = !mapPlane.visible;
    labels.visible = !mapPlane.visible && !views[activeView].place;
    render();
  });
  const raycaster = new THREE.Raycaster();
  let pointerStart = null;
  let flyDrag = null;
  let lastCartTap = null;
  function pointAtScene(event) {
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
  renderer.domElement.addEventListener('dblclick', (event) => {
    if (rideMode === 'rider') return;
    pointAtScene(event);
    if (pointsAtCart()) {
      startCartRide();
      event.preventDefault();
    }
  });
  renderer.domElement.addEventListener('pointerdown', (event) => {
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
    });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (!pointerStart || Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 6) return;
    pointerStart = null;
    pointAtScene(event);
    if (rideMode !== 'rider' && pointsAtCart()) {
      const now = performance.now();
      if (
        lastCartTap &&
        now - lastCartTap.time < 450 &&
        Math.hypot(event.clientX - lastCartTap.x, event.clientY - lastCartTap.y) < 30
      ) {
        lastCartTap = null;
        startCartRide();
        event.preventDefault();
      } else lastCartTap = { time: now, x: event.clientX, y: event.clientY };
      return;
    }
    lastCartTap = null;
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
    if (event.key.toLowerCase() === 'c' && !event.repeat) {
      startCartRide();
      event.preventDefault();
      return;
    }
    if (freeFlightAvailable() && flyKeys.has(event.key.toLowerCase())) {
      movementKeys.add(event.key.toLowerCase());
      event.preventDefault();
      return;
    }
    if ((viewTransition || flying || (riding && rideMode === 'rider')) && event.key.toLowerCase() !== 'r') return;
    const offset = camera.position.clone().sub(controls.target);
    const sphere = new THREE.Spherical().setFromVector3(offset);
    if (event.key === 'ArrowLeft') sphere.theta -= 0.12;
    else if (event.key === 'ArrowRight') sphere.theta += 0.12;
    else if (event.key === 'ArrowUp') sphere.phi = Math.max(0.05, sphere.phi - 0.1);
    else if (event.key === 'ArrowDown') sphere.phi = Math.min(controls.maxPolarAngle, sphere.phi + 0.1);
    else if (event.key === '+' || event.key === '=')
      sphere.radius = Math.max(controls.minDistance, sphere.radius * 0.88);
    else if (event.key === '-') sphere.radius = Math.min(controls.maxDistance, sphere.radius * 1.12);
    else if (event.key.toLowerCase() === 'r') {
      setView('village');
      return;
    } else return;
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
    if (rideMode === 'village') startVillageCart();
    render();
  });
  rideDistance = rideLength * 0.48;
  setView('village', false);
  let animalTime = null;
  function animateAnimals(time) {
    if (!document.hidden && host.dataset.state !== 'error') {
      const seconds = animalTime === null ? 0 : Math.max(0, Math.min((time - animalTime) / 1000, 0.1));
      advanceFreeFlight(seconds);
      advanceLivestock(herds, seconds);
      updateAnimalMeshes();
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
  window.ilmer1839 = () => ({
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
    ride: {
      audio: rideAudio.diagnostics(),
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
      orchard: mappedTrees.filter((tree) => tree.orchard).length,
      sourceYear: treeData.source.year,
      detected: treeData.detections.length,
      excluded: excludedTrees,
      orientation: treeData.registration.clockwiseDegreesInImageCoordinates,
      reflection: treeData.registration.determinant < 0,
      trunkInstances: treeTrunks.count,
      crownInstances: treeCrowns.reduce((sum, mesh) => sum + mesh.count, coniferCrowns.count),
      maxGroundingError: maxTreeGroundingError,
      sourceSymbols: mappedTrees.map((tree) => tree.source)
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
      westRoofTriangles: nave.roofMesh.geometry.index.count / 3,
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
}

if (host) {
  start().catch((error) => {
    console.error('Ilmer 1839 reconstruction could not start:', error);
    host.dataset.state = 'error';
    status.hidden = false;
    status.textContent =
      'The 3D view could not load its graphics, measured terrain or detected tree data. It needs WebGL and a browser supporting JavaScript modules and import maps. Visit Fields & farming for the tithe apportionment.';
  });
}
