import { useTreeStore } from '../store/useTreeStore';
import { renderMarkdown } from '../utils/markdown';

const LABEL_CHIPS = [
  'Ancestral Patriarch', 'Ancestral Matriarch', 'Patriarch', 'Matriarch',
  'Son', 'Daughter', 'Father', 'Mother', 'Grandfather', 'Grandmother',
  'Married in', 'Relative',
];

export function PersonForm() {
  const store = useTreeStore();
  const { form, persons } = store;
  if (!form) return null;

  const v = form.values;
  const isEdit = form.mode === 'edit';
  const isSpouse = form.group === 'spouse';
  const isRoot = form.group === 'root';
  const showLabel = isEdit || isRoot;

  const targetPerson = persons.find(p => p.id === form.targetId);

  // Dynamic title
  let title = 'Add Family Member';
  let subtitle = '';
  if (isEdit) {
    title = 'Edit Family Member Profile';
    subtitle = 'Admin Genealogy Record Editor';
  } else {
    const kindMap: Record<string, string> = { child: 'CHILD', spouse: 'SPOUSE', parent: 'PARENT', sibling: 'SIBLING', root: 'ANCESTOR' };
    const gMap: Record<string, Record<string, string>> = {
      child: { Male: 'SON', Female: 'DAUGHTER', Other: 'CHILD' },
      spouse: { Male: 'HUSBAND', Female: 'WIFE', Other: 'SPOUSE' },
      parent: { Male: 'FATHER', Female: 'MOTHER', Other: 'PARENT' },
      sibling: { Male: 'BROTHER', Female: 'SISTER', Other: 'SIBLING' },
      root: { Male: 'ANCESTOR', Female: 'ANCESTOR', Other: 'ANCESTOR' },
    };
    const kind = gMap[form.group]?.[v.gender] || kindMap[form.group] || 'RELATIVE';
    title = targetPerson ? `Add ${kind} to ${targetPerson.first} ${targetPerson.last}` : `Add ${kind}`;
    if (targetPerson) {
      const spouses = store.unions.filter(u => u.a === targetPerson.id || u.b === targetPerson.id)
        .map(u => { const id = u.a === targetPerson.id ? u.b : u.a; return id ? persons.find(p => p.id === id) : null; })
        .filter(Boolean);
      if (spouses.length > 0) subtitle = `Linking to ${targetPerson.first} ${targetPerson.last} & ${spouses[0]?.first} ${spouses[0]?.last}`;
      else subtitle = `Linking to ${targetPerson.first} ${targetPerson.last}`;
    }
  }

  // Avatar initials
  const first0 = v.first ? v.first[0].toUpperCase() : '?';
  const last0 = v.last ? v.last[0].toUpperCase() : (targetPerson?.last?.[0]?.toUpperCase() || '');
  const avInitials = first0 + last0;
  const pal = v.gender === 'Male' ? { avFill: '#BAE6FD', avText: '#075985' } : v.gender === 'Female' ? { avFill: '#FBCFE8', avText: '#9D174D' } : { avFill: '#E7E5E4', avText: '#44403C' };

  const showDeath = !v.living;
  const hasUnion = store.unions.some(u => u.a === form.targetId || u.b === form.targetId);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3vh 16px', background: 'rgba(41,37,36,.42)', backdropFilter: 'blur(3px)' }}>
      <div role="dialog" aria-label="Family member form" style={{
        width: 'min(880px,96vw)', maxHeight: '94vh',
        background: '#FFFDFB', borderRadius: 20,
        boxShadow: '0 30px 80px rgba(28,25,23,.3)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 22px', borderBottom: '1px solid #EFE9E2' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.018em' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: '#8A817A', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button type="button" onClick={store.closeForm} aria-label="Close" style={iconBtn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 22px 26px', display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Avatar + gender */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: 16, border: '1px solid #EFE9E2', borderRadius: 16, background: '#FAF8F5' }}>
            <button type="button" style={{
              width: 78, height: 78, borderRadius: '50%', flexShrink: 0,
              border: '2px dashed rgba(28,25,23,.18)', background: pal.avFill,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
            }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: pal.avText }}>{avInitials}</span>
              <span style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', padding: '2px 8px', borderRadius: 99, background: '#1C1917', color: '#fff', fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap' }}>Upload</span>
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: '#A8A29E', marginBottom: 9 }}>GENDER (COLOR IDENTIFICATION) *</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['Male', 'Female', 'Other'] as const).map(g => {
                  const active = v.gender === g;
                  const bg = active ? (g === 'Male' ? '#E0F2FE' : g === 'Female' ? '#FCE7F3' : '#F0EDE9') : '#fff';
                  const border = active ? (g === 'Male' ? '#38BDF8' : g === 'Female' ? '#F472B6' : '#A8A29E') : '#E7E2DC';
                  const color = active ? (g === 'Male' ? '#075985' : g === 'Female' ? '#9D174D' : '#44403C') : '#57534E';
                  return (
                    <button key={g} type="button" onClick={() => store.setFormValue('gender', g)} style={{
                      padding: '9px 18px', borderRadius: 10, cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                      background: bg, border: `1.5px solid ${border}`, color,
                    }}>{g}</button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Identity */}
          <div>
            <div style={sectionLabel}>IDENTITY</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
              <Field label="First name *" value={v.first} onChange={val => store.setFormValue('first', val)} placeholder="Given name" />
              <Field label="Last / Family name *" value={v.last} onChange={val => store.setFormValue('last', val)} placeholder="Family name" />
              <Field label="Maiden / Birth name" value={v.maiden} onChange={val => store.setFormValue('maiden', val)} placeholder="If different at birth" />
            </div>
          </div>

          {/* Vital stats */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={sectionLabel as any}>VITAL STATISTICS & DATES</span>
              <button type="button" onClick={() => store.setFormValue('living', !v.living)} style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}>
                <span style={{ width: 18, height: 18, borderRadius: 5, border: '1.5px solid #D6CFC7', background: v.living ? '#1C1917' : '#fff', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {v.living ? '✓' : ''}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#44403C' }}>Is Currently Living</span>
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
              <Field label="Date of Birth" value={v.dob} onChange={val => store.setFormValue('dob', val)} placeholder="YYYY-MM-DD or year" />
              <Field label="Place of Birth" value={v.pob} onChange={val => store.setFormValue('pob', val)} placeholder="City, region" />
              {showDeath && <>
                <Field label="Date of Death" value={v.dod} onChange={val => store.setFormValue('dod', val)} placeholder="YYYY-MM-DD or year" />
                <Field label="Place of Death" value={v.pod} onChange={val => store.setFormValue('pod', val)} placeholder="City, region" />
              </>}
            </div>
          </div>

          {/* Marriage (for spouse add or edit with union) */}
          {(isSpouse || (isEdit && hasUnion)) && (
            <div style={{ padding: 16, border: '1px solid #FCD34D', background: '#FFFBEB', borderRadius: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: '#92400E', marginBottom: 10 }}>
                {isEdit ? 'MARRIAGE DETAILS' : 'MARRIAGE / ANNIVERSARY'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
                <Field label="Marriage / Anniversary Date" value={v.mdate} onChange={val => store.setFormValue('mdate', val)} placeholder="YYYY-MM-DD or year" amber />
                <Field label="Place of Marriage" value={v.mplace} onChange={val => store.setFormValue('mplace', val)} placeholder="City, region" amber />
              </div>
              <div style={{ fontSize: 11, color: '#92400E', marginTop: 9 }}>Stored once on the marriage record, so both spouses stay in sync.</div>
            </div>
          )}

          {/* Life & place */}
          <div>
            <div style={sectionLabel}>LIFE & PLACE</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
              <Field label="Occupation / Profession" value={v.occupation} onChange={val => store.setFormValue('occupation', val)} placeholder="e.g. Classical Scholar" />
              <Field label="Residency / Heritage City" value={v.residency} onChange={val => store.setFormValue('residency', val)} placeholder="e.g. Varanasi" />
              <Field label="Gotra" value={v.gotra} onChange={val => store.setFormValue('gotra', val)} placeholder="e.g. Bharadwaj" />
              <Field label="Shasan" value={v.shasan} onChange={val => store.setFormValue('shasan', val)} placeholder="e.g. Vaishnav" />
            </div>
          </div>

          {/* Relationship label */}
          {showLabel && (
            <div>
              <div style={sectionLabel}>RELATIONSHIP LABEL</div>
              <input type="text" value={v.label} onChange={e => store.setFormValue('label', e.target.value)} placeholder="e.g. Ancestral Patriarch" style={inputStyle} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
                {LABEL_CHIPS.map(lc => (
                  <button key={lc} type="button" onClick={() => store.setFormValue('label', lc)} style={{
                    padding: '6px 12px', borderRadius: 99, border: '1px solid #E7E2DC',
                    background: v.label === lc ? '#1C1917' : '#fff', cursor: 'pointer',
                    fontSize: 11.5, fontWeight: 700,
                    color: v.label === lc ? '#fff' : '#57534E',
                  }}>{lc}</button>
                ))}
              </div>
            </div>
          )}

          {/* Biography */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={sectionLabel as any}>BIOGRAPHY</span>
              <span style={{ marginLeft: 'auto', display: 'flex', background: '#F5F1EC', borderRadius: 8, padding: 2, gap: 2 }}>
                {(['write', 'preview'] as const).map(t => (
                  <button key={t} type="button" onClick={() => store.setBioTab(t)} style={{
                    padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 11.5, fontWeight: 700,
                    background: form.bioTab === t ? '#fff' : 'transparent',
                    color: form.bioTab === t ? '#1C1917' : '#78716C',
                  }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
                ))}
              </span>
            </div>
            <div style={{ border: '1px solid #E7E2DC', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
              <div style={{ display: 'flex', gap: 4, padding: '7px 9px', borderBottom: '1px solid #F3EFEA', background: '#FAF8F5' }}>
                {[['B', '**'], ['I', '*'], ['H2', '## '], ['•', '- '], ['1.', '1. '], ['❝', '> ']].map(([label, md]) => (
                  <button key={label} type="button" onClick={() => {
                    const cur = v.bio || '';
                    store.setFormValue('bio', cur + (cur && !cur.endsWith('\n') ? '\n' : '') + md);
                  }} style={{
                    padding: '4px 9px', borderRadius: 7, border: '1px solid #E7E2DC',
                    background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#57534E',
                  }}>{label}</button>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: 10.5, color: '#A8A29E', alignSelf: 'center' }}>Markdown Supported</span>
              </div>
              {form.bioTab === 'write'
                ? <textarea value={v.bio} onChange={e => store.setFormValue('bio', e.target.value)} rows={7} placeholder="### Heading&#10;Write the life story here. **Bold**, *italics*, - lists and > quotes are supported." style={{ width: '100%', border: 'none', padding: 14, fontSize: 13, lineHeight: 1.6, resize: 'vertical', background: '#fff', color: '#292524', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                : <div style={{ padding: 14 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(v.bio) }} />
              }
            </div>
          </div>

          {/* Delete — the confirm dialog is shared with the card's trash button,
              and enforces the no-descendants rule in one place. */}
          {isEdit && (
            <div style={{ borderTop: '1px solid #EFE9E2', paddingTop: 16 }}>
              <button
                type="button"
                onClick={() => store.askDelete(form.targetId)}
                style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#B91C1C', fontFamily: 'inherit' }}
              >
                Remove this person from the family tree
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid #EFE9E2', background: '#FFFDFB' }}>
          <button type="button" onClick={store.closeForm} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#78716C' }}>Cancel</button>
          <button type="button" onClick={store.saveForm} disabled={!v.first || !v.last} style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: v.first && v.last ? '#1C1917' : '#A8A29E',
            color: '#fff', cursor: v.first && v.last ? 'pointer' : 'not-allowed',
            fontSize: 12.5, fontWeight: 700,
          }}>
            {isEdit ? 'Save Changes' : 'Add to Tree'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, amber }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; amber?: boolean;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: amber ? '#92400E' : '#78716C', marginBottom: 5 }}>{label}</span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ ...inputStyle, borderColor: amber ? '#FCD34D' : '#E7E2DC' }} />
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
  border: '1px solid #E7E2DC', background: '#fff', fontSize: 13, outline: 'none',
  fontFamily: 'inherit',
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: '#A8A29E', marginBottom: 10, display: 'block',
};

const iconBtn: React.CSSProperties = {
  marginLeft: 'auto', width: 32, height: 32, borderRadius: 9, border: '1px solid #E7E2DC',
  background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#57534E',
};
