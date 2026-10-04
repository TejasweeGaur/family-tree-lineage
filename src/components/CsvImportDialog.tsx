import { useTreeStore } from '../store/useTreeStore';
import { treeTitle } from '../utils/treeTitle';

/**
 * Preview for a parsed CSV. Nothing has been written when this opens: the
 * import runs only on confirm, and only if validation found no errors.
 */
export function CsvImportDialog() {
  const plan = useTreeStore(s => s.csvPlan);
  const importing = useTreeStore(s => s.csvImporting);
  const existing = useTreeStore(s => s.persons.length);
  const treeName = useTreeStore(s => s.trees.find(t => t.id === s.activeTreeId)?.name ?? 'this');
  const close = useTreeStore(s => s.closeCsvImport);
  const run = useTreeStore(s => s.runCsvImport);
  if (!plan) return null;

  const marriages = plan.unions.filter(u => u.a && u.b).length;
  const links = plan.unions.reduce((n, u) => n + u.children.length, 0);
  const root = plan.people.find(p => p.ref === plan.rootRef);
  const blocked = plan.errors.length > 0 || existing > 0;

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 88,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3vh 16px',
        background: 'rgba(28,25,23,.42)', backdropFilter: 'blur(3px)',
      }}
    >
      <div
        role="dialog"
        aria-label="Import CSV"
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(520px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          background: '#FFFDFB', borderRadius: 20, boxShadow: '0 26px 60px rgba(28,25,23,.26)', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #EFE9E2' }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.015em' }}>Import from CSV</div>
          <div style={{ fontSize: 12, color: '#78716C', marginTop: 3, wordBreak: 'break-all' }}>{plan.fileName}</div>
        </div>

        <div style={{ padding: '16px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {existing > 0 && (
            <Box tone="error" title="This tree isn't empty">
              Import adds a whole family at once, so it only runs on an empty tree — otherwise a
              second import would duplicate everyone. Create a new tree from the tree menu, then import into it.
            </Box>
          )}

          {plan.errors.length > 0 && (
            <Box tone="error" title={`${plan.errors.length} ${plan.errors.length === 1 ? 'problem' : 'problems'} to fix first`}>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
                {plan.errors.slice(0, 12).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
              {plan.errors.length > 12 && <div style={{ marginTop: 6 }}>…and {plan.errors.length - 12} more.</div>}
            </Box>
          )}

          {plan.errors.length === 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <Stat n={plan.people.length} label="people" />
              <Stat n={marriages} label="marriages" />
              <Stat n={links} label="parent links" />
            </div>
          )}

          {plan.errors.length === 0 && root && (
            <div style={{ fontSize: 12.5, color: '#57534E', lineHeight: 1.5 }}>
              The tree will start from <strong>{root.first} {root.last}</strong>
              {root.dob ? ` (b. ${root.dob})` : ''} — the earliest ancestor with the most descendants.
            </div>
          )}

          {plan.warnings.map((w, i) => (
            <Box key={i} tone="warn" title="Worth knowing">{w}</Box>
          ))}

          {!blocked && (
            <div style={{ fontSize: 11.5, color: '#A8A29E', lineHeight: 1.5 }}>
              Everything is saved in one step into the {treeTitle(treeName)}. If anything fails, nothing is saved.
            </div>
          )}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid #EFE9E2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={close} disabled={importing} style={{
            padding: '10px 16px', borderRadius: 10, border: 'none', background: 'none',
            cursor: importing ? 'default' : 'pointer', fontSize: 12.5, fontWeight: 700, color: '#78716C', fontFamily: 'inherit',
          }}>Cancel</button>
          <button type="button" onClick={() => void run()} disabled={blocked || importing} style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: blocked || importing ? '#D6D0C9' : '#C2410C', color: '#fff',
            cursor: blocked || importing ? 'not-allowed' : 'pointer',
            fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
          }}>
            {importing ? 'Importing…' : `Import ${plan.people.length} ${plan.people.length === 1 ? 'person' : 'people'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #EFE9E2', background: '#fff' }}>
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{n}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#78716C' }}>{label}</div>
    </div>
  );
}

function Box({ tone, title, children }: { tone: 'error' | 'warn'; title: string; children: React.ReactNode }) {
  const c = tone === 'error'
    ? { bg: '#FEF2F2', border: '#FECACA', fg: '#991B1B' }
    : { bg: '#FFFBEB', border: '#FDE68A', fg: '#92400E' };
  return (
    <div style={{ padding: '11px 13px', borderRadius: 12, background: c.bg, border: `1px solid ${c.border}`, color: c.fg, fontSize: 12, lineHeight: 1.5 }}>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  );
}
