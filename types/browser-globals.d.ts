// Prefixed browser APIs that the 3D scenes fall back on (older Safari), missing from TypeScript's DOM types.
// `ort` and `importScripts` are the colourise worker's ONNX runtime. `skipWaiting` / `clients` are the
// colourise service worker. Those files are type-checked with the DOM lib, where `self` is `Window`.
interface Window {
  webkitAudioContext?: typeof AudioContext;
  ort?: OrtRuntime;
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

// The colourise worker's ONNX runtime, installed on `self` by `importScripts`. Only the members the worker uses.
type OrtTensor = { dims: number[]; data: ArrayLike<number> & Iterable<number> };
type OrtSession = {
  inputNames: string[];
  outputNames: string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensor | undefined>>;
};
type OrtRuntime = {
  env?: { wasm?: { wasmPaths: string; numThreads: number } };
  Tensor: new (type: string, data: Float32Array, dims: number[]) => unknown;
  InferenceSession: {
    create(
      buffer: Uint8Array,
      options: { executionProviders: string[]; graphOptimizationLevel: string }
    ): Promise<OrtSession>;
  };
};
