import { useRef, useState } from 'react';
import { useTreeStore } from '../store/useTreeStore';
import { ARCHIVE_CATEGORIES } from '../data/seed';
import { compressDocumentImage } from '../utils/image';
import { ARCHIVE_MAX_BYTES, IMAGE_INPUT_MAX_BYTES, formatBytes } from '../config/limits';

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

export function ArchiveForm() {
  const store = useTreeStore();
  const { archiveForm, savingArchive } = store;
  const fileRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);
  // Size before compression, to show what was saved. Null when unchanged.
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  if (!archiveForm) return null;

  const person = store.persons.find(p => p.id === archiveForm.targetId);
  const canSave = !!archiveForm.title && !savingArchive && !compressing;
  const isEdit = !!archiveForm.editId;
  // Editing a record whose file is kept as-is: we have its name, not its bytes.
  const keepingExisting = isEdit && !archiveForm.fileData && !!archiveForm.file;

  const pick = async (f: File | null) => {
    if (!f) return;
    const isImage = f.type.startsWith('image/');
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    if (!isImage && !isPdf) {
      store.setNotice('Choose a JPG, PNG, WEBP or PDF file.');
      return;
    }
    // PDFs can't be meaningfully compressed in the browser, so they must
    // already fit. Most phone scanner apps have a "reduce size" option.
    if (isPdf && f.size > ARCHIVE_MAX_BYTES) {
      store.setNotice(`That PDF is ${formatBytes(f.size)}; the limit is ${formatBytes(ARCHIVE_MAX_BYTES)}. Try your scanner app's "reduce size" option.`);
      return;
    }
    if (isImage && f.size > IMAGE_INPUT_MAX_BYTES) {
      store.setNotice(`That image is ${formatBytes(f.size)}; the most that can be compressed is ${formatBytes(IMAGE_INPUT_MAX_BYTES)}.`);
      return;
    }

    let out = f;
    if (isImage) {
      setCompressing(true);
      try {
        out = await compressDocumentImage(f);
      } catch (e) {
        store.setNotice(e instanceof Error ? e.message : 'Could not process that image.');
        return;
      } finally {
        setCompressing(false);
      }
    }
    if (out.size > ARCHIVE_MAX_BYTES) {
      store.setNotice(`Even compressed, that file is ${formatBytes(out.size)}; the limit is ${formatBytes(ARCHIVE_MAX_BYTES)}.`);
      return;
    }
    setOriginalSize(out === f ? null : f.size);
    store.setArchiveField('fileData', out);
    store.setArchiveField('file', out.name);
  };

  const clearFile = () => {
    setOriginalSize(null);
    store.setArchiveField('fileData', null);
    store.setArchiveField('file', '');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 85,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '3vh 16px', background: 'rgba(41,37,36,.42)', backdropFilter: 'blur(3px)',
    }}
      onClick={e => e.stopPropagation()}
    >
      <div role="dialog" aria-label="Archive record" style={{
        width: 'min(680px,96vw)', maxHeight: '94vh',
        background: '#FFFDFB', borderRadius: 20,
        boxShadow: '0 30px 80px rgba(28,25,23,.3)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 22px', borderBottom: '1px solid #EFE9E2' }}>
          <span style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: '#FEF6F1', color: '#C2410C',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
              <path d="M12 16V4M8 8l4-4 4 4M4 16v4h16v-4" />
            </svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.018em' }}>
              {isEdit ? 'Edit Archive Record' : 'Archive Historical Document / Photo'}
            </div>
            {person && <div style={{ fontSize: 12, color: '#8A817A', marginTop: 2 }}>For {person.first} {person.last}</div>}
          </div>
          <button type="button" onClick={store.closeArchiveForm} aria-label="Close" style={iconBtn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 22px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Drop zone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); void pick(e.dataTransfer.files?.[0] ?? null); }}
            style={{ border: '2px dashed #E2DBD2', borderRadius: 16, padding: 24, textAlign: 'center', background: '#FAF8F5' }}
          >
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              onChange={e => { void pick(e.target.files?.[0] ?? null); e.target.value = ''; }}
              style={{ display: 'none' }}
            />

            {archiveForm.fileData ? (
              <div style={{ marginBottom: 12 }}>
                {archiveForm.fileData.type.startsWith('image/') ? (
                  <img
                    src={URL.createObjectURL(archiveForm.fileData)}
                    alt=""
                    style={{ maxHeight: 150, maxWidth: '100%', borderRadius: 12, display: 'block', margin: '0 auto' }}
                  />
                ) : (
                  <div style={{ height: 90, borderRadius: 12, background: '#F7F3ED', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#78716C' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" />
                    </svg>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>PDF</span>
                  </div>
                )}
                <div style={{ fontSize: 12, fontWeight: 700, color: '#44403C', marginTop: 8, wordBreak: 'break-all' }}>
                  {archiveForm.file}
                </div>
                <div style={{ fontSize: 11, color: '#A8A29E', marginTop: 2 }}>
                  {originalSize
                    ? <>Compressed {formatBytes(originalSize)} → <strong style={{ color: '#15803D' }}>{formatBytes(archiveForm.fileData.size)}</strong></>
                    : formatBytes(archiveForm.fileData.size)}
                </div>
                <button type="button" onClick={clearFile} style={{
                  marginTop: 8, padding: '5px 11px', borderRadius: 8,
                  border: '1px solid #E7E2DC', background: '#fff',
                  fontSize: 11.5, fontWeight: 700, color: '#B91C1C', cursor: 'pointer', fontFamily: 'inherit',
                }}>Remove</button>
              </div>
            ) : keepingExisting ? (
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: '#A8A29E' }}>CURRENT FILE</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#44403C', marginTop: 5, wordBreak: 'break-all' }}>
                  {archiveForm.file}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                  <button type="button" onClick={() => fileRef.current?.click()} style={{
                    padding: '7px 13px', borderRadius: 9, border: 'none',
                    background: '#1C1917', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                  }}>Replace</button>
                  <button type="button" onClick={clearFile} style={{
                    padding: '7px 13px', borderRadius: 9, border: '1px solid #E7E2DC', background: '#fff',
                    color: '#B91C1C', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                  }}>Remove</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#57534E' }}>Drag and drop a scan or photo here</div>
                <div style={{ fontSize: 11.5, color: '#A8A29E', marginTop: 3, lineHeight: 1.5 }}>
                  {compressing
                    ? 'Compressing…'
                    : <>JPG, PNG or WEBP — compressed automatically.<br />PDF up to {formatBytes(ARCHIVE_MAX_BYTES)}.</>}
                </div>
                <button type="button" onClick={() => fileRef.current?.click()} style={{
                  marginTop: 13, padding: '9px 16px', borderRadius: 10, border: 'none',
                  background: '#1C1917', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                }}>Browse File</button>
              </>
            )}
          </div>

          {/* Title */}
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#78716C', marginBottom: 5 }}>Document Title *</span>
            <input type="text" value={archiveForm.title} onChange={e => store.setArchiveField('title', e.target.value)} placeholder="e.g. Land Deed — Varanasi Estate" style={inputStyle} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#78716C', marginBottom: 5 }}>Record Category</span>
              <select value={archiveForm.category} onChange={e => store.setArchiveField('category', e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
                {ARCHIVE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#78716C', marginBottom: 5 }}>Year / Date Created</span>
              <input type="text" value={archiveForm.year} onChange={e => store.setArchiveField('year', e.target.value)} placeholder="YYYY or YYYY-MM-DD" style={inputStyle} />
            </label>
          </div>

          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#78716C', marginBottom: 5 }}>Origin Location / Archive Registry</span>
            <input type="text" value={archiveForm.origin} onChange={e => store.setArchiveField('origin', e.target.value)} placeholder="e.g. Varanasi District Registry" style={inputStyle} />
          </label>

          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#78716C', marginBottom: 5 }}>Historical Context & Details</span>
            <textarea value={archiveForm.notes} onChange={e => store.setArchiveField('notes', e.target.value)} rows={4} placeholder="What the record shows, who is in it, how it came to the family." style={{ ...inputStyle, lineHeight: 1.55, resize: 'vertical', fontFamily: 'inherit' }} />
          </label>
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid #EFE9E2' }}>
          <button type="button" onClick={store.closeArchiveForm} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#78716C' }}>Cancel</button>
          <button type="button" onClick={() => void store.saveArchive()} disabled={!canSave} style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: canSave ? '#C2410C' : '#A8A29E', color: '#fff',
            cursor: canSave ? 'pointer' : 'not-allowed', fontSize: 12.5, fontWeight: 700,
          }}>{savingArchive ? 'Saving…' : isEdit ? 'Save Changes' : 'Save to Archives'}</button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
  border: '1px solid #E7E2DC', background: '#fff', fontSize: 13, outline: 'none',
  fontFamily: 'inherit',
};

const iconBtn: React.CSSProperties = {
  flexShrink: 0, width: 32, height: 32, borderRadius: 9, border: '1px solid #E7E2DC',
  background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#57534E',
};
