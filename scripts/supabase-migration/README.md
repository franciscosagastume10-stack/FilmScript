# FilmScript SQLite/S3 to Supabase migration tools

These tools prepare, validate, import, and reconcile a FilmScript migration without changing the legacy AWS source. Every artifact contains private application data and must be stored outside the repository on an encrypted volume.

## Safety guarantees

- SQLite is opened read-only and copied with SQLite's online backup API.
- `integrity_check` and `foreign_key_check` run on the source and again on the copied snapshot.
- Rows use deterministic primary-key order, canonical NDJSON, counts, and SHA-256 hashes.
- BLOB sidecars are hashed and checked before every transform/import.
- Legacy FilmScript text IDs (`usr_*`, `scr_*`, and related IDs) are preserved.
- `sessions`, `oauth_states`, and `auth_handoffs` are deliberately excluded.
- Postgres import is insert-only, wrapped in one transaction, and aborts on an existing primary key or any constraint failure. It never disables triggers or foreign keys.
- Storage upload never overwrites an object. A retry only accepts an existing object after downloading and matching its size and SHA-256.
- An operation marked `--environment production` is refused unless the same invocation includes `--confirm production`.
- `--environment local` accepts only exact loopback destinations (`localhost`, `127.0.0.1`, or `::1`); it cannot be used to bypass the project-ref check for a remote endpoint.
- Every remote database or Storage operation requires the exact 20-character `--project-ref` and accepts only an official Supabase endpoint for that project.
- Database URLs and service-role keys are read from environment variables only. They are never accepted as command arguments or printed.
- Import failures report only a process exit code; raw database diagnostics are suppressed because they can contain customer rows.
- Postgres and Storage capture manifests record the destination host, environment, and project ref. Reconciliation requires the operator to state the expected destination and rejects evidence from another environment or project.
- Full bundles require exactly one active `owner` membership per project, and that membership must match `scripts.user_id`. Missing, duplicate, mismatched, or orphan owners stop the transform and are rechecked whenever the bundle is loaded.
- A full transform requires an unprefixed inventory of the complete production S3 bucket `filmscript-production-mediabucket-xzgdb1rat94u`. Partial-schema bundles exist only for fixtures and local validation; they cannot be imported, reconciled, or copied to a remote destination.

The Postgres tools resolve `psql` in this order: `PSQL_BIN`, `PATH`, `/opt/homebrew/opt/libpq/bin/psql`, then `/usr/local/opt/libpq/bin/psql`. Homebrew `libpq` does not need to be globally linked.

## 1. Create and verify a SQLite snapshot

Dry-run is not meaningful for a local backup, so this command creates only a new exclusive output directory and never overwrites one:

```bash
node scripts/supabase-migration/snapshot-sqlite.mjs \
  --source /secure/source/filmscript.sqlite \
  --output /secure/migration-artifacts/sqlite-export \
  --environment production \
  --confirm production
```

Verify it again at any point:

```bash
node scripts/supabase-migration/snapshot-sqlite.mjs \
  --validate /secure/migration-artifacts/sqlite-export
```

The export contains `source.sqlite`, `manifest.json`, one canonical NDJSON file per table, and deduplicated BLOB sidecars.

## 2. Inventory legacy S3 without changing it

Review the operation without contacting AWS:

```bash
node scripts/supabase-migration/inventory-s3.mjs \
  --bucket filmscript-production-mediabucket-xzgdb1rat94u \
  --output /secure/migration-artifacts/s3-inventory.json \
  --environment production \
  --confirm production \
  --dry-run
```

Then produce the real read-only inventory. It reads every current object once so the manifest contains a real SHA-256 rather than relying on S3 ETags:

```bash
node scripts/supabase-migration/inventory-s3.mjs \
  --bucket filmscript-production-mediabucket-xzgdb1rat94u \
  --output /secure/migration-artifacts/s3-inventory.json \
  --environment production \
  --confirm production
```

## 3. Transform into the Supabase bundle

```bash
node scripts/supabase-migration/transform-bundle.mjs \
  --export /secure/migration-artifacts/sqlite-export \
  --s3-inventory /secure/migration-artifacts/s3-inventory.json \
  --output /secure/migration-artifacts/postgres-bundle
```

The default mapping matches the versioned Supabase migrations in this repository:

- SQLite `users` becomes `public.profiles`, with nullable `auth_user_id` for later Supabase Auth claiming.
- `*_json` text is parsed strictly and becomes JSONB without the suffix.
- SQLite `0/1` flags become booleans and dates/timestamps are normalized.
- collaboration snapshots remain byte-identical `bytea`.
- budget receipt BLOBs become private Storage objects plus `public.media_objects` and `private.budget_receipts` metadata.
- Canvas and shot-reference S3 keys remain unchanged, while deterministic media rows provide authorization and reconciliation metadata.
- private invitations/shares/provider data and billing data go to their non-browser schemas.

Any unknown SQLite table, malformed JSON, invalid date, invalid project ownership graph, missing S3 project, incomplete/wrong-bucket S3 inventory, duplicate ID, duplicate Storage path, or checksum mismatch stops the transform.

Audit every schema-v18 source column against the real target schema before creating import SQL:

```bash
export FILMSCRIPT_MIGRATION_DB_URL='postgresql://...'
node scripts/supabase-migration/audit-mapping.mjs \
  --export /secure/migration-artifacts/sqlite-export \
  --bundle /secure/migration-artifacts/postgres-bundle \
  --environment staging \
  --project-ref STAGING_PROJECT_REF \
  --database-url-env FILMSCRIPT_MIGRATION_DB_URL \
  --output /secure/migration-artifacts/mapping-audit.json
```

The audit accepts only the exact mapping file whose SHA-256 was recorded when the bundle was transformed. It fails if a migratable SQLite column has no destination, if a bundle column does not exist in Postgres, if a JSON/boolean/date/BLOB type is incompatible, or if an inserted target row would omit a required column without a default. It lists the four deliberate skips separately: `schema_meta`, `sessions`, `oauth_states`, and `auth_handoffs`. The `budget_receipts.data_blob` special route to Storage is also reported explicitly.

## 4. Review the Postgres import

The default behavior is dry-run. `--sql-out` writes a mode-0600 review file which also contains private data:

```bash
node scripts/supabase-migration/import-postgres.mjs \
  --bundle /secure/migration-artifacts/postgres-bundle \
  --dry-run \
  --sql-out /secure/migration-artifacts/import-review.sql
```

Apply to Preview or staging only after the Supabase migrations have been applied there:

```bash
export FILMSCRIPT_MIGRATION_DB_URL='postgresql://...'
node scripts/supabase-migration/import-postgres.mjs \
  --bundle /secure/migration-artifacts/postgres-bundle \
  --apply \
  --environment staging \
  --project-ref STAGING_PROJECT_REF \
  --database-url-env FILMSCRIPT_MIGRATION_DB_URL
```

Production additionally requires its exact ref and confirmation:

```text
--environment production --confirm production --project-ref nkuyfryxookojkvductn
```

If any row or constraint fails, Postgres rolls back the entire import.
Before inserting anything, the same transaction and advisory lock also require empty bundle tables, `auth.users`, the `filmscript-private` Storage bucket, and all normalized credit/allowance tables. This prevents importing into a partially initialized destination.

## 5. Reconcile Postgres

Preview the read-only capture query locally:

```bash
node scripts/supabase-migration/capture-postgres-manifest.mjs \
  --bundle /secure/migration-artifacts/postgres-bundle \
  --environment staging \
  --dry-run
```

Capture target rows using a read-only transaction, then reconcile counts, primary keys, canonical rows, JSON, and bytea hashes:

```bash
node scripts/supabase-migration/capture-postgres-manifest.mjs \
  --bundle /secure/migration-artifacts/postgres-bundle \
  --database-url-env FILMSCRIPT_MIGRATION_DB_URL \
  --environment staging \
  --project-ref STAGING_PROJECT_REF \
  --output /secure/migration-artifacts/postgres-capture.json

node scripts/supabase-migration/reconcile.mjs \
  --bundle /secure/migration-artifacts/postgres-bundle \
  --capture /secure/migration-artifacts/postgres-capture.json \
  --expected-environment staging \
  --expected-project-ref STAGING_PROJECT_REF
```

Reconciliation exits with status `2` when data differs and lists missing, unexpected, and content-mismatched primary keys.

## 6. Build and copy the Storage manifest

Create a self-contained manifest. Local receipt BLOBs are staged by SHA-256; legacy S3 entries stay read-only references until copy time:

```bash
node scripts/supabase-migration/create-storage-manifest.mjs \
  --bundle /secure/migration-artifacts/postgres-bundle \
  --output /secure/migration-artifacts/storage-manifest
```

Validate the full plan without contacting either provider:

```bash
node scripts/supabase-migration/copy-storage.mjs \
  --manifest /secure/migration-artifacts/storage-manifest \
  --dry-run
```

Apply to staging. The key must be a server-side Supabase service-role key and must never be exposed to frontend code:

```bash
export FILMSCRIPT_SUPABASE_URL='https://PROJECT_REF.supabase.co'
export FILMSCRIPT_SUPABASE_SERVICE_ROLE_KEY='...'
node scripts/supabase-migration/copy-storage.mjs \
  --manifest /secure/migration-artifacts/storage-manifest \
  --apply \
  --environment staging \
  --project-ref STAGING_PROJECT_REF \
  --supabase-url-env FILMSCRIPT_SUPABASE_URL \
  --service-role-key-env FILMSCRIPT_SUPABASE_SERVICE_ROLE_KEY \
  --output /secure/migration-artifacts/storage-copy-report.json
```

## 7. Reconcile Storage

This optional validation downloads each copied object once from Supabase to calculate its SHA-256. Run it before cutover; it causes Storage read/egress equal to the migrated object size.

```bash
node scripts/supabase-migration/capture-storage-manifest.mjs \
  --manifest /secure/migration-artifacts/storage-manifest \
  --environment staging \
  --project-ref STAGING_PROJECT_REF \
  --supabase-url-env FILMSCRIPT_SUPABASE_URL \
  --service-role-key-env FILMSCRIPT_SUPABASE_SERVICE_ROLE_KEY \
  --output /secure/migration-artifacts/storage-capture.json

node scripts/supabase-migration/reconcile-storage.mjs \
  --manifest /secure/migration-artifacts/storage-manifest \
  --capture /secure/migration-artifacts/storage-capture.json \
  --expected-environment staging \
  --expected-project-ref STAGING_PROJECT_REF
```

Do not point the application at Supabase until both Postgres and Storage reconciliation return `"ok": true` and application permission tests pass.

For a local Supabase stack, use `--environment local` and a loopback URL. Reconciliation still requires `--expected-environment local`, but neither capture nor reconciliation accepts a project ref for a local destination.

## Tests

```bash
./scripts/run-node.sh --test tests/supabase-migration.test.mjs
./scripts/run-node.sh --test tests/supabase-cli-guardrails.test.mjs
./scripts/run-node.sh node_modules/eslint/bin/eslint.js scripts/supabase-migration tests/supabase-migration.test.mjs
```

With local Supabase running, set `FILMSCRIPT_TEST_POSTGRES_URL` to include the two additional integration checks. They execute the generated import against the real schema inside a transaction that always ends in `ROLLBACK`, and audit all 33 SQLite v18 tables against `information_schema`.
