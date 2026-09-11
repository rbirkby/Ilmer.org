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
    const yearKey = kind === 'baptisms' ? 'baptism_date' : 'year';
    const chart = yearBarChart(records, yearKey);
    const byDecade = yearBarChart(records, yearKey, 10);
    assert.ok(chart);
    assert.ok(byDecade);
    const html = await liquid.parseAndRender(chartCall, { [`st-peters-${kind}`]: records });
    assert.ok(html.includes(`aria-label="Number of ${kind} per year, ${chart.minYear} to ${chart.maxYear}"`));
    assert.ok(
      html.includes(`aria-label="Number of ${kind} per decade, ${byDecade.firstBucket}s to ${byDecade.lastBucket}s"`)
    );
    assert.equal((html.match(/class="year-bar-chart__bar"/g) ?? []).length, chart.bars.length + byDecade.bars.length);
    assert.match(html, /href="#register"/);
    assert.match(source, /<table id="register" class="census-table">/);
    // a blank line inside the figure would end the Markdown HTML block early,
    // leaving stray paragraph tags wrapped around the chart
    assert.doesNotMatch(html, /\n[ \t]*\n/);
  });

  test(`${kind} chart is titled by a grouping control that starts on the year-by-year view`, async () => {
    const records = JSON.parse(readFileSync(new URL(`../_data/st-peters-${kind}.json`, import.meta.url), 'utf8'));
    const source = readFileSync(new URL(`../history/st-peters-${kind}.md`, import.meta.url), 'utf8');
    const chartCall = source.match(/\{% render "year-bar-chart\.liquid"[^%]*%\}/)?.[0];
    assert.ok(chartCall);
    const html = await liquid.parseAndRender(chartCall, { [`st-peters-${kind}`]: records });
    const title = kind[0]!.toUpperCase() + kind.slice(1);
    assert.ok(html.includes(`<option value="year" selected>${title} by year</option>`));
    assert.ok(html.includes(`<option value="decade">${title} by decade</option>`));
    // the label names the control for a screen reader and for the picker
    // that mobile browsers open as a bottom sheet
    assert.ok(html.includes(`for="chart-grouping-${kind}">Group ${kind} by</label>`));
    assert.ok(html.includes(`id="chart-grouping-${kind}"`));
  });
}
