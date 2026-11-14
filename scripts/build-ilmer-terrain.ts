import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MAP } from '../assets/js/ilmer-1839-data.js';

const sourceUrl = 'https://environment.data.gov.uk/geoservices/datasets/13787b9a-26a4-4775-8523-806d13af58fc/wcs';
const coverageId = '13787b9a-26a4-4775-8523-806d13af58fc__Lidar_Composite_Elevation_DTM_1m';
const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/build-ilmer-terrain.ts path/to/geographic-dtm.tif');
const bytes = readFileSync(input);
if (bytes.toString('ascii', 0, 2) !== 'MM' || bytes.readUInt16BE(2) !== 42) {
  throw new Error('Expected the big-endian GeoTIFF returned by the EA WCS.');
}
const ifd = bytes.readUInt32BE(4);
const tags = new Map<number, number[]>();
for (let i = 0; i < bytes.readUInt16BE(ifd); i++) {
  const offset = ifd + 2 + i * 12;
  const tag = bytes.readUInt16BE(offset);
  const type = bytes.readUInt16BE(offset + 2);
  const count = bytes.readUInt32BE(offset + 4);
  const size = type === 3 ? 2 : type === 4 ? 4 : type === 12 ? 8 : 1;
  const start = count * size <= 4 ? offset + 8 : bytes.readUInt32BE(offset + 8);
  tags.set(
    tag,
    Array.from({ length: count }, (_, index) => {
      const p = start + index * size;
      return type === 3
        ? bytes.readUInt16BE(p)
        : type === 4
          ? bytes.readUInt32BE(p)
          : type === 12
            ? bytes.readDoubleBE(p)
            : bytes[p];
    })
  );
}
function tag(id: number): number[] {
  const value = tags.get(id);
  if (!value) throw new Error(`Missing GeoTIFF tag ${id}.`);
  return value;
}
if (tag(259)[0] !== 1 || tag(258)[0] !== 32 || tag(339)[0] !== 3 || tag(277)[0] !== 1) {
  throw new Error('Expected uncompressed, single-band float32 elevation data.');
}
const keys = tag(34735);
if (!keys.some((value, index) => value === 2048 && keys[index + 3] === 4326)) {
  throw new Error('Expected EA WCS output reprojected to EPSG:4326.');
}
const width = tag(256)[0];
const height = tag(257)[0];
const tileWidth = tag(322)[0];
const tileHeight = tag(323)[0];
const tileOffsets = tag(324);
const matrix = tag(34264);
if (matrix[1] !== 0 || matrix[4] !== 0 || matrix[0] <= 0 || matrix[5] >= 0) {
  throw new Error('Unexpected geographic raster orientation.');
}
function pixel(x: number, y: number): number {
  if (x < 0 || x >= width || y < 0 || y >= height) throw new Error(`DTM does not cover pixel ${x}, ${y}.`);
  const tile = Math.floor(y / tileHeight) * Math.ceil(width / tileWidth) + Math.floor(x / tileWidth);
  const offset = tileOffsets[tile] + ((y % tileHeight) * tileWidth + (x % tileWidth)) * 4;
  const value = bytes.readFloatBE(offset);
  if (!Number.isFinite(value) || value < 50 || value > 200)
    throw new Error(`Invalid or missing Ilmer elevation: ${value}.`);
  return value;
}
function elevation(lon: number, lat: number): number {
  const x = (lon - matrix[3]) / matrix[0] - 0.5;
  const y = (lat - matrix[7]) / matrix[5] - 0.5;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const u = x - ix;
  const v = y - iy;
  return (
    (pixel(ix, iy) * (1 - u) + pixel(ix + 1, iy) * u) * (1 - v) +
    (pixel(ix, iy + 1) * (1 - u) + pixel(ix + 1, iy + 1) * u) * v
  );
}

// Public OSM footprint centres are control points, not surveyed historical positions.
const landmarks = [
  { name: "St Peter's", x: 957, y: 507, lon: -0.8872465785714285, lat: 51.7428576 },
  { name: 'Old Vicarage', x: 1045, y: 536, lon: -0.8867937962962963, lat: 51.742943933333336 },
  { name: 'Middle Farm / September Cottage', x: 1150, y: 620, lon: -0.8861316666666667, lat: 51.74297842222222 },
  { name: 'Lower Farmhouse', x: 1542, y: 636, lon: -0.8848811909090909, lat: 51.74372345454546 },
  { name: 'A1 range / Harvest Barn', x: 804, y: 522, lon: -0.8894206, lat: 51.74320624 },
  { name: 'Northern cottages / The Green', x: 998, y: 281, lon: -0.8883404555555556, lat: 51.74334103333334 }
];
function kernel(distance: number): number {
  return distance === 0 ? 0 : distance * distance * Math.log(distance);
}
function solve(matrix: number[][], rhs: number[]): number[] {
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let i = 0; i < a.length; i++) {
    let pivot = i;
    for (let j = i + 1; j < a.length; j++) if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) pivot = j;
    [a[i], a[pivot]] = [a[pivot], a[i]];
    if (Math.abs(a[i][i]) < 1e-12) throw new Error('Historical registration control points are singular.');
    const divisor = a[i][i];
    a[i] = a[i].map((value) => value / divisor);
    for (let j = 0; j < a.length; j++) {
      if (j === i) continue;
      const factor = a[j][i];
      a[j] = a[j].map((value, k) => value - factor * a[i][k]);
    }
  }
  return a.map((row) => row.at(-1)!);
}
const n = landmarks.length;
const registration = Array.from({ length: n + 3 }, () => Array<number>(n + 3).fill(0));
landmarks.forEach((a, i) => {
  landmarks.forEach((b, j) => (registration[i][j] = kernel(Math.hypot((a.x - b.x) / 1000, (a.y - b.y) / 1000))));
  registration[i][n] = registration[n][i] = 1;
  registration[i][n + 1] = registration[n + 1][i] = a.x / 1000;
  registration[i][n + 2] = registration[n + 2][i] = a.y / 1000;
});
const lonCoefficients = solve(registration, [...landmarks.map((p) => p.lon), 0, 0, 0]);
const latCoefficients = solve(registration, [...landmarks.map((p) => p.lat), 0, 0, 0]);
function coordinate(x: number, y: number, coefficients: number[]): number {
  return (
    coefficients[n] +
    (coefficients[n + 1] * x) / 1000 +
    (coefficients[n + 2] * y) / 1000 +
    landmarks.reduce(
      (total, p, i) => total + coefficients[i] * kernel(Math.hypot((x - p.x) / 1000, (y - p.y) / 1000)),
      0
    )
  );
}
const columns = 201;
const rows = 89;
const elevations = [];
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < columns; col++) {
    const x = (col * MAP.width) / (columns - 1);
    const y = (row * MAP.height) / (rows - 1);
    elevations.push(Number(elevation(coordinate(x, y, lonCoefficients), coordinate(x, y, latCoefficients)).toFixed(3)));
  }
}
const data = {
  columns,
  rows,
  width: MAP.width * MAP.scale,
  depth: MAP.height * MAP.scale,
  baseElevation: Math.floor(Math.min(...elevations)),
  minElevation: Math.min(...elevations),
  maxElevation: Math.max(...elevations),
  verticalUnitsPerMetre: 1,
  verticalExaggeration: 1,
  source: {
    name: 'Environment Agency LIDAR Composite DTM 1m',
    url: sourceUrl,
    coverageId,
    request: 'EPSG:27700 E(475500,478500) N(204500,207000), outputCRS EPSG:4326, image/tiff',
    compositeYear: 2022,
    sourceResolutionMetres: 1,
    datum: 'Ordnance Datum Newlyn (source product)',
    licence: 'Open Government Licence v3.0',
    attribution:
      'Contains Environment Agency information © Environment Agency copyright and/or database right 2022. All rights reserved.',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    registration:
      'Thin-plate spline fitted to six approximate historical/modern footprint correspondences. Not a georectified historical survey.',
    modernLandmarkSource: 'https://www.openstreetmap.org/copyright',
    landmarks: landmarks.map((p) => ({ ...p, elevation: Number(elevation(p.lon, p.lat).toFixed(3)) }))
  },
  elevations
};
writeFileSync(new URL('../assets/ilmer-terrain.json', import.meta.url), JSON.stringify(data, null, 2) + '\n');
console.log(`Built ${columns} × ${rows} terrain samples: ${data.minElevation}–${data.maxElevation} m ODN.`);
console.log(data.source.landmarks.map((p) => `${p.name}: ${p.elevation} m`).join('\n'));
