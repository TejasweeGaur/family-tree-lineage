import { useTreeStore } from '../store/useTreeStore';
import { fullName, initials } from '../utils/kinship';
import { palette } from '../utils/palette';
import { year } from '../utils/dates';

/** Search across people, places and archive titles, each tagged in the results. */
export function HeaderSearch({ autoFocus }: { autoFocus?: boolean }) {
  const persons = useTreeStore(s => s.persons);
  const headerQ = useTreeStore(s => s.headerQ);
  const setHeaderQ = useTreeStore(s => s.setHeaderQ);
  const openPanel = useTreeStore(s => s.openPanel);
  const setView = useTreeStore(s => s.setView);

  const q = headerQ.trim().toLowerCase();
  const results = q.length > 1
    ? persons.flatMap(p => {
        const out: Array<{ id: string; title: string; sub: string; tag: string }> = [];
        if (`${p.first} ${p.middle} ${p.last}`.toLowerCase().includes(q)) {
          out.push({ id: p.id, title: fullName(p), sub: `${p.label} · ${year(p.dob)}`, tag: 'PERSON' });
        } else if (`${p.pob} ${p.residency}`.toLowerCase().includes(q)) {
          out.push({ id: p.id, title: fullName(p), sub: p.residency || p.pob, tag: 'PLACE' });
        } else {
          const rec = p.archives.find(a => a.title.toLowerCase().includes(q));
          if (rec) out.push({ id: p.id, title: rec.title, sub: `${fullName(p)} · ${rec.year}`, tag: 'RECORD' });
        }
        return out;
      }).slice(0, 8)
    : [];

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8A29E" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 13, top: 11 }}>
        <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.4-3.4" />
      </svg>
      <input
        type="text"
        placeholder="Search ancestors, names, places"
        value={headerQ}
        onChange={e => setHeaderQ(e.target.value)}
        autoFocus={autoFocus}
        aria-label="Search the tree"
        style={{
          width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 36px',
          borderRadius: 10, border: '1px solid #E7E2DC', background: '#FAF8F5',
          fontSize: 13, color: '#1C1917', outline: 'none', fontFamily: 'inherit',
        }}
      />
      {q.length > 1 && (
        <div style={{
          position: 'absolute', top: 44, left: 0, right: 0, background: '#fff',
          border: '1px solid #E7E2DC', borderRadius: 14,
          boxShadow: '0 18px 44px rgba(28,25,23,.14)', padding: 7,
          maxHeight: 340, overflowY: 'auto', zIndex: 60,
        }}>
          {results.length === 0 && (
            <div style={{ padding: 14, fontSize: 12.5, color: '#A8A29E', textAlign: 'center' }}>No matches</div>
          )}
          {results.map((r, i) => {
            const p = persons.find(x => x.id === r.id)!;
            const c = palette(p.gender);
            return (
              <button
                key={`${r.id}-${i}`}
                type="button"
                onClick={() => { openPanel(r.id); setView('tree'); }}
                style={{
                  display: 'flex', width: '100%', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 9, border: 'none',
                  background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                }}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: c.avFill, color: c.avText,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10.5, fontWeight: 800,
                }}>
                  {initials(p)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{r.title}</span>
                  <span style={{ display: 'block', fontSize: 11, color: '#78716C' }}>{r.sub}</span>
                </span>
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', color: '#A8A29E' }}>{r.tag}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
