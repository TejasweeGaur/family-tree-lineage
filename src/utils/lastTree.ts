/**
 * Remembers which tree each user last had open, so a reload returns them to
 * it instead of to whichever membership the database happens to list first.
 * Per user id, because a shared family computer may see several accounts.
 */
const key = (userId: string) => `ft.lastTree.${userId}`;

export function rememberTree(userId: string, treeId: string): void {
  try { localStorage.setItem(key(userId), treeId); } catch { /* storage unavailable: fine */ }
}

export function preferredTree(userId: string): string | null {
  try { return localStorage.getItem(key(userId)); } catch { return null; }
}
