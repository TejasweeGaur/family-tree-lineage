import type { Person, Union } from '../types';
import { spousesOf, parentsOf, unionsOf, fullName, initials } from './kinship';
import { computeLayout } from './layout';
import { palette } from './palette';
import { lifeDates } from './dates';

interface TreeData { persons: Person[]; unions: Union[]; }

interface Row {
  name: string; maiden: string; gender: string; relation: string;
  dob: string; pob: string; dod: string; pod: string;
  occupation: string; residency: string;
  father: string; mother: string; spouses: string; children: string;
}

/** Flattens the graph into one row per person, sorted by birth date. */
export function exportRows(data: TreeData): Row[] {
  const nameOf = (id: string) => {
    const p = data.persons.find(x => x.id === id);
    return p ? fullName(p) : '';
  };

  return [...data.persons]
    .sort((a, b) => String(a.dob).localeCompare(String(b.dob)))
    .map(p => {
      const parents = parentsOf(data, p.id).map(id => data.persons.find(x => x.id === id)).filter(Boolean) as Person[];
      const father = parents.find(x => x.gender === 'Male');
      const mother = parents.find(x => x.gender === 'Female');
      const children = unionsOf(data, p.id).flatMap(u => u.children).map(nameOf).filter(Boolean);

      return {
        name: fullName(p),
        maiden: p.maiden,
        gender: p.gender,
        relation: p.label,
        dob: p.dob, pob: p.pob, dod: p.dod, pod: p.pod,
        occupation: p.occupation, residency: p.residency,
        // Fall back to origin-family text for married-in people with no in-tree parents.
        father: father ? fullName(father) : p.originFather,
        mother: mother ? fullName(mother) : p.originMother,
        spouses: spousesOf(data, p.id).map(nameOf).filter(Boolean).join(', '),
        children: children.join(', '),
      };
    });
}

const XLSX_COLUMNS: Array<{ header: string; key: keyof Row; width: number }> = [
  { header: 'Name', key: 'name', width: 26 },
  { header: 'Maiden name', key: 'maiden', width: 16 },
  { header: 'Gender', key: 'gender', width: 10 },
  { header: 'Relation', key: 'relation', width: 22 },
  { header: 'Date of birth', key: 'dob', width: 14 },
  { header: 'Place of birth', key: 'pob', width: 16 },
  { header: 'Date of death', key: 'dod', width: 14 },
  { header: 'Place of death', key: 'pod', width: 16 },
  { header: 'Occupation', key: 'occupation', width: 28 },
  { header: 'Residency', key: 'residency', width: 16 },
  { header: 'Father', key: 'father', width: 22 },
  { header: 'Mother', key: 'mother', width: 22 },
  { header: 'Spouse(s)', key: 'spouses', width: 26 },
  { header: 'Children', key: 'children', width: 34 },
];

export async function exportExcel(data: TreeData, treeName: string): Promise<void> {
  // ExcelJS is ~900 kB — keep it out of the initial bundle.
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const ws = wb.addWorksheet('Members', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.columns = XLSX_COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FF1C1917' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF7F3' } };
  header.alignment = { vertical: 'middle' };
  header.height = 20;

  exportRows(data).forEach(r => ws.addRow(r));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: XLSX_COLUMNS.length } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, `${treeName}-Family-Tree.xlsx`);
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the download a tick to start before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"]/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
}

/** Card geometry from the layout engine. Node x/y is the card's top-left. */
const CARD = { W: 280, H: 264 };

/** Trims to a width that fits the card, since SVG text does not wrap. */
function clip(s: string, max: number): string {
  const t = String(s ?? '').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function cardSvg(p: Person, x: number, y: number): string {
  const c = palette(p.gender);
  const cx = x + CARD.W / 2;
  const dates = lifeDates(p.dob, p.dod);

  return `
    <g>
      <rect x="${x}" y="${y}" width="${CARD.W}" height="${CARD.H}" rx="20"
            fill="${c.fill}" stroke="${c.border}" stroke-width="1.6" />
      <circle cx="${cx}" cy="${y + 66}" r="34" fill="${c.avFill}" />
      <text x="${cx}" y="${y + 66}" text-anchor="middle" dominant-baseline="central"
            font-size="25" font-weight="800" fill="${c.avText}">${esc(initials(p))}</text>
      <text x="${cx}" y="${y + 133}" text-anchor="middle"
            font-size="19" font-weight="800" fill="#1C1917">${esc(clip(fullName(p), 26))}</text>
      ${p.label ? `<text x="${cx}" y="${y + 158}" text-anchor="middle"
            font-size="11" font-weight="700" letter-spacing="0.9" fill="${c.accent}">${esc(clip(p.label.toUpperCase(), 26))}</text>` : ''}
      ${dates ? `<text x="${cx}" y="${y + 184}" text-anchor="middle"
            font-size="13.5" font-weight="600" fill="#57534E">${esc(dates)}</text>` : ''}
      ${p.pob ? `<text x="${cx}" y="${y + 207}" text-anchor="middle"
            font-size="11.5" fill="#78716C">${esc(clip(p.pob, 32))}</text>` : ''}
      ${p.occupation ? `<text x="${cx}" y="${y + 229}" text-anchor="middle"
            font-size="11" font-style="italic" fill="#A8A29E">${esc(clip(p.occupation, 34))}</text>` : ''}
    </g>`;
}

/**
 * Opens a print-optimised sheet showing the tree itself and calls print().
 * Returns false if the popup was blocked so the caller can surface a notice.
 *
 * The structure is the point here — the flat per-person table is what Excel is
 * for, and exporting the same table twice made one of the two formats useless.
 */
export function exportPdf(data: TreeData, treeName: string): boolean {
  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  // Nothing collapsed and admin off: a print-out should show the whole family,
  // not whatever happens to be expanded on screen, and no "+ Add" affordances.
  const layout = computeLayout(data, {}, null, false, null);
  const { nodes, links, conns, w: treeW, h: treeH } = layout;

  const byId = new Map(data.persons.map(p => [p.id, p]));
  const landscape = treeW >= treeH;

  const body = nodes.length
    ? `<svg viewBox="0 0 ${treeW} ${treeH}" xmlns="http://www.w3.org/2000/svg">
        <g fill="none" stroke-linecap="round">
          ${links.filter(l => !l.hidden).map(l =>
            `<path d="${l.d}" stroke="${l.stroke}" stroke-width="${l.w}" />`).join('')}
        </g>
        ${conns.map(cn => {
          const midX = cn.x + cn.w / 2;
          return `<g>
            <path d="M${cn.x} ${cn.y} H${cn.x + cn.w}" stroke="#D6CFC7" stroke-width="2" fill="none" />
            ${cn.hasDate ? `<rect x="${midX - 52}" y="${cn.y - 12}" width="104" height="24" rx="12" fill="#FFFDFB" stroke="#E7E2DC" />
            <text x="${midX}" y="${cn.y}" text-anchor="middle" dominant-baseline="central"
                  font-size="11.5" font-weight="700" fill="#78716C">${esc(clip(cn.date, 16))}</text>` : ''}
          </g>`;
        }).join('')}
        ${nodes.map(n => {
          const p = byId.get(n.id);
          return p ? cardSvg(p, n.x, n.y) : '';
        }).join('')}
      </svg>`
    : `<p class="empty">This archive has no members yet.</p>`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(treeName)} Family Tree</title>
<style>
  @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: #1C1917; margin: 0; }
  h1 { font-size: 19px; letter-spacing: -0.02em; margin: 0 0 2px; }
  .sub { font-size: 10.5px; color: #78716C; margin-bottom: 10px; }
  .empty { font-size: 12px; color: #78716C; }
  /* The viewBox preserves the aspect ratio; max-height keeps the whole tree on
     a single sheet rather than slicing it across page breaks. */
  svg { display: block; width: 100%; height: auto; max-height: ${landscape ? '172mm' : '250mm'}; }
</style></head>
<body>
  <h1>${esc(treeName)} Family Tree</h1>
  <div class="sub">${data.persons.length} individuals · exported ${esc(today)}</div>
  ${body}
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();
  // Let fonts and layout settle before the print dialog steals the thread.
  setTimeout(() => win.print(), 350);
  return true;
}
