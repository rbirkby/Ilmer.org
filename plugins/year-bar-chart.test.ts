import assert from 'node:assert/strict';
import { test } from 'node:test';
import { yearBarChart } from './year-bar-chart.ts';

test('returns null when there are no valid years', () => {
  assert.equal(yearBarChart([], 'year'), null);
  assert.equal(yearBarChart([{ year: null }, { year: undefined }], 'year'), null);
});

test('fills every year in the range, not just years with data', () => {
  const chart = yearBarChart([{ year: 1600 }, { year: 1600 }, { year: 1603 }], 'year');
  assert.ok(chart);
  assert.equal(chart.minYear, 1600);
  assert.equal(chart.maxYear, 1603);
  assert.equal(chart.bars.length, 4); // 1600, 1601, 1602, 1603
  assert.deepEqual(
    chart.bars.map((b) => b.year),
    [1600, 1601, 1602, 1603]
  );
  assert.deepEqual(
    chart.bars.map((b) => b.count),
    [2, 0, 0, 1]
  );
});

test('zero-count years get a zero-height bar sitting on the axis', () => {
  const chart = yearBarChart([{ year: 1700 }, { year: 1702 }], 'year');
  assert.ok(chart);
  const empty = chart.bars.find((b) => b.year === 1701);
  assert.ok(empty);
  assert.equal(empty.height, 0);
  assert.equal(empty.y, chart.axisY);
});

test('the tallest bar reaches the top of the plot area', () => {
  const chart = yearBarChart([{ year: 1800 }, { year: 1800 }, { year: 1800 }, { year: 1801 }], 'year');
  assert.ok(chart);
  assert.equal(chart.maxCount, 3);
  const tallest = chart.bars.find((b) => b.year === 1800);
  assert.ok(tallest);
  assert.equal(tallest.y, chart.plotTop);
  assert.equal(tallest.height, chart.axisY - chart.plotTop);
});

test('x-axis ticks always include the first and last year of the range', () => {
  const chart = yearBarChart([{ year: 1613 }, { year: 1998 }], 'year');
  assert.ok(chart);
  const tickYears = chart.xTicks.map((t) => t.year);
  assert.ok(tickYears.includes(1613));
  assert.ok(tickYears.includes(1998));
  assert.deepEqual(
    tickYears,
    [...tickYears].sort((a, b) => a - b)
  );
});

test('a regular tick that would crowd the final year label is dropped, not doubled up', () => {
  // 1600-1969: the 50-year grid lands on ...1900, 1950, then the mandatory
  // 1969 tick - 1950 is only 19 years (well under the 50-year spacing) from
  // 1969, so it should be dropped rather than rendered right next to it.
  const chart = yearBarChart([{ year: 1600 }, { year: 1969 }], 'year');
  assert.ok(chart);
  const tickYears = chart.xTicks.map((t) => t.year);
  assert.equal(tickYears.filter((y) => y === 1969).length, 1);
  assert.ok(!tickYears.includes(1950), `expected 1950 to be dropped, got ${tickYears.join(', ')}`);
  // every remaining pair of ticks stays at least 40% of the base interval apart
  for (let i = 1; i < tickYears.length; i++) {
    assert.ok(tickYears[i]! - tickYears[i - 1]! >= 20, tickYears.join(', '));
  }
});

test('never ends up with zero x-axis ticks even when everything crowds the edges', () => {
  const chart = yearBarChart([{ year: 1600 }, { year: 1601 }], 'year');
  assert.ok(chart);
  assert.ok(chart.xTicks.length >= 1);
  assert.equal(chart.xTicks[0]?.year, 1600);
  assert.equal(chart.xTicks.at(-1)?.year, 1601);
});

test('ignores non-numeric years but still counts the rest', () => {
  const chart = yearBarChart([{ year: 1700 }, { year: null }, { year: 1700 }, { year: undefined }], 'year');
  assert.ok(chart);
  assert.equal(chart.total, 2);
  assert.equal(chart.minYear, 1700);
  assert.equal(chart.maxYear, 1700);
});

test('extracts the year from a full date string, not just a bare number', () => {
  const chart = yearBarChart(
    [{ baptism_date: '10 Apr 1600' }, { baptism_date: 'Aug 1602' }, { baptism_date: '10 Apr 1600' }],
    'baptism_date'
  );
  assert.ok(chart);
  assert.equal(chart.minYear, 1600);
  assert.equal(chart.maxYear, 1602);
  assert.equal(chart.total, 3);
  assert.equal(chart.bars.find((b) => b.year === 1600)?.count, 2);
});

test('an empty date string contributes nothing rather than a false year', () => {
  const chart = yearBarChart([{ birth_date: '' }, { birth_date: '27 Jul 1981' }], 'birth_date');
  assert.ok(chart);
  assert.equal(chart.total, 1);
  assert.equal(chart.minYear, 1981);
});

test('a single-year dataset produces one full-height bar without dividing by zero', () => {
  const chart = yearBarChart([{ year: 1900 }, { year: 1900 }], 'year');
  assert.ok(chart);
  assert.equal(chart.bars.length, 1);
  assert.equal(chart.bars[0]?.count, 2);
  assert.ok(Number.isFinite(chart.bars[0]?.width));
});

function counted(year: number, times: number) {
  return Array.from({ length: times }, () => ({ year }));
}

test('average is the total spread across the full year span, including empty years', () => {
  // 4 events across 1600-1603 (a 4-year span) = 1.0/year, not 4/2 = 2.0 just
  // because only 2 of those years actually have anything in them
  const chart = yearBarChart([...counted(1600, 2), ...counted(1603, 2)], 'year');
  assert.ok(chart);
  assert.equal(chart.total, 4);
  assert.equal(chart.average, '1.0');
});

test('average is formatted to one decimal place, even when the raw value has none', () => {
  const chart = yearBarChart([{ year: 1600 }, { year: 1600 }, { year: 1601 }], 'year');
  assert.ok(chart);
  assert.equal(chart.average, '1.5');
});

test('busiest year is the one with the most events', () => {
  const chart = yearBarChart([...counted(1741, 19), { year: 1602 }, { year: 1981 }], 'year');
  assert.ok(chart);
  assert.equal(chart.busiestYear, 1741);
  assert.equal(chart.maxCount, 19);
});

test('a tie for busiest year resolves to the earliest one, deterministically', () => {
  const chart = yearBarChart([...counted(1700, 3), ...counted(1750, 3), { year: 1600 }], 'year');
  assert.ok(chart);
  assert.equal(chart.busiestYear, 1700);
});

test('a meaningful range gets more than a bare top-and-bottom gridline', () => {
  const chart = yearBarChart([...counted(1741, 19), { year: 1602 }, { year: 1981 }], 'year');
  assert.ok(chart);
  assert.equal(chart.maxCount, 19);
  assert.ok(chart.yTicks.length > 2, `expected more than 2 major gridlines, got ${chart.yTicks.length}`);
  // major gridlines land on round numbers, not the raw max count
  for (const t of chart.yTicks) assert.equal(t.value % 1, 0);
  assert.ok(chart.yTicks.at(-1)!.value >= chart.maxCount);
});

test('minor gridlines sit strictly between consecutive major ones', () => {
  const chart = yearBarChart([...counted(1741, 19), { year: 1602 }], 'year');
  assert.ok(chart);
  assert.ok(chart.yMinorTicks.length > 0);
  const majorYs = chart.yTicks.map((t) => t.y).sort((a, b) => a - b);
  for (const minorY of chart.yMinorTicks) {
    assert.ok(
      majorYs.some((y, i) => i > 0 && minorY > majorYs[i - 1]! && minorY < y),
      `minor gridline at y=${minorY} is not strictly between two major ones`
    );
  }
});

test('minor gridlines split each major interval into as many whole numbers as possible', () => {
  // maxCount 19 rounds up to a major step of 5 (0, 5, 10, 15, 20) - a step
  // of 5 divides evenly into 5 whole-number pieces (1 each), so every
  // integer that isn't already a major gridline gets a minor one: 16 in
  // total across the four intervals.
  const chart = yearBarChart([...counted(1741, 19), { year: 1602 }], 'year');
  assert.ok(chart);
  assert.equal(chart.yTicks.map((t) => t.value).join(','), '0,5,10,15,20');
  assert.equal(chart.yMinorTicks.length, 16);
});

test('every minor gridline lands on a whole-number value, never a fraction', () => {
  for (const maxCount of [3, 7, 12, 19, 23, 47, 99]) {
    const chart = yearBarChart([...counted(1741, maxCount), { year: 1600 }], 'year');
    assert.ok(chart);
    const niceMax = chart.yTicks.at(-1)!.value;
    for (const y of chart.yMinorTicks) {
      const impliedValue: number = ((chart.axisY - y) / (chart.axisY - chart.plotTop)) * niceMax;
      assert.ok(
        Math.abs(impliedValue - Math.round(impliedValue)) < 0.05,
        `maxCount=${maxCount}: minor gridline at y=${y} implies value ${impliedValue}, not a whole number`
      );
    }
  }
});

test('the tallest bar leaves headroom below a rounded-up gridline maximum', () => {
  const chart = yearBarChart([...counted(1741, 19), { year: 1602 }, { year: 1981 }], 'year');
  assert.ok(chart);
  const tallest = chart.bars.find((b) => b.year === 1741);
  assert.ok(tallest);
  // 19 rounds up to a major gridline at 20, so the bar for 19 shouldn't
  // reach all the way to the top of the plot area
  assert.ok(tallest.height < chart.axisY - chart.plotTop);
});

test('an unbucketed chart reports single-year periods labelled by the bare year', () => {
  const chart = yearBarChart([{ year: 1602 }, { year: 1981 }], 'year');
  assert.ok(chart);
  assert.equal(chart.bucketSize, 1);
  assert.equal(chart.firstBucket, 1602);
  assert.equal(chart.lastBucket, 1981);
  assert.equal(chart.bars[0]?.label, '1602');
});

test('bucketing by decade starts and ends on whole decades', () => {
  const chart = yearBarChart([{ year: 1602 }, { year: 1981 }], 'year', 10);
  assert.ok(chart);
  assert.equal(chart.minYear, 1602);
  assert.equal(chart.maxYear, 1981);
  assert.equal(chart.firstBucket, 1600);
  assert.equal(chart.lastBucket, 1980);
  assert.equal(chart.bars.length, 39); // the 1600s through the 1980s
  assert.equal(chart.bars[0]?.label, '1600s');
  assert.equal(chart.bars.at(-1)?.label, '1980s');
});

test('decade bars total the years they cover, including the empty ones', () => {
  const chart = yearBarChart([...counted(1741, 3), { year: 1749 }, { year: 1760 }], 'year', 10);
  assert.ok(chart);
  assert.equal(chart.bars.find((b) => b.year === 1740)?.count, 4);
  assert.equal(chart.bars.find((b) => b.year === 1750)?.count, 0);
  assert.equal(chart.bars.find((b) => b.year === 1760)?.count, 1);
  assert.equal(chart.total, 5);
  assert.equal(chart.maxCount, 4);
  assert.equal(chart.busiestYear, 1740);
});

test('the per-year average is the same figure however the bars are grouped', () => {
  const records = [...counted(1741, 3), { year: 1749 }, { year: 1760 }];
  assert.equal(yearBarChart(records, 'year', 10)?.average, yearBarChart(records, 'year')?.average);
});

test('decade x-axis ticks land on whole decades, first and last included', () => {
  const chart = yearBarChart([{ year: 1602 }, { year: 1981 }], 'year', 10);
  assert.ok(chart);
  const tickYears = chart.xTicks.map((t) => t.year);
  assert.equal(tickYears[0], 1600);
  assert.equal(tickYears.at(-1), 1980);
  for (const year of tickYears) assert.equal(year % 10, 0, tickYears.join(', '));
  // every tick sits at the centre of the bar for its decade
  const bars = chart.bars;
  for (const tick of chart.xTicks) {
    const bar = bars.find((b) => b.year === tick.year)!;
    assert.ok(Math.abs(tick.x - (bar.x + bar.width / 2)) < 2.5, `${tick.year}`);
  }
});

test('a bucket size other than a decade is labelled as a span of years', () => {
  const chart = yearBarChart([{ year: 1600 }, { year: 1624 }], 'year', 25);
  assert.ok(chart);
  assert.equal(chart.bars.length, 1);
  assert.equal(chart.bars[0]?.label, '1600–1624');
  assert.equal(chart.bars[0]?.count, 2);
});
