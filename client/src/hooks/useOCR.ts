import { requestPlateRecognition } from '@/lib/plate-ocr';
import { useCallback } from 'react';
import Tesseract from 'tesseract.js';

/**
 * Singleton Tesseract worker — used only for non-plate general text (e.g. ticket scanning).
 * Plate OCR now goes through Google Cloud Vision via the server.
 */
let _worker: Tesseract.Worker | null = null;
let _workerPromise: Promise<Tesseract.Worker> | null = null;

function getTextWorker(): Promise<Tesseract.Worker> {
  if (_worker) return Promise.resolve(_worker);
  if (_workerPromise) return _workerPromise;

  _workerPromise = Tesseract.createWorker('jpn+eng', 1, {
    logger: (m) =>
      console.log('[OCR]', m.status, Math.round((m.progress || 0) * 100) + '%'),
  })
    .then(async (w) => {
      _worker = w;
      return w;
    })
    .catch((err) => {
      console.error('[OCR] Worker init failed:', err);
      _workerPromise = null;
      throw err;
    });

  return _workerPromise;
}

export function useOCR() {
  /** General-purpose (non-plate) recognition — used for ticket number scanning. */
  const recognizeText = useCallback(
    async (imageSource: Tesseract.ImageLike): Promise<string> => {
      const worker = await getTextWorker();
      const result = await worker.recognize(imageSource);
      return result.data.text;
    },
    []
  );

  const recognizePlate = useCallback(requestPlateRecognition, []);

  return { recognizeText, recognizePlate };
}
