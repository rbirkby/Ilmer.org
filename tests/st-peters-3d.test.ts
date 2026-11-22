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
} from '../assets/js/st-peters-3d/dimensions.js';
import { CHURCHYARD_MEMORIALS } from '../assets/js/st-peters-3d/memorials-data.js';

const root = new URL('../', import.meta.url);

test("St Peter's 3D page lives beneath St Peter's Church with reconstruction layout and church tag", () => {
  const page = readFileSync(new URL('history/st-peters/3d-model.liquid', root), 'utf8');
  assert.match(page, /^layout:\s*reconstruction$/m);
  assert.match(page, /^tags:\s*\[church,\s*history\]$/m);
  assert.match(page, /ancestorCrumb1Source:\s*\{[^}]*url:\s*'\/history\/st-peters\/'/);
  assert.match(page, /^permalink:\s*\/history\/st-peters\/3d-model\/index\.html$/m);
  assert.match(page, /id="church-scene"/);
});

test("every St Peter's 3D module imported by the page exists and is cache-busted in the importmap", () => {
  const page = readFileSync(new URL('history/st-peters/3d-model.liquid', root), 'utf8');
  const importMapMatch = page.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(importMapMatch, 'importmap script block should exist');

  const importMap = JSON.parse(importMapMatch[1]);
  assert.equal(importMap.imports.three, '/assets/vendor/three/three.module.js');

  const pending = ['/assets/js/st-peters-3d/main.js'];
  const seen = new Set<string>();

  while (pending.length > 0) {
    const modPath = pending.pop()!;
    if (seen.has(modPath)) continue;
    seen.add(modPath);

    const fileUrl = new URL(modPath.replace(/^\//, ''), root);
    assert.ok(existsSync(fileUrl), `missing module ${modPath}`);
    const source = readFileSync(fileUrl, 'utf8');

    // Both `import x from '...'` and side-effect `import '...'` (walk joystick, stats overlay)
    for (const match of source.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) {
      const spec = match[1];
      if (spec.startsWith('/assets/js/st-peters-3d/')) {
        assert.ok(
          importMap.imports[spec]?.includes(`'${spec}' | cacheBust`),
          `module ${spec} should be cache-busted in the importmap`
        );
        pending.push(spec);
      }
    }
  }

  assert.equal(seen.size, 16);
  assert.ok(seen.has('/assets/js/st-peters-3d/static-merge.js'));
  assert.ok(seen.has('/assets/js/st-peters-3d/stats-overlay.js'));
  assert.ok(seen.has('/assets/js/st-peters-3d/belfry.js'));
  assert.ok(seen.has('/assets/js/st-peters-3d/stained-glass.js'));
  assert.ok(seen.has('/assets/js/st-peters-3d/plaques.js'));

  const texturesSource = readFileSync(new URL('assets/js/st-peters-3d/textures.js', root), 'utf8');
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

test('surface elevation never drops below ground level and tracks interior floors and outer hills', () => {
  assert.equal(getSurfaceY(0, 0), DIM.naveFloorY);
  assert.equal(getSurfaceY(5.0, 0), DIM.chancelFloorY);
  assert.equal(getSurfaceY(6.8, 0), DIM.sanctuaryStep1Y);
  assert.equal(getSurfaceY(8.2, 0), DIM.sanctuaryStep2Y);
  assert.equal(getSurfaceY(DIM.porch.xCenter, -4.0), DIM.porchFloorY);
  assert.equal(getSurfaceY(0, -10), DIM.groundY);
  assert.equal(getGroundHeight(0, -10), DIM.groundY);

  // Across the full 120m x 120m churchyard ground mesh, surface height is always >= 0 and >= terrain height
  for (let x = -50; x <= 50; x += 5) {
    for (let z = -50; z <= 50; z += 5) {
      const surface = getSurfaceY(x, z);
      assert.ok(surface >= DIM.groundY, `surface at (${x}, ${z}) should be >= 0, got ${surface}`);
      assert.ok(surface >= getGroundHeight(x, z), `surface at (${x}, ${z}) should be >= terrain height`);
    }
  }
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

test('the belfry hangs the three inscribed bells recorded by Cocks, and the tour climbs up to see them', () => {
  const src = readFileSync(new URL('assets/js/st-peters-3d/belfry.js', root), 'utf8');
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
