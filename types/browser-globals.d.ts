// Prefixed browser APIs that the 3D scenes fall back on (older Safari), missing from TypeScript's DOM types.
// `ort` and `importScripts` are the colourise worker's ONNX runtime. `skipWaiting` / `clients` are the
// colourise service worker. Those files are type-checked with the DOM lib, where `self` is `Window`.
interface Window {
  webkitAudioContext?: typeof AudioContext;
  ort?: any;
  skipWaiting?: () => Promise<void>;
  clients?: { claim(): Promise<void> };
}

declare function importScripts(...urls: string[]): void;

interface Document {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void>;
}

interface Element {
  webkitRequestFullscreen?: () => Promise<void>;
}
