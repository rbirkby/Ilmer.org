import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createCacheBustFilter } from './cache-bust.js';

async function withAssetRoot(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cache-bust-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, 'assets/css'), { recursive: true });
  return dir;
}

function expectedHash(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 8);
}

test('appends a content hash as the v query parameter', async (t) => {
  const dir = await withAssetRoot(t);
  const css = 'body{color:red}';
  await writeFile(path.join(dir, 'assets/css/style.css'), css);
  const filter = createCacheBustFilter(dir);
  assert.equal(filter('/assets/css/style.css'), `/assets/css/style.css?v=${expectedHash(css)}`);
});

test('changes the hash when file contents change', async (t) => {
  const dir = await withAssetRoot(t);
  const file = path.join(dir, 'assets/css/style.css');
  await writeFile(file, 'body{color:red}');
  const filter = createCacheBustFilter(dir);
  const first = filter('/assets/css/style.css');
  filter.clearCache();
  await writeFile(file, 'body{color:blue}');
  const second = filter('/assets/css/style.css');
  assert.notEqual(first, second);
  assert.match(second, /\?v=[0-9a-f]{8}$/);
});

test('clears the per-build cache so the next read sees new bytes', async (t) => {
  const dir = await withAssetRoot(t);
  const file = path.join(dir, 'assets/css/style.css');
  await writeFile(file, 'a');
  const filter = createCacheBustFilter(dir);
  const first = filter('/assets/css/style.css');
  await writeFile(file, 'b');
  assert.equal(filter('/assets/css/style.css'), first);
  filter.clearCache();
  assert.notEqual(filter('/assets/css/style.css'), first);
});

test('leaves empty values, http(s) URLs, and data URIs unchanged', async (t) => {
  const filter = createCacheBustFilter(await withAssetRoot(t));
  assert.equal(filter(null), null);
  assert.equal(filter(''), '');
  assert.equal(
    filter('https://fonts.googleapis.com/css2?family=Libre'),
    'https://fonts.googleapis.com/css2?family=Libre'
  );
  assert.equal(filter('//cdn.example.com/app.css'), '//cdn.example.com/app.css');
  assert.equal(filter('data:text/css,body{}'), 'data:text/css,body{}');
});

test('replaces an existing v parameter and keeps other query params and fragments', async (t) => {
  const dir = await withAssetRoot(t);
  const css = '.x{}';
  await writeFile(path.join(dir, 'assets/css/style.css'), css);
  const filter = createCacheBustFilter(dir);
  const hash = expectedHash(css);
  assert.equal(filter('/assets/css/style.css?v=old&x=1#top'), `/assets/css/style.css?v=${hash}&x=1#top`);
});

test('throws a useful error when the file is missing', async (t) => {
  const dir = await withAssetRoot(t);
  const filter = createCacheBustFilter(dir);
  assert.throws(() => filter('/assets/css/missing.css'), /cacheBust: no file at .*missing\.css/);
});
