import { DateUtils } from './anniversary-dates.js';

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function categoryClass(category) {
  return (category || '').toLowerCase().replace(/[^a-z]+/g, '-');
}

function buildEventRow(match) {
  const item = document.createElement('li');
  item.className = 'weekly-news-event';

  const badge = document.createElement('span');
  badge.className = `weekly-news-event__badge weekly-news-event__badge--${categoryClass(match.category)}`;
  badge.textContent = match.category;

  const link = document.createElement('a');
  link.className = 'weekly-news-event__title';
  link.href = match.url || '#';
  link.textContent = match.title;

  const year = document.createElement('span');
  year.className = 'weekly-news-event__year';
  year.textContent = match.year;

  const divider = document.createElement('span');
  divider.className = 'weekly-news-event__divider';
  divider.setAttribute('aria-hidden', 'true');
  divider.textContent = '|';

  const ago = document.createElement('span');
  ago.className = 'weekly-news-event__ago';
  ago.textContent = `${match.yearsAgo} year${match.yearsAgo === 1 ? '' : 's'} ago`;

  item.append(badge, link, year, divider, ago);
  return item;
}

function buildDayGroup(daysDiff, dayDate, matches) {
  const group = document.createElement('div');
  group.className = 'weekly-news-day';

  const relative = document.createElement('span');
  relative.className = 'weekly-news-day__relative';
  relative.textContent = daysDiff === 0 ? 'Today' : daysDiff === 1 ? 'Tomorrow' : WEEKDAY_LABELS[dayDate.getDay()];

  const num = document.createElement('span');
  num.className = 'weekly-news-day__num';
  num.textContent = String(dayDate.getDate());

  const month = document.createElement('span');
  month.className = 'weekly-news-day__month';
  month.textContent = MONTH_LABELS[dayDate.getMonth()];

  const label = document.createElement('div');
  label.className = 'weekly-news-day__label';
  label.append(relative, num, month);

  const marker = document.createElement('div');
  marker.className = 'weekly-news-day__marker';

  const list = document.createElement('ul');
  list.className = 'weekly-news-day__events';
  for (const match of matches) list.append(buildEventRow(match));

  group.append(label, marker, list);
  return group;
}

/** Renders the "on this day" list for one `[data-weekly-news]` container, grouped by day, into archive-styled markup. */
function renderWeeklyNews(container) {
  const eventsScript = container.querySelector('script[data-events]');
  const lookAheadDays = Number(container.dataset.lookAheadDays) || 7;
  if (!eventsScript) return;

  let events = [];
  try {
    events = JSON.parse(eventsScript.textContent);
  } catch (error) {
    console.error('Failed to parse weekly news events:', error);
    return;
  }

  const dateUtils = new DateUtils();
  const now = new Date();
  const currentYear = now.getFullYear();
  const todayDayOfYear = dateUtils.getDayOfYear(now.getDate(), now.getMonth() + 1, currentYear);

  const byDaysDiff = new Map();
  for (const event of events) {
    const parsed = dateUtils.parseEventDate(event.date);
    if (!parsed || parsed.year >= currentYear) continue;

    const eventDayOfYear = dateUtils.getDayOfYear(parsed.day, parsed.month, currentYear);
    let daysDiff = eventDayOfYear - todayDayOfYear;
    if (daysDiff < 0) daysDiff += dateUtils.daysInYear(currentYear);
    if (daysDiff > lookAheadDays) continue;

    if (!byDaysDiff.has(daysDiff)) byDaysDiff.set(daysDiff, []);
    byDaysDiff.get(daysDiff).push({
      year: parsed.year,
      yearsAgo: currentYear - parsed.year,
      title: event.title,
      url: event.url,
      category: event.category
    });
  }

  if (byDaysDiff.size === 0) {
    const empty = document.createElement('p');
    empty.textContent = `No historical anniversaries found for the next ${lookAheadDays} days. Check back later!`;
    container.replaceChildren(empty);
    return;
  }

  const section = document.createElement('div');
  section.className = 'weekly-news';
  for (const daysDiff of [...byDaysDiff.keys()].sort((a, b) => a - b)) {
    const matches = byDaysDiff.get(daysDiff);
    const dayDate = new Date(now);
    dayDate.setDate(dayDate.getDate() + daysDiff);
    section.append(buildDayGroup(daysDiff, dayDate, matches));
  }
  container.replaceChildren(section);
}

document.querySelectorAll('[data-weekly-news]').forEach(renderWeeklyNews);
