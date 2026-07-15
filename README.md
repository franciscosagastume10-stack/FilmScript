# FilmScript

FilmScript is a connected screenplay writing and pre-production workspace with the Editor, Lumiere, Analysis, Breakdown, Stripboard, Shot List, Canvas and Budget in one project.

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ffranciscosagastume10-stack%2FFIlmScript)

1. Import this GitHub repository into Vercel.
2. Keep the project root as the repository root and the framework preset as `Other`.
3. Add the service keys and URL variables from `.env.example` in Vercel Settings → Environment Variables. Leave `FILMSCRIPT_DATA_DIR`, `FILMSCRIPT_DB_PATH` and `GOOGLE_OAUTH_CLIENT_FILE` unset.
4. Set `APP_URL`, `PUBLIC_APP_URL` and `API_URL` to the final Vercel `https://` domain.
5. Add that same domain and `${APP_URL}/auth/google/callback` to the Google OAuth client.
6. Deploy, then verify `${APP_URL}/api/health`.

Never commit `.env`, Google client-secret JSON, API keys, local databases, user uploads or customer data.

## Important persistence note

The current backend uses SQLite and local media storage. Vercel Functions have an ephemeral filesystem, so the Vercel adapter uses `/tmp/filmscript` only to make preview deployments runnable. It is not durable production storage and different function instances do not share it.

Before opening FilmScript to real users, connect the existing storage boundaries to a durable database and object store (for example AWS RDS + S3, or a serverless database from the Vercel Marketplace). The application already keeps API secrets on the server and has provider boundaries for Shot List and Canvas assets.

See [docs/VERCEL.md](docs/VERCEL.md) for the complete checklist and [README_RELEASE.md](README_RELEASE.md) for the Docker/AWS deployment path.

## Local development

```bash
cp .env.example .env
npm ci
npm run dev
```

Open `http://localhost:4173`.

## Verification

```bash
npm test
npm run build:vercel
```
