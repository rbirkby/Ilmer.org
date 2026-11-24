/** A measured height grid, row by row from the north-west corner, in metres. */
export interface TerrainGrid {
  columns: number;
  rows: number;
  width: number;
  depth: number;
  baseElevation: number;
  minElevation?: number;
  maxElevation?: number;
  verticalUnitsPerMetre: 1;
  verticalExaggeration: 1;
  elevations: number[];
  embankment?: { name: string; start: [number, number]; end: [number, number]; halfWidth: number };
}

/** A landmark on the tithe map (pixels) with its surveyed position. */
export interface TerrainLandmark {
  name: string;
  x: number;
  y: number;
  lon: number;
  lat: number;
  elevation: number;
}

/** assets/ilmer-terrain.json: the LIDAR grid with its provenance. */
export interface MeasuredTerrain extends TerrainGrid {
  minElevation: number;
  maxElevation: number;
  source: {
    name: string;
    url: string;
    coverageId: string;
    request: string;
    compositeYear: number;
    sourceResolutionMetres: number;
    sampleSpacingMetres: number;
    datum: string;
    licence: string;
    attribution: string;
    sha256: string;
    registration: string;
    titheToGrid: [[number, number, number], [number, number, number]];
    groundMetresPerTithePixel: number;
    osHeights: {
      name: string;
      gridReference: [number, number];
      surveyedMetres: number;
      lidarMetres: number;
      differenceMetres: number;
    }[];
    landmarks: TerrainLandmark[];
  };
}

/**
 * Checks the grid's shape and heights. `T` names the file's full shape for callers that read assets/ilmer-terrain.json
 * (MeasuredTerrain); only the grid itself is checked here.
 */
export function validateTerrain<T extends TerrainGrid = TerrainGrid>(input: unknown): T {
  const data = input as T;
  if (
    !Number.isInteger(data.columns) ||
    !Number.isInteger(data.rows) ||
    data.columns < 2 ||
    data.rows < 2 ||
    data.elevations?.length !== data.columns * data.rows ||
    !(data.width > 0) ||
    !(data.depth > 0) ||
    !Number.isFinite(data.baseElevation) ||
    data.verticalUnitsPerMetre !== 1 ||
    data.verticalExaggeration !== 1 ||
    data.elevations.some((value) => !Number.isFinite(value))
  ) {
    throw new Error('Invalid measured terrain grid.');
  }
  return data;
}

export function terrainHeight(data: TerrainGrid, x: number, z: number) {
  const col = (x / data.width + 0.5) * (data.columns - 1);
  const row = (z / data.depth + 0.5) * (data.rows - 1);
  if (col < -1e-5 || row < -1e-5 || col > data.columns - 1 + 1e-5 || row > data.rows - 1 + 1e-5) {
    throw new Error(`Position is outside measured terrain: ${x}, ${z}`);
  }
  const u = Math.max(0, Math.min(data.columns - 1, col));
  const v = Math.max(0, Math.min(data.rows - 1, row));
  const ix = Math.min(Math.floor(u), data.columns - 2);
  const iy = Math.min(Math.floor(v), data.rows - 2);
  const dx = u - ix;
  const dy = v - iy;
  const sample = (i: number, j: number) => data.elevations[j * data.columns + i];
  const elevation =
    dx + dy <= 1
      ? sample(ix, iy) * (1 - dx - dy) + sample(ix + 1, iy) * dx + sample(ix, iy + 1) * dy
      : sample(ix, iy + 1) * (1 - dx) + sample(ix + 1, iy) * (1 - dy) + sample(ix + 1, iy + 1) * (dx + dy - 1);
  return elevation - data.baseElevation;
}

/** Measured height above datum, with the position held inside the surveyed crop. */
function clampedElevation(data: TerrainGrid, x: number, z: number) {
  const cx = Math.max(-data.width / 2, Math.min(data.width / 2, x));
  const cz = Math.max(-data.depth / 2, Math.min(data.depth / 2, z));
  return terrainHeight(data, cx, cz) + data.baseElevation;
}

/**
 * Remove the railway embankment (1862) along the crest line traced in the LIDAR. Within its half-width the ground
 * blends to a straight grade between the measured heights at its two feet; outside it the LIDAR is untouched. The
 * pre-earthwork grade is inferred, not evidence of exact 1839 elevations.
 */
export function historicalTerrain<T extends TerrainGrid>(
  measured: T
): T & {
  minElevation: number;
  maxElevation: number;
  historicalCorrection: { description: string; modifiedSamples: number; maxRemoval: number };
} {
  validateTerrain(measured);
  const embankment = measured.embankment;
  if (!embankment || !(embankment.halfWidth > 0)) throw new Error('Measured terrain has no embankment line.');
  const [sx, sz] = embankment.start;
  const [ex, ez] = embankment.end;
  const length = Math.hypot(ex - sx, ez - sz);
  const along = [(ex - sx) / length, (ez - sz) / length];
  const normal = [-along[1], along[0]];
  const half = embankment.halfWidth;
  const elevations = measured.elevations.slice();
  let modifiedSamples = 0;
  let maxRemoval = 0;
  for (let row = 0; row < measured.rows; row++) {
    const z = (row / (measured.rows - 1) - 0.5) * measured.depth;
    for (let col = 0; col < measured.columns; col++) {
      const x = (col / (measured.columns - 1) - 0.5) * measured.width;
      const t = (x - sx) * along[0] + (z - sz) * along[1];
      const offset = (x - sx) * normal[0] + (z - sz) * normal[1];
      if (t < 0 || t > length || Math.abs(offset) >= half) continue;
      const cx = sx + along[0] * t;
      const cz = sz + along[1] * t;
      const a = clampedElevation(measured, cx - normal[0] * half, cz - normal[1] * half);
      const b = clampedElevation(measured, cx + normal[0] * half, cz + normal[1] * half);
      const across = (offset + half) / (2 * half);
      const edge = Math.min(1, across / 0.12, (1 - across) / 0.12);
      const blend = edge * edge * (3 - 2 * edge);
      const index = row * measured.columns + col;
      const original = measured.elevations[index];
      elevations[index] = original + (a + (b - a) * across - original) * blend;
      maxRemoval = Math.max(maxRemoval, original - elevations[index]);
      modifiedSamples++;
    }
  }
  return {
    ...measured,
    elevations,
    minElevation: Math.min(...elevations),
    maxElevation: Math.max(...elevations),
    historicalCorrection: {
      description: `${embankment.name} removed along its traced crest; grade inferred between its measured feet`,
      modifiedSamples,
      maxRemoval
    }
  };
}
