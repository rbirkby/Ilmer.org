const CACHE_NAME = 'ilmer-ai-colourize-v1'
const MODEL_URL = 'https://raw.githubusercontent.com/linmingren/openmodels/main/models/deoldify/deoldify.quant.onnx'
const ORT_BASE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const requestUrl = event.request.url
  const shouldCache = requestUrl === MODEL_URL || requestUrl.startsWith(ORT_BASE)

  if (!shouldCache) {
    return
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request)
      if (cached) {
        return cached
      }

      const response = await fetch(event.request)
      if (response.ok) {
        cache.put(event.request, response.clone())
      }
      return response
    })
  )
})
