import { MAP, buildings } from './ilmer-1839-data.ts';

const triangleBoxes = new WeakMap();

export function circleOverlapsTriangles(x: any, z: any, radius: any, triangles: any) {
  const edgeDistance = (a: any, b: any) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const denominator = dx * dx + dz * dz;
    const t = denominator === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / denominator));
    return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
  };
  let boxes = triangleBoxes.get(triangles);
  if (!boxes) {
    boxes = triangles.map(([a, b, c]: [any, any, any]) => [
      Math.min(a[0], b[0], c[0]),
      Math.max(a[0], b[0], c[0]),
      Math.min(a[1], b[1], c[1]),
      Math.max(a[1], b[1], c[1])
    ]);
    triangleBoxes.set(triangles, boxes);
  }
  return triangles.some(([a, b, c]: [any, any, any], index: any) => {
    const box = boxes[index];
    if (x < box[0] - radius || x > box[1] + radius || z < box[2] - radius || z > box[3] + radius) return false;
    const cross = (p: any, q: any) => (q[0] - p[0]) * (z - p[1]) - (q[1] - p[1]) * (x - p[0]);
    const signs = [cross(a, b), cross(b, c), cross(c, a)];
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const inside = Math.abs(area) > 1e-10 && (signs.every((value) => value >= 0) || signs.every((value) => value <= 0));
    return inside || Math.min(edgeDistance(a, b), edgeDistance(b, c), edgeDistance(c, a)) <= radius;
  });
}

/**
 * Trees detected on the Ordnance Survey map, with the two-point similarity that lays that map over the tithe map:
 * St Peter's Church and Lower Farm's main farmhouse (the benchmark) fix its rotation, scale and position.
 */
export function validateTrees(data: any) {
  const point = (value: any) => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
  if (
    typeof data?.source?.map !== 'string' ||
    !Number.isFinite(data.source.width) ||
    !Number.isFinite(data.source.height) ||
    !Array.isArray(data.detections) ||
    !Array.isArray(data.registration?.controlPoints) ||
    !Array.isArray(data.registration?.matrix)
  )
    throw new Error('Invalid detected-tree data');
  const { controlPoints, matrix } = data.registration;
  const { width, height } = data.source;
  if (
    controlPoints.length < 2 ||
    !controlPoints.every((control: any) => point(control.source) && point(control.target)) ||
    matrix.length !== 2 ||
    !matrix.every((row: any) => Array.isArray(row) && row.length === 3 && row.every(Number.isFinite)) ||
    !data.detections.every(
      (tree: any) =>
        Number.isFinite(tree.x) &&
        Number.isFinite(tree.y) &&
        tree.x >= 0 &&
        tree.x < width &&
        tree.y >= 0 &&
        tree.y < height &&
        ['tree', 'orchard', 'conifer'].includes(tree.kind)
    )
  )
    throw new Error('Invalid detected-tree coordinates');
  // A similarity keeps shapes: equal scale on both axes, no shear, and no mirror image
  const [[a, b], [c, d]] = matrix;
  if (a * d - b * c <= 0) throw new Error('Detected-tree registration folds or reflects the map');
  if (Math.abs(a - d) > 1e-6 || Math.abs(b + c) > 1e-6) throw new Error('Detected-tree registration distorts the map');
  for (const control of controlPoints) {
    const [x, y] = registerMapTree(data, ...(control.source as [number, number]));
    if (Math.hypot(x - control.target[0], y - control.target[1]) > 0.5)
      throw new Error('Detected-tree registration misses its control points');
  }
  return data;
}

/** Tithe-map pixel position of a point on the Ordnance Survey map. */
export function registerMapTree(data: any, x: any, y: any) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Invalid tree registration coordinate');
  return data.registration.matrix.map((row: any) => row[0] * x + row[1] * y + row[2]);
}

export function historicalTrees(data: any) {
  const trees: any[] = [];
  const excluded = { outsideCrop: 0, building: 0 };
  const footprints = buildings.flatMap((building) => [...building.parts, ...(building.projections ?? [])]);
  footprints.push([957, 507, 70, 43, 21, 0]);
  data.detections.forEach((detection: any, index: any) => {
    const [x, y] = registerMapTree(data, detection.x, detection.y);
    if (x < 1 || y < 1 || x > MAP.width - 1 || y > MAP.height - 1) {
      excluded.outsideCrop++;
      return;
    }
    const insideBuilding = footprints.some(([cx, cy, length, width, angle]) => {
      const rotation = (angle * Math.PI) / 180;
      const dx = x - cx;
      const dy = y - cy;
      const localX = dx * Math.cos(rotation) + dy * Math.sin(rotation);
      const localY = -dx * Math.sin(rotation) + dy * Math.cos(rotation);
      return Math.abs(localX) < length / 2 + 4 && Math.abs(localY) < width / 2 + 4;
    });
    if (insideBuilding) excluded.building++;
    else
      trees.push({
        x,
        y,
        orchard: detection.kind === 'orchard',
        conifer: detection.kind === 'conifer',
        source: [detection.x, detection.y],
        detectionIndex: index
      });
  });
  return { trees, excluded };
}

const LEAVES_PER_CROWN = 180;

/** The instanced broadleaf crown. Placement uses its horizontal radius; the page instances this geometry. */
export function createTreeCrown(THREE: any) {
  const foliagePositions: any[] = [];
  const foliageNormals: any[] = [];
  const foliageColors: any[] = [];
  function foliagePart(geometry: any, x: any, y: any, z: any, sx: any, sy: any, sz: any, shade: any) {
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
  for (let i = 0; i < LEAVES_PER_CROWN; i++) {
    const lobe = i % 9;
    const y = 1 - (2 * (Math.floor(i / 9) + 0.5)) / (LEAVES_PER_CROWN / 9);
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
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(foliagePositions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(foliageNormals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(foliageColors, 3));
  geometry.computeBoundingSphere();
  const crownPositions = geometry.attributes.position;
  let crownRadius = 0;
  for (let i = 0; i < crownPositions.count; i++) {
    crownRadius = Math.max(crownRadius, Math.hypot(crownPositions.getX(i), crownPositions.getZ(i)));
  }
  return { geometry, leavesPerCrown: LEAVES_PER_CROWN, crownRadius };
}

const PLACED_KINDS = ['tree', 'orchard', 'conifer'];

/** Rows written by scripts/build-ilmer-placed-trees.ts: [x, y, renderIndex, kind, sourceX, sourceY]. */
export function validatePlacedTrees(data: any) {
  const excludedKeys = ['outsideCrop', 'building', 'water', 'road', 'shiftedToVerge'];
  if (
    typeof data?.detectionsSha256 !== 'string' ||
    data.detectionsSha256.length !== 64 ||
    typeof data?.terrainSha256 !== 'string' ||
    data.terrainSha256.length !== 64 ||
    !Number.isFinite(data.crownRadius) ||
    data.crownRadius <= 0 ||
    !data.excluded ||
    excludedKeys.some((key) => !Number.isInteger(data.excluded[key]) || data.excluded[key] < 0) ||
    !Array.isArray(data.trees) ||
    data.trees.length === 0
  )
    throw new Error('Invalid placed-tree data');
  const trees = data.trees.map((row: any) => {
    if (!Array.isArray(row) || row.length !== 6) throw new Error('Invalid placed-tree row');
    const [x, y, renderIndex, kind, sourceX, sourceY] = row;
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isInteger(renderIndex) ||
      renderIndex < 0 ||
      !Number.isInteger(kind) ||
      kind < 0 ||
      kind >= PLACED_KINDS.length ||
      !Number.isFinite(sourceX) ||
      !Number.isFinite(sourceY)
    )
      throw new Error('Invalid placed-tree row');
    return {
      x,
      y,
      renderIndex,
      orchard: kind === 1,
      conifer: kind === 2,
      source: [sourceX, sourceY]
    };
  });
  return {
    trees,
    excluded: { ...data.excluded },
    detectionsSha256: data.detectionsSha256,
    terrainSha256: data.terrainSha256,
    crownRadius: data.crownRadius
  };
}
