const MAX_EDGE = 320;
const JPEG_QUALITY = 0.86;

/**
 * Downscales a gallery photo so its longest edge is at most `maxEdge`,
 * preserving aspect ratio, and re-encodes it as JPEG. A 4 MB phone photo comes
 * out around 300 KB — the difference between a few hundred photos and a few
 * thousand on the 1 GB free storage tier.
 */
export function readScaledPhoto(file: File, maxEdge = 1600): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error(`${file.name} is not an image.`));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`${file.name} could not be decoded.`)); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas is unavailable.')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error(`${file.name} could not be encoded.`))),
        'image/jpeg', JPEG_QUALITY,
      );
    };
    img.src = url;
  });
}

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
