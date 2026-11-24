import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const jsDir = new URL('../assets/js/', import.meta.url);

test('browser modules import npm packages rather than CDN URLs', () => {
  const sources = readdirSync(jsDir, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.ts'));
  assert.ok(sources.length > 0);
  for (const file of sources) {
    const source = readFileSync(new URL(file, jsDir), 'utf8');
    assert.doesNotMatch(source, /\bfrom\s+['"]https?:\/\//, file);
    assert.doesNotMatch(source, /\bimport\s*\(\s*['"]https?:\/\//, file);
    assert.doesNotMatch(source, /unpkg\.com|skypack\.dev/, file);
  }
});
