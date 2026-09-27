import type { Person, Union, Archive, MediaItem, Invite, Role, Session, User } from '../types';
import { isSupabaseConfigured, requireSupabase } from '../lib/supabase';
import { SEED_PERSONS, SEED_UNIONS, SEED_ROOT_ID, SEED_TREE_NAME } from './seed';
import type { ImportPlan } from '../utils/csv';

export interface TreeSnapshot {
  treeId: string;
  treeName: string;
  originPlace: string;
  originCountry: string;
  rootId: string;
  persons: Person[];
  unions: Union[];
}

/**
 * Every data operation the app performs. Two implementations exist: `localRepo`
 * (in-memory, seeded) and `supabaseRepo`. The active one is chosen once, at
 * module load, by whether Supabase credentials are present — so the UI never
 * needs to know which backend it is talking to.
 */
export interface Repository {
  readonly kind: 'local' | 'supabase';

  // auth
  getSession(): Promise<Session | null>;
  signInWithGoogle(inviteToken?: string): Promise<Session | null>;
  signOut(): Promise<void>;
  onAuthChange(cb: (s: Session | null) => void): () => void;

  // tree
  loadTree(treeId?: string): Promise<TreeSnapshot>;
  listTrees(): Promise<Array<{ id: string; name: string }>>;
  createTree(name: string, place: string, country: string): Promise<string>;

  // people & relationships
  createPerson(treeId: string, p: Person): Promise<Person>;
  updatePerson(p: Person): Promise<void>;
  deletePerson(id: string): Promise<void>;
  createUnion(treeId: string, u: Union): Promise<Union>;
  updateUnion(u: Union): Promise<void>;
  addChild(unionId: string, childId: string): Promise<void>;
  removeUnionPartner(unionId: string, personId: string): Promise<void>;
  deleteUnion(unionId: string): Promise<void>;

  // attachments
  addArchive(treeId: string, personId: string, a: Archive, file: File | null): Promise<Archive>;
  deleteArchive(a: Archive): Promise<void>;
  /**
   * Updates a record's details. `file` replaces the attachment; `dropFile`
   * removes it. The previous object is deleted only after the row points away.
   */
  updateArchive(treeId: string, personId: string, a: Archive, file: File | null, dropFile: boolean): Promise<Archive>;
  addMedia(treeId: string, personId: string, m: MediaItem, file: Blob): Promise<MediaItem>;
  deleteMedia(m: MediaItem): Promise<void>;
  setPhoto(treeId: string, personId: string, dataUrl: string | null): Promise<string | null>;
  /**
   * Turns a stored object path into something an <img> or <a> can use.
   * Passes through values that are already URLs (demo mode uses data: URLs).
   */
  signedUrl(stored: string): Promise<string | null>;

  // invites
  listInvites(treeId: string): Promise<Invite[]>;
  createInvite(treeId: string, role: Role): Promise<Invite>;
  revokeInvite(token: string): Promise<void>;
  /** Joins the caller to the invite's tree. Resolves to the tree id. */
  redeemInvite(token: string): Promise<string>;

  // bulk
  /** Writes a validated CSV plan in one transaction. Resolves when committed. */
  importPeople(treeId: string, plan: ImportPlan): Promise<void>;
}

// ---------------------------------------------------------------- local

// Placeholder identity for demo mode only. Real users come from Supabase auth.
const DEMO_USER: User = {
  id: 'demo-user',
  email: 'demo@example.com',
  name: 'Demo Admin',
};

const SESSION_KEY = 'ft.session';
const LOCAL_TREE_ID = 'local-tree';

/**
 * Unique object name that still carries the original filename, so the display
 * name can be recovered from the path. Avoids needing a extra DB column for it.
 */
function objectName(original: string): string {
  const safe = original.replace(/[^\w.-]+/g, '_').slice(-60);
  return `${crypto.randomUUID()}__${safe}`;
}

/** Inverse of objectName(): the original filename, for display and download. */
function displayName(stored: string): string {
  const last = stored.split('/').pop() ?? '';
  const sep = last.indexOf('__');
  return sep >= 0 ? last.slice(sep + 2) : last;
}

function randomToken(): string {
  const a = new Uint8Array(9);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
}

/**
 * Demo backend. Mutations only touch the objects the Zustand store already
 * holds, so they are effectively no-ops here — the store stays the source of
 * truth and these resolve immediately. Sessions persist in localStorage so a
 * reload keeps you signed in, matching the prototype's behaviour.
 */
class LocalRepository implements Repository {
  readonly kind = 'local' as const;
  private listeners = new Set<(s: Session | null) => void>();
  private invites: Invite[] = [];

  async getSession(): Promise<Session | null> {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Session;
      // Backfill treeId so a session stored before the field existed still resolves.
      return { ...s, treeId: s.treeId ?? LOCAL_TREE_ID };
    } catch {
      return null;
    }
  }

  async signInWithGoogle(inviteToken?: string): Promise<Session> {
    // Without a real identity provider the role comes from the invite that
    // brought you here, defaulting to admin so the demo is explorable.
    const invite = inviteToken ? this.invites.find(i => i.token === inviteToken && !i.revokedAt) : undefined;
    const session: Session = { user: DEMO_USER, role: invite?.role ?? 'admin', treeId: LOCAL_TREE_ID };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.listeners.forEach(cb => cb(session));
    return session;
  }

  async signOut(): Promise<void> {
    localStorage.removeItem(SESSION_KEY);
    this.listeners.forEach(cb => cb(null));
  }

  onAuthChange(cb: (s: Session | null) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async loadTree(): Promise<TreeSnapshot> {
    return {
      treeId: LOCAL_TREE_ID,
      treeName: SEED_TREE_NAME,
      originPlace: '',
      originCountry: '',
      rootId: SEED_ROOT_ID,
      // Deep copy so store mutations never write back into the seed module.
      persons: SEED_PERSONS.map(p => ({ ...p, archives: [...p.archives], media: [...p.media] })),
      unions: SEED_UNIONS.map(u => ({ ...u, children: [...u.children] })),
    };
  }

  async listTrees() { return [{ id: LOCAL_TREE_ID, name: SEED_TREE_NAME }]; }
  // A fresh id per call, so creating a second tree in demo mode does not
  // collide with the seeded one.
  async createTree() { return `local-${randomToken()}`; }

  async createPerson(_treeId: string, p: Person) { return p; }
  async updatePerson() {}
  async deletePerson() {}
  async createUnion(_treeId: string, u: Union) { return u; }
  async updateUnion() {}
  async addChild() {}
  async removeUnionPartner() {}
  async deleteUnion() {}
  async addArchive(_treeId: string, _personId: string, a: Archive, file: File | null) {
    // Demo mode keeps the file in memory only, as an object URL.
    return file ? { ...a, filePath: URL.createObjectURL(file), fileName: file.name } : a;
  }
  async deleteArchive() {}
  async updateArchive(_treeId: string, _personId: string, a: Archive, file: File | null, dropFile: boolean) {
    if (file) return { ...a, filePath: URL.createObjectURL(file), fileName: file.name };
    if (dropFile) return { ...a, filePath: undefined, fileName: undefined };
    return a;
  }
  async addMedia(_treeId: string, _personId: string, m: MediaItem, file: Blob) {
    return { ...m, url: URL.createObjectURL(file) };
  }
  async deleteMedia() {}
  async setPhoto(_treeId: string, _personId: string, dataUrl: string | null) { return dataUrl; }
  async signedUrl(stored: string) { return stored || null; }

  async listInvites() { return this.invites; }

  async createInvite(treeId: string, role: Role): Promise<Invite> {
    const inv: Invite = { token: randomToken(), treeId, role, createdAt: new Date().toISOString() };
    this.invites = [inv, ...this.invites];
    return inv;
  }

  async revokeInvite(token: string) {
    this.invites = this.invites.map(i =>
      i.token === token ? { ...i, revokedAt: new Date().toISOString() } : i,
    );
  }

  async redeemInvite(token: string): Promise<string> {
    const inv = this.invites.find(i => i.token === token);
    if (!inv) throw new Error('This invite link is not valid');
    if (inv.revokedAt) throw new Error('This invite link has been revoked');
    return inv.treeId;
  }

  // Demo mode has no per-tree storage; the store builds the imported state.
  async importPeople() {}
}

// ---------------------------------------------------------------- supabase

type PersonRow = {
  id: string; first: string; last: string; maiden: string; gender: Person['gender'];
  dob: string; pob: string; dod: string; pod: string;
  occupation: string; residency: string; gotra: string; shasan: string;
  label: string; bio: string; photo_url: string | null;
  origin_father: string; origin_father_dates: string;
  origin_mother: string; origin_mother_dates: string;
};

function rowToPerson(r: PersonRow, archives: Archive[], media: MediaItem[]): Person {
  return {
    id: r.id, first: r.first, last: r.last, maiden: r.maiden, gender: r.gender,
    dob: r.dob, pob: r.pob, dod: r.dod, pod: r.pod,
    occupation: r.occupation, residency: r.residency,
    gotra: r.gotra, shasan: r.shasan, label: r.label, bio: r.bio,
    photoUrl: r.photo_url ?? undefined,
    originFather: r.origin_father, originFatherDates: r.origin_father_dates,
    originMother: r.origin_mother, originMotherDates: r.origin_mother_dates,
    archives, media, sample: false,
  };
}

function personToRow(p: Person, treeId?: string) {
  return {
    ...(treeId ? { tree_id: treeId } : {}),
    first: p.first, last: p.last, maiden: p.maiden, gender: p.gender,
    dob: p.dob, pob: p.pob, dod: p.dod, pod: p.pod,
    occupation: p.occupation, residency: p.residency,
    gotra: p.gotra, shasan: p.shasan, label: p.label, bio: p.bio,
    photo_url: p.photoUrl ?? null,
    origin_father: p.originFather, origin_father_dates: p.originFatherDates,
    origin_mother: p.originMother, origin_mother_dates: p.originMotherDates,
  };
}

class SupabaseRepository implements Repository {
  readonly kind = 'supabase' as const;

  async getSession(): Promise<Session | null> {
    const sb = requireSupabase();
    const { data } = await sb.auth.getSession();
    if (!data.session) return null;
    return this.hydrate(data.session.user);
  }

  /** Turn a Supabase auth user into an app session by reading their membership role. */
  private async hydrate(authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }): Promise<Session | null> {
    const sb = requireSupabase();
    const { data: m } = await sb
      .from('memberships')
      .select('role, tree_id')
      .eq('user_id', authUser.id)
      .limit(1)
      .maybeSingle();

    const meta = authUser.user_metadata ?? {};
    return {
      user: {
        id: authUser.id,
        email: authUser.email ?? '',
        name: (meta.full_name as string) ?? (meta.name as string) ?? authUser.email ?? '',
        pictureUrl: (meta.avatar_url as string) ?? undefined,
      },
      // No membership row is a valid, expected state for a brand-new user: they
      // are signed in with no archive yet. Returning null here would bounce them
      // back to the sign-in screen in a loop.
      role: (m?.role as Role) ?? 'admin',
      treeId: m?.tree_id ?? null,
    };
  }

  async signInWithGoogle(inviteToken?: string): Promise<null> {
    const sb = requireSupabase();
    const redirect = new URL(window.location.origin);
    if (inviteToken) redirect.searchParams.set('invite', inviteToken);
    await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirect.toString(), queryParams: { prompt: 'select_account' } },
    });
    return null; // browser navigates away; session arrives via onAuthChange
  }

  async signOut(): Promise<void> {
    await requireSupabase().auth.signOut();
  }

  onAuthChange(cb: (s: Session | null) => void): () => void {
    const sb = requireSupabase();
    const { data } = sb.auth.onAuthStateChange(async (_e, session) => {
      cb(session ? await this.hydrate(session.user) : null);
    });
    return () => data.subscription.unsubscribe();
  }

  async loadTree(treeId?: string): Promise<TreeSnapshot> {
    const sb = requireSupabase();

    if (!treeId) throw new Error('No family archive selected.');

    const { data: tree, error: te } = await sb
      .from('trees')
      .select('id, name, origin_place, origin_country, root_person_id')
      .eq('id', treeId)
      .maybeSingle();
    if (te) throw te;
    if (!tree) throw new Error('Tree not found or you are not a member of it.');

    const [{ data: pRows, error: pe }, { data: uRows, error: ue }, { data: ucRows }, { data: aRows }, { data: mRows }] =
      await Promise.all([
        sb.from('persons').select('*').eq('tree_id', tree.id).order('created_at'),
        sb.from('unions').select('*').eq('tree_id', tree.id),
        sb.from('union_children').select('union_id, child_id'),
        sb.from('archive_records').select('*'),
        sb.from('media_items').select('*'),
      ]);
    if (pe) throw pe;
    if (ue) throw ue;

    const archivesBy = new Map<string, Archive[]>();
    (aRows ?? []).forEach(a => {
      const list = archivesBy.get(a.person_id) ?? [];
      list.push({
        id: a.id, title: a.title, year: a.year, category: a.category,
        desc: a.descr, origin: a.origin,
        filePath: a.file_url ?? undefined,
        fileName: a.file_url ? displayName(a.file_url) : undefined,
      });
      archivesBy.set(a.person_id, list);
    });

    const mediaBy = new Map<string, MediaItem[]>();
    (mRows ?? []).forEach(m => {
      const list = mediaBy.get(m.person_id) ?? [];
      const mb = m.size_bytes ? `${(m.size_bytes / 1048576).toFixed(1)} MB` : '';
      list.push({ id: m.id, title: m.title, type: m.kind, size: mb, url: m.url ?? undefined });
      mediaBy.set(m.person_id, list);
    });

    const childrenBy = new Map<string, string[]>();
    (ucRows ?? []).forEach(r => {
      const list = childrenBy.get(r.union_id) ?? [];
      list.push(r.child_id);
      childrenBy.set(r.union_id, list);
    });

    const persons = (pRows ?? []).map(r =>
      rowToPerson(r as PersonRow, archivesBy.get(r.id) ?? [], mediaBy.get(r.id) ?? []),
    );

    // Children display in birth order.
    const dobOf = new Map(persons.map(p => [p.id, p.dob]));
    const unions: Union[] = (uRows ?? []).map(u => ({
      id: u.id, a: u.partner_a, b: u.partner_b, date: u.date, place: u.place,
      children: (childrenBy.get(u.id) ?? []).sort((x, y) =>
        String(dobOf.get(x) ?? '').localeCompare(String(dobOf.get(y) ?? '')),
      ),
    }));

    return {
      treeId: tree.id,
      treeName: tree.name,
      originPlace: tree.origin_place,
      originCountry: tree.origin_country,
      rootId: tree.root_person_id ?? persons[0]?.id ?? '',
      persons,
      unions,
    };
  }

  async listTrees() {
    const sb = requireSupabase();
    const { data, error } = await sb.from('trees').select('id, name').order('created_at');
    if (error) throw error;
    return data ?? [];
  }

  async createTree(name: string, place: string, country: string): Promise<string> {
    const sb = requireSupabase();
    // Goes through an RPC rather than two inserts because neither can satisfy
    // the other's RLS from the client: selecting the new tree row needs a
    // membership that does not exist yet, and inserting that membership needs
    // an admin that does not exist yet. create_tree() does both as definer.
    const { data, error } = await sb.rpc('create_tree', { tree_name: name, place, country });
    if (error) throw error;
    return data as string;
  }

  async createPerson(treeId: string, p: Person): Promise<Person> {
    const sb = requireSupabase();
    const { data, error } = await sb.from('persons').insert(personToRow(p, treeId)).select('*').single();
    if (error) throw error;
    return rowToPerson(data as PersonRow, [], []);
  }

  async updatePerson(p: Person): Promise<void> {
    const { error } = await requireSupabase().from('persons').update(personToRow(p)).eq('id', p.id);
    if (error) throw error;
  }

  async deletePerson(id: string): Promise<void> {
    const { error } = await requireSupabase().from('persons').delete().eq('id', id);
    if (error) throw error;
  }

  async createUnion(treeId: string, u: Union): Promise<Union> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('unions')
      .insert({ tree_id: treeId, partner_a: u.a, partner_b: u.b, date: u.date, place: u.place })
      .select('*')
      .single();
    if (error) throw error;
    if (u.children.length) {
      await sb.from('union_children').insert(u.children.map(c => ({ union_id: data.id, child_id: c })));
    }
    return { id: data.id, a: data.partner_a, b: data.partner_b, date: data.date, place: data.place, children: u.children };
  }

  async updateUnion(u: Union): Promise<void> {
    const { error } = await requireSupabase()
      .from('unions')
      .update({ partner_a: u.a, partner_b: u.b, date: u.date, place: u.place })
      .eq('id', u.id);
    if (error) throw error;
  }

  async addChild(unionId: string, childId: string): Promise<void> {
    const { error } = await requireSupabase()
      .from('union_children')
      .upsert({ union_id: unionId, child_id: childId }, { onConflict: 'child_id' });
    if (error) throw error;
  }

  async deleteUnion(unionId: string): Promise<void> {
    const { error } = await requireSupabase().from('unions').delete().eq('id', unionId);
    if (error) throw error;
  }

  async removeUnionPartner(unionId: string, personId: string): Promise<void> {
    const sb = requireSupabase();
    const { data } = await sb.from('unions').select('partner_a, partner_b').eq('id', unionId).single();
    if (!data) return;
    const patch = data.partner_a === personId ? { partner_a: null } : { partner_b: null };
    const { error } = await sb.from('unions').update(patch).eq('id', unionId);
    if (error) throw error;
  }

  async addArchive(treeId: string, personId: string, a: Archive, file: File | null): Promise<Archive> {
    const sb = requireSupabase();
    let filePath: string | undefined;

    if (file) {
      const path = `${treeId}/${personId}/${objectName(file.name)}`;
      const { error: ue } = await sb.storage.from('archives').upload(path, file, {
        contentType: file.type || 'application/octet-stream',
      });
      if (ue) throw ue;
      filePath = `archives/${path}`;
    }

    // Insert only after the upload succeeds, so a failed upload never leaves a
    // record pointing at a file that isn't there.
    const { data, error } = await sb.from('archive_records').insert({
      person_id: personId, title: a.title, year: a.year,
      category: a.category, descr: a.desc, origin: a.origin,
      file_url: filePath ?? null,
    }).select('id').single();
    if (error) {
      // Don't leave an unreferenced file eating quota.
      if (filePath) await sb.storage.from('archives').remove([filePath.slice('archives/'.length)]);
      throw error;
    }

    return {
      ...a,
      id: data.id as string,
      filePath,
      fileName: file?.name,
    };
  }

  async updateArchive(treeId: string, personId: string, a: Archive, file: File | null, dropFile: boolean): Promise<Archive> {
    const sb = requireSupabase();
    const previous = a.filePath;
    let filePath = dropFile ? undefined : previous;
    let fileName = dropFile ? undefined : a.fileName;
    let uploaded: string | undefined;

    if (file) {
      uploaded = `${treeId}/${personId}/${objectName(file.name)}`;
      const { error: ue } = await sb.storage.from('archives').upload(uploaded, file, {
        contentType: file.type || 'application/octet-stream',
      });
      if (ue) throw ue;
      filePath = `archives/${uploaded}`;
      fileName = file.name;
    }

    const { error } = await sb.from('archive_records').update({
      title: a.title, year: a.year, category: a.category,
      descr: a.desc, origin: a.origin, file_url: filePath ?? null,
    }).eq('id', a.id);
    if (error) {
      if (uploaded) await sb.storage.from('archives').remove([uploaded]);
      throw error;
    }

    // Only now that nothing references it is the old file safe to remove.
    if (previous && previous !== filePath && previous.startsWith('archives/')) {
      await sb.storage.from('archives').remove([previous.slice('archives/'.length)]);
    }
    return { ...a, filePath, fileName };
  }

  async deleteArchive(a: Archive): Promise<void> {
    const sb = requireSupabase();
    // Row first, file second. If the file removal fails we have only orphaned
    // some storage; the reverse order would leave a record pointing at nothing.
    const { error } = await sb.from('archive_records').delete().eq('id', a.id);
    if (error) throw error;

    if (a.filePath) {
      const slash = a.filePath.indexOf('/');
      if (slash > 0) {
        await sb.storage.from(a.filePath.slice(0, slash)).remove([a.filePath.slice(slash + 1)]);
      }
    }
  }

  async addMedia(treeId: string, personId: string, m: MediaItem, file: Blob): Promise<MediaItem> {
    const sb = requireSupabase();
    // Same bucket as avatars, under a media/ subfolder. Tree id first, as the
    // storage policies require.
    const path = `${treeId}/${personId}/media/${crypto.randomUUID()}.jpg`;
    const { error: ue } = await sb.storage.from('photos').upload(path, file, { contentType: 'image/jpeg' });
    if (ue) throw ue;

    const stored = `photos/${path}`;
    const { data, error } = await sb.from('media_items').insert({
      person_id: personId, title: m.title, kind: m.type,
      size_bytes: file.size, url: stored,
    }).select('id').single();
    if (error) {
      // Don't leave an unreferenced file eating quota.
      await sb.storage.from('photos').remove([path]);
      throw error;
    }
    return { ...m, id: data.id as string, url: stored };
  }

  async deleteMedia(m: MediaItem): Promise<void> {
    const sb = requireSupabase();
    // Row first, as with archives: a failed file removal only orphans storage.
    const { error } = await sb.from('media_items').delete().eq('id', m.id);
    if (error) throw error;
    if (m.url && !/^(https?:|data:|blob:)/.test(m.url)) {
      const slash = m.url.indexOf('/');
      if (slash > 0) await sb.storage.from(m.url.slice(0, slash)).remove([m.url.slice(slash + 1)]);
    }
  }

  async setPhoto(treeId: string, personId: string, dataUrl: string | null): Promise<string | null> {
    const sb = requireSupabase();
    if (!dataUrl) {
      const { error } = await sb.from('persons').update({ photo_url: null }).eq('id', personId);
      if (error) throw error;
      return null;
    }
    const blob = await (await fetch(dataUrl)).blob();
    // Tree id must be the first path segment — the storage policies read it to
    // decide membership. This previously started with the person id, so every
    // upload was rejected by RLS.
    const path = `${treeId}/${personId}/${Date.now()}.jpg`;
    const { error: ue } = await sb.storage.from('photos').upload(path, blob, {
      contentType: 'image/jpeg', upsert: true,
    });
    if (ue) throw ue;

    // The path, not a URL: the bucket is private and getPublicUrl() here
    // returned a link that would never load.
    const stored = `photos/${path}`;
    const { error } = await sb.from('persons').update({ photo_url: stored }).eq('id', personId);
    if (error) throw error;
    return stored;
  }

  async signedUrl(stored: string): Promise<string | null> {
    if (!stored) return null;
    if (/^(https?:|data:|blob:)/.test(stored)) return stored;
    const slash = stored.indexOf('/');
    if (slash < 1) return null;
    const { data, error } = await requireSupabase()
      .storage.from(stored.slice(0, slash))
      .createSignedUrl(stored.slice(slash + 1), 60 * 60);
    return error ? null : data.signedUrl;
  }

  async listInvites(treeId: string): Promise<Invite[]> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('invites').select('*').eq('tree_id', treeId).order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(i => ({
      token: i.token, treeId: i.tree_id, role: i.role,
      createdAt: i.created_at, revokedAt: i.revoked_at ?? undefined,
    }));
  }

  async createInvite(treeId: string, role: Role): Promise<Invite> {
    const sb = requireSupabase();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) throw new Error('Not signed in.');
    const token = randomToken();
    const { data, error } = await sb
      .from('invites')
      .insert({ token, tree_id: treeId, role, created_by: u.user.id })
      .select('*')
      .single();
    if (error) throw error;
    return { token: data.token, treeId: data.tree_id, role: data.role, createdAt: data.created_at };
  }

  async revokeInvite(token: string): Promise<void> {
    const { error } = await requireSupabase()
      .from('invites').update({ revoked_at: new Date().toISOString() }).eq('token', token);
    if (error) throw error;
  }

  /**
   * Goes through the RPC, not a membership insert: RLS forbids self-inserting a
   * membership precisely so nobody can grant themselves admin. redeem_invite()
   * reads the role from the stored invite row, so the ?role= on the link is
   * decoration and cannot be tampered with.
   */
  async redeemInvite(token: string): Promise<string> {
    const sb = requireSupabase();
    const { data, error } = await sb.rpc('redeem_invite', { invite_token: token });
    if (error) throw error;
    return data as string;
  }

  async importPeople(treeId: string, plan: ImportPlan): Promise<void> {
    const { error } = await requireSupabase().rpc('import_people', {
      p_tree: treeId,
      p_people: plan.people,
      p_unions: plan.unions,
      p_root: plan.rootRef,
    });
    if (error) throw error;
  }
}

export const repo: Repository = isSupabaseConfigured
  ? new SupabaseRepository()
  : new LocalRepository();
