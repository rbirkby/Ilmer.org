import { lanes, mapPoint } from './ilmer-1839-data.js';

// Keep the journey exactly on the two connected road polylines, not a smoothed curve across fields.
export const ridePath = [...lanes[0], ...lanes[3].slice(1)].map(([x, y]) => mapPoint(x, y));
const distances = [0];
for (let i = 1; i < ridePath.length; i++) {
  distances.push(
    distances[i - 1] + Math.hypot(ridePath[i][0] - ridePath[i - 1][0], ridePath[i][1] - ridePath[i - 1][1])
  );
}
export const rideLength = distances[distances.length - 1];
export const rideStart = 8;
export const rideEnd = rideLength - 8;
export const rideSpeed = 6;
const turnRadius = 1.3;
const straightLength = rideEnd - rideStart;
const turnLength = Math.PI * turnRadius;
export const rideCircuitLength = 2 * (straightLength + turnLength);

export function ridePoint(distance) {
  if (!Number.isFinite(distance)) throw new Error('Invalid cart journey distance');
  const clamped = Math.max(0, Math.min(rideLength, distance));
  const index = distances.findIndex((end, i) => i > 0 && end >= clamped);
  const t = (clamped - distances[index - 1]) / (distances[index] - distances[index - 1]);
  return ridePath[index - 1].map((value, axis) => value + (ridePath[index][axis] - value) * t);
}

export function rideCircuitPoint(distance) {
  if (!Number.isFinite(distance)) throw new Error('Invalid cart journey distance');
  const phase = ((distance % rideCircuitLength) + rideCircuitLength) % rideCircuitLength;
  const returning = phase >= straightLength + turnLength;
  const turning = (phase >= straightLength && !returning) || phase >= 2 * straightLength + turnLength;
  const centreDistance = turning
    ? returning
      ? rideStart
      : rideEnd
    : returning
      ? rideEnd - (phase - straightLength - turnLength)
      : rideStart + phase;
  const [x, z] = ridePoint(centreDistance);
  const [ax, az] = ridePoint(centreDistance - 0.1);
  const [bx, bz] = ridePoint(centreDistance + 0.1);
  const length = Math.hypot(bx - ax, bz - az);
  const ux = (bx - ax) / length;
  const uz = (bz - az) / length;
  if (!turning) {
    const side = returning ? 1 : -1;
    const approach = Math.max(0, 1 - Math.min(centreDistance - rideStart, rideEnd - centreDistance) / 12);
    const offset = 0.6 + (turnRadius - 0.6) * approach * approach * (3 - 2 * approach);
    return [x - uz * side * offset, z + ux * side * offset];
  }
  const theta = (phase - (returning ? 2 * straightLength + turnLength : straightLength)) / turnRadius;
  const sign = returning ? -1 : 1;
  return [
    x + sign * turnRadius * (ux * Math.sin(theta) + uz * Math.cos(theta)),
    z + sign * turnRadius * (uz * Math.sin(theta) - ux * Math.cos(theta))
  ];
}
