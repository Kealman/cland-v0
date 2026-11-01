# hub/test/web-authority-unit.test.ts

`node --test hub/test/web-authority-unit.test.ts` exercises the pure web policy
and shared `userAuthorityRefusal(users, userId, frame, table?)` boundary. The
optional table is the same row format as production, allowing a test-only role
without shipping another role. Existing plain rows grant admin by default.

The in-memory SQLite fixture changes a user's stored role between checks,
removes one permission from the test role, and checks request/role refusal text,
unknown identity and request denial, and single-mode bypass. Legacy policy tests
retain their exact result-shape assertions.

`auth-mode.test.ts` exercises cookie-authenticated admission with a persisted
role change, forged frame identity/role fields, no refused message persisted,
and restored admin admission on the same socket. `web-authority.test.ts` remains
an unedited single-mode browser/Unix behavior control. No GUI browser is needed.
