# Family Tree & Heritage Archive

A genealogy web app: an interactive family tree, per-person heritage profiles with document
archives, a kinship explainer, a searchable directory, and PDF/Excel export.

Real family data lives in Supabase. Everything checked into this repository — the demo
roster in `src/data/seed.ts` and the placeholder sign-in identity — is **fictional**.

## Stack

| | |
|---|---|
| Build | Vite 8 |
| UI | React 19 + TypeScript |
| Styling | Tailwind v3 + inline design tokens |
| State | Zustand v5 |
| Backend | Supabase (Postgres + Auth + Storage) |
| Export | ExcelJS (lazy-loaded), print-window for PDF |

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

With no Supabase credentials present the app runs in **demo mode**: seed data from
`src/data/seed.ts`, an in-memory tree, and a sample signed-in account. Everything is
browsable and editable, but nothing persists across a reload.

### Scripts

| Command | |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | `tsc -b` then production build |
| `npm run lint` | oxlint |
| `npm run preview` | Serve the production build |

## Connecting Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor. It creates the schema, the
   `security definer` role helpers, and the RLS policies.
3. Enable the Google provider under **Authentication → Providers**.
4. Copy `.env.example` to `.env.local` and fill in:

   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

The app switches backends purely on the presence of `VITE_SUPABASE_URL` — see
`repo` at the bottom of `src/data/repository.ts`. Nothing else needs to change.

## Architecture

```
src/
  data/
    repository.ts   Repository interface + LocalRepository | SupabaseRepository
    seed.ts         Fictional demo fixtures (21 people, 7 unions)
  store/
    useTreeStore.ts Single Zustand store: data, view state, dialogs, all mutations
  utils/
    layout.ts       Recursive tree layout — bottom-up measure(), top-down place()
    kinship.ts      Relationship naming + branch traversal
    export.ts       Excel workbook + print-window PDF
    image.ts        Client-side avatar crop and downscale
  components/       One file per surface; no shared component library
```

### Things worth knowing before you edit

- **Zustand v5 uses strict reference equality.** A selector returning an object literal
  creates a new reference on every render and the app will loop
  (`"The result of getSnapshot should be cached"`). Select primitives individually, or
  destructure the whole store with `useTreeStore()`.
- **Roles are never trusted from the client.** `SupabaseRepository.hydrate()` reads the
  caller's role from the `memberships` table, and RLS enforces it server-side. Admin
  affordances are *hidden* for viewers, not disabled.
- **Kinship in-law lookup hops through at most one spouse** and is depth-guarded. An
  earlier version recursed infinitely; `kin()` takes a `depth` argument for that reason.
- **A person has at most one parent union**, enforced by `primary key (child_id)` on
  `union_children` rather than in application code.
- **Deletion is blocked for anyone with descendants**, in both the UI and a database
  trigger.
- **ExcelJS is dynamically imported** inside `exportExcel()` — it is ~900 kB and would
  otherwise quadruple the initial bundle.

## Status

Feature-complete against the v1 spec, with two gaps:

- **CSV import/export** is stubbed behind a notice toast (marked `[Backend]` in the spec).
- **Photo upload** is implemented but has only been exercised through code, not a real file.
