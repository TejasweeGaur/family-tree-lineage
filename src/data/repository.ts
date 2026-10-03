import type { Person, Union, Archive, MediaItem, Invite, Role, Session, User, Tree, Member } from '../types';
import { preferredTree } from '../utils/lastTree';
import { isSupabaseConfigured, requireSupabase } from '../lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
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
  /** When anything in the tree last changed. Absent before migration 0004. */
  updatedAt?: string;
}

/**
 * Every data operation the app performs. Two implementations exist: `localRepo`
 * (in-memory, seeded) and `supabaseRepo`. The active one is chosen once, at
 * module load, by whether Supabase credentials are present — so the UI never
 * needs to know which backend it is talking to.
 */
export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT';
export type Membership = Tree & { role: Role };

export interface Repository {
  readonly kind: 'local' | 'supabase';

  // auth
  getSession(): Promise<Session | null>;
  signInWithGoogle(inviteToken?: string): Promise<Session | null>;
  signOut(): Promise<void>;
  /**
   * Fires on real sign-in and sign-out only. Token refreshes and the initial
   * session are deliberately not forwarded: the first is noise (it used to
   * reload the tree hourly) and the second is already handled by getSession().
   */
  onAuthChange(cb: (event: AuthEvent, s: Session | null) => void): () => void;

  // tree
  loadTree(treeId?: string): Promise<TreeSnapshot>;
  /** Every tree the signed-in user belongs to, with their role in each. */
  listMemberships(): Promise<Membership[]>;
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

  // members & tree lifecycle
  /** Everyone with access to the tree. Admins only. */
  listMembers(treeId: string): Promise<Member[]>;
  setMemberRole(treeId: string, userId: string, role: Role): Promise<void>;
  removeMember(treeId: string, userId: string): Promise<void>;
  /** Owner only. Removes the tree, everything in it, and its stored files. */
  deleteTree(treeId: string): Promise<void>;

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

/**
 * Best-effort removal of stored objects given bucket-prefixed paths such as
 * "photos/<tree>/<id>.jpg". Groups by bucket so it's one call per bucket.
 * Failures only orphan a file, so they don't fail the caller.
 */
async function removeStored(sb: SupabaseClient, paths: Array<string | null | undefined>): Promise<void> {
  const byBucket = new Map<string, string[]>();
  for (const p of paths) {
    if (!p || /^(https?:|data:|blob:)/.test(p)) continue;
    const slash = p.indexOf('/');
    if (slash < 1) continue;
    const bucket = p.slice(0, slash);
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), p.slice(slash + 1)]);
  }
  await Promise.all([...byBucket].map(([bucket, keys]) =>
    sb.storage.from(bucket).remove(keys).catch(() => undefined)));
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
  private listeners = new Set<(event: AuthEvent, s: Session | null) => void>();
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
    this.listeners.forEach(cb => cb('SIGNED_IN', session));
    return session;
  }

  async signOut(): Promise<void> {
    localStorage.removeItem(SESSION_KEY);
    this.listeners.forEach(cb => cb('SIGNED_OUT', null));
  }

  onAuthChange(cb: (event: AuthEvent, s: Session | null) => void): () => void {
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

  async listMemberships(): Promise<Membership[]> { return []; }
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

  async listMembers(): Promise<Member[]> {
    return [{ userId: DEMO_USER.id, email: DEMO_USER.email, name: DEMO_USER.name, role: 'admin', joinedAt: new Date().toISOString(), isOwner: true }];
  }
  async setMemberRole() {}
  async removeMember() {}
  async deleteTree() {}
}

// ---------------------------------------------------------------- supabase

/**
 * Cache lifetime for uploaded files, in seconds. Every upload gets a fresh
 * path and nothing is ever overwritten in place, so a file never changes
 * under its name and the browser can keep it for a year.
 */
const IMMUTABLE = '31536000';

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
    // The column is still named "maiden" from before it became the middle name.
    id: r.id, first: r.first, last: r.last, middle: r.maiden, gender: r.gender,
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
    first: p.first, last: p.last, maiden: p.middle, gender: p.gender,
    dob: p.dob, pob: p.pob, dod: p.dod, pod: p.pod,
    occupation: p.occupation, residency: p.residency,
    gotra: p.gotra, shasan: p.shasan, label: p.label, bio: p.bio,
    // photo_url is deliberately absent: setPhoto() owns that column. Writing it
    // here could store an in-flight upload's data: URL (~100 KB of text) if a
    // profile was saved while its photo was still uploading.
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

  /**
   * Turn a Supabase auth user into an app session. A user can belong to several
   * trees; this lands them on the one they last had open, falling back to the
   * one they joined first. It used to take an arbitrary `limit(1)` row, so a
   * reload could drop someone into a different family's tree.
   */
  private async hydrate(authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }): Promise<Session | null> {
    const sb = requireSupabase();
    const { data: rows } = await sb
      .from('memberships')
      .select('role, tree_id')
      .eq('user_id', authUser.id)
      .order('joined_at');

    const preferred = preferredTree(authUser.id);
    const m = rows?.find(r => r.tree_id === preferred) ?? rows?.[0];

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

  onAuthChange(cb: (event: AuthEvent, s: Session | null) => void): () => void {
    const sb = requireSupabase();
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { cb('SIGNED_OUT', null); return; }
      // INITIAL_SESSION is covered by getSession(); TOKEN_REFRESHED and
      // USER_UPDATED change nothing the app displays. Supabase also re-emits
      // SIGNED_IN when a tab regains focus — the store de-duplicates that.
      if (event !== 'SIGNED_IN' || !session) return;
      // Deferred: awaiting the Supabase client inside this callback can
      // deadlock it (documented supabase-js behaviour). The old code did.
      setTimeout(() => {
        void this.hydrate(session.user).then(s => cb('SIGNED_IN', s));
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }


  async loadTree(treeId?: string): Promise<TreeSnapshot> {
    const sb = requireSupabase();

    if (!treeId) throw new Error('No family archive selected.');

    // Three requests in parallel, each scoped to this tree. Records, media and
    // child links come embedded with their person or union, so nothing is
    // fetched for the other trees the user belongs to.
    const [
      { data: tree, error: te },
      { data: pRows, error: pe },
      { data: uRows, error: ue },
    ] = await Promise.all([
      sb.from('trees')
        // '*' rather than a column list: updated_at only exists after migration
        // 0004, and naming it here would break every load until that's run.
        .select('*')
        .eq('id', treeId)
        .maybeSingle(),
      sb.from('persons')
        .select('*, archive_records (*), media_items (*)')
        .eq('tree_id', treeId)
        .order('created_at')
        .order('created_at', { referencedTable: 'archive_records' })
        .order('created_at', { referencedTable: 'media_items' }),
      sb.from('unions')
        .select('*, union_children (child_id)')
        .eq('tree_id', treeId),
    ]);
    if (te) throw te;
    if (!tree) throw new Error('Tree not found or you are not a member of it.');
    if (pe) throw pe;
    if (ue) throw ue;

    type ArchiveRow = { id: string; title: string; year: string; category: string; descr: string; origin: string; file_url: string | null };
    type MediaRow = { id: string; title: string; kind: MediaItem['type']; size_bytes: number; url: string | null };
    const toArchive = (a: ArchiveRow): Archive => ({
      id: a.id, title: a.title, year: a.year, category: a.category,
      desc: a.descr, origin: a.origin,
      filePath: a.file_url ?? undefined,
      fileName: a.file_url ? displayName(a.file_url) : undefined,
    });
    const toMedia = (m: MediaRow): MediaItem => ({
      id: m.id, title: m.title, type: m.kind,
      size: m.size_bytes ? `${(m.size_bytes / 1048576).toFixed(1)} MB` : '',
      url: m.url ?? undefined,
    });

    const persons = (pRows ?? []).map(r => rowToPerson(
      r as PersonRow,
      ((r.archive_records ?? []) as ArchiveRow[]).map(toArchive),
      ((r.media_items ?? []) as MediaRow[]).map(toMedia),
    ));

    // Children display in birth order.
    const dobOf = new Map(persons.map(p => [p.id, p.dob]));
    const unions: Union[] = (uRows ?? []).map(u => ({
      id: u.id, a: u.partner_a, b: u.partner_b, date: u.date, place: u.place,
      children: ((u.union_children ?? []) as Array<{ child_id: string }>).map(c => c.child_id).sort((x, y) =>
        String(dobOf.get(x) ?? '').localeCompare(String(dobOf.get(y) ?? '')),
      ),
    }));

    return {
      treeId: tree.id,
      treeName: tree.name,
      originPlace: tree.origin_place,
      originCountry: tree.origin_country,
      updatedAt: tree.updated_at ?? undefined,
      rootId: tree.root_person_id ?? persons[0]?.id ?? '',
      persons,
      unions,
    };
  }

  async listMemberships(): Promise<Membership[]> {
    const sb = requireSupabase();
    // getSession reads the stored session; getUser would make a round trip to
    // the auth server just to learn the id. The database checks the token on
    // the query itself, so nothing is trusted that wasn't before.
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return [];
    const { data, error } = await sb
      .from('memberships')
      .select('role, trees ( id, name, origin_place, origin_country, created_by )')
      .eq('user_id', session.user.id)
      .order('joined_at');
    if (error) throw error;
    return (data ?? []).flatMap(r => {
      // PostgREST types a to-one embed as an array or object depending on
      // inference; handle both.
      const t = (Array.isArray(r.trees) ? r.trees[0] : r.trees) as
        { id: string; name: string; origin_place: string; origin_country: string; created_by: string } | null;
      return t ? [{
        id: t.id, name: t.name,
        originPlace: t.origin_place ?? '', originCountry: t.origin_country ?? '',
        role: r.role as Role,
        ownerId: t.created_by,
      }] : [];
    });
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
    const sb = requireSupabase();
    // Collect the person's files first: the row delete cascades to their
    // archive and media rows, after which there'd be no record of the paths.
    const [{ data: p }, { data: arc }, { data: med }] = await Promise.all([
      sb.from('persons').select('photo_url').eq('id', id).maybeSingle(),
      sb.from('archive_records').select('file_url').eq('person_id', id),
      sb.from('media_items').select('url').eq('person_id', id),
    ]);

    const { error } = await sb.from('persons').delete().eq('id', id);
    if (error) throw error;

    // Then the files. Previously they were left in storage forever.
    await removeStored(sb, [
      p?.photo_url,
      ...(arc ?? []).map(a => a.file_url),
      ...(med ?? []).map(m => m.url),
    ]);
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
        contentType: file.type || 'application/octet-stream', cacheControl: IMMUTABLE,
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
        contentType: file.type || 'application/octet-stream', cacheControl: IMMUTABLE,
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
    const { error: ue } = await sb.storage.from('photos').upload(path, file, { contentType: 'image/jpeg', cacheControl: IMMUTABLE });
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

    // Read the current photo first so it can be removed once replaced. Each
    // upload gets a fresh name, so without this every change or removal left
    // the old file in the bucket, quietly eating the free-tier quota.
    const { data: current } = await sb.from('persons').select('photo_url').eq('id', personId).single();
    const previous = (current?.photo_url as string | null) ?? null;

    let stored: string | null = null;
    let uploaded: string | null = null;
    if (dataUrl) {
      const blob = await (await fetch(dataUrl)).blob();
      // Tree id must be the first path segment — the storage policies read it
      // to decide membership.
      uploaded = `${treeId}/${personId}/${Date.now()}.jpg`;
      const { error: ue } = await sb.storage.from('photos').upload(uploaded, blob, {
        contentType: 'image/jpeg', upsert: true, cacheControl: IMMUTABLE,
      });
      if (ue) throw ue;
      // The path, not a URL: the bucket is private, so URLs are signed on read.
      stored = `photos/${uploaded}`;
    }

    const { error } = await sb.from('persons').update({ photo_url: stored }).eq('id', personId);
    if (error) {
      if (uploaded) await sb.storage.from('photos').remove([uploaded]);
      throw error;
    }

    // Only now that nothing references it is the old file safe to delete.
    if (previous && previous !== stored && previous.startsWith('photos/')) {
      await sb.storage.from('photos').remove([previous.slice('photos/'.length)]);
    }
    return stored;
  }


  async signedUrl(stored: string): Promise<string | null> {
    if (!stored) return null;
    if (/^(https?:|data:|blob:)/.test(stored)) return stored;
    const slash = stored.indexOf('/');
    if (slash < 1) return null;
    const bucket = stored.slice(0, slash);
    const path = stored.slice(slash + 1);
    // A tree full of photos asks for its URLs all in the same moment; collect
    // them for a tick and sign each bucket's batch in one request.
    let batch = this.signBatches.get(bucket);
    if (!batch) {
      const fresh = { paths: new Map<string, Array<(u: string | null) => void>>() };
      this.signBatches.set(bucket, fresh);
      setTimeout(() => void this.flushSignBatch(bucket, fresh.paths), 0);
      batch = fresh;
    }
    const waiting = batch.paths.get(path) ?? [];
    batch.paths.set(path, waiting);
    return new Promise(resolve => waiting.push(resolve));
  }

  private signBatches = new Map<string, { paths: Map<string, Array<(u: string | null) => void>> }>();

  private async flushSignBatch(bucket: string, paths: Map<string, Array<(u: string | null) => void>>) {
    this.signBatches.delete(bucket);
    const list = [...paths.keys()];
    const urls = new Map<string, string>();
    try {
      const { data } = await requireSupabase().storage.from(bucket).createSignedUrls(list, 60 * 60);
      (data ?? []).forEach(d => { if (d.path && d.signedUrl && !d.error) urls.set(d.path, d.signedUrl); });
    } catch {
      // Unsigned paths resolve to null below; the image simply doesn't show.
    }
    paths.forEach((resolvers, path) => resolvers.forEach(r => r(urls.get(path) ?? null)));
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
  async listMembers(treeId: string): Promise<Member[]> {
    const { data, error } = await requireSupabase().rpc('list_members', { p_tree: treeId });
    if (error) throw error;
    return ((data ?? []) as Array<{
      user_id: string; email: string; name: string; avatar_url: string | null;
      role: Role; joined_at: string; is_owner: boolean;
    }>).map(m => ({
      userId: m.user_id, email: m.email, name: m.name, avatarUrl: m.avatar_url ?? undefined,
      role: m.role, joinedAt: m.joined_at, isOwner: m.is_owner,
    }));
  }

  // RLS turns a disallowed write into "0 rows affected" rather than an error,
  // so both of these check the count and say so instead of failing silently.
  async setMemberRole(treeId: string, userId: string, role: Role): Promise<void> {
    const { error, count } = await requireSupabase()
      .from('memberships').update({ role }, { count: 'exact' })
      .eq('tree_id', treeId).eq('user_id', userId);
    if (error) throw error;
    if (!count) throw new Error('That change was not allowed.');
  }

  async removeMember(treeId: string, userId: string): Promise<void> {
    const { error, count } = await requireSupabase()
      .from('memberships').delete({ count: 'exact' })
      .eq('tree_id', treeId).eq('user_id', userId);
    if (error) throw error;
    if (!count) throw new Error('That person could not be removed.');
  }

  async deleteTree(treeId: string): Promise<void> {
    const sb = requireSupabase();
    const { data: u } = await sb.auth.getUser();
    const { data: tree, error: te } = await sb.from('trees').select('created_by').eq('id', treeId).maybeSingle();
    if (te) throw te;
    if (!tree) throw new Error('That tree no longer exists.');
    // Checked up front: files go first (below), so a refusal must come before them.
    if (tree.created_by !== u.user?.id) throw new Error("Only the tree's owner can delete it.");

    // Files before rows. Storage access comes from tree membership, which the
    // row delete removes — after it, these files could no longer be deleted.
    const [{ data: ps }, { data: arc }, { data: med }] = await Promise.all([
      sb.from('persons').select('photo_url').eq('tree_id', treeId),
      sb.from('archive_records').select('file_url, persons!inner(tree_id)').eq('persons.tree_id', treeId),
      sb.from('media_items').select('url, persons!inner(tree_id)').eq('persons.tree_id', treeId),
    ]);
    await removeStored(sb, [
      ...(ps ?? []).map(p => p.photo_url),
      ...(arc ?? []).map(a => a.file_url),
      ...(med ?? []).map(m => m.url),
    ]);

    const { error, count } = await sb.from('trees').delete({ count: 'exact' }).eq('id', treeId);
    if (error) throw error;
    if (!count) throw new Error('The tree was not deleted. Its files were removed — try again to finish.');
  }

  async redeemInvite(token: string): Promise<string> {
    const sb = requireSupabase();
    const { data, error } = await sb.rpc('redeem_invite', { invite_token: token });
    if (error) throw error;
    return data as string;
  }

  async importPeople(treeId: string, plan: ImportPlan): Promise<void> {
    const { error } = await requireSupabase().rpc('import_people', {
      p_tree: treeId,
      // import_people reads the middle name from the "maiden" key, after the column.
      p_people: plan.people.map(({ middle, ...p }) => ({ ...p, maiden: middle })),
      p_unions: plan.unions,
      p_root: plan.rootRef,
    });
    if (error) throw error;
  }
}

export const repo: Repository = isSupabaseConfigured
  ? new SupabaseRepository()
  : new LocalRepository();
