import React, { useEffect, useRef, useState } from 'react';
import { useTreeStore } from '../store/useTreeStore';
import { palette } from '../utils/palette';
import { lifeDates, lifeSpanLong, ageLabel, fmtDate, shortDate } from '../utils/dates';
import { initials, fullName, parentsOf, siblingsOf, unionsOf, kinSentence, kinPath } from '../utils/kinship';
import { renderMarkdown } from '../utils/markdown';
import { readSquarePhoto } from '../utils/image';
import { useSignedUrl } from '../hooks/useSignedUrl';
import type { Person, Union, Archive, MediaItem, ViewerRecord } from '../types';

type Data = { persons: Person[]; unions: Union[] };

export function ProfilePanel() {
  const store = useTreeStore();
  const { panel, panelTab, panelMode, persons, unions } = store;
  const isMobile = store.winW < 640;

  if (!panel) return null;

  const person = persons.find(p => p.id === panel);
  if (!person) return null;

  const data: Data = { persons, unions };
  const isDrawer = panelMode === 'drawer';

  // Panel positioning
  // Phones get the whole screen: a floating box there only wasted space.
  const panelStyle: React.CSSProperties = isMobile
    ? { position: 'absolute', inset: 0, borderRadius: 0 }
    : isDrawer
    ? { position: 'absolute', top: 0, bottom: 0, right: 0, left: 'auto', width: 540, borderRadius: '20px 0 0 20px' }
    : { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(880px, 96vw)', maxHeight: '90dvh', borderRadius: 20 };

  const tabs = [
    { key: 'family' as const, label: isMobile ? 'Family' : 'Direct Family Line', count: null },
    { key: 'bio' as const, label: isMobile ? 'Bio & Media' : 'Biography & Media', count: person.media.length + (person.bio ? 1 : 0) },
    { key: 'archives' as const, label: isMobile ? 'Archives' : 'Historical Archives', count: person.archives.length },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70 }}>
      {/* Backdrop */}
      <div
        onClick={store.closePanel}
        style={{ position: 'absolute', inset: 0, background: 'rgba(41,37,36,.28)', backdropFilter: 'blur(3px)' }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Ancestry record"
        style={{
          ...panelStyle,
          background: '#FFFDFB',
          boxShadow: '0 30px 80px rgba(28,25,23,.28)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderBottom: '1px solid #EFE9E2' }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.14em', color: '#A8A29E' }}>ANCESTRY RECORD</span>
          {!isMobile && (
            <button type="button" onClick={store.togglePanelMode} aria-label="Switch presentation" style={iconBtn}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                <path d="M4 9V4h5M20 15v5h-5M4 15v5h5M20 9V4h-5" />
              </svg>
            </button>
          )}
          <button type="button" onClick={store.closePanel} aria-label="Close" style={isMobile ? { ...iconBtn, width: 38, height: 38 } : iconBtn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {/* Hero */}
          <HeroSection person={person} data={data} />

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 4, padding: isMobile ? '0 8px' : '0 20px', borderBottom: '1px solid #EFE9E2',
            position: 'sticky', top: 0, background: '#FFFDFB', zIndex: 2, overflowX: 'auto',
          }}>
            {tabs.map(tb => (
              <button
                key={tb.key}
                type="button"
                onClick={() => store.setPanelTab(tb.key)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: isMobile ? '13px 6px' : '13px 12px', flex: isMobile ? 1 : undefined, fontFamily: 'inherit',
                  border: 'none', borderBottom: `2px solid ${panelTab === tb.key ? '#C2410C' : 'transparent'}`,
                  background: 'none', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 700,
                  color: panelTab === tb.key ? '#C2410C' : '#78716C',
                  whiteSpace: 'nowrap',
                }}
              >
                {tb.label}
                {tb.count !== null && tb.count > 0 && (
                  <span style={{
                    padding: '2px 7px', borderRadius: 99,
                    background: panelTab === tb.key ? '#FEF6F1' : '#F5F1EC',
                    fontSize: 10.5, fontWeight: 800,
                    color: panelTab === tb.key ? '#C2410C' : '#78716C',
                  }}>
                    {tb.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {panelTab === 'archives' && <ArchivesTab person={person} />}
          {panelTab === 'family' && <FamilyTab person={person} data={data} />}
          {panelTab === 'bio' && <BioTab person={person} />}
        </div>
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  marginLeft: 'auto', width: 32, height: 32, borderRadius: 9,
  border: '1px solid #E7E2DC', background: '#fff', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#57534E',
};

function HeroSection({ person }: { person: Person; data: Data }) {
  const isAdmin = useTreeStore(s => s.isAdmin());
  const openEdit = useTreeStore(s => s.openEdit);
  const openArchiveForm = useTreeStore(s => s.openArchiveForm);
  const setPhoto = useTreeStore(s => s.setPhoto);
  const setNotice = useTreeStore(s => s.setNotice);
  const openPhotoView = useTreeStore(s => s.openPhotoView);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoSrc = useSignedUrl(person.photoUrl);
  const c = palette(person.gender);
  const hasPhoto = !!person.photoUrl;

  // Keyed on the person, so switching profiles never leaves the menu open.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const menuOpen = menuFor === person.id;
  const closeMenu = () => { setMenuFor(null); setConfirmRemove(false); };

  // Esc closes just this menu, not the whole panel behind it.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      setMenuFor(null);
      setConfirmRemove(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [menuOpen]);

  const onAvatar = () => {
    // With no photo there is nothing to view, so admins go straight to picking one.
    if (hasPhoto) { setConfirmRemove(false); setMenuFor(menuOpen ? null : person.id); }
    else if (isAdmin) fileRef.current?.click();
  };
  const avatarLabel = hasPhoto
    ? `Photo options for ${fullName(person)}`
    : isAdmin ? `Add a photo of ${fullName(person)}` : undefined;

  const pickPhoto = async (file?: File) => {
    if (!file) return;
    try {
      setPhoto(person.id, await readSquarePhoto(file));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not read that image.');
    }
  };
  const heroBg = person.gender === 'Male' ? '#EFF9FF' : person.gender === 'Female' ? '#FDF1F8' : '#F9F9F8';

  return (
    <div style={{ padding: '22px 24px 20px', background: heroBg, borderBottom: '1px solid rgba(28,25,23,.07)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
        {/* Avatar — tapping a photo offers view / replace / remove */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          className={isAdmin ? 'avatar-editable' : undefined}
          onClick={onAvatar}
          disabled={!hasPhoto && !isAdmin}
          aria-label={avatarLabel}
          aria-haspopup={hasPhoto ? 'menu' : undefined}
          aria-expanded={hasPhoto ? menuOpen : undefined}
          style={{
            width: 82, height: 82, borderRadius: '50%', padding: 0, border: 'none',
            background: photoSrc ? 'transparent' : c.avFill,
            boxShadow: '0 0 0 4px #fff, 0 3px 10px rgba(28,25,23,.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
            overflow: 'hidden', cursor: hasPhoto || isAdmin ? 'pointer' : 'default', fontFamily: 'inherit',
          }}
        >
          {photoSrc
            ? <img src={photoSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            : <span style={{ fontSize: 26, fontWeight: 800, color: c.avText }}>{initials(person)}</span>
          }
          {isAdmin && (
            <span className="avatar-camera" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.2" />
              </svg>
            </span>
          )}
          <span style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 26, height: 26, borderRadius: '50%',
            background: '#fff', border: `1.5px solid ${c.border}`,
            color: c.accent, fontSize: 14, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {c.glyph}
          </span>
        </button>

        {menuOpen && (
          <>
            {/* Transparent catcher: any click outside the menu dismisses it. */}
            <div onClick={closeMenu} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
            <div role="menu" style={{
              position: 'absolute', top: 90, left: 0, zIndex: 31, width: 190,
              background: '#fff', border: '1px solid #E7E2DC', borderRadius: 13,
              boxShadow: '0 18px 44px rgba(28,25,23,.18)', padding: 6,
            }}>
              <MenuItem
                label="View photo"
                icon={<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>}
                onClick={() => { closeMenu(); openPhotoView(person.photoUrl!, fullName(person)); }}
              />
              {isAdmin && (
                <>
                  <MenuItem
                    label="Replace photo"
                    icon={<><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></>}
                    onClick={() => { closeMenu(); fileRef.current?.click(); }}
                  />
                  <MenuItem
                    label={confirmRemove ? 'Tap again to remove' : 'Remove photo'}
                    danger
                    icon={<path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13" />}
                    // Two-step: removing deletes the stored file for good.
                    onClick={() => {
                      if (confirmRemove) { closeMenu(); setPhoto(person.id, null); }
                      else setConfirmRemove(true);
                    }}
                  />
                </>
              )}
            </div>
          </>
        )}
        </div>
        {isAdmin && (
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={e => { void pickPhoto(e.target.files?.[0]); e.target.value = ''; }}
          />
        )}

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7 }}>
            <span style={{ padding: '4px 11px', borderRadius: 99, background: c.pillBg, color: c.pillColor, fontSize: 11, fontWeight: 700 }}>
              {person.label}
            </span>
            {person.dod && (
              <span style={{ padding: '4px 10px', borderRadius: 99, background: '#F0EDE9', color: '#78716C', fontSize: 10.5, fontWeight: 700 }}>Deceased</span>
            )}
            <span style={{ padding: '4px 10px', borderRadius: 99, border: '1px solid rgba(28,25,23,.18)', color: '#57534E', fontSize: 10.5, fontWeight: 700 }}>
              {ageLabel(person.dob, person.dod)}
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.022em', marginTop: 8, lineHeight: 1.15 }}>
            {fullName(person)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: '#57534E' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <rect x="4" y="5" width="16" height="16" rx="2.5" /><path d="M8 3v4M16 3v4M4 10h16" />
              </svg>
              {lifeSpanLong(person.dob, person.dod)}
            </span>
            {person.pob && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: '#57534E' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" /><circle cx="12" cy="10" r="2.4" />
                </svg>
                {person.pob}
              </span>
            )}
          </div>
        </div>
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 16 }}>
          <button type="button" onClick={() => openEdit(person.id)} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px',
            borderRadius: 10, border: '1px solid rgba(28,25,23,.18)',
            background: 'rgba(255,255,255,.7)', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#292524',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
              <path d="M4 20h4L20 8l-4-4L4 16z" />
            </svg>
            Edit Details
          </button>
          <button type="button" onClick={() => openArchiveForm(person.id)} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px',
            borderRadius: 10, border: 'none', background: '#C2410C',
            cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#fff',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
              <path d="M12 16V4M8 8l4-4 4 4M4 16v4h16v-4" />
            </svg>
            Upload Archives
          </button>
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, icon, onClick, danger }: {
  label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean;
}) {
  return (
    <button type="button" role="menuitem" onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '9px 10px', borderRadius: 9, border: 'none', background: 'none',
      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
      fontSize: 13, fontWeight: 600, color: danger ? '#B91C1C' : '#292524',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
      {label}
    </button>
  );
}

function ArchivesTab({ person }: { person: Person }) {
  const admin = useTreeStore(s => s.isAdmin());
  const openArchiveForm = useTreeStore(s => s.openArchiveForm);
  const openViewer = useTreeStore(s => s.openViewer);

  return (
    <div style={{ padding: '20px 24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 15 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.012em' }}>Historical Records & Vintage Scans</div>
          <div style={{ fontSize: 12, color: '#8A817A', marginTop: 2 }}>Deeds, certificates, letters and portraits attached to this person.</div>
        </div>
        {admin && (
          <button type="button" onClick={() => openArchiveForm(person.id)} style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 13px', borderRadius: 9, border: '1px solid #FCD34D',
            background: '#FEF3C7', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#92400E',
          }}>
            + Add Record
          </button>
        )}
      </div>

      {person.archives.length === 0 && (
        <div style={{ padding: '32px 0', textAlign: 'center', color: '#A8A29E', fontSize: 13, fontWeight: 600 }}>
          No records archived yet.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 14 }}>
        {person.archives.map(a => (
          <ArchiveCard key={a.id} a={a} personId={person.id} admin={admin} onView={openViewer} />
        ))}
      </div>
    </div>
  );
}

function FamilyTab({ person, data }: { person: Person; data: { persons: Person[]; unions: any[] } }) {
  const admin = useTreeStore(s => s.isAdmin());
  const kinTarget = useTreeStore(s => s.kinTarget);
  const openPanel = useTreeStore(s => s.openPanel);
  const openAdd = useTreeStore(s => s.openAdd);
  const setKinTarget = useTreeStore(s => s.setKinTarget);
  const persons = useTreeStore(s => s.persons);
  const unlinkSpouse = useTreeStore(s => s.unlinkSpouse);
  // Which spouse row has its Unlink armed; the second click confirms.
  const [armed, setArmed] = useState<string | null>(null);

  const parents = parentsOf(data, person.id);
  const father = parents.map(id => persons.find(p => p.id === id)).find(p => p?.gender === 'Male');
  const mother = parents.map(id => persons.find(p => p.id === id)).find(p => p?.gender === 'Female');
  const spouses = unionsOf(data, person.id).map(u => {
    const otherId = u.a === person.id ? u.b : u.a;
    return otherId ? persons.find(p => p.id === otherId) : null;
  }).filter(Boolean) as Person[];
  const unionMap = Object.fromEntries(
    unionsOf(data, person.id).map(u => {
      const otherId = u.a === person.id ? u.b : u.a;
      return [otherId || '', u];
    })
  );
  const siblings = siblingsOf(data, person.id).map(id => persons.find(p => p.id === id)).filter(Boolean) as Person[];
  const children = unionsOf(data, person.id).flatMap(u => u.children).map(id => persons.find(p => p.id === id)).filter(Boolean) as Person[];

  const others = persons.filter(p => p.id !== person.id);
  const kt = kinTarget && persons.find(p => p.id === kinTarget);
  const kinAnswer = kt
    ? (kinSentence(data, person.id, kinTarget) || 'No direct relationship found.')
    : '';
  const path = kt ? kinPath(data, person.id, kinTarget) : [];

  return (
    <div style={{ padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Parents */}
      <SectionHeader
        label="PARENTS"
        actionLabel={admin && !(father && mother) ? '+ Add Parent' : undefined}
        onAction={() => openAdd(person.id, father ? 'Mother' : 'Father')}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: -14 }}>
        {father
          ? <MiniCard person={father} onClick={() => openPanel(father.id)} />
          : person.originFather
            ? <OriginCard name={person.originFather} dates={person.originFatherDates} gender="Male" />
            : <EmptyCard label="Father not documented" />}
        {mother
          ? <MiniCard person={mother} onClick={() => openPanel(mother.id)} />
          : person.originMother
            ? <OriginCard name={person.originMother} dates={person.originMotherDates} gender="Female" />
            : <EmptyCard label="Mother not documented" />}
      </div>

      {/* Spouse */}
      <div>
        <SectionHeader label="SPOUSE / PARTNER" actionLabel={admin ? '+ Add Spouse' : undefined} onAction={() => openAdd(person.id, 'Wife')} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 10 }}>
          {spouses.length === 0 && <EmptyCard label="No spouse recorded" />}
          {spouses.map(sp => {
            const u = unionMap[sp.id];
            const c = palette(sp.gender);
            return (
              <div key={sp.id} onClick={() => openPanel(sp.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                borderRadius: 12, border: `1px solid ${c.border}`, background: c.fill, cursor: 'pointer',
              }}>
                <span style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: c.avFill, color: c.avText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>
                  {initials(sp)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>{fullName(sp)}</span>
                  <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: c.accent }}>{lifeDates(sp.dob, sp.dod)}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: '#78716C', marginTop: 1 }}>
                    {u?.date ? `Married ${shortDate(u.date)}` : 'Marriage date not recorded'}
                  </span>
                </span>
                {admin && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      if (armed === sp.id) {
                        setArmed(null);
                        void unlinkSpouse(person.id, sp.id);
                      } else {
                        setArmed(sp.id);
                      }
                    }}
                    onBlur={() => setArmed(a => (a === sp.id ? null : a))}
                    style={{
                      flexShrink: 0, padding: '5px 10px', borderRadius: 8,
                      border: armed === sp.id ? '1px solid #B91C1C' : '1px solid rgba(28,25,23,.14)',
                      background: armed === sp.id ? '#B91C1C' : 'rgba(255,255,255,.7)',
                      color: armed === sp.id ? '#fff' : '#78716C',
                      cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
                    }}
                  >{armed === sp.id ? 'Unlink?' : 'Unlink'}</button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Siblings — addable even when the parents aren't recorded */}
      <div>
        <SectionHeader label={`SIBLINGS (${siblings.length})`} actionLabel={admin ? '+ Add Sibling' : undefined} onAction={() => openAdd(person.id, 'Brother')} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 9, marginTop: 10 }}>
          {siblings.length === 0 && <EmptyCard label="No siblings recorded" />}
          {siblings.map(s => <MiniCard key={s.id} person={s} onClick={() => openPanel(s.id)} />)}
        </div>
      </div>

      {/* Children */}
      <div>
        <SectionHeader label={`CHILDREN (${children.length})`} actionLabel={admin ? '+ Add Child' : undefined} onAction={() => openAdd(person.id, 'Son')} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 9, marginTop: 10 }}>
          {children.map(ch => <MiniCard key={ch.id} person={ch} onClick={() => openPanel(ch.id)} />)}
        </div>
      </div>

      {/* Kinship explainer */}
      <div style={{ border: '1px solid #FCD34D', background: '#FFFBEB', borderRadius: 16, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: '-0.012em' }}>Kinship Relationship Explainer</span>
          <span style={{ padding: '3px 9px', borderRadius: 99, background: '#FDE68A', color: '#92400E', fontSize: 10, fontWeight: 800, letterSpacing: '.04em' }}>Lineage Checker</span>
        </div>
        <select value={kinTarget} onChange={e => setKinTarget(e.target.value)} style={{
          width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid #FCD34D',
          background: '#fff', fontSize: 12.5, fontWeight: 600, color: '#44403C',
        }}>
          {others.map(o => (
            <option key={o.id} value={o.id}>{fullName(o)}</option>
          ))}
        </select>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#78350F', marginTop: 12, lineHeight: 1.5 }}>{kinAnswer}</div>
        {path.length > 1 && (
          <div style={{
            fontSize: 11.5, color: '#92400E', marginTop: 6,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}>
            {path.join('  →  ')}
          </div>
        )}
      </div>

      <Milestones person={person} data={data} />
    </div>
  );
}

/** The person's life in date order: births, marriages, children, education, records. */
function Milestones({ person, data }: { person: Person; data: { persons: Person[]; unions: any[] } }) {
  const items: Array<{ date: string; dot: string; title: string; sub: string }> = [];
  if (person.dob) items.push({ date: person.dob, dot: '#C2410C', title: 'Born', sub: fmtDate(person.dob) + (person.pob ? ` · ${person.pob}` : '') });
  unionsOf(data, person.id).forEach(u => {
    const sp = u.a === person.id ? data.persons.find(p => p.id === u.b) : data.persons.find(p => p.id === u.a);
    if (u.date) items.push({ date: u.date, dot: '#DB2777', title: `Married ${sp ? fullName(sp) : ''}`, sub: fmtDate(u.date) + (u.place ? ` · ${u.place}` : '') });
    u.children.forEach((cid: string) => {
      const ch = data.persons.find(p => p.id === cid);
      if (ch?.dob) items.push({ date: ch.dob, dot: '#38BDF8', title: `Birth of ${fullName(ch)}`, sub: fmtDate(ch.dob) + (ch.pob ? ` · ${ch.pob}` : '') });
    });
  });
  person.archives.forEach(a => {
    if (a.year) items.push({ date: a.year, dot: '#F59E0B', title: a.title, sub: a.category + (a.origin ? ` · ${a.origin}` : '') });
  });
  person.education.forEach(e => {
    if (e.year) items.push({ date: e.year, dot: '#16A34A', title: `Completed ${[e.level, e.branch].filter(Boolean).join(', ') || 'education'}`, sub: e.institution });
  });
  if (person.dod) items.push({ date: person.dod, dot: '#1C1917', title: 'Passed away', sub: fmtDate(person.dod) + (person.pod ? ` · ${person.pod}` : '') });
  items.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.13em', color: '#A8A29E', marginBottom: 14 }}>LIFE MILESTONES CHRONOLOGY</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 14 }}>
            <div style={{ flexShrink: 0, width: 46, textAlign: 'right', fontSize: 11.5, fontWeight: 800, color: '#A8A29E', paddingTop: 1 }}>
              {e.date.slice(0, 4)}
            </div>
            <div style={{ flexShrink: 0, width: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: e.dot, boxShadow: '0 0 0 3px #FFFDFB', marginTop: 4 }} />
              {i < items.length - 1 && <span style={{ flex: 1, width: 2, background: '#EFE9E2' }} />}
            </div>
            <div style={{ flex: 1, paddingBottom: 16, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>{e.title}</div>
              <div style={{ fontSize: 11.5, color: '#8A817A', marginTop: 2 }}>{e.sub}</div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{ color: '#A8A29E', fontSize: 13, fontStyle: 'italic', paddingLeft: 60 }}>No milestones recorded yet.</div>
        )}
      </div>
    </div>
  );
}

function BioTab({ person }: { person: Person }) {
  const admin = useTreeStore(s => s.isAdmin());
  const openEdit = useTreeStore(s => s.openEdit);
  const openViewer = useTreeStore(s => s.openViewer);
  const panelMode = useTreeStore(s => s.panelMode);
  const addMediaPhotos = useTreeStore(s => s.addMediaPhotos);
  const mediaUpload = useTreeStore(s => s.mediaUpload);
  const mediaRef = useRef<HTMLInputElement>(null);
  const winW = useTreeStore(s => s.winW);
  const tileCols = panelMode === 'modal' && winW >= 640 ? 4 : 2;

  const infoTiles = [
    { label: 'OCCUPATION / CAREER', value: person.occupation || '—' },
    { label: 'PRIMARY HERITAGE RESIDENCY', value: person.residency || '—' },
    { label: 'BIRTH DATE & PLACE', value: person.dob ? `${fmtDate(person.dob)}${person.pob ? ` · ${person.pob}` : ''}` : '—' },
    { label: 'PASSING DATE & PLACE', value: person.dod ? `${fmtDate(person.dod)}${person.pod ? ` · ${person.pod}` : ''}` : person.dob ? 'Living' : '—' },
    { label: 'GOTRA', value: person.gotra || 'Not documented' },
    { label: 'SHASAN', value: person.shasan || 'Not documented' },
  ];

  return (
    <div style={{ padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Biography */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.13em', color: '#A8A29E' }}>LIFE STORY & HERITAGE BIOGRAPHY</span>
          {admin && (
            <button type="button" onClick={() => openEdit(person.id)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 11.5, fontWeight: 800, color: '#C2410C' }}>
              Edit Biography
            </button>
          )}
        </div>
        <div style={{ border: '1px solid #E7E2DC', borderRadius: 14, background: '#fff', padding: '16px 18px', fontSize: 13.5, lineHeight: 1.65, color: '#292524' }}>
          {person.bio
            ? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(person.bio) }} />
            : <span style={{ color: '#A8A29E', fontStyle: 'italic' }}>No biography recorded yet.</span>
          }
        </div>
      </div>

      {/* Media gallery */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.13em', color: '#A8A29E' }}>LIFE MEDIA GALLERY ({person.media.length})</span>
          {admin && (
            <>
              <input
                ref={mediaRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={e => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = '';
                  void addMediaPhotos(person.id, files);
                }}
              />
              {/* This used to call openEdit() — "Manage Media" opened the person form. */}
              <button
                type="button"
                disabled={!!mediaUpload}
                onClick={() => mediaRef.current?.click()}
                style={{ border: 'none', background: 'none', padding: 0, cursor: mediaUpload ? 'default' : 'pointer', fontSize: 11.5, fontWeight: 800, color: mediaUpload ? '#A8A29E' : '#C2410C', fontFamily: 'inherit' }}
              >
                {mediaUpload ? `Uploading ${mediaUpload.done + 1} of ${mediaUpload.total}…` : '+ Add Photos'}
              </button>
            </>
          )}
        </div>
        {person.media.length === 0 ? (
          <div style={{ border: '2px dashed #E2DBD2', borderRadius: 14, padding: 26, textAlign: 'center', background: '#FAF8F5' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#8A817A' }}>No media uploaded yet</div>
            {admin && (
              <div style={{ fontSize: 11.5, color: '#A8A29E', marginTop: 4 }}>
                Photos are resized before upload, so you can add plenty.
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 11 }}>
            {person.media.map(m => (
              <MediaTile key={m.id} m={m} personId={person.id} admin={admin} onView={openViewer} />
            ))}
          </div>
        )}
      </div>

      {/* Info tiles — the wider modal fits four across, the drawer only two */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tileCols},minmax(0,1fr))`, gap: 11 }}>
        {infoTiles.map(t => (
          <div key={t.label} style={{ border: '1px solid #E7E2DC', borderRadius: 13, background: '#fff', padding: '13px 14px' }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.11em', color: '#A8A29E' }}>{t.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#292524', marginTop: 6, lineHeight: 1.4 }}>{t.value}</div>
          </div>
        ))}
      </div>

      {/* Education */}
      {person.education.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.13em', color: '#A8A29E', marginBottom: 10 }}>EDUCATION</div>
          <div style={{ border: '1px solid #E7E2DC', borderRadius: 13, background: '#fff', overflow: 'hidden' }}>
            {person.education.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '11px 14px', borderTop: i ? '1px solid #F3EFEA' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#292524' }}>
                    {[e.level, e.branch].filter(Boolean).join(' · ') || '—'}
                  </div>
                  {e.institution && <div style={{ fontSize: 12, color: '#78716C', marginTop: 2 }}>{e.institution}</div>}
                </div>
                {e.year && <div style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color: '#A8A29E' }}>{e.year}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function SectionHeader({ label, actionLabel, onAction }: { label: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.13em', color: '#A8A29E' }}>{label}</span>
      {actionLabel && (
        <button type="button" onClick={onAction} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 11.5, fontWeight: 800, color: '#C2410C' }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function ArchiveCard({
  a, personId, admin, onView,
}: {
  a: Archive;
  personId: string;
  admin: boolean;
  onView: (r: ViewerRecord) => void;
}) {
  const deleteArchive = useTreeStore(s => s.deleteArchive);
  const openArchiveForm = useTreeStore(s => s.openArchiveForm);
  const [confirming, setConfirming] = useState(false);
  const thumb = useSignedUrl(a.filePath);
  const isPdf = /\.pdf$/i.test(a.fileName ?? '');

  return (
    <div style={{ border: '1px solid #E7E2DC', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
      <div style={{
        height: 118, position: 'relative',
        backgroundColor: '#F7F3ED',
        backgroundImage: thumb && !isPdf ? undefined : 'repeating-linear-gradient(135deg,#EFE9E2 0 7px,#F8F5F0 7px 14px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {thumb && !isPdf ? (
          <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10, color: '#A8A29E', letterSpacing: '.04em' }}>
            {a.filePath ? (isPdf ? 'PDF' : 'document scan') : 'no file attached'}
          </span>
        )}
        {a.year && (
          <span style={{
            position: 'absolute', top: 9, left: 9,
            padding: '3px 8px', borderRadius: 6,
            background: '#1C1917', color: '#fff', fontSize: 10.5, fontWeight: 800,
          }}>
            {a.year}
          </span>
        )}
        {admin && !confirming && (
          <button
            type="button"
            aria-label={`Edit ${a.title}`}
            onClick={() => openArchiveForm(personId, a.id)}
            style={{
              position: 'absolute', top: 8, right: 40,
              width: 26, height: 26, borderRadius: 8, padding: 0,
              border: '1px solid #E7E2DC', background: 'rgba(255,255,255,.92)', color: '#44403C',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" />
            </svg>
          </button>
        )}
        {admin && (
          <button
            type="button"
            aria-label={`Delete ${a.title}`}
            onClick={() => {
              // Two-step rather than a modal: deleting removes the stored file
              // and cannot be undone, but a whole dialog per card is heavy.
              if (confirming) void deleteArchive(personId, a.id);
              else setConfirming(true);
            }}
            onBlur={() => setConfirming(false)}
            style={{
              position: 'absolute', top: 8, right: 8,
              padding: confirming ? '4px 9px' : 0,
              width: confirming ? 'auto' : 26, height: 26, borderRadius: 8,
              border: '1px solid #E7E2DC',
              background: confirming ? '#B91C1C' : 'rgba(255,255,255,.92)',
              color: confirming ? '#fff' : '#B91C1C',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            {confirming ? 'Delete?' : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13" />
              </svg>
            )}
          </button>
        )}
      </div>
      <div style={{ padding: '12px 13px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.3 }}>{a.title}</div>
        <div style={{
          fontSize: 11.5, color: '#78716C', lineHeight: 1.45, marginTop: 5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {a.desc}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 11, paddingTop: 10, borderTop: '1px solid #F3EFEA' }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#A8A29E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {a.category}
          </span>
          <button type="button" onClick={() => onView({ title: a.title, sub: `${a.category} · ${a.origin}`, kind: 'document scan', url: a.filePath, fileName: a.fileName })}
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 11.5, fontWeight: 800, color: '#C2410C', whiteSpace: 'nowrap' }}>
            View &gt;
          </button>
        </div>
      </div>
    </div>
  );
}

function MediaTile({
  m, personId, admin, onView,
}: {
  m: MediaItem;
  personId: string;
  admin: boolean;
  onView: (r: ViewerRecord) => void;
}) {
  const deleteMedia = useTreeStore(s => s.deleteMedia);
  const [confirming, setConfirming] = useState(false);
  const thumb = useSignedUrl(m.type === 'Photo' ? m.url : undefined);

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => onView({ title: m.title, sub: `${m.type} · ${m.size}`, kind: m.type, url: m.url, fileName: `${m.title}.jpg` })} style={{
        position: 'relative', display: 'block', width: '100%', height: 126, borderRadius: 12, overflow: 'hidden',
        border: '1px solid #E7E2DC', cursor: 'pointer', padding: 0,
        backgroundColor: '#F7F3ED',
        backgroundImage: thumb ? `url(${thumb})` : 'repeating-linear-gradient(135deg,#EFE9E2 0 7px,#F8F5F0 7px 14px)',
        backgroundSize: thumb ? 'cover' : undefined, backgroundPosition: 'center',
      }}>
        <span style={{ position: 'absolute', top: 8, left: 8, padding: '3px 8px', borderRadius: 99, background: 'rgba(255,255,255,.92)', fontSize: 9.5, fontWeight: 800, color: '#57534E' }}>
          {m.type}
        </span>
        {m.type === 'Video Clip' && (
          <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 36, height: 36, borderRadius: '50%', background: '#C2410C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff"><path d="M8 5l12 7-12 7z" /></svg>
          </span>
        )}
        <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '16px 9px 8px', background: 'linear-gradient(transparent,rgba(28,25,23,.78))', textAlign: 'left' }}>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
          <span style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.82)' }}>{m.size}</span>
        </span>
      </button>
      {admin && (
        <button
          type="button"
          aria-label={`Delete ${m.title}`}
          onClick={() => { if (confirming) void deleteMedia(personId, m.id); else setConfirming(true); }}
          onBlur={() => setConfirming(false)}
          style={{
            position: 'absolute', top: 7, right: 7,
            padding: confirming ? '4px 8px' : 0,
            width: confirming ? 'auto' : 24, height: 24, borderRadius: 7,
            border: '1px solid #E7E2DC',
            background: confirming ? '#B91C1C' : 'rgba(255,255,255,.92)',
            color: confirming ? '#fff' : '#B91C1C',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10.5, fontWeight: 800, fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
        >
          {confirming ? 'Delete?' : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

function MiniCard({ person, onClick }: { person: Person; onClick: () => void }) {
  const c = palette(person.gender);
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: 10,
      borderRadius: 12, border: `1px solid ${c.border}`, background: c.fill, cursor: 'pointer', textAlign: 'left',
    }}>
      <span style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: c.avFill, color: c.avText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
        {initials(person)}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName(person)}</span>
        <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: c.accent }}>{lifeDates(person.dob, person.dod)}</span>
      </span>
    </button>
  );
}

/**
 * A parent recorded only as origin-family text. Married-in people's parents
 * aren't drawn in the tree, so there's nothing to navigate to — hence no click.
 */
function OriginCard({ name, dates, gender }: { name: string; dates: string; gender: 'Male' | 'Female' }) {
  const c = palette(gender);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: 10,
      borderRadius: 12, border: `1px solid ${c.border}`, background: c.fill,
    }}>
      <span style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        background: c.avFill, color: c.avText,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 800,
      }}>
        {name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
        {dates && <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: c.accent }}>{dates}</span>}
        <span style={{ display: 'block', fontSize: 10.5, color: '#78716C', marginTop: 1 }}>
          Origin family · not in tree
        </span>
      </span>
    </div>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, border: '1.5px dashed #D6CFC7', color: '#A8A29E', fontSize: 12, fontWeight: 600 }}>
      {label}
    </div>
  );
}
