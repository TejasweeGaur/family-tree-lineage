import { useState } from 'react';
import { useTreeStore } from '../store/useTreeStore';
import type { RefCategory, RefCode } from '../types';

const TABS: Array<{ category: RefCategory; label: string; noun: string }> = [
  { category: 'EDUCATION_LEVEL', label: 'Education levels', noun: 'education level' },
  { category: 'GOTRA', label: 'Gotras', noun: 'gotra' },
  { category: 'SHASAN', label: 'Shasans', noun: 'shasan' },
];

export function RefDataModal() {
  const open = useTreeStore(s => s.refDataOpen);
  return open ? <Dialog /> : null;
}

/**
 * Super admins only: the shared lists behind the Education, Gotra and Shasan
 * dropdowns, for every tree. Families can still add their own gotras and
 * shasans on a profile; those stay within their tree unless added here.
 */
function Dialog() {
  const setOpen = useTreeStore(s => s.setRefDataOpen);
  const refCodes = useTreeStore(s => s.refCodes);
  const persons = useTreeStore(s => s.persons);
  const saveRefCode = useTreeStore(s => s.saveRefCode);
  const deleteRefCode = useTreeStore(s => s.deleteRefCode);
  const winW = useTreeStore(s => s.winW);

  const [tab, setTab] = useState<RefCategory>('EDUCATION_LEVEL');
  const [code, setCode] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ code: string; desc: string } | null>(null);
  const [armed, setArmed] = useState<string | null>(null);

  const meta = TABS.find(t => t.category === tab)!;
  const rows = refCodes.filter(r => r.category === tab);
  const exists = (c: string) => rows.some(r => r.code.toLowerCase() === c.trim().toLowerCase());
  // Values this family typed on profiles that aren't in the shared list yet.
  const suggestions = tab === 'EDUCATION_LEVEL' ? [] : [...new Set(
    persons.map(p => (tab === 'GOTRA' ? p.gotra : p.shasan).trim()).filter(v => v && !exists(v)),
  )].sort();

  const add = async (c: string, d: string) => {
    if (!c.trim() || exists(c)) return;
    setBusy(true);
    const ok = await saveRefCode({ category: tab, code: c.trim(), description: d.trim(), createdAt: '' });
    setBusy(false);
    if (ok) { setCode(''); setDesc(''); }
  };

  const saveEdit = async (r: RefCode) => {
    if (!editing) return;
    setBusy(true);
    const ok = await saveRefCode({ ...r, description: editing.desc });
    setBusy(false);
    if (ok) setEditing(null);
  };

  const narrow = winW < 640;

  return (
    <div onClick={() => setOpen(false)} style={{
      position: 'fixed', inset: 0, zIndex: 95, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '3vh 12px', background: 'rgba(28,25,23,.5)', backdropFilter: 'blur(3px)',
    }}>
      <div role="dialog" aria-label="Reference data" onClick={e => e.stopPropagation()} style={{
        width: 'min(640px, 96vw)', maxHeight: '92dvh', display: 'flex', flexDirection: 'column',
        background: '#FFFDFB', borderRadius: 20, boxShadow: '0 26px 60px rgba(28,25,23,.3)', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 22px 0', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.015em' }}>Reference data</div>
            <div style={{ fontSize: 12, color: '#78716C', marginTop: 3, lineHeight: 1.5 }}>
              The shared dropdown lists for every family tree. Only super admins see this.
            </div>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{
            width: 32, height: 32, borderRadius: 9, border: '1px solid #E7E2DC', background: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#57534E', flexShrink: 0,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div role="tablist" style={{ display: 'flex', gap: 4, padding: '14px 22px 0', borderBottom: '1px solid #EFE9E2' }}>
          {TABS.map(t => (
            <button key={t.category} type="button" role="tab" aria-selected={tab === t.category}
              onClick={() => { setTab(t.category); setEditing(null); setArmed(null); setCode(''); setDesc(''); }}
              style={{
                padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 12.5, fontWeight: 700, color: tab === t.category ? '#C2410C' : '#78716C',
                borderBottom: `2px solid ${tab === t.category ? '#C2410C' : 'transparent'}`, marginBottom: -1,
              }}>
              {t.label} <span style={{ color: '#A8A29E', fontWeight: 600 }}>{refCodes.filter(r => r.category === t.category).length}</span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 22px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Add */}
          <form onSubmit={e => { e.preventDefault(); void add(code, desc); }} style={{ display: 'flex', gap: 8, flexWrap: narrow ? 'wrap' : 'nowrap' }}>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder={`New ${meta.noun}`} aria-label="Code" style={{ ...input, flex: narrow ? '1 1 100%' : '0 0 34%' }} />
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" aria-label="Description" style={{ ...input, flex: 1 }} />
            <button type="submit" disabled={busy || !code.trim() || exists(code)} style={{
              ...btn, background: code.trim() && !exists(code) ? '#1C1917' : '#D6D3D1', color: '#fff', border: 'none',
              cursor: code.trim() && !exists(code) ? 'pointer' : 'not-allowed',
            }}>Add</button>
          </form>
          {code.trim() && exists(code) && <div style={{ fontSize: 11.5, color: '#B45309', marginTop: -8 }}>Already in the list.</div>}

          {/* List */}
          <div style={{ border: '1px solid #EFE9E2', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
            {rows.length === 0 && (
              <div style={{ padding: 16, fontSize: 12.5, color: '#A8A29E', textAlign: 'center' }}>No entries yet.</div>
            )}
            {rows.map((r, i) => {
              const isEditing = editing?.code === r.code;
              return (
                <div key={r.code} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderTop: i ? '1px solid #F3EFEA' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{r.code}</div>
                    {isEditing ? (
                      <input autoFocus value={editing.desc} onChange={e => setEditing({ code: r.code, desc: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') void saveEdit(r); if (e.key === 'Escape') { e.stopPropagation(); setEditing(null); } }}
                        aria-label={`Description for ${r.code}`} style={{ ...input, marginTop: 5, padding: '6px 9px', fontSize: 12 }} />
                    ) : (
                      <div style={{ fontSize: 11.5, color: '#78716C', marginTop: 1 }}>
                        {r.description || <span style={{ color: '#C4BDB6' }}>No description</span>}
                        <span style={{ color: '#C4BDB6' }}> · added {new Date(r.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <>
                      <button type="button" onClick={() => void saveEdit(r)} disabled={busy} style={{ ...btn, background: '#1C1917', color: '#fff', border: 'none' }}>Save</button>
                      <button type="button" onClick={() => setEditing(null)} style={btn}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => { setEditing({ code: r.code, desc: r.description }); setArmed(null); }} style={btn}>Edit</button>
                      <button type="button"
                        onClick={() => { if (armed === r.code) { setArmed(null); void deleteRefCode(r.category, r.code); } else setArmed(r.code); }}
                        onBlur={() => setArmed(a => (a === r.code ? null : a))}
                        aria-label={`Delete ${r.code}`}
                        style={{ ...btn, color: armed === r.code ? '#fff' : '#B91C1C', background: armed === r.code ? '#B91C1C' : '#fff', borderColor: armed === r.code ? '#B91C1C' : '#E7E2DC' }}>
                        {armed === r.code ? 'Delete?' : 'Delete'}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {tab === 'EDUCATION_LEVEL'
            ? <div style={{ fontSize: 11.5, color: '#A8A29E', lineHeight: 1.5 }}>Shown in this order in the Education dropdown. Removing a level doesn't change profiles that already use it.</div>
            : <div style={{ fontSize: 11.5, color: '#A8A29E', lineHeight: 1.5 }}>Families can also add their own {meta.noun}s on a profile; those appear only in their own tree.</div>}

          {suggestions.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.11em', color: '#A8A29E', marginBottom: 8 }}>USED IN THIS TREE, NOT IN THE LIST</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {suggestions.map(v => (
                  <button key={v} type="button" onClick={() => void add(v, '')} disabled={busy} style={{ ...btn, borderStyle: 'dashed' }}>+ {v}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const input: React.CSSProperties = {
  boxSizing: 'border-box', padding: '9px 11px', borderRadius: 10, border: '1px solid #E7E2DC',
  background: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit', minWidth: 0, width: '100%',
};

const btn: React.CSSProperties = {
  flexShrink: 0, padding: '7px 11px', borderRadius: 9, border: '1px solid #E7E2DC', background: '#fff',
  cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#44403C', fontFamily: 'inherit', whiteSpace: 'nowrap',
};
