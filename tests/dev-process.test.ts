import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unexpectedChildExit } from '../scripts/dev-process.ts';

test('an unexpected signal stops the sibling with a failure code', () => {
  assert.equal(unexpectedChildExit(false, null, 'SIGKILL'), 1);
  assert.equal(unexpectedChildExit(false, null, 'SIGTERM'), 1);
});

test('a child exit code is forwarded, and a missing code is a failure', () => {
  assert.equal(unexpectedChildExit(false, 0, null), 0);
  assert.equal(unexpectedChildExit(false, 2, null), 2);
  assert.equal(unexpectedChildExit(false, null, null), 1);
});

test('an intentional shutdown ignores the child signal it just sent', () => {
  assert.equal(unexpectedChildExit(true, null, 'SIGTERM'), null);
  assert.equal(unexpectedChildExit(true, 0, null), null);
});
