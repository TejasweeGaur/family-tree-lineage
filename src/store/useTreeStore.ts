import { create } from 'zustand';
import type {
  Person, Union, Tree, Invite, Session, Role,
  PanelTab, ViewMode, PanelMode, CanvasMode,
  FormState, FormValues, ArchiveFormState, DirSortKey, Gender,
  RelativeKind, AddDialogState, ViewerRecord,
} from '../types';
import { SEED_PERSONS, SEED_UNIONS, SEED_ROOT_ID, SEED_TREE_NAME } from '../data/seed';
import { spousesOf, parentsOf, unionsOf, childrenOf, getRoot, fullName } from '../utils/kinship';
import { computeLayout } from '../utils/layout';
import { repo } from '../data/repository';

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
  authError: string;
  pendingInvite: string | null;

  // Trees
  trees: Tree[];
  activeTreeId: string;
  rootId: string;

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
  archiveForm: ArchiveFormState | null;
  addDialog: AddDialogState | null;
  /** Person queued for deletion, shown in the confirm dialog. */
  confirmDeleteId: string | null;
  inviteOpen: boolean;
  inviteRole: Role;
  inviteToken: string;
  copied: boolean;
  newTreeOpen: boolean;
  viewerRecord: ViewerRecord | null;

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

function randomToken(): string {
  const a = new Uint8Array(9);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
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
  };
  const m = map[group] || ['Relative', 'Relative', 'Relative'];
  return gender === 'Male' ? m[0] : gender === 'Female' ? m[1] : m[2];
}

function emptyValues(): FormValues {
  return {
    first: '', last: '', maiden: '', gender: 'Other', living: true,
    dob: '', pob: '', dod: '', pod: '',
    occupation: '', residency: '', gotra: '', shasan: '',
    label: '', bio: '', mdate: '', mplace: '',
  };
}

type Store = AppState & {
  // Auth
  initAuth: () => Promise<void>;
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
  saveForm: () => void;

  // Delete
  askDelete: (id: string) => void;
  cancelDelete: () => void;
  doDelete: () => void;

  // Photo
  setPhoto: (id: string, dataUrl: string | null) => void;

  // Archives
  openArchiveForm: (id: string) => void;
  closeArchiveForm: () => void;
  setArchiveField: <K extends keyof Omit<ArchiveFormState, 'targetId'>>(key: K, val: string) => void;
  saveArchive: () => void;

  // Viewer
  openViewer: (record: ViewerRecord) => void;
  closeViewer: () => void;

  // Invites
  setInviteOpen: (v: boolean) => void;
  setInviteRole: (r: Role) => void;
  regenerateInvite: () => void;
  setCopied: (v: boolean) => void;
  inviteUrl: () => string;

  // Trees
  setNewTreeOpen: (v: boolean) => void;
  createTree: (name: string, notes: string) => void;
  switchTree: (id: string) => void;

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
  authError: '',
  pendingInvite: null,

  trees: [{ id: 't1', name: SEED_TREE_NAME, originNotes: 'Founded by Hari Prasad Sharma of Varanasi' }],
  activeTreeId: 't1',
  rootId: SEED_ROOT_ID,

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
  archiveForm: null,
  addDialog: null,
  confirmDeleteId: null,
  inviteOpen: false,
  inviteRole: 'viewer',
  inviteToken: randomToken(),
  copied: false,
  newTreeOpen: false,
  viewerRecord: null,

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

    const session = await repo.getSession();
    set({ session, authReady: true });

    repo.onAuthChange(s => set({ session: s }));

    if (repo.kind === 'supabase' && session) {
      try {
        const snap = await repo.loadTree(get().activeTreeId);
        const collapsed: Record<string, boolean> = {};
        snap.unions.forEach(u => { if (u.a !== snap.rootId && u.b !== snap.rootId) collapsed[u.id] = true; });
        set({
          persons: snap.persons, unions: snap.unions, rootId: snap.rootId,
          activeTreeId: snap.treeId, collapsed,
          trees: [{ id: snap.treeId, name: snap.treeName, originNotes: snap.originNotes }],
        });
      } catch (e) {
        set({ notice: e instanceof Error ? e.message : 'Could not load the family tree.' });
      }
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
    set({ session: null, userMenu: false, panel: null, focus: null });
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
      const match = persons.find(p => `${p.first} ${p.last} ${p.maiden}`.toLowerCase().includes(q));
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

  // ---------------------------------------------------------------- add dialog

  openAddDialog: anchorId => {
    const { panel, focus, persons, rootId } = get();
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
          living: group === 'child',
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
          first: p.first, last: p.last, maiden: p.maiden, gender: p.gender,
          living: !p.dod, dob: p.dob, pob: p.pob, dod: p.dod, pod: p.pod,
          occupation: p.occupation, residency: p.residency,
          gotra: p.gotra, shasan: p.shasan,
          label: p.label, bio: p.bio,
          mdate: u?.date || '', mplace: u?.place || '',
        },
      },
    });
  },

  closeForm: () => set({ form: null }),

  setFormValue: (key, val) => set(s =>
    s.form ? { form: { ...s.form, values: { ...s.form.values, [key]: val } } } : {}),

  setBioTab: tab => set(s => s.form ? { form: { ...s.form, bioTab: tab } } : {}),

  saveForm: () => {
    const { form, persons, unions, collapsed, activeTreeId } = get();
    if (!form) return;
    const v = form.values;
    if (!v.first.trim() || !v.last.trim()) {
      set({ notice: 'First and last name are required.' });
      return;
    }

    const newUnions = unions.map(u => ({ ...u, children: [...u.children] }));
    const newCollapsed = { ...collapsed };

    if (form.mode === 'edit') {
      const newPersons = persons.map(p => p.id === form.targetId
        ? {
            ...p,
            first: v.first, last: v.last, maiden: v.maiden, gender: v.gender,
            dob: v.dob, pob: v.pob,
            dod: v.living ? '' : v.dod, pod: v.living ? '' : v.pod,
            occupation: v.occupation, residency: v.residency,
            gotra: v.gotra, shasan: v.shasan,
            label: v.label, bio: v.bio,
          }
        : p);
      const u = newUnions.find(x => x.a === form.targetId || x.b === form.targetId);
      if (u) { u.date = v.mdate; u.place = v.mplace; }

      set({ persons: newPersons, unions: newUnions, form: null });
      const edited = newPersons.find(p => p.id === form.targetId);
      if (edited) void repo.updatePerson(edited);
      if (u) void repo.updateUnion(u);
      return;
    }

    const id = nid();
    const np: Person = {
      id, first: v.first, last: v.last, maiden: v.maiden, gender: v.gender,
      dob: v.dob, pob: v.pob, dod: v.living ? '' : v.dod, pod: v.living ? '' : v.pod,
      occupation: v.occupation, residency: v.residency,
      gotra: v.gotra, shasan: v.shasan,
      label: form.group === 'spouse' ? 'Married in' : kindLabel(form.group, v.gender),
      bio: v.bio, archives: [], media: [], sample: false,
      originFather: '', originFatherDates: '', originMother: '', originMotherDates: '',
    };
    const newPersons = [...persons, np];
    const t = form.targetId;

    if (form.group === 'spouse') {
      const u: Union = { id: 'u' + id, a: t, b: id, date: v.mdate, place: v.mplace, children: [] };
      newUnions.push(u);
      void repo.createUnion(activeTreeId, u);
    } else if (form.group === 'child') {
      let u = newUnions.find(x => x.a === t || x.b === t);
      if (!u) {
        u = { id: 'u' + id, a: t, b: null, date: '', place: '', children: [] };
        newUnions.push(u);
        void repo.createUnion(activeTreeId, u);
      }
      u.children.push(id);
      newCollapsed[u.id] = false;
      void repo.addChild(u.id, id);
    } else if (form.group === 'sibling') {
      let u = newUnions.find(x => x.children.includes(t));
      if (!u) {
        u = { id: 'u' + id, a: null, b: null, date: '', place: '', children: [t] };
        newUnions.push(u);
      }
      u.children.push(id);
      newCollapsed[u.id] = false;
      void repo.addChild(u.id, id);
    } else {
      // Parent: fill the empty slot on the anchor's parent union.
      let u = newUnions.find(x => x.children.includes(t));
      if (!u) {
        u = { id: 'u' + id, a: id, b: null, date: '', place: '', children: [t] };
        newUnions.push(u);
        void repo.createUnion(activeTreeId, u);
      } else if (!u.a) {
        u.a = id;
      } else if (!u.b) {
        u.b = id;
      } else {
        set({ notice: 'Both parents are already recorded.' });
        return;
      }
      newCollapsed[u.id] = false;
    }

    void repo.createPerson(activeTreeId, np);
    set({
      persons: newPersons, unions: newUnions, collapsed: newCollapsed,
      form: null, focus: id, panel: id, panelTab: 'family',
    });
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
    void repo.deletePerson(id);
    set({
      persons: newPersons, unions: newUnions,
      confirmDeleteId: null, form: null,
      panel: null, focus: null,
    });
  },

  // ---------------------------------------------------------------- photo

  setPhoto: (id, dataUrl) => {
    set(s => ({
      persons: s.persons.map(p => p.id === id ? { ...p, photoUrl: dataUrl ?? undefined } : p),
      notice: dataUrl ? 'Profile photo updated' : 'Profile photo removed',
    }));
    void repo.setPhoto(id, dataUrl);
  },

  // ---------------------------------------------------------------- archives

  openArchiveForm: id => set({
    plusMenu: null, form: null,
    archiveForm: {
      targetId: id, title: '', category: 'Historical Photograph / Portrait',
      year: '', origin: '', notes: '', file: '',
    },
  }),
  closeArchiveForm: () => set({ archiveForm: null }),
  setArchiveField: (key, val) => set(s => s.archiveForm ? { archiveForm: { ...s.archiveForm, [key]: val } } : {}),
  saveArchive: () => {
    const { archiveForm, persons } = get();
    if (!archiveForm) return;
    const rec = {
      id: 'a' + nid(),
      title: archiveForm.title || 'Untitled record',
      year: archiveForm.year,
      category: archiveForm.category,
      desc: archiveForm.notes,
      origin: archiveForm.origin,
    };
    set({
      persons: persons.map(p => p.id === archiveForm.targetId
        ? { ...p, archives: [...p.archives, rec] } : p),
      archiveForm: null, panel: archiveForm.targetId, panelTab: 'archives',
    });
    void repo.addArchive(archiveForm.targetId, rec);
  },

  // ---------------------------------------------------------------- viewer

  openViewer: record => set({ viewerRecord: record }),
  closeViewer: () => set({ viewerRecord: null }),

  // ---------------------------------------------------------------- invites

  setInviteOpen: v => set({ inviteOpen: v, copied: false }),
  setInviteRole: r => set({ inviteRole: r, copied: false }),
  regenerateInvite: () => set({ inviteToken: randomToken(), copied: false }),
  setCopied: v => set({ copied: v }),
  inviteUrl: () => {
    const { inviteToken, inviteRole } = get();
    const base = window.location.href.split('?')[0].split('#')[0];
    return `${base}?invite=${inviteToken}&role=${inviteRole}`;
  },

  // ---------------------------------------------------------------- trees

  setNewTreeOpen: v => set({ newTreeOpen: v }),
  createTree: (name, notes) => {
    const id = nid();
    set(s => ({
      trees: [...s.trees, { id, name, originNotes: notes }],
      activeTreeId: id,
      persons: [], unions: [], collapsed: {},
      focus: null, panel: null, branch: null,
      treeMenu: false, newTreeOpen: false,
    }));
    void repo.createTree(name, notes);
  },
  switchTree: id => set(s =>
    id === s.activeTreeId
      ? { treeMenu: false }
      : { activeTreeId: id, treeMenu: false, focus: null, panel: null, branch: null }),

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
      if (needle) ok = `${p.first} ${p.last} ${p.maiden}`.toLowerCase().includes(needle);
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
