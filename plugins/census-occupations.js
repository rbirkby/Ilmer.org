/**
 * Counts people in each occupation from a rendered census HTML table.
 * Empty occupation cells (children, blank separator rows) are omitted.
 */

const ENTITY_MAP = {
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

function decodeEntities(value) {
  return value.replace(/&(?:amp|lt|gt|quot|apos|nbsp|rsquo|lsquo|#39);/g, (entity) => ENTITY_MAP[entity] ?? entity);
}

function stripCell(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function occupationsFromTable(tableHtml) {
  const headers = [...tableHtml.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((match) => stripCell(match[1]));
  const occIndex = headers.findIndex((header) => /^occupation$/i.test(header));
  if (occIndex === -1) return [];

  const counts = new Map();
  for (const row of tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    if (/<th\b/i.test(row[1])) continue;
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripCell(match[1]));
    const occupation = cells[occIndex];
    if (!occupation) continue;
    counts.set(occupation, (counts.get(occupation) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([occupation, count]) => ({ occupation, count }))
    .sort((a, b) => b.count - a.count || a.occupation.localeCompare(b.occupation));
}

export function censusOccupations(html) {
  if (!html) return [];
  const tables = String(html).match(/<table\b[\s\S]*?<\/table>/gi) || [];
  for (const table of tables) {
    const rows = occupationsFromTable(table);
    if (rows.length > 0) return rows;
  }
  return [];
}
