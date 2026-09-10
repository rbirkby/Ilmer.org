import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { medianAge } from './median-age.ts';

const stats = (...ages: unknown[]) =>
  medianAge(
    ages.map((age) => ({ age })),
    'age'
  );

test('calculates odd and even medians using numeric ordering', () => {
  assert.deepEqual(stats('9', '80', '20'), { median: 20, count: 3 });
  assert.deepEqual(stats('40', '21', '20', '24'), { median: 22.5, count: 4 });
  assert.deepEqual(stats('0'), { median: 0, count: 1 });
});

test('excludes absent, unknown, bounded and ambiguous ages', () => {
  assert.equal(stats('', 'full age', 'no age', '?', 'about 70', '21?', '20 or 30', null, undefined), null);
  assert.equal(stats(), null);
  assert.deepEqual(stats('full age', '', '21', '25', 'no age'), { median: 23, count: 2 });
});

test('includes infant ages and converts explicit units and compound ages to years', () => {
  assert.deepEqual(stats('7 months', '3 weeks', '9 days', '80', '90'), { median: 0.6, count: 5 });
  for (const [age, median] of [
    ['4 weeks & 5 days', 0.1],
    ['4 years 1 quarter', 4.3],
    ['9 years & 1 quarter', 9.3],
    ['1 yr & 9 months', 1.8],
    ['3 yrs', 3],
    [' 1 MONTH ', 0.1]
  ] as const) {
    assert.deepEqual(stats(age), { median, count: 1 });
  }
});

test('reads the requested age field without mutating records', () => {
  const records = [
    { groom_age: '30', bride_age: '20' },
    { groom_age: '24', bride_age: '22' }
  ];
  const original = structuredClone(records);
  assert.deepEqual(medianAge(records, 'groom_age'), { median: 27, count: 2 });
  assert.deepEqual(medianAge(records, 'bride_age'), { median: 21, count: 2 });
  assert.deepEqual(records, original);
});

test('recognises every explicitly recorded age in the burial register', () => {
  const records = JSON.parse(readFileSync(new URL('../_data/st-peters-burials.json', import.meta.url), 'utf8'));
  const known = records.filter((record: { age: string }) => record.age !== '' && record.age !== 'no age');
  assert.equal(medianAge(records, 'age')?.count, known.length);
});
