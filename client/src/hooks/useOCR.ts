import { useCallback } from 'react';
import Tesseract from 'tesseract.js';

/**
 * Module-level singleton worker.
 * Created once on first use with PSM 7 already set.
 * Reused for every subsequent plate recognition call.
 */
let workerSingleton: Tesseract.Worker | null = null;
let workerInitPromise: Promise<Tesseract.Worker> | null = null;

function getWorker(): Promise<Tesseract.Worker> {
  if (workerSingleton) return Promise.resolve(workerSingleton);
  if (workerInitPromise) return workerInitPromise;

  workerInitPromise = (async () => {
    console.log('[Tesseract] Creating worker...');
    const w = await Tesseract.createWorker('jpn+eng', 1, {
      logger: (m) => console.log('[Tesseract]', m.status, m.progress),
    });
    // Set PSM 7 = SINGLE_LINE — ideal for a single-row licence plate
    await w.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
    });
    console.log('[Tesseract] Worker ready (PSM 7)');
    workerSingleton = w;
    return w;
  })().catch((err) => {
    console.error('[Tesseract] Worker init failed:', err);
    workerInitPromise = null; // allow retry next time
    throw err;
  });

  return workerInitPromise;
}

export function useOCR() {
  /** General-purpose recognition (kept for non-plate uses). */
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
   * Plate-optimised recognition using the persistent worker.
   * PSM 7 (single line) is pre-configured during worker initialisation.
   */
  const recognizePlate = useCallback(async (imageSource: Tesseract.ImageLike): Promise<string> => {
    console.log('[Tesseract] recognizePlate called');
    const worker = await getWorker();
    console.log('[Tesseract] worker ready, running recognize...');
    const result = await worker.recognize(imageSource);
    console.log('[Tesseract] recognize done, text:', result.data.text);
    return result.data.text;
  }, []);

  return { recognizeText, recognizePlate };
}
