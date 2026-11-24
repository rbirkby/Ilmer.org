import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapPoint, roadPolygons } from '../assets/js/ilmer-1839-data.ts';
import { withinField } from '../assets/js/ilmer-livestock.ts';
import { ridePoint, rideLength } from '../assets/js/ilmer-ride.ts';
import { SIGNPOSTS, signpostPlacement } from '../assets/js/ilmer-signpost.ts';

const roads = roadPolygons.map((polygon) => polygon.map(([x, y]) => mapPoint(x, y)));
const onRoad = (x: number, z: number) => roads.some((polygon) => withinField(polygon, x, z, 0.3));

test('fingerposts point east to Longwick past Lower Farm and west to Towersey', () => {
  assert.deepEqual(
    SIGNPOSTS.map(({ end, text }) => [end, text]),
    [
      ['east', 'LONGWICK'],
      ['west', 'TOWERSEY']
    ]
  );
  const east = signpostPlacement(ridePoint(rideLength - 3), ridePoint(rideLength - 9), onRoad);
  const west = signpostPlacement(ridePoint(3), ridePoint(9), onRoad);
  // Arms point out of the village along the road
  assert.ok(Math.cos(east.heading) > 0.9, 'Longwick arm points east');
  assert.ok(Math.cos(west.heading) < -0.9, 'Towersey arm points west');
  // Each post stands on the verge, clear of the road but close beside it
  for (const [post, end] of [
    [east, ridePoint(rideLength - 3)],
    [west, ridePoint(3)]
  ] as const) {
    assert.equal(onRoad(post.x, post.z), false);
    assert.ok(Math.hypot(post.x - end[0], post.z - end[1]) < 8);
  }
  // The eastern post is the one nearer Lower Farm
  const [lowerX] = mapPoint(1542, 636);
  assert.ok(Math.abs(east.x - lowerX) < Math.abs(west.x - lowerX));
});

test('a road end with no direction is rejected', () => {
  assert.throws(() => signpostPlacement([0, 0], [0, 0], () => false), /Invalid signpost/);
});
