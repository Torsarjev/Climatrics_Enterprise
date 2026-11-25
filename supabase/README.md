# Supabase

Supabase is set up as a second storage backend. Netlify Blobs remains the live backend until
`DATA_BACKEND=supabase` is set, so nothing moves until migration day.

## What is here

- `migrations/20261125000000_app_kv.sql` creates one table, `app_kv`, holding the same documents
  the app keeps in Netlify Blobs (`store.json`, loan-book CSVs, screening snapshots), plus two
  functions: `kv_put` (write) and `kv_cas` (write only if unchanged since read).
  Row-level security is on with no policies, so only the server's service-role key can read or
  write. Browser (anon) keys are refused.
- `src/lib/kv.ts` talks to Supabase over its REST API when `DATA_BACKEND=supabase`.
- `scripts/copy-to-supabase.mjs` copies the live data from Netlify Blobs into Supabase.
  Dry run by default; `--apply` writes and verifies each document.
- `GET /api/health` reports `backend` (`blobs`, `supabase` or `file`) and whether storage answers.

## 1. Create the project (PM, once)

1. Create a project at supabase.com. Region: closest to Ghana (EU West, e.g. `eu-west-2` London).
2. SQL Editor → paste and run `migrations/20261125000000_app_kv.sql`.
3. Project Settings → API: copy the **Project URL** and the **service_role** key.
   The service_role key bypasses security: keep it in Netlify only, never in code, chat or the browser.

## 2. Add the keys to Netlify (any time; nothing changes yet)

Site configuration → Environment variables:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (mark as secret) |

Do **not** add `DATA_BACKEND` yet.

## 3. Migration day

1. Copy the data (from a machine with the repo):
   ```
   NETLIFY_SITE_ID=… NETLIFY_AUTH_TOKEN=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
     node scripts/copy-to-supabase.mjs            # dry run: lists what would be copied
   … node scripts/copy-to-supabase.mjs --apply    # copies and verifies each document
   ```
2. In Netlify, add `DATA_BACKEND` = `supabase`, then redeploy (re-run the GitHub Action).
3. Check `https://climatrics01.netlify.app/api/health` shows `"backend":"supabase","storage":"ok"`.
4. Sign in and confirm the latest runs, screenings and audit trail are there.

**Rollback:** delete `DATA_BACKEND` in Netlify and redeploy. The Blobs data is untouched by the copy,
but anything written while on Supabase stays in Supabase.

Changing `SESSION_SECRET_KEY` is unrelated to the database but breaks every authenticator app; leave it.

## Later (phase 2)

Split `app_kv` into proper tables (datasets, runs, audit, screening runs, criterion results, …) as
the Engine I brief lists, once the demo data model settles.
