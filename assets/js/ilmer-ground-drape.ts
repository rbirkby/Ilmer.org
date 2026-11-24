// Drapes flat map geometry onto the historical terrain grid. The 1839 page builds its road and field
// meshes from these functions, and the tree-placement script uses the same ones, so a verge clearance
// computed ahead of time still matches the roads the page draws.

import type * as Three from 'three';
import type { TerrainGrid } from './ilmer-terrain.ts';
import type { Point, Triangle } from './ilmer-trees.ts';

type GroundHeight = (x: number, z: number) => number;
type MapPoint = (x: number, y: number) => Point;

export function drapeOntoTerrain(
  THREE: typeof Three,
  terrain: TerrainGrid,
  groundHeight: GroundHeight,
  sourceGeometry: Three.BufferGeometry,
  elevation: number,
  fixedHeight: number | null = null
) {
  const position = sourceGeometry.getAttribute('position');
  const vertices: number[] = [];
  const dx = terrain.width / (terrain.columns - 1);
  const dz = terrain.depth / (terrain.rows - 1);
  let maxDrapeError = 0;
  function clippedPolygon(polygon: Point[], clip: Point[]) {
    const cross = (a: Point, b: Point, p: Point) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
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
    const corners = [0, 1, 2].map((offset): Point => [position.getX(i + offset), -position.getY(i + offset)]);
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
        const a: Point = [-terrain.width / 2 + col * dx, -terrain.depth / 2 + row * dz];
        const b: Point = [a[0], a[1] + dz];
        const c: Point = [a[0] + dx, a[1] + dz];
        const d: Point = [a[0] + dx, a[1]];
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
    const positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      maxDrapeError = Math.max(
        maxDrapeError,
        Math.abs(positions.getY(i) - groundHeight(positions.getX(i), positions.getZ(i)) - elevation)
      );
    }
  }
  return { geometry, maxDrapeError };
}

export function drapeMapPolygon(
  THREE: typeof Three,
  terrain: TerrainGrid,
  groundHeight: GroundHeight,
  mapPoint: MapPoint,
  points: readonly (readonly number[])[],
  elevation: number,
  fixedHeight: number | null = null
) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => {
    const [wx, wz] = mapPoint(x, y);
    if (i === 0) shape.moveTo(wx, -wz);
    else shape.lineTo(wx, -wz);
  });
  shape.closePath();
  const outline = new THREE.ShapeGeometry(shape);
  const draped = drapeOntoTerrain(THREE, terrain, groundHeight, outline.toNonIndexed(), elevation, fixedHeight);
  outline.dispose();
  return draped;
}

export function drapeTrack(
  THREE: typeof Three,
  terrain: TerrainGrid,
  groundHeight: GroundHeight,
  mapPoint: MapPoint,
  points: readonly (readonly number[])[],
  width: number,
  elevation: number
) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y]) => {
      const [wx, wz] = mapPoint(x, y);
      return new THREE.Vector3(wx, elevation, wz);
    }),
    false,
    'centripetal'
  );
  const samples = curve.getPoints(Math.max(points.length * 12, Math.ceil(curve.getLength())));
  const vertices: number[] = [];
  const indices: number[] = [];
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
  const flatPositions = flat.getAttribute('position');
  for (let i = 0; i < flatPositions.count; i++) {
    flatPositions.setXYZ(i, flatPositions.getX(i), -flatPositions.getZ(i), 0);
  }
  const draped = drapeOntoTerrain(THREE, terrain, groundHeight, flat, elevation);
  geometry.dispose();
  return draped;
}

export function trianglesXZ(geometry: Three.BufferGeometry) {
  const positions = geometry.getAttribute('position');
  const triangles: Triangle[] = [];
  for (let i = 0; i < positions.count; i += 3) {
    triangles.push([0, 1, 2].map((offset) => [positions.getX(i + offset), positions.getZ(i + offset)]));
  }
  return triangles;
}
