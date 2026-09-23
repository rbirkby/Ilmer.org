export function initImageLightbox({ triggerSelector = '.timeline-image-link' } = {}) {
  const lightbox = document.getElementById('image-lightbox');
  const lightboxImage = document.getElementById('lightbox-image');
  const lightboxCaption = document.getElementById('lightbox-caption');

  if (!lightbox || !lightboxImage || !lightboxCaption) {
    return;
  }

  let lastTrigger = null;

  const onClick = (event) => {
    const trigger = event.target.closest(triggerSelector);
    if (!trigger) {
      return;
    }

    event.preventDefault();

    const childImage = trigger.querySelector('img');
    const fullImageSrc =
      (childImage?.closest('.is-colorized') && childImage.getAttribute('src')) ||
      trigger.getAttribute('data-full-image') ||
      trigger.getAttribute('href');
    if (!fullImageSrc) {
      return;
    }

    const caption = trigger.getAttribute('data-caption') || childImage?.getAttribute('alt') || '';

    lightboxImage.src = fullImageSrc;
    lightboxImage.alt = caption;
    lightboxCaption.textContent = caption;

    lastTrigger = trigger;

    if (typeof lightbox.showPopover === 'function') {
      lightbox.showPopover();
    }
  };

  const onToggle = (event) => {
    if (event.newState !== 'closed' || !lastTrigger) {
      return;
    }

    if (typeof lastTrigger.focus === 'function') {
      lastTrigger.focus();
    }

    lastTrigger = null;
  };

  document.addEventListener('click', onClick);
  lightbox.addEventListener('toggle', onToggle);
}
