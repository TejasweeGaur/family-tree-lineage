import React, { useRef } from 'react';
import { palette } from '../utils/palette';
import { lifeDates } from '../utils/dates';
import { initials, fullName } from '../utils/kinship';
import { useTreeStore } from '../store/useTreeStore';
import { useSignedUrl } from '../hooks/useSignedUrl';
import type { Person } from '../types';

interface Props {
  person: Person;
  x: number;
  y: number;
  isFocus: boolean;
  isDim: boolean;
  isVisible: boolean;
  spouseName: string;
  mdate: string;
  city: string;
  kinChip: string;
}

export function PersonCard({
  person, x, y, isFocus, isDim, isVisible, spouseName, mdate, city, kinChip,
}: Props) {
  const isAdmin = useTreeStore(s => s.isAdmin());
  const openPanel = useTreeStore(s => s.openPanel);
  const setPlusMenu = useTreeStore(s => s.setPlusMenu);
  const askDelete = useTreeStore(s => s.askDelete);

  const plusBtnRef = useRef<HTMLButtonElement>(null);
  const photoSrc = useSignedUrl(person.photoUrl);
  const c = palette(person.gender);
  const border = isFocus ? c.accent : c.border;
  const shadow = isFocus
    ? '0 0 0 6px rgba(194,65,12,.12), 0 14px 32px rgba(28,25,23,.14)'
    : '0 2px 10px rgba(28,25,23,.06)';

  const hasOrigin = !!(person.originFather || person.originMother);

  const handlePlus = (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = plusBtnRef.current?.getBoundingClientRect();
    if (r) setPlusMenu(person.id, { x: r.left - 60, y: r.bottom + 6 });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${fullName(person)}, ${person.label}, ${lifeDates(person.dob, person.dod)}`}
      onClick={e => { e.stopPropagation(); openPanel(person.id); }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(person.id); }
      }}
      style={{
        position: 'absolute', left: x, top: y,
        width: 280, height: 264, boxSizing: 'border-box',
        borderRadius: 12, padding: '11px 13px',
        background: c.fill,
        border: `${isFocus ? 3 : 2}px solid ${border}`,
        boxShadow: shadow,
        opacity: isVisible ? (isDim ? 0.4 : 1) : 0.08,
        display: 'flex', flexDirection: 'column',
        cursor: 'pointer',
        transition: 'opacity .18s, box-shadow .18s, border-color .18s',
        outline: 'none',
      }}
    >
      {kinChip && (
        <div style={{
          position: 'absolute', top: -11, right: 12,
          padding: '3px 9px', borderRadius: 99,
          background: '#1C1917', color: '#fff',
          fontSize: 10, fontWeight: 700, letterSpacing: '.02em', whiteSpace: 'nowrap',
        }}>
          {kinChip}
        </div>
      )}

      {/* Row 1 — relation pill, status, admin actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 22 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: border }} />
        <span style={{
          padding: '3px 9px', borderRadius: 99,
          background: c.pillBg, color: c.pillColor,
          fontSize: 10, fontWeight: 700, letterSpacing: '.03em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130,
        }}>
          {person.label}
        </span>
        {person.dod && (
          <span style={{ padding: '3px 8px', borderRadius: 99, background: '#F0EDE9', color: '#78716C', fontSize: 9.5, fontWeight: 700 }}>
            Deceased
          </span>
        )}
        {isAdmin && (
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 5, flexShrink: 0 }}>
            <button
              onClick={e => { e.stopPropagation(); askDelete(person.id); }}
              aria-label={`Delete ${fullName(person)}`}
              style={{
                width: 26, height: 26, borderRadius: 8,
                border: '1px solid #E7E2DC', background: '#fff', color: '#B91C1C',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13" />
              </svg>
            </button>
            <button
              ref={plusBtnRef}
              data-tour="card-plus"
              onClick={handlePlus}
              aria-label={`Add relative to ${fullName(person)}`}
              style={{
                width: 26, height: 26, borderRadius: 8,
                border: 'none', background: '#1C1917', color: '#fff',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </span>
        )}
      </div>

      {/* Row 2 — avatar and identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
        <div style={{
          width: 58, height: 58, borderRadius: '50%', flexShrink: 0,
          background: photoSrc ? `#fff url(${photoSrc}) center/cover` : c.avFill,
          boxShadow: '0 0 0 3px #fff, 0 1px 4px rgba(28,25,23,.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
        }}>
          {!photoSrc && (
            <span style={{ fontSize: 17, fontWeight: 800, color: c.avText, letterSpacing: '.02em' }}>
              {initials(person)}
            </span>
          )}
          <span title={c.genderName} style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 19, height: 19, borderRadius: '50%',
            background: '#fff', border: `1px solid ${border}`,
            color: c.accent, fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>
            {c.glyph}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: '-0.012em', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fullName(person)}
          </div>
          {person.maiden && (
            <div style={{ fontSize: 11.5, fontStyle: 'italic', color: '#6B635C', lineHeight: 1.35 }}>
              (née {person.maiden})
            </div>
          )}
          <div style={{ fontSize: 12, fontWeight: 700, color: c.accent, marginTop: 2 }}>
            {lifeDates(person.dob, person.dod)}
          </div>
          <div style={{ fontSize: 11, color: '#6B635C', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {person.occupation || '—'}
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(28,25,23,.08)', margin: '11px 0 9px' }} />

      {/* Row 3 — spouse and place */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {spouseName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#57534E' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#DB2777" stroke="none" style={{ flexShrink: 0 }}>
              <path d="M12 20.5S3.8 15.4 3.8 9.9A4.6 4.6 0 0 1 12 7.2a4.6 4.6 0 0 1 8.2 2.7c0 5.5-8.2 10.6-8.2 10.6z" />
            </svg>
            <span style={{ fontWeight: 700, letterSpacing: '.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              SPOUSE: {spouseName}
            </span>
            {mdate && <span style={{ color: '#78716C', whiteSpace: 'nowrap' }}>· {mdate}</span>}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6B635C' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ flexShrink: 0 }}>
            <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" />
            <circle cx="12" cy="10" r="2.4" />
          </svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{city || '—'}</span>
        </div>
      </div>

      {/* Origin family — married-in people whose parents aren't drawn in the tree */}
      {hasOrigin && (
        <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px solid rgba(28,25,23,.08)' }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.11em', color: '#78716C' }}>
            ORIGIN FAMILY
          </div>
          {person.originFather && (
            <div style={{ fontSize: 10.5, color: '#57534E', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {person.originFather}{person.originFatherDates && ` · ${person.originFatherDates}`}
            </div>
          )}
          {person.originMother && (
            <div style={{ fontSize: 10.5, color: '#57534E', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {person.originMother}{person.originMotherDates && ` · ${person.originMotherDates}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
