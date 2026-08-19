# FilmScript collaboration access

## Architecture

Collaboration access reuses FilmScript Google authentication, user records, scripts as projects, Recurrente subscriptions, SQLite persistence, preproduction data, and the existing server request handler. Project membership never replaces account subscription or project ownership.

The billing owner is the `scripts.user_id` account and the only `owner` membership. The billing owner's plan and credits control Lumiere availability for every authorized collaborator. A collaborator does not need a matching paid plan.

Server authorization is centralized in `permissions-model.js` and `platform-database.js`. Every project request resolves the current membership from SQLite. Suspended and removed memberships fail immediately.

## Invitations

Invitation secrets contain 256 bits of randomness. SQLite stores only SHA 256 token hashes. Links can be rotated, which invalidates the previous link and all guest sessions. Invitations expire after seven days by default and can be edited or revoked while pending.

Account invitations open `Invitation.html`, preserve the secret through Google sign in, and connect the invitation to the verified account. Temporary guest invitations open `GuestAccess.html` and create a short lived HTTP only guest session. Guest access is read only and financial information is always removed on the server.

## Email delivery

No transactional email provider is currently installed. Collaboration works through copyable secure invitation links.

`invitation-mailer.js` provides the reusable `InvitationMailer` interface, finished HTML and plain text templates, and a development preview implementation. A static visual preview is available at `docs/invitation-email-preview.html`.

To activate delivery, add an approved provider adapter that extends `InvitationMailer`, instantiate it as `invitationMailer`, and configure the adapter with provider specific server environment variables. Keep all provider credentials on the server. Do not place them in runtime configuration or frontend code.

## Manual verification

1. Sign in as a project owner and open a project.
2. Select Manage people in the top right area or choose People & Access from the Project menu.
3. Create username, account email, external email, and Temporary Guest invitations.
4. Copy a pending link, rotate it by copying again, and confirm the earlier link no longer works.
5. Accept account invitations using the invited Google email.
6. Open a guest link in a private window and confirm permitted modules are read only.
7. Confirm Budget is absent for guests and users without financial access.
8. Grant one financial department and confirm other department costs are absent from responses.
9. Suspend and remove a member, then confirm the next request is denied.
10. Transfer ownership and confirm the old owner becomes Co owner while exactly one billing Owner remains.
