export class DateUtils {
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

  isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  daysInYear(year) {
    return this.isLeapYear(year) ? 366 : 365;
  }

  getDayOfYear(day, month, year) {
    const date = Date.UTC(year, month - 1, day);
    const start = Date.UTC(year, 0, 0);
    return (date - start) / (1000 * 60 * 60 * 24);
  }

  getRelativeDateString(daysDiff, referenceDate) {
    if (daysDiff === 0) return 'Today';
    if (daysDiff === 1) return 'Tomorrow';

    const futureDate = new Date(referenceDate);
    futureDate.setDate(futureDate.getDate() + daysDiff);
    if (daysDiff <= 7) {
      return `This ${futureDate.toLocaleDateString('en-US', { weekday: 'long' })}`;
    }

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

    if (!(eventMonth > 0 && eventYear > 0)) return null;

    const monthLengths = [31, this.isLeapYear(eventYear) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (!(eventDay >= 1 && eventDay <= monthLengths[eventMonth - 1])) return null;

    return { day: eventDay, month: eventMonth, year: eventYear };
  }
}
