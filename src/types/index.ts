export type Gender = 'Male' | 'Female' | 'Other';

export interface Archive {
  id: string;
  title: string;
  year: string;
  category: string;
  desc: string;
  origin: string;
  /**
   * Storage path, bucket-prefixed: "archives/<treeId>/<personId>/<file>".
   * A path and not a URL — both buckets are private, so URLs are signed at
   * render time and expire. Persisting a signed URL would rot silently.
   */
  filePath?: string;
  fileName?: string;
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
  /** Ancestral town or village. Free text — historic names rarely match modern ones. */
  originPlace: string;
  originCountry: string;
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
  /**
   * The tree this user belongs to, or null when they are authenticated but hold
   * no membership yet. Null is a first-run state, not a rejection: the app
   * offers to create an archive. Distinguishing it from a null Session (not
   * signed in at all) is what keeps those two screens apart.
   */
  treeId: string | null;
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
  /**
   * Either an existing stored path (unchanged) or a new `data:` URL just
   * picked. Only `data:` values are uploaded on save, so re-saving a profile
   * without touching the picture doesn't re-upload it.
   */
  photo: string;
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
  /** Display name of the chosen file. */
  file: string;
  /** The actual file to upload; null until one is picked. */
  fileData: File | null;
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
  /** Stored object path; resolved to a signed URL when the viewer opens. */
  url?: string;
  fileName?: string;
}
