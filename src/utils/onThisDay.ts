import type { Person, Union } from '../types';
import { fullName, parentsOf } from './kinship';

interface TreeData { persons: Person[]; unions: Union[]; }

export interface DayEvent {
  kind: 'birthday' | 'anniversary' | 'remembrance';
  /** People to open when the event is clicked. */
  personIds: string[];
  title: string;
  detail: string;
  /** 0 = today. */
  daysAway: number;
  /** The day it falls on, this year or next. */
  on: Date;
}

export interface Fact {
  label: string;
  value: string;
  sub: string;
  personId?: string;
}

/** Only full YYYY-MM-DD dates can land on a calendar day. */
function parseFull(d: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d ?? '').trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], da = +m[3];
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  return { y, m: mo, d: da };
}

function yearOf(d: string): number | null {
  const m = /^(\d{4})/.exec(String(d ?? '').trim());
  return m ? +m[1] : null;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * The next time month/day comes round, on or after `from` (time ignored).
 * 29 February falls back to the 28th in non-leap years, so leap-day birthdays
 * aren't silently skipped three years in four.
 */
function nextOccurrence(month: number, day: number, from: Date): Date {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (const y of [start.getFullYear(), start.getFullYear() + 1]) {
    const d = month === 2 && day === 29 && !isLeap(y) ? 28 : day;
    const when = new Date(y, month - 1, d);
    if (when >= start) return when;
  }
  return new Date(start.getFullYear() + 1, month - 1, day);
}

const DAY_MS = 86_400_000;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Every birthday, anniversary and remembrance within `days` of `from`. */
export function eventsWithin(data: TreeData, from: Date, days: number): DayEvent[] {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const out: DayEvent[] = [];
  const byId = new Map(data.persons.map(p => [p.id, p]));

  const add = (e: Omit<DayEvent, 'daysAway'>) => {
    const daysAway = Math.round((e.on.getTime() - start.getTime()) / DAY_MS);
    if (daysAway >= 0 && daysAway <= days) out.push({ ...e, daysAway });
  };

  for (const p of data.persons) {
    const b = parseFull(p.dob);
    if (b) {
      const on = nextOccurrence(b.m, b.d, start);
      const age = on.getFullYear() - b.y;
      if (age > 0) {
        add({
          kind: 'birthday', personIds: [p.id], title: fullName(p), on,
          detail: p.dod ? `Would have been ${age} · born ${b.y}` : `Turns ${age}`,
        });
      }
    }
    const dd = parseFull(p.dod);
    if (dd) {
      const on = nextOccurrence(dd.m, dd.d, start);
      const years = on.getFullYear() - dd.y;
      if (years > 0) {
        add({
          kind: 'remembrance', personIds: [p.id], title: fullName(p), on,
          detail: `${plural(years, 'year')} since passing · ${dd.y}`,
        });
      }
    }
  }

  for (const u of data.unions) {
    const m = parseFull(u.date);
    const a = u.a ? byId.get(u.a) : undefined;
    const b = u.b ? byId.get(u.b) : undefined;
    if (!m || !a || !b) continue;
    const on = nextOccurrence(m.m, m.d, start);
    const years = on.getFullYear() - m.y;
    if (years <= 0) continue;
    const together = !a.dod && !b.dod;
    add({
      kind: 'anniversary', personIds: [a.id, b.id], on,
      title: `${a.first} & ${b.first} ${a.last === b.last ? a.last : ''}`.trim(),
      detail: together ? `${plural(years, 'year')} married` : `Married ${plural(years, 'year')} ago · ${m.y}`,
    });
  }

  const order = { birthday: 0, anniversary: 1, remembrance: 2 };
  return out.sort((x, y) => x.daysAway - y.daysAway || order[x.kind] - order[y.kind]);
}

/** A handful of facts about the family, skipping any the data can't support. */
export function familyFacts(data: TreeData, now = new Date()): Fact[] {
  const facts: Fact[] = [];
  const thisYear = now.getFullYear();
  const living = data.persons.filter(p => !p.dod);

  facts.push({
    label: 'Family members',
    value: String(data.persons.length),
    sub: `${living.length} living · ${data.persons.length - living.length} remembered`,
  });

  // Generations: the longest chain of parent links, memoised and cycle-safe.
  const depth = new Map<string, number>();
  const depthOf = (id: string, seen = new Set<string>()): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (seen.has(id)) return 1;
    seen.add(id);
    const ps = parentsOf(data, id);
    const d = 1 + (ps.length ? Math.max(...ps.map(p => depthOf(p, seen))) : 0);
    depth.set(id, d);
    return d;
  };
  const gens = data.persons.length ? Math.max(...data.persons.map(p => depthOf(p.id))) : 0;
  if (gens > 1) facts.push({ label: 'Generations', value: String(gens), sub: 'recorded in this tree' });

  const oldest = living
    .map(p => ({ p, y: yearOf(p.dob) }))
    .filter((x): x is { p: Person; y: number } => x.y !== null)
    .sort((a, b) => a.y - b.y)[0];
  if (oldest) {
    facts.push({ label: 'Oldest living member', value: fullName(oldest.p), sub: `about ${thisYear - oldest.y}`, personId: oldest.p.id });
  }

  const longest = data.persons
    .map(p => ({ p, b: yearOf(p.dob), d: yearOf(p.dod) }))
    .filter((x): x is { p: Person; b: number; d: number } => x.b !== null && x.d !== null && x.d >= x.b)
    .sort((a, b) => (b.d - b.b) - (a.d - a.b))[0];
  if (longest) {
    facts.push({ label: 'Longest life', value: fullName(longest.p), sub: `${longest.d - longest.b} years · ${longest.b}–${longest.d}`, personId: longest.p.id });
  }

  const earliest = data.persons
    .map(p => ({ p, y: yearOf(p.dob) }))
    .filter((x): x is { p: Person; y: number } => x.y !== null)
    .sort((a, b) => a.y - b.y)[0];
  if (earliest) {
    facts.push({ label: 'Earliest recorded birth', value: String(earliest.y), sub: fullName(earliest.p), personId: earliest.p.id });
  }

  const byId = new Map(data.persons.map(p => [p.id, p]));
  const marriage = data.unions
    .map(u => {
      const a = u.a ? byId.get(u.a) : undefined;
      const b = u.b ? byId.get(u.b) : undefined;
      const start = yearOf(u.date);
      if (!a || !b || start === null) return null;
      // A marriage lasts until the first partner's death, or to today.
      const ends = [yearOf(a.dod), yearOf(b.dod)].filter((y): y is number => y !== null);
      const end = ends.length ? Math.min(...ends) : thisYear;
      return { a, b, years: end - start, ongoing: !ends.length };
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.years > 0)
    .sort((x, y) => y.years - x.years)[0];
  if (marriage) {
    facts.push({
      label: 'Longest marriage', value: `${marriage.a.first} & ${marriage.b.first}`,
      sub: `${marriage.years} years${marriage.ongoing ? ' and counting' : ''}`, personId: marriage.a.id,
    });
  }

  const biggest = [...data.unions].sort((x, y) => y.children.length - x.children.length)[0];
  if (biggest && biggest.children.length >= 2) {
    const names = [biggest.a, biggest.b].map(id => (id ? byId.get(id)?.first : undefined)).filter(Boolean).join(' & ');
    facts.push({ label: 'Largest family', value: names || 'One family', sub: `${biggest.children.length} children`, personId: biggest.a ?? biggest.b ?? undefined });
  }

  const places = new Map<string, number>();
  data.persons.forEach(p => { const k = p.pob.trim(); if (k) places.set(k, (places.get(k) ?? 0) + 1); });
  const topPlace = [...places].sort((a, b) => b[1] - a[1])[0];
  if (topPlace && topPlace[1] >= 2) {
    facts.push({ label: 'Most common birthplace', value: topPlace[0], sub: `${topPlace[1]} family members born here` });
  }

  return facts;
}
