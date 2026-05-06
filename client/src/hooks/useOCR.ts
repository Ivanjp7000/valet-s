import { useCallback } from 'react';
import Tesseract from 'tesseract.js';

export function useOCR() {
  const recognizeText = useCallback(async (imageSource: HTMLCanvasElement | string): Promise<string> => {
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
   *  - Dedicated Tesseract worker (avoids shared state)
   *  - PSM 7 = single text line (perfect for a licence plate)
   *  - jpn+eng so both Japanese and alphanumeric chars are covered
   */
  const recognizePlate = useCallback(async (imageSource: HTMLCanvasElement | string): Promise<string> => {
    let worker: Tesseract.Worker | null = null;
    try {
      worker = await Tesseract.createWorker('jpn+eng', 1, {
        logger: (m) => console.log(m),
      });
      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE as any,
      });
      const { data: { text } } = await worker.recognize(imageSource);
      return text;
    } finally {
      if (worker) await worker.terminate();
    }
  }, []);

  return { recognizeText, recognizePlate };
}
