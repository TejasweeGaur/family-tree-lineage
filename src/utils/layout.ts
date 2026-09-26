import type { Person, Union, LayoutResult, LayoutNode, LayoutLink, LayoutConn, LayoutPill, LayoutExtra } from '../types';
import { palette } from './palette';
import { lifeDates, mdate } from './dates';
import { initials, fullName, spousesOf, unionsOf, parentsOf, getRoot, descendantCount } from './kinship';

const L = { CW: 280, CH: 264, GAP: 176, SIB: 56, VG: 200, CONN_Y: 92, PAD: 90 };
const ACC = '#C2410C';
const LINE = '#D6CFC7';

interface TreeData { persons: Person[]; unions: Union[]; }

interface WidthInfo {
  w: number;
  unitW: number;
  kidW: number;
  members: string[];
  kids: string[];
}

function elbow(x0: number, y0: number, x1: number, y1: number, busY: number, r: number): string {
  if (Math.abs(x1 - x0) < 3) return `M${x0} ${y0} V${y1}`;
  const s = x1 > x0 ? 1 : -1;
  return `M${x0} ${y0} V${busY - r} Q${x0} ${busY} ${x0 + s * r} ${busY} H${x1 - s * r} Q${x1} ${busY} ${x1} ${busY + r} V${y1}`;
}

export function computeLayout(
  data: TreeData,
  collapsed: Record<string, boolean>,
  focus: string | null,
  admin: boolean,
  matchSet: Record<string, boolean | 'rel'> | null,
  branch: string | null = null
): LayoutResult {
  const { CW, CH, GAP, SIB, VG, CONN_Y, PAD } = L;

  const kidsOf = (id: string): string[] => {
    let k: string[] = [];
    unionsOf(data, id).forEach(u => {
      if (!collapsed[u.id]) k = k.concat(u.children);
    });
    return k.slice().sort((a, b) => {
      const pa = data.persons.find(p => p.id === a);
      const pb = data.persons.find(p => p.id === b);
      return String(pa?.dob || '').localeCompare(String(pb?.dob || ''));
    });
  };

  const unitMembers = (id: string): string[] => [id, ...spousesOf(data, id)];

  const W: Record<string, WidthInfo> = {};

  const measure = (id: string): number => {
    const m = unitMembers(id);
    const unitW = m.length * CW + (m.length - 1) * GAP;
    const kids = kidsOf(id);
    let kidW = 0;
    kids.forEach((k, i) => { kidW += measure(k) + (i ? SIB : 0); });
    if (admin && kids.length) kidW += SIB + 170;
    const w = Math.max(unitW, kidW);
    W[id] = { w, unitW, kidW, members: m, kids };
    return w;
  };

  const rootId = getRoot(data);
  if (!rootId) return { nodes: [], links: [], hits: [], conns: [], pills: [], extras: [], w: 0, h: 0 };
  measure(rootId);

  const nodes: LayoutNode[] = [];
  const links: LayoutLink[] = [];
  const conns: LayoutConn[] = [];
  const pills: LayoutPill[] = [];
  const extras: LayoutExtra[] = [];

  const related: Record<string, boolean> = {};
  if (focus) {
    [
      ...parentsOf(data, focus),
      ...spousesOf(data, focus),
      ...unionsOf(data, focus).flatMap(u => u.children),
    ].forEach(r => { related[r] = true; });
    related[focus] = true;
  }

  const vis = (id: string): boolean => !matchSet || !!matchSet[id];

  const place = (id: string, left: number, top: number) => {
    const d = W[id];
    if (!d) return;
    const uLeft = left + (d.w - d.unitW) / 2;
    const pos: Record<string, number> = {};
    d.members.forEach((mid, i) => { pos[mid] = uLeft + i * (CW + GAP); });
    d.members.forEach(mid => nodes.push({ id: mid, x: pos[mid], y: top }));

    const uns = unionsOf(data, id);
    uns.forEach(u => {
      const other = u.a === id ? u.b : u.a;
      if (!other) return;
      const i = d.members.indexOf(other);
      if (i < 1) return;
      const midX = uLeft + (i - 1) * (CW + GAP) + CW + GAP / 2;
      const y = top + CONN_Y;
      const hl = !!(focus && (focus === id || focus === other));
      const on = vis(id) && vis(other);
      links.push({
        uid: u.id,
        d: `M${uLeft + (i - 1) * (CW + GAP) + CW} ${y} H${pos[other]}`,
        stroke: hl ? ACC : LINE, w: hl ? 2.5 : 2, hidden: !on,
      });
      if (!on) return;
      conns.push({
        x: midX, y: y + 12, w: 150,
        date: (() => { const m = mdate(u.date); return m ? u.date : ''; })(),
        hasDate: !!u.date, showAdd: !u.date && admin, opacity: on ? 1 : 0.12,
        unionId: u.id, personA: id, personB: other,
      });
      (u as any)._midX = midX;
      (u as any)._topY = top;
    });

    const kids = d.kids;
    if (kids.length) {
      let kx = left + (d.w - d.kidW) / 2;
      const childTop = top + CH + VG;
      const busY = top + CH + 118;
      const placed: number[] = [];
      kids.forEach(k => {
        const kw = W[k]?.w || CW;
        place(k, kx, childTop);
        placed.push(kx + ((W[k]?.w || CW) - (W[k]?.unitW || CW)) / 2 + CW / 2);
        kx += kw + SIB;
      });
      if (admin) {
        extras.push({ x: kx, y: childTop + 70, w: 170, targetId: id });
      }
      uns.forEach(u => {
        if (collapsed[u.id] || !u.children.length) return;
        const midX = (u as any)._midX !== undefined ? (u as any)._midX : pos[id] + CW / 2;
        const pillY = top + CH + 44;
        const hl = !!(focus && (focus === u.a || focus === u.b));
        links.push({ uid: u.id, d: `M${midX} ${top + CONN_Y + 46} V${pillY - 15}`, stroke: hl ? ACC : LINE, w: hl ? 2.5 : 2, hidden: false });
        u.children.forEach(c => {
          const idx = kids.indexOf(c);
          if (idx < 0) return;
          const cx = placed[idx];
          links.push({
            uid: u.id,
            d: elbow(midX, pillY + 15, cx, childTop, busY, 14),
            stroke: (focus === c || hl) ? ACC : LINE,
            w: (focus === c || hl) ? 2.5 : 2,
            hidden: !vis(c),
          });
        });
        const pNames = [u.a, u.b]
          .filter(x => x && data.persons.find(p => p.id === x))
          .map(x => data.persons.find(p => p.id === x)!.first.toUpperCase())
          .join(' & ');
        pills.push({
          x: midX, y: pillY,
          label: `${u.children.length} ${u.children.length === 1 ? 'CHILD' : 'CHILDREN'} OF ${pNames}`,
          rot: '180deg', opacity: 1,
          unionId: u.id, collapsed: false, count: u.children.length,
        });
      });
    }

    // collapsed pills
    uns.forEach(u => {
      if (!collapsed[u.id] || !u.children.length) return;
      const midX = (u as any)._midX !== undefined ? (u as any)._midX : uLeft + CW / 2;
      const pillY = top + CH + 44;
      links.push({ uid: u.id, d: `M${midX} ${top + CONN_Y + 46} V${pillY - 15}`, stroke: LINE, w: 2, hidden: false });
      pills.push({
        x: midX, y: pillY,
        label: `+${descendantCount(data, u.id)} DESCENDANTS`,
        rot: '0deg', opacity: 1,
        unionId: u.id, collapsed: true, count: descendantCount(data, u.id),
      });
    });
  };

  place(rootId, PAD, PAD);

  let maxX = 0, maxY = 0;
  nodes.forEach(n => { maxX = Math.max(maxX, n.x + CW); maxY = Math.max(maxY, n.y + CH); });
  extras.forEach(x => { maxX = Math.max(maxX, x.x + x.w); });
  pills.forEach(p => { maxY = Math.max(maxY, p.y + 40); });

  // Drop filtered-out segments, then re-colour whatever belongs to the
  // highlighted branch so the whole lineage reads as one stroke.
  const shown = links
    .filter(l => !l.hidden)
    .map(l => (branch && l.uid === branch ? { ...l, stroke: ACC, w: 3 } : l));

  // Fat transparent duplicates give the thin connectors a clickable target.
  const hits = shown.filter(l => l.uid).map(l => ({ uid: l.uid, d: l.d }));

  return { nodes, links: shown, hits, conns, pills, extras, w: maxX + PAD, h: maxY + PAD };
}

export function buildNodeProps(
  id: string,
  x: number,
  y: number,
  data: TreeData,
  focus: string | null,
  related: Record<string, boolean>,
  visible: boolean,
  admin: boolean
) {
  const p = data.persons.find(per => per.id === id);
  if (!p) return null;
  const c = palette(p.gender);
  const sp = spousesOf(data, id).map(s => data.persons.find(per => per.id === s)).find(Boolean);
  const u = unionsOf(data, id)[0];
  const isFocus = focus === id;
  const dim = !!(focus && !related[id]);

  return {
    id, x, y,
    fill: c.fill,
    border: isFocus ? c.accent : c.border,
    borderW: isFocus ? 3 : 2,
    accent: c.accent,
    avFill: c.avFill, avText: c.avText,
    pillBg: c.pillBg, pillColor: c.pillColor,
    shadow: isFocus
      ? '0 0 0 6px rgba(194,65,12,.12), 0 14px 32px rgba(28,25,23,.14)'
      : '0 2px 10px rgba(28,25,23,.06)',
    opacity: visible ? (dim ? 0.4 : 1) : 0.08,
    display: visible ? 'flex' : 'none',
    initials: initials(p),
    name: fullName(p),
    maidenText: p.maiden ? `(née ${p.maiden})` : '',
    dates: lifeDates(p.dob, p.dod),
    occupation: p.occupation || '—',
    label: p.label,
    deceased: !!p.dod,
    genderGlyph: c.glyph,
    genderName: c.genderName,
    spouseName: sp ? fullName(sp) : '',
    mdate: u && u.date ? `m. ${u.date.slice(0, 7)}` : '',
    city: p.residency || p.pob,
    showPlus: admin,
    sample: p.sample,
  };
}
