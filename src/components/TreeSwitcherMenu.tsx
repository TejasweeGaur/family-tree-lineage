import { useTreeStore } from '../store/useTreeStore';
import { treeTitle } from '../utils/treeTitle';

/** The "My trees" dropdown under the tree's name: switch, create, or delete. */
export function TreeSwitcherMenu({ width = 260 }: { width?: number | string }) {
  const trees = useTreeStore(s => s.trees);
  const activeTreeId = useTreeStore(s => s.activeTreeId);
  const isOwner = useTreeStore(s => s.isOwner());
  const switchTree = useTreeStore(s => s.switchTree);
  const setTreeMenu = useTreeStore(s => s.setTreeMenu);
  const setNewTreeOpen = useTreeStore(s => s.setNewTreeOpen);
  const setDeleteTreeOpen = useTreeStore(s => s.setDeleteTreeOpen);

  return (
    <div style={{ position: 'absolute', top: 52, left: 0, width, maxWidth: 'calc(100vw - 24px)', background: '#fff', border: '1px solid #E7E2DC', borderRadius: 14, boxShadow: '0 18px 44px rgba(28,25,23,.14)', padding: 7, zIndex: 60 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.11em', color: '#A8A29E', padding: '7px 10px 5px' }}>MY TREES</div>
      {trees.map(t => (
        <button key={t.id} type="button" onClick={() => switchTree(t.id)} style={{
          display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 9, border: 'none',
          background: t.id === activeTreeId ? '#FEF6F1' : 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, width: '100%', textAlign: 'left', fontFamily: 'inherit',
          color: t.id === activeTreeId ? '#C2410C' : '#292524',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: t.id === activeTreeId ? '#C2410C' : '#A8A29E' }} />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{treeTitle(t.name)}</span>
          {t.role && (
            <span style={{
              flexShrink: 0, padding: '2px 7px', borderRadius: 99, fontSize: 9.5, fontWeight: 800, letterSpacing: '.05em',
              background: t.role === 'admin' ? '#FEF3C7' : '#F0EDE9', color: t.role === 'admin' ? '#92400E' : '#57534E',
            }}>{t.role === 'admin' ? 'ADMIN' : 'VIEWER'}</span>
          )}
        </button>
      ))}
      {/* Anyone can start their own archive, including viewers of this one. */}
      <div style={{ height: 1, background: '#F0EBE5', margin: '6px 4px' }} />
      <button type="button" onClick={() => { setTreeMenu(false); setNewTreeOpen(true); }} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 9, border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#C2410C', textAlign: 'left', fontFamily: 'inherit' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        Create new family tree
      </button>
      {isOwner && (
        <button type="button" onClick={() => setDeleteTreeOpen(true)} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 9, border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#B91C1C', textAlign: 'left', fontFamily: 'inherit' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13" /></svg>
          Delete this tree…
        </button>
      )}
    </div>
  );
}
