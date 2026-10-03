import type { Person, Union } from '../types';

interface TreeData {
  persons: Person[];
  unions: Union[];
}

function byId(data: TreeData, id: string): Person | undefined {
  return data.persons.find(p => p.id === id);
}

export function spousesOf(data: TreeData, id: string): string[] {
  return data.unions
    .filter(u => u.a === id || u.b === id)
    .map(u => (u.a === id ? u.b : u.a) as string)
    .filter(x => x && byId(data, x));
}

export function unionOfChild(data: TreeData, id: string): Union | undefined {
  return data.unions.find(u => u.children.includes(id));
}

export function parentsOf(data: TreeData, id: string): string[] {
  const u = unionOfChild(data, id);
  return u ? [u.a, u.b].filter(Boolean) as string[] : [];
}

export function childrenOf(data: TreeData, id: string): string[] {
  let kids: string[] = [];
  data.unions.filter(u => u.a === id || u.b === id).forEach(u => { kids = kids.concat(u.children); });
  return kids;
}

export function siblingsOf(data: TreeData, id: string): string[] {
  const u = unionOfChild(data, id);
  return u ? u.children.filter(c => c !== id) : [];
}

export function unionsOf(data: TreeData, id: string): Union[] {
  return data.unions.filter(u => u.a === id || u.b === id);
}

function ancestorMap(data: TreeData, id: string): Record<string, number> {
  const m: Record<string, number> = {};
  const walk = (x: string, d: number) => {
    parentsOf(data, x).forEach(p => {
      if (m[p] === undefined || m[p] > d) { m[p] = d; walk(p, d + 1); }
    });
  };
  walk(id, 1);
  return m;
}

function ordinal(n: number): string {
  return n === 1 ? 'great-' : n > 1 ? Array(n + 1).join('great-') : '';
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Plain-English relationship of `otherId` as seen from `focusId`.
 *
 * `depth` guards the in-law lookup: relatives are resolved through at most one
 * spouse hop. Without it the two recursive passes below bounce between spouses
 * forever on any married pair that isn't blood-related.
 */
export function kin(data: TreeData, focusId: string, otherId: string, depth = 0): string {
  if (focusId === otherId) return '';
  const o = byId(data, otherId);
  if (!o) return '';
  const male = o.gender === 'Male', female = o.gender === 'Female';
  const pick = (m: string, f: string, x: string) => male ? m : female ? f : x;

  if (spousesOf(data, focusId).includes(otherId)) return pick('Husband', 'Wife', 'Spouse');
  if (parentsOf(data, focusId).includes(otherId)) return pick('Father', 'Mother', 'Parent');
  if (childrenOf(data, focusId).includes(otherId)) return pick('Son', 'Daughter', 'Child');
  if (siblingsOf(data, focusId).includes(otherId)) return pick('Brother', 'Sister', 'Sibling');

  const A = ancestorMap(data, focusId);
  const B = ancestorMap(data, otherId);

  if (B[focusId] !== undefined) {
    const d = B[focusId];
    return d === 2 ? pick('Grandson', 'Granddaughter', 'Grandchild')
      : cap(ordinal(d - 2) + pick('grandson', 'granddaughter', 'grandchild'));
  }
  if (A[otherId] !== undefined) {
    const d = A[otherId];
    return d === 2 ? pick('Grandfather', 'Grandmother', 'Grandparent')
      : cap(ordinal(d - 2) + pick('grandfather', 'grandmother', 'grandparent'));
  }

  let best: { s: number; da: number; db: number } | null = null;
  Object.keys(A).forEach(k => {
    if (B[k] !== undefined) {
      const s = A[k] + B[k];
      if (!best || s < best.s) best = { s, da: A[k], db: B[k] };
    }
  });
  if (best) {
    const { da, db } = best;
    if (da === 1 && db === 2) return pick('Nephew', 'Niece', 'Nibling');
    if (da === 2 && db === 1) return pick('Uncle', 'Aunt', "Parent's sibling");
    if (da >= 2 && db >= 2) {
      const deg = Math.min(da, db) - 1;
      const rem = Math.abs(da - db);
      return deg === 1 ? (rem ? `First cousin ${rem}× removed` : 'Cousin') : 'Cousin';
    }
    if (da === 1 && db > 2) return pick('Grand-nephew', 'Grand-niece', 'Grand-nibling');
    if (da > 2 && db === 1) return pick('Great-uncle', 'Great-aunt', 'Relative');
  }

  // In-law lookup — one spouse hop only. Bail before recursing again.
  if (depth > 0) return '';

  for (const s of spousesOf(data, otherId)) {
    const r = kin(data, focusId, s, depth + 1);
    if (r === 'Son') return 'Daughter-in-law';
    if (r === 'Daughter') return 'Son-in-law';
    if (r === 'Brother') return 'Sister-in-law';
    if (r === 'Sister') return 'Brother-in-law';
    if (r) return pick(`Husband of ${r.toLowerCase()}`, `Wife of ${r.toLowerCase()}`, `Spouse of ${r.toLowerCase()}`);
  }
  for (const s of spousesOf(data, focusId)) {
    const r = kin(data, s, otherId, depth + 1);
    if (r === 'Father') return 'Father-in-law';
    if (r === 'Mother') return 'Mother-in-law';
    if (r === 'Brother') return 'Brother-in-law';
    if (r === 'Sister') return 'Sister-in-law';
  }

  return 'Relative';
}

/**
 * Every person in the lineage descending from a union, plus the couple
 * themselves and any spouses who married into it. Drives branch highlighting.
 */
export function branchSet(data: TreeData, unionId: string): Record<string, boolean> | null {
  const u = data.unions.find(x => x.id === unionId);
  if (!u) return null;
  const set: Record<string, boolean> = {};
  [u.a, u.b].forEach(x => { if (x) set[x] = true; });
  const walk = (id: string) => {
    if (set[id]) return; // cycles shouldn't happen, but don't hang if the data is bad
    set[id] = true;
    spousesOf(data, id).forEach(s => { set[s] = true; });
    unionsOf(data, id).forEach(un => un.children.forEach(walk));
  };
  u.children.forEach(walk);
  return set;
}

/** Sentence form shown under the kinship selector. */
export function kinSentence(data: TreeData, focusId: string, otherId: string): string {
  const rel = kin(data, focusId, otherId);
  const f = byId(data, focusId), o = byId(data, otherId);
  if (!f || !o) return '';
  if (!rel) return '';
  return `${fullName(o)} is ${fullName(f)}'s ${rel.toLowerCase()}.`;
}

/** Breadcrumb of the hop between two people, rendered in monospace under the answer. */
export function kinPath(data: TreeData, focusId: string, otherId: string): string[] {
  const f = byId(data, focusId), o = byId(data, otherId);
  if (!f || !o || focusId === otherId) return [];
  const parents = parentsOf(data, otherId).map(x => fullName(byId(data, x)!)).filter(Boolean).join(' & ');
  const path = [fullName(f)];
  if (parents) path.push(parents);
  path.push(fullName(o));
  return path;
}

/**
 * Topmost ancestor of the tree, walked up from `rootId` (or the first person
 * on record). Guarded so a malformed parent cycle can't spin forever.
 */
export function getRoot(data: TreeData, rootId?: string): string {
  let r = rootId && byId(data, rootId) ? rootId : (data.persons[0]?.id || '');
  const seen = new Set<string>();
  let guard = 0;
  while (guard++ < 40) {
    if (seen.has(r)) break;
    seen.add(r);
    const ps = parentsOf(data, r);
    if (!ps.length) break;
    r = ps[0];
  }
  return r;
}

export function descendantCount(data: TreeData, unionId: string): number {
  const u = data.unions.find(x => x.id === unionId);
  if (!u) return 0;
  let n = 0;
  const walk = (id: string) => {
    n++;
    unionsOf(data, id).forEach(un => un.children.forEach(walk));
  };
  u.children.forEach(walk);
  return n;
}

export function initials(p: Person): string {
  return ((p.first[0] || '?') + (p.last[0] || '')).toUpperCase();
}

export function fullName(p: Person): string {
  return [p.first, p.middle, p.last].filter(Boolean).join(' ');
}

/**
 * The name as it fits on a tree card: "Ashok Kumar Gaur", or "Ashok K. Gaur"
 * when the full name would be cut off at the card's width.
 */
export function cardName(p: Person): string {
  const full = fullName(p);
  if (full.length <= 20 || !p.middle) return full;
  const middle = p.middle.split(/\s+/).map(w => `${w[0]}.`).join(' ');
  return [p.first, middle, p.last].filter(Boolean).join(' ');
}
