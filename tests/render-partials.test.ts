import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';
import { medianAge } from '../plugins/median-age.ts';
import { yearBarChart } from '../plugins/year-bar-chart.ts';

const includes = new URL('../_includes/', import.meta.url);
const liquid = new Liquid({ root: fileURLToPath(includes), extname: '.liquid' });
liquid.registerFilter('cacheBust', (path) => path);
liquid.registerFilter('sitePath', (path) => path);
liquid.registerFilter('medianAge', medianAge);
liquid.registerFilter('yearBarChart', yearBarChart);

test('register summaries render optional median ages without sample sizes', async () => {
  const data = {
    records: [
      { year: 1900, age: '20' },
      { year: 1901, age: '25' },
      { year: 1902, age: 'no age' }
    ],
    yearKey: 'year',
    label: 'burials',
    ageFields: [{ key: 'age', label: 'Median Age At Death' }]
  };
  const html = await liquid.renderFile('register-summary', data);
  assert.match(html, /Median Age At Death/);
  assert.match(html, /<dd>22\.5 years<\/dd>/);
  assert.doesNotMatch(html, /recorded ages/);
  assert.match(html, /Total burials/);

  const withoutAges = await liquid.renderFile('register-summary', { ...data, ageFields: [] });
  assert.doesNotMatch(withoutAges, /Median|recorded ages/);
  const unknownAges = await liquid.renderFile('register-summary', { ...data, records: [{ year: 1900, age: '' }] });
  assert.doesNotMatch(unknownAges, /Median|recorded ages/);
});

test('marriage summaries render separate bride and groom medians', async () => {
  const html = await liquid.renderFile('register-summary', {
    records: [
      { year: 1900, groom_age: '30', bride_age: '20' },
      { year: 1901, groom_age: 'full age', bride_age: '24' }
    ],
    yearKey: 'year',
    label: 'marriages',
    ageFields: [
      { key: 'groom_age', label: 'Grooms' },
      { key: 'bride_age', label: 'Brides' }
    ]
  });
  assert.match(html, /Grooms<\/dt>\s*<dd>30 years<\/dd>/);
  assert.match(html, /Brides<\/dt>\s*<dd>22 years<\/dd>/);
});

for (const layout of ['404', 'home', 'post', 'timeline', 'will', 'archive', 'parish-hub']) {
  test(`${layout} passes page metadata and asset flags to the isolated head`, async () => {
    const source = readFileSync(new URL(`${layout}.liquid`, includes), 'utf8');
    const headCall = source.match(/\{% render "head"[\s\S]*?%\}/)?.[0];
    assert.ok(headCall);
    for (const overrides of [
      { content: 'An article', lightbox: true, description: 'Page description' },
      { content: 'A photograph #bwphoto', lightbox: false, description: '' }
    ]) {
      const data = {
        layout,
        script: 'round-hand',
        site: { url: 'https://example.com', title: 'Test site' },
        url: '/test/',
        title: 'Test page',
        tags: ['history', 'parish'],
        image: '/images/test.avif',
        ...overrides
      };
      assert.equal(await liquid.parseAndRender(headCall, data), await liquid.renderFile('head', data));
    }
  });

  if (layout === 'home') continue;

  test(`${layout} passes ancestors and page details to isolated breadcrumbs`, async () => {
    const source = readFileSync(new URL(`${layout}.liquid`, includes), 'utf8');
    const breadcrumbCall = source.match(/\{% render "breadcrumb.liquid"[\s\S]*?%\}/)?.[0];
    assert.ok(breadcrumbCall);
    for (const breadcrumbUseDate of [false, true]) {
      const data = {
        ancestorCrumb1: { url: '/parish/', label: 'Parish' },
        ancestorCrumb2: { url: '/parish/minutes/', label: 'Minutes' },
        breadcrumbUseDate,
        page: { date: new Date('1900-06-01') },
        title: 'Test page'
      };
      assert.equal(
        await liquid.parseAndRender(breadcrumbCall, data),
        await liquid.renderFile('breadcrumb.liquid', data)
      );
    }
  });
}
