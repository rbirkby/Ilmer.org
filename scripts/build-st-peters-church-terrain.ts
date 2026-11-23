/**
 * Sample the village measured terrain into a church-local elevation crop for St Peter's 3D.
 *
 * Heights are relative to CHURCH_PLAN.centre so the church model stays on y = 0.
 * Writes assets/st-peters-church-terrain.json and assets/js/st-peters-3d/church-terrain-data.js.
 *
 * Usage: node scripts/build-st-peters-church-terrain.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CHURCH_PLAN, mapPoint } from '../assets/js/ilmer-1839-data.js';
import { terrainHeight, validateTerrain } from '../assets/js/ilmer-terrain.js';

const measured = validateTerrain(
  JSON.parse(readFileSync(new URL('../assets/ilmer-terrain.json', import.meta.url), 'utf8'))
);
const [originX, originZ] = mapPoint(...CHURCH_PLAN.centre);
const angleRad = (CHURCH_PLAN.angle * Math.PI) / 180;
const cos = Math.cos(angleRad);
const sin = Math.sin(angleRad);
const datum = terrainHeight(measured, originX, originZ);

// Matches the 120 m churchyard ground mesh; 2 m spacing ≈ the parent DTM sample spacing.
const half = 60;
const spacing = 2;
const n = (half * 2) / spacing + 1;
const elevations: number[] = [];
let min = Infinity;
let max = -Infinity;
for (let row = 0; row < n; row++) {
  const lz = -half + row * spacing;
  for (let col = 0; col < n; col++) {
    const lx = -half + col * spacing;
    const wx = originX + lx * cos - lz * sin;
    const wz = originZ + lx * sin + lz * cos;
    const cx = Math.max(-measured.width / 2, Math.min(measured.width / 2, wx));
    const cz = Math.max(-measured.depth / 2, Math.min(measured.depth / 2, wz));
    const h = terrainHeight(measured, cx, cz) - datum;
    elevations.push(Math.round(h * 1000) / 1000);
    min = Math.min(min, h);
    max = Math.max(max, h);
  }
}

const out = {
  columns: n,
  rows: n,
  width: half * 2,
  depth: half * 2,
  spacing,
  baseElevation: 0,
  minElevation: Math.round(min * 1000) / 1000,
  maxElevation: Math.round(max * 1000) / 1000,
  verticalUnitsPerMetre: 1,
  verticalExaggeration: 1,
  source: {
    description:
      "Church-local crop of assets/ilmer-terrain.json (EA LIDAR DTM), relative to St Peter's CHURCH_PLAN centre height",
    churchPlanCentre: CHURCH_PLAN.centre,
    churchPlanAngleDegrees: CHURCH_PLAN.angle,
    originWorld: [Math.round(originX * 1000) / 1000, Math.round(originZ * 1000) / 1000],
    datumMetresOD: Math.round((datum + measured.baseElevation) * 1000) / 1000,
    parent: '/assets/ilmer-terrain.json'
  },
  elevations
};

const jsonPath = new URL('../assets/st-peters-church-terrain.json', import.meta.url);
const jsPath = new URL('../assets/js/st-peters-3d/church-terrain-data.js', import.meta.url);
writeFileSync(jsonPath, `${JSON.stringify(out)}\n`);
writeFileSync(
  jsPath,
  `// Auto-derived church-local crop of /assets/ilmer-terrain.json (relative to CHURCH_PLAN centre).\n` +
    `// Regenerate with: node scripts/build-st-peters-church-terrain.ts\n` +
    `export default ${JSON.stringify(out)};\n`
);
console.log(
  `Wrote ${n}×${n} church terrain (min ${out.minElevation} m, max ${out.maxElevation} m relative to church).`
);
