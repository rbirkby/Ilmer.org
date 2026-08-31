import assert from 'node:assert/strict';
import { test } from 'node:test';
import { censusOccupations } from './census-occupations.js';

const SAMPLE = `
<p>Intro text.</p>
<table>
<thead>
<tr>
<th>Schedule</th>
<th style="text-align:left">Occupation</th>
<th style="text-align:left">Where born</th>
</tr>
</thead>
<tbody>
<tr>
<td>7</td>
<td style="text-align:left">Ag. Lab.</td>
<td style="text-align:left">Ilmer</td>
</tr>
<tr>
<td></td>
<td style="text-align:left">Lace maker</td>
<td style="text-align:left">Ilmer</td>
</tr>
<tr>
<td></td>
<td style="text-align:left">Lace maker</td>
<td style="text-align:left">Ilmer</td>
</tr>
<tr>
<td></td>
<td style="text-align:left"></td>
<td style="text-align:left"></td>
</tr>
<tr>
<td>8</td>
<td style="text-align:left">Farmer&rsquo;s wife</td>
<td style="text-align:left">Ilmer</td>
</tr>
</tbody>
</table>
`;

test('counts non-empty occupations from the Occupation column', () => {
  assert.deepEqual(censusOccupations(SAMPLE), [
    { occupation: 'Lace maker', count: 2 },
    { occupation: 'Ag. Lab.', count: 1 },
    { occupation: 'Farmer\u2019s wife', count: 1 }
  ]);
});

test('returns an empty list when there is no occupation column', () => {
  const html =
    '<table><thead><tr><th>Total</th><th>Males</th></tr></thead><tbody><tr><td>74</td><td>36</td></tr></tbody></table>';
  assert.deepEqual(censusOccupations(html), []);
});

test('returns an empty list for missing or table-less content', () => {
  assert.deepEqual(censusOccupations(''), []);
  assert.deepEqual(censusOccupations(null), []);
  assert.deepEqual(censusOccupations('<p>No table</p>'), []);
});

test('sorts by count descending, then occupation name', () => {
  const html = `<table><thead><tr><th>Occupation</th></tr></thead><tbody>
    <tr><td>Baker</td></tr>
    <tr><td>Carter</td></tr>
    <tr><td>Baker</td></tr>
    <tr><td>Able seaman</td></tr>
  </tbody></table>`;
  assert.deepEqual(censusOccupations(html), [
    { occupation: 'Baker', count: 2 },
    { occupation: 'Able seaman', count: 1 },
    { occupation: 'Carter', count: 1 }
  ]);
});
