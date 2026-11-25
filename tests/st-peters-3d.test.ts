import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  CHURCH_TOUR_WAYPOINTS,
  computeChurchAcoustics,
  DIM,
  getGroundHeight,
  getSurfaceY,
  isChristmasSeason
} from '../assets/js/st-peters-3d/dimensions.ts';
import { CHURCHYARD_MEMORIALS } from '../assets/js/st-peters-3d/memorials-data.ts';
import {
  advanceWillowState,
  createWillowState,
  findWillowPath,
  pickRunAnimation,
  summonWillowToBowl,
  triggerWillowGreet,
  WILLOW_DRINK_SECONDS,
  WILLOW_SPRITE_SHEET,
  WILLOW_WATER_BOWL_POS,
  WILLOW_WAYPOINTS,
  willowFloorY
} from '../assets/js/st-peters-3d/willow.ts';

const root = new URL('../', import.meta.url);

test("St Peter's 3D page lives beneath St Peter's Church with reconstruction layout and church tag", () => {
  const page = readFileSync(new URL('history/st-peters/3d-model.liquid', root), 'utf8');
  assert.match(page, /^layout:\s*reconstruction$/m);
  assert.match(page, /^tags:\s*\[church,\s*history\]$/m);
  assert.match(page, /ancestorCrumb1Source:\s*\{[^}]*url:\s*'\/history\/st-peters\/'/);
  assert.match(page, /^permalink:\s*\/history\/st-peters\/3d-model\/index\.html$/m);
  assert.match(page, /id="church-scene"/);
});

test("every St Peter's 3D module imported by the page exists and the page loads the Vite bundle", () => {
  const page = readFileSync(new URL('history/st-peters/3d-model.liquid', root), 'utf8');
  assert.match(page, /'st-peters-3d' \| bundle/);
  assert.match(page, /bundlePreloads "st-peters-3d"/);
  assert.doesNotMatch(page, /importmap|three\.module\.js/);

  const pending = ['/assets/js/st-peters-3d/main.ts'];
  const seen = new Set<string>();

  while (pending.length > 0) {
    const modPath = pending.pop()!;
    if (seen.has(modPath)) continue;
    seen.add(modPath);

    const fileUrl = new URL(modPath.replace(/^\//, ''), root);
    assert.ok(existsSync(fileUrl), `missing module ${modPath}`);
    const source = readFileSync(fileUrl, 'utf8');

    // Static `import x from '...'`, side-effect `import '...'`, and dynamic `import('...')`
    for (const match of source.matchAll(/(?:from\s+|import\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
      const spec = match[1];
      if (!spec.startsWith('./') && !spec.startsWith('../')) continue;
      const next = new URL(spec, `https://example.invalid${modPath}`).pathname;
      if (!next.startsWith('/assets/js/')) continue;
      pending.push(next);
    }
  }

  for (const required of [
    '/assets/js/ilmer-sky.ts',
    '/assets/js/ilmer-terrain.ts',
    '/assets/js/scene-fullscreen.ts',
    '/assets/js/st-peters-3d/canvas-utils.ts',
    '/assets/js/st-peters-3d/mesh-utils.ts',
    '/assets/js/st-peters-3d/fade.ts',
    '/assets/js/st-peters-3d/static-merge.ts',
    '/assets/js/st-peters-3d/stats-overlay.ts',
    '/assets/js/st-peters-3d/belfry.ts',
    '/assets/js/st-peters-3d/stained-glass.ts',
    '/assets/js/st-peters-3d/plaques.ts',
    '/assets/js/st-peters-3d/reliefs.ts',
    '/assets/js/st-peters-3d/christmas-tree.ts',
    '/assets/js/st-peters-3d/interior/structure.ts',
    '/assets/js/st-peters-3d/interior/furniture.ts',
    '/assets/js/st-peters-3d/interior/organs.ts',
    '/assets/js/st-peters-3d/interior/lighting.ts',
    '/assets/js/st-peters-3d/interior/props.ts',
    '/assets/js/st-peters-3d/church-terrain-data.ts',
    '/assets/js/st-peters-3d/willow.ts'
  ]) {
    assert.ok(seen.has(required), `expected ${required} in module graph`);
  }

  const texturesSource = readFileSync(new URL('assets/js/st-peters-3d/textures.ts', root), 'utf8');
  assert.doesNotMatch(texturesSource, /\/images\/monumental-inscriptions\/A[123]\.avif/);
  assert.doesNotMatch(texturesSource, /\.avif/, 'all interior memorial textures should be procedural');
});

test('every plotted churchyard memorial includes an engraved inscription', () => {
  assert.equal(CHURCHYARD_MEMORIALS.length, 49);
  for (const m of CHURCHYARD_MEMORIALS) {
    const hasLines = Array.isArray(m.inscription) && m.inscription.length > 0;
    const hasPages = Array.isArray(m.pages) && m.pages.some((p: string[]) => p.length > 0);
    assert.ok(hasLines || hasPages, `memorial ${m.id} is missing inscription text`);
  }
  assert.equal(CHURCHYARD_MEMORIALS.find((m) => m.id === 'C13')?.kind, 'headstone-fallen');
  assert.equal(CHURCHYARD_MEMORIALS.find((m) => m.id === 'C14')?.kind, 'headstone-fallen');
});

test('December Christmas tree activates automatically in December and supports preview query overrides', () => {
  assert.equal(isChristmasSeason(new Date('2026-12-01T12:00:00Z')), true);
  assert.equal(isChristmasSeason(new Date('2026-12-25T12:00:00Z')), true);
  assert.equal(isChristmasSeason(new Date('2026-11-21T12:00:00Z')), false);
  assert.equal(isChristmasSeason(new Date('2027-01-01T12:00:00Z')), false);
  assert.equal(isChristmasSeason(new Date('2026-11-21T12:00:00Z'), '?christmas=1'), true);
  assert.equal(isChristmasSeason(new Date('2026-11-21T12:00:00Z'), '?month=12'), true);
  assert.equal(isChristmasSeason(new Date('2026-12-25T12:00:00Z'), '?christmas=0'), false);
});

test('surface elevation tracks interior floors and measured outer terrain', () => {
  assert.equal(getSurfaceY(0, 0), DIM.naveFloorY);
  assert.equal(getSurfaceY(5.0, 0), DIM.chancelFloorY);
  assert.equal(getSurfaceY(6.8, 0), DIM.sanctuaryStep1Y);
  assert.equal(getSurfaceY(8.2, 0), DIM.sanctuaryStep2Y);
  assert.equal(getSurfaceY(DIM.porch.xCenter, -4.0), DIM.porchFloorY);
  assert.equal(getGroundHeight(0, 0), DIM.groundY);
  assert.ok(Math.abs(getGroundHeight(0, -10)) < 0.2, 'near churchyard stays close to church datum');

  // Across the full 120m x 120m churchyard ground mesh, surface is always >= terrain height
  for (let x = -50; x <= 50; x += 5) {
    for (let z = -50; z <= 50; z += 5) {
      const surface = getSurfaceY(x, z);
      assert.ok(surface >= getGroundHeight(x, z), `surface at (${x}, ${z}) should be >= terrain height`);
    }
  }
});

test('St Peter exterior ground follows the 1839 measured terrain relative to the church', () => {
  // Church sits on a local rise: surrounding fields fall away by about a metre or more
  assert.ok(getGroundHeight(40, 0) < -0.8);
  assert.ok(getGroundHeight(-40, 0) < -0.8);
  assert.ok(getGroundHeight(0, -40) < -1.5);
  assert.ok(getGroundHeight(0, 40) < -0.4);
  // Soft pad keeps masonry grounded
  assert.equal(getGroundHeight(-5, 0), 0);
  assert.equal(getGroundHeight(8, 0), 0);
  // Outside the pad the LIDAR slope is used (not the old synthetic sine hills)
  assert.ok(getGroundHeight(25, 25) < -0.2);
  assert.ok(getGroundHeight(-25, -25) < -0.8);
});

test('church acoustics are louder and clearer inside the church than outside in the churchyard', () => {
  const insideNave = computeChurchAcoustics({ x: -1.0, y: 1.7, z: 0.0 }, false);
  const insideChancel = computeChurchAcoustics({ x: 5.5, y: 1.7, z: 0.0 }, false);
  const porchClosed = computeChurchAcoustics({ x: DIM.porch.xCenter, y: 1.7, z: -4.2 }, false);
  const porchOpen = computeChurchAcoustics({ x: DIM.porch.xCenter, y: 1.7, z: -4.2 }, true);
  const outsideNearClosed = computeChurchAcoustics({ x: DIM.porch.xCenter, y: 1.8, z: -7.5 }, false);
  const outsideNearOpen = computeChurchAcoustics({ x: DIM.porch.xCenter, y: 1.8, z: -7.5 }, true);
  const outsideFar = computeChurchAcoustics({ x: -21.5, y: 6.8, z: -21.8 }, false);

  assert.equal(insideNave.inside, true);
  assert.equal(insideChancel.inside, true);
  assert.equal(porchClosed.inside, false);
  assert.equal(outsideFar.inside, false);

  assert.ok(insideNave.gain > porchOpen.gain, 'Nave should be louder than open porch');
  assert.ok(porchOpen.gain > porchClosed.gain, 'Open porch should be louder than closed porch');
  assert.ok(porchClosed.gain > outsideNearClosed.gain, 'Porch should be louder than churchyard');
  assert.ok(outsideNearOpen.gain > outsideNearClosed.gain, 'Opening doors increases outdoor spill near porch');
  assert.ok(outsideNearClosed.gain > outsideFar.gain, 'Closer churchyard should be louder than distant view');
  assert.ok(
    insideNave.cutoffHz > outsideFar.cutoffHz * 4,
    'Interior should be much clearer than stone-muffled exterior'
  );
});

test('guided Church Tour visits exterior and interior, stays above ground, and opens the doors in view as it enters', () => {
  assert.ok(CHURCH_TOUR_WAYPOINTS.length >= 10);

  let firstInteriorIdx = -1;
  let doorOpenHoldIdx = -1;
  CHURCH_TOUR_WAYPOINTS.forEach((wp, idx) => {
    const [x, y, z] = wp.pos;
    assert.ok(y >= getSurfaceY(x, z) + 0.35, `tour waypoint "${wp.label}" should stay above ground/floor`);
    const { inside } = computeChurchAcoustics({ x, y, z }, wp.doorsOpen === true);
    if (inside && firstInteriorIdx === -1) firstInteriorIdx = idx;
    if (!inside && wp.doorsOpen === 'approach' && (wp.hold ?? 0) >= 1.0 && doorOpenHoldIdx === -1) {
      doorOpenHoldIdx = idx;
    }
  });

  assert.ok(firstInteriorIdx > 0, 'tour should visit exterior before entering the church');
  assert.ok(
    doorOpenHoldIdx >= 0 && doorOpenHoldIdx < firstInteriorIdx,
    'tour should slow at the North Porch, with the doors set to open as the camera approaches'
  );
  for (let i = 0; i < doorOpenHoldIdx; i++) {
    assert.equal(CHURCH_TOUR_WAYPOINTS[i].doorsOpen, false, 'doors stay shut until the camera reaches the porch');
  }
  for (let i = doorOpenHoldIdx; i < firstInteriorIdx; i++) {
    assert.equal(CHURCH_TOUR_WAYPOINTS[i].doorsOpen, 'approach');
  }
  assert.equal(CHURCH_TOUR_WAYPOINTS[firstInteriorIdx].doorsOpen, true);
});

test('north churchyard wrought-iron railings follow the 1839 boundary with kissing gates on the straight path', () => {
  const churchyard = readFileSync(new URL('assets/js/st-peters-3d/churchyard.ts', root), 'utf8');
  assert.match(churchyard, /export const NORTH_CHURCHYARD_RAILINGS/);
  assert.match(churchyard, /buildNorthChurchyardRailings/);
  assert.match(churchyard, /buildKissingGate/);
  assert.match(churchyard, /KISSING_GATE_RADIUS/);
  assert.match(churchyard, /U-shaped railed enclosure/);
  assert.match(churchyard, /kisses either side of the U/);
  const kissingFn = churchyard.slice(
    churchyard.indexOf('function buildKissingGate'),
    churchyard.indexOf('function addRailingRun')
  );
  assert.doesNotMatch(kissingFn, /TorusGeometry/, 'kissing gate is a U enclosure, not a full ring');
  assert.match(kissingFn, /Semi-circle|semicircle|U-shaped/i);
  // Hinged on the railing's end post; the U carries the boundary on across the path, its two gaps facing
  // either side of the boundary, so a walker steps into the U, swings the leaf across and steps out
  assert.match(churchyard, /origin on the hinge post, which is the end post of the boundary railing/);
  assert.match(churchyard, /swing it across behind them/);
  // The U is deeper than the leaf is long, leaving room to stand clear of the leaf while it swings
  const radius = Number(churchyard.match(/const KISSING_GATE_RADIUS = ([\d.]+)/)?.[1]);
  const depth = Number(churchyard.match(/const KISSING_GATE_DEPTH = ([\d.]+)/)?.[1]);
  assert.ok(depth - radius >= 0.6, `room behind the leaf: ${depth} deep vs ${radius} leaf`);
  assert.match(kissingFn, /pivot\.userData\.animated = true/);
  assert.match(churchyard, /placeKissingGate\(g, mats, frontage\[0\], frontage\[1\], WEST_RAILING_SOUTH_END\)/);
  assert.match(churchyard, /placeKissingGate\(g, mats, frontage\[n - 1\], frontage\[n - 2\]\)/);
  assert.match(churchyard, /function createKissingGateAnimator/);
  // The leaf clanks as it meets its end post
  assert.match(churchyard, /this\.onStop\?\.\(rec\)/);
  const mainSrc = readFileSync(new URL('assets/js/st-peters-3d/main.ts', root), 'utf8');
  assert.match(mainSrc, /renderer\.compileAsync\(scene, camera\)\.then\(/);
  assert.match(mainSrc, /kissingGates\.onStop = /);
  assert.match(mainSrc, /churchAudio\.playGateClang\(/);
  assert.match(readFileSync(new URL('assets/js/st-peters-3d/audio.ts', root), 'utf8'), /function playGateClang/);
  assert.match(churchyard, /RAILING_TAPER_LEN = 0\.1/); // only the top ~10 cm tapers
  // Tips taper to a small rounded end, not a sharp point
  assert.match(churchyard, /railingTipGeometry\((?:picketBaseR|baseR|radius|picketR), \d\)/);
  assert.doesNotMatch(churchyard, /CylinderGeometry\(0\.001, \w+, RAILING_TAPER_LEN/);
  assert.match(churchyard, /new THREE\.LatheGeometry\(pts, segments\)/);
  const railingFn = churchyard.slice(
    churchyard.indexOf('function addTaperedUpright'),
    churchyard.indexOf('function buildKissingGate')
  );
  assert.doesNotMatch(railingFn, /ConeGeometry/, 'railing tips are tapered cylinders, not cone finials');
  assert.match(railingFn, /CylinderGeometry\(picketBaseR, picketBaseR, shaftH/); // straight shaft below the tip
  assert.match(churchyard, /mats\.iron/);
  // Straight E–W path through both kissing gates — no N–S spurs; ribbon follows terrain height
  assert.match(churchyard, /addPathSlab\(g, mats, pathX0, PATH_Z, pathX1, PATH_Z\)/);
  assert.doesNotMatch(churchyard, /westGate\.x, PATH_Z, westGate\.x, westGate\.z/);
  const pathFn = churchyard.slice(
    churchyard.indexOf('function addPathSlab'),
    churchyard.indexOf('const RAILING_TAPER_LEN')
  );
  assert.match(pathFn, /getGroundHeight\(x, z\)/);
  assert.match(pathFn, /mats\.pathPavers/);
  assert.doesNotMatch(pathFn, /setFromUnitVectors/);
  assert.match(pathFn, /BufferGeometry/);
  // Lawn recesses under the path and banks down to the paver edge (no grass on top of the path)
  assert.match(churchyard, /function applyPathGrassBanks/);
  assert.match(churchyard, /PATH_GRASS_RECESS/);
  assert.match(churchyard, /PATH_GRASS_BANK/);
  assert.match(churchyard, /applyPathGrassBanks\(groundGeo, pathX0, pathX1/);
  assert.match(churchyard, /No userData\.era — the railings stood by 1900/);

  const match = churchyard.match(/export const NORTH_CHURCHYARD_RAILINGS\b[^=]*=\s*(\[[\s\S]*?\]);/);
  assert.ok(match);
  const points = Function(`return ${match[1]}`)() as [number, number][];
  assert.ok(points.length >= 8);
  assert.ok(points[0][0] < -15 && points[0][1] < -5); // West gate brought in towards the church
  assert.ok(points.at(-1)![0] > 15 && points.at(-1)![1] < -5); // East gate brought in towards the church
  // Shifted 4 m toward the church from the raw 1839 north frontage (which reached z ≈ -25)
  assert.ok(Math.min(...points.map((p) => p[1])) < -20);
  assert.ok(Math.min(...points.map((p) => p[1])) > -21.5);
  assert.match(churchyard, /shifted 4 m toward the church/);
});

test('walk mode Shift sprint matches the 1839 fly-mode boost and is documented in the UI', () => {
  const controls = readFileSync(new URL('assets/js/st-peters-3d/controls.ts', root), 'utf8');
  assert.match(controls, /export const WALK_SPEED = 2\.8/);
  assert.match(controls, /export const WALK_SPEED_SPRINT = 6\.4/);
  assert.match(controls, /walkMoveSpeed\(sprinting\)/);
  assert.match(controls, /shiftHeld/);
  assert.ok(6.4 / 2.8 > 2, 'Shift should roughly double walk speed, as 1839 fly mode does');

  const page = readFileSync(new URL('history/st-peters/3d-model.liquid', root), 'utf8');
  assert.match(page, /Walk Mode:.*Shift.*faster/s);
  assert.match(page, /toggles Walk mode \(WASD\/Arrows, Shift faster\)/);
});

test('the belfry hangs the three inscribed bells recorded by Cocks, and the tour climbs up to see them', () => {
  const src = readFileSync(new URL('assets/js/st-peters-3d/belfry.ts', root), 'utf8');
  for (const text of [
    'HENRI KNIGHT MADE MEE ANO 1618',
    'gloria in excelsis deo 1586',
    'Sancta Margareta Ora Pro Nobis W H'
  ]) {
    assert.ok(src.includes(text), `belfry.js should inscribe "${text}"`);
  }
  for (const inches of ['30.75', '34', '37'])
    assert.match(src, new RegExp(`diameterIn: ${inches.replace('.', '\\.')},`));

  const { size, xCenter, zCenter, baseY, eavesY } = DIM.tower;
  const inBelfry = CHURCH_TOUR_WAYPOINTS.filter(({ pos: [x, y, z] }) => {
    return Math.abs(x - xCenter) < size / 2 && Math.abs(z - zCenter) < size / 2 && y > baseY && y < eavesY;
  });
  assert.ok(inBelfry.length >= 1, 'the tour should include a view inside the bell chamber');
  assert.ok(CHURCH_TOUR_WAYPOINTS.some((wp) => /Bells/.test(wp.label)));
});

test('features fade out and back in over half a second without touching shared materials', async () => {
  const THREE = await import('three');
  const { createFader, FADE_SECONDS } = await import('../assets/js/st-peters-3d/fade.ts');
  assert.equal(FADE_SECONDS, 0.5);

  const shared = new THREE.MeshStandardMaterial({ color: 0x888888 });
  const feature = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), shared);
  mesh.castShadow = true;
  const lamp = new THREE.PointLight(0xffffff, 2);
  feature.add(mesh, lamp);
  const neighbour = new THREE.Mesh(new THREE.BoxGeometry(), shared); // e.g. baked walls sharing the stone

  const fader = createFader();
  fader.setVisible(feature, false);
  assert.equal(feature.visible, true, 'stays on screen while it fades');
  fader.update(0.25);
  assert.notEqual(mesh.material, shared);
  assert.ok(mesh.material.transparent && mesh.material.opacity > 0 && mesh.material.opacity < 1);
  assert.ok(lamp.intensity > 0 && lamp.intensity < 2);
  assert.equal(neighbour.material, shared);
  assert.equal(shared.transparent, false);
  assert.equal(shared.opacity, 1);

  assert.equal(fader.update(0.3), true, 'redraw shadows once it has gone');
  assert.equal(feature.visible, false);
  assert.equal(mesh.material, shared, 'original material back once settled');
  assert.equal(mesh.castShadow, true);
  assert.equal(lamp.intensity, 2);

  // Back in, reversed half way: carries on from where it was
  fader.setVisible(feature, true);
  assert.equal(feature.visible, true);
  fader.update(0.01);
  assert.ok(mesh.material.opacity < 0.05);
  assert.equal(mesh.castShadow, false, 'no shadow until half faded in');
  fader.update(0.2);
  fader.setVisible(feature, false);
  fader.update(0.15);
  assert.equal(feature.visible, true, 'reversed from ~40% rather than from fully shown');
  fader.update(0.1);
  assert.equal(feature.visible, false);
  assert.equal(mesh.material, shared);

  // Hidden pre-merge originals are not enlisted or cloned during fades
  const hiddenOriginal = new THREE.Mesh(new THREE.BoxGeometry(), shared);
  hiddenOriginal.visible = false;
  feature.add(hiddenOriginal);
  fader.setVisible(feature, false);
  fader.update(0.25);
  assert.equal(hiddenOriginal.material, shared, 'hidden pre-merge meshes should keep original material');
  fader.setVisible(feature, true, true);
  assert.equal(feature.visible, true);
  assert.equal(fader.isFading(), false);
});

test('Willow sprite atlas exists and Willow roams safely up and down the nave and into the vestry', () => {
  const spriteFile = new URL(`../public${WILLOW_SPRITE_SHEET.url}`, import.meta.url);
  assert.ok(existsSync(spriteFile), `missing sprite sheet ${WILLOW_SPRITE_SHEET.url}`);
  const bytes = readFileSync(spriteFile);
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP');

  // Water bowl sits in Today era underneath the rearmost North pew (closest to the front door, near the North wall)
  const willowSrc = readFileSync(new URL('../assets/js/st-peters-3d/willow.ts', import.meta.url), 'utf8');
  assert.match(willowSrc, /group\.userData\.era = 'today'/);
  assert.match(willowSrc, /group\.userData\.waterBowl = true/);
  assert.match(willowSrc, /waterDisc\.name = 'willow-water-surface'/);
  assert.match(willowSrc, /group\.visible = false/);
  assert.ok(
    WILLOW_WATER_BOWL_POS.x >= -1.82 && WILLOW_WATER_BOWL_POS.x <= -1.36,
    'water bowl should sit beneath the rearmost North pew closest to the North Porch door'
  );
  assert.ok(
    WILLOW_WATER_BOWL_POS.z < -2.0 && WILLOW_WATER_BOWL_POS.z > DIM.nave.zNorthInt + 0.2,
    'water bowl should sit near the North wall inside the pew end'
  );

  // Every waypoint & connecting edge stays strictly inside the nave/vestry and clear of all furniture & partition walls
  const byId = new Map(WILLOW_WAYPOINTS.map((wp) => [wp.id, wp]));
  const boxDist = (x: number, z: number, x0: number, x1: number, z0: number, z1: number) =>
    Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
  const clearance = 0.18; // keeps Willow clear even through the 0.38 m gap beside the octagonal font
  const pointClear = (x: number, z: number) => {
    const insideChurch =
      x > DIM.nave.xWestInt + clearance && x < DIM.nave.xEastInt - 0.35 && Math.abs(z) < DIM.nave.zSouthInt - clearance;
    const clearOfFont = Math.hypot(x + 3.98, z) > 0.64 + clearance;
    const clearOfNorthPews = boxDist(x, z, -1.85, 1.62, -2.45, -0.59) > clearance;
    const clearOfVisitorPew = boxDist(x, z, -3.55, -3.09, -2.25, -0.95) > clearance;
    const clearOfOrgan = boxDist(x, z, -5.28, -3.98, -2.35, -1.09) > clearance;
    const clearOfSouthPews = boxDist(x, z, -2.42, 2.18, 0.59, 2.45) > clearance;
    const clearOfNarrowSouthPews = boxDist(x, z, -5.14, -2.63, 1.02, 2.22) > clearance;
    const clearOfPulpit = boxDist(x, z, 1.64, 2.86, -2.54, -1.3) > clearance;
    const clearOfLectern = Math.hypot(x - 2.46, z - 1.22) > 0.3 + clearance;
    const clearOfVestryPartition =
      boxDist(x, z, -5.24, -5.12, -2.6, -0.485) > clearance && boxDist(x, z, -5.24, -5.12, 0.485, 2.6) > clearance;
    const clearOfExtinguishers =
      Math.hypot(x + 5.04, z + 0.72) > 0.08 + clearance && Math.hypot(x + 5.02, z - 0.72) > 0.1 + clearance;
    const clearOfVestryFurniture =
      boxDist(x, z, -5.94, -5.26, -2.26, -0.7) > clearance &&
      boxDist(x, z, -6.88, -6.44, -2.17, -0.93) > clearance &&
      boxDist(x, z, -5.82, -5.26, 0.74, 1.56) > clearance &&
      boxDist(x, z, -6.66, -5.5, 2.04, 2.56) > clearance;
    return (
      insideChurch &&
      clearOfFont &&
      clearOfNorthPews &&
      clearOfVisitorPew &&
      clearOfOrgan &&
      clearOfSouthPews &&
      clearOfNarrowSouthPews &&
      clearOfPulpit &&
      clearOfLectern &&
      clearOfVestryPartition &&
      clearOfExtinguishers &&
      clearOfVestryFurniture
    );
  };

  for (const wp of WILLOW_WAYPOINTS) {
    assert.ok(pointClear(wp.x, wp.z), `waypoint ${wp.id} (${wp.x}, ${wp.z}) collides with church obstacle`);
    for (const neighborId of wp.neighbors) {
      const nb = byId.get(neighborId);
      assert.ok(nb, `unknown neighbor ${neighborId} on ${wp.id}`);
      assert.ok(nb.neighbors.includes(wp.id), `edge ${wp.id} -> ${neighborId} should be bidirectional`);
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const x: number = wp.x + (nb.x - wp.x) * t;
        const z: number = wp.z + (nb.z - wp.z) * t;
        assert.ok(
          pointClear(x, z),
          `edge ${wp.id} -> ${neighborId} clips obstacle at (${x.toFixed(2)}, ${z.toFixed(2)})`
        );
      }
    }
  }

  // BFS finds a continuous route all the way from the rood screen into the vestry
  const fullRun = findWillowPath('rood-centre', 'vestry-centre');
  assert.ok(fullRun.length >= 10, `expected full-length nave-to-vestry path, got ${fullRun.length} steps`);
  assert.equal(fullRun.at(-1), 'vestry-centre');
  assert.ok(fullRun.includes('nave-centre'), 'route from rood screen to vestry runs along the nave aisle');
  assert.ok(fullRun.includes('vestry-doorway'), 'route passes through the vestry partition doorway');

  // Willow starts hidden until the water bowl is clicked, and stays paused while hidden
  const state = createWillowState({ seed: 202607 });
  assert.equal(state.name, 'Willow');
  assert.equal(state.revealed, false);
  advanceWillowState(state, 1.0, 0, 1);
  assert.equal(state.revealed, false);
  assert.equal(state.currentNodeId, 'water-bowl');

  // Clicking the water bowl reveals Willow drinking from it, then she roams the nave & vestry
  summonWillowToBowl(state);
  assert.equal(state.revealed, true);
  assert.equal(state.mode, 'drinking');
  assert.equal(state.animation, 'drinking');
  assert.equal(state.currentNodeId, 'water-bowl');
  assert.ok(state.stateRemaining >= WILLOW_DRINK_SECONDS);

  const seenAnims = new Set<string>([state.animation]);
  const visitedNodes = new Set<string>([state.currentNodeId]);
  const visitedZones = new Set<string>();
  for (let i = 0; i < 8000; i++) {
    // Rotate camera right vector slowly so all 4 running directions are exercised
    const angle = i * 0.002;
    advanceWillowState(state, 0.05, Math.cos(angle), Math.sin(angle), { x: -2.0, z: 0.0 });
    seenAnims.add(state.animation);
    visitedNodes.add(state.currentNodeId);
    const curNode = byId.get(state.currentNodeId);
    if (curNode) visitedZones.add(curNode.zone);
    assert.ok(
      pointClear(state.x, state.z),
      `Willow clipped obstacle at (${state.x.toFixed(2)}, ${state.z.toFixed(2)})`
    );
  }
  for (const anim of [
    'drinking',
    'idle',
    'running-left',
    'running-right',
    'running-front',
    'running-back',
    'waving',
    'jumping',
    'failed'
  ]) {
    assert.ok(seenAnims.has(anim), `Willow should play the "${anim}" animation`);
  }
  for (const zone of ['vestry', 'west-nave', 'mid-nave', 'east-nave']) {
    assert.ok(visitedZones.has(zone), `Willow should visit zone "${zone}"`);
  }
  assert.ok(visitedNodes.has('vestry-centre'), 'Willow should run into the vestry');
  assert.ok(visitedNodes.has('rood-centre'), 'Willow should run up to the east nave by the rood screen');

  // Clicking the water bowl again calls Willow back from wherever she is to drink again
  state.currentNodeId = 'rood-centre';
  state.x = 2.52;
  state.z = 0;
  summonWillowToBowl(state);
  assert.equal(state.mode, 'running');
  assert.equal(state.path.at(-1), 'water-bowl');
  for (let i = 0; i < 400 && state.mode === 'running'; i++) {
    advanceWillowState(state, 0.05, 0, 1);
  }
  assert.equal(state.currentNodeId, 'water-bowl');
  assert.equal(state.mode, 'drinking');
  assert.equal(state.animation, 'drinking');

  // Camera-relative 4-way running direction (Nave → Chancel camera looks +X, so camRight = (0, +1))
  assert.equal(pickRunAnimation(1, 0, 0, 1, 'running-right'), 'running-back'); // running East away from viewer
  assert.equal(pickRunAnimation(-1, 0, 0, 1, 'running-back'), 'running-front'); // running West toward viewer
  assert.equal(pickRunAnimation(0, 1, 0, 1, 'running-front'), 'running-right'); // running South to viewer's right
  assert.equal(pickRunAnimation(0, -1, 0, 1, 'running-right'), 'running-left'); // running North to viewer's left
  // And from Nave → Tower (camera looks -X, camRight = (0, -1)), West is away and East is toward viewer
  assert.equal(pickRunAnimation(-1, 0, 0, -1, 'running-left'), 'running-back');
  assert.equal(pickRunAnimation(1, 0, 0, -1, 'running-back'), 'running-front');

  // Clicking Willow alternates between waving and jumping
  triggerWillowGreet(state);
  assert.equal(state.animation, 'waving');
  triggerWillowGreet(state);
  assert.equal(state.animation, 'jumping');

  // Floor height rises slightly on both the crimson vestry carpet and the gold rood-screen runner
  assert.equal(willowFloorY(0, 0), DIM.naveFloorY);
  assert.ok(willowFloorY(-6.2, 0) > DIM.naveFloorY, 'vestry carpet sits above bare quarry tiles');
  assert.ok(willowFloorY(2.6, 0) > DIM.naveFloorY, 'east carpet runner sits above bare quarry tiles');
});

test('releaseCanvasBackingStores uploads static textures in two passes before zeroing canvases', async () => {
  const { canvasTexture, registerStaticCanvasTexture, releaseCanvasBackingStores } =
    await import('../assets/js/st-peters-3d/canvas-utils.ts');

  const fakeCanvas = (w: number, h: number) =>
    ({ width: w, height: h, getContext: () => ({}) }) as unknown as HTMLCanvasElement;

  const shared = fakeCanvas(512, 512);
  const retained = fakeCanvas(1024, 1024);
  const texA = canvasTexture(shared);
  const texB = registerStaticCanvasTexture(texA.clone());
  const texRetained = canvasTexture(retained, { retainBacking: true });

  const uploadedDims: Array<[number, number]> = [];
  const uploaded: unknown[] = [];
  const fakeRenderer = {
    initTexture(tex: { image?: unknown }) {
      uploaded.push(tex);
      const img = tex.image as { width: number; height: number };
      uploadedDims.push([img.width, img.height]);
    }
  };

  const count = releaseCanvasBackingStores(fakeRenderer);
  assert.equal(count, 1, 'only the single unique static canvas should be released');
  assert.deepEqual(uploaded, [texA, texB], 'both original and cloned static textures upload; retained does not');
  assert.deepEqual(
    uploadedDims,
    [
      [512, 512],
      [512, 512]
    ],
    'both cloned textures see intact pixels during Pass 1 before Pass 2 zeros the shared canvas'
  );
  assert.equal(shared.width, 0);
  assert.equal(shared.height, 0);
  assert.equal(retained.width, 1024, 'retainBacking: true preserves the canvas for later 1900/font redraws');
  assert.equal(retained.height, 1024);
  assert.equal(texRetained.image, retained);
  assert.equal(releaseCanvasBackingStores(fakeRenderer), 0, 'second call is an idempotent no-op');
});

test('belfry bell textures are downscaled to 1024x768 and painted lazily on belfry entry', () => {
  const belfry = readFileSync(new URL('assets/js/st-peters-3d/belfry.ts', root), 'utf8');
  const main = readFileSync(new URL('assets/js/st-peters-3d/main.ts', root), 'utf8');
  assert.match(belfry, /const ROW = 32;/);
  assert.match(belfry, /const W = 1024;/);
  assert.match(belfry, /function ensureBellMaps\(/);
  assert.match(main, /bellRinger\.ensureBellMaps\(renderer\)/);
  assert.match(main, /releaseCanvasBackingStores\(renderer\)/);
});
