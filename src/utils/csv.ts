import type { Person, Union, Gender } from '../types';
import { parentsOf } from './kinship';

interface TreeData { persons: Person[]; unions: Union[]; }

/**
 * Column order for export, template and import. Relationships point at `ref`
 * values rather than names: names are not unique in a family, refs are.
 * Parents are "parent1/parent2", not "father/mother", so the format carries no
 * assumption about the parents' genders.
 */
export const CSV_COLUMNS = [
  'ref', 'first_name', 'last_name', 'maiden_name', 'gender',
  'birth_date', 'birth_place', 'death_date', 'death_place',
  'occupation', 'residency', 'gotra', 'shasan', 'label', 'bio',
  'parent1_ref', 'parent2_ref', 'spouse_refs', 'marriage_dates', 'marriage_places',
] as const;

type Col = typeof CSV_COLUMNS[number];

// ---------------------------------------------------------------- reading/writing

function cell(v: string): string {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Serialises rows as CSV with a UTF-8 BOM. Without the BOM, Excel opens the
 * file as Windows-1252 and mangles accented and Devanagari names.
 */
export function toCsv(rows: string[][]): string {
  return '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/** RFC 4180 parser: quoted fields, escaped quotes, and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  // Spreadsheet tools love trailing blank lines.
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

// ---------------------------------------------------------------- export & template

export function exportPeopleCsv(data: TreeData): string {
  const ordered = [...data.persons].sort((a, b) => String(a.dob).localeCompare(String(b.dob)));
  // Short sequential refs rather than database ids: keeps the file readable
  // and editable by hand, and doesn't publish internal uuids.
  const ref = new Map(ordered.map((p, i) => [p.id, `P${i + 1}`]));
  // Parent and spouse order carries no meaning, so sort by ref: the same tree
  // then always exports to the same bytes, which makes exports diffable.
  const rank = new Map(ordered.map((p, i) => [p.id, i]));
  const byRank = (x: string, y: string) => (rank.get(x) ?? 0) - (rank.get(y) ?? 0);

  const body = ordered.map(p => {
    const parents = [...parentsOf(data, p.id)].sort(byRank);
    const other = (u: Union) => (u.a === p.id ? u.b! : u.a!);
    const marriages = data.unions
      .filter(u => (u.a === p.id || u.b === p.id) && u.a && u.b)
      .sort((x, y) => byRank(other(x), other(y)));
    const record: Record<Col, string> = {
      ref: ref.get(p.id)!,
      first_name: p.first, last_name: p.last, maiden_name: p.maiden, gender: p.gender,
      birth_date: p.dob, birth_place: p.pob, death_date: p.dod, death_place: p.pod,
      occupation: p.occupation, residency: p.residency, gotra: p.gotra, shasan: p.shasan,
      label: p.label, bio: p.bio,
      parent1_ref: parents[0] ? ref.get(parents[0]) ?? '' : '',
      parent2_ref: parents[1] ? ref.get(parents[1]) ?? '' : '',
      spouse_refs: marriages.map(u => ref.get(other(u))).join(';'),
      marriage_dates: marriages.map(u => u.date).join(';'),
      marriage_places: marriages.map(u => u.place).join(';'),
    };
    return CSV_COLUMNS.map(c => record[c]);
  });

  return toCsv([[...CSV_COLUMNS], ...body]);
}

/** Header plus a worked example: a couple and their child. */
export function templateCsv(): string {
  const blank = (over: Partial<Record<Col, string>>) => CSV_COLUMNS.map(c => over[c] ?? '');
  return toCsv([
    [...CSV_COLUMNS],
    blank({ ref: 'P1', first_name: 'Example', last_name: 'Ancestor', gender: 'Male', birth_date: '1920', birth_place: 'Varanasi', death_date: '1990', label: 'Patriarch', spouse_refs: 'P2', marriage_dates: '1945-05-12', marriage_places: 'Varanasi' }),
    blank({ ref: 'P2', first_name: 'Example', last_name: 'Ancestor', maiden_name: 'Joshi', gender: 'Female', birth_date: '1925', label: 'Matriarch', spouse_refs: 'P1' }),
    blank({ ref: 'P3', first_name: 'Example', last_name: 'Child', gender: 'Other', birth_date: '1950-03-01', parent1_ref: 'P1', parent2_ref: 'P2' }),
  ]);
}

// ---------------------------------------------------------------- import planning

export interface ImportPerson {
  ref: string;
  first: string; last: string; maiden: string; gender: Gender;
  dob: string; pob: string; dod: string; pod: string;
  occupation: string; residency: string; gotra: string; shasan: string;
  label: string; bio: string;
}

export interface ImportUnion {
  a: string | null;
  b: string | null;
  date: string;
  place: string;
  children: string[];
}

export interface ImportPlan {
  people: ImportPerson[];
  unions: ImportUnion[];
  rootRef: string;
  errors: string[];
  warnings: string[];
}

function normGender(v: string): Gender | null {
  const s = v.trim().toLowerCase();
  if (s === 'male' || s === 'm') return 'Male';
  if (s === 'female' || s === 'f') return 'Female';
  if (s === '' || s === 'other' || s === 'o') return 'Other';
  return null;
}

/**
 * Parses and validates a CSV without writing anything. Everything the import
 * will do is decided here, so the preview shows exactly what gets created and
 * a file with errors can never be half-applied.
 */
export function planImport(text: string): ImportPlan {
  const errors: string[] = [];
  const warnings: string[] = [];
  const empty: ImportPlan = { people: [], unions: [], rootRef: '', errors, warnings };

  const rows = parseCsv(text);
  if (rows.length < 2) {
    errors.push('The file has no data rows.');
    return empty;
  }

  const header = rows[0].map(h => h.trim().toLowerCase());
  const idx = Object.fromEntries(CSV_COLUMNS.map(c => [c, header.indexOf(c)])) as Record<Col, number>;
  for (const required of ['ref', 'first_name', 'last_name'] as const) {
    if (idx[required] < 0) errors.push(`Missing the "${required}" column. Start from the template.`);
  }
  if (errors.length) return empty;

  const get = (r: string[], c: Col) => (idx[c] >= 0 ? (r[idx[c]] ?? '').trim() : '');
  const list = (v: string) => v.split(';').map(s => s.trim());

  const people: ImportPerson[] = [];
  const seen = new Set<string>();
  const links: Array<{ ref: string; line: number; p1: string; p2: string; spouses: string[]; dates: string[]; places: string[] }> = [];

  rows.slice(1).forEach((r, i) => {
    const line = i + 2; // 1-based, after the header
    const ref = get(r, 'ref');
    const first = get(r, 'first_name');
    const last = get(r, 'last_name');
    if (!ref) { errors.push(`Row ${line}: "ref" is empty.`); return; }
    if (seen.has(ref)) { errors.push(`Row ${line}: ref "${ref}" is used more than once.`); return; }
    seen.add(ref);
    if (!first || !last) errors.push(`Row ${line} (${ref}): first and last name are both required.`);
    const gender = normGender(get(r, 'gender'));
    if (!gender) errors.push(`Row ${line} (${ref}): gender "${get(r, 'gender')}" isn't Male, Female or Other.`);

    people.push({
      ref, first, last, maiden: get(r, 'maiden_name'), gender: gender ?? 'Other',
      dob: get(r, 'birth_date'), pob: get(r, 'birth_place'),
      dod: get(r, 'death_date'), pod: get(r, 'death_place'),
      occupation: get(r, 'occupation'), residency: get(r, 'residency'),
      gotra: get(r, 'gotra'), shasan: get(r, 'shasan'),
      label: get(r, 'label'), bio: get(r, 'bio'),
    });
    links.push({
      ref, line,
      p1: get(r, 'parent1_ref'), p2: get(r, 'parent2_ref'),
      spouses: get(r, 'spouse_refs') ? list(get(r, 'spouse_refs')) : [],
      dates: list(get(r, 'marriage_dates')),
      places: list(get(r, 'marriage_places')),
    });
  });

  const known = (ref: string, line: number, what: string) => {
    if (seen.has(ref)) return true;
    errors.push(`Row ${line}: ${what} "${ref}" doesn't match any ref in the file.`);
    return false;
  };

  // One union per unordered pair, whether it came from a marriage or from two
  // parents of the same child.
  const unions = new Map<string, ImportUnion>();
  const pairKey = (x: string | null, y: string | null) => [x ?? '', y ?? ''].sort().join('|');
  const unionFor = (x: string | null, y: string | null) => {
    const k = pairKey(x, y);
    let u = unions.get(k);
    if (!u) { u = { a: x, b: y, date: '', place: '', children: [] }; unions.set(k, u); }
    return u;
  };

  for (const l of links) {
    l.spouses.forEach((s, i) => {
      if (!s) return;
      if (s === l.ref) { errors.push(`Row ${l.line}: ${l.ref} is listed as their own spouse.`); return; }
      if (!known(s, l.line, 'spouse')) return;
      const u = unionFor(l.ref, s);
      if (!u.date && l.dates[i]) u.date = l.dates[i];
      if (!u.place && l.places[i]) u.place = l.places[i];
    });

    const parents = [l.p1, l.p2].filter(Boolean);
    if (parents.some(p => p === l.ref)) { errors.push(`Row ${l.line}: ${l.ref} is listed as their own parent.`); continue; }
    if (parents.length === 2 && parents[0] === parents[1]) { errors.push(`Row ${l.line}: both parents are "${parents[0]}".`); continue; }
    if (!parents.every(p => known(p, l.line, 'parent'))) continue;
    if (parents.length) unionFor(parents[0], parents[1] ?? null).children.push(l.ref);
  }

  // Someone can't be their own ancestor. Walks parent links looking for a loop.
  const parentsOfRef = new Map<string, string[]>();
  links.forEach(l => parentsOfRef.set(l.ref, [l.p1, l.p2].filter(Boolean)));
  const state = new Map<string, 1 | 2>(); // 1 = on the current path, 2 = done
  const cyclic = (ref: string): boolean => {
    if (state.get(ref) === 1) return true;
    if (state.get(ref) === 2) return false;
    state.set(ref, 1);
    const hit = (parentsOfRef.get(ref) ?? []).some(cyclic);
    state.set(ref, 2);
    return hit;
  };
  if (people.some(p => cyclic(p.ref))) errors.push('Someone is listed as their own ancestor. Check the parent refs for a loop.');

  const unionList = [...unions.values()];

  // Root: of the people with no parents, the one with the most descendants.
  const childrenOfRef = (ref: string) => unionList.filter(u => u.a === ref || u.b === ref).flatMap(u => u.children);
  const descendants = (ref: string, guard = new Set<string>()): number => {
    if (guard.has(ref)) return 0;
    guard.add(ref);
    return childrenOfRef(ref).reduce((n, c) => n + 1 + descendants(c, guard), 0);
  };
  const tops = people.filter(p => !(parentsOfRef.get(p.ref) ?? []).length);
  const rootRef = [...tops].sort((x, y) =>
    descendants(y.ref) - descendants(x.ref) || x.dob.localeCompare(y.dob))[0]?.ref ?? people[0]?.ref ?? '';

  // Mirror the tree layout: it draws the root, their spouses, and descendants
  // through the root line. A married-in spouse's own parents are not drawn.
  if (rootRef && !errors.length) {
    const visible = new Set<string>();
    const visit = (ref: string) => {
      if (visible.has(ref)) return;
      visible.add(ref);
      unionList.filter(u => u.a === ref || u.b === ref).forEach(u => {
        [u.a, u.b].forEach(p => p && visible.add(p));
        u.children.forEach(visit);
      });
    };
    visit(rootRef);
    const hidden = people.filter(p => !visible.has(p.ref));
    if (hidden.length) {
      warnings.push(
        `${hidden.length} ${hidden.length === 1 ? 'person' : 'people'} won't appear in Tree view ` +
        `(${hidden.slice(0, 4).map(p => `${p.first} ${p.last}`).join(', ')}${hidden.length > 4 ? '…' : ''}) — ` +
        'usually a married-in spouse\'s own family. They will still be listed in Directory view.',
      );
    }
  }

  return { people, unions: unionList, rootRef, errors, warnings };
}
