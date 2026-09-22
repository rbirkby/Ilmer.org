import {
  LitElement,
  html
} from 'https://cdn.skypack.dev/pin/lit@v3.3.1-mozE5P6MGQybGvSM4ae5/mode=imports,min/optimized/lit.js';
import { DateUtils } from './anniversary-dates.js';

// Anniversary Web Component using LitElement
class TimelineAnniversary extends LitElement {
  static properties = {
    title: { type: String },
    year: { type: String },
    yearsAgo: { type: Number, attribute: 'years-ago' },
    target: { type: String }
  };

  createRenderRoot() {
    // Return this instead of creating shadow root to allow global CSS
    return this;
  }

  render() {
    const ago = this.yearsAgo === 1 ? '1 year ago' : `${this.yearsAgo} years ago`;
    return html`
      <a href="#${this.target}" class="anniversary-entry">
        <span class="anniversary-title">${this.title ?? ''}</span>
        <span class="anniversary-meta">${this.year}, ${ago}</span>
      </a>
    `;
  }
}

// Timeline Anniversaries Web Component using LitElement
class TimelineAnniversaries extends LitElement {
  static properties = {
    maxAnniversaries: { type: Number, attribute: 'max-anniversaries' },
    lookAheadDays: { type: Number, attribute: 'look-ahead-days' },
    events: { type: Array, state: true },
    anniversaries: { type: Array, state: true }
  };

  createRenderRoot() {
    // Return this instead of creating shadow root to allow global CSS
    return this;
  }

  constructor() {
    super();
    this.dateUtils = new DateUtils();
    this.now = new Date();
    this.currentDay = this.now.getDate();
    this.currentMonth = this.now.getMonth() + 1;
    this.currentYear = this.now.getFullYear();
    this.events = [];
    this.anniversaries = [];
    this.maxAnniversaries = this.maxAnniversaries ?? 9;
    this.lookAheadDays = this.lookAheadDays ?? 14;
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadEvents();
    this.calculateAndSetAnniversaries();
  }

  loadEvents() {
    const eventsScript = this.querySelector('script[data-events]');
    if (eventsScript) {
      try {
        this.events = JSON.parse(eventsScript.textContent).map((event) => ({
          id: event.id,
          date: event.date,
          title: event.title
        }));
      } catch (error) {
        console.error('Failed to parse events data:', error);
        this.events = [];
      }
    }
  }

  calculateAndSetAnniversaries() {
    const anniversaries = [];
    const todayDayOfYear = this.dateUtils.getDayOfYear(this.currentDay, this.currentMonth, this.currentYear);

    this.events.forEach((event) => {
      const parsedDate = this.dateUtils.parseEventDate(event.date);
      if (!parsedDate || parsedDate.year >= this.currentYear) return;

      const eventDayOfYear = this.dateUtils.getDayOfYear(parsedDate.day, parsedDate.month, this.currentYear);
      let daysDiff = eventDayOfYear - todayDayOfYear;

      // Handle year wrap around (use days in the current year, including leap days)
      if (daysDiff < 0) {
        daysDiff += this.dateUtils.daysInYear(this.currentYear);
      }

      // Include if it's within the look-ahead period
      if (daysDiff <= this.lookAheadDays) {
        const yearsAgo = this.currentYear - parsedDate.year;

        anniversaries.push({
          daysDiff,
          year: parsedDate.year,
          yearsAgo,
          id: event.id,
          title: event.title
        });
      }
    });

    // Sort by days from today and limit results
    this.anniversaries = anniversaries.toSorted((a, b) => a.daysDiff - b.daysDiff).slice(0, this.maxAnniversaries);
  }

  // Anniversaries sharing a day are shown together under one date
  groupByDay() {
    const groups = new Map();
    for (const anniversary of this.anniversaries) {
      if (!groups.has(anniversary.daysDiff)) groups.set(anniversary.daysDiff, []);
      groups.get(anniversary.daysDiff).push(anniversary);
    }
    return [...groups].map(([daysDiff, items]) => {
      const date = new Date(this.now);
      date.setDate(date.getDate() + daysDiff);
      return { daysDiff, date, items };
    });
  }

  // Local calendar date; toISOString() would shift to UTC and can land on the wrong day
  isoDate(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  weekdayLabel(daysDiff, date) {
    if (daysDiff === 0) return 'Today';
    if (daysDiff === 1) return 'Tomorrow';
    return date.toLocaleDateString('en-GB', { weekday: 'long' });
  }

  render() {
    return html`
      <section id="anniversaries-container" class="anniversaries-container" aria-labelledby="anniversaries-heading">
        <h2 id="anniversaries-heading" class="anniversaries-heading">On these days in Ilmer</h2>
        <p class="anniversaries-intro">Anniversaries from the timeline over the next two weeks.</p>
        ${
          this.anniversaries.length === 0
            ? html`<p class="no-anniversaries">No anniversaries fall in the next two weeks.</p>`
            : html`
                <ol class="anniversary-days">
                  ${this.groupByDay().map(
                    ({ daysDiff, date, items }) => html`
                      <li class="anniversary-day${daysDiff === 0 ? ' is-today' : ''}">
                        <time class="anniversary-when" datetime="${this.isoDate(date)}">
                          <span class="anniversary-day-number">${date.getDate()}</span>
                          <span class="anniversary-month">${date.toLocaleDateString('en-GB', { month: 'short' })}</span>
                          <span class="anniversary-weekday">${this.weekdayLabel(daysDiff, date)}</span>
                        </time>
                        <ul class="anniversary-entries">
                          ${items.map(
                            (anniversary) => html`
                              <li>
                                <timeline-anniversary
                                  title="${anniversary.title}"
                                  year="${anniversary.year}"
                                  years-ago="${anniversary.yearsAgo}"
                                  target="${anniversary.id}"
                                ></timeline-anniversary>
                              </li>
                            `
                          )}
                        </ul>
                      </li>
                    `
                  )}
                </ol>
              `
        }
      </section>
      <slot></slot>
    `;
  }
}

// Register the web components
customElements.define('timeline-anniversary', TimelineAnniversary);
customElements.define('timeline-anniversaries', TimelineAnniversaries);
