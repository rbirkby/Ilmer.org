import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { MAP, mapPoint, ponds, roadPolygons, tracks } from '../assets/js/ilmer-1839-data.ts';
import { drapeMapPolygon, drapeTrack, trianglesXZ } from '../assets/js/ilmer-ground-drape.ts';
import { historicalTerrain, terrainHeight, validateTerrain } from '../assets/js/ilmer-terrain.ts';
import type { MeasuredTerrain } from '../assets/js/ilmer-terrain.ts';
import { circleOverlapsTriangles, createTreeCrown, historicalTrees, validateTrees } from '../assets/js/ilmer-trees.ts';
import type { HistoricalTree, PlacedTreeData, Point, Triangle } from '../assets/js/ilmer-trees.ts';
import type { TerrainGrid } from '../assets/js/ilmer-terrain.ts';
import { withinField } from '../assets/js/ilmer-livestock.ts';
import { rideCircuitLength, rideCircuitPoint } from '../assets/js/ilmer-ride.ts';

const TREE_VERGE_SHIFT = 5;

interface RenderedTree extends HistoricalTree {
  renderIndex: number;
  vergeShift?: number;
}

interface TreeExclusions {
  outsideCrop: number;
  building: number;
}

export function cartCorridorTriangles() {
  const cartCorridor: Triangle[] = [];
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
  return cartCorridor;
}

export function placementRoadTriangles(terrain: TerrainGrid, groundHeight: (x: number, z: number) => number) {
  const roadTriangles: Triangle[] = [];
  for (const polygon of roadPolygons) {
    const draped = drapeMapPolygon(terrain, groundHeight, mapPoint, polygon, 0.14);
    roadTriangles.push(...trianglesXZ(draped.geometry));
    draped.geometry.dispose();
  }
  for (const track of tracks) {
    const draped = drapeTrack(terrain, groundHeight, mapPoint, track, 1.5, 0.14);
    roadTriangles.push(...trianglesXZ(draped.geometry));
    draped.geometry.dispose();
  }
  return roadTriangles;
}

/**
 * The verge-clearance pass the 1839 page used to run on every load. There is no random draw:
 * each symbol is kept, stepped onto the verge, or dropped by the same fixed trials.
 */
export function placeDetectedTrees({
  detectedTrees,
  excluded,
  roadTriangles,
  cartCorridor,
  pondPolygons,
  crownRadius,
  terrain
}: {
  detectedTrees: HistoricalTree[];
  excluded: TreeExclusions;
  roadTriangles: readonly Triangle[];
  cartCorridor: readonly Triangle[];
  pondPolygons: Point[][];
  crownRadius: number;
  terrain: TerrainGrid;
}) {
  const treeSize = (tree: RenderedTree) => (tree.orchard ? 3.5 : 5.5 + (tree.renderIndex % 3) * 0.5);
  const dryTrees = detectedTrees.filter(
    (tree) => !pondPolygons.some((polygon) => withinField(polygon, ...mapPoint(tree.x, tree.y)))
  );
  const resultExcluded: PlacedTreeData['excluded'] = {
    ...excluded,
    water: detectedTrees.length - dryTrees.length,
    road: 0,
    shiftedToVerge: 0
  };
  const clearOfRoad = (x: number, z: number, radius: number) =>
    !circleOverlapsTriangles(x, z, radius, roadTriangles) && !circleOverlapsTriangles(x, z, radius, cartCorridor);
  let shiftedTrees = 0;
  const trees = dryTrees
    .map((tree, renderIndex): RenderedTree => ({ ...tree, renderIndex }))
    .flatMap((tree): RenderedTree[] => {
      const [x, z] = mapPoint(tree.x, tree.y);
      const radius = treeSize(tree) * (tree.conifer ? 0.3 : 0.4 * crownRadius);
      if (clearOfRoad(x, z, radius)) return [tree];
      for (let shift = 0.5; shift <= TREE_VERGE_SHIFT; shift += 0.5) {
        for (let step = 0; step < 16; step++) {
          const angle = (step / 16) * Math.PI * 2;
          const sx = x + Math.cos(angle) * shift;
          const sz = z + Math.sin(angle) * shift;
          if (
            clearOfRoad(sx, sz, radius) &&
            !pondPolygons.some((polygon) => withinField(polygon, sx, sz)) &&
            Math.abs(sx) < terrain.width / 2 - 1 &&
            Math.abs(sz) < terrain.depth / 2 - 1
          ) {
            shiftedTrees++;
            return [
              {
                ...tree,
                x: sx / MAP.scale + MAP.width / 2,
                y: sz / MAP.scale + MAP.height / 2,
                vergeShift: shift
              }
            ];
          }
        }
      }
      return [];
    });
  resultExcluded.road = dryTrees.length - trees.length;
  resultExcluded.shiftedToVerge = shiftedTrees;
  return { trees, excluded: resultExcluded };
}

function sha256(bytes: string) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function buildPlacedTrees({ terrainText, treeText }: { terrainText: string; treeText: string }) {
  const terrain = historicalTerrain(validateTerrain<MeasuredTerrain>(JSON.parse(terrainText)));
  const treeData = validateTrees(JSON.parse(treeText));
  const groundHeight = (x: number, z: number) => terrainHeight(terrain, x, z);
  const { trees: detectedTrees, excluded } = historicalTrees(treeData);
  const { crownRadius, geometry } = createTreeCrown();
  geometry.dispose();
  const placed = placeDetectedTrees({
    detectedTrees,
    excluded,
    roadTriangles: placementRoadTriangles(terrain, groundHeight),
    cartCorridor: cartCorridorTriangles(),
    pondPolygons: ponds.map((pond) => pond.map(([x, y]) => mapPoint(x, y))),
    crownRadius,
    terrain
  });
  return {
    description:
      'Tree positions for the 1839 reconstruction, cleared of roads, the cart route and ponds. Regenerate with `node scripts/build-ilmer-placed-trees.ts` when detected symbols, terrain, roads, ponds, the cart route or the crown mesh change. The page loads this file and does not place trees itself.',
    detectionsSha256: sha256(treeText),
    terrainSha256: sha256(terrainText),
    crownRadius,
    excluded: placed.excluded,
    trees: placed.trees.map((tree) => [
      tree.x,
      tree.y,
      tree.renderIndex,
      tree.conifer ? 2 : tree.orchard ? 1 : 0,
      tree.source[0],
      tree.source[1]
    ])
  };
}

export function buildPlacedTreesFromFiles() {
  const terrainText = readFileSync(new URL('../assets/ilmer-terrain.json', import.meta.url), 'utf8');
  const treeText = readFileSync(new URL('../assets/ilmer-trees.json', import.meta.url), 'utf8');
  return buildPlacedTrees({ terrainText, treeText });
}
