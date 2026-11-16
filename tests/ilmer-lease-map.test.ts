import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LEASE_FARMS,
  arpToAcres,
  northUpRotation,
  planToMetres,
  polygonArea
} from '../assets/js/ilmer-lease-fields-data.js';

const farm = (id: string) => {
  const f = LEASE_FARMS.find((x) => x.id === id);
  assert.ok(f, id);
  return f;
};

test('schedule areas add up to the totals written on the leases, short by the noted perches', () => {
  // both schedules are a few perches short of their written totals: see totalNote
  for (const [id, shortPerches] of [
    ['lower', 20],
    ['coldharbour', 2]
  ] as const) {
    const f = farm(id);
    assert.ok(f.total && f.totalNote);
    const perches = f.fields.reduce((s, x) => s + (x.area ? arpToAcres(x.area) * 160 : 0), 0);
    assert.equal(Math.round(arpToAcres(f.total) * 160 - perches), shortPerches, f.name);
  }
});

test('field numbers are unique across the three plans', () => {
  const numbers = LEASE_FARMS.flatMap((f) => f.fields.map((x) => x.no)).filter(Boolean);
  assert.equal(new Set(numbers).size, numbers.length);
});

test('every drawn field is a polygon', () => {
  for (const f of LEASE_FARMS)
    for (const x of f.fields) if (x.points.length) assert.ok(x.points.length >= 3 && polygonArea(x.points) > 0, x.no);
});

test('north arrows are turned to point up', () => {
  for (const f of LEASE_FARMS) {
    const t = northUpRotation(f);
    const [x, y] = f.compass;
    const len = Math.hypot(x, y);
    assert.ok(Math.abs((x * Math.cos(t) - y * Math.sin(t)) / len) < 1e-9);
    assert.ok(Math.abs((x * Math.sin(t) + y * Math.cos(t)) / len + 1) < 1e-9);
  }
});

test('scaled field areas stay close to the schedule overall', () => {
  for (const id of ['lower', 'coldharbour']) {
    const f = farm(id);
    const drawn = f.fields.filter((x) => x.points.length && x.area);
    const traced = drawn.reduce((s, x) => s + polygonArea(x.points.map((p) => planToMetres(f, p))), 0) / 4046.8564224;
    const scheduled = drawn.reduce((s, x) => s + arpToAcres(x.area!), 0);
    assert.ok(Math.abs(traced - scheduled) / scheduled < 0.01, `${f.name}: ${traced} vs ${scheduled}`);
  }
});

type Pt = readonly [number, number];
const side = (p: Pt, q: Pt, r: Pt) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
const edgesCross = (a: Pt, b: Pt, c: Pt, d: Pt) =>
  side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
const contains = (poly: Pt[], [x, y]: Pt) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const overlaps = (p: Pt[], q: Pt[]) =>
  p.some((a, i) => q.some((c, j) => edgesCross(a, p[(i + 1) % p.length], c, q[(j + 1) % q.length]))) ||
  contains(q, p[0]) ||
  contains(p, q[0]);

test('fields of different farms do not overlap once placed on the map', () => {
  const placed = LEASE_FARMS.flatMap((f) =>
    f.fields
      .filter((x) => x.points.length)
      .map((x) => ({ id: `${f.id} ${x.no}`, farm: f.id, pts: x.points.map((p) => planToMetres(f, p)) }))
  );
  for (const a of placed)
    for (const b of placed) if (a.farm < b.farm) assert.ok(!overlaps(a.pts, b.pts), `${a.id} overlaps ${b.id}`);
});
