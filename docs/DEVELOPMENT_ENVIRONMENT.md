# FilmScript development environment

## Live endpoints

- Frontend: `https://dev.filmscript.app`
- API: `https://api-dev.filmscript.app`
- Vercel project: `filmscript-development`
- CloudFormation stack: `filmscript-development`
- ECS cluster and service: `filmscript-development`
- Secrets Manager secret: `filmscript-development`
- ECR tag: `development-20260819-platform`
- ECR digest: `sha256:eddab21011fa19bd3b256d3ebb3d7f75d6b6bb4c370e2b20c36199dd3fa626a7`

The development stack uses a private S3 bucket and an encrypted EFS filesystem
created by its own CloudFormation stack. No development database or media path
is shared with production. The task runs at 0.25 vCPU and 512 MiB to reduce its
idle cost while preserving the same application topology.

Recurrente credentials and product identifiers are intentionally empty in the
development secret. Add test credentials only. Never copy live billing keys or
register the production webhook against this environment.

## Deployment order

1. Run `npm test` and `npm run build:vercel`.
2. Build the Linux AMD64 container from the current workspace.
3. Smoke-test `/api/health` from that container locally.
4. Push a development-only ECR tag and resolve its immutable digest.
5. Deploy `aws/filmscript-backend.yml` to `filmscript-development` using the
   development certificate, secret, frontend URL, and API URL.
6. Deploy the frontend to the `filmscript-development` Vercel project with
   `API_URL=https://api-dev.filmscript.app` and `ERP_ENVIRONMENT=test`.
7. Verify CORS, health, authentication, persistence, S3 media, and one Sol AI
   operation using synthetic content.

## Production promotion

Development is not promoted by moving its database, S3 objects, secrets, or
DNS. Promote only a reviewed source revision and immutable container digest.

1. Record the tested source revision and development ECR digest.
2. Take a production EFS backup or snapshot.
3. Run the complete test and build suite again.
4. Push a production release tag for the same verified image content.
5. Update `filmscript-production` first and confirm its health and migrations.
6. Build the original `filmscript.app` Vercel project from the same source
   revision using the production `API_URL`.
7. Run production smoke tests without creating real charges or customer data.
8. Keep the previous ECS task definition and Vercel deployment available for
   rollback.

Never point `dev.filmscript.app` at the production API, and never set the live
frontend as an allowed origin on the development backend unless a temporary,
documented migration test explicitly requires it.
