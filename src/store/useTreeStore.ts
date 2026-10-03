import { create } from 'zustand';
import type {
  Person, Union, Tree, Invite, Session, Role, Member,
  PanelTab, ViewMode, PanelMode, CanvasMode,
  FormState, FormValues, ArchiveFormState, Archive, MediaItem, DirSortKey, Gender,
  RelativeKind, AddDialogState, ViewerRecord,
} from '../types';
import { SEED_PERSONS, SEED_UNIONS, SEED_ROOT_ID, SEED_TREE_NAME } from '../data/seed';
import { spousesOf, parentsOf, unionsOf, childrenOf, getRoot, fullName } from '../utils/kinship';
import { computeLayout } from '../utils/layout';
import { repo } from '../data/repository';
import { rememberTree } from '../utils/lastTree';
import { runTour, markTourSeen } from '../utils/tour';
import { ARCHIVE_MAX_BYTES, formatBytes } from '../config/limits';
import { readScaledPhoto } from '../utils/image';
import { exportPeopleCsv, templateCsv, planImport, type ImportPlan } from '../utils/csv';
import { triggerDownload } from '../utils/export';

/**
 * The user whose tree is already loaded (or loading). Supabase re-emits
 * SIGNED_IN on tab focus and after redirects; without this guard each one
 * reloaded the tree and collapsed every branch the user had opened.
 */
let loadedFor: string | null = null;

const initialCollapsed: Record<string, boolean> = {};
SEED_UNIONS.forEach(u => { if (u.id !== 'u1') initialCollapsed[u.id] = true; });

interface FilterState {
  q: string;
  gender: string;
  status: string;
  from: string;
  to: string;
  showRelatives: boolean;
}

const EMPTY_FILTERS: FilterState = {
  q: '', gender: 'All', status: 'All', from: '', to: '', showRelatives: true,
};

interface AppState {
  // Session
  session: Session | null;
  authReady: boolean;
  signingIn: boolean;
  creatingTree: boolean;
  authError: string;
  pendingInvite: string | null;

  // Trees
  trees: Tree[];
  activeTreeId: string;
  rootId: string;
  /**
   * Per-tree snapshots, parked on switch. Demo mode restores from here because
   * LocalRepository holds no per-tree data; Supabase re-reads instead.
   */
  treeCache: Record<string, { persons: Person[]; unions: Union[]; rootId: string; collapsed: Record<string, boolean> }>;

  // People & relationships
  persons: Person[];
  unions: Union[];
  collapsed: Record<string, boolean>;

  // View
  view: ViewMode;
  zoom: number;
  mode: CanvasMode;

  // Selection
  focus: string | null;
  /** Union id whose descendant lineage is highlighted; null when off. */
  branch: string | null;
  panel: string | null;
  panelTab: PanelTab;
  panelMode: PanelMode;
  /** Person the canvas should scroll to; cleared once TreeCanvas consumes it. */
  revealTarget: string | null;

  // Filters
  filters: FilterState;
  showFilters: boolean;

  // Menus
  dataMenu: boolean;
  treeMenu: boolean;
  exportMenu: boolean;
  userMenu: boolean;
  searchOpen: boolean;
  plusMenu: string | null;
  plusPos: { x: number; y: number };

  // Forms & dialogs
  form: FormState | null;
  /** True while a person write is in flight; blocks double-submit. */
  savingForm: boolean;
  archiveForm: ArchiveFormState | null;
  /** True while an archive record (and any file) is being written. */
  savingArchive: boolean;
  /** Gallery upload progress: photos done out of total, or null when idle. */
  mediaUpload: { done: number; total: number } | null;
  addDialog: AddDialogState | null;
  /** Person queued for deletion, shown in the confirm dialog. */
  confirmDeleteId: string | null;
  inviteOpen: boolean;
  inviteRole: Role;
  /** Empty until an invite is actually minted and stored. */
  inviteToken: string;
  creatingInvite: boolean;
  inviteError: string;
  copied: boolean;
  newTreeOpen: boolean;
  viewerRecord: ViewerRecord | null;
  /** When the active tree last changed; drives the footer. Null if unknown. */
  treeUpdatedAt: string | null;
  aboutOpen: boolean;
  onThisDayOpen: boolean;
  members: Member[];
  membersLoading: boolean;
  deleteTreeOpen: boolean;
  deletingTree: boolean;
  /** Full-screen profile photo viewer: the stored path plus whose it is. */
  photoView: { stored: string; name: string } | null;
  /** A parsed, validated CSV awaiting confirmation. Nothing is written yet. */
  csvPlan: (ImportPlan & { fileName: string }) | null;
  csvImporting: boolean;

  // Directory
  dirSort: DirSortKey;
  dirSortAsc: boolean;

  invites: Invite[];

  // UI
  headerQ: string;
  notice: string;
  winW: number;
  kinTarget: string;
}

function nid(): string {
  return 'n' + Math.random().toString(36).slice(2, 8);
}

function groupOf(kind: string): FormState['group'] {
  if (['Son', 'Daughter', 'Child'].includes(kind)) return 'child';
  if (['Wife', 'Husband'].includes(kind)) return 'spouse';
  if (['Father', 'Mother'].includes(kind)) return 'parent';
  if (['Brother', 'Sister'].includes(kind)) return 'sibling';
  return 'root';
}

function genderOf(kind: string): Gender {
  if (['Son', 'Husband', 'Father', 'Brother'].includes(kind)) return 'Male';
  if (['Daughter', 'Wife', 'Mother', 'Sister'].includes(kind)) return 'Female';
  return 'Other';
}

function kindLabel(group: string, gender: Gender): string {
  const map: Record<string, [string, string, string]> = {
    child: ['Son', 'Daughter', 'Child'],
    spouse: ['Husband', 'Wife', 'Spouse'],
    parent: ['Father', 'Mother', 'Parent'],
    sibling: ['Brother', 'Sister', 'Sibling'],
    root: ['Ancestor', 'Ancestor', 'Ancestor'],
  };
  const m = map[group] || ['Relative', 'Relative', 'Relative'];
  return gender === 'Male' ? m[0] : gender === 'Female' ? m[1] : m[2];
}

function emptyValues(): FormValues {
  return {
    first: '', last: '', middle: '', gender: 'Other', living: true,
    dob: '', pob: '', dod: '', pod: '',
    occupation: '', residency: '', gotra: '', shasan: '',
    label: '', bio: '', mdate: '', mplace: '', photo: '',
  };
}

type Store = AppState & {
  // Auth
  initAuth: () => Promise<void>;
  loadActiveTree: (treeId: string) => Promise<void>;
  createFirstTree: (name: string, place: string, country: string) => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: () => boolean;
  toggleDemoRole: () => void;

  // Canvas
  toggleUnion: (uid: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setView: (v: ViewMode) => void;
  setZoom: (z: number) => void;
  setMode: (m: CanvasMode) => void;
  setFocus: (id: string | null) => void;
  setBranch: (uid: string | null) => void;
  consumeReveal: () => void;

  openPanel: (id: string, tab?: PanelTab) => void;
  closePanel: () => void;
  togglePanelMode: () => void;
  setPanelTab: (tab: PanelTab) => void;

  // Filters
  setFilter: <K extends keyof FilterState>(key: K, val: FilterState[K]) => void;
  clearFilters: () => void;
  toggleFilters: () => void;
  toggleRelatives: () => void;

  // Menus
  setDataMenu: (v: boolean) => void;
  setTreeMenu: (v: boolean) => void;
  setExportMenu: (v: boolean) => void;
  setUserMenu: (v: boolean) => void;
  setSearchOpen: (v: boolean) => void;
  setPlusMenu: (id: string | null, pos?: { x: number; y: number }) => void;
  closeAllMenus: () => void;
  closeHeaderMenus: () => void;

  // Add Member dialog
  openAddDialog: (anchorId?: string) => void;
  setAddAnchor: (id: string) => void;
  setAddKind: (k: RelativeKind) => void;
  closeAddDialog: () => void;
  confirmAddDialog: () => void;

  // Forms
  openAdd: (targetId: string, kind: string) => void;
  openEdit: (id: string) => void;
  closeForm: () => void;
  setFormValue: <K extends keyof FormValues>(key: K, val: FormValues[K]) => void;
  setBioTab: (tab: 'write' | 'preview') => void;
  saveForm: () => Promise<void>;

  // Delete
  askDelete: (id: string) => void;
  cancelDelete: () => void;
  doDelete: () => void;

  // Photo
  setPhoto: (id: string, dataUrl: string | null) => void;

  // Archives
  /** Pass `archiveId` to edit an existing record instead of adding one. */
  openArchiveForm: (id: string, archiveId?: string) => void;
  closeArchiveForm: () => void;
  setArchiveField: <K extends keyof Omit<ArchiveFormState, 'targetId'>>(key: K, val: ArchiveFormState[K]) => void;
  saveArchive: () => Promise<void>;
  deleteArchive: (personId: string, archiveId: string) => Promise<void>;
  unlinkSpouse: (personId: string, spouseId: string) => Promise<void>;
  exportCsv: () => void;
  downloadCsvTemplate: () => void;
  openCsvImport: (file: File) => Promise<void>;
  closeCsvImport: () => void;
  runCsvImport: () => Promise<void>;
  addMediaPhotos: (personId: string, files: File[]) => Promise<void>;
  deleteMedia: (personId: string, mediaId: string) => Promise<void>;

  // Viewer
  openViewer: (record: ViewerRecord) => void;
  closeViewer: () => void;
  setAboutOpen: (v: boolean) => void;
  setOnThisDayOpen: (v: boolean) => void;
  startTour: () => void;
  /** True for the tree's creator, who alone can delete it. */
  isOwner: () => boolean;
  loadMembers: () => Promise<void>;
  setMemberRole: (userId: string, role: Role) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  setDeleteTreeOpen: (v: boolean) => void;
  deleteActiveTree: () => Promise<void>;
  /** After losing access to the active tree: open another, or the first-run screen. */
  moveToNextTree: () => Promise<void>;
  openPhotoView: (stored: string, name: string) => void;
  closePhotoView: () => void;

  // Invites
  setInviteOpen: (v: boolean) => void;
  setInviteRole: (r: Role) => void;
  loadInvites: () => Promise<void>;
  createInviteLink: () => Promise<void>;
  revokeInviteToken: (token: string) => Promise<void>;
  redeemPendingInvite: () => Promise<void>;
  setCopied: (v: boolean) => void;
  inviteUrl: () => string;

  // Trees
  setNewTreeOpen: (v: boolean) => void;
  createTree: (name: string, place: string, country: string) => Promise<void>;
  switchTree: (id: string) => Promise<void>;

  setHeaderQ: (q: string) => void;
  setDirSort: (k: DirSortKey) => void;
  setKinTarget: (id: string) => void;
  setNotice: (msg: string) => void;
  setWinW: (w: number) => void;

  // Computed
  getLayout: () => ReturnType<typeof computeLayout>;
  getMatchSet: () => Record<string, boolean | 'rel'> | null;
  getPersonById: (id: string) => Person | undefined;
  unionIdsWithChildren: () => string[];
};

export const useTreeStore = create<Store>((set, get) => ({
  session: null,
  authReady: false,
  signingIn: false,
  creatingTree: false,
  authError: '',
  pendingInvite: null,

  trees: [{ id: 't1', name: SEED_TREE_NAME, originPlace: 'Varanasi', originCountry: 'India' }],
  activeTreeId: 't1',
  rootId: SEED_ROOT_ID,
  treeCache: {},

  persons: SEED_PERSONS,
  unions: SEED_UNIONS,
  collapsed: initialCollapsed,

  view: 'tree',
  zoom: 1,
  mode: 'scroll',

  focus: null,
  branch: null,
  panel: null,
  panelTab: 'archives',
  panelMode: 'modal',
  revealTarget: null,

  filters: { ...EMPTY_FILTERS },
  showFilters: false,

  dataMenu: false,
  treeMenu: false,
  exportMenu: false,
  userMenu: false,
  searchOpen: false,
  plusMenu: null,
  plusPos: { x: 0, y: 0 },

  form: null,
  savingForm: false,
  archiveForm: null,
  savingArchive: false,
  mediaUpload: null,
  addDialog: null,
  confirmDeleteId: null,
  inviteOpen: false,
  inviteRole: 'viewer',
  inviteToken: '',
  creatingInvite: false,
  inviteError: '',
  copied: false,
  newTreeOpen: false,
  viewerRecord: null,
  treeUpdatedAt: null,
  aboutOpen: false,
  onThisDayOpen: false,
  members: [],
  membersLoading: false,
  deleteTreeOpen: false,
  deletingTree: false,
  photoView: null,
  csvPlan: null,
  csvImporting: false,

  dirSort: 'dob',
  dirSortAsc: true,
  invites: [],

  headerQ: '',
  notice: '',
  winW: typeof window !== 'undefined' ? window.innerWidth : 1440,
  kinTarget: SEED_PERSONS[1]?.id || '',

  // ---------------------------------------------------------------- auth

  initAuth: async () => {
    // An invite token in the URL decides the role the session is created with.
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    if (invite) set({ pendingInvite: invite });

    // The store is seeded with demo fixtures for local mode. Against Supabase
    // that would briefly show one family's data to another, so clear it first.
    if (repo.kind === 'supabase') {
      set({ persons: [], unions: [], rootId: '', trees: [], activeTreeId: '', collapsed: {} });
    }

    const session = await repo.getSession();
    set({ session, authReady: true });

    repo.onAuthChange((event, s) => {
      if (event === 'SIGNED_OUT') {
        loadedFor = null;
        set({ session: null });
        return;
      }
      if (!s || repo.kind !== 'supabase') { set({ session: s }); return; }
      if (s.user.id === loadedFor) return; // already loaded: tab focus, redirect echo
      loadedFor = s.user.id;
      set({ session: s });
      // An invite has to be redeemed before loading: until the membership row
      // exists, RLS returns nothing and the tree looks empty.
      if (get().pendingInvite) void get().redeemPendingInvite();
      else if (s.treeId) void get().loadActiveTree(s.treeId);
    });

    if (repo.kind === 'supabase' && session) {
      // Claimed before awaiting, so a SIGNED_IN arriving mid-load is ignored.
      loadedFor = session.user.id;
      if (get().pendingInvite) await get().redeemPendingInvite();
      else if (session.treeId) await get().loadActiveTree(session.treeId);
    }
  },

  loadActiveTree: async (treeId: string) => {
    try {
      const [snap, memberships] = await Promise.all([
        repo.loadTree(treeId),
        repo.kind === 'supabase' ? repo.listMemberships() : Promise.resolve(null),
      ]);
      const collapsed: Record<string, boolean> = {};
      snap.unions.forEach(u => { if (u.a !== snap.rootId && u.b !== snap.rootId) collapsed[u.id] = true; });

      const uid = get().session?.user.id;
      if (uid) rememberTree(uid, snap.treeId);
      // Role is per tree: being an admin of one family's tree says nothing about
      // another. It was previously taken from one membership and applied to all.
      const role = memberships?.find(m => m.id === snap.treeId)?.role;

      set(s => ({
        persons: snap.persons, unions: snap.unions, rootId: snap.rootId,
        activeTreeId: snap.treeId, collapsed,
        treeUpdatedAt: snap.updatedAt ?? null,
        // Every tree the user belongs to, so the switcher can reach them all.
        trees: memberships?.length
          ? memberships
          : [{ id: snap.treeId, name: snap.treeName, originPlace: snap.originPlace, originCountry: snap.originCountry }],
        session: s.session
          ? { ...s.session, treeId: snap.treeId, role: role ?? s.session.role }
          : s.session,
      }));
    } catch (e) {
      set({ notice: e instanceof Error ? e.message : 'Could not load the family tree.' });
    }
  },


  /**
   * First-run bootstrap: an authenticated user with no membership creates their
   * own archive and becomes its admin. Starts empty — no seed data is copied in.
   */
  createFirstTree: async (name: string, place: string, country: string) => {
    set({ creatingTree: true, authError: '' });
    try {
      const treeId = await repo.createTree(name, place, country);
      const uid = get().session?.user.id;
      if (uid) rememberTree(uid, treeId);
      set(s => ({
        session: s.session ? { ...s.session, treeId, role: 'admin' } : s.session,
        activeTreeId: treeId,
        persons: [], unions: [], rootId: '', collapsed: {},
        trees: [{ id: treeId, name, originPlace: place, originCountry: country }],
        treeUpdatedAt: new Date().toISOString(),
      }));
    } catch (e) {
      set({ authError: e instanceof Error ? e.message : 'Could not create the archive.' });
    } finally {
      set({ creatingTree: false });
    }
  },

  signIn: async () => {
    set({ signingIn: true, authError: '' });
    try {
      const session = await repo.signInWithGoogle(get().pendingInvite ?? undefined);
      // Supabase redirects away and resolves null; the local repo returns a session.
      if (session) set({ session });
    } catch {
      set({ authError: 'Sign-in was cancelled or failed.' });
    } finally {
      set({ signingIn: false });
    }
  },

  signOut: async () => {
    await repo.signOut();
    loadedFor = null;
    set({ session: null, userMenu: false, panel: null, focus: null });
    // On a shared family computer the next person to sign in shouldn't have
    // the previous account's tree sitting in memory behind the sign-in screen.
    if (repo.kind === 'supabase') {
      set({ persons: [], unions: [], rootId: '', trees: [], activeTreeId: '', collapsed: {}, treeCache: {} });
    }
  },

  isAdmin: () => get().session?.role === 'admin',

  /**
   * Demo-only affordance so both roles are explorable without a second account.
   * With Supabase configured the role is authoritative and this is a no-op —
   * the header renders a read-only badge in that case.
   */
  toggleDemoRole: () => {
    if (repo.kind !== 'local') return;
    set(s => s.session
      ? { session: { ...s.session, role: s.session.role === 'admin' ? 'viewer' : 'admin' } }
      : {});
  },

  // ---------------------------------------------------------------- canvas

  toggleUnion: uid => set(s => ({ collapsed: { ...s.collapsed, [uid]: !s.collapsed[uid] } })),

  expandAll: () => set({ collapsed: {} }),

  /** Keep the root couple's union open so the tree never collapses to nothing. */
  collapseAll: () => {
    const { unions, persons, rootId } = get();
    const root = getRoot({ persons, unions }, rootId);
    const next: Record<string, boolean> = {};
    unions.forEach(u => {
      const isRootUnion = u.a === root || u.b === root;
      if (!isRootUnion) next[u.id] = true;
    });
    set({ collapsed: next });
  },

  setView: v => set({ view: v }),
  setZoom: z => set({ zoom: Math.min(1.8, Math.max(0.5, Math.round(z * 100) / 100)) }),
  setMode: m => set({ mode: m }),
  setFocus: id => set({ focus: id }),
  setBranch: uid => set(s => ({ branch: s.branch === uid ? null : uid })),
  consumeReveal: () => set({ revealTarget: null }),

  openPanel: (id, tab = 'archives') => set({
    panel: id, focus: id, panelTab: tab, plusMenu: null,
    headerQ: '', searchOpen: false,
  }),
  closePanel: () => set({ panel: null }),
  togglePanelMode: () => set(s => ({ panelMode: s.panelMode === 'drawer' ? 'modal' : 'drawer' })),
  setPanelTab: tab => set({ panelTab: tab }),

  // ---------------------------------------------------------------- filters

  setFilter: (key, val) => {
    set(s => ({ filters: { ...s.filters, [key]: val } }));
    // Typing a name should pull the first match into view, expanding on the way.
    if (key === 'q') {
      const q = String(val).trim().toLowerCase();
      if (!q) return;
      const { persons, unions } = get();
      const match = persons.find(p => `${p.first} ${p.middle} ${p.last}`.toLowerCase().includes(q));
      if (!match) return;
      // Open every union on the path from the root down to the match.
      const next = { ...get().collapsed };
      let cursor = match.id;
      for (let guard = 0; guard < 40; guard++) {
        const pu = unions.find(u => u.children.includes(cursor));
        if (!pu) break;
        next[pu.id] = false;
        cursor = (pu.a ?? pu.b) as string;
        if (!cursor) break;
      }
      set({ collapsed: next, revealTarget: match.id, focus: match.id });
    }
  },

  clearFilters: () => set({ filters: { ...EMPTY_FILTERS } }),
  toggleFilters: () => set(s => ({ showFilters: !s.showFilters, dataMenu: false, treeMenu: false, exportMenu: false, userMenu: false })),
  toggleRelatives: () => set(s => ({ filters: { ...s.filters, showRelatives: !s.filters.showRelatives } })),

  // ---------------------------------------------------------------- menus

  setDataMenu: v => set({ dataMenu: v, treeMenu: false, exportMenu: false, userMenu: false, showFilters: false }),
  setTreeMenu: v => set({ treeMenu: v, dataMenu: false, exportMenu: false, userMenu: false, showFilters: false }),
  setExportMenu: v => set({ exportMenu: v, dataMenu: false, treeMenu: false, userMenu: false, showFilters: false }),
  setUserMenu: v => set({ userMenu: v, dataMenu: false, treeMenu: false, exportMenu: false, showFilters: false }),
  setSearchOpen: v => set({ searchOpen: v }),
  setPlusMenu: (id, pos) => set({ plusMenu: id, plusPos: pos || { x: 0, y: 0 } }),
  closeAllMenus: () => set({
    dataMenu: false, treeMenu: false, exportMenu: false, userMenu: false,
    showFilters: false, plusMenu: null,
  }),
  /**
   * Header dropdowns only. The card's plus menu is deliberately excluded: the
   * header dismisses on `mousedown`, and clearing plusMenu there unmounted the
   * menu before its own click could land, so every item in it was dead.
   * PlusMenu handles its own outside-click.
   */
  closeHeaderMenus: () => set({
    dataMenu: false, treeMenu: false, exportMenu: false, userMenu: false,
    showFilters: false,
  }),

  // ---------------------------------------------------------------- add dialog

  openAddDialog: anchorId => {
    const { panel, focus, persons, rootId } = get();
    // An empty archive has nobody to relate a new person to. Asking "related to
    // whom, and how?" is unanswerable, and answering it anyway used to build a
    // union pointing at an empty id, which broke the layout walk.
    if (!persons.length) {
      set({ addDialog: null, plusMenu: null });
      get().openAdd('', 'Root');
      return;
    }
    const anchor = anchorId || panel || focus || rootId || persons[0]?.id || '';
    set({ addDialog: { anchorId: anchor, kind: null }, plusMenu: null });
  },
  setAddAnchor: id => set(s => s.addDialog ? { addDialog: { ...s.addDialog, anchorId: id } } : {}),
  setAddKind: k => set(s => s.addDialog ? { addDialog: { ...s.addDialog, kind: k } } : {}),
  closeAddDialog: () => set({ addDialog: null }),
  confirmAddDialog: () => {
    const { addDialog } = get();
    if (!addDialog?.kind) return;
    set({ addDialog: null });
    get().openAdd(addDialog.anchorId, addDialog.kind);
  },

  // ---------------------------------------------------------------- forms

  openAdd: (targetId, kind) => {
    const group = groupOf(kind);
    const gender = genderOf(kind);
    const p = get().persons.find(x => x.id === targetId);
    const inherits = group === 'child' || group === 'sibling';
    set({
      plusMenu: null, archiveForm: null, addDialog: null,
      form: {
        mode: 'add', targetId, group, bioTab: 'write',
        values: {
          ...emptyValues(),
          last: inherits ? (p?.last || '') : '',
          gender,
          living: group === 'child' || group === 'root',
          residency: p?.residency || '',
          gotra: inherits ? (p?.gotra || '') : '',
          shasan: inherits ? (p?.shasan || '') : '',
        },
      },
    });
  },

  openEdit: id => {
    const { persons, unions } = get();
    const p = persons.find(x => x.id === id);
    if (!p) return;
    const u = unionsOf({ persons, unions }, id)[0];
    set({
      plusMenu: null, archiveForm: null,
      form: {
        mode: 'edit', targetId: id, group: 'root', bioTab: 'write',
        values: {
          first: p.first, last: p.last, middle: p.middle, gender: p.gender,
          living: !p.dod, dob: p.dob, pob: p.pob, dod: p.dod, pod: p.pod,
          occupation: p.occupation, residency: p.residency,
          gotra: p.gotra, shasan: p.shasan,
          label: p.label, bio: p.bio,
          mdate: u?.date || '', mplace: u?.place || '',
          photo: p.photoUrl || '',
        },
      },
    });
  },

  closeForm: () => set({ form: null }),

  setFormValue: (key, val) => set(s =>
    s.form ? { form: { ...s.form, values: { ...s.form.values, [key]: val } } } : {}),

  setBioTab: tab => set(s => s.form ? { form: { ...s.form, bioTab: tab } } : {}),

  saveForm: async () => {
    const { form, persons, unions, collapsed, activeTreeId, savingForm } = get();
    if (!form || savingForm) return; // guard: the writes are awaited now
    const v = form.values;
    if (!v.first.trim() || !v.last.trim()) {
      set({ notice: 'First and last name are required.' });
      return;
    }

    const newUnions = unions.map(u => ({ ...u, children: [...u.children] }));
    const newCollapsed = { ...collapsed };

    if (form.mode === 'edit') {
      const prev = persons.find(p => p.id === form.targetId);
      let photoUrl = prev?.photoUrl;

      set({ savingForm: true });
      try {
        // Only touch storage when the picture actually changed, so re-saving a
        // profile doesn't upload the same image again.
        if (v.photo !== (prev?.photoUrl ?? '')) {
          photoUrl = (await repo.setPhoto(activeTreeId, form.targetId, v.photo || null)) ?? undefined;
        }
      } catch (e) {
        set({ savingForm: false, notice: e instanceof Error ? e.message : 'Could not save the photo.' });
        return;
      }

      const newPersons = persons.map(p => p.id === form.targetId
        ? {
            ...p,
            first: v.first, last: v.last, middle: v.middle, gender: v.gender,
            dob: v.dob, pob: v.pob,
            dod: v.living ? '' : v.dod, pod: v.living ? '' : v.pod,
            occupation: v.occupation, residency: v.residency,
            gotra: v.gotra, shasan: v.shasan,
            label: v.label, bio: v.bio, photoUrl,
          }
        : p);
      const u = newUnions.find(x => x.a === form.targetId || x.b === form.targetId);
      if (u) { u.date = v.mdate; u.place = v.mplace; }

      set({ persons: newPersons, unions: newUnions, form: null, savingForm: false, treeUpdatedAt: new Date().toISOString() });
      const edited = newPersons.find(p => p.id === form.targetId);
      try {
        if (edited) await repo.updatePerson(edited);
        if (u) await repo.updateUnion(u);
      } catch (e) {
        set({ notice: e instanceof Error ? e.message : 'Could not save those changes.' });
      }
      return;
    }

    const t = form.targetId;

    // Checked before anything is written: bailing out afterwards would strand a
    // person row in the database with no relationship to reach them by.
    if (form.group === 'parent' && t) {
      const pu = newUnions.find(x => x.children.includes(t));
      if (pu && pu.a && pu.b) {
        set({ notice: 'Both parents are already recorded.' });
        return;
      }
    }

    const cid = nid();
    const draft: Person = {
      id: cid, first: v.first, last: v.last, middle: v.middle, gender: v.gender,
      dob: v.dob, pob: v.pob, dod: v.living ? '' : v.dod, pod: v.living ? '' : v.pod,
      occupation: v.occupation, residency: v.residency,
      gotra: v.gotra, shasan: v.shasan,
      label: v.label || (form.group === 'spouse' ? 'Married in' : kindLabel(form.group, v.gender)),
      bio: v.bio, archives: [], media: [], sample: false,
      originFather: '', originFatherDates: '', originMother: '', originMotherDates: '',
    };

    set({ savingForm: true });
    try {
      // Order matters: the person has to exist before a union can reference
      // them, and the id used from here on must be the one the backend
      // assigned. Writing unions first with a client-invented id is what made
      // spouses vanish on reload — the person saved, the marriage did not.
      const saved = await repo.createPerson(activeTreeId, draft);
      const id = saved.id;

      // The photo can only be uploaded now: the storage path needs the person
      // id, which does not exist until the row is created. This is why the
      // picker on the add form had nowhere to put its result.
      let photoUrl: string | undefined;
      if (v.photo.startsWith('data:')) {
        photoUrl = (await repo.setPhoto(activeTreeId, id, v.photo)) ?? undefined;
      }

      const np: Person = { ...draft, id, photoUrl };
      const newPersons = [...persons, np];

      if (form.group === 'root' || !t) {
        // First person in the archive: nothing to link them to. Creating a
        // union here would reference an empty id, and getRoot() would then walk
        // up into a person that does not exist and render an empty canvas.
        newCollapsed[id] = false;
      } else if (form.group === 'spouse') {
        const u = await repo.createUnion(activeTreeId, {
          id: 'u' + cid, a: t, b: id, date: v.mdate, place: v.mplace, children: [],
        });
        newUnions.push(u);
        newCollapsed[u.id] = false;
      } else if (form.group === 'child') {
        let u = newUnions.find(x => x.a === t || x.b === t);
        if (!u) {
          u = await repo.createUnion(activeTreeId, {
            id: 'u' + cid, a: t, b: null, date: '', place: '', children: [],
          });
          newUnions.push(u);
        }
        u.children.push(id);
        newCollapsed[u.id] = false;
        await repo.addChild(u.id, id);
      } else if (form.group === 'sibling') {
        let u = newUnions.find(x => x.children.includes(t));
        if (!u) {
          // This branch used to push a union locally and never persist it, so
          // the sibling link disappeared on the next load.
          u = await repo.createUnion(activeTreeId, {
            id: 'u' + cid, a: null, b: null, date: '', place: '', children: [t],
          });
          newUnions.push(u);
        }
        u.children.push(id);
        newCollapsed[u.id] = false;
        await repo.addChild(u.id, id);
      } else {
        // Parent: fill the empty slot on the anchor's parent union.
        let u = newUnions.find(x => x.children.includes(t));
        if (!u) {
          u = await repo.createUnion(activeTreeId, {
            id: 'u' + cid, a: id, b: null, date: '', place: '', children: [t],
          });
          newUnions.push(u);
        } else {
          if (!u.a) u.a = id; else u.b = id;
          // Filling a slot never wrote anything back before.
          await repo.updateUnion(u);
        }
        newCollapsed[u.id] = false;
      }

      set(s => ({
        persons: newPersons, unions: newUnions, collapsed: newCollapsed,
        // The first person becomes the root; afterwards the root never moves.
        rootId: s.rootId || id,
        treeUpdatedAt: new Date().toISOString(), 
        // Back to the tree, not into the detail panel: adding is always started
        // from the tree, and entering several people in a row means dismissing
        // a panel every time. The new card is focused so it's easy to spot.
        form: null, focus: id, panel: null,
        savingForm: false,
      }));
    } catch (e) {
      // The form stays open with the values intact so the entry isn't lost.
      set({
        notice: e instanceof Error ? e.message : 'Could not save this person.',
        savingForm: false,
      });
    }
  },

  // ---------------------------------------------------------------- delete

  askDelete: id => {
    const { persons, unions } = get();
    const p = persons.find(x => x.id === id);
    if (!p) return;
    const kids = childrenOf({ persons, unions }, id);
    if (kids.length) {
      set({
        notice: `Can't delete ${fullName(p)}: they have ${kids.length} ${kids.length === 1 ? 'child' : 'children'} in the tree. Remove descendants first.`,
      });
      return;
    }
    set({ confirmDeleteId: id, plusMenu: null });
  },

  cancelDelete: () => set({ confirmDeleteId: null }),

  doDelete: () => {
    const { confirmDeleteId, persons, unions } = get();
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    const newPersons = persons.filter(p => p.id !== id);
    const newUnions = unions
      .map(u => ({
        ...u,
        children: u.children.filter(c => c !== id),
        a: u.a === id ? null : u.a,
        b: u.b === id ? null : u.b,
      }))
      .filter(u => u.a || u.b || u.children.length);
    // Optimistic: the card goes immediately. If the write loses, say so rather
    // than letting the person quietly reappear on the next reload.
    void repo.deletePerson(id).catch((e: unknown) => set({
      notice: e instanceof Error ? e.message : 'Could not delete on the server — reload to see the true state.',
    }));
    set({
      persons: newPersons, unions: newUnions,
      confirmDeleteId: null, form: null, treeUpdatedAt: new Date().toISOString(), 
      panel: null, focus: null,
    });
  },

  // ---------------------------------------------------------------- photo

  setPhoto: (id, dataUrl) => {
    const { activeTreeId } = get();
    // Show the local data URL straight away, then swap in the stored path once
    // the upload lands so a reload resolves it to a fresh signed URL.
    set(s => ({
      persons: s.persons.map(p => p.id === id ? { ...p, photoUrl: dataUrl ?? undefined } : p),
      notice: dataUrl ? 'Profile photo updated' : 'Profile photo removed',
    }));
    void repo.setPhoto(activeTreeId, id, dataUrl)
      .then(stored => set(s => ({
        treeUpdatedAt: new Date().toISOString(), 
        persons: s.persons.map(p => p.id === id ? { ...p, photoUrl: stored ?? undefined } : p),
      })))
      .catch((e: unknown) => set({
        notice: e instanceof Error ? e.message : 'Could not save the photo.',
      }));
  },

  // ---------------------------------------------------------------- archives

  openArchiveForm: (id, archiveId) => {
    const existing = archiveId
      ? get().persons.find(p => p.id === id)?.archives.find(a => a.id === archiveId)
      : undefined;
    set({
      plusMenu: null, form: null, viewerRecord: null,
      archiveForm: existing
        ? {
            targetId: id, editId: existing.id,
            title: existing.title, category: existing.category,
            year: existing.year, origin: existing.origin, notes: existing.desc,
            // Name only: the current file stays unless the user replaces it.
            file: existing.fileName ?? '', fileData: null,
          }
        : {
            targetId: id, title: '', category: 'Historical Photograph / Portrait',
            year: '', origin: '', notes: '', file: '', fileData: null,
          },
    });
  },
  closeArchiveForm: () => set({ archiveForm: null }),
  setArchiveField: (key, val) => set(s => s.archiveForm ? { archiveForm: { ...s.archiveForm, [key]: val } } : {}),
  saveArchive: async () => {
    const { archiveForm, activeTreeId, savingArchive } = get();
    if (!archiveForm || savingArchive) return;
    const targetId = archiveForm.targetId;
    const draft: Archive = {
      id: 'a' + nid(),
      title: archiveForm.title || 'Untitled record',
      year: archiveForm.year,
      category: archiveForm.category,
      desc: archiveForm.notes,
      origin: archiveForm.origin,
    };

    // Last line of defence before upload; the form checks first, the storage
    // bucket enforces it regardless.
    if (archiveForm.fileData && archiveForm.fileData.size > ARCHIVE_MAX_BYTES) {
      set({ notice: `That file is over the ${formatBytes(ARCHIVE_MAX_BYTES)} limit.` });
      return;
    }

    set({ savingArchive: true });
    try {
      if (archiveForm.editId) {
        const existing = get().persons.find(p => p.id === targetId)
          ?.archives.find(a => a.id === archiveForm.editId);
        if (!existing) throw new Error('That record no longer exists.');
        // Keep the id and current attachment; the form only carries the name.
        const edited: Archive = { ...draft, id: existing.id, filePath: existing.filePath, fileName: existing.fileName };
        // Name cleared with no replacement picked = the user removed the file.
        const dropFile = !archiveForm.fileData && !archiveForm.file && !!existing.filePath;
        const saved = await repo.updateArchive(activeTreeId, targetId, edited, archiveForm.fileData, dropFile);
        set(s => ({
          persons: s.persons.map(p => p.id === targetId
            ? { ...p, archives: p.archives.map(a => a.id === saved.id ? saved : a) } : p),
          archiveForm: null, panel: targetId, panelTab: 'archives',
          savingArchive: false, notice: 'Archive record updated', treeUpdatedAt: new Date().toISOString(),
        }));
        return;
      }

      // Awaited so the record carries the real row id and storage path. The old
      // fire-and-forget version kept a client id that matched nothing in the DB.
      const saved = await repo.addArchive(activeTreeId, targetId, draft, archiveForm.fileData);
      set(s => ({
        persons: s.persons.map(p => p.id === targetId
          ? { ...p, archives: [...p.archives, saved] } : p),
        archiveForm: null, panel: targetId, panelTab: 'archives',
        savingArchive: false, treeUpdatedAt: new Date().toISOString(),
      }));
    } catch (e) {
      // Form stays open with the entry intact.
      set({
        savingArchive: false,
        notice: e instanceof Error ? e.message : 'Could not save this record.',
      });
    }
  },

  deleteArchive: async (personId, archiveId) => {
    const rec = get().persons.find(p => p.id === personId)?.archives.find(a => a.id === archiveId);
    if (!rec) return;
    try {
      // Awaited rather than optimistic: this removes a stored file and cannot
      // be undone, so the card should not disappear unless it really went.
      await repo.deleteArchive(rec);
      set(s => ({
        persons: s.persons.map(p => p.id === personId
          ? { ...p, archives: p.archives.filter(a => a.id !== archiveId) }
          : p),
        notice: 'Archive record deleted', treeUpdatedAt: new Date().toISOString(),
      }));
    } catch (e) {
      set({ notice: e instanceof Error ? e.message : 'Could not delete that record.' });
    }
  },

  /**
   * Removes a marriage link recorded in error. Refuses when the couple has
   * children: dropping a partner would quietly rewrite the children's
   * parentage, which is a far bigger change than the button suggests.
   */
  unlinkSpouse: async (personId, spouseId) => {
    const { unions, persons, rootId } = get();
    const u = unions.find(x =>
      (x.a === personId && x.b === spouseId) || (x.a === spouseId && x.b === personId));
    if (!u) return;

    const nameOf = (id: string) => {
      const p = persons.find(x => x.id === id);
      return p ? fullName(p) : 'This person';
    };

    if (u.children.length) {
      set({
        notice: `${nameOf(personId)} and ${nameOf(spouseId)} have ${u.children.length} ${u.children.length === 1 ? 'child' : 'children'} together. Remove or re-parent them first.`,
      });
      return;
    }

    try {
      await repo.deleteUnion(u.id);
      const newUnions = unions.filter(x => x.id !== u.id);

      // The tree is drawn by walking unions from the root, so anyone left with
      // no union at all stops being drawn — they still exist, just invisibly.
      // Say so, rather than letting a card silently disappear.
      const stranded = [personId, spouseId].filter(id =>
        id !== rootId && !newUnions.some(x => x.a === id || x.b === id || x.children.includes(id)));

      set({
        unions: newUnions, treeUpdatedAt: new Date().toISOString(), 
        notice: stranded.length
          ? `Link removed. ${stranded.map(nameOf).join(' and ')} ${stranded.length === 1 ? 'is' : 'are'} no longer connected to the tree — find them in Directory view to re-link or delete.`
          : 'Marriage link removed',
      });
    } catch (e) {
      set({ notice: e instanceof Error ? e.message : 'Could not remove that link.' });
    }
  },

  addMediaPhotos: async (personId, files) => {
    if (!files.length || get().mediaUpload) return;
    const { activeTreeId } = get();
    set({ mediaUpload: { done: 0, total: files.length } });

    const failed: string[] = [];
    // One at a time: keeps memory flat on phones and gives honest progress.
    // Each photo lands in the gallery as soon as it's stored.
    for (const file of files) {
      try {
        const blob = await readScaledPhoto(file);
        const draft: MediaItem = {
          id: 'm' + nid(),
          title: file.name.replace(/\.[^.]+$/, ''),
          type: 'Photo',
          size: `${(blob.size / 1048576).toFixed(1)} MB`,
        };
        const saved = await repo.addMedia(activeTreeId, personId, draft, blob);
        set(s => ({
          persons: s.persons.map(p => p.id === personId ? { ...p, media: [...p.media, saved] } : p),
          treeUpdatedAt: new Date().toISOString(),
        }));
      } catch {
        failed.push(file.name);
      }
      set(s => ({ mediaUpload: s.mediaUpload && { ...s.mediaUpload, done: s.mediaUpload.done + 1 } }));
    }

    const ok = files.length - failed.length;
    set({
      mediaUpload: null,
      notice: failed.length
        ? `${ok} of ${files.length} photos added. Couldn't upload: ${failed.join(', ')}`
        : `${ok} ${ok === 1 ? 'photo' : 'photos'} added to the gallery`,
    });
  },

  deleteMedia: async (personId, mediaId) => {
    const item = get().persons.find(p => p.id === personId)?.media.find(m => m.id === mediaId);
    if (!item) return;
    try {
      await repo.deleteMedia(item);
      set(s => ({
        persons: s.persons.map(p => p.id === personId
          ? { ...p, media: p.media.filter(m => m.id !== mediaId) }
          : p),
        viewerRecord: null,
        notice: 'Photo removed from the gallery', treeUpdatedAt: new Date().toISOString(),
      }));
    } catch (e) {
      set({ notice: e instanceof Error ? e.message : 'Could not remove that photo.' });
    }
  },

  // ---------------------------------------------------------------- csv

  exportCsv: () => {
    const { persons, unions, trees, activeTreeId } = get();
    const name = trees.find(t => t.id === activeTreeId)?.name ?? 'Family';
    const csv = exportPeopleCsv({ persons, unions });
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${name}-Family-Tree.csv`);
    set({ notice: `Exported ${persons.length} ${persons.length === 1 ? 'person' : 'people'} to CSV` });
  },

  downloadCsvTemplate: () => {
    triggerDownload(new Blob([templateCsv()], { type: 'text/csv;charset=utf-8' }), 'Family-Tree-Template.csv');
  },

  openCsvImport: async file => {
    try {
      const plan = planImport(await file.text());
      set({ csvPlan: { ...plan, fileName: file.name } });
    } catch (e) {
      set({ notice: e instanceof Error ? e.message : 'Could not read that file.' });
    }
  },

  closeCsvImport: () => { if (!get().csvImporting) set({ csvPlan: null }); },

  runCsvImport: async () => {
    const { csvPlan, activeTreeId, persons, csvImporting } = get();
    if (!csvPlan || csvImporting || csvPlan.errors.length) return;
    if (persons.length) {
      set({ notice: 'Import only works on an empty tree. Create a new tree first.' });
      return;
    }

    set({ csvImporting: true });
    try {
      await repo.importPeople(activeTreeId, csvPlan);

      if (repo.kind === 'supabase') {
        // Re-read rather than reconstruct: the server assigned every id.
        await get().loadActiveTree(activeTreeId);
      } else {
        const ids = new Map(csvPlan.people.map(p => [p.ref, nid()]));
        const newPersons: Person[] = csvPlan.people.map(({ ref, ...p }) => ({
          ...p, id: ids.get(ref)!, archives: [], media: [], sample: false,
          originFather: '', originFatherDates: '', originMother: '', originMotherDates: '',
        }));
        const newUnions: Union[] = csvPlan.unions.map(u => ({
          id: 'u' + nid(),
          a: u.a ? ids.get(u.a)! : null,
          b: u.b ? ids.get(u.b)! : null,
          date: u.date, place: u.place,
          children: u.children.map(c => ids.get(c)!),
        }));
        const rootId = ids.get(csvPlan.rootRef) ?? '';
        const collapsed: Record<string, boolean> = {};
        newUnions.forEach(u => { if (u.a !== rootId && u.b !== rootId) collapsed[u.id] = true; });
        set({ persons: newPersons, unions: newUnions, rootId, collapsed });
      }

      const n = csvPlan.people.length;
      set({ csvPlan: null, csvImporting: false, notice: `Imported ${n} ${n === 1 ? 'person' : 'people'}` });
    } catch (e) {
      // The server side is one transaction, so a failure here changed nothing.
      set({
        csvImporting: false,
        notice: e instanceof Error ? `Import failed, nothing was saved: ${e.message}` : 'Import failed, nothing was saved.',
      });
    }
  },

  // ---------------------------------------------------------------- viewer

  openViewer: record => set({ viewerRecord: record }),
  closeViewer: () => set({ viewerRecord: null }),
  setAboutOpen: v => set({ aboutOpen: v, userMenu: false }),
  setOnThisDayOpen: v => set({ onThisDayOpen: v }),
  isOwner: () => {
    const { session, trees, activeTreeId } = get();
    // Demo mode has no owners; there, any admin may delete.
    if (repo.kind === 'local') return get().isAdmin();
    return !!session && trees.find(t => t.id === activeTreeId)?.ownerId === session.user.id;
  },

  loadMembers: async () => {
    const { activeTreeId } = get();
    set({ membersLoading: true });
    try {
      set({ members: await repo.listMembers(activeTreeId) });
    } catch (e) {
      set({ notice: e instanceof Error ? e.message : 'Could not load the member list.' });
    } finally {
      set({ membersLoading: false });
    }
  },

  setMemberRole: async (userId, role) => {
    const { activeTreeId, session } = get();
    try {
      await repo.setMemberRole(activeTreeId, userId, role);
      set(s => ({ members: s.members.map(m => m.userId === userId ? { ...m, role } : m) }));
      // Demoting yourself: the admin-only screens no longer apply.
      if (userId === session?.user.id && role === 'viewer') {
        set(s => ({
          session: s.session ? { ...s.session, role: 'viewer' } : s.session,
          trees: s.trees.map(t => t.id === activeTreeId ? { ...t, role: 'viewer' } : t),
          inviteOpen: false,
          notice: 'You are now a viewer of this tree',
        }));
      }
    } catch (e) {
      set({ notice: e instanceof Error ? e.message : 'Could not change that role.' });
    }
  },

  removeMember: async userId => {
    const { activeTreeId, session } = get();
    try {
      await repo.removeMember(activeTreeId, userId);
      if (userId === session?.user.id) {
        set({ inviteOpen: false, notice: 'You have left this tree' });
        await get().moveToNextTree();
        return;
      }
      set(s => ({ members: s.members.filter(m => m.userId !== userId), notice: 'Access removed' }));
    } catch (e) {
      set({ notice: e instanceof Error ? e.message : 'Could not remove that person.' });
    }
  },

  setDeleteTreeOpen: v => set({ deleteTreeOpen: v, treeMenu: false }),

  deleteActiveTree: async () => {
    const { activeTreeId, trees, deletingTree } = get();
    if (deletingTree) return;
    const name = trees.find(t => t.id === activeTreeId)?.name ?? 'The';
    set({ deletingTree: true });
    try {
      await repo.deleteTree(activeTreeId);
      set(s => {
        const { [activeTreeId]: _gone, ...treeCache } = s.treeCache;
        void _gone;
        return {
          deleteTreeOpen: false, deletingTree: false, treeCache,
          trees: s.trees.filter(t => t.id !== activeTreeId),
          panel: null, focus: null, branch: null,
          notice: `${name} Family Tree has been deleted`,
        };
      });
      await get().moveToNextTree();
    } catch (e) {
      set({ deletingTree: false, notice: e instanceof Error ? e.message : 'Could not delete the tree.' });
    }
  },

  moveToNextTree: async () => {
    const { activeTreeId } = get();
    if (repo.kind === 'supabase') {
      const next = (await repo.listMemberships()).find(m => m.id !== activeTreeId);
      if (next) { await get().loadActiveTree(next.id); return; }
    } else {
      const next = get().trees.find(t => t.id !== activeTreeId);
      if (next) { await get().switchTree(next.id); return; }
    }
    // Nothing left: back to the first-run "create your archive" screen.
    set(s => ({
      session: s.session ? { ...s.session, treeId: null } : s.session,
      persons: [], unions: [], rootId: '', trees: [], activeTreeId: '', collapsed: {},
    }));
  },

  startTour: () => {
    const { session, trees, activeTreeId } = get();
    // Close anything that would sit over the elements the tour points at.
    set({
      userMenu: false, treeMenu: false, exportMenu: false, dataMenu: false, plusMenu: null,
      panel: null, aboutOpen: false, onThisDayOpen: false, inviteOpen: false,
    });
    if (session) markTourSeen(session.user.id);
    const treeName = trees.find(t => t.id === activeTreeId)?.name ?? 'Family';
    // A beat for the closed overlays to leave the DOM before measuring targets.
    setTimeout(() => { void runTour({ isAdmin: get().isAdmin(), treeName }); }, 60);
  },
  openPhotoView: (stored, name) => set({ photoView: { stored, name } }),
  closePhotoView: () => set({ photoView: null }),

  // ---------------------------------------------------------------- invites

  setInviteOpen: v => {
    // No token until one is actually minted. The old modal showed a link the
    // moment it opened, generated client-side and never stored, so every link
    // it produced was dead on arrival.
    set({ inviteOpen: v, copied: false, inviteToken: '', inviteError: '' });
    if (v) void get().loadInvites();
  },
  // Changing the role invalidates an already-minted link: that token's role is
  // fixed in the database and cannot be changed by the query string.
  setInviteRole: r => set({ inviteRole: r, copied: false, inviteToken: '' }),
  setCopied: v => set({ copied: v }),

  loadInvites: async () => {
    const { activeTreeId } = get();
    if (!activeTreeId) return;
    try {
      set({ invites: await repo.listInvites(activeTreeId) });
    } catch {
      // Informational list only — a failure here shouldn't block minting.
    }
  },

  createInviteLink: async () => {
    const { activeTreeId, inviteRole } = get();
    set({ creatingInvite: true, inviteError: '' });
    try {
      const inv = await repo.createInvite(activeTreeId, inviteRole);
      set(s => ({ inviteToken: inv.token, invites: [inv, ...s.invites], copied: false }));
    } catch (e) {
      set({ inviteError: e instanceof Error ? e.message : 'Could not create an invite link.' });
    } finally {
      set({ creatingInvite: false });
    }
  },

  revokeInviteToken: async token => {
    try {
      await repo.revokeInvite(token);
      set(s => ({
        invites: s.invites.map(i =>
          i.token === token ? { ...i, revokedAt: new Date().toISOString() } : i),
        inviteToken: s.inviteToken === token ? '' : s.inviteToken,
      }));
    } catch (e) {
      set({ inviteError: e instanceof Error ? e.message : 'Could not revoke that link.' });
    }
  },

  /**
   * Consumes a ?invite= token once the user is signed in. Nothing did this
   * before, so following an invite link authenticated you and then left you
   * with no membership.
   */
  redeemPendingInvite: async () => {
    const token = get().pendingInvite;
    if (!token || !get().session) return;
    // Strip the token from the address bar either way, so a refresh cannot
    // replay it and a shared screenshot cannot leak it.
    const clearUrl = () => window.history.replaceState({}, document.title, window.location.pathname);
    try {
      const treeId = await repo.redeemInvite(token);
      // Re-read the session: the role now comes from the membership just created.
      const fresh = await repo.getSession();
      set(s => ({ session: fresh ?? s.session, pendingInvite: null }));
      clearUrl();
      await get().loadActiveTree(treeId);
    } catch (e) {
      set({
        pendingInvite: null,
        notice: e instanceof Error ? e.message : 'That invite link could not be used.',
      });
      clearUrl();
    }
  },

  inviteUrl: () => {
    const { inviteToken, inviteRole } = get();
    if (!inviteToken) return '';
    const base = window.location.href.split('?')[0].split('#')[0];
    return `${base}?invite=${inviteToken}&role=${inviteRole}`;
  },

  // ---------------------------------------------------------------- trees

  setNewTreeOpen: v => set({ newTreeOpen: v }),
  createTree: async (name, place, country) => {
    try {
      // The id comes back from the backend rather than nid(): a client-invented
      // id would never match the row, and every later write would miss.
      const id = await repo.createTree(name, place, country);
      if (repo.kind === 'supabase') {
        // Load it like any other tree: refreshes the switcher list and sets
        // the role from the new membership (admin) rather than assuming it.
        set({ treeMenu: false, newTreeOpen: false, focus: null, panel: null, branch: null });
        await get().loadActiveTree(id);
        return;
      }
      set(s => ({
        trees: [...s.trees, { id, name, originPlace: place, originCountry: country }],
        // Park the outgoing tree, same as switchTree, or it is lost on switch back.
        treeCache: {
          ...s.treeCache,
          [s.activeTreeId]: {
            persons: s.persons, unions: s.unions, rootId: s.rootId, collapsed: s.collapsed,
          },
        },
        activeTreeId: id,
        // rootId was left pointing at the previous tree's root.
        persons: [], unions: [], collapsed: {}, rootId: '',
        focus: null, panel: null, branch: null,
        treeMenu: false, newTreeOpen: false,
      }));
    } catch (e) {
      set({ notice: e instanceof Error ? e.message : 'Could not create the family tree.' });
    }
  },
  switchTree: async id => {
    if (id === get().activeTreeId) {
      set({ treeMenu: false });
      return;
    }

    // Park the outgoing tree before switching. Without this the canvas kept
    // rendering the previous family's people under the new tree's name, while
    // every write went to the new tree_id.
    set(s => ({
      treeCache: {
        ...s.treeCache,
        [s.activeTreeId]: {
          persons: s.persons, unions: s.unions, rootId: s.rootId, collapsed: s.collapsed,
        },
      },
      activeTreeId: id, treeMenu: false, focus: null, panel: null, branch: null,
    }));

    // Against Supabase, re-read rather than trust the cache: another member may
    // have changed the tree since it was last open.
    if (repo.kind === 'supabase') {
      await get().loadActiveTree(id);
      return;
    }

    const cached = get().treeCache[id];
    set(cached
      ? { persons: cached.persons, unions: cached.unions, rootId: cached.rootId, collapsed: cached.collapsed }
      : { persons: [], unions: [], rootId: '', collapsed: {} });
  },

  setHeaderQ: q => set({ headerQ: q }),
  setDirSort: k => set(s => s.dirSort === k ? { dirSortAsc: !s.dirSortAsc } : { dirSort: k, dirSortAsc: true }),
  setKinTarget: id => set({ kinTarget: id }),
  setNotice: msg => set({ notice: msg }),
  setWinW: w => set({ winW: w }),

  // ---------------------------------------------------------------- computed

  getPersonById: id => get().persons.find(p => p.id === id),

  unionIdsWithChildren: () => get().unions.filter(u => u.children.length).map(u => u.id),

  getMatchSet: () => {
    const { filters, persons, unions } = get();
    const { q, gender, status, from, to, showRelatives } = filters;
    const active = !!(q || gender !== 'All' || status !== 'All' || from || to);
    if (!active) return null;

    const hit: Record<string, boolean | 'rel'> = {};
    const needle = q.trim().toLowerCase();

    persons.forEach(p => {
      let ok = true;
      if (needle) ok = `${p.first} ${p.middle} ${p.last}`.toLowerCase().includes(needle);
      if (ok && gender !== 'All') ok = p.gender === gender;
      if (ok && status === 'Living') ok = !p.dod;
      if (ok && status === 'Deceased') ok = !!p.dod;
      const yr = parseInt(p.dob?.slice(0, 4) || '0', 10);
      if (ok && from) ok = yr >= parseInt(from, 10);
      if (ok && to) ok = yr <= parseInt(to, 10);
      if (ok) hit[p.id] = true;
    });

    if (showRelatives) {
      const data = { persons, unions };
      Object.keys(hit).forEach(id => {
        [...parentsOf(data, id), ...spousesOf(data, id), ...unionsOf(data, id).flatMap(u => u.children)]
          .forEach(r => { if (!hit[r]) hit[r] = 'rel'; });
      });
    }
    return hit;
  },

  getLayout: () => {
    const { persons, unions, collapsed, focus, branch } = get();
    return computeLayout(
      { persons, unions }, collapsed, focus, get().isAdmin(), get().getMatchSet(), branch,
    );
  },
}));
