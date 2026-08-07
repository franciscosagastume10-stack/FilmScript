# FilmScript: local development, Vercel + AWS production

## Current local architecture

- The browser UI is static HTML/JavaScript.
- `server.js` owns Google OAuth, sessions, billing, scripts, Lumiere and preproduction APIs.
- `database.js` stores users, sessions, scripts, chats, billing and preproduction in `data/filmscript.sqlite`.
- Existing JSON data is imported once and left untouched as a recovery copy.
- Google `sub` is unique. Repeated historical logins for the same Google account are consolidated without losing scripts.
- When the historical local database contains exactly one Google account, legacy anonymous scripts are claimed by that account once instead of being orphaned.

Run locally:

```bash
npm install
npm run dev
```

Health check:

```bash
curl http://localhost:4173/api/health
```

## Target production architecture

```text
Vercel (static FilmScript UI)
        |
        | HTTPS + credentialed API requests
        v
AWS Application Load Balancer (HTTPS)
        |
        v
ECS Fargate (Node API + PDF workers, one task)
        |             |
        |             +--> S3 (private Canvas and Shot List images)
        v
EFS + SQLite (durable transition)

Secrets: AWS Secrets Manager
Logs/metrics: CloudWatch
```

ECS Fargate fits the current long-running Node process and background scene analysis better than moving the existing server directly into short-lived functions. AWS describes Fargate as serverless compute for ECS container workloads: <https://docs.aws.amazon.com/AmazonECS/latest/developerguide/getting-started-fargate.html>.

The current deployable stack is in `aws/filmscript-backend.yml`. It uses one
task and EFS because the existing database module is synchronous SQLite. RDS
PostgreSQL is the next phase and is required before horizontal scaling.

API keys, OAuth secrets, Recurrente credentials and database credentials belong in Secrets Manager, never in Vercel or frontend JavaScript: <https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html>.

## Deploying the frontend to Vercel

The repository contains `vercel.json` and a safe frontend-only build. Only the generated `dist/` directory is published, so the server, database, `.env`, uploads and API keys are excluded.

Set these non-sensitive Vercel build variables. The ERP variables are optional:

```text
API_URL=https://api.your-filmscript-domain.com
ERP_API_URL=https://erp.your-filmscript-domain.com
ERP_ENVIRONMENT=live
```

Vercel runs:

```bash
npm run build:vercel
```

These public origins and the `test` or `live` ERP environment label are copied
into browser code. Funnel tracking remains disabled when `ERP_API_URL` is
absent. All credentials stay in AWS Secrets Manager.

## AWS backend variables

```text
PUBLIC_APP_URL=https://app.your-filmscript-domain.com
API_URL=https://api.your-filmscript-domain.com
CORS_ORIGINS=https://app.your-filmscript-domain.com
SESSION_COOKIE_SAMESITE=Lax
SESSION_COOKIE_SECURE=true
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
OPENROUTER_API_KEY=...
RECURRENTE_SECRET_KEY=...
RECURRENTE_WEBHOOK_SECRET=...
RECURRENTE_LUMIERE_PRODUCT_ID=...
# Optional one-time product; omit to use the inline $5 reset item.
RECURRENTE_LUMIERE_RESET_PRODUCT_ID=...
```

Using sibling custom domains such as `app.example.com` and `api.example.com` keeps the frontend and API same-site. If unrelated domains are used, set `SESSION_COOKIE_SAMESITE=None` and keep `SESSION_COOKIE_SECURE=true`.

Google OAuth production redirect:

```text
https://api.your-filmscript-domain.com/auth/google/callback
```

## Recurrente webhook

FilmScript verifies the exact checkout when the customer returns, so local development works without exposing a webhook receiver. Once the AWS API has a public HTTPS URL, set `PUBLIC_APP_URL` to the frontend URL and `API_URL` to the API URL, then register the backend endpoint:

```bash
npm run recurrente:webhook
```

The command registers `${API_URL}/api/webhooks/recurrente` and prints the signing secret once. Store that value as `RECURRENTE_WEBHOOK_SECRET` in AWS Secrets Manager and restart the API. Never put it in Vercel or browser code.

Use a test key while developing and a live key only after launch. Recurrente test checkouts do not move money and may not emit the normal checkout webhook flow, so FilmScript also revalidates the checkout and reconciles the subscription through the secret-key API when the user returns.

## Database migration path to RDS

SQLite is durable on EFS but intentionally single-task. Before running more
than one ECS task:

1. Create private RDS PostgreSQL.
2. Add a PostgreSQL implementation matching the exported storage functions in `database.js`.
3. Run a one-time SQLite-to-PostgreSQL migration.
4. Verify all media adapters remain on the existing private S3 bucket.
5. Move Lumiere analysis jobs to an SQS-backed worker if generation volume grows.
6. Enable backups, alarms and database migrations in CI/CD.

The frontend and HTTP API contracts already avoid direct SQLite dependencies, so this change does not require rebuilding the FilmScript UI.
