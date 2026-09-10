function ageInYears(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const age = value.trim().toLowerCase();
  if (/^\d+$/.test(age)) return Number(age);
  if (
    !/^\d+\s+(?:years?|yrs?|quarters?|months?|weeks?|days?)(?:(?:\s+&\s+|\s+)\d+\s+(?:years?|yrs?|quarters?|months?|weeks?|days?))*$/.test(
      age
    )
  ) {
    return null;
  }

  let years = 0;
  for (const match of age.matchAll(/(\d+)\s+(years?|yrs?|quarters?|months?|weeks?|days?)/g)) {
    const amount = Number(match[1]);
    const unit = match[2];
    if (unit.startsWith('y')) years += amount;
    else if (unit.startsWith('quarter')) years += amount / 4;
    else if (unit.startsWith('month')) years += amount / 12;
    else if (unit.startsWith('week')) years += (amount * 7) / 365.25;
    else years += amount / 365.25;
  }
  return years;
}

export function medianAge(
  records: Array<Record<string, unknown>>,
  ageKey: string
): { median: number; count: number } | null {
  const ages = records
    .map((record) => ageInYears(record[ageKey]))
    .filter((age): age is number => age !== null)
    .sort((first, second) => first - second);
  if (ages.length === 0) return null;

  const middle = Math.floor(ages.length / 2);
  const median = ages.length % 2 === 0 ? (ages[middle - 1] + ages[middle]) / 2 : ages[middle];
  return { median: Math.round(median * 10) / 10, count: ages.length };
}
