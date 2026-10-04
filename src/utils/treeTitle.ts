/**
 * "Sharma" → "Sharma Family Tree". A name that already says it ("Gaur Family
 * Tree", or "Gaur Family") isn't given the words a second time.
 */
export function treeTitle(name: string): string {
  const n = name.trim();
  if (!n) return 'Family Tree';
  if (/\bfamily\s+tree$/i.test(n)) return n;
  if (/\bfamily$/i.test(n)) return `${n} Tree`;
  return `${n} Family Tree`;
}
