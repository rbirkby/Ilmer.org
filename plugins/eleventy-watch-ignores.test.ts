import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { retainedGitignorePatterns } from './eleventy-watch-ignores.ts';

test('Eleventy ignores gitignored paths except the bundles and the two stable script URLs', () => {
  const patterns = retainedGitignorePatterns(readFileSync(new URL('../.gitignore', import.meta.url), 'utf8'));
  assert.ok(patterns.includes('_site'));
  assert.ok(patterns.includes('node_modules'));
  assert.ok(patterns.includes('reports'));
  assert.equal(
    patterns.some((pattern) => pattern.replace(/^\//, '').replace(/\/$/, '') === 'assets/dist'),
    false
  );
  assert.equal(patterns.includes('assets/js/ilmer-fields-embed.js'), false);
  assert.equal(patterns.includes('assets/js/colorize-sw.js'), false);
});
