const CACHE_NAME = 'ilmer-ai-colourize-v1';
const MODEL_URL = 'https://raw.githubusercontent.com/linmingren/openmodels/main/models/deoldify/deoldify.quant.onnx';
const ORT_BASE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';

type ActivateEvent = { waitUntil(task: Promise<unknown>): void };
type FetchEvent = { request: Request; respondWith(response: Promise<Response>): void };

// Registered as a service worker. The DOM lib types `self` as Window, which has none of these members.
const scope = self as unknown as {
  skipWaiting(): void;
  clients: { claim(): Promise<void> };
  addEventListener(type: 'install', listener: () => void): void;
  addEventListener(type: 'activate', listener: (event: ActivateEvent) => void): void;
  addEventListener(type: 'fetch', listener: (event: FetchEvent) => void): void;
};

scope.addEventListener('install', () => {
  scope.skipWaiting();
});

scope.addEventListener('activate', (event) => {
  event.waitUntil(scope.clients.claim());
});

scope.addEventListener('fetch', (event) => {
  const requestUrl = event.request.url;
  const shouldCache = requestUrl === MODEL_URL || requestUrl.startsWith(ORT_BASE);

  if (!shouldCache) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) {
        return cached;
      }

      const response = await fetch(event.request);
      if (response.ok) {
        cache.put(event.request, response.clone());
      }
      return response;
    })
  );
});
