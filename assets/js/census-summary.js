const section = document.querySelector('.census-summary');
if (section) {
  const agesHeading = document.getElementById('census-ages-heading');
  const occupationsHeading = document.getElementById('census-occupations-heading');

  const showingOccupations = () => location.hash === '#census-occupations';

  const sync = () => {
    const hash = location.hash;
    if (hash !== '' && hash !== '#census-ages' && hash !== '#census-occupations') return;
    const occupations = hash === '#census-occupations';
    section.classList.toggle('is-occupations', occupations);
    section.classList.toggle('is-ages', !occupations);
  };

  const focusHeading = () => {
    const heading = showingOccupations() ? occupationsHeading : agesHeading;
    heading?.focus({ preventScroll: true });
  };

  // The hash is what selects the view, but following it would scroll the card
  // to the top. Remember the scroll position and put it back after the
  // browser's own fragment scroll.
  const stampScroll = () => {
    const state = history.state && typeof history.state === 'object' ? history.state : {};
    history.replaceState({ ...state, censusSummaryScroll: window.scrollY }, '');
  };

  const restoreScroll = (state) => {
    const y = state && typeof state.censusSummaryScroll === 'number' ? state.censusSummaryScroll : null;
    if (y === null) return;
    window.scrollTo(0, y);
  };

  section.addEventListener('click', (event) => {
    const target = event.target;
    const link = target instanceof Element ? target.closest('a') : null;
    if (!link || !section.contains(link)) return;
    const href = link.getAttribute('href');
    if (href !== '#census-ages' && href !== '#census-occupations') return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (location.hash !== href) {
      stampScroll();
      const state = history.state && typeof history.state === 'object' ? history.state : {};
      history.pushState({ ...state }, '', href);
    }
    sync();
    focusHeading();
  });

  window.addEventListener('popstate', (event) => {
    sync();
    restoreScroll(event.state);
    focusHeading();
    requestAnimationFrame(() => {
      restoreScroll(event.state);
      focusHeading();
    });
  });

  sync();
}
