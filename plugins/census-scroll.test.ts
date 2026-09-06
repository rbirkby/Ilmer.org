import assert from 'node:assert/strict';
import { test } from 'node:test';
import { censusScroll } from './census-scroll.ts';

test('wraps all tables on census pages without altering their contents', () => {
  const tables = ['<table><tr><td>1841</td></tr></table>', '<table><tr><td>1851</td></tr></table>'];
  const html = censusScroll(tables.join('<p>Between tables</p>'), ['census']);
  for (const table of tables) assert.ok(html.includes(table));
  assert.ok(html.includes('<p>Between tables</p>'));
  assert.equal((html.match(/class="census-scroll"/g) || []).length, 2);
  assert.match(html, /aria-describedby="census-scroll-hint-0"/);
  assert.match(html, /id="census-scroll-hint-0"/);
  assert.match(html, /aria-describedby="census-scroll-hint-1"/);
  assert.match(html, /id="census-scroll-hint-1"/);
});

test('only wraps explicitly marked tables on other pages', () => {
  const ordinary = '<table><tr><td>Ordinary</td></tr></table>';
  const marked = "<table class='records census-table'><tr><td>Census</td></tr></table>";
  const similar = '<table class="not-census-table"><tr><td>Other</td></tr></table>';
  assert.equal(censusScroll(ordinary + similar), ordinary + similar);
  const html = censusScroll(ordinary + marked + similar, ['history']);
  assert.ok(html.startsWith(ordinary));
  assert.ok(html.endsWith(similar));
  assert.ok(html.includes(marked));
  assert.equal((html.match(/class="census-scroll"/g) || []).length, 1);
});
