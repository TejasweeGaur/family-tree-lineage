const MAX_EDGE = 320;
const JPEG_QUALITY = 0.86;

/**
 * Reads a picked image, centre-crops it square and downscales it to a 320px
 * JPEG data URL. Keeps avatars small enough to store inline in demo mode and
 * cheap to upload once Supabase storage is wired in.
 */
export function readSquarePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Choose an image file.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That image could not be decoded.'));
      img.onload = () => {
        const edge = Math.min(img.width, img.height);
        const sx = (img.width - edge) / 2;
        const sy = (img.height - edge) / 2;
        const size = Math.min(MAX_EDGE, edge);

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas is unavailable.')); return; }

        ctx.drawImage(img, sx, sy, edge, edge, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
