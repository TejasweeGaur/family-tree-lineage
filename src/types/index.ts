export type Gender = 'Male' | 'Female' | 'Other';

export interface Archive {
  id: string;
  title: string;
  year: string;
  category: string;
  desc: string;
  origin: string;
}

export interface MediaItem {
  id: string;
  title: string;
  type: 'Photo' | 'Video Clip';
  size: string;
  url?: string;
}

export interface Person {
  id: string;
  first: string;
  last: string;
  maiden: string;
  gender: Gender;
  dob: string;
  pob: string;
  dod: string;
  pod: string;
  occupation: string;
  residency: string;
  /** Lineage clan identifier, inherited by children and siblings. */
  gotra: string;
  /** Sect / shasan affiliation, inherited alongside gotra. */
  shasan: string;
  label: string;
  bio: string;
  archives: Archive[];
  media: MediaItem[];
  sample: boolean;
  photoUrl?: string;
  /** Origin family — free text for married-in people whose parents aren't drawn in the tree. */
  originFather: string;
  originFatherDates: string;
  originMother: string;
  originMotherDates: string;
}

export interface Union {
  id: string;
  a: string | null;
  b: string | null;
  date: string;
  place: string;
  children: string[];
}

export interface Tree {
  id: string;
  name: string;
  originNotes: string;
}

/** Membership role. Authoritative value comes from the server; never from a query param. */
export type Role = 'admin' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  pictureUrl?: string;
}

export interface Session {
  user: User;
  role: Role;
}

export interface Invite {
  token: string;
  treeId: string;
  role: Role;
  createdAt: string;
  revokedAt?: string;
}

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
}

export interface LayoutLink {
  /** Union this segment belongs to — drives branch-highlight hit testing. */
  uid: string;
  d: string;
  stroke: string;
  w: number;
  hidden: boolean;
}

export interface LayoutConn {
  x: number;
  y: number;
  w: number;
  date: string;
  hasDate: boolean;
  showAdd: boolean;
  opacity: number;
  unionId: string;
  personA: string;
  personB: string | null;
}

export interface LayoutPill {
  x: number;
  y: number;
  label: string;
  rot: string;
  opacity: number;
  unionId: string;
  collapsed: boolean;
  count: number;
}

export interface LayoutExtra {
  x: number;
  y: number;
  w: number;
  targetId: string;
}

/** Invisible wide stroke laid over a connector so it can be clicked. */
export interface LayoutHit {
  uid: string;
  d: string;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  links: LayoutLink[];
  hits: LayoutHit[];
  conns: LayoutConn[];
  pills: LayoutPill[];
  extras: LayoutExtra[];
  w: number;
  h: number;
}

export type PanelTab = 'archives' | 'family' | 'bio';
export type ViewMode = 'tree' | 'directory';
export type PanelMode = 'drawer' | 'modal';
export type CanvasMode = 'scroll' | 'drag';

export type FormGroup = 'child' | 'spouse' | 'parent' | 'sibling' | 'root';

export interface FormValues {
  first: string;
  last: string;
  maiden: string;
  gender: Gender;
  living: boolean;
  dob: string;
  pob: string;
  dod: string;
  pod: string;
  occupation: string;
  residency: string;
  gotra: string;
  shasan: string;
  label: string;
  bio: string;
  mdate: string;
  mplace: string;
}

export interface FormState {
  mode: 'add' | 'edit';
  targetId: string;
  group: FormGroup;
  bioTab: 'write' | 'preview';
  values: FormValues;
}

export interface ArchiveFormState {
  targetId: string;
  title: string;
  category: string;
  year: string;
  origin: string;
  notes: string;
  file: string;
}

export type DirSortKey = 'name' | 'dob' | 'label';

/** The eight relations offerable from the add-relative menu and Add Member dialog. */
export type RelativeKind =
  | 'Son' | 'Daughter'
  | 'Husband' | 'Wife'
  | 'Father' | 'Mother'
  | 'Brother' | 'Sister';

/** Two-step Add Member dialog: pick an anchor person, then the relation. */
export interface AddDialogState {
  anchorId: string;
  kind: RelativeKind | null;
}

/** A resolved kinship answer: the label plus the walked path between two people. */
export interface KinResult {
  label: string;
  path: string[];
}

export interface ViewerRecord {
  title: string;
  sub: string;
  kind: string;
  url?: string;
}
