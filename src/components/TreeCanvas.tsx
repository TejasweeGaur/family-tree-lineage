import { useRef, useCallback, useEffect } from 'react';
import { useTreeStore } from '../store/useTreeStore';
import { PersonCard } from './PersonCard';
import { fullName, spousesOf, parentsOf, unionsOf, kin, branchSet } from '../utils/kinship';
import { shortDate } from '../utils/dates';

export function TreeCanvas() {
  const store = useTreeStore();
  const {
    persons, unions, focus, branch, zoom, mode, winW,
    toggleUnion, setFocus, setBranch, openEdit, openAdd,
    setZoom, closeAllMenus, revealTarget, consumeReveal,
  } = store;

  const isAdmin = store.isAdmin();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const data = { persons, unions };

  const layout = store.getLayout();
  const { nodes, links, hits, conns, pills, extras, w: canvasW, h: canvasH } = layout;
  const matchSet = store.getMatchSet();

  // Which cards stay bright: the focused person's immediate family, or the
  // whole lineage under a highlighted branch.
  const bright: Record<string, boolean> | null = (() => {
    if (branch) return branchSet(data, branch);
    if (!focus) return null;
    const set: Record<string, boolean> = { [focus]: true };
    [...parentsOf(data, focus), ...spousesOf(data, focus), ...unionsOf(data, focus).flatMap(u => u.children)]
      .forEach(r => { set[r] = true; });
    return set;
  })();

  const vis = (id: string) => !matchSet || !!matchSet[id];

  // Centre on first paint; on mobile start zoomed out on the root.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (window.innerWidth < 640) setZoom(0.7);
    const centre = () => {
      const target = canvasW * useTreeStore.getState().zoom;
      el.scrollLeft = Math.max(0, (target - el.clientWidth) / 2);
    };
    centre();
    const t1 = setTimeout(centre, 60);
    const t2 = setTimeout(centre, 260);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // Intentionally first-paint only — re-centring on every layout change would
    // fight the user's scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pull a searched-for person into the middle of the viewport.
  useEffect(() => {
    if (!revealTarget) return;
    const el = scrollerRef.current;
    const node = nodes.find(n => n.id === revealTarget);
    if (!el || !node) { consumeReveal(); return; }
    el.scrollTo({
      left: Math.max(0, node.x * zoom - el.clientWidth / 2 + 140 * zoom),
      top: Math.max(0, node.y * zoom - el.clientHeight / 2 + 132 * zoom),
      behavior: 'smooth',
    });
    consumeReveal();
  }, [revealTarget, nodes, zoom, consumeReveal]);

  // Ctrl/Cmd + wheel zooms instead of scrolling.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(useTreeStore.getState().zoom + (e.deltaY < 0 ? 0.08 : -0.08));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setZoom]);

  const onPanStart = useCallback((e: React.MouseEvent) => {
    if (mode !== 'drag' || !scrollerRef.current) return;
    e.preventDefault();
    const el = scrollerRef.current;
    const sx = e.clientX, sy = e.clientY, l = el.scrollLeft, t = el.scrollTop;
    const move = (ev: MouseEvent) => {
      el.scrollLeft = l - (ev.clientX - sx);
      el.scrollTop = t - (ev.clientY - sy);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, [mode]);

  return (
    <div
      ref={scrollerRef}
      className="canvas-bg"
      data-tour="canvas"
      style={{ position: 'absolute', inset: 0, overflow: 'auto', display: 'flex', cursor: mode === 'drag' ? 'grab' : 'default' }}
      onMouseDown={onPanStart}
      onClick={() => { setFocus(null); setBranch(null); closeAllMenus(); }}
    >
      {/*
        `margin: auto` on a flex child centres a small tree on both axes while
        still letting a large one scroll to its true edges. Using
        justify-content/align-items instead would clip the overflowing start.
      */}
      <div style={{ position: 'relative', flexShrink: 0, margin: 'auto', width: Math.round(canvasW * zoom), height: Math.round(canvasH * zoom) }}>
        <div style={{ position: 'absolute', top: 0, left: 0, transform: `scale(${zoom})`, transformOrigin: '0 0', width: canvasW, height: canvasH }}>

          <svg width={canvasW} height={canvasH} style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
            <g style={{ pointerEvents: 'none' }}>
              {links.map((l, i) => (
                <path key={i} d={l.d} fill="none" stroke={l.stroke} strokeWidth={l.w} strokeLinecap="round" />
              ))}
            </g>
            {/* Wide invisible duplicates make the thin connectors clickable. */}
            <g>
              {hits.map((h, i) => (
                <path
                  key={i}
                  d={h.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={18}
                  style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                  onClick={e => { e.stopPropagation(); setBranch(h.uid); }}
                />
              ))}
            </g>
          </svg>

          {/* Marriage badges */}
          {conns.map((c, i) => (
            <div key={i} style={{
              position: 'absolute', left: c.x, top: c.y, width: c.w,
              transform: 'translate(-50%,-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              opacity: c.opacity, pointerEvents: 'none',
            }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#FDF2F8', border: '1.5px solid #F9A8D4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#DB2777" stroke="none">
                  <path d="M12 20.5S3.8 15.4 3.8 9.9A4.6 4.6 0 0 1 12 7.2a4.6 4.6 0 0 1 8.2 2.7c0 5.5-8.2 10.6-8.2 10.6z" />
                </svg>
              </div>
              <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '.13em', color: '#9F1239' }}>MARRIED</div>
              {c.hasDate && (
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#78716C', whiteSpace: 'nowrap' }}>
                  {shortDate(c.date)}
                </div>
              )}
              {c.showAdd && isAdmin && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); openEdit(c.personA); }}
                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 10.5, fontWeight: 700, color: '#C2410C', whiteSpace: 'nowrap', pointerEvents: 'auto', fontFamily: 'inherit' }}
                >
                  + Add anniversary
                </button>
              )}
            </div>
          ))}

          {/* Branch pills */}
          {pills.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={e => { e.stopPropagation(); toggleUnion(p.unionId); }}
              style={{
                position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%,-50%)',
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '6px 12px', borderRadius: 99,
                background: '#fff', border: '1.5px solid #E2DBD2',
                boxShadow: '0 2px 6px rgba(28,25,23,.05)',
                cursor: 'pointer', whiteSpace: 'nowrap', opacity: p.opacity, fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.09em', color: '#57534E' }}>{p.label}</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A8A29E" strokeWidth="2.4" strokeLinecap="round" style={{ transform: `rotate(${p.rot})` }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          ))}

          {/* Ghost "add child" slots */}
          {isAdmin && extras.map((x, i) => (
            <button
              key={i}
              type="button"
              onClick={e => { e.stopPropagation(); openAdd(x.targetId, 'Son'); }}
              style={{
                position: 'absolute', left: x.x, top: x.y, width: x.w, height: 56,
                borderRadius: 12, border: '2px dashed #D6CFC7',
                background: 'rgba(255,255,255,.55)', color: '#78716C',
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              + Add Child
            </button>
          ))}

          {nodes.map(n => {
            const person = persons.find(p => p.id === n.id);
            if (!person) return null;
            const sp = spousesOf(data, n.id).map(id => persons.find(p => p.id === id)).find(Boolean);
            const u = unionsOf(data, n.id)[0];
            return (
              <PersonCard
                key={n.id}
                person={person}
                x={n.x}
                y={n.y}
                isFocus={focus === n.id}
                isDim={!!bright && !bright[n.id]}
                isVisible={vis(n.id)}
                spouseName={sp ? fullName(sp) : ''}
                mdate={u?.date ? `m. ${u.date}` : ''}
                city={person.residency || person.pob}
                kinChip={focus && focus !== n.id ? kin(data, focus, n.id) : ''}
              />
            );
          })}
        </div>
      </div>

      <CanvasControls compact={winW < 640} />
    </div>
  );
}

function CanvasControls({ compact }: { compact: boolean }) {
  const zoom = useTreeStore(s => s.zoom);
  const mode = useTreeStore(s => s.mode);
  const setZoom = useTreeStore(s => s.setZoom);
  const setMode = useTreeStore(s => s.setMode);
  const getLayout = useTreeStore(s => s.getLayout);

  const fit = () => {
    const { w, h } = getLayout();
    const el = document.querySelector('.canvas-bg') as HTMLElement | null;
    if (!el || !w || !h) return setZoom(1);
    setZoom(Math.min(el.clientWidth / w, el.clientHeight / h));
  };

  return (
    <div
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'fixed', right: 20, bottom: 20, zIndex: 20,
        background: '#FFFDFB', border: '1px solid #E7E2DC',
        borderRadius: 16, boxShadow: '0 10px 30px rgba(28,25,23,.1)',
        padding: 9, display: 'flex', alignItems: 'center', gap: 9,
      }}
    >
      {!compact && (
        <>
          <div style={{ display: 'flex', background: '#F5F1EC', borderRadius: 9, padding: 2, gap: 2 }}>
            {(['scroll', 'drag'] as const).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)} style={{
                padding: '6px 11px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
                background: mode === m ? '#fff' : 'transparent',
                color: mode === m ? '#1C1917' : '#78716C',
                boxShadow: mode === m ? '0 1px 3px rgba(28,25,23,.1)' : 'none',
              }}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ width: 1, height: 22, background: '#EFE9E2' }} />
        </>
      )}
      <button type="button" onClick={() => setZoom(zoom - 0.1)} aria-label="Zoom out" style={zoomBtn}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14" /></svg>
      </button>
      <span style={{ fontSize: 12, fontWeight: 800, minWidth: 42, textAlign: 'center', color: '#44403C' }}>
        {Math.round(zoom * 100)}%
      </span>
      <button type="button" onClick={() => setZoom(zoom + 0.1)} aria-label="Zoom in" style={zoomBtn}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      <button type="button" onClick={fit} style={{ ...zoomBtn, width: 'auto', padding: '7px 11px', gap: 6, fontSize: 11.5, fontWeight: 700 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
        Fit
      </button>
    </div>
  );
}

const zoomBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 9, border: '1px solid #E7E2DC',
  background: '#fff', cursor: 'pointer', color: '#44403C', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
