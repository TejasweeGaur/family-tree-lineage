import { useTreeStore } from '../store/useTreeStore';
import { useSignedUrl } from '../hooks/useSignedUrl';

export function DocumentViewer() {
  const viewerRecord = useTreeStore(s => s.viewerRecord);
  const closeViewer = useTreeStore(s => s.closeViewer);
  // Hooks must run unconditionally, so resolve before the early return.
  const src = useSignedUrl(viewerRecord?.url);
  if (!viewerRecord) return null;

  const name = viewerRecord.fileName ?? '';
  const isPdf = /\.pdf$/i.test(name);
  const hasFile = !!viewerRecord.url;

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
          {/* An anchor, not a button: the old one had no handler at all. */}
          <a
            href={src ?? '#'}
            download={name || undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!src}
            onClick={e => { if (!src) e.preventDefault(); }}
            style={{
              padding: '7px 12px', borderRadius: 9, border: '1px solid #E7E2DC',
              background: '#fff', fontSize: 12, fontWeight: 700,
              color: src ? '#44403C' : '#C6BFB7', textDecoration: 'none',
              cursor: src ? 'pointer' : 'not-allowed',
            }}
          >Download</a>
          <button type="button" onClick={closeViewer} aria-label="Close viewer" style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid #E7E2DC', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#57534E' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div style={{ height: 460, background: '#F7F3ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!hasFile ? (
            <span style={{ fontSize: 12.5, color: '#A8A29E' }}>No file was attached to this record.</span>
          ) : !src ? (
            <span style={{ fontSize: 12.5, color: '#A8A29E' }}>Loading…</span>
          ) : isPdf ? (
            <iframe src={src} title={viewerRecord.title} style={{ width: '100%', height: '100%', border: 'none' }} />
          ) : (
            <img src={src} alt={viewerRecord.title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          )}
        </div>
      </div>
    </div>
  );
}
