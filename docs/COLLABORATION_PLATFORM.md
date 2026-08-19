# FilmScript collaboration platform

## Architecture

The authenticated Node service is the policy boundary. Every project request
resolves a membership first, then checks the requested module and action.
Financial access is a separate permission dimension and is never inferred from
a project or cinematic role.

SQLite on encrypted EFS stores memberships, invitations, notifications,
activity, durable AI jobs, collaboration operations and conflicts, shared
projects, comments, and location plans. Private media and profile images remain
in the existing local or private S3 storage adapter. No AWS credentials or
provider model identifiers are sent to browser code.

Live collaboration uses authenticated Server Sent Events and versioned field
operations. Independent field changes merge. Incompatible writes to the same
field produce a conflict record instead of silently replacing work. Presence is
idle after 90 seconds, empty rooms expire after five minutes, and pointer data
is throttled.

## Migration

Migration 010 is applied idempotently when the server imports
`platform-database.js`. It adds collaboration profile fields and creates all
platform tables, indexes, and foreign-key relationships. Existing script owners
are backfilled as owner memberships without changing script IDs or content.

Before a production update, take an EFS snapshot or copy the SQLite file while
the service is stopped. Keep ECS at one task while SQLite is active. The reverse
migration removes the added platform tables and indexes; SQLite added columns
are intentionally retained because rebuilding the users table is riskier than
leaving nullable profile metadata in place.

## AI routing and credits

Luna serves conversational chat. Sol serves analysis, breakdowns, shot lists,
translations, and other structured production work. Terra is attempted once
only for retryable Sol provider failures. Authorization, validation, and credit
failures do not fall back.

Translation reserves text credits from the project owner's account before work
starts. The job validates screenplay block IDs and types, creates a separate
project, then settles the reservation. A failed job releases its reservation.
Public job responses omit provider model details.

## Environment

Set these only on the backend:

```text
FILMSCRIPT_AI_MODEL_LUNA=gpt-5.6-luna
FILMSCRIPT_AI_MODEL_SOL=gpt-5.6-sol
FILMSCRIPT_AI_MODEL_TERRA=gpt-5.6-terra
```

All existing `OPENAI_API_KEY`, S3, OAuth, billing, URL, cookie, and database
settings remain unchanged. The app continues to work with the local storage
adapter and preview database.

## Verification

Run:

```text
npm test
npm run build:vercel
```

Then verify one owner and one invited test account:

1. Invite the second account as a commenter with no financial access.
2. Confirm the invitation appears in notifications and opens the correct project.
3. Confirm the commenter can read and comment but cannot edit screenplay text.
4. Open Budget and confirm financial data is denied without leaking totals.
5. Upgrade the member to editor and grant only the required modules.
6. Open both accounts and confirm presence, cursors, and independent edits update live.
7. Make incompatible edits to the same field and confirm a conflict is recorded.
8. Preview a translation, confirm the exact tier and owner balance, then run it.
9. Confirm the translated screenplay is a separate project and the source is unchanged.
10. Create a password-protected Shared Project and verify only selected sections appear.
11. Draw, calibrate, measure, and save a Location Plan on desktop and tablet widths.
12. Restart the service and confirm membership, notifications, plan versions, activity, and AI job status remain available.

Use synthetic data for production smoke tests. Never send a real invitation or
publish a real Shared Project as part of an automated deployment check.
