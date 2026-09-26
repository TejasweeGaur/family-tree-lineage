import { useEffect, useRef } from 'react';
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

  const ref = useRef<HTMLDivElement>(null);

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
  const hasParentUnion = unions.some(u => u.children.includes(plusMenu));
  const noParent = hasParentUnion ? undefined : 'Add a parent first';

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
        { label: 'Brother', disabled: noParent },
        { label: 'Sister', disabled: noParent },
      ],
    },
  ];

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left: plusPos.x, top: plusPos.y,
        width: 210, background: '#fff',
        border: '1px solid #E7E2DC', borderRadius: 14,
        boxShadow: '0 20px 48px rgba(28,25,23,.18)',
        padding: 7, zIndex: 200,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: '#A8A29E', padding: '6px 10px 4px' }}>
        ADD RELATIVE TO {person.first.toUpperCase()} {person.last.toUpperCase()}
      </div>
      {groups.map(g => (
        <div key={g.title}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em', color: '#C6BFB7', padding: '7px 10px 3px' }}>
            {g.title}
          </div>
          {g.items.map(it => (
            <button
              key={it.label}
              type="button"
              disabled={!!it.disabled}
              title={it.disabled ?? ''}
              onClick={() => { openAdd(plusMenu, it.label); setPlusMenu(null); }}
              style={{
                display: 'flex', width: '100%', alignItems: 'center', gap: 9,
                padding: '8px 10px', borderRadius: 9, border: 'none',
                background: 'none', cursor: it.disabled ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 600, textAlign: 'left', fontFamily: 'inherit',
                color: it.disabled ? '#C6BFB7' : '#292524',
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
