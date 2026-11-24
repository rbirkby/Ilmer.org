// Prefixed browser APIs that the 3D scenes fall back on (older Safari), missing from TypeScript's DOM types.
interface Window {
  webkitAudioContext?: typeof AudioContext;
}

interface Document {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void>;
}

interface Element {
  webkitRequestFullscreen?: () => Promise<void>;
}
