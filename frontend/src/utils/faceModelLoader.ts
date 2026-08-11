import * as faceapi from 'face-api.js';

let isLoaded = false;
let isLoading = false;
let loadPromise: Promise<boolean> | null = null;

const MODEL_SOURCES = [
  '/models',
  'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights',
  'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights',
  'https://cdn.jsdelivr.net/gh/vladmandic/face-api/model'
];

/**
 * Loads face-api.js models with multi-tiered CDN fallback and caching.
 */
export async function loadFaceApiModels(
  onProgress?: (msg: string) => void
): Promise<boolean> {
  if (isLoaded) return true;
  if (isLoading && loadPromise) return loadPromise;

  isLoading = true;
  loadPromise = (async () => {
    let lastError: any = null;

    for (let i = 0; i < MODEL_SOURCES.length; i++) {
      const sourceUrl = MODEL_SOURCES[i];
      try {
        if (onProgress) onProgress(`Loading AI engine (source ${i + 1}/${MODEL_SOURCES.length})...`);
        console.log(`[Face-AI] Loading models from: ${sourceUrl}`);

        // Try loading all 3 required nets from this source
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(sourceUrl),
          faceapi.nets.faceLandmark68Net.loadFromUri(sourceUrl),
          faceapi.nets.faceRecognitionNet.loadFromUri(sourceUrl)
        ]);

        console.log(`[Face-AI] Successfully loaded models from: ${sourceUrl}`);
        isLoaded = true;
        isLoading = false;
        return true;
      } catch (err: any) {
        console.warn(`[Face-AI] Source failed (${sourceUrl}):`, err?.message || err);
        lastError = err;
      }
    }

    isLoading = false;
    isLoaded = false;
    loadPromise = null;
    throw lastError || new Error('All Face AI model sources failed.');
  })();

  return loadPromise;
}

export function isFaceApiLoaded(): boolean {
  return isLoaded;
}
