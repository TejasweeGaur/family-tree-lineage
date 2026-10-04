import { useMemo } from 'react';
import { useTreeStore } from '../store/useTreeStore';
import { eventsWithin, familyFacts, type DayEvent } from '../utils/onThisDay';

const KIND = {
  birthday: { label: 'Birthday', bg: '#FEF3C7', fg: '#92400E', icon: <><path d="M4 21h16M5 21v-7h14v7M12 14V9" /><path d="M12 6.5c-.8-1-.8-2 0-3 .8 1 .8 2 0 3z" /></> },
  anniversary: { label: 'Anniversary', bg: '#FCE7F3', fg: '#9D174D', icon: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /> },
  remembrance: { label: 'Remembrance', bg: '#F0EDE9', fg: '#57534E', icon: <><path d="M12 3v3M8 21h8M10 21V11a2 2 0 0 1 4 0v10" /><path d="M12 6c1.5 1 1.5 2.6 0 3.4C10.5 8.6 10.5 7 12 6z" /></> },
} as const;

function when(e: DayEvent): string {
  if (e.daysAway === 0) return 'Today';
  if (e.daysAway === 1) return 'Tomorrow';
  return `In ${e.daysAway} days · ${e.on.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

export function OnThisDayModal() {
  const open = useTreeStore(s => s.onThisDayOpen);
  const setOpen = useTreeStore(s => s.setOnThisDayOpen);
  const openPanel = useTreeStore(s => s.openPanel);
  const persons = useTreeStore(s => s.persons);
  const unions = useTreeStore(s => s.unions);

  const { today, upcoming, facts } = useMemo(() => {
    const all = eventsWithin({ persons, unions }, new Date(), 30);
    return {
      today: all.filter(e => e.daysAway === 0),
      upcoming: all.filter(e => e.daysAway > 0),
      facts: familyFacts({ persons, unions }),
    };
  }, [persons, unions]);

  if (!open) return null;
  const close = () => setOpen(false);
  const go = (id?: string) => { if (!id) return; close(); openPanel(id); };
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const Row = ({ e }: { e: DayEvent }) => {
    const k = KIND[e.kind];
    return (
      <button type="button" onClick={() => go(e.personIds[0])} style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
        padding: '10px 12px', borderRadius: 12, border: '1px solid #EFE9E2', background: '#fff',
        cursor: 'pointer', fontFamily: 'inherit',
      }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: k.bg, color: k.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{k.icon}</svg>
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#1C1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
          <span style={{ display: 'block', fontSize: 12, color: '#78716C' }}>{k.label} · {e.detail}</span>
        </span>
        {e.daysAway > 0 && (
          <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#A8A29E', whiteSpace: 'nowrap' }}>{when(e)}</span>
        )}
      </button>
    );
  };

  const section: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '.13em', color: '#78716C', margin: '0 0 9px' };

  return (
    <div onClick={close} style={{
      position: 'fixed', inset: 0, zIndex: 86,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3vh 16px',
      background: 'rgba(28,25,23,.42)', backdropFilter: 'blur(3px)',
    }}>
      <div role="dialog" aria-label="On this day" onClick={e => e.stopPropagation()} style={{
        width: 'min(560px, 96vw)', maxHeight: '92dvh', display: 'flex', flexDirection: 'column',
        background: '#FFFDFB', borderRadius: 20, boxShadow: '0 26px 60px rgba(28,25,23,.26)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 22px 14px', borderBottom: '1px solid #EFE9E2' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.015em' }}>On this day</div>
            <div style={{ fontSize: 12.5, color: '#78716C', marginTop: 2 }}>{todayLabel}</div>
          </div>
          <button type="button" onClick={close} aria-label="Close" style={{
            width: 32, height: 32, borderRadius: 9, border: '1px solid #E7E2DC', background: '#fff',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#57534E', flexShrink: 0,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '16px 22px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={section}>TODAY</div>
            {today.length ? (
              <div style={{ display: 'grid', gap: 8 }}>{today.map((e, i) => <Row key={i} e={e} />)}</div>
            ) : (
              <div style={{ padding: '14px 16px', borderRadius: 12, background: '#FAF8F5', border: '1px dashed #E2DBD2', fontSize: 12.5, color: '#8A817A' }}>
                No birthdays, anniversaries or remembrances fall on today.
              </div>
            )}
          </div>

          <div>
            <div style={section}>COMING UP · NEXT 30 DAYS</div>
            {upcoming.length ? (
              <div style={{ display: 'grid', gap: 8 }}>{upcoming.map((e, i) => <Row key={i} e={e} />)}</div>
            ) : (
              <div style={{ fontSize: 12.5, color: '#8A817A' }}>
                Nothing in the next month. Only full dates (day, month and year) can appear here.
              </div>
            )}
          </div>

          {facts.length > 0 && (
            <div>
              <div style={section}>FAMILY FACTS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                {facts.map(f => (
                  <button key={f.label} type="button" onClick={() => go(f.personId)} disabled={!f.personId} style={{
                    textAlign: 'left', padding: '11px 12px', borderRadius: 12, border: '1px solid #EFE9E2',
                    background: '#fff', cursor: f.personId ? 'pointer' : 'default', fontFamily: 'inherit', color: '#1C1917',
                  }}>
                    <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#A8A29E' }}>{f.label}</span>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 800, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.value}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: '#78716C', marginTop: 1 }}>{f.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
