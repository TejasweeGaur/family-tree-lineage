import { useEffect, useId, useMemo, useRef } from 'react';
import { useTreeStore } from '../store/useTreeStore';
import { eventsWithin } from '../utils/onThisDay';
import { exportExcel, exportPdf } from '../utils/export';
import { repo } from '../data/repository';
import { treeTitle } from '../utils/treeTitle';
import { HeaderSearch } from './HeaderSearch';
import { TreeSwitcherMenu } from './TreeSwitcherMenu';

/**
 * The header on phones: the tree's name, then the view, expand/collapse and
 * one menu that holds every other action. The desktop header's row of buttons
 * wrapped into three or four lines here and left little room for the tree.
 */
export function MobileHeader() {
  const trees = useTreeStore(s => s.trees);
  const activeTreeId = useTreeStore(s => s.activeTreeId);
  const view = useTreeStore(s => s.view);
  const session = useTreeStore(s => s.session);
  const treeMenu = useTreeStore(s => s.treeMenu);
  const searchOpen = useTreeStore(s => s.searchOpen);
  const menuOpen = useTreeStore(s => s.mobileMenu);
  const persons = useTreeStore(s => s.persons);
  const unions = useTreeStore(s => s.unions);
  const collapsed = useTreeStore(s => s.collapsed);
  const isAdmin = useTreeStore(s => s.isAdmin());
  const superAdmin = useTreeStore(s => s.superAdmin);
  const {
    setView, setTreeMenu, setSearchOpen, setMobileMenu, closeHeaderMenus, expandAll, collapseAll,
    setOnThisDayOpen, setInviteOpen, openAddDialog, exportCsv, downloadCsvTemplate, openCsvImport,
    startTour, setAboutOpen, setRefDataOpen, toggleDemoRole, signOut, setNotice,
  } = useTreeStore.getState();

  const headerRef = useRef<HTMLElement>(null);
  // Looked up by id when picked: the menu's click handlers are built during
  // render, and a ref read from them trips the linter's render-time check.
  const csvId = useId();
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) closeHeaderMenus();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [closeHeaderMenus]);

  const todayCount = useMemo(() => eventsWithin({ persons, unions }, new Date(), 0).length, [persons, unions]);
  const activeTree = trees.find(t => t.id === activeTreeId);
  const origin = [activeTree?.originPlace, activeTree?.originCountry].filter(Boolean).join(', ');

  const withKids = unions.filter(u => u.children.length);
  const allOpen = withKids.every(u => !collapsed[u.id]);
  const allShut = withKids.filter(u => !collapsed[u.id]).length <= 1;

  const run = (fn: () => void) => () => { setMobileMenu(false); fn(); };
  const pickCsv = () => document.getElementById(csvId)?.click();
  const treeName = activeTree?.name ?? 'Family';

  type Item = { label: string; sub?: string; badge?: number; danger?: boolean; onClick: () => void; show?: boolean };
  const groups: Item[][] = [
    [
      { label: 'On this day', sub: 'Birthdays, anniversaries and remembrances', badge: todayCount, onClick: run(() => setOnThisDayOpen(true)) },
      { label: 'Add a family member', onClick: run(() => openAddDialog()), show: isAdmin },
      { label: 'Invite relatives & members', onClick: run(() => setInviteOpen(true)), show: isAdmin },
    ],
    [
      { label: 'Export as PDF', sub: 'The tree as a printable chart', onClick: run(() => { if (!exportPdf({ persons, unions }, treeName)) setNotice('Allow pop-ups to export PDF'); }) },
      { label: 'Export as Excel', sub: 'Everyone as a spreadsheet', onClick: run(() => { void exportExcel({ persons, unions }, treeName).then(() => setNotice('Excel file downloaded'), () => setNotice('Could not generate the Excel file')); }) },
      { label: 'Import CSV', onClick: () => { setMobileMenu(false); pickCsv(); }, show: isAdmin },
      { label: 'Export CSV', onClick: run(exportCsv), show: isAdmin },
      { label: 'Download CSV template', onClick: run(downloadCsvTemplate), show: isAdmin },
    ],
    [
      { label: 'Reference data', sub: 'Education levels, gotras, shasans', onClick: run(() => setRefDataOpen(true)), show: superAdmin },
      { label: `Demo: switch to ${isAdmin ? 'Viewer' : 'Admin'}`, onClick: run(toggleDemoRole), show: repo.kind === 'local' },
      { label: 'Take the quick tour', onClick: run(startTour) },
      { label: 'About this app', onClick: run(() => setAboutOpen(true)) },
    ],
    [
      { label: 'Sign out', danger: true, onClick: run(() => void signOut()) },
    ],
  ];

  return (
    <header ref={headerRef} style={{
      flexShrink: 0, background: '#FFFDFB', borderBottom: '1px solid #E7E2DC',
      padding: '10px 12px 9px', position: 'relative', zIndex: 40,
      display: 'flex', flexDirection: 'column', gap: 9,
    }}>
      {/* Row 1 — the tree and where it comes from */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#C2410C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="5" r="2.6" /><circle cx="5.5" cy="18.5" r="2.6" /><circle cx="18.5" cy="18.5" r="2.6" />
              <path d="M12 7.6V12M5.5 15.9v-1.6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1.6" />
            </svg>
          </div>
          <button
            type="button"
            onClick={() => setTreeMenu(!treeMenu)}
            data-tour="tree-switcher"
            aria-expanded={treeMenu}
            style={{ flex: 1, minWidth: 0, display: 'block', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', color: '#1C1917' }}
          >
            <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {treeTitle(activeTree?.name ?? '')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11.5, color: '#78716C', marginTop: 1, minWidth: 0 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{origin || 'My trees'}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M6 9l6 6 6-6" /></svg>
            </span>
          </button>
          {treeMenu && <TreeSwitcherMenu width="calc(100vw - 24px)" />}
        </div>
        <button type="button" aria-label="Search" data-tour="search" onClick={() => setSearchOpen(!searchOpen)} style={{ ...iconBtn, background: searchOpen ? '#F5F1EC' : '#fff' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.4-3.4" /></svg>
        </button>
      </div>

      {searchOpen && <HeaderSearch autoFocus />}

      {/* Row 2 — view, expand/collapse, and the menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div data-tour="view-toggle" style={{ display: 'flex', background: '#F5F1EC', borderRadius: 9, padding: 2, gap: 2, flexShrink: 0 }}>
          {(['tree', 'directory'] as const).map(v => (
            <button key={v} type="button" onClick={() => setView(v)} aria-label={v === 'tree' ? 'Tree view' : 'Directory view'} aria-pressed={view === v} style={seg(view === v)}>
              {v === 'tree'
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="5" r="2.4" /><circle cx="6" cy="19" r="2.4" /><circle cx="18" cy="19" r="2.4" /><path d="M12 7.4V12M6 16.6V15a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1.6" /></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>}
            </button>
          ))}
        </div>

        {view === 'tree' && (
          <div style={{ display: 'flex', background: '#F5F1EC', borderRadius: 9, padding: 2, gap: 2, minWidth: 0 }}>
            <button type="button" onClick={expandAll} style={seg(allOpen)}>Expand all</button>
            <button type="button" onClick={collapseAll} style={seg(allShut)}>Collapse all</button>
          </div>
        )}

        <div style={{ marginLeft: 'auto', position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setMobileMenu(!menuOpen)}
            aria-label={todayCount ? `Menu (${todayCount} events today)` : 'Menu'}
            aria-expanded={menuOpen}
            data-tour="mobile-menu"
            style={{
              width: 36, height: 36, borderRadius: '50%', padding: 0, border: '1px solid #E7E2DC', cursor: 'pointer',
              background: session?.user.pictureUrl ? `#FEF3E8 url(${session.user.pictureUrl}) center/cover` : '#FEF3E8',
              color: '#9A3412', fontSize: 12, fontWeight: 800, fontFamily: 'inherit', position: 'relative',
            }}
          >
            {!session?.user.pictureUrl && initialsOf(session?.user.name || session?.user.email || '?')}
            {todayCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 99,
                background: '#C2410C', color: '#fff', fontSize: 9.5, fontWeight: 800, boxShadow: '0 0 0 2px #FFFDFB',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{todayCount}</span>
            )}
          </button>
          {/* Outside the menu so it survives the menu closing on click. */}
          <input id={csvId} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void openCsvImport(f); }} />
        </div>
      </div>

      {menuOpen && session && (
        <div role="menu" style={{
          position: 'absolute', top: '100%', right: 8, left: 8, marginTop: 4,
          maxHeight: 'calc(100vh - 150px)', overflowY: 'auto',
          background: '#fff', border: '1px solid #E7E2DC', borderRadius: 16,
          boxShadow: '0 22px 50px rgba(28,25,23,.2)', padding: 7, zIndex: 60,
        }}>
          <div style={{ padding: '8px 10px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.name}</div>
              <div style={{ fontSize: 11.5, color: '#78716C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.email}</div>
            </div>
            <span style={{
              flexShrink: 0, padding: '3px 8px', borderRadius: 99, fontSize: 9.5, fontWeight: 800, letterSpacing: '.06em',
              background: isAdmin ? '#FEF3C7' : '#F0EDE9', color: isAdmin ? '#92400E' : '#57534E',
            }}>{isAdmin ? 'ADMIN' : 'VIEWER'}</span>
          </div>
          {groups.map((g, gi) => {
            const items = g.filter(i => i.show !== false);
            if (!items.length) return null;
            return (
              <div key={gi} style={{ borderTop: '1px solid #F0EBE5', paddingTop: 4, marginTop: 4 }}>
                {items.map(i => (
                  <button key={i.label} type="button" role="menuitem" onClick={i.onClick} style={{
                    display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '10px 10px', borderRadius: 9,
                    border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: i.danger ? '#B91C1C' : '#292524' }}>{i.label}</span>
                      {i.sub && <span style={{ display: 'block', fontSize: 11, color: '#A8A29E', marginTop: 1 }}>{i.sub}</span>}
                    </span>
                    {!!i.badge && (
                      <span style={{ flexShrink: 0, minWidth: 20, height: 20, padding: '0 6px', borderRadius: 99, background: '#C2410C', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i.badge}</span>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </header>
  );
}

function initialsOf(n: string): string {
  return n.replace(/^(Dr|Smt|Shri|Late)\.?\s+/i, '')
    .split(/\s+/).filter(Boolean)
    .map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const iconBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 10, border: '1px solid #E7E2DC', flexShrink: 0, padding: 0,
  cursor: 'pointer', color: '#44403C', display: 'flex', alignItems: 'center', justifyContent: 'center',
};

function seg(active: boolean): React.CSSProperties {
  return {
    padding: '7px 9px', borderRadius: 7, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
    fontSize: 12, fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center',
    background: active ? '#fff' : 'transparent', color: active ? '#1C1917' : '#78716C',
    boxShadow: active ? '0 1px 3px rgba(28,25,23,.1)' : 'none',
  };
}
