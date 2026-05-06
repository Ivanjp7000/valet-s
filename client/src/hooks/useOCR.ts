import { useCallback } from 'react';
import Tesseract from 'tesseract.js';

/**
 * Module-level singleton worker.
 * Created once on first use, reused for every subsequent recognition.
 * Avoids re-downloading the ~40 MB Japanese language data each call.
 */
let workerSingleton: Tesseract.Worker | null = null;
let workerInitPromise: Promise<Tesseract.Worker> | null = null;

function getWorker(): Promise<Tesseract.Worker> {
  if (workerSingleton) return Promise.resolve(workerSingleton);
  if (workerInitPromise) return workerInitPromise;

  workerInitPromise = Tesseract.createWorker('jpn+eng', 1, {
    logger: (m) => console.log('[Tesseract]', m),
  }).then((w) => {
    workerSingleton = w;
    return w;
  }).catch((err) => {
    // Reset so the next call retries
    workerInitPromise = null;
    throw err;
  });

  return workerInitPromise;
}

export function useOCR() {
  /**
   * General-purpose recognition (original behaviour, kept for other uses).
   */
  const recognizeText = useCallback(async (imageSource: Tesseract.ImageLike): Promise<string> => {
    try {
      const result = await Tesseract.recognize(imageSource, 'jpn+eng', {
        logger: (m) => console.log(m),
      });
      return result.data.text;
    } catch (error) {
      console.error('OCR Error:', error);
      throw new Error('Failed to recognize text');
    }
  }, []);

  /**
   * Plate-optimised recognition:
   * - Reuses the singleton worker (no repeated CDN downloads)
   * - PSM 7 = single text line, passed directly via worker.recognize opts
   *   so Tesseract applies it via api.SetVariable before recognition
   */
  const recognizePlate = useCallback(async (imageSource: Tesseract.ImageLike): Promise<string> => {
    const worker = await getWorker();
    const result = await worker.recognize(imageSource, {
      // Any option not in Tesseract.js's own reserved list is forwarded to
      // api.SetVariable() inside the worker — this is how PSM is applied.
      tessedit_pageseg_mode: '7' as any, // PSM 7 = SINGLE_LINE
    } as any);
    return result.data.text;
  }, []);

  return { recognizeText, recognizePlate };
}
