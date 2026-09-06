import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DateUtils } from '../assets/js/anniversary-dates.js';

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
