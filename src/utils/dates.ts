const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function year(d: string): string {
  return d ? String(d).slice(0, 4) : '';
}

export function fmtDate(d: string): string {
  if (!d) return '';
  if (d.length === 4) return d;
  const parts = d.split('-');
  const y = parts[0], m = parts[1], dd = parts[2];
  return (dd ? String(Number(dd)) + ' ' : '') + (MONTHS_LONG[Number(m) - 1] || '') + ' ' + y;
}

/** `16 Oct 1963`, `Oct 1963` or `1963`, depending on how much of the date is known. */
export function shortDate(d: string): string {
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  const month = m ? MONTHS_SHORT[Number(m) - 1] : '';
  if (!month) return y;
  return dd ? `${Number(dd)} ${month} ${y}` : `${month} ${y}`;
}

// ---------------------------------------------------------------- entry

/**
 * Stored dates are ISO and may be partial: `1963-10-16`, `1963-10` or `1963`,
 * since families often know only the month or the year. People type them as
 * mm/dd/yyyy, mm/yyyy or yyyy; these convert between the two.
 */
export function toEntryText(iso: string): string {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(iso);
  if (!m) return iso; // something older or hand-typed: shown as it is
  const [, y, mo, d] = m;
  if (d) return `${mo}/${d}/${y}`;
  if (mo) return `${mo}/${y}`;
  return y;
}

export type ParsedDate = { iso: string } | { error: string };

export const DATE_FORMAT_HINT = 'Use mm/dd/yyyy, mm/yyyy or yyyy';

export function parseEntryText(text: string, opts: { noFuture?: boolean } = {}): ParsedDate {
  const t = text.trim();
  if (!t) return { iso: '' };
  // Accept any separator, so 10-16-1963 and 10.16.1963 work as well.
  const parts = t.split(/[^0-9]+/).filter(Boolean);
  let y: number, mo = 0, d = 0;
  if (parts.length === 1 && parts[0].length === 4) {
    y = Number(parts[0]);
  } else if (parts.length === 2 && parts[1].length === 4) {
    mo = Number(parts[0]); y = Number(parts[1]);
  } else if (parts.length === 3 && parts[2].length === 4) {
    mo = Number(parts[0]); d = Number(parts[1]); y = Number(parts[2]);
  } else if (parts.length === 3 && parts[0].length === 4) {
    // Pasted ISO, yyyy-mm-dd.
    y = Number(parts[0]); mo = Number(parts[1]); d = Number(parts[2]);
  } else {
    return { error: DATE_FORMAT_HINT };
  }
  if (y < 1000 || y > 2999) return { error: 'Enter a four-digit year' };
  if (parts.length > 1 && (mo < 1 || mo > 12)) return { error: 'The month must be 1–12' };
  if (d) {
    const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    if (d < 1 || d > days) return { error: `That month has ${days} days` };
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = d ? `${y}-${pad(mo)}-${pad(d)}` : mo ? `${y}-${pad(mo)}` : String(y);
  if (opts.noFuture && iso > todayIso().slice(0, iso.length)) return { error: "That's in the future" };
  return { iso };
}

/** Today as yyyy-mm-dd in local time, for the picker's max and future checks. */
export function todayIso(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/**
 * Card/table line for a person's lifespan. Deceased people read as a year
 * range; living people show their birth date, which is what the family
 * actually looks for. Spelled out ("16 Oct 1963") so it can't be misread as
 * day/month or month/day.
 */
export function lifeDates(dob: string, dod: string): string {
  if (!dob) return '';
  return dod ? `${year(dob)} – ${year(dod)}` : `D.O.B – ${shortDate(dob)}`;
}

/** Long-form span for the profile hero: `15 April 1912 – 20 November 1984`. */
export function lifeSpanLong(dob: string, dod: string): string {
  if (!dob) return '';
  return dod ? `${fmtDate(dob)} – ${fmtDate(dod)}` : `Born ${fmtDate(dob)}`;
}

export function ageLabel(dob: string, dod: string): string {
  if (!dob) return '';
  const by = Number(year(dob));
  if (dod) {
    const dy = Number(year(dod));
    return `Lived ${dy - by} yrs`;
  }
  const now = new Date().getFullYear();
  return `Age ${now - by}`;
}

export function mdate(date: string): string {
  if (!date) return '';
  return 'm. ' + date;
}
