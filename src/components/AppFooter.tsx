import { useTreeStore } from '../store/useTreeStore';
import { APP_VERSION, AUTHOR_NAME } from '../config/app';

/** "3 hours ago" for recent changes, a plain date for older ones. */
function updatedLabel(iso: string): string {
  const then = new Date(iso);
  const secs = (Date.now() - then.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (secs < 60) return 'just now';
  if (secs < 3600) return rtf.format(-Math.round(secs / 60), 'minute');
  if (secs < 86400) return rtf.format(-Math.round(secs / 3600), 'hour');
  if (secs < 86400 * 7) return rtf.format(-Math.round(secs / 86400), 'day');
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Slim bar under the app (and the sign-in page): copyright, version, when the
 * tree last changed, and links to About and the tour. In the layout flow rather
 * than position: fixed, so it never covers the canvas zoom controls.
 */
export function AppFooter({ showTree = true }: { showTree?: boolean }) {
  const updated = useTreeStore(s => s.treeUpdatedAt);
  const winW = useTreeStore(s => s.winW);
  const setAboutOpen = useTreeStore(s => s.setAboutOpen);
  const startTour = useTreeStore(s => s.startTour);
  const compact = winW < 640;

  const link: React.CSSProperties = {
    border: 'none', background: 'none', padding: 0, cursor: 'pointer',
    fontSize: 11.5, fontWeight: 700, color: '#78716C', fontFamily: 'inherit',
  };

  return (
    <footer style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
      padding: `7px ${compact ? 12 : 20}px calc(7px + env(safe-area-inset-bottom, 0px))`,
      borderTop: '1px solid #EFE9E2', background: '#FFFDFB',
      fontSize: 11.5, color: '#A8A29E', whiteSpace: 'nowrap', overflow: 'hidden',
    }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        © {new Date().getFullYear()} {AUTHOR_NAME}
        {!compact && <> · v{APP_VERSION}</>}
      </span>
      {showTree && updated && (
        <span title={new Date(updated).toLocaleString()} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          · Tree updated {updatedLabel(updated)}
        </span>
      )}
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 14, flexShrink: 0 }}>
        {showTree && <button type="button" onClick={startTour} style={link} data-tour="tour-link">Quick tour</button>}
        <button type="button" onClick={() => setAboutOpen(true)} style={link}>About</button>
      </span>
    </footer>
  );
}
