import { useTreeStore } from '../store/useTreeStore';
import { parentsOf, fullName } from '../utils/kinship';
import { year } from '../utils/dates';
import type { RelativeKind } from '../types';

const KINDS: RelativeKind[] = ['Son', 'Daughter', 'Husband', 'Wife', 'Father', 'Mother', 'Brother', 'Sister'];

export function AddMemberDialog() {
  const addDialog = useTreeStore(s => s.addDialog);
  const persons = useTreeStore(s => s.persons);
  const unions = useTreeStore(s => s.unions);
  const setAddAnchor = useTreeStore(s => s.setAddAnchor);
  const setAddKind = useTreeStore(s => s.setAddKind);
  const closeAddDialog = useTreeStore(s => s.closeAddDialog);
  const confirmAddDialog = useTreeStore(s => s.confirmAddDialog);

  if (!addDialog) return null;
  // openAddDialog routes an empty archive straight to the form; this is a
  // backstop so the dialog can never render with nothing to relate to.
  if (!persons.length) return null;

  const anchor = persons.find(p => p.id === addDialog.anchorId);
  const data = { persons, unions };

  const parents = anchor ? parentsOf(data, anchor.id) : [];
  const hasFather = parents.some(id => persons.find(p => p.id === id)?.gender === 'Male');
  const hasMother = parents.some(id => persons.find(p => p.id === id)?.gender === 'Female');
  const hasParentUnion = anchor ? unions.some(u => u.children.includes(anchor.id)) : false;

  /** Same gating as the card's add-relative menu, kept in one place. */
  function disabledReason(kind: RelativeKind): string {
    if (kind === 'Father' && hasFather) return 'Father already recorded';
    if (kind === 'Mother' && hasMother) return 'Mother already recorded';
    if ((kind === 'Brother' || kind === 'Sister') && !hasParentUnion) return 'Add a parent first';
    return '';
  }

  const sorted = [...persons].sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const kind = addDialog.kind;
  const hint = kind && anchor ? `Adding the ${kind.toLowerCase()} of ${fullName(anchor)}.` : '';

  return (
    <div
      onClick={closeAddDialog}
      style={{
        position: 'fixed', inset: 0, zIndex: 88,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3vh 16px',
        background: 'rgba(28,25,23,.42)', backdropFilter: 'blur(3px)',
      }}
    >
      <div
        role="dialog"
        aria-label="Add family member"
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(460px, 96vw)', background: '#FFFDFB', borderRadius: 20,
          boxShadow: '0 26px 60px rgba(28,25,23,.26)', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '18px 22px 0' }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.015em' }}>Add family member</div>
          <div style={{ fontSize: 12.5, color: '#6B635C', marginTop: 3 }}>
            Choose who they're related to and how.
          </div>
        </div>

        <div style={{ padding: '18px 22px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.13em', color: '#78716C', marginBottom: 7 }}>
            RELATED TO
          </div>
          <select
            value={addDialog.anchorId}
            onChange={e => setAddAnchor(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px',
              borderRadius: 10, border: '1px solid #E7E2DC', background: '#fff',
              fontSize: 13, fontFamily: 'inherit', color: '#1C1917',
            }}
          >
            {sorted.map(p => (
              <option key={p.id} value={p.id}>
                {fullName(p)}{p.dob ? ` (${year(p.dob)})` : ''}
              </option>
            ))}
          </select>

          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.13em', color: '#78716C', margin: '18px 0 7px' }}>
            NEW MEMBER IS THEIR
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
            {KINDS.map(k => {
              const why = disabledReason(k);
              const isOn = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={!!why}
                  title={why}
                  onClick={() => setAddKind(k)}
                  style={{
                    padding: '9px 6px', borderRadius: 10,
                    border: `1.5px solid ${isOn ? '#C2410C' : '#E7E2DC'}`,
                    background: isOn ? '#FEF6F1' : '#fff',
                    color: why ? '#C6BFB7' : isOn ? '#9A3412' : '#44403C',
                    fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                    cursor: why ? 'not-allowed' : 'pointer',
                  }}
                >
                  {k}
                </button>
              );
            })}
          </div>

          {hint && (
            <div style={{ fontSize: 12.5, color: '#6B635C', marginTop: 14 }}>{hint}</div>
          )}
        </div>

        <div style={{
          padding: '14px 22px', borderTop: '1px solid #EFE9E2',
          display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          <button
            type="button"
            onClick={closeAddDialog}
            style={{
              padding: '10px 16px', borderRadius: 10, border: 'none', background: 'none',
              cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#78716C', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmAddDialog}
            disabled={!kind}
            style={{
              padding: '10px 20px', borderRadius: 10, border: 'none',
              background: kind ? '#1C1917' : '#E0C3B2', color: '#fff',
              cursor: kind ? 'pointer' : 'not-allowed',
              fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
