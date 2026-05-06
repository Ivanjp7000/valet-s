import { useCallback } from 'react';
import Tesseract from 'tesseract.js';

/**
 * Singleton worker — created once, reused for every plate scan.
 * Configured with PSM 7 (single text line) which is essential for
 * licence plates. Re-initialises automatically if creation fails.
 */
let _worker: Tesseract.Worker | null = null;
let _workerPromise: Promise<Tesseract.Worker> | null = null;

function getPlateWorker(): Promise<Tesseract.Worker> {
  if (_worker) return Promise.resolve(_worker);
  if (_workerPromise) return _workerPromise;

  _workerPromise = Tesseract.createWorker('jpn+eng', 1, {
    logger: (m) =>
      console.log('[OCR]', m.status, Math.round((m.progress || 0) * 100) + '%'),
  })
    .then(async (w) => {
      // PSM 7 = SINGLE_LINE — tells Tesseract the whole image is one row of text.
      // This is the single most important setting for licence plates.
      await w.setParameters({ tessedit_pageseg_mode: '7' } as any);
      _worker = w;
      console.log('[OCR] Worker ready — PSM 7 set');
      return w;
    })
    .catch((err) => {
      console.error('[OCR] Worker init failed:', err);
      _workerPromise = null; // allow retry on next call
      throw err;
    });

  return _workerPromise;
}

export function useOCR() {
  /** General-purpose (non-plate) recognition. */
  const recognizeText = useCallback(
    async (imageSource: Tesseract.ImageLike): Promise<string> => {
      const result = await Tesseract.recognize(imageSource, 'jpn+eng', {
        logger: (m) =>
          console.log('[OCR]', m.status, Math.round((m.progress || 0) * 100) + '%'),
      });
      return result.data.text;
    },
    []
  );

  /**
   * Plate-specific recognition.
   * Uses the persistent PSM-7 worker — no repeated language-data downloads.
   */
  const recognizePlate = useCallback(
    async (imageSource: Tesseract.ImageLike): Promise<string> => {
      const worker = await getPlateWorker();
      const result = await worker.recognize(imageSource);
      const raw = result.data.text;
      console.log('[OCR] raw plate text:', JSON.stringify(raw));
      return raw;
    },
    []
  );

  return { recognizeText, recognizePlate };
}
