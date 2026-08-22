# Supabase Preview API

This is an isolated vertical slice. It does not import `server.js`,
`database.js`, `platform-database.js`, or the AWS storage adapter.

It is disabled unless all of the following are true:

- `FILMSCRIPT_SUPABASE_PREVIEW_ENABLED=true`
- `FILMSCRIPT_SUPABASE_PREVIEW_MODE=isolated`
- `VERCEL_ENV` is not `production`
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` are present

Cloud targets also require both
`FILMSCRIPT_SUPABASE_PREVIEW_PROJECT_REF` and
`FILMSCRIPT_SUPABASE_PRODUCTION_PROJECT_REF`; they must differ and the Preview
reference must match the `SUPABASE_URL` hostname. Local Supabase is accepted on
loopback without project references.

Private upload/download routes additionally require
`SUPABASE_SERVICE_ROLE_KEY`. That key is used only for object bytes. User and
project authorization is performed with the caller's Supabase JWT through RLS
and narrowly scoped RPCs. Never expose the service-role key to browser code.

Routes:

- `GET /api/supabase/health`
- `GET /api/supabase/me`
- `GET|POST /api/supabase/projects`
- `GET|PATCH /api/supabase/projects/:projectId`
- `POST /api/supabase/projects/:projectId/archive`
- `POST /api/supabase/projects/:projectId/restore`
- `POST /api/supabase/projects/:projectId/files`
- `GET /api/supabase/projects/:projectId/files/:mediaId/download`

Uploads are raw request bodies (maximum 10 MiB) with
`X-FilmScript-Filename` and an exact `Content-Type`. The object is uploaded
under the caller namespace before its RLS manifest is registered. If manifest
registration fails, the adapter deletes the unreferenced object as a
compensating rollback.
