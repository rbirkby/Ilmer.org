export function initImageLightbox(options = {}) {
  const {
    triggerSelector = '.timeline-image-link',
    lightboxId = 'image-lightbox',
    imageId = 'lightbox-image',
    captionId = 'lightbox-caption',
    imageAttr = 'data-full-image',
    captionAttr = 'data-caption'
  } = options;

  const lightbox = document.getElementById(lightboxId);
  const lightboxImage = document.getElementById(imageId);
  const lightboxCaption = document.getElementById(captionId);

  if (!lightbox || !lightboxImage || !lightboxCaption) {
    return () => {};
  }

  let lastTrigger = null;

  const onClick = (event) => {
    const trigger = event.target.closest(triggerSelector);
    if (!trigger) {
      return;
    }

    event.preventDefault();

    const fullImageSrc = trigger.getAttribute(imageAttr) || trigger.getAttribute('href');
    if (!fullImageSrc) {
      return;
    }

    const childImage = trigger.querySelector('img');
    const caption = trigger.getAttribute(captionAttr) || childImage?.getAttribute('alt') || '';

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

  return () => {
    document.removeEventListener('click', onClick);
    lightbox.removeEventListener('toggle', onToggle);
  };
}
