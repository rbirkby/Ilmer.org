const metresPerDegree = 111320;

export function compassHeading(event: any) {
  if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return null;
  if (Number.isFinite(event.webkitCompassHeading)) return (360 - event.webkitCompassHeading) % 360;
  return event.absolute === true && Number.isFinite(event.alpha) ? event.alpha : null;
}

export function observeCompassAvailability(target: any, onAvailable: any) {
  const stop = () => {
    target.removeEventListener('deviceorientation', observe);
    target.removeEventListener('deviceorientationabsolute', observe);
  };
  function observe(event: any) {
    if (compassHeading(event) === null) return;
    stop();
    onAvailable();
  }
  if (!target.DeviceOrientationEvent) return stop;
  // Permission-gated phones cannot emit a heading until the user taps the AR button.
  if (
    typeof target.DeviceOrientationEvent.requestPermission === 'function' &&
    target.matchMedia('(any-pointer: coarse)').matches
  ) {
    onAvailable();
  } else {
    target.addEventListener('deviceorientation', observe);
    target.addEventListener('deviceorientationabsolute', observe);
  }
  return stop;
}

function solve(matrix: any, values: any) {
  const rows = matrix.map((row: any, index: any) => [...row, values[index]]);
  for (let column = 0; column < rows.length; column++) {
    let pivot = column;
    for (let row = column + 1; row < rows.length; row++) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    if (Math.abs(rows[column][column]) < 1e-12) throw new Error('GPS map landmarks are degenerate.');
    const divisor = rows[column][column];
    rows[column] = rows[column].map((value: any) => value / divisor);
    for (let row = 0; row < rows.length; row++) {
      if (row === column) continue;
      const factor = rows[row][column];
      rows[row] = rows[row].map((value: any, index: any) => value - factor * rows[column][index]);
    }
  }
  return rows.map((row: any) => row.at(-1));
}

function fitCoordinate(points: any, values: any) {
  const normal = Array.from({ length: 3 }, () => Array(3).fill(0));
  const right = Array(3).fill(0);
  points.forEach(([x, y]: [any, any], index: any) => {
    const row = [1, x, y];
    for (let i = 0; i < 3; i++) {
      right[i] += row[i] * values[index];
      for (let j = 0; j < 3; j++) normal[i][j] += row[i] * row[j];
    }
  });
  return solve(normal, right);
}

export function createGeoReference(landmarks: any) {
  if (
    !Array.isArray(landmarks) ||
    landmarks.length < 3 ||
    landmarks.some(
      (point) =>
        !point ||
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        !Number.isFinite(point.lon) ||
        !Number.isFinite(point.lat) ||
        Math.abs(point.lat) > 90 ||
        Math.abs(point.lon) > 180
    )
  )
    throw new Error('Invalid GPS map landmarks.');

  const originX = landmarks.reduce((sum, point) => sum + point.x, 0) / landmarks.length;
  const originY = landmarks.reduce((sum, point) => sum + point.y, 0) / landmarks.length;
  const originLatitude = landmarks.reduce((sum, point) => sum + point.lat, 0) / landmarks.length;
  const originLongitude = landmarks.reduce((sum, point) => sum + point.lon, 0) / landmarks.length;
  const longitudeScale = metresPerDegree * Math.cos((originLatitude * Math.PI) / 180);
  const points = landmarks.map(({ x, y }) => [(x - originX) / 1000, (y - originY) / 1000]);
  const eastings = landmarks.map(({ lon }) => (lon - originLongitude) * longitudeScale);
  const northings = landmarks.map(({ lat }) => (lat - originLatitude) * metresPerDegree);
  const east = fitCoordinate(points, eastings);
  const north = fitCoordinate(points, northings);
  const determinant = east[1] * north[2] - east[2] * north[1];
  if (Math.abs(determinant) < 1e-8) throw new Error('GPS map landmarks do not define a usable map orientation.');
  return { originX, originY, originLatitude, originLongitude, longitudeScale, east, north, determinant };
}

export function gpsToMapPixel(reference: any, latitude: any, longitude: any) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
    throw new Error('Invalid GPS position.');
  const east = (longitude - reference.originLongitude) * reference.longitudeScale - reference.east[0];
  const north = (latitude - reference.originLatitude) * metresPerDegree - reference.north[0];
  const x = (east * reference.north[2] - reference.east[2] * north) / reference.determinant;
  const y = (reference.east[1] * north - east * reference.north[1]) / reference.determinant;
  return { x: reference.originX + x * 1000, y: reference.originY + y * 1000 };
}
