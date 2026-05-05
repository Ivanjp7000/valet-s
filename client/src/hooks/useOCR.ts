import { useCallback } from 'react';
import Tesseract from 'tesseract.js';

export function useOCR() {
  const recognizeText = useCallback(async (imageSource: HTMLCanvasElement | string): Promise<string> => {
    try {
      const result = await Tesseract.recognize(
        imageSource,
        'jpn+eng',
        {
          logger: (m) => console.log(m),
        }
      );
      
      return result.data.text;
    } catch (error) {
      console.error('OCR Error:', error);
      throw new Error('Failed to recognize text');
    }
  }, []);

  return {
    recognizeText,
  };
}
