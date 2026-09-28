export async function requestPlateRecognition(imageDataUrl: string, request: typeof fetch = fetch): Promise<string> {
  let response: Response;
  try {
    response = await request('/api/ocr/plate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: imageDataUrl }), credentials: 'include',
    });
  } catch {
    throw new Error('Could not connect to the plate reader. Check your connection and try again.');
  }
  if (response.status === 401) throw new Error('Your sign-in has expired. Sign in again, then retry the plate photo.');
  if (response.status === 413) throw new Error('This photo is too large. Please take a closer photo of the plate and retry.');
  if (!response.ok) throw new Error('The plate-reading service is unavailable. Please retry or enter the plate manually.');
  const result = await response.json();
  if (typeof result.text !== 'string' || !result.text.trim()) throw new Error('No readable text was found. Take a clear, close photo of the plate or enter it manually.');
  return result.text;
}
