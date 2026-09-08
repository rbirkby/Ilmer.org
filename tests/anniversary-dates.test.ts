import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DateUtils } from '../assets/js/anniversary-dates.js';

test('parseEventDate accepts full and abbreviated month names', () => {
  const dates = new DateUtils();
  const months = [
    ['January', 'Jan'],
    ['February', 'Feb'],
    ['March', 'Mar'],
    ['April', 'Apr'],
    ['May', 'May'],
    ['June', 'Jun'],
    ['July', 'Jul'],
    ['August', 'Aug'],
    ['September', 'Sep'],
    ['October', 'Oct'],
    ['November', 'Nov'],
    ['December', 'Dec']
  ];

  for (const [monthIndex, names] of months.entries()) {
    for (const name of names) {
      const input = `15 ${name} 1900`;
      assert.deepEqual(dates.parseEventDate(input), { day: 15, month: monthIndex + 1, year: 1900 }, input);
    }
  }
});

test('parseEventDate rejects incomplete dates', () => {
  const dates = new DateUtils();
  for (const input of ['', '1900', 'January 1900', '15 January']) {
    assert.equal(dates.parseEventDate(input), null, input);
  }
});

test('parseEventDate rejects unknown months and invalid years', () => {
  const dates = new DateUtils();
  for (const input of ['15 Unknown 1900', '15 January unknown', '15 January 0', '15 January -1']) {
    assert.equal(dates.parseEventDate(input), null, input);
  }
});

for (const input of [
  'unknown January 1900',
  '0 January 1900',
  '-1 January 1900',
  '32 January 1900',
  '31 April 1900',
  '30 February 2000',
  '29 February 1900',
  '29 February 2023'
]) {
  test(`parseEventDate rejects invalid day in ${input}`, () => {
    assert.equal(new DateUtils().parseEventDate(input), null);
  });
}

test('parseEventDate accepts valid month-end dates and leap days', () => {
  const dates = new DateUtils();
  assert.deepEqual(dates.parseEventDate('31 January 1900'), { day: 31, month: 1, year: 1900 });
  assert.deepEqual(dates.parseEventDate('30 April 1900'), { day: 30, month: 4, year: 1900 });
  assert.deepEqual(dates.parseEventDate('28 February 1900'), { day: 28, month: 2, year: 1900 });
  assert.deepEqual(dates.parseEventDate('29 February 2000'), { day: 29, month: 2, year: 2000 });
  assert.deepEqual(dates.parseEventDate('29 February 2024'), { day: 29, month: 2, year: 2024 });
});

for (const timezone of ['UTC', 'Europe/London']) {
  test(`anniversary calendar arithmetic in ${timezone}`, (context) => {
    const originalTimezone = process.env.TZ;
    process.env.TZ = timezone;
    context.after(() => {
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
    });

    const dates = new DateUtils();
    assert.equal(dates.getDayOfYear(30, 3, 2026) - dates.getDayOfYear(29, 3, 2026), 1);
    assert.equal(dates.getDayOfYear(26, 10, 2026) - dates.getDayOfYear(25, 10, 2026), 1);
    assert.equal(dates.getDayOfYear(29, 2, 2024), 60);
    assert.equal(dates.getDayOfYear(1, 3, 2024), 61);
    assert.equal(dates.getDayOfYear(31, 12, 2024), dates.daysInYear(2024));
    assert.equal(dates.getDayOfYear(31, 12, 2026), dates.daysInYear(2026));

    const beforeSpringChange = new Date(2026, 2, 28, 23, 30);
    const beforeAutumnChange = new Date(2026, 9, 24, 0, 30);
    assert.equal(dates.getRelativeDateString(0, beforeSpringChange), 'Today');
    assert.equal(dates.getRelativeDateString(1, beforeSpringChange), 'Tomorrow');
    assert.equal(dates.getRelativeDateString(2, beforeSpringChange), 'This Monday');
    assert.equal(dates.getRelativeDateString(10, beforeSpringChange), 'April 7');
    assert.equal(dates.getRelativeDateString(2, beforeAutumnChange), 'This Monday');
    assert.equal(dates.getRelativeDateString(10, beforeAutumnChange), 'November 3');
    assert.equal(beforeSpringChange.getDate(), 28);
    assert.equal(beforeAutumnChange.getDate(), 24);
  });
}
