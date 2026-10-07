import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';
import { censusAgePyramid } from '../plugins/census-age-pyramid.ts';

const includes = new URL('../_includes/', import.meta.url);
const liquid = new Liquid({ root: fileURLToPath(includes), extname: '.liquid' });

const SAMPLE = `<table><thead><tr><th>Age</th><th>Sex</th></tr></thead><tbody>
  <tr><td>2</td><td>M</td></tr>
  <tr><td>3</td><td>F</td></tr>
  <tr><td>8</td><td>M</td></tr>
  <tr><td>8</td><td>F</td></tr>
  <tr><td>70</td><td>F</td></tr>
</tbody></table>`;

test('the age pyramid partial mirrors males to the left and females to the right', async () => {
  const chart = censusAgePyramid(SAMPLE);
  assert.ok(chart);
  const html = await liquid.renderFile('census-age-pyramid', { chart });

  assert.match(html, /id="census-ages-heading">Age and sex</);
  assert.match(html, /style="--census-age-max: 1"/);
  assert.match(html, /census-ages__summary">2 males and 3 females</);
  assert.match(html, /census-ages__key--male">Male /);
  assert.match(html, /census-ages__key--female">[\s\S]*Female</);
  assert.match(html, /70 to 74[\s\S]*0 to 4/);
  assert.match(
    html,
    /census-ages__side--male" aria-hidden="true">\s*<span class="census-ages__bar" style="--count: 1" title="0 to 4: 1 male"><\/span>[\s\S]*?0 to 4<span class="sr-only">, 1 male, 1 female<\/span>[\s\S]*?census-ages__side--female" aria-hidden="true">\s*<span class="census-ages__bar" style="--count: 1" title="0 to 4: 1 female">/
  );
  assert.match(html, /70 to 74<span class="sr-only">, 0 males, 1 female<\/span>/);
  assert.equal(html.match(/census-ages__bar/g)?.length, 5);
  assert.match(html, /census-ages__tick--max" style="--tick: 1">1</);
  assert.match(html, /Number of people/);
  assert.doesNotMatch(html, /census-ages__note/);

  const withNote = await liquid.renderFile('census-age-pyramid', {
    chart: { ...chart, note: '1 person is not shown because the return records no sex.' }
  });
  assert.match(withNote, /census-ages__note">1 person is not shown because the return records no sex.</);
});

test('census pages render the age pyramid from the same table as the occupations', () => {
  const post = readFileSync(new URL('../_includes/post.liquid', import.meta.url), 'utf8');
  const summary = readFileSync(new URL('../_includes/census-summary.liquid', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../assets/css/archive.css', import.meta.url), 'utf8');
  assert.match(post, /content \| censusAgePyramid/);
  assert.match(post, /render "census-summary\.liquid", chart: ages, occupations: occupations/);
  assert.match(summary, /render "census-age-pyramid\.liquid", chart: chart, embedded: true/);
  assert.match(summary, /href="#census-occupations"/);
  assert.match(summary, /href="#census-ages"/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) max-content minmax\(0, 1fr\)/);
  assert.match(css, /#census-occupations:target/);
  assert.doesNotMatch(css, /--census-ages-label:\s*8\.8rem/);
});

test('age and occupations share a card when a return has both, and stay separate otherwise', async () => {
  const chart = censusAgePyramid(SAMPLE);
  assert.ok(chart);
  const occupations = [
    { occupation: 'Ag. Lab.', count: 2 },
    { occupation: 'Farmer', count: 1 }
  ];

  const both = await liquid.renderFile('census-summary', { chart, occupations });
  assert.match(both, /class="census-summary"/);
  assert.match(both, /id="census-ages-heading" tabindex="-1">Age and sex</);
  assert.match(both, /<a href="#census-occupations">Occupations<\/a>/);
  assert.match(both, /<a href="#census-ages">Age and sex<\/a>/);
  assert.match(both, /id="census-occupations-heading" tabindex="-1">Occupations</);
  assert.match(both, /census-ages__summary">2 males and 3 females</);
  assert.match(both, /Ag\. Lab\./);
  assert.match(both, />2\s*<span class="sr-only">\s*people/);
  assert.match(both, />1\s*<span class="sr-only">\s*person/);
  assert.doesNotMatch(both, /<section class="census-ages"/);
  assert.equal(both.match(/<h2\b/g)?.length, 2);

  const agesOnly = await liquid.renderFile('census-summary', { chart, occupations: [] });
  assert.match(agesOnly, /<section class="census-ages"/);
  assert.match(agesOnly, /id="census-ages-heading">Age and sex</);
  assert.doesNotMatch(agesOnly, /census-summary/);
  assert.doesNotMatch(agesOnly, /census-occupations/);

  const jobsOnly = await liquid.renderFile('census-summary', { chart: null, occupations });
  assert.match(jobsOnly, /<section\s[^>]*class="census-occupations"/);
  assert.match(jobsOnly, /id="census-occupations-heading">Occupations</);
  assert.match(jobsOnly, /Ag\. Lab\./);
  assert.doesNotMatch(jobsOnly, /census-summary/);
  assert.doesNotMatch(jobsOnly, /census-ages/);

  const neither = await liquid.renderFile('census-summary', { chart: null, occupations: [] });
  assert.equal(neither.trim(), '');
});
