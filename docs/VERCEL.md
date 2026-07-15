# FilmScript on Vercel

## What is included

- All browser pages and assets are served through the existing FilmScript HTTP handler.
- `/api/*` and `/auth/*` use the same Node.js function, so cookies, Google OAuth and API routes stay on one origin.
- Secrets remain server-only environment variables.
- Vercel automatically installs the Node dependencies from `package-lock.json`.

## Required environment variables

Copy the names from `.env.example` into the Vercel project. At minimum, configure:

- `APP_URL=https://your-project.vercel.app`
- `PUBLIC_APP_URL=https://your-project.vercel.app`
- `API_URL=https://your-project.vercel.app`
- `CORS_ORIGINS=https://your-project.vercel.app`
- `SESSION_COOKIE_SAMESITE=Lax`
- `SESSION_COOKIE_SECURE=true`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ANTHROPIC_API_KEY`
- `FILMSCRIPT_PDF_WORKER_SECRET` (a long random value shared by the two server functions)
- `RECURRENTE_SECRET_KEY`
- `RECURRENTE_WEBHOOK_SECRET`
- `RECURRENTE_LUMIERE_PRODUCT_ID`

Do not set `GOOGLE_OAUTH_CLIENT_FILE` on Vercel. Use the two Google environment variables instead.
Also leave `FILMSCRIPT_DATA_DIR` and `FILMSCRIPT_DB_PATH` unset; the preview adapter chooses writable `/tmp` space automatically.

## Google OAuth

In Google Cloud Console, configure:

- Authorized JavaScript origin: `https://your-project.vercel.app`
- Authorized redirect URI: `https://your-project.vercel.app/auth/google/callback`

Use the exact production domain. Preview domains require their own redirect URI and are usually best tested without Google OAuth.

## Recurrente

Set the production webhook destination to:

`https://your-project.vercel.app/api/webhooks/recurrente`

Keep the secret in Vercel and never expose it in frontend JavaScript.

## Persistence before public launch

Vercel's filesystem is read-only except for ephemeral `/tmp` scratch space. The current SQLite database and local image adapters therefore work only as a preview/demo on Vercel and may reset after a cold start or scale-out.

For real accounts and billing, migrate:

- SQLite tables to AWS RDS/PostgreSQL, Neon, Supabase, Turso or another durable service.
- Shot List references and Canvas images to S3 or Vercel Blob.
- The included Python Function handles PDF import and A4 exports on Vercel. Large uploads remain subject to Vercel Function request-size limits; move heavy document processing to the AWS backend when needed.

The Docker/AWS path in `README_RELEASE.md` remains the production-safe option until that migration is complete.

## Smoke test

After deployment:

1. Open `/api/health` and confirm an `ok` JSON response.
2. Open `/Features.dc.html`.
3. Test Google sign-in.
4. Create and reopen a script.
5. Test one Lumiere request.
6. Verify Recurrente checkout and webhook logs.
7. Restart/redeploy and confirm durable storage before inviting users.
