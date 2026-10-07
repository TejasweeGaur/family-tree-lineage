import { useEffect, useId, useRef, useState } from 'react';
import { parseEntryText, toEntryText, todayIso, DATE_FORMAT_HINT } from '../utils/dates';

interface Props {
  label: string;
  /** ISO, possibly partial: yyyy-mm-dd, yyyy-mm or yyyy. */
  value: string;
  onChange: (iso: string) => void;
  /** Reports whether the typed text is a usable date, so the form can hold off saving. */
  onValidity?: (valid: boolean) => void;
  /** Birth and death dates can't be in the future. */
  noFuture?: boolean;
  amber?: boolean;
}

/**
 * A date that can be typed (dd/mm/yyyy, mm/yyyy or just yyyy, for ancestors
 * whose exact date is lost) or picked from the browser's own calendar.
 */
export function DateField({ label, value, onChange, onValidity, noFuture, amber }: Props) {
  const id = useId();
  // What the person is typing. null shows the stored value, formatted.
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');
  const pickerRef = useRef<HTMLInputElement>(null);

  // A field that goes away (say, date of death when "living" is ticked) mustn't
  // keep the form from saving. Held in a ref so the cleanup runs on unmount
  // only, not whenever the parent passes a new callback.
  const validityRef = useRef(onValidity);
  useEffect(() => { validityRef.current = onValidity; });
  useEffect(() => () => validityRef.current?.(true), []);

  const commit = (text: string) => {
    const r = parseEntryText(text, { noFuture });
    if ('error' in r) {
      setError(r.error);
      onValidity?.(false);
    } else {
      setError('');
      onValidity?.(true);
      if (r.iso !== value) onChange(r.iso);
    }
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    try { el.showPicker(); } catch { el.focus(); el.click(); }
  };

  const border = error ? '#DC2626' : amber ? '#FCD34D' : '#E7E2DC';

  return (
    <div>
      <label htmlFor={id} style={{ display: 'block', fontSize: 11, fontWeight: 700, color: amber ? '#92400E' : '#78716C', marginBottom: 5 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type="text"
          value={draft ?? toEntryText(value)}
          placeholder="dd/mm/yyyy"
          autoComplete="off"
          aria-invalid={!!error}
          aria-describedby={`${id}-hint`}
          onChange={e => { setDraft(e.target.value); commit(e.target.value); }}
          // Once a valid date is left, show it in the standard format.
          onBlur={() => { if (!error) setDraft(null); }}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '10px 42px 10px 12px', borderRadius: 10,
            border: `1px solid ${border}`, background: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={openPicker}
          aria-label={`Pick ${label.toLowerCase()} from a calendar`}
          style={{
            position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)',
            width: 32, height: 30, borderRadius: 8, border: 'none', background: 'none',
            cursor: 'pointer', color: '#78716C', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="5" width="16" height="16" rx="2.5" /><path d="M8 3v4M16 3v4M4 10h16" />
          </svg>
        </button>
        {/* The browser's own calendar: invisible, opened by the button above. */}
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden
          value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''}
          max={noFuture ? todayIso() : undefined}
          onChange={e => {
            setDraft(null);
            setError('');
            onValidity?.(true);
            onChange(e.target.value);
          }}
          style={{ position: 'absolute', right: 0, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none', border: 0, padding: 0 }}
        />
      </div>
      <div id={`${id}-hint`} style={{ fontSize: 10.5, marginTop: 4, color: error ? '#DC2626' : '#A8A29E' }}>
        {error || DATE_FORMAT_HINT.replace('Use', 'Or type')}
      </div>
    </div>
  );
}
