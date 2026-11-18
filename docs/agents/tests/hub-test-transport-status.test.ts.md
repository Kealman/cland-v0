# hub/test/transport-status.test.ts

T2 serves a disposable projectHub and installs status-only carrier facts. It
checks the actual hub.status reply, CLI rendering and the previous wire shape
with hosts absent or an explicit previous host row without `revokedAt`. It also
revokes qa1 through the CLI-client socket boundary, checks the real CLI formatter,
the unchanged qa2 row, and persisted first-revocation time across storage reopen
and repeat revocation. Unknown legacy time prints `revoked since unknown`.
No SSH process starts; registered metadata uses a synthetic
secret and the existing private store.

The fixture supplies an inert Host for its registered metadata through the
existing projectHub injection seam. This keeps daemon startup from acquiring a
real carrier before the fixture installs its status-only transport. Status and
previous-reply assertions retain their existing facts.
