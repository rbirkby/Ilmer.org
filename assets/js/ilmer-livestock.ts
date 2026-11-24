import {
  mapPoint,
  cottageGardens,
  ponds,
  northernPasture,
  westernPasture,
  churchSideGarden,
  lowerPaddock
} from './ilmer-1839-data.ts';

export type Species = 'sheep' | 'chicken' | 'duck';

export interface LivestockField {
  id: string;
  species: Species;
  count: number;
  centre: [number, number];
  outline: number[][];
}

export interface Animal {
  id: string;
  x: number;
  z: number;
  heading: number;
  target: [number, number];
  mode: 'feeding' | 'walking';
  remaining: number;
  phase: number;
  travelled: number;
}

export interface Herd {
  id: string;
  species: Species;
  polygon: [number, number][];
  radius: number;
  random: () => number;
  safe: (x: number, z: number) => boolean;
  centre: [number, number];
  spread: number;
  animals: Animal[];
}

// These groups illustrate husbandry, not a recorded 1839 animal census.
export const livestockFields: LivestockField[] = [
  {
    id: 'western-pasture',
    species: 'sheep',
    count: 16,
    centre: [400, 476],
    outline: westernPasture
  },
  {
    id: 'northern-pasture',
    species: 'sheep',
    count: 18,
    centre: [1350, 200],
    outline: northernPasture
  },
  {
    id: 'church-side-enclosure',
    species: 'chicken',
    count: 12,
    centre: [1051, 730],
    outline: churchSideGarden
  },
  {
    id: 'lower-farm-enclosure',
    species: 'chicken',
    count: 12,
    centre: [1665, 600],
    outline: lowerPaddock
  },
  {
    id: 'cottages-gardens',
    species: 'chicken',
    count: 8,
    centre: [732, 149],
    outline: cottageGardens
  },
  {
    id: 'cross-road-ducks',
    species: 'duck',
    count: 6,
    centre: [730, 277],
    outline: ponds[0]
  }
];

export function withinField(polygon: readonly (readonly number[])[], x: number, z: number, margin = 0) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, az] = polygon[j],
      [bx, bz] = polygon[i];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
    const dx = bx - ax,
      dz = bz - az;
    const lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSquared)) : 0;
    if (Math.hypot(x - ax - t * dx, z - az - t * dz) < margin) return false;
  }
  return inside;
}

/** @param blocked whether an animal of this radius at (x, z) would stand on a road or in a building */
export function createLivestock(
  blocked: (x: number, z: number, radius: number, field: string) => boolean = () => false
): Herd[] {
  return livestockFields.map((field, index) => {
    let seed = 1839 + index * 7919;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    const polygon = field.outline.map(([x, y]) => mapPoint(x, y));
    const centre = mapPoint(...field.centre);
    const radius = field.species === 'sheep' ? 1.5 : 0.85;
    const spread = field.species === 'sheep' ? 11 : 4;
    const safe = (x: number, z: number) => withinField(polygon, x, z, radius) && !blocked(x, z, radius, field.id);
    const animals: Animal[] = [];
    const herd: Herd = { id: field.id, species: field.species, polygon, radius, random, safe, centre, spread, animals };
    for (let i = 0; i < field.count; i++) {
      let position: [number, number] | undefined;
      for (let attempt = 0; attempt < 1000; attempt++) {
        const x = centre[0] + (random() - 0.5) * spread * 2;
        const z = centre[1] + (random() - 0.5) * spread * 2;
        if (safe(x, z) && herd.animals.every((other) => Math.hypot(x - other.x, z - other.z) > radius * 1.8)) {
          position = [x, z];
          break;
        }
      }
      if (!position) throw new Error(`Cannot place livestock safely in ${field.id}`);
      herd.animals.push({
        id: `${field.id}-${i}`,
        x: position[0],
        z: position[1],
        heading: random() * Math.PI * 2,
        target: position,
        mode: 'feeding',
        remaining: random() * 6,
        phase: random() * Math.PI * 2,
        travelled: 0
      });
    }
    return herd;
  });
}

export function advanceLivestock(herds: readonly Herd[], seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 0.25) throw new Error('Invalid livestock animation step');
  for (const herd of herds) {
    for (const animal of herd.animals) {
      animal.remaining -= seconds;
      if (animal.remaining <= 0) {
        if (animal.mode === 'walking') {
          animal.mode = 'feeding';
          animal.remaining = (herd.species === 'sheep' ? 5 : 2) + herd.random() * 5;
        } else {
          for (let attempt = 0; attempt < 40; attempt++) {
            const x = herd.centre[0] + (herd.random() - 0.5) * herd.spread * 2;
            const z = herd.centre[1] + (herd.random() - 0.5) * herd.spread * 2;
            const length = Math.hypot(x - animal.x, z - animal.z);
            const samples = Math.ceil(length / 0.35);
            if (length < 1) continue;
            if (
              Array.from({ length: samples + 1 }, (_, i) => i / samples).every((t) =>
                herd.safe(animal.x + (x - animal.x) * t, animal.z + (z - animal.z) * t)
              )
            ) {
              animal.target = [x, z];
              animal.mode = 'walking';
              break;
            }
          }
          animal.remaining = 3 + herd.random() * 6;
        }
      }
      if (animal.mode === 'walking') {
        const dx = animal.target[0] - animal.x,
          dz = animal.target[1] - animal.z;
        const distance = Math.hypot(dx, dz);
        const desired = Math.atan2(dx, dz);
        const turn = Math.atan2(Math.sin(desired - animal.heading), Math.cos(desired - animal.heading));
        animal.heading += Math.max(-seconds * 2.5, Math.min(seconds * 2.5, turn));
        const step = Math.min(distance, seconds * (herd.species === 'sheep' ? 0.55 : 0.7));
        if (distance < 0.1) animal.remaining = 0;
        else if (Math.abs(turn) < 0.35) {
          const x = animal.x + (dx / distance) * step,
            z = animal.z + (dz / distance) * step;
          if (
            herd.animals.every((other) => other === animal || Math.hypot(x - other.x, z - other.z) > herd.radius * 1.4)
          ) {
            animal.x = x;
            animal.z = z;
            animal.travelled += step;
          } else animal.remaining = 0;
        }
      }
      animal.phase += seconds * (animal.mode === 'walking' ? 8 : herd.species === 'sheep' ? 1.8 : 5);
    }
  }
}
