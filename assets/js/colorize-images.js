import '/assets/js/ai-colorize-toggle.js';
import { initImageLightbox } from '/assets/js/image-lightbox.js';

const COLORIZE_WORKER_URL = '/assets/js/colorize-worker.js';

let workerRequestId = 0;
let colorizeWorker;
const workerRequests = new Map();
const imageState = new WeakMap();
const progressAnimations = new WeakMap();

function parseImageTags(img) {
  const src = img.getAttribute('src') ?? '';
  const hashIndex = src.indexOf('#');

  if (hashIndex === -1) {
    return [];
  }

  return src
    .slice(hashIndex + 1)
    .split(',')
    .map((tag) => decodeURIComponent(tag).trim().toLowerCase())
    .filter(Boolean);
}

function stripHashFromImageSrc(src) {
  const value = src ?? '';
  const hashIndex = value.indexOf('#');

  if (hashIndex === -1) {
    return value;
  }

  return value.slice(0, hashIndex);
}

function setButtonProgress(button, progress) {
  const safeProgress = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
  const targetProgress = safeProgress > 0 && safeProgress < 12 ? 12 : safeProgress;
  const previous = progressAnimations.get(button) ?? {
    value: Number(button.dataset.progress ?? '0'),
    frameId: 0
  };

  if (previous.frameId) {
    window.cancelAnimationFrame(previous.frameId);
  }

  const startValue = previous.value;
  const startTime = performance.now();
  const duration = 220;

  const animate = (now) => {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    const nextValue = startValue + (targetProgress - startValue) * t;

    button.style.setProperty('--progress', `${nextValue}%`);
    button.dataset.progress = String(Math.round(nextValue));

    if (t < 1) {
      const frameId = window.requestAnimationFrame(animate);
      progressAnimations.set(button, { value: nextValue, frameId });
      return;
    }

    progressAnimations.set(button, { value: targetProgress, frameId: 0 });
  };

  const frameId = window.requestAnimationFrame(animate);
  progressAnimations.set(button, { value: startValue, frameId });
}

function updateButtonState(button, state, title, progress) {
  button.dataset.state = state;
  button.title = title;
  button.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');

  const defaultProgress = state === 'active' ? 100 : 0;
  setButtonProgress(button, typeof progress === 'number' ? progress : defaultProgress);
}

function waitForPaint() {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

async function ensureImageReady(img) {
  if (img.complete && img.naturalWidth > 0) {
    if (typeof img.decode === 'function') {
      await img.decode().catch(() => {});
    }
    return;
  }

  await new Promise((resolve, reject) => {
    const onLoad = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('The image could not be loaded for colorisation.'));
    };
    const cleanup = () => {
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
    };

    img.addEventListener('load', onLoad, { once: true });
    img.addEventListener('error', onError, { once: true });
  });
}

function getColorizeWorker() {
  if (!colorizeWorker) {
    colorizeWorker = new Worker(COLORIZE_WORKER_URL);

    colorizeWorker.addEventListener('message', (event) => {
      const { id, type, progress, label, blob, executionProvider, message } = event.data ?? {};
      const pendingRequest = workerRequests.get(id);

      if (!pendingRequest) {
        return;
      }

      if (type === 'progress') {
        pendingRequest.onProgress(progress, label);
        return;
      }

      workerRequests.delete(id);

      if (type === 'result') {
        pendingRequest.resolve({ blob, executionProvider });
        return;
      }

      pendingRequest.reject(new Error(message || 'AI colourisation failed.'));
    });

    colorizeWorker.addEventListener('error', (event) => {
      for (const [, pendingRequest] of workerRequests) {
        pendingRequest.reject(new Error(event.message || 'The AI worker failed.'));
      }
      workerRequests.clear();
      colorizeWorker = undefined;
    });
  }

  return colorizeWorker;
}

function requestWorkerColorization(src, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const id = `colorize-${++workerRequestId}`;

    workerRequests.set(id, {
      resolve,
      reject,
      onProgress
    });

    getColorizeWorker().postMessage({
      id,
      type: 'colorize',
      payload: { src }
    });
  });
}

async function colorizeImage(img, onProgress = () => {}) {
  await ensureImageReady(img);

  const sourceUrl = img.currentSrc || img.src || img.getAttribute('src');
  if (!sourceUrl) {
    throw new Error('The image could not be loaded for colorisation.');
  }

  const { blob } = await requestWorkerColorization(sourceUrl, onProgress);
  return URL.createObjectURL(blob);
}

async function toggleColorization(img, button, container) {
  const state = imageState.get(img);
  if (!state || state.loading) {
    return;
  }

  if (state.colorized) {
    img.src = state.originalSrc;
    state.colorized = false;
    container.classList.remove('is-colorized');
    button.setAttribute('aria-pressed', 'false');
    updateButtonState(button, 'idle', 'Show an AI-colourised version of this image');
    return;
  }

  if (state.colorizedSrc) {
    img.src = state.colorizedSrc;
    state.colorized = true;
    container.classList.add('is-colorized');
    button.setAttribute('aria-pressed', 'true');
    updateButtonState(button, 'active', 'Show the original black-and-white image');
    return;
  }

  try {
    state.loading = true;
    button.disabled = true;

    const reportProgress = (progress, label = 'AI colourising image…') => {
      const boundedProgress = Math.max(0, Math.min(100, progress));
      updateButtonState(button, 'loading', `${label} (${Math.round(boundedProgress)}%)`, boundedProgress);
    };

    reportProgress(12, 'Starting AI colourisation…');
    await waitForPaint();

    const colorizedUrl = await colorizeImage(img, reportProgress);

    reportProgress(100, 'Colour image ready');

    state.colorizedSrc = colorizedUrl;
    state.colorized = true;
    img.src = colorizedUrl;
    container.classList.add('is-colorized');
    button.setAttribute('aria-pressed', 'true');
    updateButtonState(button, 'active', 'Show the original black-and-white image', 100);
  } catch (error) {
    console.error(error);
    updateButtonState(
      button,
      'error',
      error instanceof Error ? error.message : 'AI colourisation failed. Click to try again.',
      0
    );
  } finally {
    state.loading = false;
    button.disabled = false;
  }
}

function registerColorizeButton(img, container) {
  const button = document.createElement('ai-colorize-toggle');
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', `Toggle AI colourisation for ${img.alt || 'this image'}`);

  updateButtonState(button, 'idle', 'Show an AI-colourised version of this image');
  button.addEventListener('click', () => toggleColorization(img, button, container));
  container.appendChild(button);
}

function enhanceArticleImages() {
  const articleSection = document.querySelector('section.article');
  const articleImages = document.querySelectorAll('section.article img');
  const lightboxAllEnabled = articleSection?.dataset.lightboxAll === 'true';
  let hasColorizableImages = false;

  articleImages.forEach((img) => {
    const tags = parseImageTags(img);
    const container = img.closest('p');

    if (!container) {
      return;
    }

    container.classList.add('image-frame');
    img.classList.add('article-image');

    if (tags.includes('left')) {
      container.classList.add('image-frame--left');
    }

    if (tags.includes('right')) {
      container.classList.add('image-frame--right');
    }

    if (!tags.includes('left') && !tags.includes('right')) {
      container.classList.add('image-frame--full');
    }

    const lightboxEnabledForImage = lightboxAllEnabled || tags.includes('lightbox');
    if (lightboxEnabledForImage) {
      const fullImageSrc = stripHashFromImageSrc(img.getAttribute('src') ?? img.src);
      const caption = img.alt || '';
      const linkedParent = img.closest('a');

      if (linkedParent) {
        linkedParent.classList.add('article-image-link');

        if (!linkedParent.getAttribute('href')) {
          linkedParent.setAttribute('href', fullImageSrc);
        }

        if (!linkedParent.hasAttribute('data-full-image')) {
          linkedParent.setAttribute('data-full-image', fullImageSrc);
        }

        if (!linkedParent.hasAttribute('data-caption')) {
          linkedParent.setAttribute('data-caption', caption);
        }

        if (!linkedParent.hasAttribute('aria-label')) {
          linkedParent.setAttribute('aria-label', `Open image: ${caption || 'image'}`);
        }
      } else {
        const link = document.createElement('a');
        link.className = 'article-image-link';
        link.href = fullImageSrc;
        link.setAttribute('data-full-image', fullImageSrc);
        link.setAttribute('data-caption', caption);
        link.setAttribute('aria-label', `Open image: ${caption || 'image'}`);

        img.parentNode.insertBefore(link, img);
        link.appendChild(img);
      }
    }

    if (!tags.includes('bwphoto') || container.querySelector('ai-colorize-toggle')) {
      return;
    }

    hasColorizableImages = true;
    container.classList.add('image-frame--bwphoto');

    imageState.set(img, {
      originalSrc: img.getAttribute('src') ?? img.src,
      colorizedSrc: null,
      colorized: false,
      loading: false
    });

    registerColorizeButton(img, container);
  });

  initImageLightbox({ triggerSelector: '.article-image-link' });

  if (hasColorizableImages && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/assets/js/colorize-sw.js').catch(() => {});
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', enhanceArticleImages, { once: true });
} else {
  enhanceArticleImages();
}
