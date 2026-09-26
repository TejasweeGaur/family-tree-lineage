import { useState } from 'react';
import { useTreeStore } from '../store/useTreeStore';
import { COUNTRY_HINTS } from '../data/countries';

/**
 * Shown when someone is signed in but holds no membership. That is the normal
 * first-run state, not an error: every archive in the app starts here, and a
 * visitor who arrives without an invite gets their own rather than a rejection.
 */
export function CreateTreeScreen() {
  const user = useTreeStore(s => s.session?.user);
  const creatingTree = useTreeStore(s => s.creatingTree);
  const authError = useTreeStore(s => s.authError);
  const createFirstTree = useTreeStore(s => s.createFirstTree);
  const signOut = useTreeStore(s => s.signOut);

  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [country, setCountry] = useState('');
  const canCreate = name.trim().length > 0 && !creatingTree;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      background: '#F7F5F2',
      backgroundImage: 'radial-gradient(#DED7CE 1.1px, transparent 1.1px)',
      backgroundSize: '22px 22px',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      overflowY: 'auto',
    }}>
      <form
        onSubmit={e => { e.preventDefault(); if (canCreate) void createFirstTree(name.trim(), place.trim(), country.trim()); }}
        style={{
          width: '100%', maxWidth: 440, boxSizing: 'border-box',
          background: '#FFFDFB', border: '1px solid #E7E2DC', borderRadius: 22,
          boxShadow: '0 26px 60px rgba(28,25,23,.12)', padding: '30px 28px 24px',
        }}
      >
        <div style={{
          width: 50, height: 50, borderRadius: 15, background: '#C2410C',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round">
            <circle cx="12" cy="5" r="2.6" />
            <circle cx="5.5" cy="18.5" r="2.6" />
            <circle cx="18.5" cy="18.5" r="2.6" />
            <path d="M12 7.6V12M5.5 15.9v-1.6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1.6" />
          </svg>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 18, marginBottom: 0 }}>
          Create your family archive
        </h1>
        <p style={{ fontSize: 13, color: '#6B635C', lineHeight: 1.5, marginTop: 5, marginBottom: 0 }}>
          You don't belong to an archive yet. Start one and you'll be its administrator —
          you can invite relatives afterwards.
        </p>

        <label style={{ display: 'block', marginTop: 20 }}>
          <span style={labelStyle}>Family name *</span>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Gaur" autoFocus style={inputStyle}
          />
          <span style={{ display: 'block', fontSize: 11, color: '#A8A29E', marginTop: 5 }}>
            Shown as “{name.trim() || 'Family name'} Family Tree” throughout the app.
          </span>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginTop: 14 }}>
          <label style={{ display: 'block' }}>
            <span style={labelStyle}>Ancestral place</span>
            <input
              type="text" value={place} onChange={e => setPlace(e.target.value)}
              placeholder="e.g. Varanasi" style={inputStyle}
            />
          </label>
          <label style={{ display: 'block' }}>
            <span style={labelStyle}>Country</span>
            {/*
              A datalist, not a select: genealogy runs into places that no longer
              exist as countries. Suggest the common ones, accept anything.
            */}
            <input
              type="text" value={country} onChange={e => setCountry(e.target.value)}
              list="ft-countries" placeholder="e.g. India" style={inputStyle}
            />
            <datalist id="ft-countries">
              {COUNTRY_HINTS.map(c => <option key={c} value={c} />)}
            </datalist>
          </label>
        </div>
        <span style={{ display: 'block', fontSize: 11, color: '#A8A29E', marginTop: 5 }}>
          Optional. Where the family traces back to — shown beneath the archive name.
        </span>

        <button type="submit" disabled={!canCreate} style={{
          marginTop: 22, width: '100%', boxSizing: 'border-box',
          padding: '12px 16px', borderRadius: 12, border: 'none',
          background: canCreate ? '#C2410C' : '#D6D0C9', color: '#fff',
          fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
          cursor: canCreate ? 'pointer' : 'not-allowed',
        }}>
          {creatingTree ? 'Creating…' : 'Create archive'}
        </button>

        {authError && (
          <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: '#B91C1C' }}>
            {authError}
          </div>
        )}

        <div style={{ height: 1, background: '#EFE9E2', margin: '20px 0 14px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 11.5, color: '#A8A29E', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Signed in as {user?.email}
          </span>
          <button type="button" onClick={() => void signOut()} style={{
            flexShrink: 0, padding: '6px 10px', borderRadius: 8,
            border: '1px solid #E7E2DC', background: '#fff',
            fontSize: 11.5, fontWeight: 700, color: '#78716C',
            fontFamily: 'inherit', cursor: 'pointer',
          }}>Sign out</button>
        </div>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#78716C', marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
  border: '1px solid #E7E2DC', background: '#fff', fontSize: 13, outline: 'none',
  fontFamily: 'inherit',
};
