import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';
import { yearBarChart } from '../plugins/year-bar-chart.ts';

const liquid = new Liquid({ root: fileURLToPath(new URL('../_includes/', import.meta.url)) });
liquid.registerFilter('yearBarChart', yearBarChart);

for (const kind of ['baptisms', 'marriages', 'burials']) {
  test(`${kind} chart follows the summary and links to its register table`, async () => {
    const source = readFileSync(new URL(`../history/st-peters-${kind}.md`, import.meta.url), 'utf8');
    const chartCall = source.match(
      /\{% render "register-summary\.liquid"[^%]*%\}\s*(\{% render "year-bar-chart\.liquid"[^%]*%\})/
    )?.[1];
    assert.ok(chartCall);
    const records = JSON.parse(readFileSync(new URL(`../_data/st-peters-${kind}.json`, import.meta.url), 'utf8'));
    const chart = yearBarChart(records, kind === 'baptisms' ? 'baptism_date' : 'year');
    assert.ok(chart);
    const html = await liquid.parseAndRender(chartCall, { [`st-peters-${kind}`]: records });
    assert.ok(html.includes(`aria-label="Number of ${kind} per year, ${chart.minYear} to ${chart.maxYear}"`));
    assert.equal((html.match(/class="year-bar-chart__bar"/g) ?? []).length, chart.bars.length);
    assert.match(html, /href="#register"/);
    assert.match(source, /<table id="register" class="census-table">/);
  });
}
