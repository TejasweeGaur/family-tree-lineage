function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

export function renderMarkdown(src: string): string {
  let out = '';
  let inList = false;
  const close = () => { if (inList) { out += '</ul>'; inList = false; } };
  const lines = esc(src || '').split('\n');
  for (const l of lines) {
    if (/^### /.test(l)) {
      close();
      out += `<h3 style="font-size:14px;font-weight:800;letter-spacing:-0.01em;margin:16px 0 6px">${inline(l.slice(4))}</h3>`;
    } else if (/^## /.test(l)) {
      close();
      out += `<h2 style="font-size:15px;font-weight:800;letter-spacing:-0.01em;margin:16px 0 6px">${inline(l.slice(3))}</h2>`;
    } else if (/^- /.test(l)) {
      if (!inList) { out += '<ul style="margin:6px 0 6px 18px;padding:0">'; inList = true; }
      out += `<li style="margin:3px 0">${inline(l.slice(2))}</li>`;
    } else if (/^&gt; /.test(l)) {
      close();
      out += `<blockquote style="margin:12px 0;padding:8px 14px;border-left:3px solid #FCD34D;background:#FFFBEB;color:#78716C">${inline(l.slice(5))}</blockquote>`;
    } else if (!l.trim()) {
      close();
    } else {
      close();
      out += `<p style="margin:7px 0">${inline(l)}</p>`;
    }
  }
  if (inList) out += '</ul>';
  return out;
}
