/**
 * Upload limits. ARCHIVE_MAX_BYTES must match the `archives` bucket's
 * file_size_limit (migration 0004): the bucket is the real enforcement, this is
 * so the user gets a clear message before an upload starts rather than after.
 */
export const ARCHIVE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Raw image size accepted before compression. Generous, because a 12-megapixel
 * phone photo can be 8-15 MB and comes out well under 1 MB once compressed.
 */
export const IMAGE_INPUT_MAX_BYTES = 40 * 1024 * 1024;

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}
