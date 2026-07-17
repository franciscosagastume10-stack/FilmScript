# FilmScript on Vercel

## What is included

- Vercel builds and publishes the static FilmScript pages and assets in `dist/`.
- Browser requests use the AWS API origin baked into `runtime-config.js`.
- `/api/*`, `/auth/*`, Google OAuth, Lumiere, Recurrente and persistence run in AWS.
- No backend API key or customer database is deployed to Vercel.

## Frontend environment variables

Configure these non-sensitive **build** variables in the Vercel project:

- `API_URL=https://api.your-filmscript-domain.com`
- `ERP_API_URL=https://erp.your-filmscript-domain.com` is optional and enables anonymous funnel events.
- `ERP_ENVIRONMENT=live` labels those events as `live`. Use `test` in preview deployments.

All secret variables belong in AWS Secrets Manager. Do not duplicate them in
Vercel.

## Google OAuth

In Google Cloud Console, configure:

- Authorized JavaScript origin: `https://your-project.vercel.app`
- Authorized redirect URI: `https://api.your-filmscript-domain.com/auth/google/callback`

Use the exact production domain. Preview domains require their own redirect URI and are usually best tested without Google OAuth.

## Recurrente

Set the production webhook destination to the AWS backend:

`https://api.your-filmscript-domain.com/api/webhooks/recurrente`

Keep the signing secret in AWS Secrets Manager and never expose it in frontend JavaScript.

## Persistence

Vercel has no FilmScript persistence role. The AWS stack stores private images
in S3 and the current database on EFS. RDS PostgreSQL remains the required next
step before running multiple ECS tasks.

## Smoke test

After deployment:

1. Open the AWS `/api/health` URL and confirm an `ok` JSON response.
2. Open the Vercel `/Features.dc.html` page.
3. Test Google sign-in.
4. Create and reopen a script.
5. Test one Lumiere request.
6. Verify Recurrente checkout and webhook logs.
7. Restart the ECS task and confirm scripts and images remain available.
