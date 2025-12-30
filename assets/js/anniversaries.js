import {
  LitElement,
  html
} from 'https://cdn.skypack.dev/pin/lit@v3.3.1-mozE5P6MGQybGvSM4ae5/mode=imports,min/optimized/lit.js';

// Date utility class for handling date calculations and formatting
class DateUtils {
  constructor() {
    this.monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ];
    this.monthAbbrs = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    this.monthMap = {
      Jan: 1,
      Feb: 2,
      Mar: 3,
      Apr: 4,
      May: 5,
      Jun: 6,
      Jul: 7,
      Aug: 8,
      Sep: 9,
      Oct: 10,
      Nov: 11,
      Dec: 12
    };
  }

  getDayOfYear(day, month, year) {
    const date = new Date(year, month - 1, day);
    const start = new Date(year, 0, 0);
    const diff = date - start;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  getRelativeDateString(daysDiff, referenceDate) {
    if (daysDiff === 0) return 'Today';
    if (daysDiff === 1) return 'Tomorrow';
    if (daysDiff <= 7) {
      const futureDate = new Date(referenceDate.getTime() + daysDiff * 24 * 60 * 60 * 1000);
      return `This ${futureDate.toLocaleDateString('en-US', { weekday: 'long' })}`;
    }

    const futureDate = new Date(referenceDate.getTime() + daysDiff * 24 * 60 * 60 * 1000);
    return futureDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  }

  parseEventDate(dateString) {
    const dateParts = dateString.split(' ');
    if (dateParts.length < 3) return null;

    const eventDay = parseInt(dateParts[0]);
    const eventMonthStr = dateParts[1];
    const eventYear = parseInt(dateParts[2]);

    const monthAbbr = Object.keys(this.monthMap).find((abbr) => eventMonthStr.includes(abbr));
    const eventMonth = monthAbbr ? this.monthMap[monthAbbr] : 0;

    return eventMonth > 0 && eventYear > 0 ? { day: eventDay, month: eventMonth, year: eventYear } : null;
  }
}

// Anniversary Web Component using LitElement
class TimelineAnniversary extends LitElement {
  static properties = {
    relativeDate: { type: String, attribute: 'relative-date' },
    title: { type: String },
    yearsAgo: { type: String, attribute: 'years-ago' },
    originalDate: { type: String, attribute: 'original-date' }
  };

  createRenderRoot() {
    // Return this instead of creating shadow root to allow global CSS
    return this;
  }

  render() {
    return html`
      <a
        href="#${this.originalDate ?? ''}"
        class="anniversary-tile"
        data-date="${this.originalDate ?? ''}"
        @click="${this._handleClick}"
      >
        <div class="anniversary-date-label">${this.relativeDate ?? ''}</div>
        <div class="anniversary-title">${this.title ?? ''}</div>
        <div class="anniversary-meta">${this.yearsAgo ?? ''} years ago (${this.originalDate ?? ''})</div>
      </a>
    `;
  }

  _handleClick(event) {
    event.preventDefault(); // Prevent default anchor navigation
    const eventDate = this.originalDate;
    if (eventDate) {
      TimelineAnniversary.scrollToTimelineEvent(eventDate);
    }
  }

  static scrollToTimelineEvent(eventDate) {
    const timelineItems = document.querySelectorAll('.timeline-item');

    // Find the timeline item with matching date
    const targetElement = Array.from(timelineItems).find((item) => {
      const dateSpan = item.querySelector('.date');
      return dateSpan && dateSpan.textContent.trim() === eventDate;
    });

    if (targetElement) {
      // Smooth scroll to the element
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      // Add a temporary highlight effect
      targetElement.style.transition = 'background-color 0.3s ease';
      targetElement.style.backgroundColor = 'var(--timeline-card-border)';
      setTimeout(() => {
        targetElement.style.backgroundColor = '';
      }, 1700);
    }
  }

  // Static method to register the component
  static register() {
    if (!customElements.get('timeline-anniversary')) {
      customElements.define('timeline-anniversary', TimelineAnniversary);
    }
  }
}

// Anniversary data model (for calculation logic)
class Anniversary {
  constructor(event, daysDiff, relativeDateStr, yearsAgo) {
    this.daysDiff = daysDiff;
    this.relativeDateStr = relativeDateStr;
    this.yearsAgo = yearsAgo;
    this.originalDate = event.date;
    this.title = event.title;
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

      // Handle year wrap around
      if (daysDiff < 0) {
        daysDiff += 365;
      }

      // Include if it's within the look-ahead period
      if (daysDiff <= this.lookAheadDays) {
        const yearsAgo = this.currentYear - parsedDate.year;
        const relativeDateStr = this.dateUtils.getRelativeDateString(daysDiff, this.now);

        anniversaries.push(new Anniversary(event, daysDiff, relativeDateStr, yearsAgo));
      }
    });

    // Sort by days from today and limit results
    this.anniversaries = anniversaries.toSorted((a, b) => a.daysDiff - b.daysDiff).slice(0, this.maxAnniversaries);
  }

  render() {
    const currentMonthName = this.dateUtils.monthNames[this.currentMonth - 1];

    return html`
      <div id="anniversaries-container" class="anniversaries-container">
        <h2 class="anniversaries-heading">🕐 Upcoming Anniversaries</h2>
        <p class="anniversaries-date-intro">
          Today is ${currentMonthName} ${this.currentDay}, ${this.currentYear}. Here are the upcoming historical
          anniversaries:
        </p>
        <div class="anniversaries-list">
          ${this.anniversaries.length === 0
            ? html`<p class="no-anniversaries">
                No historical anniversaries found for the next 2 weeks. Check back later!
              </p>`
            : html`
                <div class="anniversary-grid">
                  ${this.anniversaries.map(
                    (anniversary) => html`
                      <timeline-anniversary
                        relative-date="${anniversary.relativeDateStr}"
                        title="${anniversary.title}"
                        years-ago="${anniversary.yearsAgo}"
                        original-date="${anniversary.originalDate}"
                      >
                      </timeline-anniversary>
                    `
                  )}
                </div>
              `}
        </div>
      </div>
      <slot></slot>
    `;
  }

  // Static method to register the component
  static register() {
    if (!customElements.get('timeline-anniversaries')) {
      customElements.define('timeline-anniversaries', TimelineAnniversaries);
    }
  }
}

// Register the web components
TimelineAnniversary.register();
TimelineAnniversaries.register();
