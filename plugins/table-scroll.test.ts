import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tableScroll } from './table-scroll.ts';

test('wraps all tables on census pages without altering their contents', () => {
  const tables = ['<table><tr><td>1841</td></tr></table>', '<table><tr><td>1851</td></tr></table>'];
  const html = tableScroll(tables.join('<p>Between tables</p>'), ['census']);
  for (const table of tables) assert.ok(html.includes(table));
  assert.ok(html.includes('<p>Between tables</p>'));
  assert.equal((html.match(/class="table-scroll"/g) || []).length, 2);
  assert.match(html, /aria-describedby="table-scroll-hint-0"/);
  assert.match(html, /id="table-scroll-hint-0"/);
  assert.match(html, /aria-describedby="table-scroll-hint-1"/);
  assert.match(html, /id="table-scroll-hint-1"/);
});

test('only wraps explicitly marked tables on other pages', () => {
  const ordinary = '<table><tr><td>Ordinary</td></tr></table>';
  const marked = "<table class='records scrollable-table'><tr><td>Census</td></tr></table>";
  const similar = '<table class="not-scrollable-table"><tr><td>Other</td></tr></table>';
  assert.equal(tableScroll(ordinary + similar), ordinary + similar);
  const html = tableScroll(ordinary + marked + similar, ['history']);
  assert.ok(html.startsWith(ordinary));
  assert.ok(html.endsWith(similar));
  assert.ok(html.includes(marked));
  assert.equal((html.match(/class="table-scroll"/g) || []).length, 1);
});

test('wraps all tables on any page when scrollAllTables is set', () => {
  const tables = ['<table><tr><td>Fields</td></tr></table>', '<table><tr><td>War dead</td></tr></table>'];
  const html = tableScroll(tables.join(''), ['history', 'post'], true);
  for (const table of tables) assert.ok(html.includes(table));
  assert.equal((html.match(/class="table-scroll"/g) || []).length, 2);
});
