import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTreeStore } from '../store/useTreeStore';
import { parentsOf } from '../utils/kinship';
import type { RelativeKind } from '../types';

interface Item {
  label: RelativeKind;
  disabled?: string;
}

interface Group {
  title: string;
  items: Item[];
}

export function PlusMenu() {
  const plusMenu = useTreeStore(s => s.plusMenu);
  const plusPos = useTreeStore(s => s.plusPos);
  const persons = useTreeStore(s => s.persons);
  const unions = useTreeStore(s => s.unions);
  const isAdmin = useTreeStore(s => s.isAdmin());
  const setPlusMenu = useTreeStore(s => s.setPlusMenu);
  const openAdd = useTreeStore(s => s.openAdd);
  const isMobile = useTreeStore(s => s.winW < 640);

  const ref = useRef<HTMLDivElement>(null);
  // Where the menu actually goes: below the + if it fits, otherwise above it,
  // and never past the screen's edges.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!plusMenu || isMobile || !el) { setPos(null); return; }
    const { width, height } = el.getBoundingClientRect();
    const left = Math.min(Math.max(8, plusPos.x), window.innerWidth - width - 8);
    const below = plusPos.y;
    const above = plusPos.y - height - 44;
    const top = below + height <= window.innerHeight - 8 ? below : Math.max(8, above);
    setPos({ left, top });
  }, [plusMenu, plusPos, isMobile]);

  useEffect(() => {
    if (!plusMenu) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPlusMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [plusMenu, setPlusMenu]);

  if (!plusMenu || !isAdmin) return null;
  const person = persons.find(p => p.id === plusMenu);
  if (!person) return null;

  const data = { persons, unions };
  const parents = parentsOf(data, plusMenu);
  const hasFather = parents.some(id => persons.find(p => p.id === id)?.gender === 'Male');
  const hasMother = parents.some(id => persons.find(p => p.id === id)?.gender === 'Female');

  const groups: Group[] = [
    { title: 'SPOUSE', items: [{ label: 'Wife' }, { label: 'Husband' }] },
    { title: 'CHILDREN', items: [{ label: 'Son' }, { label: 'Daughter' }] },
    {
      title: 'PARENTS',
      items: [
        { label: 'Father', disabled: hasFather ? 'Father already recorded' : undefined },
        { label: 'Mother', disabled: hasMother ? 'Mother already recorded' : undefined },
      ],
    },
    {
      title: 'SIBLINGS',
      items: [
        // Allowed without recorded parents: they share an empty parent slot,
        // which adding a father or mother later fills in.
        { label: 'Brother' },
        { label: 'Sister' },
      ],
    },
  ];

  const sheet: React.CSSProperties = {
    position: 'fixed', left: 0, right: 0, bottom: 0,
    background: '#fff', borderRadius: '18px 18px 0 0',
    boxShadow: '0 -16px 40px rgba(28,25,23,.2)',
    padding: '8px 12px calc(14px + env(safe-area-inset-bottom, 0px))', zIndex: 200,
    maxHeight: '80dvh', overflowY: 'auto',
  };
  const popup: React.CSSProperties = {
    position: 'fixed', left: pos?.left ?? plusPos.x, top: pos?.top ?? plusPos.y,
    visibility: pos ? 'visible' : 'hidden',
    width: 210, background: '#fff',
    border: '1px solid #E7E2DC', borderRadius: 14,
    boxShadow: '0 20px 48px rgba(28,25,23,.18)',
    padding: 7, zIndex: 200,
  };

  const menu = (
    <div ref={ref} role="menu" style={isMobile ? sheet : popup}>
      {isMobile && <div style={{ width: 38, height: 4, borderRadius: 99, background: '#E7E2DC', margin: '2px auto 6px' }} />}
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: '#A8A29E', padding: '6px 10px 4px' }}>
        ADD RELATIVE TO {person.first.toUpperCase()} {person.last.toUpperCase()}
      </div>
      {groups.map(g => (
        <div key={g.title} style={isMobile ? { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 8 } : undefined}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em', color: '#C6BFB7', padding: '7px 10px 3px', gridColumn: '1 / -1' }}>
            {g.title}
          </div>
          {g.items.map(it => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={!!it.disabled}
              title={it.disabled ?? ''}
              onClick={() => { openAdd(plusMenu, it.label); setPlusMenu(null); }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%',
                padding: isMobile ? '12px 12px' : '8px 10px', borderRadius: 10,
                border: isMobile ? '1px solid #EFE9E2' : 'none', marginBottom: isMobile ? 8 : 0,
                background: isMobile && !it.disabled ? '#FAF8F5' : 'none', cursor: it.disabled ? 'not-allowed' : 'pointer',
                fontSize: isMobile ? 14 : 13, fontWeight: 600, textAlign: 'left', fontFamily: 'inherit',
                color: it.disabled ? '#C6BFB7' : '#292524',
              }}
            >
              {it.label}
              {/* A tooltip never shows on a touch screen, so say why here. */}
              {it.disabled && isMobile && <span style={{ fontSize: 11, fontWeight: 500, marginTop: 2 }}>{it.disabled}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );

  if (!isMobile) return menu;
  return (
    <>
      {/* Tapping outside the sheet closes it (the mousedown listener above). */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,.35)', zIndex: 199 }} />
      {menu}
    </>
  );
}
