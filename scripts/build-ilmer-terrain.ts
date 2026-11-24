import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MAP, mapPoint } from '../assets/js/ilmer-1839-data.ts';
import type { DetectedTreeData } from '../assets/js/ilmer-trees.ts';

// Environment Agency LIDAR Composite DTM 1 m, requested in its native British National Grid (no resampling):
// https://environment.data.gov.uk/geoservices/datasets/13787b9a-26a4-4775-8523-806d13af58fc/wcs?service=WCS
//   &version=2.0.1&request=GetCoverage&format=image/tiff
//   &CoverageId=13787b9a-26a4-4775-8523-806d13af58fc__Lidar_Composite_Elevation_DTM_1m
//   &subset=E(475500,478500)&subset=N(204500,207000)
const sourceUrl = 'https://environment.data.gov.uk/geoservices/datasets/13787b9a-26a4-4775-8523-806d13af58fc/wcs';
const coverageId = '13787b9a-26a4-4775-8523-806d13af58fc__Lidar_Composite_Elevation_DTM_1m';
const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/build-ilmer-terrain.ts path/to/ilmer-dtm-27700.tif');
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
if (!keys.some((value, index) => value === 3072 && keys[index + 3] === 27700)) {
  throw new Error('Expected EA WCS output in British National Grid (EPSG:27700).');
}
const width = tag(256)[0];
const height = tag(257)[0];
const tileWidth = tag(322)[0];
const tileHeight = tag(323)[0];
const tileOffsets = tag(324);
const matrix = tag(34264);
if (matrix[0] !== 1 || matrix[5] !== -1 || matrix[1] !== 0 || matrix[4] !== 0) {
  throw new Error('Expected a north-up 1 m raster.');
}
const [originEast, originNorth] = [matrix[3], matrix[7]];
function pixel(x: number, y: number): number {
  if (x < 0 || x >= width || y < 0 || y >= height) throw new Error(`DTM does not cover pixel ${x}, ${y}.`);
  const tile = Math.floor(y / tileHeight) * Math.ceil(width / tileWidth) + Math.floor(x / tileWidth);
  const offset = tileOffsets[tile] + ((y % tileHeight) * tileWidth + (x % tileWidth)) * 4;
  const value = bytes.readFloatBE(offset);
  if (!Number.isFinite(value) || value < 50 || value > 200)
    throw new Error(`Invalid or missing Ilmer elevation: ${value}.`);
  return value;
}
/** Bilinear height at a National Grid position (pixel values are 1 m cell centres). */
function elevation(east: number, north: number): number {
  const x = east - originEast - 0.5;
  const y = originNorth - north - 0.5;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const u = x - ix;
  const v = y - iy;
  return (
    (pixel(ix, iy) * (1 - u) + pixel(ix + 1, iy) * u) * (1 - v) +
    (pixel(ix, iy + 1) * (1 - u) + pixel(ix + 1, iy + 1) * u) * v
  );
}

// Registration: tithe map → Ordnance Survey map → National Grid.
// 1. The Ordnance Survey map is laid over the tithe map by St Peter's Church and Lower Farm's main farmhouse
//    (benchmark B.M. 270·5), the same two-point similarity that places the trees (assets/ilmer-trees.json).
// 2. The Ordnance Survey map sits on the National Grid by the same two buildings' OpenStreetMap footprints, then a
//    chamfer fit of its field boundaries, roads and ditches to edges in the LIDAR itself (a 1.5 m adjustment).
const OS_TO_GRID = [
  [0.389448222449198, 0.004908949491948983, 476463.4900127669],
  [0.004908949491948983, -0.389448222449198, 205848.52834508268]
];
const trees = JSON.parse(
  readFileSync(new URL('../assets/ilmer-trees.json', import.meta.url), 'utf8')
) as DetectedTreeData;
const [[a, b, c], [d, e, f]] = trees.registration.matrix;
const determinant = a * e - b * d;
function titheToGrid(x: number, y: number): [number, number] {
  // Undo the OS → tithe similarity, then go OS → National Grid
  const osX = (e * (x - c) - b * (y - f)) / determinant;
  const osY = (a * (y - f) - d * (x - c)) / determinant;
  return [
    OS_TO_GRID[0][0] * osX + OS_TO_GRID[0][1] * osY + OS_TO_GRID[0][2],
    OS_TO_GRID[1][0] * osX + OS_TO_GRID[1][1] * osY + OS_TO_GRID[1][2]
  ];
}
function gridToTithe(east: number, north: number): [number, number] {
  const [[g, h, i], [j, k, l]] = OS_TO_GRID;
  const det = g * k - h * j;
  const osX = (k * (east - i) - h * (north - l)) / det;
  const osY = (g * (north - l) - j * (east - i)) / det;
  return [a * osX + b * osY + c, d * osX + e * osY + f];
}

/**
 * National Grid → WGS84 latitude/longitude for GPS. Inverse transverse Mercator on Airy 1830, then the OS
 * seven-parameter Helmert shift to WGS84 (good to a few metres, ample for phone GPS).
 */
function gridToWgs84(east: number, north: number): { lat: number; lon: number } {
  const [a, b] = [6377563.396, 6356256.909];
  const [F0, lat0, lon0, N0, E0] = [0.9996012717, (49 * Math.PI) / 180, (-2 * Math.PI) / 180, -100000, 400000];
  const e2 = 1 - (b * b) / (a * a);
  const n = (a - b) / (a + b);
  const meridian = (lat: number) =>
    b *
    F0 *
    ((1 + n + (5 / 4) * n ** 2 + (5 / 4) * n ** 3) * (lat - lat0) -
      (3 * n + 3 * n ** 2 + (21 / 8) * n ** 3) * Math.sin(lat - lat0) * Math.cos(lat + lat0) +
      ((15 / 8) * n ** 2 + (15 / 8) * n ** 3) * Math.sin(2 * (lat - lat0)) * Math.cos(2 * (lat + lat0)) -
      (35 / 24) * n ** 3 * Math.sin(3 * (lat - lat0)) * Math.cos(3 * (lat + lat0)));
  let lat = lat0;
  let M = 0;
  do {
    lat += (north - N0 - M) / (a * F0);
    M = meridian(lat);
  } while (Math.abs(north - N0 - M) >= 0.00001);
  const sin = Math.sin(lat);
  const nu = (a * F0) / Math.sqrt(1 - e2 * sin * sin);
  const rho = (a * F0 * (1 - e2)) / (1 - e2 * sin * sin) ** 1.5;
  const eta2 = nu / rho - 1;
  const tan = Math.tan(lat);
  const sec = 1 / Math.cos(lat);
  const dE = east - E0;
  const phi =
    lat -
    (tan / (2 * rho * nu)) * dE ** 2 +
    (tan / (24 * rho * nu ** 3)) * (5 + 3 * tan ** 2 + eta2 - 9 * tan ** 2 * eta2) * dE ** 4 -
    (tan / (720 * rho * nu ** 5)) * (61 + 90 * tan ** 2 + 45 * tan ** 4) * dE ** 6;
  const lambda =
    lon0 +
    (sec / nu) * dE -
    (sec / (6 * nu ** 3)) * (nu / rho + 2 * tan ** 2) * dE ** 3 +
    (sec / (120 * nu ** 5)) * (5 + 28 * tan ** 2 + 24 * tan ** 4) * dE ** 5 -
    (sec / (5040 * nu ** 7)) * (61 + 662 * tan ** 2 + 1320 * tan ** 4 + 720 * tan ** 6) * dE ** 7;
  // OSGB36 geodetic → cartesian → Helmert → WGS84 geodetic
  const nuA = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const x1 = nuA * Math.cos(phi) * Math.cos(lambda);
  const y1 = nuA * Math.cos(phi) * Math.sin(lambda);
  const z1 = nuA * (1 - e2) * Math.sin(phi);
  const arc = Math.PI / 180 / 3600;
  const [tx, ty, tz, s, rx, ry, rz] = [
    446.448,
    -125.157,
    542.06,
    1 - 20.4894e-6,
    0.1502 * arc,
    0.247 * arc,
    0.8421 * arc
  ];
  const x2 = tx + s * x1 - rz * y1 + ry * z1;
  const y2 = ty + rz * x1 + s * y1 - rx * z1;
  const z2 = tz - ry * x1 + rx * y1 + s * z1;
  const [a2, b2] = [6378137, 6356752.3142];
  const e22 = 1 - (b2 * b2) / (a2 * a2);
  const p = Math.hypot(x2, y2);
  let latitude = Math.atan2(z2, p * (1 - e22));
  for (let i = 0; i < 10; i++) {
    const v = a2 / Math.sqrt(1 - e22 * Math.sin(latitude) ** 2);
    latitude = Math.atan2(z2 + e22 * v * Math.sin(latitude), p);
  }
  return { lat: (latitude * 180) / Math.PI, lon: (Math.atan2(y2, x2) * 180) / Math.PI };
}

// About 2 m between samples (4× finer than before), enough for banks, ditches and the hollow way
const columns = 321;
const rows = 142;
const elevations = [];
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < columns; col++) {
    const [east, north] = titheToGrid((col * MAP.width) / (columns - 1), (row * MAP.height) / (rows - 1));
    elevations.push(Number(elevation(east, north).toFixed(3)));
  }
}

// The Wycombe Railway (1862) embankment crosses the eastern corner. Its crest was traced in the LIDAR; the
// historical terrain removes it between its feet.
const railway = [
  [476689.71, 205968.62],
  [477396.77, 205515.11]
].map(([east, north]) => mapPoint(...gridToTithe(east, north)));
const metresPerTithePixel = Math.hypot(...titheToGrid(1, 0).map((value, axis) => value - titheToGrid(0, 0)[axis]));
const modelPerGroundMetre = MAP.scale / metresPerTithePixel;

// Heights the Ordnance Survey surveyors marked, for checking (feet above mean sea level; benchmarks are cut into walls)
const osHeights = [
  { name: 'B.M. 270·5, Lower Farm farmhouse', os: [1591.7, 685.6], feet: 270.5 },
  { name: 'B.M. 258·3, western road', os: [662, 1273], feet: 258.3 },
  { name: 'Spot height 244, south-west road', os: [434, 1471], feet: 244 },
  { name: 'Spot height 259, north-east road', os: [1895, 501], feet: 259 }
].map(({ name, os, feet }) => {
  const east = OS_TO_GRID[0][0] * os[0] + OS_TO_GRID[0][1] * os[1] + OS_TO_GRID[0][2];
  const north = OS_TO_GRID[1][0] * os[0] + OS_TO_GRID[1][1] * os[1] + OS_TO_GRID[1][2];
  const lidar = elevation(east, north);
  const metres = feet * 0.3048;
  return {
    name,
    gridReference: [Number(east.toFixed(1)), Number(north.toFixed(1))],
    surveyedMetres: Number(metres.toFixed(2)),
    lidarMetres: Number(lidar.toFixed(2)),
    differenceMetres: Number((lidar - metres).toFixed(2))
  };
});

// GPS landmarks for the AR overlay, placed by the same registration
const landmarks = [
  { name: "St Peter's", x: 957, y: 507 },
  { name: 'Old Vicarage', x: 1045, y: 536 },
  { name: 'Middle Farm / September Cottage', x: 1150, y: 620 },
  { name: 'Lower Farmhouse', x: 1542, y: 636 },
  { name: 'A1 range / Harvest Barn', x: 804, y: 522 },
  { name: 'Northern cottages / The Green', x: 998, y: 281 }
].map(({ name, x, y }) => {
  const [east, north] = titheToGrid(x, y);
  const { lat, lon } = gridToWgs84(east, north);
  return {
    name,
    x,
    y,
    lon: Number(lon.toFixed(7)),
    lat: Number(lat.toFixed(7)),
    elevation: Number(elevation(east, north).toFixed(3))
  };
});

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
  embankment: {
    name: 'Wycombe Railway embankment (opened 1862)',
    start: railway[0].map((value) => Number(value.toFixed(2))),
    end: railway[1].map((value) => Number(value.toFixed(2))),
    halfWidth: Number((18 * modelPerGroundMetre).toFixed(2))
  },
  source: {
    name: 'Environment Agency LIDAR Composite DTM 1m',
    url: sourceUrl,
    coverageId,
    request: 'EPSG:27700 E(475500,478500) N(204500,207000), native British National Grid, image/tiff',
    compositeYear: 2022,
    sourceResolutionMetres: 1,
    sampleSpacingMetres: Number((((MAP.width / (columns - 1)) * metresPerTithePixel) as number).toFixed(2)),
    datum: 'Ordnance Datum Newlyn (source product)',
    licence: 'Open Government Licence v3.0',
    attribution:
      'Contains Environment Agency information © Environment Agency copyright and/or database right 2022. All rights reserved.',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    registration:
      "Georeferenced through the Ordnance Survey map: tithe map → OS map by St Peter's Church and Lower Farm's benchmarked farmhouse, OS map → National Grid by the same buildings and a fit to LIDAR field edges.",
    titheToGrid: [0, 1].map((axis) => {
      const origin = titheToGrid(0, 0);
      return [
        titheToGrid(1, 0)[axis] - origin[axis],
        titheToGrid(0, 1)[axis] - origin[axis],
        Number(origin[axis].toFixed(3))
      ];
    }),
    groundMetresPerTithePixel: Number(metresPerTithePixel.toFixed(4)),
    osHeights,
    landmarks
  },
  elevations
};
writeFileSync(new URL('../assets/ilmer-terrain.json', import.meta.url), JSON.stringify(data) + '\n');
console.log(`Built ${columns} × ${rows} terrain samples: ${data.minElevation}–${data.maxElevation} m ODN.`);
console.log(osHeights.map((h) => `${h.name}: OS ${h.surveyedMetres} m, LIDAR ${h.lidarMetres} m`).join('\n'));
