import path from 'node:path';
import { fileURLToPath } from 'node:url';
import markdownItFootnote from 'markdown-it-footnote';
import { RenderPlugin } from '@11ty/eleventy';
import markdownIt from 'markdown-it';
import MarkdownItGitHubAlerts from 'markdown-it-github-alerts';
import markdownItMarginNotes from './plugins/markdown-it-margin-notes.js';
import { createCacheBustFilter } from './plugins/cache-bust.js';
import { censusOccupations } from './plugins/census-occupations.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy('images');
  eleventyConfig.addPassthroughCopy('assets');
  eleventyConfig.addPassthroughCopy('favicon.ico');
  eleventyConfig.addPassthroughCopy({
    'node_modules/markdown-it-github-alerts/styles/*.css': 'assets/css'
  });
  eleventyConfig.addPassthroughCopy('robots.txt');
  eleventyConfig.addWatchTarget('assets/css/');
  eleventyConfig.addWatchTarget('assets/js/');

  eleventyConfig.amendLibrary('md', (mdLib) => mdLib.use(markdownItFootnote));
  eleventyConfig.amendLibrary('md', (mdLib) => mdLib.use(markdownItMarginNotes));
  eleventyConfig.addPlugin(RenderPlugin);

  const mdIt = markdownIt({ html: true, linkify: true }).disable('code');
  const inline = (content) => mdIt.renderInline(content);
  eleventyConfig.addFilter('renderMarkdownInline', inline);

  eleventyConfig.addFilter('jsonStringify', JSON.stringify);
  /** Counts people per occupation from a census HTML table. */
  eleventyConfig.addFilter('censusOccupations', censusOccupations);
  /**
   * Sorts a collection so items whose `url` appears in `urls` come first,
   * in that list's order. Remaining items keep their date order.
   */
  eleventyConfig.addFilter('sortByUrlOrder', (collection, urls) => {
    const order = new Map((urls || []).map((url, i) => [url, i]));
    return [...(collection || [])].sort((a, b) => {
      const rank = (item) => (order.has(item.url) ? order.get(item.url) : Number.POSITIVE_INFINITY);
      const diff = rank(a) - rank(b);
      if (diff !== 0) return diff;
      return a.date - b.date;
    });
  });
  /** Content-hash query string for local CSS/JS so browsers fetch a new copy when the file changes. */
  const cacheBust = createCacheBustFilter(ROOT);
  eleventyConfig.addFilter('cacheBust', cacheBust);
  eleventyConfig.on('eleventy.before', () => cacheBust.clearCache());
  /** Root-relative site path: strips leading slashes; leaves absolute http(s) URLs unchanged. */
  eleventyConfig.addFilter('sitePath', (value) => {
    if (value == null || value === '') return '';
    const path = String(value);
    if (/^https?:\/\//i.test(path)) return path;
    return `/${path.replace(/^\/+/, '')}`;
  });
  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /**
   * Formats a `YYYY-MM-DD` string as "D Mon YYYY" by parsing the digits
   * directly, without ever constructing a JS Date. Dates before 1847 pick up
   * a historical Local Mean Time offset from the host's tz database when
   * formatted via Date getters, which can shift them onto the wrong day.
   */
  eleventyConfig.addFilter('isoDateLabel', (iso) => {
    const [, y, m, d] = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) ?? [];
    if (!y) return iso;
    return `${Number(d)} ${MONTH_LABELS[Number(m) - 1]} ${y}`;
  });

  eleventyConfig.addFilter('isoDateYear', (iso) => /^(\d{4})-/.exec(iso)?.[1] ?? iso);

  /** Sparkline geometry for a collection of items with `data.date` (ISO string) and `data.population`. */
  eleventyConfig.addFilter('censusChart', (collection) => {
    const items = [...collection].sort((a, b) => a.data.date.localeCompare(b.data.date));
    const populations = items.map((item) => item.data.population);
    const minPop = Math.min(...populations);
    const maxPop = Math.max(...populations);
    const popRange = maxPop - minPop || 1;

    const width = 300;
    const plotLeft = 14;
    const plotRight = width - 14;
    const plotTop = 22;
    const plotBottom = 62;
    const tickTop = plotBottom + 10;
    const tickBottom = tickTop + 8;
    const labelY = tickBottom + 12;
    const height = labelY + 6;

    const step = items.length > 1 ? (plotRight - plotLeft) / (items.length - 1) : 0;
    const points = items.map((item, index) => {
      const x = plotLeft + step * index;
      const y = plotBottom - ((item.data.population - minPop) / popRange) * (plotBottom - plotTop);
      return {
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        population: item.data.population,
        year: item.data.date.slice(0, 4)
      };
    });

    return {
      points,
      linePoints: points.map((p) => `${p.x},${p.y}`).join(' '),
      tickTop,
      tickBottom,
      labelY,
      width,
      height,
      count: items.length,
      firstYear: points[0]?.year,
      lastYear: points[points.length - 1]?.year
    };
  });

  eleventyConfig.addFilter('uniqueLabels', (events) =>
    [...new Set(events.flatMap(({ labels }) => labels))]
      .map((label) => ({
        label,
        count: events.filter((event) => event.labels.includes(label)).length
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  );

  /** Groups a date-sorted collection into decades of years, each with its dated items and counts. */
  eleventyConfig.addFilter('archiveByDecade', (collection) => {
    const byYear = new Map();
    for (const item of collection) {
      const year = item.date.getFullYear();
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push(item);
    }
    const byDecade = new Map();
    for (const [year, items] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
      const decade = Math.floor(year / 10) * 10;
      if (!byDecade.has(decade)) byDecade.set(decade, []);
      byDecade.get(decade).push({
        year,
        count: items.length,
        items: items.map((i) => ({ url: i.url, date: i.date, title: i.data.title }))
      });
    }
    return [...byDecade.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([decade, years]) => ({
        decade,
        years,
        totalCount: years.reduce((sum, y) => sum + y.count, 0)
      }));
  });

  /** Subject tags used across a collection (excluding the base collection tag), most-used first. */
  eleventyConfig.addFilter('archiveSubjectTags', (collection, baseTag) => {
    const counts = new Map();
    for (const item of collection) {
      for (const t of item.data.tags || []) {
        if (t === baseTag) continue;
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  });

  const SUBJECT_ICONS = {
    railway:
      '<path d="M6 4h12a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2Z"/><path d="M4 18l-2 3M20 18l2 3"/><path d="M6 10h12M9 15h.01M15 15h.01"/>',
    'roads-traffic': '<path d="M8 3 4 21M16 3l4 18M10 9h4M9 15h6"/>',
    schools: '<path d="M3 9 12 4l9 5-9 5-9-5Z"/><path d="M6 11.5V17c0 1 2.5 2.5 6 2.5s6-1.5 6-2.5v-5.5M20 9v6"/>',
    wartime: '<path d="M12 3c2.5 1.5 5 2 7 2v6c0 5-3 8-7 10-4-2-7-5-7-10V5c2 0 4.5-.5 7-2Z"/>',
    footpaths: '<path d="M6 20 10 4M18 20 14 4M6 8h4M15 8h3M5 16h4M15 16h4"/>',
    finance:
      '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c0-1-1.3-1.8-3-1.8s-3 .8-3 1.8 1.3 1.6 3 1.8 3 .8 3 1.9-1.3 1.8-3 1.8-3-.8-3-1.8M12 6.5v11"/>',
    housing: '<path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-6h4v6"/>',
    elections: '<path d="M5 5h14v14H5z"/><path d="m8 12 3 3 5-6"/>',
    commemorations:
      '<path d="M12 3v11"/><path d="M12 3 5 6.5 12 10l7-3.5L12 3Z"/><path d="M7 13v3c0 1.7 2.2 3 5 3s5-1.3 5-3v-3"/>',
    charities: '<path d="M12 20s-7-4.4-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5C19 15.6 12 20 12 20Z"/>',
    utilities: '<path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z"/>',
    'playing-field': '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    environment: '<path d="M12 3c4 3 7 6 7 10a7 7 0 0 1-14 0c0-4 3-7 7-10Z"/>',
    administration: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 13h6M9 16h4"/>',
    policing:
      '<path d="M12 3c2.5 1.5 5 2 7 2v6c0 5-3 8-7 10-4-2-7-5-7-10V5c2 0 4.5-.5 7-2Z"/><path d="m9.5 12 2 2 3.5-4"/>',
    youth:
      '<circle cx="8.5" cy="8" r="2.5"/><circle cx="16" cy="9" r="2"/><path d="M3.5 19v-1.5A3.5 3.5 0 0 1 7 14h3a3.5 3.5 0 0 1 3.5 3.5V19M13.5 14.3A3 3 0 0 1 19 16.5V19"/>',
    'village-hall': '<path d="M4 10 12 4l8 6"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
    'burial-ground': '<path d="M12 3v18M8 7h8"/>',
    planning: '<path d="M4 4h13l3 3v13H4z"/><path d="M17 4v3h3M8 12h8M8 16h5"/>'
  };
  const DEFAULT_SUBJECT_ICON = '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>';
  /** Inline SVG for a subject tag, falling back to a generic marker for unmapped tags. */
  eleventyConfig.addFilter('subjectIcon', (tag) => {
    const paths = SUBJECT_ICONS[tag] || DEFAULT_SUBJECT_ICON;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  });

  eleventyConfig.addFilter('subjectLabel', (tag) => (tag || '').replace(/-/g, ' '));

  eleventyConfig.amendLibrary('md', (mdLib) => mdLib.use(MarkdownItGitHubAlerts));

  eleventyConfig.addGlobalData('eleventyComputed', {
    ancestorCrumb1: (data) => (data.hideAncestorCrumb1 ? undefined : data.ancestorCrumb1Source),
    ancestorCrumb2: (data) => (data.hideAncestorCrumb2 ? undefined : data.ancestorCrumb2Source)
  });

  eleventyConfig.addCollection('parishCouncilSubjects', (collectionApi) => {
    const items = collectionApi.getFilteredByTag('minutes');
    const byTag = new Map();
    for (const item of items) {
      for (const t of item.data.tags || []) {
        if (t === 'minutes') continue;
        if (!byTag.has(t)) byTag.set(t, []);
        byTag.get(t).push(item);
      }
    }
    return [...byTag.entries()].map(([tag, tagItems]) => ({ tag, items: tagItems, count: tagItems.length }));
  });

  eleventyConfig.addCollection('parishMeetingSubjects', (collectionApi) => {
    const items = collectionApi.getFilteredByTag('parishmeetings');
    const byTag = new Map();
    for (const item of items) {
      for (const t of item.data.tags || []) {
        if (t === 'parishmeetings') continue;
        if (!byTag.has(t)) byTag.set(t, []);
        byTag.get(t).push(item);
      }
    }
    return [...byTag.entries()].map(([tag, tagItems]) => ({ tag, items: tagItems, count: tagItems.length }));
  });

  /** The chronologically previous/next item in a date-sorted collection, relative to `url`. */
  eleventyConfig.addFilter('adjacentItem', (collection, url) => {
    const index = collection.findIndex((item) => item.url === url);
    if (index === -1) return { previous: null, next: null };
    const previous = index > 0 ? collection[index - 1] : null;
    const next = index < collection.length - 1 ? collection[index + 1] : null;
    return {
      previous: previous ? { url: previous.url, date: previous.date } : null,
      next: next ? { url: next.url, date: next.date } : null
    };
  });
}
