import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLivestock, advanceLivestock, withinField } from '../assets/js/ilmer-livestock.js';

test('body clearance and concave field boundaries are respected', () => {
  const polygon = [
    [0, 0],
    [10, 0],
    [10, 4],
    [4, 4],
    [4, 10],
    [0, 10]
  ];
  assert.ok(withinField(polygon, 2, 8, 1));
  assert.equal(withinField(polygon, 5, 5), false);
  assert.equal(withinField(polygon, 0.5, 2, 1), false);
  assert.equal(withinField(polygon, 3.8, 4.1, 0.5), false);
});

test('flocks wander, feed and stay within their assigned field throughout a long simulation', () => {
  const herds = createLivestock();
  const observed = new Set();
  const starting = new Map(herds.flatMap((herd) => herd.animals.map((animal) => [animal.id, [animal.x, animal.z]])));
  for (let frame = 0; frame < 6000; frame++) {
    advanceLivestock(herds, 0.1);
    for (const herd of herds) {
      for (const animal of herd.animals) {
        assert.ok(withinField(herd.polygon, animal.x, animal.z, herd.radius), animal.id);
        observed.add(`${herd.species}-${animal.mode}`);
      }
    }
  }
  assert.equal(herds.filter((herd) => herd.species === 'sheep').length, 2);
  assert.equal(herds.filter((herd) => herd.species === 'chicken').length, 3);
  assert.equal(herds.filter((herd) => herd.species === 'duck').length, 1);
  for (const herd of herds) {
    for (const animal of herd.animals) {
      assert.ok(animal.travelled > 10, animal.id);
      assert.notDeepEqual([animal.x, animal.z], starting.get(animal.id));
    }
  }
  assert.deepEqual([...observed].sort(), [
    'chicken-feeding',
    'chicken-walking',
    'duck-feeding',
    'duck-walking',
    'sheep-feeding',
    'sheep-walking'
  ]);
  assert.throws(() => advanceLivestock(herds, NaN), /Invalid livestock/);
  assert.throws(() => advanceLivestock(herds, 1), /Invalid livestock/);
});

test('animal paths avoid obstacles between endpoints, not just at their destinations', () => {
  // A thin barrier through each flock's home range must never be crossed.
  const initial = createLivestock();
  const barriers = new Map(initial.map((herd) => [herd.id, herd.centre[0]]));
  const blocked = (x: number, _z: number, radius: number, field: string) =>
    Math.abs(x - barriers.get(field)!) < radius + 0.2;
  const herds = createLivestock(blocked);
  const sides = new Map(
    herds.flatMap((herd) => herd.animals.map((animal) => [animal.id, Math.sign(animal.x - barriers.get(herd.id)!)]))
  );
  for (let frame = 0; frame < 2000; frame++) {
    advanceLivestock(herds, 0.1);
    for (const herd of herds) {
      for (const animal of herd.animals) {
        assert.equal(blocked(animal.x, animal.z, herd.radius, herd.id), false);
        assert.equal(Math.sign(animal.x - barriers.get(herd.id)!), sides.get(animal.id));
      }
    }
  }
});
