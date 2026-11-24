import { buildings, mapPoint, MAP, places } from './ilmer-1839-data.ts';

export function flightStops() {
  const pending = buildings.flatMap((building, group) =>
    building.parts.map(([x, y, length, width, _angle, eaves], part) => {
      const [wx, wz] = mapPoint(x, y);
      const offset = (Math.max(length, width) * MAP.scale) / 2 + 9;
      return {
        id: `building-${group}-${part}`,
        place: building.place,
        title: `${(places as Record<string, { title: string }>)[building.place].title} · building ${part + 1}`,
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
      const distance = (stop: any) => Math.hypot(stop.target[0] - last.target[0], stop.target[2] - last.target[2]);
      if (distance(pending[i]) < distance(pending[nearest])) nearest = i;
    }
    result.push(pending.splice(nearest, 1)[0]);
  }
  return result;
}

/** Cruising speed of the Historic Tour along its route, in metres per second. */
export const FLIGHT_SPEED = 7;
/** Seconds the tour takes to ease up to cruising speed when it starts or resumes. */
export const FLIGHT_RAMP = 2.5;

/**
 * Moves the tour along its route. Like the church tour, it glides continuously through every stop at a steady
 * speed, easing in only when it starts or resumes (the throttle rises from 0 to 1 over `ramp` seconds).
 */
export function advanceFlight(
  { distance, throttle }: any,
  seconds: any,
  { speed = FLIGHT_SPEED, ramp = FLIGHT_RAMP }: any = {}
) {
  if (![distance, throttle, seconds, speed, ramp].every(Number.isFinite) || seconds < 0 || ramp <= 0)
    throw new Error('Invalid flying tour progress');
  const next = Math.min(1, throttle + seconds / ramp);
  return { distance: distance + speed * ((throttle + next) / 2) * seconds, throttle: next };
}

/** Smoothstep weight for gliding from the viewer's own view onto the tour route. */
export function blendIn(elapsed: any, duration: any) {
  const t = Math.max(0, Math.min(1, elapsed / duration));
  return t * t * (3 - 2 * t);
}

/**
 * Turns the height each sample of a looping route must climb (to clear roofs and ground) into a smooth lift that
 * still clears every sample: a running maximum over `radius` samples either side, then two box blurs of half that
 * width, so the camera rises gently before a roof and settles gently after it instead of jumping.
 */
export function smoothClearance(required: any, radius: any) {
  const n = required.length;
  const at = (values: any, i: any) => values[((i % n) + n) % n];
  const widened = required.map((_: any, i: any) => {
    let peak = 0;
    for (let k = -radius; k <= radius; k++) peak = Math.max(peak, at(required, i + k));
    return peak;
  });
  const half = Math.max(1, Math.floor(radius / 2));
  const blur = (values: any) =>
    values.map((_: any, i: any) => {
      let sum = 0;
      for (let k = -half; k <= half; k++) sum += at(values, i + k);
      return sum / (2 * half + 1);
    });
  return blur(blur(widened));
}

/** Index of the stop the tour most recently passed, given each stop's distance along a looping route. */
export function stopAtDistance(stopDistances: any, distance: any, total: any) {
  const along = ((distance % total) + total) % total;
  let index = 0;
  for (let i = 0; i < stopDistances.length; i++) if (stopDistances[i] <= along) index = i;
  return index;
}
