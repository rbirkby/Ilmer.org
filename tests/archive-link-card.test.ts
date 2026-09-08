import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';

const liquid = new Liquid({ root: fileURLToPath(new URL('../_includes/', import.meta.url)) });
const archiveCollection = [{ date: new Date('1894-06-01') }, { date: new Date('1935-06-01') }];

for (const [icon, path] of Object.entries({
  building: 'M6 21V10l6-5 6 5v11',
  users: 'M3.5 19v-1.5A3.5 3.5 0 0 1 7 14h3a3.5 3.5 0 0 1 3.5 3.5V19M13.5 14.3A3 3 0 0 1 19 16.5V19',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21.5z',
  church: 'M12 3v3M12 6 4 11v10h16V11z',
  document: 'M6 3.5h9.5L19 7v13.5H6z',
  user: 'M5 20v-1.5A5.5 5.5 0 0 1 10.5 13h3A5.5 5.5 0 0 1 19 18.5V20'
})) {
  test(`archive cards render the named ${icon} icon`, async () => {
    const html = await liquid.renderFile('archive-link-card.liquid', { icon, archiveCollection });
    const headingIcon = html.match(/<span class="archive-link-card__icon">([\s\S]*?)<\/span>/)?.[1];
    assert.ok(headingIcon);
    assert.ok(headingIcon.includes(`<path d="${path}">`));
    assert.match(headingIcon, /viewBox="0 0 24 24"/);
    assert.match(headingIcon, /stroke="currentColor"/);
    assert.match(headingIcon, /stroke-linecap="round"/);
    assert.match(headingIcon, /aria-hidden="true"/);
    assert.doesNotMatch(headingIcon, /class="archive-icon"/);
  });
}

test('archive card dates use the calendar include with their existing styling', async () => {
  const html = await liquid.renderFile('archive-link-card.liquid', { archiveCollection });
  const calendar = html.match(/<svg\s+class="archive-icon"[\s\S]*?<\/svg>/)?.[0];
  assert.ok(calendar);
  assert.match(calendar, /d="M3.5 9.5h17M8 3v4M16 3v4"/);
  assert.match(calendar, /aria-hidden="true"/);
  assert.doesNotMatch(calendar, /stroke-linecap|stroke-linejoin/);
});

test('archive cards derive their date range from the collection', async () => {
  const html = await liquid.renderFile('archive-link-card.liquid', { archiveCollection });
  assert.match(html, /1894&ndash;1935/);
  const singleEntry = await liquid.renderFile('archive-link-card.liquid', {
    archiveCollection: archiveCollection.slice(0, 1)
  });
  assert.match(singleEntry, /1894&ndash;1894/);
});

test('archive cards omit dates for empty or missing collections', async () => {
  for (const data of [{ archiveCollection: [] }, {}]) {
    const html = await liquid.renderFile('archive-link-card.liquid', data);
    assert.doesNotMatch(html, /archive-link-card__dates/);
  }
});

test('consecutive archive cards keep collection and explicit ranges separate', async () => {
  const html = await liquid.parseAndRender(
    `{% render "archive-link-card.liquid", archiveCollection: entries %}
     {% render "archive-link-card.liquid", archiveCollection: emptyEntries %}
     {% render "archive-link-card.liquid", dateRange: "1736&ndash;1868" %}
     {% render "archive-link-card.liquid", dateRange: "1894&ndash;1935" %}
     {% render "archive-link-card.liquid" %}`,
    { entries: archiveCollection, emptyEntries: [] }
  );
  const cards = html.split('<article').slice(1);
  assert.equal(cards.length, 5);
  assert.match(cards[0], /1894&ndash;1935/);
  assert.doesNotMatch(cards[1], /archive-link-card__dates/);
  assert.match(cards[2], /1736&ndash;1868/);
  assert.match(cards[3], /1894&ndash;1935/);
  assert.doesNotMatch(cards[4], /archive-link-card__dates/);
});
