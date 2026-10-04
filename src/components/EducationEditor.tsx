import type { EducationEntry } from '../types';
import { RefSelect } from './RefSelect';

interface Props {
  rows: EducationEntry[];
  levels: string[];
  onChange: (rows: EducationEntry[]) => void;
  /** Phones get one card per entry instead of a five-column table. */
  stacked: boolean;
}

const blank: EducationEntry = { level: '', branch: '', institution: '', year: '' };

/** Optional education history: level, branch, institution and year of passing. */
export function EducationEditor({ rows, levels, onChange, stacked }: Props) {
  const update = (i: number, patch: Partial<EducationEntry>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i));

  const cols = '1.05fr 1.2fr 1.5fr 84px 34px';

  return (
    <div>
      {rows.length > 0 && !stacked && (
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, marginBottom: 6 }}>
          {['Education', 'Branch / Specialization', 'College / Institution', 'Year', ''].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: '#78716C' }}>{h}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: stacked ? 10 : 7 }}>
        {rows.map((r, i) => {
          const del = (
            <button type="button" onClick={() => remove(i)} aria-label={`Remove education row ${i + 1}`} style={{
              width: 34, height: 36, borderRadius: 9, border: '1px solid #FECACA', background: '#FEF2F2',
              color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          );
          const level = (
            <RefSelect value={r.level} options={levels} onChange={v => update(i, { level: v })} emptyLabel="Select…" compact label="Education" hideLabel={!stacked} />
          );
          const branch = <Input label="Branch / Specialization" showLabel={stacked} value={r.branch} onChange={v => update(i, { branch: v })} placeholder="e.g. Computer Science" />;
          const inst = <Input label="College / Institution" showLabel={stacked} value={r.institution} onChange={v => update(i, { institution: v })} placeholder="e.g. Delhi University" />;
          const year = (
            <Input
              label="Year of passing"
              showLabel={stacked}
              value={r.year}
              onChange={v => update(i, { year: v.replace(/\D/g, '').slice(0, 4) })}
              placeholder="yyyy"
              inputMode="numeric"
            />
          );

          return stacked ? (
            <div key={i} style={{ padding: 12, border: '1px solid #EFE9E2', borderRadius: 12, background: '#FAF8F5', display: 'grid', gap: 9 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: 0 }}>{level}</div>
                {del}
              </div>
              {branch}
              {inst}
              <div style={{ width: 110 }}>{year}</div>
            </div>
          ) : (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center' }}>
              {level}{branch}{inst}{year}{del}
            </div>
          );
        })}
      </div>

      <button type="button" onClick={() => onChange([...rows, { ...blank }])} style={{
        marginTop: rows.length ? 10 : 0, display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 13px', borderRadius: 10, border: '1px dashed #D6CFC7', background: '#fff',
        cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#44403C', fontFamily: 'inherit',
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        Add education
      </button>
    </div>
  );
}

function Input({ label, showLabel, value, onChange, placeholder, inputMode }: {
  label: string; showLabel: boolean; value: string; onChange: (v: string) => void; placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  const input = (
    <input
      type="text"
      value={value}
      inputMode={inputMode}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      style={{
        width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 10,
        border: '1px solid #E7E2DC', background: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit',
      }}
    />
  );
  if (!showLabel) return input;
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#78716C', marginBottom: 5 }}>{label}</span>
      {input}
    </label>
  );
}
