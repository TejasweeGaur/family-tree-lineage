import { useTreeStore } from '../store/useTreeStore';
import { spousesOf, parentsOf, siblingsOf, fullName } from '../utils/kinship';

export function DeleteConfirmDialog() {
  const confirmDeleteId = useTreeStore(s => s.confirmDeleteId);
  const persons = useTreeStore(s => s.persons);
  const unions = useTreeStore(s => s.unions);
  const cancelDelete = useTreeStore(s => s.cancelDelete);
  const doDelete = useTreeStore(s => s.doDelete);

  if (!confirmDeleteId) return null;
  const person = persons.find(p => p.id === confirmDeleteId);
  if (!person) return null;

  const data = { persons, unions };
  const connected = new Set([
    ...spousesOf(data, person.id),
    ...parentsOf(data, person.id),
    ...siblingsOf(data, person.id),
  ]).size;

  return (
    <div
      onClick={cancelDelete}
      style={{
        position: 'fixed', inset: 0, zIndex: 92,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3vh 16px',
        background: 'rgba(28,25,23,.42)', backdropFilter: 'blur(3px)',
      }}
    >
      <div
        role="alertdialog"
        aria-label={`Remove ${fullName(person)} from the tree`}
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(420px, 96vw)', background: '#FFFDFB',
          border: '1px solid #FCA5A5', borderRadius: 18,
          boxShadow: '0 26px 60px rgba(28,25,23,.26)', padding: '20px 22px',
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.13em', color: '#B91C1C' }}>
          ADMIN ACTION
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.015em', marginTop: 8 }}>
          Remove {fullName(person)} from the tree?
        </div>
        <p style={{ fontSize: 13, color: '#57534E', lineHeight: 1.55, marginTop: 9, marginBottom: 0 }}>
          This deletes their profile, archives and media, and unlinks them from {connected} connected{' '}
          {connected === 1 ? 'relative' : 'relatives'}. This cannot be undone.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={cancelDelete}
            style={{
              padding: '10px 16px', borderRadius: 10, border: 'none', background: 'none',
              cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#78716C', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={doDelete}
            style={{
              padding: '10px 18px', borderRadius: 10, border: 'none',
              background: '#B91C1C', color: '#fff', cursor: 'pointer',
              fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
            }}
          >
            Delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}
