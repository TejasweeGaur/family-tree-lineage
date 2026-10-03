import { useTreeStore } from '../store/useTreeStore';
import { APP_NAME, APP_TAGLINE, APP_VERSION, BUILD_DATE, AUTHOR_NAME, AUTHOR_EMAIL, SOURCE_URL } from '../config/app';

const POINTS = [
  ['An interactive tree', 'Walk generations, expand and collapse branches, and trace a line back to where it starts.'],
  ['Heritage profiles', 'Biographies, photographs, places and occupations — the detail behind each name.'],
  ['A document archive', 'Deeds, certificates and letters kept with the people they belong to.'],
  ['Kinship, explained', 'Pick any two relatives and see exactly how they are related.'],
  ['On this day', 'Birthdays, anniversaries and remembrances drawn from the tree itself.'],
  ['Export and import', 'A printable chart as PDF, the full roster as Excel or CSV.'],
] as const;

export function AboutModal() {
  const open = useTreeStore(s => s.aboutOpen);
  const setAboutOpen = useTreeStore(s => s.setAboutOpen);
  const close = () => setAboutOpen(false);
  const startTour = useTreeStore(s => s.startTour);
  const signedIn = useTreeStore(s => !!s.session?.treeId);
  if (!open) return null;

  const built = new Date(BUILD_DATE).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 210,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3vh 16px',
        background: 'rgba(28,25,23,.42)', backdropFilter: 'blur(3px)',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: '#1C1917',
      }}
    >
      <div
        role="dialog"
        aria-label={`About ${APP_NAME}, ${APP_TAGLINE}`}
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(520px, 96vw)', maxHeight: '92vh', overflowY: 'auto',
          background: '#FFFDFB', borderRadius: 20, boxShadow: '0 26px 60px rgba(28,25,23,.26)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '22px 22px 0' }}>
          <img src="/favicon.svg" alt="" width={48} height={48} style={{ borderRadius: 12, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.015em' }}>{APP_NAME}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#57534E', marginTop: 1 }}>{APP_TAGLINE}</div>
            <div style={{ fontSize: 12, color: '#78716C', marginTop: 2 }}>Version {APP_VERSION} · built {built}</div>
          </div>
          <button type="button" onClick={close} aria-label="Close" style={{
            width: 32, height: 32, borderRadius: 9, border: '1px solid #E7E2DC', background: '#fff',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#57534E', flexShrink: 0,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div style={{ padding: '16px 22px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 13.5, color: '#44403C', lineHeight: 1.6 }}>
            <em>Vanshavali</em> (वंशावली) is Hindi for a family's lineage record, the kind
            elders once kept by hand. This is that record for today: a private home for a
            family's history — the tree, the stories, and the papers that prove them — built
            to be handed down rather than lost in a folder somewhere.
          </p>

          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 9 }}>
            {POINTS.map(([title, body]) => (
              <li key={title} style={{ fontSize: 12.5, lineHeight: 1.5, color: '#57534E' }}>
                <strong style={{ color: '#1C1917' }}>{title}.</strong> {body}
              </li>
            ))}
          </ul>

          <div style={{ padding: '12px 14px', borderRadius: 12, background: '#FAF8F5', border: '1px solid #EFE9E2', fontSize: 12, color: '#57534E', lineHeight: 1.55 }}>
            <strong style={{ color: '#1C1917' }}>Your archive is private.</strong> Only people you invite can see it.
            Photos and documents are stored privately and shown through links that expire after an hour.
          </div>

          <div style={{ borderTop: '1px solid #EFE9E2', paddingTop: 14, fontSize: 12.5, color: '#57534E', lineHeight: 1.6 }}>
            Created by <strong style={{ color: '#1C1917' }}>{AUTHOR_NAME}</strong>
            {' · '}
            <a href={`mailto:${AUTHOR_EMAIL}`}>{AUTHOR_EMAIL}</a>
            <br />
            <a href={SOURCE_URL} target="_blank" rel="noreferrer">Source code on GitHub</a>
            {' · '}
            <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy policy</a>
          </div>

          {signedIn && (
            <button type="button" onClick={() => { close(); startTour(); }} style={{
              alignSelf: 'flex-start', padding: '9px 14px', borderRadius: 10, border: '1px solid #E7E2DC',
              background: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#292524', fontFamily: 'inherit',
            }}>Take the quick tour</button>
          )}
        </div>
      </div>
    </div>
  );
}
