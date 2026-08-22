# Supabase runtime gap and safe transition

Audit date: 2026-08-22

## Decision

There is no safe same-day configuration switch that preserves every FilmScript
feature while removing ECS, SQLite, and S3. The target architecture is viable,
but the current production application has only an isolated Supabase preview
slice. Turning off ECS now would remove authentication and most product APIs.

Supabase Postgres and Storage can replace the persistent SQLite and S3 data
planes. They do not replace application compute. Provider calls, PDF/import
work, webhooks, email, and other privileged operations still need a trusted
runtime such as Vercel Functions or Supabase Edge Functions. Workloads that use
Node-only PDF tooling must be proven compatible before choosing Edge Functions.

## Evidence from the current tree

- `vercel.json` sends the production `/api/*` and `/auth/*` surface (except a
  few proxies and `/api/supabase/*`) to `https://api.filmscript.app`.
- `backend/supabase/config.js` deliberately rejects `VERCEL_ENV=production`.
  It also requires an isolated non-production project for cloud previews.
- `backend/supabase/handler.js` currently exposes health, current profile,
  project list/create/read/update, archive/restore, and private file
  upload/download only.
- `server.js` contains 77 request handlers and approximately 100 dispatch
  branches. It imports both `database.js` and `platform-database.js` and calls
  their SQLite-backed snapshot APIs throughout the editor, production,
  collaboration, billing, and AI flows.
- `reference-storage.js` and `canvas-storage.js` instantiate
  `S3ObjectStorage` from `s3-storage.js`.
- Supabase migrations already model the main data domains and have RLS, but
  most production handlers have no Supabase runtime adapter. A schema existing
  is not evidence that the corresponding feature has been cut over.

## Capability matrix

| Capability | Production callsites today | Supabase runtime status | Blocking work before cutover |
| --- | --- | --- | --- |
| Sign-in and session | `server.js` `/auth/google`, callback, handoff, logout; browser clients send cookie credentials | Preview API accepts a caller-supplied Supabase Bearer JWT only | Configure Google in Supabase Auth, add browser session bootstrap/refresh/logout, safely claim legacy identities, remove cookie/API-host assumptions, and test every signed-in entry point |
| Projects and screenplay | `project-client.js` `/api/scripts*`; `server.js` `handleScript*` | Preview list/create/read/archive/restore plus guarded document PATCH | Add production-compatible routes, import/duplicate/delete cleanup, activity and collaboration writes, then dual-read comparison |
| Collaboration | `platform-client.js`, `realtime-client-source.js`; `server.js` collaboration events/presence/operations/script | Tables, policies, and Realtime authorization exist; no production client/server adapter | Replace ECS SSE/in-memory rooms and CRDT registry with authenticated Realtime channels and atomic operation RPCs; prove reconnect, ordering, conflict, and revocation behavior |
| Invitations, members, comments, chat, notifications, sharing | `platform-client.js`; corresponding `handle*` routes in `server.js` | Tables/RLS exist; preview routes are absent | Transactional RPCs, notification fan-out/read state, invitation email/token flow, guest and shared-project authorization, abuse/rate-limit controls |
| Breakdown, analysis, stripboard, shot list, budget, calendar | `preproduction-client.js`, `analysis-client.js`, `budget-client.js`, `calendar-client.js`; many `handlePreproduction*` routes | Legacy snapshots were migrated into `preproduction_projects`; no runtime adapter | Split or strictly mediate the mixed financial JSON, port normalizers/PDF/import routes, enforce module and department permissions, and add round-trip parity tests |
| Canvas and Imagine | `canvas-client.js`; canvas/image handlers in `server.js` | Workspace/library tables and media manifest exist; preview only supports generic files | Port workspace CRUD and vault/board/quote operations, generation lifecycle, likes/selection metadata, thumbnail delivery, and private signed URLs |
| Binary media | `reference-storage.js`, `canvas-storage.js`, budget receipt functions | Generic preview upload/download uses Supabase Storage | Implement typed object adapters for references, canvas assets, avatars, receipts, and generated media; add lifecycle cleanup and orphan reconciliation before enabling project deletion |
| Lumiere, translation, AI jobs | `lumiere-client.js`, `platform-client.js`; OpenAI handlers in `server.js` | `ai_jobs` schema exists; execution remains in ECS | Move provider calls to a trusted function/worker, make reservations and settlement atomic/idempotent, persist attempts/results, and implement retry/timeout handling without holding a request open unsafely |
| Billing, subscription, credits, webhooks | `billing-client.js`, `credit-indicator.js`; checkout/switch/confirm/webhook handlers in `server.js` | Private billing/credit tables exist; production adapter is incomplete | Server-only RPC/function layer, webhook signature verification and idempotency, checkout reconciliation, entitlement parity, and provider sandbox tests |
| PDFs and imports | screenplay PDF import plus analysis/breakdown/stripboard/shot-list/budget/quote PDFs in `server.js` | No Supabase runtime implementation | Keep these in a compatible trusted compute runtime, replace SQLite/S3 access with Supabase adapters, enforce limits, and test representative large files |

## Minimum block completed in this audit

The isolated preview project route now reads and writes the complete screenplay
document fields (`blocks`, `chat`, `titleRoom`, and `characterNames`) instead of
renaming only. Document writes:

- use the caller's JWT and an atomic SECURITY DEFINER RPC that independently
  requires `script:edit` permission;
- retain the production payload limits and chat normalization;
- require the latest `expectedUpdatedAt` and reject a stale autosave with
  `409 project_version_conflict`;
- reject unsupported fields and over-limit JSON even when the hosting platform
  has already parsed the request body.

The database runtime switch defaults off, including in production, and every
public Preview RPC checks it before doing work. Direct browser writes to
scripts, location plans, comments, and messages are revoked; the latter three
remain read-only until side-effect-complete RPCs exist. Local Supabase resets
opt in through the local-only seed so the RLS and RPC suites can exercise the
Preview slice without weakening a deployed database.

This is intentionally not wired into production. It does not yet emit CRDT
operations, activity records, or Realtime events, so enabling it for the live
editor would create collaboration drift.

## Executable transition

1. **Keep production unchanged.** Run the full database and Storage import in
   an isolated Supabase target and complete the existing reconciliation gates.
2. **Create the production auth bridge.** Implement Supabase Auth in the
   browser and trusted API runtime, claim only verified legacy identities, and
   verify profile/project parity for a small internal cohort.
3. **Port one vertical slice at a time.** Start with projects and screenplay,
   then collaboration/invitations/notifications, then production modules and
   typed Storage. Each slice needs contract tests against the current browser
   client and RLS integration tests.
4. **Move privileged compute.** Port AI, translation, billing, webhooks, email,
   PDF, and import handlers to Vercel Functions or proven-compatible Supabase
   functions. No service-role key may enter browser code.
5. **Shadow and reconcile.** Compare reads and side effects between legacy and
   Supabase for every enabled slice. Use idempotency keys/outbox records for
   external effects; do not naïvely dual-send payments, email, or AI jobs.
6. **Final write fence and delta.** Enter a short maintenance window, stop
   legacy writes, migrate the final delta, reconcile rows/objects/ownership and
   credit balances, then change routes.
7. **Canary and rollback window.** Enable a small cohort first, monitor errors
   and reconciliation, and retain the read-only legacy snapshots until the
   rollback window closes.

## Estimate and cutover gate

For one engineer, preserving the complete current surface is approximately
15–25 focused engineering days plus provider/configuration lead time. Multiple
independent slices can run in parallel, but auth, financial authorization,
credit settlement, and the final data delta remain sequencing gates.

ECS can be retired only when all of the following are true:

- no production rewrite points to `api.filmscript.app`;
- no production request imports or calls the SQLite adapters;
- no typed media flow uses `S3ObjectStorage`;
- browser authentication and token refresh work through Supabase Auth;
- every current handler family has a Supabase-backed replacement or an
  explicitly approved removal;
- Realtime collaboration and permission revocation pass multi-user tests;
- billing/credit/webhook idempotency passes provider sandbox tests;
- final Postgres and Storage reconciliation is clean after the legacy write
  fence;
- a tested rollback procedure exists.
