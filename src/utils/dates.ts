const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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

/**
 * `16/10/1963`, `10/1963` or `1963`, depending on how much of the date is
 * known. Day first, the way the family reads and writes dates.
 */
export function shortDate(d: string): string {
  if (!d) return '';
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(d);
  if (!m) return d;
  const [, y, mo, dd] = m;
  if (dd) return `${dd}/${mo}/${y}`;
  if (mo) return `${mo}/${y}`;
  return y;
}

// ---------------------------------------------------------------- entry

/**
 * Stored dates are ISO and may be partial: `1963-10-16`, `1963-10` or `1963`,
 * since families often know only the month or the year. People type them as
 * dd/mm/yyyy, mm/yyyy or yyyy; these convert between the two.
 */
export function toEntryText(iso: string): string {
  return shortDate(iso);
}

export type ParsedDate = { iso: string } | { error: string };

export const DATE_FORMAT_HINT = 'Use dd/mm/yyyy, mm/yyyy or yyyy';

export function parseEntryText(text: string, opts: { noFuture?: boolean } = {}): ParsedDate {
  const t = text.trim();
  if (!t) return { iso: '' };
  // Accept any separator, so 16-10-1963 and 16.10.1963 work as well.
  const parts = t.split(/[^0-9]+/).filter(Boolean);
  let y: number, mo = 0, d = 0;
  if (parts.length === 1 && parts[0].length === 4) {
    y = Number(parts[0]);
  } else if (parts.length === 2 && parts[1].length === 4) {
    mo = Number(parts[0]); y = Number(parts[1]);
  } else if (parts.length === 3 && parts[2].length === 4) {
    d = Number(parts[0]); mo = Number(parts[1]); y = Number(parts[2]);
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

/**
 * Whole years between birth and death (or today). Null when the birth year
 * isn't known; a partial date counts from the start of its month or year.
 */
export function ageYears(dob: string, dod: string): number | null {
  const b = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(dob);
  if (!b) return null;
  const end = dod ? /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(dod) : null;
  if (dod && !end) return null;
  const now = new Date();
  const [ey, em, ed] = end
    ? [Number(end[1]), Number(end[2] || 12), Number(end[3] || 31)]
    : [now.getFullYear(), now.getMonth() + 1, now.getDate()];
  const [by, bm, bd] = [Number(b[1]), Number(b[2] || 1), Number(b[3] || 1)];
  let age = ey - by;
  if (em < bm || (em === bm && ed < bd)) age -= 1;
  return age >= 0 ? age : null;
}
