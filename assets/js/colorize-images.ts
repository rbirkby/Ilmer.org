import { initImageLightbox } from './image-lightbox.ts';
import { COLOURISE_SW_PATH, isStaleColouriseWorker } from './colourise-registration.ts';

let workerRequestId = 0;
let colorizeWorker: Worker | undefined;
interface WorkerRequest {
  resolve: (result: { blob: Blob; executionProvider?: string }) => void;
  reject: (error: Error) => void;
  onProgress: (progress?: number, label?: string) => void;
}

interface ImageState {
  originalSrc: string;
  colorizedSrc: string | null;
  colorized: boolean;
  loading: boolean;
}

const workerRequests = new Map<string, WorkerRequest>();
const imageState = new WeakMap<HTMLImageElement, ImageState>();
const progressAnimations = new WeakMap<HTMLElement, { value: number; frameId: number }>();
const colorizedObjectUrls = new Set<string>();

function parseImageTags(img: HTMLImageElement) {
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

function stripHashFromImageSrc(src: string | null) {
  const value = src ?? '';
  const hashIndex = value.indexOf('#');

  if (hashIndex === -1) {
    return value;
  }

  return value.slice(0, hashIndex);
}

function revokeColorizedObjectUrls() {
  for (const url of colorizedObjectUrls) {
    URL.revokeObjectURL(url);
  }
  colorizedObjectUrls.clear();
}

function setButtonProgress(button: HTMLElement, progress: number) {
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

  const animate = (now: number) => {
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

function updateButtonState(button: HTMLElement, state: string, title: string, progress?: number) {
  button.dataset.state = state;
  button.title = title;
  button.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');

  const defaultProgress = state === 'active' ? 100 : 0;
  setButtonProgress(button, typeof progress === 'number' ? progress : defaultProgress);
}

function waitForPaint() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

async function ensureImageReady(img: HTMLImageElement) {
  if (img.complete && img.naturalWidth > 0) {
    if (typeof img.decode === 'function') {
      await img.decode().catch(() => {});
    }
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const onLoad = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('The image could not be loaded for colourisation.'));
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
    colorizeWorker = new Worker(new URL('./colorize-worker.ts', import.meta.url));

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

function requestWorkerColorization(
  src: string,
  onProgress: (progress?: number, label?: string) => void = () => {}
): Promise<{ blob: Blob }> {
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

async function colorizeImage(
  img: HTMLImageElement,
  onProgress: (progress?: number, label?: string) => void = () => {}
) {
  await ensureImageReady(img);

  const sourceUrl = img.currentSrc || img.src || img.getAttribute('src');
  if (!sourceUrl) {
    throw new Error('The image could not be loaded for colourisation.');
  }

  const { blob } = await requestWorkerColorization(sourceUrl, onProgress);
  return URL.createObjectURL(blob);
}

async function toggleColorization(
  img: HTMLImageElement,
  button: HTMLElement & { disabled: boolean },
  container: HTMLElement
) {
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

    const reportProgress = (progress = 0, label = 'AI colourising image…') => {
      const boundedProgress = Math.max(0, Math.min(100, progress));
      updateButtonState(button, 'loading', `${label} (${Math.round(boundedProgress)}%)`, boundedProgress);
    };

    reportProgress(12, 'Starting AI colourisation…');
    await waitForPaint();

    const colorizedUrl = await colorizeImage(img, reportProgress);

    reportProgress(100, 'Colour image ready');

    state.colorizedSrc = colorizedUrl;
    colorizedObjectUrls.add(colorizedUrl);
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

async function registerColorizeButton(img: HTMLImageElement, container: HTMLElement) {
  await import('./ai-colorize-toggle.ts');

  // The imported custom element defines `disabled`; createElement still returns a plain HTMLElement.
  const button = document.createElement('ai-colorize-toggle') as HTMLElement & { disabled: boolean };
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', `Toggle AI colourisation for ${img.alt || 'this image'}`);

  updateButtonState(button, 'idle', 'Show an AI-colourised version of this image');
  button.addEventListener('click', () => toggleColorization(img, button, container));
  container.appendChild(button);
}

function enhanceArticleImages() {
  const articleSection = document.querySelector('section.article') as HTMLElement | null;
  const articleImages = document.querySelectorAll('section.article img') as NodeListOf<HTMLImageElement>;
  const lightboxAllEnabled = articleSection?.dataset.lightboxAll === 'true';
  const colorizeRegistrations: Array<Promise<void>> = [];

  articleImages.forEach((img) => {
    const tags = parseImageTags(img);
    const container = img.closest('p');

    if (!container) {
      return;
    }

    container.classList.add('image-frame');

    if (tags.includes('left')) {
      container.classList.add('image-frame--left');
    }

    if (tags.includes('right')) {
      container.classList.add('image-frame--right');
    }

    if (tags.includes('small')) {
      container.classList.add('image-frame--small');
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

        img.parentNode?.insertBefore(link, img);
        link.appendChild(img);
      }
    }

    if (!tags.includes('bwphoto') || container.querySelector('ai-colorize-toggle')) {
      return;
    }

    container.classList.add('image-frame--bwphoto');

    imageState.set(img, {
      originalSrc: img.getAttribute('src') ?? img.src,
      colorizedSrc: null,
      colorized: false,
      loading: false
    });

    colorizeRegistrations.push(registerColorizeButton(img, container));
  });

  initImageLightbox({ triggerSelector: '.article-image-link' });
  retireStaleColouriseWorkers();

  if (colorizeRegistrations.length > 0) {
    Promise.all(colorizeRegistrations).catch(() => {});

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(COLOURISE_SW_PATH).catch(() => {});
    }
  }
}

function retireStaleColouriseWorkers() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      for (const registration of registrations) {
        const scriptURL =
          registration.active?.scriptURL ?? registration.waiting?.scriptURL ?? registration.installing?.scriptURL;
        if (scriptURL && isStaleColouriseWorker(scriptURL)) registration.unregister().catch(() => {});
      }
    })
    .catch(() => {});
}

window.addEventListener('pagehide', revokeColorizedObjectUrls);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', enhanceArticleImages, { once: true });
} else {
  enhanceArticleImages();
}
