export async function uploadPhoto(blob: Blob): Promise<string> {
  const request = await fetch('/api/car-photos/upload', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType: blob.type, size: blob.size }),
  });
  if (request.status === 401) throw new Error('Your sign-in has expired. Sign in again before saving this ticket.');
  if (!request.ok) {
    const body = await request.json().catch(()=>null);
    throw new Error(body?.message || 'Could not prepare photo upload');
  }
  const { uploadURL, issuedPath } = await request.json();
  if(typeof uploadURL !== 'string' || !uploadURL.startsWith('/api/car-photos/content/') || typeof issuedPath !== 'string' || !issuedPath.startsWith('/car-photos/r2/'))
    throw new Error('Invalid photo upload response');
  const response = await fetch(uploadURL, { method: 'PUT', credentials: 'include', body: blob, headers: { 'Content-Type': blob.type } });
  if(!response.ok) {
    const body = await response.json().catch(()=>null);
    throw new Error(body?.message || 'Photo upload failed. Please try again.');
  }
  return issuedPath;
}
