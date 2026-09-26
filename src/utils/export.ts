import type { Person, Union } from '../types';
import { spousesOf, parentsOf, unionsOf, fullName } from './kinship';

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

function triggerDownload(blob: Blob, filename: string) {
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

/**
 * Opens a print-optimised A4 landscape sheet and calls print(). Returns false
 * if the popup was blocked so the caller can surface a notice.
 */
export function exportPdf(data: TreeData, treeName: string): boolean {
  const rows = exportRows(data);
  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  const cols: Array<[string, keyof Row]> = [
    ['Name', 'name'], ['Gender', 'gender'], ['Relation', 'relation'],
    ['DOB', 'dob'], ['POB', 'pob'], ['DOD', 'dod'],
    ['Occupation', 'occupation'], ['Father', 'father'], ['Mother', 'mother'], ['Spouse(s)', 'spouses'],
  ];

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(treeName)} Family Tree</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: #1C1917; margin: 0; }
  h1 { font-size: 20px; letter-spacing: -0.02em; margin: 0 0 2px; }
  .sub { font-size: 11px; color: #78716C; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  th { text-align: left; background: #FAF7F3; border-bottom: 1.5px solid #E7E2DC;
       padding: 6px 5px; font-size: 8.5px; letter-spacing: .08em; text-transform: uppercase; color: #57534E; }
  td { padding: 5px; border-bottom: 1px solid #F3EFEA; vertical-align: top; }
  tr { break-inside: avoid; }
  thead { display: table-header-group; }
</style></head>
<body>
  <h1>${esc(treeName)} Family Tree</h1>
  <div class="sub">${rows.length} individuals · exported ${esc(today)}</div>
  <table>
    <thead><tr>${cols.map(c => `<th>${esc(c[0])}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.map(r => `<tr>${cols.map(c => `<td>${esc(r[c[1]])}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  // Let fonts and layout settle before the print dialog steals the thread.
  setTimeout(() => w.print(), 350);
  return true;
}
