import { useTreeStore } from '../store/useTreeStore';
import { palette } from '../utils/palette';
import { lifeDates } from '../utils/dates';
import { initials, fullName, spousesOf } from '../utils/kinship';

export function DirectoryView() {
  const persons = useTreeStore(s => s.persons);
  const unions = useTreeStore(s => s.unions);
  const dirSort = useTreeStore(s => s.dirSort);
  const dirSortAsc = useTreeStore(s => s.dirSortAsc);
  const filters = useTreeStore(s => s.filters);
  const isMobile = useTreeStore(s => s.winW < 640);
  const { setDirSort, openPanel } = useTreeStore.getState();

  const data = { persons, unions };
  const q = filters.q.trim().toLowerCase();

  // Name and gender both apply: a name search used to ignore the gender filter.
  let rows = persons.filter(p =>
    (!q || `${p.first} ${p.middle} ${p.last}`.toLowerCase().includes(q))
    && (filters.gender === 'All' || p.gender === filters.gender));

  rows = [...rows].sort((a, b) => {
    let av = '', bv = '';
    if (dirSort === 'name') { av = `${a.last} ${a.first}`; bv = `${b.last} ${b.first}`; }
    else if (dirSort === 'dob') { av = a.dob; bv = b.dob; }
    else { av = a.label; bv = b.label; }
    return dirSortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const cols: Array<{ key: string; label: string }> = [
    { key: 'name', label: 'NAME' },
    { key: 'gender', label: 'GENDER' },
    { key: 'dob', label: 'DATES' },
    { key: 'label', label: 'RELATIONSHIP' },
    { key: 'spouse', label: 'SPOUSE' },
    { key: 'archives', label: 'ARCHIVES' },
  ];

  if (isMobile) {
    // Phones: one row per person. Six columns squeezed names down to a letter.
    return (
      <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '12px 12px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#78716C' }}>{rows.length} {rows.length === 1 ? 'person' : 'people'}</span>
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
          {rows.map((p, i) => {
            const c = palette(p.gender);
            const sp = spousesOf(data, p.id).map(id => persons.find(x => x.id === id)).find(Boolean);
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
                    {[p.label, sp ? `m. ${fullName(sp)}` : ''].filter(Boolean).join(' · ') || '—'}
                  </span>
                  {lifeDates(p.dob, p.dod) && <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: c.accent, marginTop: 1 }}>{lifeDates(p.dob, p.dod)}</span>}
                </span>
                {p.archives.length > 0 && (
                  <span title="Archive records" style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 99, background: '#F5F1EC', fontSize: 11, fontWeight: 800, color: '#78716C' }}>{p.archives.length}</span>
                )}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4BDB6" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>
              </button>
            );
          })}
          {rows.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#A8A29E', fontSize: 13, fontStyle: 'italic' }}>
              No individuals match your filters.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '22px 20px 40px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', background: '#FFFDFB', border: '1px solid #E7E2DC', borderRadius: 16, overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2.1fr .8fr 1fr 1.1fr 1fr .6fr', gap: 14, padding: '12px 18px', background: '#FAF7F3', borderBottom: '1px solid #EFE9E2' }}>
          {cols.map(c => (
            <button key={c.key} type="button" onClick={() => (c.key === 'name' || c.key === 'dob' || c.key === 'label') ? setDirSort(c.key as any) : undefined} style={{
              border: 'none', background: 'none', padding: 0, cursor: 'pointer',
              textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.11em',
              color: dirSort === c.key ? '#C2410C' : '#78716C',
            }}>
              {c.label} {dirSort === c.key ? (dirSortAsc ? '↑' : '↓') : ''}
            </button>
          ))}
        </div>

        {rows.map(p => {
          const c = palette(p.gender);
          const spouseIds = spousesOf(data, p.id);
          const spousePerson = spouseIds[0] ? persons.find(x => x.id === spouseIds[0]) : null;

          return (
            <div key={p.id} onClick={() => openPanel(p.id)} style={{
              display: 'grid', gridTemplateColumns: '2.1fr .8fr 1fr 1.1fr 1fr .6fr',
              gap: 14, padding: '12px 18px', borderBottom: '1px solid #F3EFEA',
              cursor: 'pointer', alignItems: 'center',
            }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FAF8F5'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
            >
              {/* Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <span style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: c.avFill, color: c.avText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                  {initials(p)}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName(p)}</span>
                </span>
              </div>

              {/* Gender */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#57534E' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.border }} />
                {p.gender}
              </div>

              {/* Dates */}
              <div style={{ fontSize: 12.5, fontWeight: 700, color: c.accent }}>
                {lifeDates(p.dob, p.dod)}
              </div>

              {/* Relationship */}
              <div style={{ fontSize: 12, color: '#57534E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</div>

              {/* Spouse */}
              <div style={{ fontSize: 12, color: '#57534E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {spousePerson ? fullName(spousePerson) : '—'}
              </div>

              {/* Archives */}
              <div style={{ fontSize: 12, fontWeight: 700, color: '#78716C' }}>{p.archives.length}</div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#A8A29E', fontSize: 13, fontStyle: 'italic' }}>
            No individuals match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
