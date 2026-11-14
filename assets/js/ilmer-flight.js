import { buildings, mapPoint, MAP, places } from './ilmer-1839-data.js';

export function flightStops() {
  const pending = buildings.flatMap((building, group) =>
    building.parts.map(([x, y, length, width, _angle, eaves], part) => {
      const [wx, wz] = mapPoint(x, y);
      const offset = (Math.max(length, width) * MAP.scale) / 2 + 9;
      return {
        id: `building-${group}-${part}`,
        place: building.place,
        title: `${places[building.place].title} · building ${part + 1}`,
        target: [wx, eaves + width * MAP.scale * 0.23, wz],
        position: [wx + offset, eaves + width * MAP.scale * 0.46 + 3, wz + offset * 0.7]
      };
    })
  );
  const [x, z] = mapPoint(957, 507);
  const result = [
    { id: 'church', place: 'church', title: places.church.title, target: [x, 8, z], position: [x + 23, 15, z - 19] }
  ];
  while (pending.length) {
    const last = result[result.length - 1];
    let nearest = 0;
    for (let i = 1; i < pending.length; i++) {
      const distance = (stop) => Math.hypot(stop.target[0] - last.target[0], stop.target[2] - last.target[2]);
      if (distance(pending[i]) < distance(pending[nearest])) nearest = i;
    }
    result.push(pending.splice(nearest, 1)[0]);
  }
  return result;
}

export function flightProgress(elapsed, count) {
  if (!Number.isFinite(elapsed) || elapsed < 0 || !Number.isInteger(count) || count < 1)
    throw new Error('Invalid flying tour progress');
  const segment = Math.floor(elapsed / 6);
  const fraction = Math.min((elapsed % 6) / 4.5, 1);
  const eased = fraction * fraction * (3 - 2 * fraction);
  return { index: segment % count, next: (segment + 1) % count, fraction: eased };
}
