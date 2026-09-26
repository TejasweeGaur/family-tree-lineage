import { useTreeStore } from '../store/useTreeStore';

export function DocumentViewer() {
  const viewerRecord = useTreeStore(s => s.viewerRecord);
  const closeViewer = useTreeStore(s => s.closeViewer);
  if (!viewerRecord) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(28,25,23,.72)' }}
      onClick={closeViewer}
    >
      <div style={{ width: 'min(760px,92vw)', background: '#FFFDFB', borderRadius: 18, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,.4)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid #EFE9E2' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.012em' }}>{viewerRecord.title}</div>
            <div style={{ fontSize: 11.5, color: '#8A817A' }}>{viewerRecord.sub}</div>
          </div>
          <button type="button" style={{ padding: '7px 12px', borderRadius: 9, border: '1px solid #E7E2DC', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#44403C' }}>Download</button>
          <button type="button" onClick={closeViewer} aria-label="Close viewer" style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid #E7E2DC', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#57534E' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F3ED', backgroundImage: 'repeating-linear-gradient(135deg,#EFE9E2 0 8px,#F8F5F0 8px 16px)' }}>
          <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12, color: '#A8A29E' }}>{viewerRecord.kind}</span>
        </div>
      </div>
    </div>
  );
}
