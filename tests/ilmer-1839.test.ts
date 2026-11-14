import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  MAP,
  CHURCH_PORCH_SIDE,
  CHURCH_PLAN,
  mapPoint,
  timberPlinthHeight,
  spacedWindowCentres,
  places,
  buildings,
  lanes,
  tracks,
  roadEvidence,
  roadPolygons,
  boundaryEvidence,
  fieldBoundaries,
  roadEdges,
  churchyard,
  ponds
} from '../assets/js/ilmer-1839-data.js';
import { validateTerrain, historicalTerrain, terrainHeight } from '../assets/js/ilmer-terrain.js';
import { validateTrees, register1876Tree, historicalTrees, circleOverlapsTriangles } from '../assets/js/ilmer-trees.js';
import {
  ridePath,
  ridePoint,
  rideLength,
  rideStart,
  rideEnd,
  rideSpeed,
  rideCircuitPoint,
  rideCircuitLength
} from '../assets/js/ilmer-ride.js';
import { cameraFloor, cameraGroundClearance } from '../assets/js/ilmer-camera.js';
import { flightStops, flightProgress } from '../assets/js/ilmer-flight.js';
import { withinField } from '../assets/js/ilmer-livestock.js';

test('historical terrain removes only the eastern modern embankment and keeps the measured source intact', () => {
  const measured = JSON.parse(readFileSync('assets/ilmer-terrain.json', 'utf8'));
  const original = measured.elevations.slice();
  const historical = historicalTerrain(measured);
  assert.deepEqual(measured.elevations, original);
  assert.ok(historical.historicalCorrection.maxRemoval > 5);
  for (let row = 0; row < measured.rows; row++) {
    const along = row / (measured.rows - 1);
    const left = 1880 - 80 * along;
    const right = 1990 - 50 * along;
    for (let col = 0; col < measured.columns; col++) {
      const x = (col * 2000) / (measured.columns - 1);
      const index = row * measured.columns + col;
      if (x <= left || x >= right) assert.equal(historical.elevations[index], original[index]);
      else if (x > left + (right - left) * 0.12 && x < right - (right - left) * 0.12) {
        const [ax, az] = mapPoint(left, along * 882);
        const [bx, bz] = mapPoint(right, along * 882);
        const a = terrainHeight(measured, ax, az) + measured.baseElevation;
        const b = terrainHeight(measured, bx, bz) + measured.baseElevation;
        assert.ok(historical.elevations[index] >= Math.min(a, b) - 1e-8);
        assert.ok(historical.elevations[index] <= Math.max(a, b) + 1e-8);
      }
    }
  }
  const [x, z] = mapPoint(1880, 683);
  assert.ok(terrainHeight(measured, x, z) - terrainHeight(historical, x, z) > 5);
  assert.equal(terrainHeight(historical, ...mapPoint(957, 507)), terrainHeight(measured, ...mapPoint(957, 507)));
  assert.equal(terrainHeight(historical, ...mapPoint(1468, 644)), terrainHeight(measured, ...mapPoint(1468, 644)));
  assert.ok(cameraFloor(historical, x, z) > terrainHeight(historical, x, z));
});

test('roof-height tour visits every mapped footprint including unnamed buildings', () => {
  const stops = flightStops();
  assert.equal(
    stops.length,
    buildings.reduce((count, building) => count + building.parts.length, 1)
  );
  assert.equal(new Set(stops.map((stop) => stop.id)).size, stops.length);
  assert.equal(stops[0].id, 'church');
  buildings.forEach((building, group) =>
    building.parts.forEach(([x, y], part) => {
      const stop = stops.find((stop) => stop.id === `building-${group}-${part}`);
      assert.ok(stop);
      const [wx, wz] = mapPoint(x, y);
      assert.equal(stop.target[0], wx);
      assert.equal(stop.target[2], wz);
    })
  );
  assert.ok(stops.some((stop) => stop.place === 'outbuilding'));
  const visited = new Set();
  for (let elapsed = 0; elapsed < stops.length * 6; elapsed += 0.1)
    visited.add(flightProgress(elapsed, stops.length).index);
  assert.equal(visited.size, stops.length);
  assert.deepEqual(flightProgress(stops.length * 6, stops.length), { index: 0, next: 1, fraction: 0 });
  assert.equal(flightProgress(5, stops.length).fraction, 1);
  assert.throws(() => flightProgress(NaN, stops.length), /Invalid flying tour/);
});

test('road clearance removes crown-edge overlaps as well as trunks inside actual road triangles', () => {
  const triangles = [
    [
      [0, 0],
      [10, 0],
      [0, 10]
    ]
  ];
  assert.ok(circleOverlapsTriangles(1, 1, 0.2, triangles));
  assert.ok(circleOverlapsTriangles(5, -1, 1.1, triangles));
  assert.equal(circleOverlapsTriangles(5, -2, 1.1, triangles), false);
  assert.ok(circleOverlapsTriangles(10.3, 0, 0.4, triangles));
  assert.equal(
    circleOverlapsTriangles(100, 0, 1, [
      [
        [0, 0],
        [1, 0],
        [2, 0]
      ]
    ]),
    false
  );
});

test('camera floor follows sloping terrain and safely clamps outside the crop', () => {
  const terrain = validateTerrain({
    columns: 2,
    rows: 2,
    width: 2,
    depth: 2,
    baseElevation: 80,
    verticalUnitsPerMetre: 1,
    verticalExaggeration: 1,
    elevations: [80, 84, 88, 96]
  });
  assert.equal(cameraFloor(terrain, -1, -1), cameraGroundClearance);
  assert.equal(cameraFloor(terrain, 1, 1), 16 + cameraGroundClearance);
  assert.equal(cameraFloor(terrain, 0, 0), 6 + cameraGroundClearance);
  assert.equal(cameraFloor(terrain, 30, 30), 16 + cameraGroundClearance);
});

test('cart circuit turns continuously at both ends and returns along the roads', () => {
  const straight = rideEnd - rideStart;
  const arc = Math.PI * 1.3;
  const distanceToRoad = ([x, z]: number[]) =>
    Math.min(
      ...ridePath.slice(1).map(([bx, bz], i) => {
        const [ax, az] = ridePath[i];
        const t = Math.max(
          0,
          Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2))
        );
        return Math.hypot(x - ax - t * (bx - ax), z - az - t * (bz - az));
      })
    );
  for (let d = 0; d < rideCircuitLength; d += 0.1) assert.ok(distanceToRoad(rideCircuitPoint(d)) <= 1.301);
  for (const join of [0, straight, straight + arc, 2 * straight + arc, rideCircuitLength]) {
    const before = rideCircuitPoint(join - 0.001),
      after = rideCircuitPoint(join + 0.001);
    assert.ok(Math.hypot(after[0] - before[0], after[1] - before[1]) < 0.003);
  }
  const forwardA = rideCircuitPoint(100),
    forwardB = rideCircuitPoint(101);
  const backA = rideCircuitPoint(straight + arc + 100),
    backB = rideCircuitPoint(straight + arc + 101);
  assert.ok(forwardB[0] > forwardA[0]);
  assert.ok(backB[0] < backA[0]);
  assert.deepEqual(rideCircuitPoint(0), rideCircuitPoint(rideCircuitLength));
  assert.throws(() => rideCircuitPoint(NaN), /Invalid cart journey distance/);
});

test('cart journey connects both ends of the village using only existing road segments', () => {
  const expected = [...lanes[0], ...lanes[3].slice(1)].map(([x, y]) => mapPoint(x, y));
  assert.deepEqual(ridePath, expected);
  assert.deepEqual(ridePoint(0), expected[0]);
  assert.deepEqual(ridePoint(rideLength), expected.at(-1));
  assert.deepEqual(ridePoint(-10), expected[0]);
  assert.deepEqual(ridePoint(rideLength + 10), expected.at(-1));
  assert.throws(() => ridePoint(NaN), /Invalid cart journey distance/);
  assert.throws(() => ridePoint(Infinity), /Invalid cart journey distance/);
  assert.ok(rideStart > 4.6 && rideEnd + 4.6 < rideLength);
  assert.ok((rideEnd - rideStart) / rideSpeed > 100 && (rideEnd - rideStart) / rideSpeed < 140);
  const terrain = validateTerrain(
    JSON.parse(readFileSync(new URL('../assets/ilmer-terrain.json', import.meta.url), 'utf8'))
  );
  for (let distance = rideStart; distance < rideEnd; distance += 0.7) {
    const [x, z] = ridePoint(distance);
    assert.ok(Number.isFinite(terrainHeight(terrain, x, z)));
    assert.ok(
      ridePath.slice(1).some(([bx, bz], i) => {
        const [ax, az] = ridePath[i];
        const fraction = ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2);
        return (
          fraction >= -1e-8 &&
          fraction <= 1 + 1e-8 &&
          Math.hypot(x - (ax + fraction * (bx - ax)), z - (az + fraction * (bz - az))) < 1e-8
        );
      })
    );
  }
});

test('cart journey controls remain separate from the existing place and map controls', () => {
  const page = readFileSync(new URL('../history/ilmer-1839.liquid', import.meta.url), 'utf8');
  assert.match(page, /aria-label="Horse and cart journey"/);
  assert.match(page, /id="ride-pause"[^>]*hidden disabled/);
  assert.doesNotMatch(page, /id="ride-toggle"|id="ride-stop"|Ride by horse|Leave cart/);
  assert.doesNotMatch(page, /id="ride-sound"|Mute ride sounds|Enable ride sounds/);
  assert.match(page, /Double-click or double-tap the horse and cart/);
  assert.match(page, /id="ride-status" role="status"/);
  assert.doesNotMatch(page, /id="village-cart"/);
  const script = readFileSync(new URL('../assets/js/ilmer-1839.js', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /villageCart|name === 'village'.*startVillageCart/);
  assert.doesNotMatch(script, /Riding past the church and Lower Farm, turning back at each end/);
});

test('map coordinate transform preserves the crop aspect and downward pixel direction', () => {
  assert.deepEqual(mapPoint(1000, 441), [0, 0]);
  assert.deepEqual(mapPoint(0, 0), [-320, -141.12]);
  assert.deepEqual(mapPoint(2000, 882), [320, 141.12]);
  assert.deepEqual(mapPoint(957, 507), [-13.76, 21.12]);
});

test('all traced building ranges have valid positions, dimensions and evidence notes', () => {
  assert.equal(buildings.length, 28);
  for (const building of buildings) {
    assert.ok(Object.hasOwn(places, building.place));
    for (const [x, y, length, width, angle, height] of building.parts) {
      assert.ok(x >= 0 && x <= MAP.width && y >= 0 && y <= MAP.height);
      assert.ok(length > 0 && width > 0 && height > 0);
      assert.ok(Number.isFinite(angle));
    }
  }
  assert.equal(buildings.filter((building) => building.place === 'barns').length, 9);
  assert.match(places.church.description, /photographs do not establish/);
  assert.match(places.barns.description, /conjectural/);
});

test('landscape traces stay within the supplied map crop', () => {
  for (const path of [
    ...lanes,
    ...tracks,
    ...fieldBoundaries,
    ...roadEdges.flatMap(({ left, right }) => [left, right]),
    churchyard,
    ...ponds
  ]) {
    assert.ok(path.length >= 2);
    for (const [x, y] of path) {
      assert.ok(x >= 0 && x <= MAP.width && y >= 0 && y <= MAP.height);
    }
  }
});

test('cottages pond traces the complete northern 1839 outline and cart has no scene label', () => {
  assert.equal(ponds[0].length, 25);
  assert.deepEqual(
    [
      Math.min(...ponds[0].map(([x]) => x)),
      Math.max(...ponds[0].map(([x]) => x)),
      Math.min(...ponds[0].map(([, y]) => y)),
      Math.max(...ponds[0].map(([, y]) => y))
    ],
    [685, 775, 221, 333]
  );
  const script = readFileSync(new URL('../assets/js/ilmer-1839.js', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /cartLabel|label\('Horse & cart'/);
});

test('the experience retains accessible controls and locally served Three.js without the evidence section', () => {
  const page = readFileSync(new URL('../history/ilmer-1839.liquid', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../assets/js/ilmer-1839.js', import.meta.url), 'utf8');
  for (const view of ['village', 'church', 'barns', 'middle', 'lower', 'cottages', 'tenements', 'vicarage', 'plan'])
    assert.ok(page.includes(`data-view="${view}"`));
  assert.match(page, /role="status"/);
  assert.match(page, /<noscript>/);
  assert.match(page, /Historical interpretation, not a measured survey/);
  assert.match(page, /ancestorCrumb1Source: \{ label: 'Fields and Farming', url: '\/history\/fields-farming\/' \}/);
  assert.doesNotMatch(page, /reconstruction-evidence|reconstruction-sources|Reading the evidence|What we know/);
  assert.doesNotMatch(page, /<img|notes are below|available below|tree-registration\.png|tree-detections\.png/);
  assert.match(page, /id="map-layer"/);
  assert.doesNotMatch(page, /id="landscape-layer"/);
  assert.doesNotMatch(script, /landscape\.visible =/);
  assert.match(page, /id="flight-toggle"[^>]*>Historic Tour/);
  assert.doesNotMatch(page, /data-view="(?:west|chancel)"|A rider's-eye journey|A roof-height tour/);
  assert.match(page, /assets\/vendor\/three\/three.module.js/);
  for (const source of ['tithe-map']) {
    assert.ok(readFileSync(new URL(`../public/images/ilmer-1839/${source}.avif`, import.meta.url)).length > 1000);
  }
});

test('the church entrance is opposite the original side and dated road evidence is explicit', () => {
  assert.equal(CHURCH_PORCH_SIDE, -1);
  assert.equal(roadEvidence.sourceYear, 1839);
  assert.equal(roadEvidence.supportingSourceYear, 1876);
  assert.equal(boundaryEvidence.sourceYear, 1839);
  assert.equal(roadEvidence.churchLocation, 66);
  assert.equal(roadEvidence.supportingChurchLocation, 55);
  assert.match(roadEvidence.registration, /not georectified/);
  // The old diagonal through the churchyard is no longer a road.
  assert.ok(!lanes.flat().some(([x, y]) => x === 913 && y === 538));
  assert.ok(lanes.filter((lane) => lane.some(([x, y]) => x === 1088 && y === 513)).length >= 3);
});

test('cart and horse paths stay inside the traced, variable-width tithe-road surface in both directions', () => {
  const polygons = roadPolygons.map((polygon) => polygon.map(([x, y]) => mapPoint(x, y)));
  for (let distance = 0; distance < rideCircuitLength; distance += 0.1) {
    const [x, z] = rideCircuitPoint(distance);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const px = x + Math.sin(angle) * 0.8;
      const pz = z + Math.cos(angle) * 0.8;
      assert.ok(
        polygons.some((polygon) => withinField(polygon, px, pz)),
        `Off-road at map ${px / MAP.scale + 1000},${pz / MAP.scale + 441}`
      );
    }
  }
});

test('field hedge traces do not run along road or farm-access edges', () => {
  const edges = roadEdges
    .flatMap(({ left, right }) => [left, right])
    .flatMap((path) => path.slice(1).map((b, index) => [path[index], b]));
  for (const field of fieldBoundaries) {
    for (let index = 1; index < field.length; index++) {
      const [a, b] = [field[index - 1], field[index]];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 4) continue;
      const mx = (a[0] + b[0]) / 2,
        my = (a[1] + b[1]) / 2;
      for (const [c, d] of edges) {
        const dx = d[0] - c[0],
          dy = d[1] - c[1],
          edgeLength = Math.hypot(dx, dy);
        const t = ((mx - c[0]) * dx + (my - c[1]) * dy) / (edgeLength * edgeLength);
        if (t < 0 || t > 1) continue;
        const distance = Math.hypot(mx - c[0] - t * dx, my - c[1] - t * dy);
        const alignment = Math.abs(((b[0] - a[0]) * dx + (b[1] - a[1]) * dy) / (length * edgeLength));
        assert.ok(distance >= 3 || alignment <= 0.92, `Roadside hedge at map ${mx},${my}`);
      }
    }
  }
});

test('the connected road outline has no crossed edges or folded junctions', () => {
  const cross = (a: number[], b: number[], c: number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (const polygon of roadPolygons) {
    for (let i = 0; i < polygon.length; i++) {
      for (let j = i + 2; j < polygon.length; j++) {
        const [a, b, c, d] = [
          polygon[i],
          polygon[(i + 1) % polygon.length],
          polygon[j],
          polygon[(j + 1) % polygon.length]
        ];
        const crossed = cross(a, b, c) * cross(a, b, d) < -1e-6 && cross(c, d, a) * cross(c, d, b) < -1e-6;
        assert.ok(!crossed, `Crossed road outline near map ${a},${c}`);
      }
    }
  }
});

test('property descriptions are not rendered over the scene in any selection state', () => {
  const page = readFileSync(new URL('../history/ilmer-1839.liquid', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../assets/js/ilmer-1839.js', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /reconstruction-card|place-description|place-title/);
  assert.doesNotMatch(script, /place-description|place-title|BoxHelper/);
});

test('place labels render after transparent foliage without testing or writing scene depth', () => {
  const script = readFileSync(new URL('../assets/js/ilmer-1839.js', import.meta.url), 'utf8');
  assert.match(script, /SpriteMaterial\(\{[^}]*depthTest: false, depthWrite: false/);
  assert.match(script, /sprite\.renderOrder = 1000/);
});

test('terrain interpolation matches the triangles used by the rendered ground', () => {
  const data = validateTerrain({
    columns: 2,
    rows: 2,
    width: 2,
    depth: 2,
    baseElevation: 80,
    verticalUnitsPerMetre: 1,
    verticalExaggeration: 1,
    elevations: [80, 84, 88, 96]
  });
  assert.equal(terrainHeight(data, -1, -1), 0);
  assert.equal(terrainHeight(data, 1, 1), 16);
  assert.equal(terrainHeight(data, 0, 0), 6);
  assert.equal(terrainHeight(data, 0.5, 0.5), 11);
  assert.throws(() => terrainHeight(data, 2, 0), /outside measured terrain/);
  assert.throws(() => validateTerrain({ ...data, elevations: [NaN, 84, 88, 96] }), /Invalid measured terrain/);
  assert.throws(() => validateTerrain({ ...data, elevations: [80] }), /Invalid measured terrain/);
});

test('authentic measured terrain places the church higher than adjoining farmyards without exaggeration', () => {
  const data = validateTerrain(
    JSON.parse(readFileSync(new URL('../assets/ilmer-terrain.json', import.meta.url), 'utf8'))
  );
  assert.equal(data.source.sourceResolutionMetres, 1);
  assert.match(data.source.name, /Environment Agency.*DTM/);
  assert.equal(data.source.sha256.length, 64);
  assert.match(data.source.registration, /Not a georectified/);
  assert.equal(data.elevations.length, 201 * 89);
  assert.ok(data.maxElevation - data.minElevation > 8);
  assert.ok(data.maxElevation - data.minElevation < 10);
  const church = terrainHeight(data, ...mapPoint(957, 507)) + data.baseElevation;
  assert.ok(Math.abs(church - 84.995) < 0.1);
  for (const [x, y] of [
    [1150, 620],
    [1542, 636],
    [804, 522]
  ]) {
    assert.ok(church - (terrainHeight(data, ...mapPoint(x, y)) + data.baseElevation) > 0.9);
  }
});

test('the corrected houses override boarded farm architecture without invented storeys', () => {
  assert.deepEqual(
    buildings.filter((building) => building.architecture).map((building) => [building.place, building.architecture]),
    [
      ['barns', 'stone-house'],
      ['middle', 'tudor'],
      ['lower', 'stone-house'],
      ['vicarage', 'vicarage']
    ]
  );
  assert.match(places.middle.description, /exposed dark timber framing/);
  assert.match(places.vicarage.description, /two-storey brick and stone house with windows on both floors/);
  assert.equal(buildings.find((building) => building.architecture === 'vicarage')?.storeys, 2);
  const scene = readFileSync(new URL('../assets/js/ilmer-1839.js', import.meta.url), 'utf8');
  const vicarage = scene.slice(scene.indexOf('} else if (vicarage) {'), scene.indexOf('} else if (stoneHouse) {'));
  assert.match(vicarage, /for \(const level of \[height \* 0\.25, height \* 0\.73\]\)/);
  assert.match(vicarage, /windowPanel\(part, x, level/);
  const upperHouse = buildings.find(
    (building) => building.place === 'barns' && building.architecture === 'stone-house'
  );
  assert.ok(upperHouse);
  assert.deepEqual(upperHouse.parts, [[855, 715, 35, 25, 15, 5.5]]);
  assert.equal(upperHouse.projections?.length, 1);
  assert.equal(upperHouse.storeys, undefined);
  const lowerHouse = buildings.find(
    (building) => building.place === 'lower' && building.architecture === 'stone-house'
  );
  assert.ok(lowerHouse);
  assert.equal(lowerHouse.storeys, 2);
  assert.deepEqual(lowerHouse.parts, [[1468, 644, 38, 19, -4, 7]]);
  assert.equal(buildings.filter((building) => building.place === 'lower' && !building.architecture).length, 5);
});

test('mapped projecting wings are not flattened back into the main rectangular blocks', () => {
  const contains = (part: number[], x: number, y: number) => {
    const [cx, cy, length, width, angle] = part;
    const rotation = (angle * Math.PI) / 180;
    const u = (x - cx) * Math.cos(rotation) + (y - cy) * Math.sin(rotation);
    const v = -(x - cx) * Math.sin(rotation) + (y - cy) * Math.cos(rotation);
    return Math.abs(u) <= length / 2 && Math.abs(v) <= width / 2;
  };
  for (const [place, x, y] of [
    ['barns', 746, 698],
    ['barns', 851, 770],
    ['middle', 1182, 695],
    ['middle', 1214, 722],
    ['lower', 1579, 605]
  ] as const) {
    const group = buildings.find(
      (building) => building.place === place && building.projections?.some((part) => contains(part, x, y))
    );
    assert.ok(group, `Missing mapped projection at ${x},${y}`);
    assert.ok(
      !group.parts.some((part) => contains(part, x, y)),
      `Regression point is not outside the original core at ${x},${y}`
    );
  }
});

test('the whole church plan fits the red nave, chancel and porch extents rather than using the nave as its centre', () => {
  const angle = (CHURCH_PLAN.angle * Math.PI) / 180;
  const corners = [
    [0, 0, 11.5, 7.2],
    [8.1, 0, 5.2, 6],
    [-0.5, -5, 3.3, 3.1]
  ].flatMap(([x, z, length, width]) =>
    [
      [-length / 2, -width / 2],
      [length / 2, -width / 2],
      [length / 2, width / 2],
      [-length / 2, width / 2]
    ].map(([u, v]) => {
      const a = (x + u) / MAP.scale;
      const b = ((z + v) * CHURCH_PLAN.widthScale) / MAP.scale;
      return [
        CHURCH_PLAN.centre[0] + a * Math.cos(angle) - b * Math.sin(angle),
        CHURCH_PLAN.centre[1] + a * Math.sin(angle) + b * Math.cos(angle)
      ];
    })
  );
  assert.ok(Math.abs(Math.min(...corners.map(([x]) => x)) - 929) < 2);
  assert.ok(Math.abs(Math.max(...corners.map(([x]) => x)) - 984) < 2);
  assert.ok(Math.abs(Math.min(...corners.map(([, y]) => y)) - 489) < 2);
});

test('small boarded barns have no brick bases while larger ranges retain their grumplings', () => {
  for (const [length, width] of [
    [10, 13],
    [19, 16],
    [35, 29],
    [28, 19],
    [12, 27]
  ])
    assert.equal(timberPlinthHeight(length, width), 0);
  for (const [length, width] of [
    [84, 18],
    [43, 25],
    [46, 14],
    [18, 40]
  ])
    assert.equal(timberPlinthHeight(length, width), 0.6096);
  const script = readFileSync(new URL('../assets/js/ilmer-1839.js', import.meta.url), 'utf8');
  assert.match(script, /barnPlinthHeight \? brick : timber/);
  assert.match(script, /height - barnPlinthHeight/);
  assert.match(script, /ivyLeavesByWall = climbingIvy\(part, l, w, height\)/);
  assert.match(places.lower.description, /abundant climbing ivy/);
});

test('named cottages and farm controls follow the apportionment without old numeric button prefixes', () => {
  assert.equal(buildings.filter((building) => building.place === 'cottages').length, 2);
  assert.equal(buildings.filter((building) => building.place === 'tenements').length, 2);
  assert.match(places.cottages.description, /Site of two Cottages & Gardens/);
  assert.match(places.tenements.description, /Site of 3 Tenements & Gardens/);
  assert.match(places.cottages.description, /Domestic doors and framed windows/);
  assert.match(places.tenements.description, /domestic doors and framed windows/);
  const scene = readFileSync(new URL('../assets/js/ilmer-1839.js', import.meta.url), 'utf8');
  assert.match(scene, /building\.place === 'cottages' \|\| building\.place === 'tenements'/);
  assert.match(scene, /if \(!vicarage && !dwelling\)/);
  assert.match(scene, /else if \(dwelling\) \{\s*dwellingFacade\(part, l, w, group\.userData\.frontDoors\)/);
  assert.match(places.lower.description, /Lower Farm Homestead & Orchard/);
  const page = readFileSync(new URL('../history/ilmer-1839.liquid', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /<button[^>]*>(?:66|A1)/);
  assert.match(page, /data-view="cottages"[^>]*>Two Cottages &amp; Gardens/);
  assert.match(page, /data-view="lower"[^>]*>Lower Farm/);
});

test('wooden house windows clear corners, neighbouring frames and front doorways', () => {
  for (const building of buildings.filter(
    (item) => item.place === 'cottages' || item.place === 'tenements' || item.architecture === 'tudor'
  )) {
    for (const [, , pixels, , ,] of building.parts) {
      const length = pixels * MAP.scale;
      const glazing = building.architecture === 'tudor' ? 1.7 : 1.1;
      const frame = glazing + 0.22;
      const count = building.architecture === 'tudor' ? 2 : Math.max(1, Math.floor(length / 8)) * 2;
      const door = building.architecture === 'tudor' ? Math.min(length * 0.33, 3) : 1.22;
      for (const doorway of [0, door]) {
        const positions = spacedWindowCentres(length, glazing, count, doorway);
        positions.forEach((x, i) => {
          assert.ok(length / 2 - Math.abs(x) - frame / 2 >= 1 - 1e-10);
          if (doorway) assert.ok(Math.abs(x) - frame / 2 - doorway / 2 >= 0.45 - 1e-10);
          if (i) assert.ok(x - positions[i - 1] - frame >= 0.6 - 1e-10);
        });
      }
    }
  }
  assert.deepEqual(spacedWindowCentres(5.44, 1.7, 2, 1.7952), []);
  assert.deepEqual(spacedWindowCentres(5.44, 1.7, 2), [0]);
  assert.equal(spacedWindowCentres(19.84, 1.1, 4, 1.22).length, 4);
  const largeTenement = buildings.find((building) => building.place === 'tenements' && building.frontDoors === 2);
  assert.ok(largeTenement);
  const length = largeTenement.parts[0][2] * MAP.scale;
  for (const door of [-length / 4, length / 4]) {
    for (const x of spacedWindowCentres(length / 2, 1.1, 2, 1.22)) {
      assert.ok(length / 2 - Math.abs(x + door) - 0.66 >= 1);
      assert.ok(Math.abs(x) - 0.66 - 0.61 >= 0.45);
    }
  }
  assert.throws(() => spacedWindowCentres(NaN, 1.1, 2), /Invalid dwelling window/);
});

test('individual detected symbols replace the old interpolated rows with a checked map orientation', () => {
  const data = validateTrees(JSON.parse(readFileSync(new URL('../assets/ilmer-trees.json', import.meta.url), 'utf8')));
  assert.equal(data.source.year, 1876);
  assert.match(data.source.method, /template/);
  assert.equal(data.source.sha256.length, 64);
  assert.ok(data.detections.length > 300);
  assert.ok(data.registration.determinant > 0);
  assert.ok(data.registration.clockwiseDegreesInImageCoordinates > 30);
  assert.ok(data.registration.clockwiseDegreesInImageCoordinates < 50);
  const [normal, reflected] = data.registration.comparison;
  assert.ok(normal.rmsPixels < reflected.rmsPixels / 2);
  for (const landmark of data.registration.landmarks) {
    if (!landmark.usedForFit) continue;
    const registered = register1876Tree(data, ...landmark.source);
    for (let axis = 0; axis < 2; axis++) assert.ok(Math.abs(registered[axis] - landmark.target[axis]) < 0.00001);
  }
  assert.ok(
    data.registration.landmarks.some(
      (landmark: { usedForFit: boolean; errorPixels: number }) => !landmark.usedForFit && landmark.errorPixels > 100
    )
  );
  assert.throws(() => register1876Tree(data, NaN, 0), /Invalid 1876 tree registration/);
  const { trees, excluded } = historicalTrees(data);
  assert.ok(trees.length > 250);
  assert.equal(trees.length + excluded.building + excluded.outsideCrop, data.detections.length);
  assert.ok(trees.some((tree) => tree.orchard));
  assert.equal(new Set(trees.map((tree) => tree.detectionIndex)).size, trees.length);
  for (const tree of trees) {
    assert.ok(tree.x > 0 && tree.x < MAP.width && tree.y > 0 && tree.y < MAP.height);
    const registered = register1876Tree(data, ...tree.source);
    assert.deepEqual(registered, [tree.x, tree.y]);
    const detection = data.detections[tree.detectionIndex];
    assert.deepEqual([detection.x, detection.y], tree.source);
    for (const [cx, cy, length, width, angle] of buildings.flatMap((building) => building.parts)) {
      const rotation = (angle * Math.PI) / 180;
      const dx = tree.x - cx;
      const dy = tree.y - cy;
      const localX = dx * Math.cos(rotation) + dy * Math.sin(rotation);
      const localY = -dx * Math.sin(rotation) + dy * Math.cos(rotation);
      assert.ok(Math.abs(localX) >= length / 2 + 4 || Math.abs(localY) >= width / 2 + 4);
    }
  }
  const script = readFileSync(new URL('../assets/js/ilmer-1839-data.js', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /mappedTreeRows|mappedTreeSymbols|treeRegistrationTriangles/);
});

test('detected tree data rejects corrupt geometry rather than silently replacing trees', () => {
  const data = JSON.parse(readFileSync(new URL('../assets/ilmer-trees.json', import.meta.url), 'utf8'));
  assert.throws(() => validateTrees({}), /Invalid detected-tree data/);
  assert.throws(
    () => validateTrees({ ...data, detections: [{ x: NaN, y: 1, kind: 'tree' }] }),
    /Invalid detected-tree coordinates/
  );
  const reflected = {
    ...data,
    registration: {
      ...data.registration,
      controlTargets: data.registration.controlTargets.map(([x, y]: number[]) => [-x, y])
    }
  };
  assert.throws(() => validateTrees(reflected), /folds or reflects/);
});
