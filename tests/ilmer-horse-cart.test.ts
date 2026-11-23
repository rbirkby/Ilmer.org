import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STANCE, WALK_PHASES, walkPose } from '../assets/js/ilmer-horse-cart.js';

test('the horse walks a four-beat gait, one foot after another a quarter-stride apart', () => {
  const order = Object.entries(WALK_PHASES).sort(([, a], [, b]) => a - b);
  assert.deepEqual(
    order.map(([leg]) => leg),
    ['lh', 'lf', 'rh', 'rf']
  );
  order.forEach(([, phase], index) => assert.equal(phase, index / 4));
});

test('each hoof stays on the ground, sweeping back, for most of the stride and lifts only while swinging forward', () => {
  assert.ok(STANCE > 0.5 && STANCE < 0.75);
  assert.deepEqual(walkPose(0, 0.3), { swing: 0.3, flex: 0 });
  assert.equal(walkPose(STANCE / 2, 0.3).flex, 0);
  assert.ok(Math.abs(walkPose(STANCE / 2, 0.3).swing) < 1e-12);
  const midSwing = walkPose(STANCE + (1 - STANCE) / 2, 0.3);
  assert.ok(Math.abs(midSwing.flex - 1) < 1e-12);
  assert.ok(Math.abs(midSwing.swing) < 1e-12);
  assert.ok(Math.abs(walkPose(0.9999, 0.3).swing - 0.3) < 1e-3);
  assert.deepEqual(walkPose(1.25, 0.3), walkPose(0.25, 0.3));
  assert.deepEqual(walkPose(-0.75, 0.3), walkPose(0.25, 0.3));
});
