import assert from 'node:assert/strict';
import { test } from 'node:test';
import { devChildArgs, eleventyRunsVite, unexpectedChildExit, viteEmptiesOutput } from '../scripts/dev-process.ts';

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

test('vite watch does not empty the output directory', () => {
  assert.equal(viteEmptiesOutput(['node', 'vite.js', 'build', '--watch']), false);
  assert.equal(viteEmptiesOutput(['node', 'vite.js', 'build']), true);
});

test('eleventy only bundles during a full build', () => {
  assert.equal(eleventyRunsVite('build'), true);
  assert.equal(eleventyRunsVite(undefined), true);
  assert.equal(eleventyRunsVite('serve'), false);
  assert.equal(eleventyRunsVite('watch'), false);
});

test('dev children are node plus the package JavaScript, so Windows does not need a .cmd shim', () => {
  const commands = devChildArgs('/repo', '/usr/bin/node');
  assert.deepEqual(commands.vite, ['/usr/bin/node', '/repo/node_modules/vite/bin/vite.js', 'build', '--watch']);
  assert.deepEqual(commands.eleventy, [
    '/usr/bin/node',
    '/repo/node_modules/@11ty/eleventy/cmd.cjs',
    '--config=.eleventy.ts',
    '--serve'
  ]);
});
