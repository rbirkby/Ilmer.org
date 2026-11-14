export function validateTerrain(data) {
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

export function terrainHeight(data, x, z) {
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
  const sample = (i, j) => data.elevations[j * data.columns + i];
  const elevation =
    dx + dy <= 1
      ? sample(ix, iy) * (1 - dx - dy) + sample(ix + 1, iy) * dx + sample(ix, iy + 1) * dy
      : sample(ix, iy + 1) * (1 - dx) + sample(ix + 1, iy) * (1 - dy) + sample(ix + 1, iy + 1) * (dx + dy - 1);
  return elevation - data.baseElevation;
}

export function historicalTerrain(measured) {
  validateTerrain(measured);
  const elevations = measured.elevations.slice();
  let modifiedSamples = 0;
  let maxRemoval = 0;
  // The modern embankment crosses the eastern crop. Its pre-earthwork grade is
  // inferred between the measured feet, not evidence of exact 1839 elevations.
  for (let row = 0; row < measured.rows; row++) {
    const along = row / (measured.rows - 1);
    const left = (1880 - 80 * along) / 2000;
    const right = (1990 - 50 * along) / 2000;
    const z = (along - 0.5) * measured.depth;
    const a = terrainHeight(measured, (left - 0.5) * measured.width, z) + measured.baseElevation;
    const b = terrainHeight(measured, (right - 0.5) * measured.width, z) + measured.baseElevation;
    for (let col = 0; col < measured.columns; col++) {
      const across = (col / (measured.columns - 1) - left) / (right - left);
      if (across <= 0 || across >= 1) continue;
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
      description: 'Modern eastern embankment removed; grade inferred between measured feet with blended margins',
      modifiedSamples,
      maxRemoval
    }
  };
}
