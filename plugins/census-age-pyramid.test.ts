import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import markdownIt from 'markdown-it';
import { censusAgePyramid, type AgePyramid } from './census-age-pyramid.ts';

function table(headers: string[], rows: string[][]): string {
  const head = headers.map((header) => `<th>${header}</th>`).join('');
  const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function band(chart: AgePyramid, label: string) {
  const found = chart.bands.find((item) => item.label === label);
  assert.ok(found, label);
  return found;
}

test('counts males and females into five-year bands, oldest first', () => {
  const chart = censusAgePyramid(
    table(
      ['Forename', 'Age', 'Sex'],
      [
        ['Ann', '3mo', 'F'],
        ['William', '4', 'M'],
        ['Jane', '1wk', 'F'],
        ['John', '10', 'Male'],
        ['Mary', '14', 'female'],
        ['Thomas', '80', 'M'],
        ['', '', ''],
        ['Sarah', '10 mo', 'F']
      ]
    )
  );
  assert.ok(chart);
  assert.deepEqual(
    chart.bands.map((item) => item.label),
    [
      '80 to 84',
      '75 to 79',
      '70 to 74',
      '65 to 69',
      '60 to 64',
      '55 to 59',
      '50 to 54',
      '45 to 49',
      '40 to 44',
      '35 to 39',
      '30 to 34',
      '25 to 29',
      '20 to 24',
      '15 to 19',
      '10 to 14',
      '5 to 9',
      '0 to 4'
    ]
  );
  assert.deepEqual(band(chart, '0 to 4'), {
    label: '0 to 4',
    male: 1,
    female: 3,
    maleLabel: '1 male',
    femaleLabel: '3 females',
    maleTitle: '0 to 4: 1 male',
    femaleTitle: '0 to 4: 3 females'
  });
  assert.equal(band(chart, '10 to 14').male, 1);
  assert.equal(band(chart, '10 to 14').female, 1);
  assert.equal(band(chart, '15 to 19').male, 0);
  assert.equal(chart.maleTotal, 3);
  assert.equal(chart.femaleTotal, 4);
  assert.equal(chart.summary, '3 males and 4 females');
  assert.equal(chart.note, null);
  assert.equal(chart.axisMax, 3);
  assert.deepEqual(chart.ticks, [0, 1, 2, 3]);
});

test('reads 1921 age years and months, and leaves out a row with no sex', () => {
  const chart = censusAgePyramid(
    table(
      ['Age Years', 'Age Months', 'Sex', 'Forename'],
      [
        ['0', '8', 'M', 'William'],
        ['4', '11', 'F', 'Betty'],
        ['5', '0', 'M', 'George'],
        ['34', '7', 'F', 'Clara'],
        ['6', '0', '', 'Maurice'],
        ['', '', '', '']
      ]
    )
  );
  assert.ok(chart);
  assert.equal(band(chart, '0 to 4').male, 1);
  assert.equal(band(chart, '0 to 4').female, 1);
  assert.equal(band(chart, '5 to 9').male, 1);
  assert.equal(band(chart, '5 to 9').female, 0);
  assert.equal(band(chart, '30 to 34').female, 1);
  assert.equal(chart.bands[0].label, '30 to 34');
  assert.equal(chart.bands.at(-1)?.label, '0 to 4');
  assert.equal(chart.note, '1 person is not shown because the return records no sex.');
  assert.equal(chart.maleTotal, 2);
  assert.equal(chart.femaleTotal, 2);
});

test('puts 95 and over into one open band and scales a longer bar', () => {
  const rows = [
    ['94', 'M'],
    ['95', 'F'],
    ['100', 'F'],
    ['96', 'M']
  ];
  for (let index = 0; index < 12; index += 1) rows.push(['10', index % 2 === 0 ? 'M' : 'F']);
  const chart = censusAgePyramid(table(['Age', 'Sex'], rows));
  assert.ok(chart);
  assert.deepEqual(
    chart.bands.map((item) => item.label),
    [
      '95 and over',
      '90 to 94',
      '85 to 89',
      '80 to 84',
      '75 to 79',
      '70 to 74',
      '65 to 69',
      '60 to 64',
      '55 to 59',
      '50 to 54',
      '45 to 49',
      '40 to 44',
      '35 to 39',
      '30 to 34',
      '25 to 29',
      '20 to 24',
      '15 to 19',
      '10 to 14',
      '5 to 9',
      '0 to 4'
    ]
  );
  assert.equal(band(chart, '95 and over').male, 1);
  assert.equal(band(chart, '95 and over').female, 2);
  assert.equal(band(chart, '90 to 94').male, 1);
  assert.equal(band(chart, '10 to 14').male, 6);
  assert.equal(band(chart, '10 to 14').female, 6);
  assert.equal(chart.axisMax, 6);
  assert.deepEqual(chart.ticks, [0, 2, 4, 6]);
});

test('steps the axis by five once a band is longer than ten', () => {
  const rows = Array.from({ length: 12 }, () => ['30', 'M']);
  const chart = censusAgePyramid(table(['Age', 'Sex'], rows));
  assert.ok(chart);
  assert.equal(chart.axisMax, 15);
  assert.deepEqual(chart.ticks, [0, 5, 10, 15]);
});

test('keeps a long axis to a few labelled steps', () => {
  const rows = Array.from({ length: 21 }, () => ['30', 'M']);
  const chart = censusAgePyramid(table(['Age', 'Sex'], rows));
  assert.ok(chart);
  assert.equal(chart.axisMax, 30);
  assert.deepEqual(chart.ticks, [0, 10, 20, 30]);
});

test('ignores a blank separator and notes a person with no age', () => {
  const chart = censusAgePyramid(
    table(
      ['Forename', 'Age', 'Sex'],
      [
        ['Ann', '20', 'F'],
        ['', '', ''],
        ['John', '', 'M']
      ]
    )
  );
  assert.ok(chart);
  assert.equal(chart.femaleTotal, 1);
  assert.equal(chart.maleTotal, 0);
  assert.equal(chart.note, '1 person is not shown because the return records no age.');
  assert.equal(chart.summary, '0 males and 1 female');
});

test('notes a row that names someone but records neither age nor sex', () => {
  const chart = censusAgePyramid(
    table(
      ['Forename', 'Age', 'Sex'],
      [
        ['Ann', '20', 'F'],
        ['John', 'not known', '']
      ]
    )
  );
  assert.ok(chart);
  assert.equal(chart.note, '1 person is not shown because the return records no age or no sex.');
});

test('uses the first table that has both an age and a sex column', () => {
  const summary = table(['Males', 'Females'], [['36', '38']]);
  const people = table(['Age', 'Sex'], [['40', 'M']]);
  const chart = censusAgePyramid(`${summary}${people}`);
  assert.ok(chart);
  assert.equal(chart.maleTotal, 1);
  assert.equal(chart.axisMax, 1);
  assert.deepEqual(chart.ticks, [0, 1]);
});

test('returns null when ages and sexes were not recorded, or there is no table', () => {
  assert.equal(censusAgePyramid(table(['Males', 'Females'], [['36', '38']])), null);
  assert.equal(censusAgePyramid(table(['Age', 'Sex'], [['', '']])), null);
  assert.equal(censusAgePyramid(''), null);
  assert.equal(censusAgePyramid(null), null);
  assert.equal(censusAgePyramid('<p>No table</p>'), null);
});

test('reads the transcribed returns', () => {
  const md = markdownIt({ html: true });
  const render = (year: string) => {
    const source = readFileSync(new URL(`../census/${year}.md`, import.meta.url), 'utf8');
    const body = source.replace(/^---[\s\S]*?---\r?\n/, '');
    return censusAgePyramid(md.render(body));
  };

  const census1841 = render('1841');
  assert.ok(census1841);
  assert.equal(census1841.maleTotal, 42);
  assert.equal(census1841.femaleTotal, 37);
  assert.equal(census1841.note, null);
  assert.equal(census1841.bands[0].label, '75 to 79');
  assert.equal(census1841.bands.at(-1)?.label, '0 to 4');
  assert.equal(band(census1841, '0 to 4').male, 9);
  assert.equal(band(census1841, '65 to 69').male, 0);
  assert.equal(census1841.axisMax, 10);

  const census1851 = render('1851');
  assert.ok(census1851);
  assert.equal(census1851.maleTotal, 43);
  assert.equal(census1851.femaleTotal, 39);
  assert.equal(census1851.bands[0].label, '80 to 84');
  assert.equal(band(census1851, '10 to 14').male, 8);
  assert.equal(band(census1851, '10 to 14').female, 5);
  assert.equal(census1851.axisMax, 8);

  const census1921 = render('1921');
  assert.ok(census1921);
  assert.equal(census1921.maleTotal, 27);
  assert.equal(census1921.femaleTotal, 36);
  assert.equal(census1921.note, '1 person is not shown because the return records no sex.');
  assert.equal(census1921.bands[0].label, '75 to 79');
  assert.equal(band(census1921, '10 to 14').female, 6);
  assert.equal(band(census1921, '5 to 9').male, 1);
  assert.equal(census1921.axisMax, 6);

  assert.equal(render('1801'), null);
  assert.equal(render('1831'), null);
});
