import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COLOURISE_SW_PATH, isStaleColouriseWorker } from '../assets/js/colourise-registration.ts';

test('the colourise service worker stays at its original unhashed URL', () => {
  assert.equal(COLOURISE_SW_PATH, '/assets/js/colorize-sw.js');
  assert.equal(isStaleColouriseWorker('https://www.ilmer.org/assets/js/colorize-sw.js'), false);
});

test('hashed colourise service workers are unregistered', () => {
  assert.equal(isStaleColouriseWorker('https://www.ilmer.org/assets/dist/colorize-sw-abc123.js'), true);
  assert.equal(isStaleColouriseWorker('https://www.ilmer.org/assets/js/timeline.js'), false);
  assert.equal(isStaleColouriseWorker('not a url'), false);
});
