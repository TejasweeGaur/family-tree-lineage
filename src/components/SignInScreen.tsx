import { useTreeStore } from '../store/useTreeStore';
import { repo } from '../data/repository';
import { TreePreview } from './TreePreview';
import { AppFooter } from './AppFooter';

/** Official four-colour Google mark, per their sign-in branding guidelines. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

const FEATURES: Array<{ title: string; body: string; icon: React.ReactNode }> = [
  {
    title: 'An interactive tree',
    body: 'Walk generations, collapse branches, and trace a line back to where it starts.',
    icon: <><circle cx="12" cy="5" r="2.6" /><circle cx="5.5" cy="18.5" r="2.6" /><circle cx="18.5" cy="18.5" r="2.6" /><path d="M12 7.6V12M5.5 15.9v-1.6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1.6" /></>,
  },
  {
    title: 'Heritage profiles',
    body: 'Biographies, photographs, occupations and places — the detail behind each name.',
    icon: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></>,
  },
  {
    title: 'A document archive',
    body: 'Keep deeds, certificates and letters attached to the people they belong to.',
    icon: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  },
  {
    title: 'Kinship, explained',
    body: 'Pick any two relatives and see exactly how they are related, and through whom.',
    icon: <><path d="M7 7h10M7 7v10M7 17h10M17 7v10" /><circle cx="7" cy="7" r="2" /><circle cx="17" cy="17" r="2" /></>,
  },
];

export function SignInScreen() {
  const signIn = useTreeStore(s => s.signIn);
  const signingIn = useTreeStore(s => s.signingIn);
  const authError = useTreeStore(s => s.authError);
  const pendingInvite = useTreeStore(s => s.pendingInvite);
  const winW = useTreeStore(s => s.winW);

  const stacked = winW < 900;

  // Role shown in the banner is only a preview of the invite; the authoritative
  // role is read from the stored token at sign-in, never from the URL.
  const invitedRole = new URLSearchParams(window.location.search).get('role');

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
      background: '#F7F5F2',
      backgroundImage: 'radial-gradient(#DED7CE 1.1px, transparent 1.1px)',
      backgroundSize: '22px 22px',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      color: '#1C1917',
    }}>
      <div style={{
        flex: '1 0 auto', width: '100%', boxSizing: 'border-box',
        display: 'grid', alignItems: 'center',
        gridTemplateColumns: stacked ? '1fr' : 'minmax(0,1.05fr) minmax(0,.95fr)',
        gap: stacked ? 34 : 56,
        maxWidth: 1080, margin: '0 auto',
        padding: stacked ? '38px 20px 44px' : '48px 32px',
      }}>

        {/* ------------------------------------------------ overview */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 14, background: '#C2410C',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round">
              <circle cx="12" cy="5" r="2.6" /><circle cx="5.5" cy="18.5" r="2.6" /><circle cx="18.5" cy="18.5" r="2.6" />
              <path d="M12 7.6V12M5.5 15.9v-1.6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1.6" />
            </svg>
          </div>

          <h1 style={{
            fontSize: stacked ? 30 : 38, fontWeight: 800, letterSpacing: '-0.03em',
            lineHeight: 1.1, margin: '20px 0 0',
          }}>
            Every family is a<br />record worth keeping.
          </h1>
          <p style={{ fontSize: 15, color: '#6B635C', lineHeight: 1.6, margin: '12px 0 0', maxWidth: 460 }}>
            A private archive for your family's tree, its stories and its documents —
            built to be handed down, not lost in a folder somewhere.
          </p>

          <div style={{
            margin: '26px 0 0', padding: stacked ? '16px 12px' : '20px 16px',
            background: 'rgba(255,253,251,.7)', border: '1px solid #EFE9E2',
            borderRadius: 18, display: 'flex', justifyContent: 'center',
          }}>
            <TreePreview />
          </div>

          <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0 0', display: 'grid', gap: 15 }}>
            {FEATURES.map(f => (
              <li key={f.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{
                  flexShrink: 0, width: 30, height: 30, borderRadius: 9,
                  background: '#FEF6F1', color: '#C2410C',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {f.icon}
                  </svg>
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>{f.title}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: '#78716C', lineHeight: 1.5, marginTop: 2 }}>{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* ------------------------------------------------ sign in */}
        <div style={{ minWidth: 0, display: 'flex', justifyContent: stacked ? 'center' : 'flex-end' }}>
          <div style={{
            width: '100%', maxWidth: 400, boxSizing: 'border-box',
            background: '#FFFDFB', border: '1px solid #E7E2DC', borderRadius: 22,
            boxShadow: '0 26px 60px rgba(28,25,23,.12)', padding: '30px 28px 24px',
          }}>
            {/*
              Deliberately generic. No tree context exists before sign-in, and
              naming the family here would leak it to anyone who finds the URL.
              The surname appears once you are inside an archive.
            */}
            <h2 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Sign in
            </h2>
            <p style={{ fontSize: 13, color: '#6B635C', lineHeight: 1.5, marginTop: 5, marginBottom: 0 }}>
              Use your Google account. If nobody has invited you yet, you can start
              an archive of your own.
            </p>

            {pendingInvite && (
              <div style={{
                marginTop: 16, padding: '11px 13px', borderRadius: 12,
                background: '#FEF3C7', border: '1px solid #FCD34D',
                fontSize: 12.5, fontWeight: 600, color: '#92400E',
              }}>
                You've been invited to join as {invitedRole === 'admin' ? 'an admin' : 'a viewer'}.
              </div>
            )}

            <button
              type="button"
              onClick={() => void signIn()}
              disabled={signingIn}
              style={{
                marginTop: 20, width: '100%', boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '12px 16px', borderRadius: 12,
                border: '1px solid #DADCE0', background: '#fff',
                fontSize: 14, fontWeight: 600, color: '#1F1F1F',
                fontFamily: 'inherit',
                cursor: signingIn ? 'default' : 'pointer',
                opacity: signingIn ? 0.7 : 1,
              }}
            >
              <GoogleMark />
              {signingIn ? 'Signing in…' : 'Continue with Google'}
            </button>

            {authError && (
              <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: '#B91C1C' }}>
                {authError}
              </div>
            )}

            <p style={{ fontSize: 11.5, color: '#A8A29E', lineHeight: 1.5, margin: '16px 0 0' }}>
              Your archive is private. Only people you invite can see it.
            </p>

            {repo.kind === 'local' && (
              <>
                <div style={{ height: 1, background: '#EFE9E2', margin: '18px 0 13px' }} />
                <p style={{ fontSize: 11.5, color: '#A8A29E', lineHeight: 1.5, margin: 0 }}>
                  Demo mode: no Supabase project is configured, so sign-in uses a sample
                  account. Add <code style={{ fontFamily: 'ui-monospace, monospace' }}>VITE_SUPABASE_URL</code> and{' '}
                  <code style={{ fontFamily: 'ui-monospace, monospace' }}>VITE_SUPABASE_ANON_KEY</code> to{' '}
                  <code style={{ fontFamily: 'ui-monospace, monospace' }}>.env.local</code> for real Google sign-in.
                </p>
              </>
            )}
          </div>
        </div>

      </div>
      <AppFooter showTree={false} />
    </div>
  );
}
