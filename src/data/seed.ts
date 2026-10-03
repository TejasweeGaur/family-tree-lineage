import type { Person, Union, Gender } from '../types';

// ---------------------------------------------------------------------------
// DEMO FIXTURES — ENTIRELY FICTIONAL.
//
// Every name, date, place, biography and archive record below is invented.
// None of it describes a real person. It exists only so the app has something
// to render before a Supabase project is connected; real family data lives in
// Postgres and never in this file.
//
// The roster is shaped to exercise every feature: four generations, a living
// and a deceased spouse, middle names, married-in people with origin families
// that stay off the canvas, inherited gotra/shasan, markdown biographies,
// attached archives and media, and unions with and without a recorded date.
// ---------------------------------------------------------------------------

export const ARCHIVE_CATEGORIES = [
  'Historical Photograph / Portrait',
  'Birth Certificate',
  'Marriage Certificate',
  'Land Deed / Property Record',
  'Military Discharge',
  'Letter / Correspondence',
  'Horoscope / Kundli',
  'Other',
];

/** Terse constructor so the roster below stays readable as a table. */
function P(
  id: string, first: string, last: string, gender: Gender,
  dob: string, pob: string, dod: string, pod: string,
  occupation: string, residency: string, label: string, middle = '',
): Person {
  return {
    id, first, last, gender, dob, pob, dod, pod,
    occupation, residency, label, middle,
    gotra: '', shasan: '',
    bio: '', archives: [], media: [],
    sample: first === 'Child' || first === 'Spouse' || first === 'Parent',
    originFather: '', originFatherDates: '', originMother: '', originMotherDates: '',
  };
}

const persons: Person[] = [
  P('p1', 'Hari Prasad', 'Sharma', 'Male', '1915-03-22', 'Varanasi', '1987-09-14', 'New Delhi', 'Classical Scholar & Sanskritist', 'Varanasi', 'Ancestral Patriarch'),
  P('p2', 'Sushila', 'Sharma', 'Female', '1921-11-05', 'Kanpur', '1998-01-19', 'New Delhi', 'Educator & Community Philanthropist', 'Kanpur', 'Ancestral Matriarch', 'Joshi'),
  P('p3', 'Dr. Vinod Kumar', 'Sharma', 'Male', '1943-06-08', 'Varanasi', '2016-04-27', 'Jaipur', 'Physician & Ayurvedic Researcher', 'Jaipur', 'Son'),
  P('p4', 'Kamini', 'Sharma', 'Female', '1948-02-17', 'Jaipur', '', '', 'Textile Conservator', 'Jaipur', 'Daughter-in-law', 'Bhatt'),
  P('p5', 'Rajendra', 'Sharma', 'Male', '1946-10-12', 'Varanasi', '2019-12-03', 'Lucknow', 'Civil Engineer', 'Lucknow', 'Son'),
  P('p6', 'Spouse', 'A', 'Female', '1951-05-02', 'Lucknow', '', '', 'Sample occupation', 'Lucknow', 'Daughter-in-law'),
  P('p7', 'Child', 'A', 'Male', '1970-03-14', 'Jaipur', '', '', 'Sample occupation', 'Delhi', 'Grandson'),
  P('p8', 'Child', 'B', 'Female', '1973-08-24', 'Jaipur', '', '', 'Sample occupation', 'Pune', 'Granddaughter'),
  P('p9', 'Child', 'C', 'Male', '1977-12-03', 'Jaipur', '', '', 'Sample occupation', 'Jaipur', 'Grandson'),
  P('p10', 'Child', 'D', 'Female', '1974-06-17', 'Lucknow', '', '', 'Sample occupation', 'Lucknow', 'Granddaughter'),
  P('p11', 'Child', 'E', 'Male', '1979-10-29', 'Lucknow', '', '', 'Sample occupation', 'Bengaluru', 'Grandson'),
  P('p12', 'Spouse', 'B', 'Female', '1972-03-08', 'Delhi', '', '', 'Sample occupation', 'Delhi', 'Married in'),
  P('p13', 'Spouse', 'C', 'Female', '1980-07-19', 'Jaipur', '', '', 'Sample occupation', 'Jaipur', 'Married in'),
  P('p14', 'Spouse', 'D', 'Male', '1971-01-30', 'Kanpur', '', '', 'Sample occupation', 'Lucknow', 'Married in'),
  P('p15', 'Child', 'F', 'Male', '1998-04-06', 'Delhi', '', '', 'Sample occupation', 'Delhi', 'Great-grandson'),
  P('p16', 'Child', 'G', 'Female', '2001-09-21', 'Delhi', '', '', 'Sample occupation', 'Mumbai', 'Great-granddaughter'),
  P('p17', 'Child', 'H', 'Female', '2007-02-14', 'Jaipur', '', '', '', 'Jaipur', 'Great-granddaughter'),
  P('p18', 'Child', 'I', 'Male', '2002-11-11', 'Lucknow', '', '', 'Sample occupation', 'Lucknow', 'Great-grandson'),
  P('p19', 'Child', 'J', 'Female', '2006-05-27', 'Lucknow', '', '', '', 'Lucknow', 'Great-granddaughter'),
  P('p20', 'Spouse', 'E', 'Female', '1999-08-15', 'Mumbai', '', '', 'Sample occupation', 'Delhi', 'Married in'),
  P('p21', 'Child', 'K', 'Male', '2025-01-09', 'Delhi', '', '', '', 'Delhi', 'Great-great-grandson'),
];

const byId: Record<string, Person> = {};
persons.forEach(p => { byId[p.id] = p; });

// Gotra / shasan travel down the blood line; married-in people carry their own.
const LINEAGE: Record<string, [string, string]> = {
  p1: ['Bharadwaj', 'Vaishnav'], p2: ['Kashyap', 'Vaishnav'],
  p3: ['Bharadwaj', 'Vaishnav'], p4: ['Vatsa', 'Vaishnav'],
  p5: ['Bharadwaj', 'Vaishnav'], p7: ['Bharadwaj', 'Vaishnav'],
  p9: ['Bharadwaj', 'Vaishnav'], p10: ['Bharadwaj', 'Vaishnav'],
  p15: ['Bharadwaj', 'Vaishnav'],
};
Object.entries(LINEAGE).forEach(([id, [gotra, shasan]]) => {
  byId[id].gotra = gotra;
  byId[id].shasan = shasan;
});

// Married-in people: their parents are recorded but never drawn in the tree.
const ORIGIN: Record<string, [string, string, string, string]> = {
  p4: ['Mohan Lal Bhatt', '1920 – 1991', 'Leela Bhatt', '1926 – 2004'],
  p6: ['Parent A1', '1923 – 1996', 'Parent A2', '1928 – 2003'],
  p12: ['Parent B1', '1945 – 2013', 'Parent B2', '1949 – 2020'],
  p13: ['Parent C1', '1952 – 2018', 'Parent C2', 'b. 1956'],
  p14: ['Parent D1', '1943 – 2008', 'Parent D2', '1947 – 2015'],
  p20: ['Parent E1', 'b. 1971', 'Parent E2', 'b. 1974'],
};
Object.entries(ORIGIN).forEach(([id, [f, fd, m, md]]) => {
  byId[id].originFather = f;
  byId[id].originFatherDates = fd;
  byId[id].originMother = m;
  byId[id].originMotherDates = md;
});

byId.p1.bio = `### The Varanasi years
Born into a lineage of temple scholars, **Hari Prasad Sharma** spent his first three decades in Varanasi, where he catalogued palm-leaf manuscripts for the district library.

### Scholarship
He published two commentaries on classical grammar and taught for thirty-one years.

- Sanskrit Academy fellow, 1960
- District library manuscript survey, 1941–1947

> *"A family keeps its language the way it keeps its land: by working it every season."*

He moved to New Delhi in 1964 and remained there until his death in 1987.`;

byId.p2.bio = `### Kanpur to Varanasi
**Sushila Sharma**, born Sushila Joshi, trained as a teacher in Kanpur and founded a girls' reading circle that ran for four decades.`;

byId.p1.archives = [
  { id: 'a1', title: 'Land Deed — Varanasi Estate', year: '1941', category: 'Land Deed / Property Record', desc: 'Registered transfer of ancestral farmland on the eastern bank, witnessed by the village registrar.', origin: 'Varanasi District Registry' },
  { id: 'a2', title: 'Letter to the Sanskrit Academy', year: '1960', category: 'Letter / Correspondence', desc: 'Two-page handwritten letter accepting the fellowship, with notes on the manuscript survey.', origin: 'Family collection' },
  { id: 'a3', title: 'Birth Certificate', year: '1915', category: 'Birth Certificate', desc: 'Municipal record of birth issued in Varanasi, recording parents and registry entry.', origin: 'Varanasi Municipality' },
];
byId.p2.archives = [
  { id: 'a4', title: 'Marriage Certificate', year: '1939', category: 'Marriage Certificate', desc: 'Certificate of the April 1939 marriage, filed in Varanasi.', origin: 'Varanasi District Registry' },
];

byId.p1.media = [
  { id: 'm1', title: 'Portrait, Varanasi', type: 'Photo', size: '2.4 MB' },
  { id: 'm2', title: 'Convocation address', type: 'Video Clip', size: '18.6 MB' },
  { id: 'm3', title: 'Family gathering, 1965', type: 'Photo', size: '3.1 MB' },
];
byId.p2.media = [
  { id: 'm4', title: 'Reading circle, Kanpur', type: 'Photo', size: '1.8 MB' },
];

const unions: Union[] = [
  { id: 'u1', a: 'p1', b: 'p2', date: '1939-04-18', place: 'Varanasi', children: ['p3', 'p5'] },
  { id: 'u2', a: 'p3', b: 'p4', date: '1968-02-11', place: 'Jaipur', children: ['p7', 'p8', 'p9'] },
  { id: 'u3', a: 'p5', b: 'p6', date: '', place: '', children: ['p10', 'p11'] },
  { id: 'u4', a: 'p7', b: 'p12', date: '1996-02-14', place: 'Delhi', children: ['p15', 'p16'] },
  { id: 'u5', a: 'p9', b: 'p13', date: '2005-11-30', place: 'Jaipur', children: ['p17'] },
  { id: 'u6', a: 'p10', b: 'p14', date: '2000-05-22', place: 'Lucknow', children: ['p18', 'p19'] },
  { id: 'u7', a: 'p15', b: 'p20', date: '2023-10-09', place: 'Delhi', children: ['p21'] },
];

export const SEED_PERSONS = persons;
export const SEED_UNIONS = unions;
export const SEED_ROOT_ID = 'p1';
export const SEED_TREE_NAME = 'Sharma';
