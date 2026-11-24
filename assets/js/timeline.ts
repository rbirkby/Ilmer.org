import { initImageLightbox } from './image-lightbox.ts';

const filter = document.getElementById('timeline-filter') as HTMLSelectElement;
filter.addEventListener('change', function () {
  const category = this.value;
  document.querySelectorAll<HTMLElement>('.timeline-item').forEach((item) => {
    const categories = JSON.parse(item.getAttribute('data-categories') || '[]') as string[];
    item.classList.toggle('hidden', category !== '' && !categories.includes(category));
  });
});

// A linked event hidden by the category filter can't be scrolled to, so clear the filter first.
function revealTarget() {
  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target?.classList.contains('hidden')) {
    filter.value = '';
    filter.dispatchEvent(new Event('change'));
    target.scrollIntoView();
  }
}
addEventListener('hashchange', revealTarget);
revealTarget();

document.getElementById('scroll-to-top')?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.querySelectorAll<HTMLElement>('.date[data-regnal-date]').forEach((date) => {
  const calendarDate = date.textContent;
  const regnalDate = date.dataset.regnalDate;

  date.setAttribute('role', 'button');
  date.tabIndex = 0;
  date.setAttribute('aria-label', `${calendarDate}: show regnal year`);

  function toggleDate() {
    const showRegnal = date.textContent === calendarDate;
    date.textContent = showRegnal ? regnalDate || '' : calendarDate;
    date.setAttribute('aria-label', `${date.textContent}: show ${showRegnal ? 'calendar date' : 'regnal year'}`);
  }
  date.addEventListener('click', toggleDate);
  date.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleDate();
    }
  });
});

initImageLightbox({ triggerSelector: '.timeline-image-link' });
