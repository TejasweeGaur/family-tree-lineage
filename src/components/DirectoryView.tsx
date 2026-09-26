import { useTreeStore } from '../store/useTreeStore';
import { palette } from '../utils/palette';
import { lifeDates } from '../utils/dates';
import { initials, fullName, spousesOf } from '../utils/kinship';

export function DirectoryView() {
  const store = useTreeStore();
  const { persons, unions, dirSort, dirSortAsc, setDirSort, openPanel, filters } = store;

  const data = { persons, unions };
  const q = filters.q.trim().toLowerCase();

  let rows = persons.filter(p => {
    if (q) return `${p.first} ${p.last} ${p.maiden}`.toLowerCase().includes(q);
    if (filters.gender !== 'All') return p.gender === filters.gender;
    return true;
  });

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

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '22px 20px 40px' }}>
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
                  {p.maiden && <span style={{ display: 'block', fontSize: 11, color: '#8A817A', fontStyle: 'italic' }}>née {p.maiden}</span>}
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
