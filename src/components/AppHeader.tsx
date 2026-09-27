import { useRef, useEffect } from 'react';
import { useTreeStore } from '../store/useTreeStore';
import { fullName, initials } from '../utils/kinship';
import { palette } from '../utils/palette';
import { exportExcel, exportPdf } from '../utils/export';
import { repo } from '../data/repository';
import { year } from '../utils/dates';

const btn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 7,
  padding: '9px 13px', borderRadius: 10, cursor: 'pointer',
  fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
  background: '#fff', border: '1px solid #E7E2DC', color: '#44403C',
};

export function AppHeader() {
  const store = useTreeStore();
  const {
    trees, activeTreeId, view, session, winW,
    headerQ, treeMenu, dataMenu, exportMenu, userMenu, searchOpen,
    persons, unions,
    setView, setInviteOpen, setDataMenu, setTreeMenu, setExportMenu, setUserMenu, setSearchOpen,
    setHeaderQ, openPanel, switchTree, setNewTreeOpen, closeHeaderMenus,
    toggleDemoRole, signOut, openAddDialog, setNotice,
  } = store;

  const isAdmin = store.isAdmin();
  const compact = winW < 1180;
  const isMobile = winW < 640;

  const activeTree = trees.find(t => t.id === activeTreeId);
  const treeTitle = activeTree ? `${activeTree.name} Family Tree` : 'Family Tree';

  // Search spans people, places and archive titles — each tagged in the results.
  const q = headerQ.trim().toLowerCase();
  const results = q.length > 1
    ? persons.flatMap(p => {
        const out: Array<{ id: string; title: string; sub: string; tag: string }> = [];
        if (`${p.first} ${p.last} ${p.maiden}`.toLowerCase().includes(q)) {
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

  const headerRef = useRef<HTMLElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const exportCsv = useTreeStore(s => s.exportCsv);
  const downloadCsvTemplate = useTreeStore(s => s.downloadCsvTemplate);
  const openCsvImport = useTreeStore(s => s.openCsvImport);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) closeHeaderMenus();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [closeHeaderMenus]);

  const handleExcel = async () => {
    setExportMenu(false);
    try {
      await exportExcel({ persons, unions }, activeTree?.name ?? 'Family');
      setNotice('Excel file downloaded');
    } catch {
      setNotice('Could not generate the Excel file');
    }
  };

  const handlePdf = () => {
    setExportMenu(false);
    if (!exportPdf({ persons, unions }, activeTree?.name ?? 'Family')) {
      setNotice('Allow pop-ups to export PDF');
    }
  };

  const searchField = (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8A29E" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 13, top: 11 }}>
        <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.4-3.4" />
      </svg>
      <input
        type="text"
        placeholder="Search ancestors, names, places"
        value={headerQ}
        onChange={e => setHeaderQ(e.target.value)}
        autoFocus={searchOpen}
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

  return (
    <header
      ref={headerRef}
      style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        gap: isMobile ? '10px 12px' : '10px 18px', flexWrap: 'wrap',
        padding: `12px ${isMobile ? 12 : 20}px`,
        background: '#FFFDFB', borderBottom: '1px solid #E7E2DC',
        position: 'relative', zIndex: 40,
      }}
    >
      {/* Brand + tree switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, position: 'relative', flexShrink: 0 }}>
        <div style={{ width: 42, height: 42, borderRadius: 13, background: '#C2410C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round">
            <circle cx="12" cy="5" r="2.6" /><circle cx="5.5" cy="18.5" r="2.6" /><circle cx="18.5" cy="18.5" r="2.6" />
            <path d="M12 7.6V12M5.5 15.9v-1.6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1.6" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.15 }}>{treeTitle}</div>
          <button
            type="button"
            onClick={() => setTreeMenu(!treeMenu)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: '2px 0 0', cursor: 'pointer', color: '#78716C', fontSize: 11.5, fontWeight: 500, fontFamily: 'inherit' }}
          >
            {[activeTree?.originPlace, activeTree?.originCountry].filter(Boolean).join(', ') || 'Genealogy & Roots Archive'}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </div>

        {treeMenu && (
          <div style={{ position: 'absolute', top: 52, left: 0, width: 260, background: '#fff', border: '1px solid #E7E2DC', borderRadius: 14, boxShadow: '0 18px 44px rgba(28,25,23,.14)', padding: 7, zIndex: 60 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.11em', color: '#A8A29E', padding: '7px 10px 5px' }}>MY TREES</div>
            {trees.map(t => (
              <button key={t.id} type="button" onClick={() => switchTree(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 9, border: 'none',
                background: t.id === activeTreeId ? '#FEF6F1' : 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, width: '100%', textAlign: 'left', fontFamily: 'inherit',
                color: t.id === activeTreeId ? '#C2410C' : '#292524',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.id === activeTreeId ? '#C2410C' : '#A8A29E' }} />
                {t.name} Family Tree
              </button>
            ))}
            {isAdmin && (
              <>
                <div style={{ height: 1, background: '#F0EBE5', margin: '6px 4px' }} />
                <button type="button" onClick={() => { setTreeMenu(false); setNewTreeOpen(true); }} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 9, border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#C2410C', textAlign: 'left', fontFamily: 'inherit' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  Create new family tree
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Search — full field on wide screens, icon toggle when compact */}
      {compact ? (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button type="button" aria-label="Search" onClick={() => setSearchOpen(!searchOpen)} style={{ ...btn, width: 38, height: 38, padding: 0, justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.4-3.4" /></svg>
          </button>
          {searchOpen && (
            <div style={{ position: 'absolute', top: 46, left: 0, width: 'min(420px, calc(100vw - 32px))', zIndex: 60 }}>
              {searchField}
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, maxWidth: 420, minWidth: 180 }}>{searchField}</div>
      )}

      {/* View switch */}
      <div style={{ display: 'flex', background: '#F5F1EC', border: '1px solid #E7E2DC', borderRadius: 11, padding: 3, gap: 3, flexShrink: 0 }}>
        {(['tree', 'directory'] as const).map(v => (
          <button key={v} type="button" onClick={() => setView(v)} aria-label={v === 'tree' ? 'Tree' : 'Directory'} aria-pressed={view === v} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: isMobile ? '7px 9px' : '7px 13px',
            borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
            background: view === v ? '#fff' : 'transparent',
            color: view === v ? '#1C1917' : '#78716C',
            boxShadow: view === v ? '0 1px 3px rgba(28,25,23,.1)' : 'none',
          }}>
            {v === 'tree'
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="5" r="2.4" /><circle cx="6" cy="19" r="2.4" /><circle cx="18" cy="19" r="2.4" /><path d="M12 7.4V12M6 16.6V15a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1.6" /></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>}
            {!isMobile && v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* Right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 'auto' }}>
        {/* Role — a toggle in demo mode, a read-only badge once Supabase owns it */}
        <button
          type="button"
          onClick={toggleDemoRole}
          title={repo.kind === 'local'
            ? 'Demo: switch between Admin and Viewer'
            : 'Your role in this tree'}
          aria-label={`Role: ${isAdmin ? 'Admin' : 'Viewer'}`}
          style={{
            ...btn,
            cursor: repo.kind === 'local' ? 'pointer' : 'default',
            background: isAdmin ? '#FEF3C7' : '#fff',
            border: `1px solid ${isAdmin ? '#FCD34D' : '#E7E2DC'}`,
            color: isAdmin ? '#92400E' : '#57534E',
            ...(compact ? { padding: 0, width: 38, height: 38, justifyContent: 'center' } : {}),
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.6-3 8.1-7 10-4-1.9-7-5.4-7-10V6z" /></svg>
          {!compact && (isAdmin ? 'Admin' : 'Viewer')}
        </button>

        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          aria-label="Invite relatives"
          style={{ ...btn, ...(compact ? { padding: 0, width: 38, height: 38, justifyContent: 'center' } : {}) }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="9" cy="8" r="3.4" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M18.5 9v6M15.5 12h6" /></svg>
          {!compact && 'Invite Relatives'}
        </button>

        {/* Export — available to viewers too */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setExportMenu(!exportMenu)}
            aria-label="Export"
            style={{ ...btn, ...(compact ? { padding: 0, width: 38, height: 38, justifyContent: 'center' } : {}) }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M12 4v11M8 11l4 4 4-4M4 19h16" /></svg>
            {!compact && 'Export'}
          </button>
          {exportMenu && (
            <div style={{ position: 'absolute', top: 46, right: 0, width: 236, background: '#fff', border: '1px solid #E7E2DC', borderRadius: 14, boxShadow: '0 18px 44px rgba(28,25,23,.14)', padding: 7, zIndex: 60 }}>
              {[
                { badge: 'PDF', bg: '#FEE2E2', fg: '#B91C1C', title: 'Export as PDF', sub: 'The tree as a printable chart', onClick: handlePdf },
                { badge: 'XLS', bg: '#DCFCE7', fg: '#15803D', title: 'Export as Excel', sub: 'All members as a spreadsheet', onClick: () => void handleExcel() },
              ].map(row => (
                <button
                  key={row.badge}
                  type="button"
                  onClick={row.onClick}
                  style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 11, padding: '9px 10px', borderRadius: 9, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAF7F3')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: row.bg, color: row.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 800 }}>
                    {row.badge}
                  </span>
                  <span>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#292524' }}>{row.title}</span>
                    <span style={{ display: 'block', fontSize: 11, color: '#78716C' }}>{row.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Data — admin only, hidden for viewers */}
        {isAdmin && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setDataMenu(!dataMenu)}
              aria-label="Data"
              style={{ ...btn, ...(compact ? { padding: 0, width: 38, height: 38, justifyContent: 'center' } : {}) }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M4 7h16" /><path d="M5 7v12h14V7" /><path d="M10 11h4" /></svg>
              {!compact && (
                <>
                  Data
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
                </>
              )}
            </button>
            {/* Outside the menu so it survives the menu closing on click. */}
            <input
              ref={csvRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void openCsvImport(f);
              }}
            />
            {dataMenu && (
              <div style={{ position: 'absolute', top: 46, right: 0, width: 222, background: '#fff', border: '1px solid #E7E2DC', borderRadius: 14, boxShadow: '0 18px 44px rgba(28,25,23,.14)', padding: 7, zIndex: 60 }}>
                {(['Import CSV', 'Export CSV', 'Download CSV template'] as const).map(label => (
                  <button key={label} type="button" onClick={() => {
                    setDataMenu(false);
                    if (label === 'Import CSV') csvRef.current?.click();
                    else if (label === 'Export CSV') exportCsv();
                    else downloadCsvTemplate();
                  }} style={{ display: 'block', width: '100%', padding: '9px 10px', borderRadius: 9, border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, textAlign: 'left', color: '#292524', fontFamily: 'inherit' }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add Member — admin only */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => openAddDialog()}
            aria-label="Add member"
            style={{ ...btn, background: '#1C1917', border: '1px solid #1C1917', color: '#fff', ...(compact ? { padding: 0, width: 38, height: 38, justifyContent: 'center' } : { padding: '9px 15px' }) }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            {!compact && 'Add Member'}
          </button>
        )}

        {/* Account */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setUserMenu(!userMenu)}
            aria-label="Account"
            style={{
              width: 38, height: 38, borderRadius: '50%', flexShrink: 0, padding: 0,
              border: 'none', cursor: 'pointer',
              background: session?.user.pictureUrl ? `#FEF3E8 url(${session.user.pictureUrl}) center/cover` : '#FEF3E8',
              color: '#9A3412', fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit',
            }}
          >
            {!session?.user.pictureUrl && nameInitials(session?.user.name || session?.user.email || '?')}
          </button>
          {userMenu && session && (
            <div style={{ position: 'absolute', top: 46, right: 0, width: 250, background: '#fff', border: '1px solid #E7E2DC', borderRadius: 14, boxShadow: '0 18px 44px rgba(28,25,23,.14)', padding: 7, zIndex: 60 }}>
              <div style={{ padding: '9px 10px 7px' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{session.user.name}</div>
                <div style={{ fontSize: 11.5, color: '#78716C', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.user.email}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8 }}>
                  <span style={{
                    padding: '3px 8px', borderRadius: 99, fontSize: 9.5, fontWeight: 800, letterSpacing: '.06em',
                    background: isAdmin ? '#FEF3C7' : '#F0EDE9',
                    color: isAdmin ? '#92400E' : '#57534E',
                  }}>
                    {isAdmin ? 'ADMIN' : 'VIEWER'}
                  </span>
                  <span style={{ fontSize: 11, color: '#A8A29E' }}>Signed in with Google</span>
                </div>
              </div>
              <div style={{ height: 1, background: '#F0EBE5', margin: '6px 4px' }} />
              <button
                type="button"
                onClick={() => void signOut()}
                style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 9, border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#B91C1C', textAlign: 'left', fontFamily: 'inherit' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M16 16l4-4-4-4M20 12H10" /></svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/** Initials from a display name, dropping common honorifics. */
function nameInitials(n: string): string {
  return n.replace(/^(Dr|Smt|Shri|Late)\.?\s+/i, '')
    .split(/\s+/).filter(Boolean)
    .map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
