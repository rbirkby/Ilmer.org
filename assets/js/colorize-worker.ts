const ONNX_RUNTIME_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js';
const ONNX_WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
const MODEL_URL = 'https://raw.githubusercontent.com/linmingren/openmodels/main/models/deoldify/deoldify.quant.onnx';
const MODEL_INPUT_SIZE = 256;
const MAX_OUTPUT_WIDTH = 1600;

let ortRuntimePromise;
let modelBufferPromise;
let sessionPromise;
let activeExecutionProvider = 'wasm';

self.addEventListener('message', (event) => {
  const { id, type, payload } = event.data ?? {};

  if (type !== 'colorize' || !id || !payload?.src) {
    return;
  }

  handleColorizeRequest(id, payload.src).catch((error) => {
    postError(id, error instanceof Error ? error.message : 'AI colourisation failed.');
  });
});

function postProgress(id, progress, label) {
  self.postMessage({ id, type: 'progress', progress, label });
}

function postResult(id, blob) {
  self.postMessage({ id, type: 'result', blob, executionProvider: activeExecutionProvider });
}

function postError(id, message) {
  self.postMessage({ id, type: 'error', message });
}

function configureOrt(ort) {
  if (ort?.env?.wasm) {
    ort.env.wasm.wasmPaths = ONNX_WASM_BASE_URL;
    ort.env.wasm.numThreads = Math.min(4, self.navigator?.hardwareConcurrency || 1);
  }
}

async function ensureOrtRuntime() {
  if (self.ort) {
    configureOrt(self.ort);
    return self.ort;
  }

  if (!ortRuntimePromise) {
    ortRuntimePromise = Promise.resolve()
      .then(() => {
        importScripts(ONNX_RUNTIME_URL);
        configureOrt(self.ort);
        return self.ort;
      })
      .catch((error) => {
        ortRuntimePromise = undefined;
        throw error;
      });
  }

  return ortRuntimePromise;
}

async function fetchModelBuffer(reportProgress) {
  if (!modelBufferPromise) {
    modelBufferPromise = (async () => {
      reportProgress(12, 'Downloading AI model…');

      const response = await fetch(MODEL_URL, { cache: 'force-cache' });
      if (!response.ok) {
        throw new Error('The AI model could not be downloaded.');
      }

      const totalBytes = Number(response.headers.get('content-length') ?? '0');
      if (!response.body) {
        const fallbackBuffer = new Uint8Array(await response.arrayBuffer());
        reportProgress(58, 'Preparing AI model…');
        return fallbackBuffer;
      }

      const reader = response.body.getReader();
      const chunks = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        if (!value) {
          continue;
        }

        chunks.push(value);
        receivedBytes += value.byteLength;

        if (totalBytes > 0) {
          const modelPercent = receivedBytes / totalBytes;
          reportProgress(12 + modelPercent * 46, `Downloading AI model… ${Math.round(modelPercent * 100)}%`);
        }
      }

      const modelBuffer = new Uint8Array(receivedBytes);
      let offset = 0;

      for (const chunk of chunks) {
        modelBuffer.set(chunk, offset);
        offset += chunk.byteLength;
      }

      reportProgress(58, 'Preparing AI model…');
      return modelBuffer;
    })().catch((error) => {
      modelBufferPromise = undefined;
      throw error;
    });
  } else {
    reportProgress(58, 'Preparing AI model…');
  }

  return modelBufferPromise;
}

async function createSession(ort, modelBuffer, executionProviders) {
  return ort.InferenceSession.create(modelBuffer, {
    executionProviders,
    graphOptimizationLevel: 'all'
  });
}

async function getColorizationSession(reportProgress) {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      reportProgress(4, 'Loading AI runtime…');
      const ort = await ensureOrtRuntime();
      reportProgress(10, 'AI runtime ready…');

      const modelBuffer = await fetchModelBuffer(reportProgress);
      const canUseWebGpu = typeof navigator !== 'undefined' && 'gpu' in navigator;

      try {
        if (canUseWebGpu) {
          reportProgress(68, 'Preparing AI model with WebGPU…');
          const session = await createSession(ort, modelBuffer, ['webgpu', 'wasm']);
          activeExecutionProvider = 'webgpu';
          return session;
        }
      } catch (error) {
        console.warn('WebGPU setup failed, falling back to WASM.', error);
      }

      reportProgress(68, 'Preparing AI model…');
      activeExecutionProvider = 'wasm';
      return createSession(ort, modelBuffer, ['wasm']);
    })().catch((error) => {
      sessionPromise = undefined;
      throw error;
    });
  } else {
    const label = activeExecutionProvider === 'webgpu' ? 'Preparing AI model with WebGPU…' : 'Preparing AI model…';
    reportProgress(68, label);
  }

  return sessionPromise;
}

function preprocess(imageData, width, height) {
  const channelSize = width * height;
  const tensorData = new Float32Array(channelSize * 3);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = (y * width + x) * 4;
      const channelOffset = y * width + x;

      tensorData[channelOffset] = imageData.data[pixelOffset];
      tensorData[channelSize + channelOffset] = imageData.data[pixelOffset + 1];
      tensorData[channelSize * 2 + channelOffset] = imageData.data[pixelOffset + 2];
    }
  }

  return tensorData;
}

function postprocess(tensor) {
  const [, channels, height, width] = tensor.dims;
  const tensorData = tensor.data;
  const output = new ImageData(width, height);

  let minValue = Infinity;
  let maxValue = -Infinity;

  for (const value of tensorData) {
    minValue = Math.min(minValue, value);
    maxValue = Math.max(maxValue, value);
  }

  const usesUnitRange = maxValue <= 1.5 && minValue >= 0;
  const usesSignedRange = maxValue <= 1.5 && minValue < 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = (y * width + x) * 4;

      for (let channel = 0; channel < channels; channel += 1) {
        const tensorOffset = (channel * height + y) * width + x;
        let value = tensorData[tensorOffset];

        if (usesUnitRange) {
          value *= 255;
        } else if (usesSignedRange) {
          value = (value + 1) * 127.5;
        }

        output.data[pixelOffset + channel] = Math.round(Math.max(0, Math.min(255, value)));
      }

      output.data[pixelOffset + 3] = 255;
    }
  }

  return output;
}

async function colorizeSourceImage(src, reportProgress) {
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap !== 'function') {
    throw new Error('This browser cannot run AI colourisation in a background worker.');
  }

  const session = await getColorizationSession(reportProgress);

  reportProgress(74, 'Fetching image…');
  const response = await fetch(src, { cache: 'force-cache', credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error('The image could not be loaded for colourisation.');
  }

  const imageBlob = await response.blob();
  const bitmap = await createImageBitmap(imageBlob);

  reportProgress(80, 'Preparing image…');
  const inputCanvas = new OffscreenCanvas(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const inputContext = inputCanvas.getContext('2d', { willReadFrequently: true });
  if (!inputContext) {
    throw new Error('Canvas image processing is not available in this browser.');
  }

  inputContext.drawImage(bitmap, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

  const pixelData = inputContext.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const ort = await ensureOrtRuntime();
  const inputTensor = new ort.Tensor('float32', preprocess(pixelData, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE), [
    1,
    3,
    MODEL_INPUT_SIZE,
    MODEL_INPUT_SIZE
  ]);

  const inputName = session.inputNames[0] ?? 'input';
  const outputName = session.outputNames[0] ?? 'out';

  reportProgress(
    88,
    activeExecutionProvider === 'webgpu' ? 'Running AI colourisation with WebGPU…' : 'Running AI colourisation…'
  );
  const results = await session.run({ [inputName]: inputTensor });
  const outputTensor = results[outputName];

  if (!outputTensor) {
    throw new Error('The AI model did not return an image.');
  }

  reportProgress(94, 'Rendering colour image…');
  const colorizedData = postprocess(outputTensor);
  const colorizedCanvas = new OffscreenCanvas(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const colorizedContext = colorizedCanvas.getContext('2d');
  if (!colorizedContext) {
    throw new Error('Canvas rendering is not available in this browser.');
  }

  colorizedContext.putImageData(colorizedData, 0, 0);

  const sourceWidth = bitmap.width || MODEL_INPUT_SIZE;
  const sourceHeight = bitmap.height || MODEL_INPUT_SIZE;
  const targetWidth = Math.min(sourceWidth, MAX_OUTPUT_WIDTH);
  const targetHeight = Math.max(1, Math.round((targetWidth / sourceWidth) * sourceHeight));

  const finalCanvas = new OffscreenCanvas(targetWidth, targetHeight);
  const finalContext = finalCanvas.getContext('2d');
  if (!finalContext) {
    throw new Error('Canvas export is not available in this browser.');
  }

  finalContext.drawImage(colorizedCanvas, 0, 0, targetWidth, targetHeight);
  reportProgress(100, 'Colour image ready');

  return finalCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
}

async function handleColorizeRequest(id, src) {
  const reportProgress = (progress, label) => postProgress(id, progress, label);
  const blob = await colorizeSourceImage(src, reportProgress);
  postResult(id, blob);
}
