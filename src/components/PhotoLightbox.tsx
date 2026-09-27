import { useTreeStore } from '../store/useTreeStore';
import { useSignedUrl } from '../hooks/useSignedUrl';

/**
 * Full-screen profile photo, in the style of a messaging app's "view photo":
 * dark backdrop, name in a top bar, image centred. Clicking anywhere outside
 * the image closes it; Esc is handled with the other overlays in App.
 */
export function PhotoLightbox() {
  const photoView = useTreeStore(s => s.photoView);
  const close = useTreeStore(s => s.closePhotoView);
  // Hooks must run unconditionally, so resolve before the early return.
  const src = useSignedUrl(photoView?.stored);
  if (!photoView) return null;

  return (
    <div
      role="dialog"
      aria-label={`Photo of ${photoView.name}`}
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 120,
        background: 'rgba(12,10,9,.94)',
        display: 'flex', flexDirection: 'column',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
        padding: 'max(14px, env(safe-area-inset-top)) 18px 14px',
      }}>
        <button
          type="button"
          onClick={close}
          aria-label="Close photo"
          style={{
            width: 36, height: 36, borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,.1)', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <span style={{ color: '#fff', fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {photoView.name}
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px 24px' }}>
        {src ? (
          <img
            src={src}
            alt={`Photo of ${photoView.name}`}
            // Clicks on the photo itself shouldn't dismiss it.
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
              borderRadius: 6, boxShadow: '0 20px 60px rgba(0,0,0,.5)',
            }}
          />
        ) : (
          <span style={{ color: 'rgba(255,255,255,.6)', fontSize: 13 }}>Loading…</span>
        )}
      </div>
    </div>
  );
}
