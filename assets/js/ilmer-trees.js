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

export function validateTrees(data) {
  if (
    data?.source?.year !== 1876 ||
    !Array.isArray(data.detections) ||
    !Array.isArray(data.registration?.controlPoints) ||
    !Array.isArray(data.registration?.controlTargets) ||
    !Array.isArray(data.registration?.triangles) ||
    !Array.isArray(data.registration?.matrix)
  )
    throw new Error('Invalid detected-tree data');
  const { controlPoints, controlTargets, triangles, matrix } = data.registration;
  const point = (value) => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
  if (
    controlPoints.length < 3 ||
    triangles.length === 0 ||
    controlPoints.length !== controlTargets.length ||
    !controlPoints.every(point) ||
    !controlTargets.every(point) ||
    matrix.length !== 2 ||
    !matrix.every((row) => Array.isArray(row) && row.length === 3 && row.every(Number.isFinite)) ||
    !triangles.every(
      (triangle) =>
        Array.isArray(triangle) &&
        triangle.length === 3 &&
        triangle.every((index) => Number.isInteger(index) && index >= 0 && index < controlPoints.length)
    ) ||
    !data.detections.every(
      (tree) =>
        Number.isFinite(tree.x) &&
        Number.isFinite(tree.y) &&
        tree.x >= 0 &&
        tree.x < 2000 &&
        tree.y >= 0 &&
        tree.y < 1126 &&
        ['tree', 'orchard', 'conifer'].includes(tree.kind)
    )
  )
    throw new Error('Invalid detected-tree coordinates');
  if (matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0] <= 0)
    throw new Error('Detected-tree registration folds or reflects the map');
  for (const triangle of triangles) {
    const area = (points) => {
      const [a, b, c] = triangle.map((index) => points[index]);
      return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    };
    if (area(controlPoints) * area(controlTargets) <= 0)
      throw new Error('Detected-tree registration folds or reflects the map');
  }
  return data;
}

export function register1876Tree(data, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Invalid 1876 tree registration coordinate');
  const { controlPoints, controlTargets, triangles, matrix } = data.registration;
  for (const triangle of triangles) {
    const [a, b, c] = triangle.map((index) => controlPoints[index]);
    const determinant = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    const u = ((x - a[0]) * (c[1] - a[1]) - (y - a[1]) * (c[0] - a[0])) / determinant;
    const v = ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) / determinant;
    if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8) {
      const [targetA, targetB, targetC] = triangle.map((index) => controlTargets[index]);
      return [0, 1].map(
        (axis) => targetA[axis] + u * (targetB[axis] - targetA[axis]) + v * (targetC[axis] - targetA[axis])
      );
    }
  }
  return matrix.map((row) => row[0] * x + row[1] * y + row[2]);
}

export function historicalTrees(data) {
  const trees = [];
  const excluded = { outsideCrop: 0, building: 0 };
  const footprints = buildings.flatMap((building) => [...building.parts, ...(building.projections ?? [])]);
  footprints.push([957, 507, 70, 43, 21, 0]);
  data.detections.forEach((detection, index) => {
    const [x, y] = register1876Tree(data, detection.x, detection.y);
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
