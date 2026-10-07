/**
 * Age-and-sex counts for a rendered census HTML table, in five-year bands.
 * Reads the Age and Sex columns, or Age Years, Age Months and Sex on the
 * 1921 return. Bands run from the oldest group that has anyone in it down
 * to 0 to 4, keeping empty groups in between so the scale does not skip.
 * 95 and over is one open band. Returns null when no table records both
 * age and sex, which is the case for the 1801–1831 head counts.
 */

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&rsquo;': '\u2019',
  '&lsquo;': '\u2018'
};

const BAND_YEARS = 5;
const OPEN_BAND = 95;

function decodeEntities(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|apos|nbsp|rsquo|lsquo|#39);/g, (entity) => ENTITY_MAP[entity] ?? entity);
}

function stripCell(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Completed years, plus a fraction for an age written as months, weeks or days. */
function ageInYears(value: string): number | null {
  const age = value.trim().toLowerCase();
  if (!age) return null;
  if (/^\d+$/.test(age)) return Number(age);
  const match = /^(\d+)\s*(years?|yrs?|months?|mos?|weeks?|wks?|days?|quarters?)$/.exec(age);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit.startsWith('y')) return amount;
  if (unit.startsWith('q')) return amount / 4;
  if (unit.startsWith('mo')) return amount / 12;
  if (unit.startsWith('w')) return (amount * 7) / 365.25;
  return amount / 365.25;
}

/** 1921 records completed years and months in separate columns. */
function ageFromParts(yearsRaw: string, monthsRaw: string): number | null {
  const years = yearsRaw.trim();
  const months = monthsRaw.trim();
  if (!years && !months) return null;
  if ((years && !/^\d+$/.test(years)) || (months && !/^\d+$/.test(months))) return null;
  return Number(years || 0) + Number(months || 0) / 12;
}

function sexOf(value: string): 'male' | 'female' | null {
  const sex = value.trim().toLowerCase();
  if (sex === 'm' || sex === 'male') return 'male';
  if (sex === 'f' || sex === 'female') return 'female';
  return null;
}

function bandStart(years: number): number {
  if (years >= OPEN_BAND) return OPEN_BAND;
  if (years < 0) return 0;
  return Math.floor(years / BAND_YEARS) * BAND_YEARS;
}

function bandLabel(start: number): string {
  if (start >= OPEN_BAND) return '95 and over';
  return `${start} to ${start + BAND_YEARS - 1}`;
}

/** A top tick that covers the longest bar, with a short run of round steps. */
function axisScale(peak: number): { axisMax: number; ticks: number[] } {
  const maxCount = Math.max(1, peak);
  let step: number;
  let axisMax: number;
  if (maxCount <= 5) {
    step = 1;
    axisMax = maxCount;
  } else if (maxCount <= 10) {
    step = 2;
    axisMax = Math.ceil(maxCount / 2) * 2;
  } else if (maxCount <= 20) {
    step = 5;
    axisMax = Math.ceil(maxCount / 5) * 5;
  } else {
    step = Math.max(5, Math.ceil(maxCount / 4 / 5) * 5);
    axisMax = Math.ceil(maxCount / step) * step;
  }
  const ticks: number[] = [];
  for (let value = 0; value <= axisMax; value += step) ticks.push(value);
  return { axisMax, ticks };
}

function omissionNote(unsexed: number, unaged: number, unrecorded: number): string | null {
  const total = unsexed + unaged + unrecorded;
  if (total === 0) return null;
  const verb = total === 1 ? '1 person is' : `${total} people are`;
  if (unsexed === total) return `${verb} not shown because the return records no sex.`;
  if (unaged === total) return `${verb} not shown because the return records no age.`;
  return `${verb} not shown because the return records no age or no sex.`;
}

export interface AgeBand {
  label: string;
  male: number;
  female: number;
  maleLabel: string;
  femaleLabel: string;
  maleTitle: string;
  femaleTitle: string;
}

export interface AgePyramid {
  bands: AgeBand[];
  ticks: number[];
  axisMax: number;
  maleTotal: number;
  femaleTotal: number;
  summary: string;
  note: string | null;
}

function pyramidFromTable(tableHtml: string): AgePyramid | null {
  const headers = [...tableHtml.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((match) => stripCell(match[1]));
  const sexIndex = headers.findIndex((header) => /^sex$/i.test(header));
  const ageIndex = headers.findIndex((header) => /^age$/i.test(header));
  const yearsIndex = headers.findIndex((header) => /^age years$/i.test(header));
  const monthsIndex = headers.findIndex((header) => /^age months$/i.test(header));
  if (sexIndex === -1 || (ageIndex === -1 && yearsIndex === -1)) return null;

  const counts = new Map<number, { male: number; female: number }>();
  let maleTotal = 0;
  let femaleTotal = 0;
  let unsexed = 0;
  let unaged = 0;
  let unrecorded = 0;

  for (const row of tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    if (/<th\b/i.test(row[1])) continue;
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripCell(match[1]));
    const age =
      yearsIndex >= 0
        ? ageFromParts(cells[yearsIndex] ?? '', monthsIndex >= 0 ? (cells[monthsIndex] ?? '') : '')
        : ageInYears(cells[ageIndex] ?? '');
    const sex = sexOf(cells[sexIndex] ?? '');
    if (age === null && sex === null) {
      const leftover = cells.some(
        (cell, index) =>
          index !== ageIndex && index !== yearsIndex && index !== monthsIndex && index !== sexIndex && cell !== ''
      );
      if (leftover) unrecorded += 1;
      continue;
    }
    if (age === null) {
      unaged += 1;
      continue;
    }
    if (sex === null) {
      unsexed += 1;
      continue;
    }
    const start = bandStart(age);
    const band = counts.get(start) ?? { male: 0, female: 0 };
    band[sex] += 1;
    counts.set(start, band);
    if (sex === 'male') maleTotal += 1;
    else femaleTotal += 1;
  }

  if (maleTotal + femaleTotal === 0) return null;

  let peak = 0;
  for (const band of counts.values()) peak = Math.max(peak, band.male, band.female);
  const { axisMax, ticks } = axisScale(peak);

  const bands: AgeBand[] = [];
  for (let start = Math.max(...counts.keys()); start >= 0; start -= BAND_YEARS) {
    const count = counts.get(start) ?? { male: 0, female: 0 };
    const label = bandLabel(start);
    const maleLabel = countLabel(count.male, 'male', 'males');
    const femaleLabel = countLabel(count.female, 'female', 'females');
    bands.push({
      label,
      male: count.male,
      female: count.female,
      maleLabel,
      femaleLabel,
      maleTitle: `${label}: ${maleLabel}`,
      femaleTitle: `${label}: ${femaleLabel}`
    });
  }

  return {
    bands,
    ticks,
    axisMax,
    maleTotal,
    femaleTotal,
    summary: `${countLabel(maleTotal, 'male', 'males')} and ${countLabel(femaleTotal, 'female', 'females')}`,
    note: omissionNote(unsexed, unaged, unrecorded)
  };
}

export function censusAgePyramid(html: unknown): AgePyramid | null {
  if (!html) return null;
  const tables = String(html).match(/<table\b[\s\S]*?<\/table>/gi) ?? [];
  for (const table of tables) {
    const pyramid = pyramidFromTable(table);
    if (pyramid) return pyramid;
  }
  return null;
}
