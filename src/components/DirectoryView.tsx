import { useMemo } from 'react';
import { useTreeStore } from '../store/useTreeStore';
import { palette } from '../utils/palette';
import { lifeDates, ageYears } from '../utils/dates';
import { initials, fullName, spousesOf, parentsOf, directLineage } from '../utils/kinship';
import type { Person } from '../types';

interface Row {
  p: Person;
  age: string;
  father: string;
  mother: string;
  spouses: string;
}

export function DirectoryView() {
  const persons = useTreeStore(s => s.persons);
  const unions = useTreeStore(s => s.unions);
  const dirSort = useTreeStore(s => s.dirSort);
  const dirSortAsc = useTreeStore(s => s.dirSortAsc);
  const filters = useTreeStore(s => s.filters);
  const showAll = useTreeStore(s => s.dirShowAll);
  const isMobile = useTreeStore(s => s.winW < 640);
  const { setDirSort, openPanel, setDirShowAll } = useTreeStore.getState();

  const data = useMemo(() => ({ persons, unions }), [persons, unions]);
  const lineage = useMemo(() => directLineage(data), [data]);
  const byId = useMemo(() => new Map(persons.map(p => [p.id, p])), [persons]);
  const q = filters.q.trim().toLowerCase();

  // Married-in people (and any siblings or parents recorded for them) are left
  // out by default; they still appear by name in the Spouse column.
  const rows: Row[] = persons
    .filter(p => showAll || lineage.has(p.id))
    .filter(p =>
      (!q || `${p.first} ${p.middle} ${p.last}`.toLowerCase().includes(q))
      && (filters.gender === 'All' || p.gender === filters.gender))
    .sort((a, b) => {
      let av = '', bv = '';
      if (dirSort === 'name') { av = `${a.last} ${a.first}`; bv = `${b.last} ${b.first}`; }
      else if (dirSort === 'dob') { av = a.dob; bv = b.dob; }
      else { av = a.label; bv = b.label; }
      return dirSortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    })
    .map(p => {
      const parents = parentsOf(data, p.id).map(id => byId.get(id)).filter(Boolean) as Person[];
      const father = parents.find(x => x.gender === 'Male');
      const mother = parents.find(x => x.gender === 'Female');
      const age = ageYears(p.dob, p.dod);
      return {
        p,
        age: age === null ? '—' : p.dod ? `${age} (at death)` : String(age),
        // Married-in people's parents are often noted as text on their profile.
        father: father ? fullName(father) : p.originFather || '—',
        mother: mother ? fullName(mother) : p.originMother || '—',
        spouses: spousesOf(data, p.id).map(id => byId.get(id)).filter(Boolean).map(s => fullName(s!)).join(', ') || '—',
      };
    });

  const total = showAll ? persons.length : lineage.size;
  const toggle = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: '#44403C' }}>
      <input
        type="checkbox"
        checked={showAll}
        onChange={e => setDirShowAll(e.target.checked)}
        style={{ width: 17, height: 17, accentColor: '#C2410C', cursor: 'pointer', margin: 0 }}
      />
      Show siblings/parents of married-in people
    </label>
  );
  const countLabel = (
    <span style={{ fontSize: 12, fontWeight: 700, color: '#78716C' }}>
      {rows.length === total ? `${total}` : `${rows.length} of ${total}`} {total === 1 ? 'person' : 'people'}
      {!showAll && ' in the direct line'}
    </span>
  );
  const empty = (
    <div style={{ padding: '36px 16px', textAlign: 'center', color: '#A8A29E', fontSize: 13, fontStyle: 'italic' }}>
      No individuals match your filters.
    </div>
  );

  if (isMobile) {
    // Phones: one row per person. Columns squeezed names down to a letter.
    return (
      <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '12px 12px 24px' }}>
        <div style={{ marginBottom: 10 }}>{toggle}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {countLabel}
          <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#78716C' }}>
            Sort
            <select
              value={`${dirSort}:${dirSortAsc ? 'asc' : 'desc'}`}
              onChange={e => {
                const [key, dir] = e.target.value.split(':') as ['name' | 'dob' | 'label', string];
                // setDirSort flips the direction when the key is unchanged.
                if (key !== dirSort) setDirSort(key);
                if ((dir === 'asc') !== useTreeStore.getState().dirSortAsc) setDirSort(key);
              }}
              style={{ padding: '7px 9px', borderRadius: 9, border: '1px solid #E7E2DC', background: '#fff', fontWeight: 600, color: '#44403C', fontFamily: 'inherit' }}
            >
              <option value="name:asc">Name A–Z</option>
              <option value="name:desc">Name Z–A</option>
              <option value="dob:asc">Oldest first</option>
              <option value="dob:desc">Youngest first</option>
              <option value="label:asc">Relationship</option>
            </select>
          </label>
        </div>
        <div style={{ background: '#FFFDFB', border: '1px solid #E7E2DC', borderRadius: 14, overflow: 'hidden' }}>
          {rows.map(({ p, age, father, mother, spouses }, i) => {
            const c = palette(p.gender);
            const parents = [father, mother].filter(x => x !== '—').join(' & ');
            return (
              <button key={p.id} type="button" onClick={() => openPanel(p.id)} style={{
                display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '11px 12px',
                border: 'none', borderTop: i ? '1px solid #F3EFEA' : 'none', background: 'none',
                textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: '#1C1917',
              }}>
                <span style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: c.avFill, color: c.avText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 800, boxShadow: `0 0 0 2px ${c.border}` }}>
                  {initials(p)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName(p)}</span>
                  <span style={{ display: 'block', fontSize: 12, color: '#78716C', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[p.label, spouses !== '—' ? `Spouse: ${spouses}` : ''].filter(Boolean).join(' · ') || '—'}
                  </span>
                  {parents && (
                    <span style={{ display: 'block', fontSize: 12, color: '#78716C', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Child of {parents}
                    </span>
                  )}
                  {lifeDates(p.dob, p.dod) && (
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: c.accent, marginTop: 1 }}>
                      {lifeDates(p.dob, p.dod)}{age !== '—' && <span style={{ color: '#78716C', fontWeight: 600 }}> · Age {age}</span>}
                    </span>
                  )}
                </span>
                {p.archives.length > 0 && (
                  <span title="Archive records" style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 99, background: '#F5F1EC', fontSize: 11, fontWeight: 800, color: '#78716C' }}>{p.archives.length}</span>
                )}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4BDB6" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>
              </button>
            );
          })}
          {rows.length === 0 && empty}
        </div>
      </div>
    );
  }

  const cols: Array<{ key: string; label: string; sort?: 'name' | 'dob' | 'label' }> = [
    { key: 'name', label: 'NAME', sort: 'name' },
    { key: 'gender', label: 'GENDER' },
    { key: 'dob', label: 'DATES', sort: 'dob' },
    { key: 'age', label: 'AGE' },
    { key: 'label', label: 'RELATIONSHIP', sort: 'label' },
    { key: 'father', label: 'FATHER' },
    { key: 'mother', label: 'MOTHER' },
    { key: 'spouse', label: 'SPOUSE' },
    { key: 'archives', label: 'ARCHIVES' },
  ];
  const grid = '1.9fr .75fr 1.05fr .7fr 1fr 1.25fr 1.25fr 1.35fr .55fr';
  const cell: React.CSSProperties = { fontSize: 12, color: '#57534E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '18px 20px 40px' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
          {toggle}
          <span style={{ marginLeft: 'auto' }}>{countLabel}</span>
        </div>

        <div style={{ background: '#FFFDFB', border: '1px solid #E7E2DC', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 12, padding: '12px 18px', background: '#FAF7F3', borderBottom: '1px solid #EFE9E2' }}>
            {cols.map(c => (
              <button key={c.key} type="button" onClick={() => c.sort && setDirSort(c.sort)} style={{
                border: 'none', background: 'none', padding: 0, cursor: c.sort ? 'pointer' : 'default',
                textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.11em', fontFamily: 'inherit',
                color: dirSort === c.sort ? '#C2410C' : '#78716C',
              }}>
                {c.label} {c.sort && dirSort === c.sort ? (dirSortAsc ? '↑' : '↓') : ''}
              </button>
            ))}
          </div>

          {rows.map(({ p, age, father, mother, spouses }) => {
            const c = palette(p.gender);
            return (
              <div key={p.id} onClick={() => openPanel(p.id)} style={{
                display: 'grid', gridTemplateColumns: grid,
                gap: 12, padding: '11px 18px', borderBottom: '1px solid #F3EFEA',
                cursor: 'pointer', alignItems: 'center',
              }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FAF8F5'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                  <span style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: c.avFill, color: c.avText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                    {initials(p)}
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fullName(p)}>{fullName(p)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#57534E' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.border, flexShrink: 0 }} />
                  {p.gender}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: c.accent }}>{lifeDates(p.dob, p.dod)}</div>
                <div style={cell}>{age}</div>
                <div style={cell} title={p.label}>{p.label}</div>
                <div style={cell} title={father}>{father}</div>
                <div style={cell} title={mother}>{mother}</div>
                <div style={cell} title={spouses}>{spouses}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#78716C' }}>{p.archives.length}</div>
              </div>
            );
          })}

          {rows.length === 0 && empty}
        </div>
      </div>
    </div>
  );
}
