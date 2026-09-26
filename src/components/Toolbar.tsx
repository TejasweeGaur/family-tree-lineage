import { useTreeStore } from '../store/useTreeStore';

const ERAS = [
  { label: 'Before 1900', from: '', to: '1899' },
  { label: '1900–1950', from: '1900', to: '1950' },
  { label: '1951–2000', from: '1951', to: '2000' },
  { label: '2000+', from: '2000', to: '' },
];

export function Toolbar() {
  const filters = useTreeStore(s => s.filters);
  const showFilters = useTreeStore(s => s.showFilters);
  const persons = useTreeStore(s => s.persons);
  const unions = useTreeStore(s => s.unions);
  const collapsed = useTreeStore(s => s.collapsed);
  const view = useTreeStore(s => s.view);
  const winW = useTreeStore(s => s.winW);
  const setFilter = useTreeStore(s => s.setFilter);
  const clearFilters = useTreeStore(s => s.clearFilters);
  const toggleFilters = useTreeStore(s => s.toggleFilters);
  const toggleRelatives = useTreeStore(s => s.toggleRelatives);
  const expandAll = useTreeStore(s => s.expandAll);
  const collapseAll = useTreeStore(s => s.collapseAll);

  const { q, gender, status, from, to, showRelatives } = filters;
  const filterActive = !!(q || gender !== 'All' || status !== 'All' || from || to);
  const isMobile = winW < 640;

  const matchCount = filterActive
    ? persons.filter(p => {
        if (q && !`${p.first} ${p.last} ${p.maiden}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
        if (gender !== 'All' && p.gender !== gender) return false;
        if (status === 'Living' && p.dod) return false;
        if (status === 'Deceased' && !p.dod) return false;
        const yr = parseInt(p.dob?.slice(0, 4) || '0', 10);
        if (from && yr < parseInt(from, 10)) return false;
        if (to && yr > parseInt(to, 10)) return false;
        return true;
      }).length
    : null;

  // The segmented control reflects the real state rather than the last click.
  const withKids = unions.filter(u => u.children.length);
  const allOpen = withKids.every(u => !collapsed[u.id]);
  const allShut = withKids.filter(u => !collapsed[u.id]).length <= 1;

  return (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
      padding: `11px ${isMobile ? 12 : 20}px`,
      background: '#FFFDFB', borderBottom: '1px solid #E7E2DC',
      position: 'relative', zIndex: 30,
    }}>
      <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 300 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A8A29E" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: 10 }}>
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.4-3.4" />
        </svg>
        <input
          type="text"
          placeholder="Find individuals by name…"
          value={q}
          onChange={e => setFilter('q', e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 34px', borderRadius: 9, border: '1px solid #E7E2DC', background: '#FAF8F5', fontSize: 12.5, outline: 'none', fontFamily: 'inherit' }}
        />
      </div>

      <select
        value={gender}
        onChange={e => setFilter('gender', e.target.value)}
        style={{ padding: '8px 11px', borderRadius: 9, border: '1px solid #E7E2DC', background: '#FAF8F5', fontSize: 12.5, fontWeight: 600, color: '#44403C', outline: 'none', fontFamily: 'inherit' }}
      >
        <option value="All">All genders</option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
        <option value="Other">Other</option>
      </select>

      <div style={{ position: 'relative' }}>
        <button type="button" onClick={toggleFilters} style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 9,
          cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
          background: filterActive ? '#FEF3C7' : '#FAF8F5',
          border: `1px solid ${filterActive ? '#FCD34D' : '#E7E2DC'}`,
          color: '#44403C',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"><path d="M4 5h16l-6 7v6l-4 2v-8z" /></svg>
          Filters {filterActive && '•'}
        </button>

        {showFilters && (
          <div style={{
            position: 'absolute', top: 42, left: 0,
            width: 300, maxWidth: 'calc(100vw - 28px)',
            background: '#fff', border: '1px solid #E7E2DC', borderRadius: 16,
            boxShadow: '0 18px 44px rgba(28,25,23,.14)', padding: 15, zIndex: 60,
          }}>
            <div style={eyebrow}>BIRTH YEAR</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 11 }}>
              {ERAS.map(e => {
                const on = from === e.from && to === e.to;
                return (
                  <button key={e.label} type="button" onClick={() => { setFilter('from', e.from); setFilter('to', e.to); }} style={{
                    padding: '6px 11px', borderRadius: 99, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
                    background: on ? '#FEF6F1' : '#fff',
                    border: `1px solid ${on ? '#C2410C' : '#E7E2DC'}`,
                    color: on ? '#9A3412' : '#44403C',
                  }}>{e.label}</button>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <input type="text" placeholder="From" value={from} onChange={e => setFilter('from', e.target.value)} style={yearInput} />
              <input type="text" placeholder="To" value={to} onChange={e => setFilter('to', e.target.value)} style={yearInput} />
            </div>

            <div style={eyebrow}>STATUS</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {['All', 'Living', 'Deceased'].map(s => (
                <button key={s} type="button" onClick={() => setFilter('status', s)} style={{
                  flex: 1, padding: '7px 8px', borderRadius: 9, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
                  background: status === s ? '#1C1917' : '#fff',
                  border: `1px solid ${status === s ? '#1C1917' : '#E7E2DC'}`,
                  color: status === s ? '#fff' : '#44403C',
                }}>{s}</button>
              ))}
            </div>

            <button type="button" onClick={toggleRelatives} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              <span style={{ width: 36, height: 21, borderRadius: 99, flexShrink: 0, position: 'relative', background: showRelatives ? '#1C1917' : '#E7E2DC', transition: 'background .15s' }}>
                <span style={{ position: 'absolute', top: 3, left: showRelatives ? 18 : 3, width: 15, height: 15, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#44403C' }}>Show direct connections of matches</span>
            </button>
          </div>
        )}
      </div>

      {view === 'tree' && (
        <div style={{ display: 'flex', background: '#F5F1EC', borderRadius: 9, padding: 2, gap: 2 }}>
          <button type="button" onClick={expandAll} style={segBtn(allOpen)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M7 15l5 5 5-5M7 9l5-5 5 5" /></svg>
            Expand all
          </button>
          <button type="button" onClick={collapseAll} style={segBtn(allShut)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20l5-5 5 5M7 4l5 5 5-5" /></svg>
            Collapse all
          </button>
        </div>
      )}

      {filterActive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px 7px 13px', borderRadius: 99, background: '#FEF3C7', border: '1px solid #FCD34D' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E', whiteSpace: 'nowrap' }}>
            {matchCount} {matchCount === 1 ? 'match' : 'matches'}
          </span>
          <button type="button" onClick={clearFilters} style={{ padding: '4px 10px', borderRadius: 99, border: 'none', background: '#92400E', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
            Clear filters
          </button>
        </div>
      )}

      <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#78716C', whiteSpace: 'nowrap' }}>
        Total: {persons.length} individuals
      </div>
    </div>
  );
}

const eyebrow: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '.11em', color: '#A8A29E', marginBottom: 9,
};

const yearInput: React.CSSProperties = {
  width: '50%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 9,
  border: '1px solid #E7E2DC', background: '#FAF8F5', fontSize: 12.5, outline: 'none', fontFamily: 'inherit',
};

function segBtn(active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 11px', borderRadius: 7, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
    background: active ? '#fff' : 'transparent',
    color: active ? '#1C1917' : '#78716C',
    boxShadow: active ? '0 1px 3px rgba(28,25,23,.1)' : 'none',
  };
}
