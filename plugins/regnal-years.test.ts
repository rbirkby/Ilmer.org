import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Liquid } from 'liquidjs';
import { regnalYears } from './regnal-years.ts';

test('changes regnal years on anniversaries and monarchs on accession days', () => {
  for (const [date, expected] of [
    ['4 July 1776', '16 George III'],
    ['24 Oct 1776', '16 George III'],
    ['25 Oct 1776', '17 George III'],
    ['7 Sep 2022', '71 Elizabeth II'],
    ['8 Sep 2022', '1 Charles III'],
    ['14 Mar. 2023', '1 Charles III'],
    ['8 Sep 2023', '2 Charles III'],
    ['20 Jan 1936', '1 Edward VIII'],
    ['11 Dec 1936', '1 George VI']
  ])
    assert.equal(regnalYears(date), expected);
});

test('handles movable anniversaries, joint reigns and exceptional numbering', () => {
  for (const [date, expected] of [
    ['17 May 1200', '1 John'],
    ['18 May 1200', '2 John'],
    ['2 May 1201', '2 John'],
    ['3 May 1201', '3 John'],
    ['19 Oct 1216', '18 John'],
    ['20 Nov 1280', '8–9 Edward I'],
    ['5 Jul 1556', '2 & 3 Philip and Mary'],
    ['11 Jul. 1556', '2 & 4 Philip and Mary'],
    ['25 Jul 1556', '3 & 4 Philip and Mary'],
    ['27 Dec 1694', '6 William and Mary'],
    ['28 Dec 1694', '7 William III'],
    ['31 Dec 1695', '8 William III'],
    ['21 Jun 1753', '26 George II'],
    ['22 Jun 1753', '27 George II'],
    ['2 May 1662', '14 Charles II']
  ])
    assert.equal(regnalYears(date), expected);
  assert.equal(regnalYears('1657'), '8–9 Charles II (retrospectively dated)');
  assert.match(regnalYears('10 Oct 1470'), /10 Edward IV; 49 Henry VI/);
});

test('preserves uncertainty and includes all monarchs in a partial date or range', () => {
  assert.equal(regnalYears('1936'), '26 George V; 1 Edward VIII; 1 George VI');
  assert.equal(regnalYears('Sep. 2022'), '71 Elizabeth II; 1 Charles III');
  assert.equal(regnalYears('c. 1200'), '~1–2 John');
  assert.equal(regnalYears('c.1200'), '~1–2 John');
  assert.equal(regnalYears('ABT 25 Oct 1776'), '~17 George III');
  assert.equal(regnalYears('1558'), '4 & 5, 4 & 6, 5 & 6 Philip and Mary; 1 Elizabeth I');
  assert.equal(regnalYears('1869-1880+'), '32–44 Victoria');
  assert.match(regnalYears('Q4 1933'), /24 George V/);
  assert.match(regnalYears('Jun - Jul 1996'), /45 Elizabeth II/);
  assert.match(regnalYears('15 & 16 Jul. 1978'), /27 Elizabeth II/);
  assert.match(regnalYears('1968 (also 1971, 1973)'), /16–17, 19–22 Elizabeth II/);
});

test('normalises explicit dual years but leaves unmarked historical years alone', () => {
  assert.equal(regnalYears('10 Jan 1328/29'), regnalYears('10 Jan 1329'));
  assert.equal(regnalYears('1 Feb. 1333/4'), regnalYears('1 Feb 1334'));
  assert.match(regnalYears('1221/22'), /5–7 Henry III/);
  assert.match(regnalYears('10 Jan 1328'), /1 Edward III/);
});

test('does not invent regnal years for gaps or invalid dates', () => {
  assert.equal(regnalYears('pre-1066'), '');
  assert.equal(regnalYears('10 Sep 1087'), '');
  assert.equal(regnalYears('1 Jan 1689'), '');
  assert.equal(regnalYears('12 Dec 1688'), '');
  assert.equal(regnalYears('12 Feb 1689'), '');
  assert.equal(regnalYears('1689'), '1 William and Mary');
  for (const value of [
    'unknown',
    'Mayday 1900',
    '1 Ma 1900',
    '31 Feb 1900',
    '29 Feb 1900',
    '10 Sep 1752',
    '2000-1900'
  ]) {
    assert.equal(regnalYears(value), '');
  }
  assert.notEqual(regnalYears('29 Feb 1700'), ''); // Julian calendar
});

test('covers every timeline date and escapes joint regnal years in the date toggle', async () => {
  const events = JSON.parse(readFileSync(new URL('../_data/historicalEvents.json', import.meta.url), 'utf8'));
  for (const event of events) {
    if (event.date !== 'pre-1066') assert.notEqual(regnalYears(event.date), '', event.date);
  }
  const template = readFileSync(new URL('../history/timeline.liquid', import.meta.url), 'utf8');
  const dateSpan = template.match(/\{% assign regnalDate[^]*?<\/span>/)?.[0];
  assert.ok(dateSpan);
  const liquid = new Liquid();
  liquid.registerFilter('regnalYears', regnalYears);
  assert.equal(
    (await liquid.parseAndRender(dateSpan, { event: { date: '11 Jul. 1556' } })).trim(),
    '<span class="date" data-regnal-date="2 &amp; 4 Philip and Mary">11 Jul. 1556</span>'
  );
  for (const date of ['pre-1066', 'unknown', '10 Sep 1087', '1 Jan 1689']) {
    assert.equal(
      (await liquid.parseAndRender(dateSpan, { event: { date } })).trim(),
      `<span class="date">${date}</span>`
    );
  }
});
