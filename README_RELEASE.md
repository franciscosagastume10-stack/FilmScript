# FilmScript — production release

This package contains the complete FilmScript frontend and Node.js backend.
Private API keys, Google credentials, local accounts, scripts, uploads, sessions,
and payment records are intentionally excluded.

## Fastest complete deployment: one Docker service

1. Copy `.env.example` to `.env` on the server.
2. Add the production values described below.
3. Run:

```bash
docker compose up -d --build
```

The persistent `filmscript-data` volume keeps accounts, scripts, Canvas assets,
shot references, billing state, and generated production data across restarts.

For a public deployment, point a HTTPS domain at port `4173` through the host's
load balancer or reverse proxy. Set all three URLs to that public origin:

```text
PUBLIC_APP_URL=https://app.example.com
API_URL=https://app.example.com
CORS_ORIGINS=https://app.example.com
SESSION_COOKIE_SAMESITE=Lax
SESSION_COOKIE_SECURE=true
```

Add these secrets only in the hosting platform, never in frontend files:

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ANTHROPIC_API_KEY=...
RECURRENTE_SECRET_KEY=...
RECURRENTE_WEBHOOK_SECRET=...
RECURRENTE_LUMIERE_PRODUCT_ID=...
```

In Google Cloud Console configure:

```text
Authorized JavaScript origin: https://app.example.com
Authorized redirect URI:      https://app.example.com/auth/google/callback
```

Use a Recurrente live key only when real payments should be processed. Test keys
must remain limited to development.

## Split deployment: Netlify frontend + container backend

Deploy the Docker image as the API first. Then set the non-secret Netlify build
variable `API_URL` to the public API origin and deploy this repository using
`netlify.toml`. Netlify runs `npm run build:netlify` and publishes `dist/`.

For sibling domains such as `app.example.com` and `api.example.com`, keep
`SESSION_COOKIE_SAMESITE=Lax`. If the frontend and API are on unrelated sites,
use `SESSION_COOKIE_SAMESITE=None` together with `SESSION_COOKIE_SECURE=true`.

## Data and scaling

The included SQLite database is suitable for one persistent server instance.
Do not run multiple backend replicas against the same SQLite file. Before
horizontal scaling, migrate the storage interface to PostgreSQL/RDS and the two
local media adapters to S3. The application already isolates those adapters so
the frontend does not need to be rebuilt for that migration.

More architecture detail is available in `docs/DEPLOYMENT.md`.
