import { MAP, buildings } from './ilmer-1839-data.js';

export function circleOverlapsTriangles(x, z, radius, triangles) {
  const edgeDistance = (a, b) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const denominator = dx * dx + dz * dz;
    const t = denominator === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / denominator));
    return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
  };
  return triangles.some(([a, b, c]) => {
    const cross = (p, q) => (q[0] - p[0]) * (z - p[1]) - (q[1] - p[1]) * (x - p[0]);
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
export function validateTrees(data) {
  const point = (value) => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
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
    !controlPoints.every((control) => point(control.source) && point(control.target)) ||
    matrix.length !== 2 ||
    !matrix.every((row) => Array.isArray(row) && row.length === 3 && row.every(Number.isFinite)) ||
    !data.detections.every(
      (tree) =>
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
    const [x, y] = registerMapTree(data, ...control.source);
    if (Math.hypot(x - control.target[0], y - control.target[1]) > 0.5)
      throw new Error('Detected-tree registration misses its control points');
  }
  return data;
}

/** Tithe-map pixel position of a point on the Ordnance Survey map. */
export function registerMapTree(data, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Invalid tree registration coordinate');
  return data.registration.matrix.map((row) => row[0] * x + row[1] * y + row[2]);
}

export function historicalTrees(data) {
  const trees = [];
  const excluded = { outsideCrop: 0, building: 0 };
  const footprints = buildings.flatMap((building) => [...building.parts, ...(building.projections ?? [])]);
  footprints.push([957, 507, 70, 43, 21, 0]);
  data.detections.forEach((detection, index) => {
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
