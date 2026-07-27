# FilmScript

FilmScript is a connected screenplay writing and pre-production workspace with the Editor, Lumiere, Analysis, Breakdown, Stripboard, Shot List, Canvas and Budget in one project.

## Production deployment: Vercel + AWS

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ffranciscosagastume10-stack%2FFIlmScript)

1. Deploy the backend stack in [`aws/`](aws/) to ECS Fargate.
2. Point an HTTPS API hostname at the stack's Application Load Balancer.
3. Import this GitHub repository into Vercel with framework preset `Other`.
4. Set the non-sensitive Vercel build variable `API_URL` to the AWS API origin.
5. Deploy Vercel and test Google sign-in, billing, scripts, S3 images and exports.

Never commit `.env`, Google client-secret JSON, API keys, local databases, user uploads or customer data.

Vercel publishes only the static FilmScript UI. API keys, Google OAuth secrets,
Recurrente secrets, account data and the database stay in AWS.

## Durable storage status

The AWS backend stores Canvas and Shot List images in a private encrypted S3
bucket. The current synchronous SQLite database is persisted on encrypted EFS,
with the ECS service intentionally limited to one task.

Before horizontally scaling the backend, migrate the database contract to RDS
PostgreSQL. Do not increase ECS `DesiredCount` while SQLite is active.

See [aws/README.md](aws/README.md) for AWS deployment and
[docs/VERCEL.md](docs/VERCEL.md) for the frontend checklist.

## Local development

```bash
cp .env.example .env
npm ci
npm run dev
```

Open `http://localhost:4173`.

### Local Preview (Codex)

When Google OAuth is only available in AWS, use the isolated preview workspace
to inspect and edit the current app locally without logging in:

```bash
npm run preview
```

Then open `http://localhost:4173/App.dc.html`. The preview creates a stable
local account and a connected 12-page sample screenplay, `The Last Take`, at
`scr_f1f5e6c7a9b0d1e2f3a4`. It includes populated Breakdown, Stripboard,
Calendar, Budget and Expense data, using the same Editor, Analysis, Shot List,
Canvas and Budget API routes used by the app. Its SQLite database lives in
`app/data-preview/`, so it cannot alter normal local data or AWS data. Stop it
with `Ctrl-C`.

This workflow is intentionally local-only. Edits stay in the workspace until
you explicitly ask to publish the latest version to GitHub; no push or deploy
is performed automatically.

## Verification

```bash
npm test
npm run build:vercel
```
