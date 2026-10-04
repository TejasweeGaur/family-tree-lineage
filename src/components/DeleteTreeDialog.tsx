import { useState } from 'react';
import { useTreeStore } from '../store/useTreeStore';
import { treeTitle } from '../utils/treeTitle';

export function DeleteTreeDialog() {
  const open = useTreeStore(s => s.deleteTreeOpen);
  // The inner component remounts on each open, so the typed confirmation
  // never carries over from a previous, cancelled attempt.
  return open ? <Confirm /> : null;
}

/**
 * Deleting a tree is irreversible and takes every file with it, so this asks
 * for the family name to be typed — a click alone is too easy to make — and
 * offers a backup first.
 */
function Confirm() {
  const deleting = useTreeStore(s => s.deletingTree);
  const setOpen = useTreeStore(s => s.setDeleteTreeOpen);
  const deleteActiveTree = useTreeStore(s => s.deleteActiveTree);
  const exportCsv = useTreeStore(s => s.exportCsv);
  const name = useTreeStore(s => s.trees.find(t => t.id === s.activeTreeId)?.name ?? '');
  const persons = useTreeStore(s => s.persons);
  const [typed, setTyped] = useState('');

  // Every record counts, with or without an attached file — all of them go.
  const records = persons.reduce((n, p) => n + p.archives.length, 0);
  const photos = persons.reduce((n, p) => n + p.media.length + (p.photoUrl ? 1 : 0), 0);
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase() && name !== '';
  const close = () => { if (!deleting) setOpen(false); };

  return (
    <div onClick={close} style={{
      position: 'fixed', inset: 0, zIndex: 95,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3vh 16px',
      background: 'rgba(28,25,23,.5)', backdropFilter: 'blur(3px)',
    }}>
      <div role="alertdialog" aria-label={`Delete the ${treeTitle(name)}`} onClick={e => e.stopPropagation()} style={{
        width: 'min(470px, 96vw)', background: '#FFFDFB', borderRadius: 20,
        boxShadow: '0 26px 60px rgba(28,25,23,.3)', overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 22px 0', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: '#FEF2F2', color: '#B91C1C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13" /></svg>
          </span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.015em' }}>Delete the {treeTitle(name)}?</div>
            <div style={{ fontSize: 12.5, color: '#6B635C', marginTop: 3 }}>This can't be undone.</div>
          </div>
        </div>

        <div style={{ padding: '16px 22px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '11px 13px', borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 12.5, lineHeight: 1.55 }}>
            Permanently removes <strong>{persons.length} {persons.length === 1 ? 'person' : 'people'}</strong>
            {records > 0 && <>, <strong>{records} archive {records === 1 ? 'record' : 'records'}</strong></>}
            {photos > 0 && <>, <strong>{photos} {photos === 1 ? 'photo' : 'photos'}</strong></>}
            , every invite link, and everyone's access to this tree.
          </div>

          {persons.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12, color: '#57534E' }}>
              <button type="button" onClick={exportCsv} style={{
                padding: '7px 12px', borderRadius: 9, border: '1px solid #E7E2DC', background: '#fff',
                cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#292524', fontFamily: 'inherit',
              }}>Download a CSV backup</button>
              <span style={{ flex: '1 1 200px', lineHeight: 1.45, color: '#A8A29E' }}>
                People and relationships only — photos and documents aren't included.
              </span>
            </div>
          )}

          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontSize: 12, color: '#57534E', marginBottom: 6 }}>
              Type <strong style={{ color: '#1C1917' }}>{name}</strong> to confirm
            </span>
            <input
              autoFocus
              value={typed}
              onChange={e => setTyped(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && matches) void deleteActiveTree(); }}
              aria-label="Type the family name to confirm"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
                border: `1px solid ${matches ? '#B91C1C' : '#E7E2DC'}`, background: '#fff',
                fontSize: 13, outline: 'none', fontFamily: 'inherit',
              }}
            />
          </label>
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid #EFE9E2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={close} disabled={deleting} style={{
            padding: '10px 16px', borderRadius: 10, border: 'none', background: 'none',
            cursor: deleting ? 'default' : 'pointer', fontSize: 12.5, fontWeight: 700, color: '#78716C', fontFamily: 'inherit',
          }}>Cancel</button>
          <button type="button" onClick={() => void deleteActiveTree()} disabled={!matches || deleting} style={{
            padding: '10px 18px', borderRadius: 10, border: 'none',
            background: matches && !deleting ? '#B91C1C' : '#E5C4C4', color: '#fff',
            cursor: matches && !deleting ? 'pointer' : 'not-allowed', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
          }}>{deleting ? 'Deleting…' : 'Delete permanently'}</button>
        </div>
      </div>
    </div>
  );
}
