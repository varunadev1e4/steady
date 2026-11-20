/**
 * Shrinks a photo on the device before upload: max 1600px on the long edge,
 * JPEG at 85% quality. Re-encoding through a canvas also drops all EXIF
 * metadata, including GPS location, so photos never carry where they were taken.
 */
export const MAX_EDGE = 1600;

export function fitWithin(width: number, height: number, max = MAX_EDGE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function prepareImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo.');
  if (file.size > 25 * 1024 * 1024) throw new Error('That photo is larger than 25 MB.');
  let bitmap: ImageBitmap;
  try {
    // Respect the camera's rotation flag before the metadata is dropped.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This photo format isn’t supported by your browser. Try a JPEG or PNG.');
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Couldn’t process the photo.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Couldn’t process the photo.');
  return blob;
}
