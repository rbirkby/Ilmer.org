/** Geometry for an inline SVG bar chart of event counts per year, with every
 * year in the data's range represented (as a zero-height bar where there is
 * no entry), not just the years that happen to appear. */

export interface YearBar {
  x: number;
  y: number;
  width: number;
  height: number;
  year: number;
  count: number;
}

export interface YearTick {
  x: number;
  year: number;
}

export interface ValueTick {
  y: number;
  value: number;
}

export interface YearBarChart {
  bars: YearBar[];
  xTicks: YearTick[];
  yTicks: ValueTick[];
  yMinorTicks: number[];
  width: number;
  height: number;
  plotTop: number;
  plotLeft: number;
  plotRight: number;
  axisY: number;
  tickTop: number;
  tickBottom: number;
  labelY: number;
  minYear: number;
  maxYear: number;
  maxCount: number;
  total: number;
  /** Events per year, averaged across the full min-max span (including
   * years with none), formatted to one decimal place (e.g. "1.0", not "1")
   * so a column of these always lines up. */
  average: string;
  /** The earliest year with the most events (ties broken chronologically,
   * so the figure is stable rather than depending on Map iteration order). */
  busiestYear: number;
}

const WIDTH = 900;
const MARGIN_LEFT = 38; // room for a larger two/three-digit y-axis label
const MARGIN_RIGHT = 4;
const PLOT_TOP = 14; // room for a y-axis label sitting above the top gridline
const PLOT_BOTTOM = 150;
const AXIS_Y = PLOT_BOTTOM;
const TICK_TOP = AXIS_Y + 5;
const TICK_BOTTOM = TICK_TOP + 5;
const LABEL_Y = TICK_BOTTOM + 16;
const HEIGHT = LABEL_Y + 6;

/** A round-number interval that keeps x-axis labels legible: dense enough to
 * place the data in time, sparse enough that a ~400-year range doesn't
 * collide into an unreadable smear of text. */
function pickTickInterval(yearSpan: number): number {
  if (yearSpan > 300) return 50;
  if (yearSpan > 150) return 25;
  if (yearSpan > 80) return 20;
  if (yearSpan > 40) return 10;
  if (yearSpan > 15) return 5;
  return 1;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** A "nice" round step (1/2/5 x a power of ten) for about `targetTicks`
 * major gridlines between 0 and maxValue - the same convention most
 * charting libraries use so the axis reads in round numbers, not whatever
 * maxValue happens to be. */
function niceStep(maxValue: number, targetTicks = 5): number {
  const rough = maxValue / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

/** How many minor gridlines to fit in each major interval, preferring more
 * (up to 5) but only when that divides the major step into whole numbers -
 * the data is always an integer count, so a minor gridline at a fractional
 * value (e.g. step 5 split into quarters -> 1.25, 2.5, 3.75) isn't a value
 * the chart could ever actually show. Falls back to no minor gridlines at
 * all rather than ever show one off-integer. */
function pickMinorSubdivisions(majorStep: number): number {
  for (const subdivisions of [5, 4, 3, 2]) {
    if (majorStep % subdivisions === 0) return subdivisions;
  }
  return 1;
}

/** A record's year, whether the field holds a bare number or a date string
 * ending in one (e.g. "10 Apr 1600") - so charts can key off a full date
 * field directly instead of needing a separate year column in the data. */
function extractYear(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const match = /(\d{4})\s*$/.exec(value);
    if (match) return Number(match[1]);
  }
  return null;
}

export function yearBarChart(records: Array<Record<string, unknown>>, yearKey: string): YearBarChart | null {
  const years = records.map((r) => extractYear(r[yearKey])).filter((y): y is number => y !== null);
  if (years.length === 0) return null;

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const counts = new Map<number, number>();
  for (const y of years) counts.set(y, (counts.get(y) ?? 0) + 1);
  const maxCount = Math.max(...counts.values());
  const busiestYear = [...counts.entries()]
    .filter(([, count]) => count === maxCount)
    .reduce((earliest, [year]) => Math.min(earliest, year), Infinity);

  const yearSpan = maxYear - minYear + 1;
  const average = (years.length / yearSpan).toFixed(1);
  const plotWidth = WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  const plotHeight = AXIS_Y - PLOT_TOP;
  const barWidth = plotWidth / yearSpan;
  // Below ~3px a rounded cap reads as a triangle rather than a bar - only
  // round the corner when there's room for it to look like one.
  const gap = barWidth > 3 ? Math.min(0.6, barWidth * 0.15) : 0;

  // The chart's own counts are always whole numbers, so a fractional major
  // step would be a strange axis to read - clamp to at least 1. The top
  // gridline (niceMax) is often a touch above maxCount, which is what gives
  // the tallest bar a little headroom instead of touching the plot's edge.
  const step = Math.max(1, niceStep(maxCount));
  const niceMax = Math.ceil(maxCount / step) * step;

  const bars: YearBar[] = [];
  for (let i = 0; i < yearSpan; i++) {
    const year = minYear + i;
    const count = counts.get(year) ?? 0;
    const x = MARGIN_LEFT + i * barWidth;
    const barHeight = (count / niceMax) * plotHeight;
    bars.push({
      x: round(x),
      y: round(AXIS_Y - barHeight),
      width: round(Math.max(barWidth - gap, 0.3)),
      height: round(barHeight),
      year,
      count
    });
  }

  const interval = pickTickInterval(yearSpan);
  const xTicks: YearTick[] = [];
  const firstTickYear = Math.ceil(minYear / interval) * interval;
  for (let year = firstTickYear; year <= maxYear; year += interval) {
    xTicks.push({ x: round(MARGIN_LEFT + (year - minYear + 0.5) * barWidth), year });
  }
  // minYear/maxYear are always labelled so the range is never ambiguous, but
  // a regular tick sitting close to one crowds its label into it - drop the
  // regular tick rather than let them collide.
  const minGap = interval * 0.4;
  if (xTicks[0] && xTicks[0].year - minYear < minGap) xTicks.shift();
  if (xTicks[0]?.year !== minYear) {
    xTicks.unshift({ x: round(MARGIN_LEFT + 0.5 * barWidth), year: minYear });
  }
  const last = xTicks[xTicks.length - 1];
  if (last && last.year !== minYear && maxYear - last.year < minGap) xTicks.pop();
  if (xTicks[xTicks.length - 1]?.year !== maxYear) {
    xTicks.push({ x: round(MARGIN_LEFT + (yearSpan - 0.5) * barWidth), year: maxYear });
  }

  const valueToY = (value: number) => round(AXIS_Y - (value / niceMax) * plotHeight);
  const yTicks: ValueTick[] = [];
  for (let value = 0; value <= niceMax; value += step) {
    yTicks.push({ y: valueToY(value), value });
  }
  // Split each major interval into as many whole-number gridlines as it
  // will cleanly divide into (see pickMinorSubdivisions).
  const minorSubdivisions = pickMinorSubdivisions(step);
  const minorStep = step / minorSubdivisions;
  const yMinorTicks: number[] = [];
  const totalMinorSteps = Math.round((niceMax / step) * minorSubdivisions);
  for (let i = 1; i < totalMinorSteps; i++) {
    if (i % minorSubdivisions === 0) continue; // coincides with a major gridline
    yMinorTicks.push(valueToY(i * minorStep));
  }

  return {
    bars,
    xTicks,
    yTicks,
    yMinorTicks,
    width: WIDTH,
    height: HEIGHT,
    plotTop: PLOT_TOP,
    plotLeft: MARGIN_LEFT,
    plotRight: WIDTH - MARGIN_RIGHT,
    axisY: AXIS_Y,
    tickTop: TICK_TOP,
    tickBottom: TICK_BOTTOM,
    labelY: LABEL_Y,
    minYear,
    maxYear,
    maxCount,
    total: years.length,
    average,
    busiestYear
  };
}
