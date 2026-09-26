import { useState } from 'react';
import { useTreeStore } from '../store/useTreeStore';

export function NewTreeModal() {
  const store = useTreeStore();
  const { newTreeOpen, setNewTreeOpen, createTree } = store;
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  if (!newTreeOpen) return null;

  const handle = () => {
    if (!name.trim()) return;
    createTree(name.trim(), notes.trim());
    setName(''); setNotes('');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 85, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3vh 16px', background: 'rgba(41,37,36,.42)', backdropFilter: 'blur(3px)' }}
      onClick={() => setNewTreeOpen(false)}
    >
      <div style={{ width: 'min(440px,96vw)', background: '#FFFDFB', borderRadius: 20, boxShadow: '0 30px 80px rgba(28,25,23,.3)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #EFE9E2', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>Create New Family Tree</div>
          <button type="button" onClick={() => setNewTreeOpen(false)} style={iconBtn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'block' }}>
            <span style={lbl}>Family Name *</span>
            <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder='e.g. "Sharma" becomes "Sharma Family Tree"' />
          </label>
          <label style={{ display: 'block' }}>
            <span style={lbl}>Origin notes (optional)</span>
            <textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Where the family originated, founding notes…" />
          </label>
          {name && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FEF6F1', border: '1px solid #FED7AA', fontSize: 12.5, fontWeight: 600, color: '#C2410C' }}>
              Your tree will be called: <strong>{name} Family Tree</strong>
            </div>
          )}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid #EFE9E2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={() => setNewTreeOpen(false)} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#78716C' }}>Cancel</button>
          <button type="button" onClick={handle} disabled={!name.trim()} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: name.trim() ? '#1C1917' : '#A8A29E', color: '#fff', cursor: name.trim() ? 'pointer' : 'not-allowed', fontSize: 12.5, fontWeight: 700 }}>Create Tree</button>
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#78716C', marginBottom: 5 };
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid #E7E2DC', background: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit' };
const iconBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 9, border: '1px solid #E7E2DC', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#57534E' };
