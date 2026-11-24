import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import {
  MAP,
  CHURCH_PORCH_SIDE,
  CHURCH_PLAN,
  mapPoint,
  buildingRoofCovering,
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
  ponds,
  tenementGarden
} from '../assets/js/ilmer-1839-data.ts';
import { validateTerrain, historicalTerrain, terrainHeight } from '../assets/js/ilmer-terrain.ts';
import {
  validateTrees,
  registerMapTree,
  historicalTrees,
  circleOverlapsTriangles,
  validatePlacedTrees
} from '../assets/js/ilmer-trees.ts';
import * as THREE from 'three';
import { buildPlacedTreesFromFiles } from '../scripts/ilmer-placed-trees.ts';
import {
  ridePath,
  ridePoint,
  rideLength,
  rideStart,
  rideEnd,
  rideSpeed,
  rideCircuitPoint,
  rideCircuitLength
} from '../assets/js/ilmer-ride.ts';
import { cameraFloor, cameraGroundClearance } from '../assets/js/ilmer-camera.ts';
import {
  flightStops,
  advanceFlight,
  blendIn,
  smoothClearance,
  stopAtDistance,
  FLIGHT_SPEED
} from '../assets/js/ilmer-flight.ts';
import { livestockFields, withinField } from '../assets/js/ilmer-livestock.ts';

test('historical terrain removes only the railway embankment and keeps the measured source intact', () => {
  const measured = JSON.parse(readFileSync('assets/ilmer-terrain.json', 'utf8'));
  const original = measured.elevations.slice();
  const historical = historicalTerrain(measured);
  assert.deepEqual(measured.elevations, original);
  assert.ok(historical.historicalCorrection.maxRemoval > 5);
  const { start, end, halfWidth } = measured.embankment;
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const along = [(end[0] - start[0]) / length, (end[1] - start[1]) / length];
  const normal = [-along[1], along[0]];
  const height = (x: number, z: number) =>
    terrainHeight(
      measured,
      Math.max(-measured.width / 2, Math.min(measured.width / 2, x)),
      Math.max(-measured.depth / 2, Math.min(measured.depth / 2, z))
    ) + measured.baseElevation;
  for (let row = 0; row < measured.rows; row++) {
    const z = (row / (measured.rows - 1) - 0.5) * measured.depth;
    for (let col = 0; col < measured.columns; col++) {
      const x = (col / (measured.columns - 1) - 0.5) * measured.width;
      const index = row * measured.columns + col;
      const t = (x - start[0]) * along[0] + (z - start[1]) * along[1];
      const offset = (x - start[0]) * normal[0] + (z - start[1]) * normal[1];
      if (Math.abs(offset) >= halfWidth) assert.equal(historical.elevations[index], original[index]);
      else if (Math.abs(offset) < halfWidth * 0.75) {
        const cx = start[0] + along[0] * t;
        const cz = start[1] + along[1] * t;
        const a = height(cx - normal[0] * halfWidth, cz - normal[1] * halfWidth);
        const b = height(cx + normal[0] * halfWidth, cz + normal[1] * halfWidth);
        assert.ok(historical.elevations[index] >= Math.min(a, b) - 1e-8);
        assert.ok(historical.elevations[index] <= Math.max(a, b) + 1e-8);
      }
    }
  }
  // Crest of the embankment where it leaves the north-east of the crop
  const z = 120;
  const x = start[0] + ((end[0] - start[0]) * (z - start[1])) / (end[1] - start[1]);
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
  const stopDistances = stops.map((_, index) => index * 10);
  const total = stops.length * 10;
  const visited = new Set();
  for (let distance = 0; distance < total; distance += 1) visited.add(stopAtDistance(stopDistances, distance, total));
  assert.equal(visited.size, stops.length);
  assert.equal(stopAtDistance(stopDistances, total + 5, total), 0);
});

test('flying tour glides at a constant speed after a gentle start, like the church tour', () => {
  let state = { distance: 0, throttle: 0 };
  const steps = [];
  for (let frame = 0; frame < 600; frame += 1) {
    const before = state.distance;
    state = advanceFlight(state, 1 / 60);
    steps.push(state.distance - before);
  }
  assert.ok(
    steps.every((step) => step > 0),
    'the tour never pauses'
  );
  assert.ok(steps[0] < steps[30], 'the tour eases in');
  const cruise = steps.slice(-200);
  assert.ok(
    cruise.every((step) => Math.abs(step - FLIGHT_SPEED / 60) < 1e-9),
    'the tour holds a steady speed'
  );
  assert.throws(() => advanceFlight({ distance: NaN, throttle: 0 }, 0.1), /Invalid flying tour/);
  assert.equal(blendIn(0, 3), 0);
  assert.equal(blendIn(3, 3), 1);
  assert.ok(blendIn(1, 3) < blendIn(2, 3));
});

test('flying tour height clears every roof without sudden jumps', () => {
  const required = Array.from({ length: 200 }, (_, index) => (index > 90 && index < 110 ? 12 : 0));
  const smoothed = smoothClearance(required, 12);
  smoothed.forEach((height: number, index: number) => assert.ok(height >= required[index] - 1e-9));
  for (let index = 1; index < smoothed.length; index += 1)
    assert.ok(Math.abs(smoothed[index] - smoothed[index - 1]) < 3, 'height changes gradually');
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
  // One speaker button mutes every village sound, like the church model's
  assert.match(page, /id="btn-sound" aria-pressed="false" aria-label="Mute village sounds"/);
  assert.match(page, /data-icon="sound-on"[\s\S]*data-icon="sound-off"[^>]*hidden/);
  assert.match(page, /Click or tap the horse and cart/);
  assert.match(page, /id="ride-status" role="status"/);
  assert.doesNotMatch(page, /id="village-cart"/);
  const script = readFileSync(new URL('../assets/js/ilmer-1839.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /villageCart|name === 'village'.*startVillageCart/);
  assert.doesNotMatch(script, /Riding past the church and Lower Farm, turning back at each end/);
});

test('one primary click or tap rides the cart, but drags, secondary pointers and cancelled gestures do not', () => {
  const scene = readFileSync(new URL('../assets/js/ilmer-1839.ts', import.meta.url), 'utf8');
  const handlers = scene.slice(
    scene.indexOf("renderer.domElement.addEventListener('pointerdown'"),
    scene.indexOf("host.addEventListener('keydown'")
  );
  const target = new EventTarget();
  let rides = 0;
  runInNewContext(`let pointerStart = null; let flyDrag = null;\n${handlers}`, {
    renderer: { domElement: target },
    freeFlightAvailable: () => false,
    pointAtScene: () => {},
    rideMode: 'village',
    pointsAtCart: () => true,
    startCartRide: () => rides++
  });
  const emit = (type: string, values: object = {}) =>
    target.dispatchEvent(
      Object.assign(new Event(type, { cancelable: true }), {
        clientX: 20,
        clientY: 20,
        button: 0,
        isPrimary: true,
        ...values
      })
    );
  emit('pointerdown');
  emit('pointerup', { clientX: 40 });
  emit('pointerdown');
  emit('pointercancel');
  emit('pointerup');
  emit('pointerdown', { button: 2 });
  emit('pointerup', { button: 2 });
  emit('pointerdown', { isPrimary: false });
  emit('pointerup', { isPrimary: false });
  assert.equal(rides, 0);
  for (const pointerType of ['mouse', 'touch']) {
    emit('pointerdown', { pointerType });
    emit('pointerup', { pointerType });
  }
  assert.equal(rides, 2);
  assert.doesNotMatch(scene, /lastCartTap|addEventListener\('dblclick'/);
});

test('AR keeps trees and hedges hidden when GPS enables the remaining features', () => {
  const scene = readFileSync(new URL('../assets/js/ilmer-1839.ts', import.meta.url), 'utf8');
  const visibility = scene.slice(scene.indexOf('function setARFeaturesVisible'), scene.indexOf('function setARStatus'));
  const landscape = { visible: true };
  const structures = { visible: false };
  const livestock = { visible: false };
  const waterFeatures = { visible: false };
  const sandbox = { landscape, structures, livestock, waterFeatures, shadowsDirty: false };
  runInNewContext(
    `${visibility}\nsetARFeaturesVisible(false); setARFeaturesVisible(true); shadowsDirty = false; setARFeaturesVisible(true);`,
    sandbox
  );
  assert.equal(landscape.visible, false);
  assert.equal(structures.visible, true);
  assert.equal(livestock.visible, true);
  assert.equal(sandbox.shadowsDirty, false, 'a repeated GPS fix does not redraw the shadow map');
  assert.match(scene, /webglcontextrestored[\s\S]{0,500}shadowsDirty = true/);
  assert.equal(waterFeatures.visible, true);
  assert.match(scene, /\[landscape, session\.landscapeVisible\]/);
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

test('the middle Upper Farm barn has double-height eaves without changing the three joined footprints', () => {
  const range = buildings.find((building) => building.place === 'barns' && building.parts.length === 3)!;
  assert.deepEqual(
    range.parts.map((part) => part.slice(0, 5)),
    [
      [813, 522, 90, 21, -67],
      [767, 536, 63, 23, 21],
      [735, 545, 56, 18, -60]
    ]
  );
  const [first, middle, last] = range.parts.map((part) => part[5]);
  assert.equal(first, 5.5);
  assert.equal(last, first);
  assert.equal(middle, first * 2);
  assert.match(places.barns.description, /middle of the three joined barns.*double-height/);
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
  const script = readFileSync(new URL('../assets/js/ilmer-1839.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /cartLabel|label\('Horse & cart'/);
});

test('the tenements garden is not a pond and ducks use the cottages pond', () => {
  assert.equal(ponds.length, 10);
  assert.equal(livestockFields.find((field) => field.species === 'duck')?.outline, ponds[0]);
  assert.equal(tenementGarden.length, 17);
  assert.equal(withinField(tenementGarden, 895, 285), true);
  assert.equal(
    ponds.some((pond) => withinField(pond, 895, 285)),
    false
  );
  const scene = readFileSync(new URL('../assets/js/ilmer-1839.ts', import.meta.url), 'utf8');
  assert.match(scene, /flatPolygon\(tenementGarden, material\(0xb5bc8d\)\)/);
});

test('the 1839 page loads one hashed Vite bundle and every helper module exists', () => {
  const root = new URL('../', import.meta.url);
  const template = readFileSync(new URL('history/ilmer-1839.liquid', root), 'utf8');
  assert.match(template, /'ilmer-1839' \| bundle/);
  assert.match(template, /bundlePreloads "ilmer-1839"/);
  assert.doesNotMatch(template, /importmap|three\.module\.js/);
  const pending = ['/assets/js/ilmer-1839.ts'];
  const visited = new Set<string>();
  while (pending.length) {
    const module = pending.pop()!;
    if (visited.has(module)) continue;
    visited.add(module);
    assert.ok(existsSync(new URL(module.slice(1), root)), module);
    const source = readFileSync(new URL(module.slice(1), root), 'utf8');
    for (const [, relative] of source.matchAll(/from ['"](\.\.?\/[^'"]+)['"]/g)) {
      pending.push(new URL(relative, `https://example.test${module}`).pathname);
    }
  }
  assert.ok(visited.has('/assets/js/ilmer-terrain.ts'));
  assert.ok(visited.has('/assets/js/ilmer-trees.ts'));
  assert.ok(visited.size > 5);
});

test('the experience retains accessible controls and locally served Three.js without the evidence section', () => {
  const page = readFileSync(new URL('../history/ilmer-1839.liquid', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../assets/js/ilmer-1839.ts', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../assets/css/ilmer-1839.css', import.meta.url), 'utf8');
  for (const view of ['village', 'church', 'barns', 'middle', 'lower', 'cottages', 'tenements', 'vicarage', 'plan'])
    assert.ok(page.includes(`data-view="${view}"`));
  assert.match(page, /role="status"/);
  assert.match(page, /<noscript>/);
  assert.match(page, /Historical interpretation, not a measured survey/);
  assert.match(page, /ancestorCrumb1Source: \{ label: 'Fields and Farming', url: '\/history\/fields-farming\/' \}/);
  assert.doesNotMatch(page, /reconstruction-evidence|reconstruction-sources|Reading the evidence|What we know/);
  assert.doesNotMatch(page, /<img|notes are below|available below|tree-registration\.png|tree-detections\.png/);
  assert.match(page, /id="map-layer"/);
  // On the original map, planting is hidden and a button shows or hides the buildings over it
  assert.match(page, /id="map-buildings" aria-pressed="true"[^>]*hidden>Buildings: Shown</);
  const villageScript = readFileSync(new URL('../assets/js/ilmer-1839.ts', import.meta.url), 'utf8');
  assert.match(villageScript, /landscape\.visible = !showMap;/);
  assert.match(villageScript, /structures\.visible = !showMap \|\| mapBuildingsShown;/);
  assert.match(page, /id="ar-start"/);
  assert.match(page, /id="ar-controls"[^>]*hidden/);
  assert.match(styles, /#ar-controls\[hidden\]/);
  assert.match(page, /id="ar-overlay"[^>]*hidden/);
  assert.match(page, /id="ar-exit"/);
  assert.match(script, /getUserMedia/);
  assert.match(script, /watchPosition/);
  assert.match(script, /deviceorientation/);
  assert.match(styles, /body\.ar-active \.reconstruction-stage/);
  assert.doesNotMatch(page, /id="landscape-layer"/);
  assert.match(page, /id="flight-toggle"[^>]*>Historic Tour/);
  assert.doesNotMatch(page, /data-view="(?:west|chancel)"|A rider's-eye journey|A roof-height tour/);
  assert.match(page, /'ilmer-1839' \| bundle/);
  assert.doesNotMatch(page, /three\.module\.js/);
  assert.match(page, /ilmer-placed-trees\.json/);
  assert.match(script, /renderer\.shadowMap\.autoUpdate = false/);
  assert.match(script, /mesh\.castShadow = false/);
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

test('the blocked church doorway is masonry-filled on the wall opposite the porch', () => {
  assert.match(places.church.description, /blocked-up arched doorway on the south wall facing Upper Farm/);
  const scene = readFileSync(new URL('../assets/js/ilmer-1839.ts', import.meta.url), 'utf8');
  assert.match(scene, /blockedDoorway\.position\.set\(-0\.5, 0\.05, -CHURCH_PORCH_SIDE \* 3\.62\)/);
  assert.match(scene, /if \(CHURCH_PORCH_SIDE > 0\) blockedDoorway\.rotation\.y = Math\.PI/);
  assert.match(scene, /new THREE\.Mesh\(blockedInfillGeometry, stone\)/);
  const coordinates: number[][] = [];
  const geometry = {
    attributes: {
      position: { count: 2, getX: (i: number) => [-0.85, 0.85][i], getY: (i: number) => [0, 3.2][i] },
      uv: { setXY: (i: number, x: number, y: number) => (coordinates[i] = [x, y]) }
    }
  };
  const mapping = scene.slice(scene.indexOf('const blockedInfillGeometry'), scene.indexOf('const blockedInfill ='));
  runInNewContext(mapping, {
    door: { geometry: { clone: () => geometry } },
    blockedDoorway: { position: { x: -0.5, y: 0.05 } },
    CHURCH_PORCH_SIDE
  });
  assert.ok(Math.abs(coordinates[0][0] - (-0.85 - 0.5 + 11.5 / 2) / 11.5) < 1e-10);
  assert.ok(Math.abs(coordinates[0][1] - 0.05 / 6.1) < 1e-10);
  assert.ok(Math.abs(coordinates[1][0] - coordinates[0][0] - 1.7 / 11.5) < 1e-10);
  assert.ok(Math.abs(coordinates[1][1] - coordinates[0][1] - 3.2 / 6.1) < 1e-10);
  assert.match(scene, /church\.add\(blockedDoorway\)/);
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
  const script = readFileSync(new URL('../assets/js/ilmer-1839.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /reconstruction-card|place-description|place-title/);
  assert.doesNotMatch(script, /place-description|place-title|BoxHelper/);
});

test('place labels render after transparent foliage without testing or writing scene depth', () => {
  const script = readFileSync(new URL('../assets/js/ilmer-1839.ts', import.meta.url), 'utf8');
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
  assert.match(data.source.registration, /Ordnance Survey map/);
  assert.equal(data.elevations.length, 321 * 142);
  assert.ok(data.source.sampleSpacingMetres < 2.5);
  assert.ok(data.maxElevation - data.minElevation > 10);
  assert.ok(data.maxElevation - data.minElevation < 12);
  const church = terrainHeight(data, ...mapPoint(957, 507)) + data.baseElevation;
  assert.ok(Math.abs(church - 84.9) < 0.1);
  // The Ordnance Survey's own benchmarks and spot heights agree with the registered LIDAR
  assert.equal(data.source.osHeights.length, 4);
  for (const height of data.source.osHeights) assert.ok(Math.abs(height.differenceMetres) < 0.75, height.name);
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
  assert.match(
    places.vicarage.description,
    /ground-floor windows on its long elevations and ground-floor and upstairs windows on its gable ends/
  );
  assert.equal(buildings.find((building) => building.architecture === 'vicarage')?.storeys, 2);
  const scene = readFileSync(new URL('../assets/js/ilmer-1839.ts', import.meta.url), 'utf8');
  const vicarage = scene.slice(scene.indexOf('} else if (vicarage) {'), scene.indexOf('} else if (stoneHouse) {'));
  assert.match(vicarage, /const groundWindowCentre = height \/ 3/);
  assert.match(vicarage, /const upperWindowCentre = height \+ roofRise \* 0\.32/);
  assert.match(scene, /const roofRise = w \* \(vicarage \? 0\.75 : tudor \? 0\.65 : 0\.46\)/);
  assert.match(scene, /buildingRoofCovering\(building\.place, building\.architecture\) === 'thatch' \? thatch : roof/);
  assert.match(vicarage, /windowPanel\(part, x, groundWindowCentre, side \* \(w \/ 2 \+ 0\.09\)\)/);
  assert.match(
    vicarage,
    /for \(const level of \[groundWindowCentre, upperWindowCentre\]\) windowPanel\(gableEnd, 0, level, 0\.02\)/
  );
  const vicaragePart = buildings.find((building) => building.architecture === 'vicarage')!.parts[0];
  const [, , , windowWidth, , eavesHeight] = vicaragePart;
  const gableRise = windowWidth * MAP.scale * 0.75;
  const groundWindowCentre = eavesHeight / 3;
  const upperWindowCentre = eavesHeight + gableRise * 0.32;
  assert.equal(groundWindowCentre, 2);
  assert.equal(groundWindowCentre - 0.75, 1.25);
  assert.equal(groundWindowCentre + 0.75, 2.75);
  const pitch = (Math.atan2(gableRise, (windowWidth * MAP.scale) / 2 + 0.55) * 180) / Math.PI;
  assert.ok(pitch > 50 && pitch < 55);
  assert.ok(upperWindowCentre - 0.75 > eavesHeight);
  assert.ok(upperWindowCentre + 0.75 < eavesHeight + gableRise);
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

test('Lower Farm outbuildings are thatched while its house and other non-Tudor buildings retain tiled roofs', () => {
  const outbuildings = buildings.filter((building) => building.place === 'lower' && !building.architecture);
  const farmhouse = buildings.find((building) => building.place === 'lower' && building.architecture === 'stone-house');
  assert.equal(outbuildings.length, 5);
  assert.ok(outbuildings.every((building) => buildingRoofCovering(building.place, building.architecture) === 'thatch'));
  assert.ok(outbuildings.some((building) => building.projections?.length));
  assert.ok(farmhouse);
  assert.equal(buildingRoofCovering(farmhouse.place, farmhouse.architecture), 'tile');
  assert.equal(buildingRoofCovering('middle', 'tudor'), 'thatch');
  assert.equal(buildingRoofCovering('barns', undefined), 'tile');
});

test('Upper Farm residence roofs are thatched without changing other stone houses or the barns', () => {
  for (const [place, architecture, expected] of [
    ['barns', 'stone-house', 'thatch'],
    ['lower', 'stone-house', 'tile'],
    ['barns', undefined, 'tile'],
    ['middle', 'tudor', 'thatch'],
    ['vicarage', 'vicarage', 'thatch']
  ] as const) {
    const building = buildings.find((building) => building.place === place && building.architecture === architecture)!;
    assert.equal(buildingRoofCovering(building.place, building.architecture), expected, `${place}: ${architecture}`);
  }
  assert.match(places.barns.description, /thatch on the main roof and attached lean-to/);
});

test('Middle Farm has two wall storeys and a third in the main roof with gable-end windows', () => {
  const middle = buildings.find((building) => building.architecture === 'tudor')!;
  assert.equal(middle.storeys, 3);
  assert.match(places.middle.description, /three storeys.*uppermost storey in the roof space/);
  const scene = readFileSync(new URL('../assets/js/ilmer-1839.ts', import.meta.url), 'utf8');
  const tudor = scene.slice(scene.indexOf('if (tudor) {'), scene.indexOf('} else if (vicarage) {'));
  assert.match(tudor, /if \(partIndex === 0\)/);
  assert.match(tudor, /if \(building\.storeys === 3\)/);
  assert.match(tudor, /for \(const side of \[-1, 1\]\)/);
  assert.match(tudor, /windowPanel\(gableEnd, 0, height \+ roofRise \* 0\.35, 0\.02, 1\.7, 1\.5\)/);
  const [, , , width, , eaves] = middle.parts[0];
  const rise = width * MAP.scale * 0.65;
  const centre = eaves + rise * 0.35;
  assert.ok(centre - 0.86 > eaves);
  const undersideAtWindowEdge = eaves + rise * (1 - 0.96 / ((width * MAP.scale) / 2 + 0.55)) - 0.8;
  assert.ok(centre + 0.86 < undersideAtWindowEdge);
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
  const script = readFileSync(new URL('../assets/js/ilmer-1839.ts', import.meta.url), 'utf8');
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
  const scene = readFileSync(new URL('../assets/js/ilmer-1839.ts', import.meta.url), 'utf8');
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

test('trees come from the Ordnance Survey map, laid over the tithe map by the church and Lower Farm farmhouse', () => {
  const data = validateTrees(JSON.parse(readFileSync(new URL('../assets/ilmer-trees.json', import.meta.url), 'utf8')));
  assert.match(data.source.map, /Ordnance Survey/);
  assert.match(data.source.method, /template/);
  assert.equal(data.source.sha256.length, 64);
  assert.ok(data.detections.length > 400);
  const [church, farmhouse] = data.registration.controlPoints;
  assert.match(church.name, /St Peter's Church/);
  assert.match(farmhouse.name, /Lower Farm main farmhouse.*benchmark/);
  // The control points land on the modelled church and farmhouse
  assert.deepEqual(church.target, CHURCH_PLAN.centre);
  const lowerFarmhouse = buildings
    .filter((building) => building.place === 'lower')
    .flatMap((building) => building.parts)
    .find(([, , , , , height]) => height === 7)!;
  assert.deepEqual(farmhouse.target, lowerFarmhouse.slice(0, 2));
  for (const control of data.registration.controlPoints) {
    const registered = registerMapTree(data, control.source[0], control.source[1]);
    for (let axis = 0; axis < 2; axis++) assert.ok(Math.abs(registered[axis] - control.target[axis]) < 0.00001);
  }
  // The OS map is turned about 45 degrees and slightly enlarged to fit the tithe map
  assert.ok(data.registration.rotationDegrees > 40 && data.registration.rotationDegrees < 50);
  assert.ok(data.registration.scale > 1 && data.registration.scale < 1.2);
  assert.throws(() => registerMapTree(data, NaN, 0), /Invalid tree registration/);
  const { trees, excluded } = historicalTrees(data);
  assert.ok(trees.length > 250);
  assert.ok(trees.some((tree) => !tree.orchard));
  assert.equal(trees.length + excluded.building + excluded.outsideCrop, data.detections.length);
  assert.ok(trees.some((tree) => tree.orchard));
  assert.equal(new Set(trees.map((tree) => tree.detectionIndex)).size, trees.length);
  for (const tree of trees) {
    assert.ok(tree.x > 0 && tree.x < MAP.width && tree.y > 0 && tree.y < MAP.height);
    const registered = registerMapTree(data, tree.source[0], tree.source[1]);
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
  const script = readFileSync(new URL('../assets/js/ilmer-1839-data.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /mappedTreeRows|mappedTreeSymbols|treeRegistrationTriangles/);
});

test('detected tree data rejects corrupt geometry rather than silently replacing trees', () => {
  const data = JSON.parse(readFileSync(new URL('../assets/ilmer-trees.json', import.meta.url), 'utf8'));
  assert.throws(() => validateTrees({}), /Invalid detected-tree data/);
  assert.throws(
    () => validateTrees({ ...data, detections: [{ x: NaN, y: 1, kind: 'tree' }] }),
    /Invalid detected-tree coordinates/
  );
  const [[a, b, tx], [c, d, ty]] = data.registration.matrix;
  const reflected = {
    ...data,
    registration: {
      ...data.registration,
      matrix: [
        [-a, -b, tx],
        [c, d, ty]
      ]
    }
  };
  assert.throws(() => validateTrees(reflected), /folds or reflects/);
  const sheared = {
    ...data,
    registration: {
      ...data.registration,
      matrix: [
        [a * 1.3, b, tx],
        [c, d, ty]
      ]
    }
  };
  assert.throws(() => validateTrees(sheared), /distorts/);
  const shifted = {
    ...data,
    registration: {
      ...data.registration,
      matrix: [
        [a, b, tx + 20],
        [c, d, ty]
      ]
    }
  };
  assert.throws(() => validateTrees(shifted), /misses its control points/);
});

test('placed trees are the road clearance the page used to run, loaded instead of recomputed', () => {
  const stored = validatePlacedTrees(
    JSON.parse(readFileSync(new URL('../assets/ilmer-placed-trees.json', import.meta.url), 'utf8'))
  );
  const fresh = buildPlacedTreesFromFiles(THREE);
  assert.deepEqual(
    fresh.trees,
    JSON.parse(readFileSync(new URL('../assets/ilmer-placed-trees.json', import.meta.url), 'utf8')).trees
  );
  assert.deepEqual(fresh.excluded, stored.excluded);
  assert.equal(fresh.crownRadius, stored.crownRadius);
  assert.equal(fresh.detectionsSha256, stored.detectionsSha256);
  assert.equal(fresh.terrainSha256, stored.terrainSha256);
  assert.equal(stored.trees.length, 317);
  assert.equal(stored.trees.filter((tree: { orchard: boolean }) => tree.orchard).length, 151);
  assert.deepEqual(stored.excluded, {
    outsideCrop: 195,
    building: 1,
    water: 10,
    road: 10,
    shiftedToVerge: 73
  });
  const page = readFileSync(new URL('../assets/js/ilmer-1839.ts', import.meta.url), 'utf8');
  const template = readFileSync(new URL('../history/ilmer-1839.liquid', import.meta.url), 'utf8');
  assert.match(page, /validatePlacedTrees/);
  assert.doesNotMatch(page, /TREE_VERGE_SHIFT|placeDetectedTrees|for \(let shift = 0\.5/);
  assert.match(page, /shadowMap\.autoUpdate = false/);
  assert.match(template, /data-placed-trees="{{ '\/assets\/ilmer-placed-trees\.json' \| cacheBust }}"/);
  assert.throws(() => validatePlacedTrees({}), /Invalid placed-tree data/);
});
