// Fullscreen toggle for a 3D scene stage, shared by the reconstruction pages.
// Uses the native Fullscreen API where the browser allows it on non-video elements, and otherwise
// (iPhone Safari) pins the stage over the page with the `is-pseudo-fullscreen` class.

/** Bind a toggle button to enter/exit native or pseudo-fullscreen for `stage`. */
export function bindFullscreenToggle({
  button,
  stage,
  lockClass = 'st-peters-fs-lock',
  onChange
}: {
  button: HTMLButtonElement | null;
  stage: HTMLElement;
  lockClass?: string;
  onChange?: () => void;
}) {
  let isPseudoFullscreen = false;

  const nativeElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const isFullscreen = () => nativeElement() === stage || isPseudoFullscreen;

  function sync() {
    if (button) {
      const active = isFullscreen();
      const label = active ? 'Exit fullscreen' : 'Enter fullscreen';
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', label);
      button.title = label;
      button.querySelector('[data-icon="fs-enter"]')?.toggleAttribute('hidden', active);
      button.querySelector('[data-icon="fs-exit"]')?.toggleAttribute('hidden', !active);
    }
    onChange?.();
  }

  function setPseudoFullscreen(enabled: boolean) {
    isPseudoFullscreen = Boolean(enabled);
    stage.classList.toggle('is-pseudo-fullscreen', isPseudoFullscreen);
    document.body.classList.toggle(lockClass, isPseudoFullscreen);
    sync();
  }

  function enter() {
    const request = stage.requestFullscreen || stage.webkitRequestFullscreen;
    const canNative =
      typeof request === 'function' && Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
    if (!canNative) {
      setPseudoFullscreen(true);
      return;
    }
    // Some browsers neither resolve nor reject when fullscreen is refused, so fall back after a moment
    const fallback = window.setTimeout(() => {
      if (!nativeElement() && !isPseudoFullscreen) setPseudoFullscreen(true);
    }, 120);
    try {
      Promise.resolve(request.call(stage)).then(
        () => {
          window.clearTimeout(fallback);
          if (!nativeElement()) setPseudoFullscreen(true);
        },
        () => {
          window.clearTimeout(fallback);
          setPseudoFullscreen(true);
        }
      );
    } catch {
      window.clearTimeout(fallback);
      setPseudoFullscreen(true);
    }
  }

  function exit() {
    if (nativeElement()) {
      const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
      Promise.resolve(exitFullscreen?.call(document)).catch(() => setPseudoFullscreen(false));
    }
    if (isPseudoFullscreen) setPseudoFullscreen(false);
  }

  button?.addEventListener('click', () => (isFullscreen() ? exit() : enter()));
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);

  return {
    isFullscreen,
    isPseudoFullscreen: () => isPseudoFullscreen,
    exit
  };
}
