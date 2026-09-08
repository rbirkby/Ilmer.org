import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { Liquid } from 'liquidjs';

const root = new URL('../', import.meta.url);

test('small article images halve their frame width without constraining height', () => {
  const styles = readFileSync(new URL('assets/css/style.css', root), 'utf8');
  for (const direction of ['left', 'right']) {
    const rule = styles.match(new RegExp(`& p\\.image-frame--${direction} \\{([^}]+)\\}`))?.[1];
    assert.ok(rule);
    assert.match(rule, /--image-frame-width: 40%;/);
    assert.doesNotMatch(rule, /(?:max-)?height:/);
  }
  assert.match(styles, /& p\.image-frame--small \{\s*max-width: calc\(var\(--image-frame-width\) \/ 3\);/);
});

test('archive stylesheet loading is determined by layout without a page flag', async () => {
  const liquid = new Liquid();
  liquid.registerFilter('cacheBust', (path) => path);
  const head = readFileSync(new URL('_includes/head.liquid', root), 'utf8');
  for (const layout of ['post', 'archive', 'parish-hub', 'home', 'will', 'timeline', '404']) {
    const html = await liquid.parseAndRender(head, { layout, site: {}, tags: [] });
    assert.equal(
      html.includes('/assets/css/archive.css'),
      ['post', 'archive', 'parish-hub', '404'].includes(layout),
      layout
    );
  }
});

test('posts always have archive styling and retain the census modifier', async () => {
  const liquid = new Liquid();
  const post = readFileSync(new URL('_includes/post.liquid', root), 'utf8');
  const main = post.match(/<main\b[^>]*>/)?.[0];
  assert.ok(main);
  assert.equal(await liquid.parseAndRender(main, { tags: [] }), '<main class="archive">');
  assert.equal(await liquid.parseAndRender(main, { tags: ['census'] }), '<main class="archive census">');
  assert.ok(post.includes('<h1 class="minute-heading">{{ title }}</h1>'));
});

function authoredFiles(directory: string = ''): string[] {
  return readdirSync(new URL(directory || '.', root), { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') || ['node_modules', '_site'].includes(entry.name)) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? authoredFiles(`${path}/`) : [path];
  });
}

test('Markdown and layouts keep stylesheet rules in CSS files', () => {
  const files = authoredFiles().filter((file) => /\.(md|liquid)$/.test(file));
  assert.ok(files.length > 0);
  for (const file of files) {
    assert.doesNotMatch(readFileSync(new URL(file, root), 'utf8'), /<style(?:\s|>)/i, file);
  }
});

test('content and directory data do not opt into archive CSS', () => {
  for (const file of authoredFiles().filter((path) => /\.(md|liquid|json)$/.test(path))) {
    assert.doesNotMatch(readFileSync(new URL(file, root), 'utf8'), /\buseArchiveCss\b/, file);
  }
});

test('local stylesheet links are cache-busted and owned by the head template', () => {
  const files = authoredFiles('_includes/').filter((file) => file.endsWith('.liquid'));
  for (const file of files) {
    const source = readFileSync(new URL(file, root), 'utf8');
    if (file !== '_includes/head.liquid') {
      assert.doesNotMatch(source, /<link\b[^>]*\brel=["']stylesheet["']/i, file);
    }
  }
  const head = readFileSync(new URL('_includes/head.liquid', root), 'utf8');
  for (const file of ['style', 'archive', 'home', 'will', 'timeline']) {
    assert.ok(head.includes(`'/assets/css/${file}.css' | cacheBust`), file);
  }
});

test('CSS is static and the archive theme inherits the shared palette', () => {
  const files = authoredFiles('assets/css/').filter((file) => file.endsWith('.css'));
  const sources = files.map((file) => readFileSync(new URL(file, root), 'utf8'));
  for (const source of sources) {
    assert.doesNotMatch(source, /\{%|\{\{/);
  }
  for (const token of ['cream', 'card', 'border', 'ink', 'green', 'green-dark', 'highlight', 'muted']) {
    const declaration = new RegExp(`--archive-${token}:`, 'g');
    assert.equal(readFileSync(new URL('assets/css/style.css', root), 'utf8').match(declaration)?.length, 1, token);
    assert.doesNotMatch(readFileSync(new URL('assets/css/archive.css', root), 'utf8'), declaration);
  }
});
