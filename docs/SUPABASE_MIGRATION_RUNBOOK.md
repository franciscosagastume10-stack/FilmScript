# FilmScript AWS to Supabase migration runbook

This runbook targets the paid Supabase project `nkuyfryxookojkvductn` in
`us-east-2`. The separate project `bslvwnaqlriraudlpkxm` is not part of this
migration and must never receive FilmScript production data.

## Safety rules

- Keep AWS as the production source until every cutover gate passes.
- Never run migration operations with the AWS root identity.
- Never commit or print provider secrets, access tokens, database passwords,
  service-role keys, OAuth secrets, or customer data.
- Preserve all existing FilmScript identifiers (`usr_*`, `scr_*`, `mem_*`,
  and similar) as text.
- Apply every remote schema change from a reviewed migration file.
- Keep `private` and `billing` outside the Supabase Data API.
- Do not change Google or Recurrente callbacks until the replacement endpoint
  is healthy and rollback has been tested.
- Do not remove ECS, EFS, S3, CloudFormation, DNS, or Secrets Manager during
  the cutover window.

## Current production source

- AWS region: `us-east-2`
- ECS service/cluster: `filmscript-production`
- EFS: `fs-0881b52db630e44bc`
- S3: `filmscript-production-mediabucket-xzgdb1rat94u`
- SQLite schema version: `18`
- Current SQLite tables: `33`
- Current S3 objects: `212` (about 61 MiB)
- API: `https://api.filmscript.app`

## Phase 1: local foundation

```bash
cd /tmp/filmscript-supabase-RBBBMh
supabase --version
supabase projects list --output json
supabase migration list --linked
```

Expected project ref: `nkuyfryxookojkvductn`. Stop if any other project is
shown as the linked project.

Build and validate locally:

```bash
supabase start -x studio,imgproxy,edge-runtime,logflare,vector
supabase db reset
supabase db lint --local --level warning --fail-on warning
./scripts/run-node.sh --test tests/supabase-*.test.mjs
npm run typecheck
npm run lint
npm run build:vercel
```

## Phase 2: source export

Before starting this phase, authenticate through IAM Identity Center or a
short-lived administrative role. `aws sts get-caller-identity` must not return
an ARN ending in `:root`.

1. Record the active ECS task definition, image digest, CloudFormation stack,
   Vercel production deployment, and DNS records.
2. Launch a one-off Fargate export task using the production EFS access point.
3. Open SQLite read-only and run `PRAGMA integrity_check` and
   `PRAGMA foreign_key_check`.
4. Create a consistent SQLite backup, a table manifest, canonical row hashes,
   and a file SHA-256.
5. Inventory every current S3 object with key, size, ETag, content type, and
   SHA-256. Multipart ETags are not accepted as content hashes.
6. Store export artifacts in a dedicated migration prefix and retain the
   source recovery point.

The initial export may occur while production is open. The final export must
occur under maintenance mode with the ECS writer drained.

## Phase 3: remote schema

Only after local reset and lint pass:

```bash
supabase db push --dry-run --include-all
supabase db push --include-all
supabase migration list --linked
```

The dry run must contain only reviewed migrations. Stop on any unexpected
drop, truncate, ownership change, grant, or exposed schema.

## Phase 4: configuration

- Site URL: `https://filmscript.app`
- Local callback URLs: `http://127.0.0.1:4173`
- Google callback: use the exact callback shown by the Supabase Auth provider
  for project `nkuyfryxookojkvductn`.
- Storage bucket: `filmscript-private`, private.
- Realtime channels: private project/user topics only.
- Secrets: Supabase/Vercel server-side stores only.
- Service-role key: server-side only; never expose it in HTML or public Vercel
  variables.

Do not purchase a custom domain, read replica, larger compute, or another paid
add-on during migration without explicit approval.

## Phase 5: initial import

Do not import customer rows into the production `public`, `private`, or
`billing` schemas while AWS is still accepting writes. The importer is
deliberately insert-only: it does not merge rows or infer deletes, and running
it twice against the same target must fail instead of overwriting data.

Before the final maintenance window, rehearse the following load against a
fresh local database or a separately isolated staging project/schema only.
Never use the paid production schemas as the rehearsal destination.

Import in this order:

1. profiles and Auth mapping;
2. scripts;
3. memberships and project state;
4. preproduction, Canvas, libraries, and locations;
5. subscriptions, checkouts, processed events, and credits;
6. invitations, shared projects, and guests;
7. activity, notifications, comments, mentions, and messages;
8. AI jobs and attempts;
9. collaboration snapshots, entities, operations, and conflicts;
10. receipts, media metadata, and release acknowledgements.

Load raw exports into staging first, validate every JSON value, and transform
into final tables inside transactions. An invalid JSON document aborts the
import; it is never silently replaced.

Copy Storage objects while preserving their existing object names. Generate a
destination manifest and compare object counts, byte sizes, and SHA-256 hashes.

The production import happens exactly once from the final schema-18 snapshot,
after writes are frozen and the destination application tables have been
verified empty. If that import fails, roll back the whole transaction, keep the
application closed, correct the migration, recreate the empty destination and
run the full import again. There is no unsafe "delta merge" fallback.

## Phase 6: compatibility and Preview

The application must support explicit database and storage drivers before any
cutover:

```text
FILMSCRIPT_DB_DRIVER=sqlite|postgres
FILMSCRIPT_STORAGE_DRIVER=s3|supabase
```

The existing Node API is synchronous SQLite code and cannot be switched merely
by changing these variables. First deploy the isolated `/api/supabase/*`
Preview route and prove Supabase Auth, project CRUD, RLS and one private Storage
round-trip. Port the remaining route families incrementally. Production remains
on AWS until the route inventory has zero legacy fallbacks in `supabase` mode.

Deploy the migration branch to a Vercel Preview. Keep production on AWS. Test:

- existing and new Google login;
- profile and language;
- project list/create/edit/reopen;
- Editor, Breakdown/Split View, Analysis, Stripboard, Shot List;
- Imagine, Canvas, private uploads and downloads;
- Calendar and Budget, including receipts;
- invitations, memberships, comments, messages and notifications;
- translation and other AI jobs;
- credits reserve/settle/refund exactly once;
- Recurrente duplicate webhook idempotency;
- PDF import/export;
- two-user collaboration and reconnect;
- English/Spanish, desktop and mobile.

## Cutover gates

Every gate is mandatory:

- SQLite integrity and foreign-key checks pass.
- Exact source/destination row count for every table.
- No duplicate primary keys or orphaned foreign keys.
- Canonical hashes match for all JSON and bytea values.
- Every current object exists in Storage with matching size and SHA-256.
- Every project has exactly one active owner.
- The RLS matrix passes for owner, admin, editor, department editor,
  commenter, viewer, and guest.
- Subscription state, periods, processed webhook IDs, balances, reservations,
  and ledger totals match exactly.
- Preview smoke tests pass.
- Error rate stays below 1 percent and no authorization leak is observed.
- Rollback to the current Vercel deployment and AWS API has been rehearsed.

## Final cutover

1. Enable maintenance mode and stop new writes.
2. Drain in-flight AI, translation, billing, and upload operations.
3. Create a fresh EFS recovery point and final consistent SQLite backup.
4. Verify the Supabase application schemas are empty, then run one full
   insert-only database import and one full S3-to-Storage copy from the final
   frozen manifests.
5. Re-run every reconciliation gate.
6. Switch server configuration to Postgres and Supabase Storage.
7. Update Google and Recurrente callbacks only after the new endpoints pass
   direct health checks.
8. Deploy the reviewed Vercel production commit.
9. Run three complete smoke passes.
10. Reopen writes and begin hypercare.

## Automatic rollback triggers

Rollback immediately on any of the following:

- missing or cross-account project/file access;
- authentication failures above 1 percent;
- API 5xx above 2 percent for five minutes;
- Storage failures above 1 percent;
- duplicate/missing billing events or credits;
- reconciliation drift;
- collaboration corruption;
- p95 latency above twice the AWS baseline for ten minutes.

Rollback procedure:

1. Re-enable maintenance mode.
2. Restore the previous Vercel deployment and AWS API routing.
3. Confirm ECS health and data access.
4. Export/replay any accepted Supabase-only writes.
5. Reconcile before reopening production.

Keep AWS available for at least 7–14 stable days. Keep independent Postgres and
Storage backups; Supabase database backups do not contain Storage objects.
