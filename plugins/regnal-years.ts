/** English/British legal regnal dates (historical year numbering; English calendar).
 * Source and exceptional conventions:
 * https://en.wikipedia.org/wiki/Regnal_years_of_English_and_British_monarchs
 * Dates are numeric YYYYMMDD keys, not proleptic Gregorian JavaScript Dates.
 */
const REIGNS: Array<[name: string, start: number, end: number]> = [
  ['William I', 10661014, 10870909],
  ['William II', 10870926, 11000802],
  ['Henry I', 11000805, 11351201],
  ['Stephen', 11351226, 11541025],
  ['Henry II', 11541219, 11890706],
  ['Richard I', 11890903, 11990406],
  ['John', 11990527, 12161019],
  ['Henry III', 12161028, 12721116],
  ['Edward I', 12721120, 13070707],
  ['Edward II', 13070708, 13270120],
  ['Edward III', 13270125, 13770621],
  ['Richard II', 13770622, 13990929],
  ['Henry IV', 13990930, 14130320],
  ['Henry V', 14130321, 14220831],
  ['Henry VI', 14220901, 14610304],
  ['Edward IV', 14610304, 14830409],
  ['Edward V', 14830409, 14830625],
  ['Richard III', 14830626, 14850822],
  ['Henry VII', 14850822, 15090421],
  ['Henry VIII', 15090422, 15470128],
  ['Edward VI', 15470128, 15530706],
  ['Mary I', 15530706, 15540724],
  ['Philip and Mary', 15540725, 15581117],
  ['Elizabeth I', 15581117, 16030324],
  ['James I', 16030324, 16250327],
  ['Charles I', 16250327, 16490130],
  ['Charles II', 16490130, 16850206],
  ['James II', 16850206, 16881211],
  ['William and Mary', 16890213, 16941227],
  ['William III', 16941228, 17020308],
  ['Anne', 17020308, 17140801],
  ['George I', 17140801, 17270611],
  ['George II', 17270611, 17601025],
  ['George III', 17601025, 18200129],
  ['George IV', 18200129, 18300626],
  ['William IV', 18300626, 18370620],
  ['Victoria', 18370620, 19010122],
  ['Edward VII', 19010122, 19100506],
  ['George V', 19100506, 19360120],
  ['Edward VIII', 19360120, 19361211],
  ['George VI', 19361211, 19520205],
  ['Elizabeth II', 19520206, 20220908],
  ['Charles III', 20220908, 99991231]
];

type Range = [number, number];

/** John's regnal years ran from Ascension Day, so each anniversary is listed (MMDD from 1199). */
const JOHN_STARTS = [527, 518, 503, 523, 515, 603, 519, 511, 531, 515, 507, 527, 512, 503, 523, 508, 528, 519];
const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december'
];
const APPROXIMATE = /^(?:c\.|abt\.?)\s*/i;
/** Henry VI's readeption, 9 Oct 1470 – 11 Apr 1471. */
const READEPTION: Range = [14701009, 14710411];
/** Charles II's reign was dated from his father's death, though he ruled only from the Restoration. */
const INTERREGNUM: Range = [16490130, 16600528];

const ymd = (year: number, month: number, day: number) => year * 10000 + month * 100 + day;
const yearOf = (date: number) => Math.floor(date / 10000);

/** Accepts full month names or abbreviations of at least three letters. */
function monthNumber(name: string): number {
  const lower = name.toLowerCase();
  return lower.length >= 3 ? MONTHS.findIndex((month) => month.startsWith(lower)) + 1 : 0;
}

function monthEnd(year: number, month: number): number {
  const leap = year % 4 === 0 && (year < 1752 || year % 100 !== 0 || year % 400 === 0);
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function expandedYear(first: string, second: string): number {
  return Number(first.slice(0, first.length - second.length) + second);
}

function overlaps(ranges: Range[], from: number, until: number): boolean {
  return from <= until && ranges.some(([lo, hi]) => lo <= until && hi >= from);
}

/** Formats sorted, unique numbers as runs, e.g. [1, 2, 3, 5] → "1–3, 5". */
function formatRuns(sorted: number[]): string {
  const runs: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const first = sorted[i];
    while (sorted[i + 1] === sorted[i] + 1) i++;
    runs.push(first === sorted[i] ? `${first}` : `${first}–${sorted[i]}`);
  }
  return runs.join(', ');
}

/** Start of the regnal year beginning in `year`, or past the reign's end if there is none. */
function anniversary(name: string, start: number, end: number, year: number): number {
  if (name === 'John') {
    const day = JOHN_STARTS[year - 1199];
    return day === undefined ? end + 1 : year * 10000 + day;
  }
  // George II's anniversary moved to 22 June with the 1752 calendar change.
  if (name === 'George II' && year >= 1753) return ymd(year, 6, 22);
  return year * 10000 + (start % 10000);
}

/** Slash years with a day/month use the later historical year (e.g. Jan 1328/29).
 * Bare slash years are uncertain ranges; unmarked dates retain their stated year.
 */
function dateRange(value: string): Range | null {
  const exact = /^(\d{1,2})(?:\s*&\s*(\d{1,2}))?\s+([a-z]+)\.?\s+(\d{4})(?:\/(\d{1,4}))?$/i.exec(value);
  if (exact) {
    const [, first, last, monthName, y, dual] = exact;
    const year = dual ? expandedYear(y, dual) : Number(y);
    const month = monthNumber(monthName);
    const day = Number(first);
    const endDay = Number(last ?? first);
    if (!month || day < 1 || endDay < day || endDay > monthEnd(year, month)) return null;
    // 3–13 Sep 1752 were skipped in the switch to the Gregorian calendar.
    if (year === 1752 && month === 9 && day <= 13 && endDay >= 3) return null;
    return [ymd(year, month, day), ymd(year, month, endDay)];
  }
  const months = /^([a-z]+)\.?(?:\s*-\s*([a-z]+)\.?)?\s+(\d{4})$/i.exec(value);
  if (months) {
    const first = monthNumber(months[1]);
    const last = monthNumber(months[2] ?? months[1]);
    const year = Number(months[3]);
    return first && last >= first ? [ymd(year, first, 1), ymd(year, last, monthEnd(year, last))] : null;
  }
  const quarter = /^Q([1-4])\s+(\d{4})$/i.exec(value);
  if (quarter) {
    const last = Number(quarter[1]) * 3;
    const year = Number(quarter[2]);
    return [ymd(year, last - 2, 1), ymd(year, last, monthEnd(year, last))];
  }
  const years = /^(\d{4})(?:[-/](\d{1,4}))?$/.exec(value);
  if (!years) return null;
  const first = Number(years[1]);
  const last = years[2] ? expandedYear(years[1], years[2]) : first;
  return last >= first ? [ymd(first, 1, 1), ymd(last, 12, 31)] : null;
}

/** Describes a timeline date in English regnal years, e.g. "4 July 1776" → "16 George III".
 * Returns an empty string when any part of the date can't be parsed or falls outside a reign.
 */
export function regnalYears(value: string): string {
  const approximate = APPROXIMATE.test(value);
  const also = /\(also ([\d, ]+)\)/i.exec(value)?.[1].split(/,\s*/) ?? [];
  const cleaned = value
    .replace(APPROXIMATE, '')
    .replace(/^res\.\s*/i, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\+/g, '')
    .trim();
  const parsed = [cleaned, ...also].map(dateRange);
  if (parsed.some((range) => !range)) return '';
  const ranges = parsed as Range[];
  const lastYear = Math.max(...ranges.map(([, hi]) => yearOf(hi)));

  const groups: string[] = [];
  for (const [index, [name, start, rawEnd]] of REIGNS.entries()) {
    // On shared accession/death dates use the incoming monarch.
    const end = Math.min(rawEnd, (REIGNS[index + 1]?.[1] ?? Infinity) - 1);
    const firstYear = yearOf(start);
    const numbers = new Set<number>();
    const pairs: string[] = [];
    for (let year = firstYear; year <= Math.min(yearOf(end), lastYear); year++) {
      const from = anniversary(name, start, end, year);
      const until = Math.min(end, anniversary(name, start, end, year + 1) - 1);
      if (from > until) continue;
      const n = year - firstYear + 1 + (name === 'William III' ? 6 : 0);
      if (name === 'Philip and Mary') {
        // Mary's anniversary remains 6 July; Philip's is 25 July.
        const split = ymd(year + 1, 7, 6);
        if (overlaps(ranges, from, Math.min(until, split - 1))) pairs.push(`${n} & ${n + 1}`);
        if (overlaps(ranges, split, until)) pairs.push(`${n} & ${n + 2}`);
      } else if (overlaps(ranges, from, until)) {
        numbers.add(n);
        // Edward I's anniversary belongs to both regnal years in the source table.
        if (name === 'Edward I' && n > 1 && overlaps(ranges, from, from)) numbers.add(n - 1);
      }
    }
    if (pairs.length) groups.push(`${pairs.join(', ')} ${name}`);
    if (numbers.size) groups.push(`${formatRuns([...numbers].sort((a, b) => a - b))} ${name}`);
  }
  if (!groups.length) return '';
  if (overlaps(ranges, ...READEPTION)) groups.push('49 Henry VI (1st year of readeption)');
  const note = overlaps(ranges, ...INTERREGNUM) ? ' (retrospectively dated)' : '';
  return `${approximate ? '~' : ''}${groups.join('; ')}${note}`;
}
