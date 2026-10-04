import { useState } from 'react';

const ADD = '\u0000add';

interface Props {
  label?: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  /** e.g. "Gotra": offers "+ Add a new Gotra…". Omit for a fixed list. */
  addNoun?: string;
  emptyLabel?: string;
  compact?: boolean;
  /** Keep the label for screen readers only, as in a table row. */
  hideLabel?: boolean;
}

/**
 * A dropdown of known values that can grow: picking "+ Add a new …" turns it
 * into a text box. A value saved on a profile shows up in everyone's dropdown
 * for that tree from then on.
 */
export function RefSelect({ label, value, options, onChange, addNoun, emptyLabel = 'Not documented', compact, hideLabel }: Props) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  // A value from before the list existed, or since removed from it, still shows.
  const all = value && !options.includes(value) ? [value, ...options] : options;
  const pad = compact ? '8px 10px' : '10px 12px';

  const commit = () => {
    const v = text.trim();
    if (v) onChange(v);
    setAdding(false);
    setText('');
  };

  const field = adding ? (
    <div style={{ display: 'flex', gap: 6 }}>
      <input
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { e.stopPropagation(); setAdding(false); }
        }}
        placeholder={`New ${addNoun?.toLowerCase()}`}
        aria-label={`New ${addNoun?.toLowerCase()}`}
        style={{ ...inputBase, padding: pad, flex: 1, minWidth: 0 }}
      />
      <button type="button" onClick={commit} disabled={!text.trim()} style={{
        ...smallBtn, background: text.trim() ? '#1C1917' : '#D6D3D1', color: '#fff', border: 'none',
        cursor: text.trim() ? 'pointer' : 'not-allowed',
      }}>Add</button>
      <button type="button" onClick={() => setAdding(false)} style={smallBtn}>Cancel</button>
    </div>
  ) : (
    <select
      value={value}
      aria-label={label}
      onChange={e => {
        if (e.target.value === ADD) { setAdding(true); return; }
        onChange(e.target.value);
      }}
      style={{ ...inputBase, padding: pad, color: value ? '#1C1917' : '#A8A29E' }}
    >
      <option value="">{emptyLabel}</option>
      {all.map(o => <option key={o} value={o}>{o}</option>)}
      {addNoun && <option value={ADD}>+ Add a new {addNoun}…</option>}
    </select>
  );

  if (!label || hideLabel) return field;
  return (
    <div>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#78716C', marginBottom: 5 }}>{label}</span>
      {field}
    </div>
  );
}

const inputBase: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', borderRadius: 10,
  border: '1px solid #E7E2DC', background: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit',
};

const smallBtn: React.CSSProperties = {
  flexShrink: 0, padding: '0 11px', borderRadius: 9, border: '1px solid #E7E2DC', background: '#fff',
  cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#44403C', fontFamily: 'inherit',
};
