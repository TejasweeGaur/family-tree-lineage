import { useTreeStore } from '../store/useTreeStore';

export function NoticeToast() {
  const notice = useTreeStore(s => s.notice);
  const setNotice = useTreeStore(s => s.setNotice);
  if (!notice) return null;

  return (
    <div style={{
      position: 'fixed', left: 20, bottom: 20, zIndex: 95,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', borderRadius: 12,
      background: '#1C1917', color: '#fff',
      boxShadow: '0 14px 34px rgba(28,25,23,.3)', maxWidth: 380,
    }}>
      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{notice}</span>
      <button type="button" onClick={() => setNotice('')} aria-label="Dismiss" style={{
        marginLeft: 'auto', width: 24, height: 24, borderRadius: 7,
        border: 'none', background: 'rgba(255,255,255,.12)', color: '#fff', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
