/** Divider position from the left, 0–100. 0 is entirely January 2026; 100 is entirely the film still. */
export function pointerToPosition(clientX, left, width) {
  if (!(width > 0)) return 0;
  const ratio = (clientX - left) / width;
  return Math.round(Math.min(1, Math.max(0, ratio)) * 100);
}

/** Spoken position. The number is how much of the width still shows the film still. */
export function valueText(value, thenLabel = 'film still', nowLabel = 'January 2026') {
  const clamped = Math.min(100, Math.max(0, Math.round(Number(value))));
  if (!Number.isFinite(clamped) || clamped <= 0) return nowLabel;
  if (clamped >= 100) return thenLabel;
  return `${clamped}% ${thenLabel}, ${100 - clamped}% ${nowLabel}`;
}

function paint(stage, range) {
  const value = Number(range.value);
  stage.style.setProperty('--then-now', `${value}%`);
  range.setAttribute('aria-valuetext', valueText(value));
}

function bindStage(stage) {
  const range = stage.querySelector('.then-now__range');
  if (!(range instanceof HTMLInputElement) || stage.hasAttribute('data-then-now')) return;
  stage.setAttribute('data-then-now', '');

  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let dragging = false;

  const seek = (clientX) => {
    const rect = stage.getBoundingClientRect();
    range.value = String(pointerToPosition(clientX, rect.left, rect.width));
    paint(stage, range);
  };

  range.addEventListener('input', () => paint(stage, range));

  stage.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    dragging = event.pointerType === 'mouse';
    if (!dragging) return;
    // A mouse drag should move the divider immediately, and not start selecting the labels.
    event.preventDefault();
    stage.setPointerCapture(event.pointerId);
    seek(event.clientX);
  });

  stage.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    if (!dragging) {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      // A vertical finger movement belongs to page scrolling. Claim the gesture only once it is clearly horizontal.
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        pointerId = null;
        return;
      }
      dragging = true;
      stage.setPointerCapture(event.pointerId);
    }
    seek(event.clientX);
  });

  stage.addEventListener('pointerup', (event) => {
    if (event.pointerId !== pointerId) return;
    if (!dragging) {
      const dx = Math.abs(event.clientX - startX);
      const dy = Math.abs(event.clientY - startY);
      if (dx < 8 && dy < 8) seek(event.clientX);
    }
    pointerId = null;
    dragging = false;
  });

  stage.addEventListener('pointercancel', (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    dragging = false;
  });

  paint(stage, range);
}

export function initThenNow(root = document) {
  for (const stage of root.querySelectorAll('.then-now__stage')) bindStage(stage);
}

if (typeof document !== 'undefined') initThenNow();
