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

export function shortDate(d: string): string {
  if (!d) return '';
  if (d.length === 4) return d;
  const parts = d.split('-');
  const y = parts[0], m = parts[1], dd = parts[2];
  return String(Number(dd)) + ' ' + MONTHS_SHORT[Number(m) - 1] + ' ' + y;
}

/** `30/09/46` — the compact DD/MM/YY form used for living people on cards. */
export function dmy(d: string): string {
  if (!d) return '';
  if (d.length === 4) return d;
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y.slice(2)}`;
}

/**
 * Card/table line for a person's lifespan. Deceased people read as a year
 * range; living people show their full birth date, which is what the family
 * actually looks for.
 */
export function lifeDates(dob: string, dod: string): string {
  if (!dob) return '';
  return dod ? `${year(dob)} – ${year(dod)}` : `D.O.B - ${dmy(dob)}`;
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
