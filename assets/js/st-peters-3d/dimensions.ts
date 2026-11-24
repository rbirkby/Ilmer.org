// Architectural dimensions of St Peter's Church, Ilmer (Buckinghamshire)
// Coordinate system: 1 unit = 1 meter
// +X = East (Altar / Chancel), -X = West (Tower / Spire)
// +Z = South (Sower window / 3 buttresses), -Z = North (North Porch)
// +Y = Up (0 = exterior ground at the church = measured terrain at CHURCH_PLAN centre)

import churchTerrain from './church-terrain-data.ts';

export const DIM = {
  // Floor elevations
  groundY: 0.0,
  porchFloorY: 0.06,
  naveFloorY: 0.1,
  chancelFloorY: 0.26,
  sanctuaryStep1Y: 0.4,
  sanctuaryStep2Y: 0.54,

  // Nave + West Tower Bay (one continuous masonry shell)
  nave: {
    xWestExt: -7.7,
    xWestInt: -7.0,
    xEastInt: 3.2, // Face of chancel arch / rood screen
    xEastExt: 3.55, // East face of nave gable above chancel
    wallT: 0.7,
    zNorthInt: -2.6,
    zSouthInt: 2.6,
    zNorthExt: -3.3,
    zSouthExt: 3.3,
    eavesY: 3.15,
    ridgeY: 7.05,
    overhang: 0.18
  },

  // Chancel (narrower, lower eaves and lower ridge)
  chancel: {
    xWestInt: 3.2,
    xEastInt: 9.0,
    xEastExt: 9.7,
    wallT: 0.65,
    zNorthInt: -2.0,
    zSouthInt: 2.0,
    zNorthExt: -2.65,
    zSouthExt: 2.65,
    eavesY: 2.88,
    ridgeY: 6.02,
    overhang: 0.16
  },

  // North Porch (projects North from west-mid Nave)
  porch: {
    xCenter: -2.35,
    widthExt: 2.9, // x: -3.80 to -0.90
    widthInt: 1.9, // x: -3.30 to -1.40
    wallT: 0.5,
    zSouth: -3.3, // Meets nave north exterior wall
    zNorthExt: -5.45,
    zNorthInt: -4.95,
    eavesY: 2.15,
    ridgeY: 3.92,
    outerArchW: 1.32,
    outerArchSpringY: 1.55,
    outerArchApexY: 2.38,
    innerDoorW: 1.08,
    innerDoorSpringY: 1.52,
    innerDoorApexY: 2.18
  },

  // Timber Bell-Turret (Belfry) & Octagonal Broach Spire over West Bay
  tower: {
    xCenter: -5.3,
    zCenter: 0.0,
    size: 3.18, // Square weatherboarded belfry plan
    baseY: 4.55, // Embedded into nave roof slopes
    eavesY: 8.95, // Top of weatherboarded walls / spire cornice
    skirtOverhang: 0.24,
    skirtTopY: 10.65, // Transition from square flared skirt to octagonal spire
    spireTipY: 18.25, // Top of shingled spire
    finialTopY: 19.35, // Wrought-iron cross/weathervane
    // Interior massive oak substructure
    eastPostX: -3.72,
    westPostX: -6.82,
    vestryPartitionX: -5.18,
    vestryPartitionH: 2.25,
    belfryCeilingY: 4.42
  },

  // Windows (numbered 1-8 per 1974 H.A. Rolls & Partners floorplan)
  windows: {
    // 1: East Window (2-light pointed gothic with quatrefoil, stained glass)
    w1: {
      wall: 'east',
      z: 0.0,
      sillY: 2.1,
      width: 1.32,
      springY: 3.45,
      apexY: 4.35,
      type: 'east-stained'
    },
    // 2: Chancel South East lancet (trefoil single-light, leaded clear)
    w2: {
      wall: 'chancel-south',
      x: 7.35,
      sillY: 1.18,
      width: 0.54,
      springY: 2.12,
      apexY: 2.45,
      type: 'lancet'
    },
    // 3: Chancel South West slim lancet (Richard James Wilson memorial glass with the RAF badge)
    w3: {
      wall: 'chancel-south',
      x: 4.55,
      sillY: 1.2,
      width: 0.28,
      springY: 2.06,
      apexY: 2.27,
      type: 'wilson-stained'
    },
    // 4: Nave South "Sower" Window (2-light pointed gothic, vivid stained glass)
    w4: {
      wall: 'nave-south',
      x: 0.45,
      sillY: 1.24,
      width: 1.38,
      springY: 2.08,
      apexY: 2.68,
      type: 'sower-stained'
    },
    // 5: West Window (single-light pointed lancet, deeply splayed)
    w5: {
      wall: 'west',
      z: 0.0,
      sillY: 1.65,
      width: 0.62,
      springY: 2.75,
      apexY: 3.22,
      type: 'lancet'
    },
    // 6: Nave North Window (2-light square-headed Perpendicular, stained glass)
    w6: {
      wall: 'nave-north',
      x: 1.05,
      sillY: 1.24,
      width: 1.38,
      topY: 2.66,
      type: 'north-square-stained'
    },
    // 7: Chancel North West lancet
    w7: {
      wall: 'chancel-north',
      x: 4.65,
      sillY: 1.56,
      width: 0.3,
      springY: 2.44,
      apexY: 2.66,
      type: 'lancet'
    },
    // 8: Chancel North East lancet
    w8: {
      wall: 'chancel-north',
      x: 7.25,
      sillY: 1.18,
      width: 0.52,
      springY: 2.12,
      apexY: 2.44,
      type: 'lancet'
    }
  }
};

// Returns true in December (month index 11), with optional ?christmas=1|0 or ?month=12 query override for previewing
export function isChristmasSeason(date = new Date(), search = '') {
  if (search) {
    const params = new URLSearchParams(search);
    const flag = params.get('christmas');
    if (flag === '1' || flag === 'true') return true;
    if (flag === '0' || flag === 'false') return false;
    const monthParam = Number(params.get('month'));
    if (monthParam >= 1 && monthParam <= 12) return monthParam === 12;
  }
  return date.getMonth() === 11;
}

/** Same triangle interpolation as ilmer-terrain.js, clamped to the church-local crop. */
function sampleChurchTerrain(x: number, z: number) {
  const data = churchTerrain;
  const col = (x / data.width + 0.5) * (data.columns - 1);
  const row = (z / data.depth + 0.5) * (data.rows - 1);
  const u = Math.max(0, Math.min(data.columns - 1, col));
  const v = Math.max(0, Math.min(data.rows - 1, row));
  const ix = Math.min(Math.floor(u), data.columns - 2);
  const iy = Math.min(Math.floor(v), data.rows - 2);
  const dx = u - ix;
  const dy = v - iy;
  const sample = (i: number, j: number) => data.elevations[j * data.columns + i];
  return dx + dy <= 1
    ? sample(ix, iy) * (1 - dx - dy) + sample(ix + 1, iy) * dx + sample(ix, iy + 1) * dy
    : sample(ix, iy + 1) * (1 - dx) + sample(ix + 1, iy) * (1 - dy) + sample(ix + 1, iy + 1) * (dx + dy - 1);
}

/**
 * Soft pad under the church footprint: masonry and floors stay on y = 0 while the
 * surrounding churchyard and fields follow the measured 1839/LIDAR terrain.
 */
function buildingPadWeight(x: number, z: number) {
  const N = DIM.nave;
  const C = DIM.chancel;
  const P = DIM.porch;
  const pad = 0.85;
  const minX = N.xWestExt - pad;
  const maxX = C.xEastExt + pad;
  const minZ = Math.min(P.zNorthExt, N.zNorthExt) - pad;
  const maxZ = N.zSouthExt + pad;
  const dx = Math.max(0, minX - x, x - maxX);
  const dz = Math.max(0, minZ - z, z - maxZ);
  const dist = Math.hypot(dx, dz);
  if (dist <= 0) return 1;
  const blend = Math.min(1, dist / 2.5);
  return 1 - blend * blend * (3 - 2 * blend);
}

// Measured exterior terrain elevation (relative to the church). Flat under the building pad.
export function getGroundHeight(x: number, z: number) {
  const measured = sampleChurchTerrain(x, z);
  const pad = buildingPadWeight(x, z);
  return measured * (1 - pad);
}

// Minimum walkable/camera floor surface at (x, z): interior church floors or exterior ground
export function getSurfaceY(x: number, z: number) {
  if (x > 7.38 && x < 9.0 && Math.abs(z) < 2.0) return DIM.sanctuaryStep2Y;
  if (x > 6.23 && x < 9.0 && Math.abs(z) < 2.0) return DIM.sanctuaryStep1Y;
  if (x > 3.2 && x < 9.0 && Math.abs(z) < 2.0) return DIM.chancelFloorY;
  if (x > -7.0 && x < 3.25 && Math.abs(z) < 2.65) return DIM.naveFloorY;
  if (Math.abs(x - DIM.porch.xCenter) < 1.1 && z > -5.5 && z < -2.6) return DIM.porchFloorY;
  return getGroundHeight(x, z);
}

// Spatial church acoustics: louder & brighter inside the church, quietly stone-muffled outside
export function computeChurchAcoustics(pos: { x: number; y: number; z: number }, doorsOpen = false) {
  const { x, y, z } = pos;
  const N = DIM.nave;
  const C = DIM.chancel;
  const P = DIM.porch;

  const inNave = x > N.xWestInt && x < N.xEastInt && Math.abs(z) < N.zSouthInt && y < 5.6;
  const inChancel = x >= C.xWestInt && x < C.xEastInt && Math.abs(z) < C.zSouthInt && y < 5.2;
  if (inNave || inChancel) {
    const dOrgan = Math.hypot(x + 4.32, z + 1.72);
    const proximityBoost = Math.max(0, 1 - dOrgan / 15) * 0.07;
    return {
      inside: true,
      gain: 0.32 + proximityBoost,
      cutoffHz: 3400 + proximityBoost * 9000
    };
  }

  const inPorch = Math.abs(x - P.xCenter) < P.widthInt * 0.55 && z > P.zNorthExt && z <= N.zNorthInt && y < 3.4;
  if (inPorch) {
    return {
      inside: false,
      gain: doorsOpen ? 0.22 : 0.135,
      cutoffHz: doorsOpen ? 1950 : 920
    };
  }

  const dx = Math.max(0, N.xWestExt - x, x - C.xEastExt);
  const dz = Math.max(0, N.zNorthExt - z, z - N.zSouthExt);
  const dy = Math.max(0, y - 6.2);
  const dist = Math.hypot(dx, dz, dy);

  const doorBonus = doorsOpen && z < N.zNorthExt && Math.abs(x - P.xCenter) < 6 ? 0.035 : 0;
  const falloff = 1 / (1 + dist * 0.085);
  const gain = 0.048 + 0.068 * falloff + doorBonus * falloff;
  const cutoffHz = 540 + 420 * falloff + (doorBonus > 0 ? 360 * falloff : 0);

  return { inside: false, gain, cutoffHz };
}

export type TourWaypoint = {
  label: string;
  pos: [number, number, number];
  target: [number, number, number];
  duration?: number;
  hold?: number;
  doorsOpen?: boolean | 'approach';
  ringBells?: number;
  cutaway?: boolean;
};

// Choreographed exterior-and-interior guided Church Tour waypoints (opens North Porch doors before entering)
export const CHURCH_TOUR_WAYPOINTS: TourWaypoint[] = [
  {
    label: 'Exterior NW & Broach Spire',
    pos: [-22.5, 4.8, -9.5], // looking in past the west kissing gate, between the churchyard trees
    target: [-1.8, 7.0, 0.0],
    duration: 2.4,
    hold: 0.4,
    doorsOpen: false,
    cutaway: false
  },
  {
    label: 'West Gable & Half-Hip Masonry',
    pos: [-17.2, 4.6, 2.5],
    target: [-2.5, 4.9, 0.0],
    duration: 2.8,
    hold: 0.3,
    doorsOpen: false,
    cutaway: false
  },
  {
    label: 'South Churchyard & Buttresses',
    pos: [-2.5, 4.3, 16.8],
    target: [0.4, 4.3, 0.0],
    duration: 3.0,
    hold: 0.4,
    doorsOpen: false,
    cutaway: false
  },
  {
    label: 'South-East Churchyard',
    pos: [13.8, 4.4, 12.8],
    target: [3.6, 4.4, 0.0],
    duration: 2.8,
    hold: 0.3,
    doorsOpen: false,
    cutaway: false
  },
  {
    label: 'East Gable & Stained Glass',
    pos: [19.5, 4.6, 9.5], // south of the path, clear of the tree between the East gate & the gable
    target: [4.5, 4.6, 0.0],
    duration: 2.8,
    hold: 0.4,
    doorsOpen: false,
    cutaway: false
  },
  {
    label: 'North Chancel & 1860 Dedication Stone',
    pos: [9.2, 3.1, -13.2],
    target: [2.6, 2.6, -2.4],
    duration: 2.8,
    hold: 0.3,
    doorsOpen: false,
    cutaway: false
  },
  {
    label: 'North Porch — Opening Doors',
    pos: [-2.35, 1.72, -8.8],
    target: [-2.35, 1.58, -2.8],
    duration: 2.8,
    hold: 1.5,
    // 'approach': the gates, then the inner door, stay shut until the camera is a few strides away and
    // swing open in view as it glides through the porch
    doorsOpen: 'approach',
    cutaway: false
  },
  {
    label: 'Entering via the North Porch',
    pos: [-2.35, 1.66, -4.1],
    target: [-2.35, 1.6, 0.4],
    duration: 2.2,
    hold: 0.2,
    doorsOpen: 'approach',
    cutaway: false
  },
  {
    label: 'Inside the Nave',
    pos: [-2.25, 1.68, -0.45],
    target: [1.8, 1.82, 0.6],
    duration: 2.2,
    hold: 0.3,
    doorsOpen: true,
    cutaway: false
  },
  {
    label: 'Sower Window & Roll of Honour',
    pos: [-1.1, 1.72, -0.25],
    target: [0.35, 1.86, 2.5],
    duration: 2.4,
    hold: 0.6,
    doorsOpen: true,
    cutaway: false
  },
  {
    label: 'Jaques Window, Donors List & Pulpit',
    pos: [0.15, 1.72, 0.28],
    target: [1.15, 1.86, -2.3],
    duration: 2.5,
    hold: 0.6,
    doorsOpen: true,
    cutaway: false
  },
  {
    label: 'Medieval Rood Screen',
    pos: [1.65, 1.73, 0.0],
    target: [6.4, 1.86, 0.0],
    duration: 2.2,
    hold: 0.5,
    doorsOpen: true,
    cutaway: false
  },
  {
    label: 'Chancel & Altar',
    pos: [4.55, 1.75, -0.04],
    target: [8.85, 1.8, 0.0],
    duration: 2.6,
    hold: 0.8,
    doorsOpen: true,
    cutaway: false
  },
  {
    label: 'Chancel Jamb Carvings & Rood Screen',
    pos: [4.85, 1.75, 0.18],
    target: [-1.8, 1.84, -0.15],
    duration: 2.6,
    hold: 0.6,
    doorsOpen: true,
    cutaway: false
  },
  {
    label: 'Nave Looking West to Font & Organ',
    pos: [1.2, 1.72, -0.05],
    target: [-5.6, 1.88, -0.25],
    duration: 2.6,
    hold: 0.6,
    doorsOpen: true,
    cutaway: false
  },
  {
    label: 'Octagonal Font, Belfry & Vestry',
    pos: [-1.95, 1.7, 0.05],
    target: [-5.8, 1.75, -0.3],
    duration: 2.4,
    hold: 0.6,
    doorsOpen: true,
    cutaway: false
  },
  {
    label: 'Bell Ropes & the Belfry Hatch',
    pos: [-4.45, 1.66, 0.85],
    target: [-5.27, 4.45, -0.2],
    duration: 2.2,
    hold: 0.5,
    doorsOpen: true,
    cutaway: false
  },
  {
    label: 'The Three Bells',
    pos: [-6.45, 7.6, 1.2],
    target: [-4.9, 5.5, -0.5],
    duration: 2.8,
    hold: 1.6,
    // Seconds after this leg begins to set the bells swinging, so they ring two rounds as the camera arrives
    ringBells: 1.8,
    doorsOpen: true,
    cutaway: false
  },
  {
    label: 'Tenor & Second in the Lower Frame',
    pos: [-4.1, 6.3, 1.25],
    target: [-5.6, 5.5, -0.6],
    duration: 2.6,
    hold: 1.8,
    doorsOpen: true,
    cutaway: false
  },
  {
    label: 'Back Down to the Nave',
    pos: [-1.95, 1.7, 0.05],
    target: [-2.35, 1.6, -3.0],
    duration: 2.8,
    hold: 0.2,
    doorsOpen: true,
    cutaway: false
  },
  {
    label: 'Returning Through the North Porch',
    pos: [-2.35, 1.66, -1.6],
    target: [-2.35, 1.62, -7.5],
    duration: 2.2,
    hold: 0.2,
    doorsOpen: true,
    cutaway: false
  },
  {
    label: 'Churchyard Departure',
    pos: [-2.35, 1.78, -9.2],
    target: [-2.0, 3.8, -1.0],
    duration: 2.4,
    hold: 0.2,
    doorsOpen: true,
    cutaway: false
  },
  {
    label: "St Peter's Church, Ilmer",
    pos: [-27.0, 6.5, -12.0], // matches the Exterior NW view, clear of the trees inside the north railings
    target: [-1.0, 8.0, 0.0],
    duration: 3.0,
    hold: 0.0,
    doorsOpen: false,
    cutaway: false
  }
];

/**
 * Edge of the churchyard's surrounding land, in metres from the church centre at bearing θ (atan2(z, x)): a few
 * gentle waves on a ~52 m circle, so the perimeter is irregular but smooth, never beyond the 60 m terrain grid.
 */
export function groundOutlineRadius(theta: number) {
  return 52 + 3.6 * Math.sin(2 * theta + 0.7) + 2.4 * Math.sin(3 * theta + 2.1) + 1.4 * Math.sin(5 * theta + 0.4);
}
