import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compassHeading,
  createGeoReference,
  gpsToMapPixel,
  observeCompassAvailability
} from '../assets/js/ilmer-ar.js';

function orientationTarget(permissionRequired = false, touch = false) {
  return Object.assign(new EventTarget(), {
    DeviceOrientationEvent: permissionRequired ? { requestPermission: () => Promise.resolve('granted') } : {},
    matchMedia: () => ({ matches: touch })
  });
}

function orientationEvent(type: string, values: object) {
  return Object.assign(new Event(type), values);
}

test('AR stays unavailable when an orientation API exists but no compass heading arrives', () => {
  const target = orientationTarget();
  let available = false;
  const stop = observeCompassAvailability(target, () => (available = true));
  target.dispatchEvent(orientationEvent('deviceorientation', { alpha: null, beta: null, gamma: null, absolute: true }));
  target.dispatchEvent(orientationEvent('deviceorientation', { alpha: 30, beta: 0, gamma: 0, absolute: false }));
  assert.equal(available, false);
  stop();
  target.dispatchEvent(orientationEvent('deviceorientationabsolute', { alpha: 30, beta: 0, gamma: 0, absolute: true }));
  assert.equal(available, false);
});

test('a usable absolute heading enables AR once, including a zero-degree heading', () => {
  const target = orientationTarget();
  let available = 0;
  observeCompassAvailability(target, () => available++);
  for (let i = 0; i < 2; i++)
    target.dispatchEvent(
      orientationEvent('deviceorientationabsolute', { alpha: 0, beta: 0, gamma: 0, absolute: true })
    );
  assert.equal(available, 1);
});

test('iOS compass samples are usable but incomplete samples are not', () => {
  assert.equal(compassHeading({ webkitCompassHeading: 90, beta: 0, gamma: 0 }), 270);
  assert.equal(compassHeading({ webkitCompassHeading: 90, beta: null, gamma: 0 }), null);
});

test('permission-gated touch devices offer AR without requesting permission on load', () => {
  const target = orientationTarget(true, true);
  target.DeviceOrientationEvent.requestPermission = () => {
    assert.fail('Compass permission must only be requested by a user gesture');
  };
  let available = false;
  observeCompassAvailability(target, () => (available = true));
  assert.equal(available, true);

  available = false;
  const desktop = orientationTarget(true);
  observeCompassAvailability(desktop, () => (available = true));
  assert.equal(available, false);
});

const landmarks = [
  { x: 0, y: 0, lon: -0.001, lat: 0.001 },
  { x: 1000, y: 0, lon: 0.009, lat: 0.001 },
  { x: 0, y: 1000, lon: -0.001, lat: -0.009 },
  { x: 1000, y: 1000, lon: 0.009, lat: -0.009 }
];

test('GPS reference maps approximate landmarks back to their tithe-map pixel coordinates', () => {
  const reference = createGeoReference(landmarks);
  const position = gpsToMapPixel(reference, -0.0015, 0.004);
  assert.ok(Math.abs(position.x - 500) < 1e-7);
  assert.ok(Math.abs(position.y - 250) < 1e-7);
});

test('GPS reference rejects invalid or degenerate landmark data', () => {
  assert.throws(() => createGeoReference([]), /Invalid GPS map landmarks/);
  assert.throws(() => createGeoReference([{ x: 1, y: 1, lon: 200, lat: 0 }]), /Invalid GPS map landmarks/);
  assert.throws(
    () =>
      createGeoReference([
        { x: 1, y: 1, lon: 0, lat: 0 },
        { x: 1, y: 1, lon: 1, lat: 1 },
        { x: 1, y: 1, lon: 2, lat: 2 }
      ]),
    /GPS map landmarks are degenerate/
  );
  assert.throws(() => gpsToMapPixel(createGeoReference(landmarks), 91, 0), /Invalid GPS position/);
});
