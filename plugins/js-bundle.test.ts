import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bundleImportUrls, bundleUrl, type ViteManifest } from './js-bundle.ts';

const manifest: ViteManifest = {
  'assets/js/ilmer-1839.ts': {
    file: 'ilmer-1839-abc123.js',
    name: 'ilmer-1839',
    isEntry: true,
    imports: ['_three-def456.js']
  },
  '_three-def456.js': {
    file: 'three-def456.js',
    name: 'three',
    imports: []
  },
  'assets/js/then-now.ts': {
    file: 'then-now-aaa.js',
    name: 'then-now',
    isEntry: true
  }
};

test('bundle URLs point at the hashed file for an entry name', () => {
  assert.equal(bundleUrl(manifest, 'ilmer-1839'), '/assets/dist/ilmer-1839-abc123.js');
  assert.equal(bundleUrl(manifest, 'then-now'), '/assets/dist/then-now-aaa.js');
});

test('bundle preloads include shared chunks and not the entry itself', () => {
  assert.deepEqual(bundleImportUrls(manifest, 'ilmer-1839'), ['/assets/dist/three-def456.js']);
  assert.deepEqual(bundleImportUrls(manifest, 'then-now'), []);
});
