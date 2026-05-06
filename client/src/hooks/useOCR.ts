import { useCallback } from 'react';
import Tesseract from 'tesseract.js';

export function useOCR() {
  const recognizeText = useCallback(async (imageSource: Tesseract.ImageLike): Promise<string> => {
    const result = await Tesseract.recognize(imageSource, 'jpn+eng', {
      logger: (m) => console.log('[OCR]', m.status, Math.round((m.progress || 0) * 100) + '%'),
    });
    return result.data.text;
  }, []);

  return { recognizeText };
}
