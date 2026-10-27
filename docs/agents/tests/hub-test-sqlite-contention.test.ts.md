# hub/test/sqlite-contention.test.ts

T2 uses disposable SQLite stores at the native database seam. The doctor case
uses an independently owned writer/worker and observes the actual BUSY receipt
before releasing it; no sleep controls the lock.

The authorization-fixture regression seeds a complete hub schema and an existing
session credential, removes the once-only visibility backfill marker, then holds
`BEGIN IMMEDIATE` on that exact WAL database. A second zero-timeout connection
must fail its own `BEGIN IMMEDIATE` with SQLite BUSY (the positive control).
`sessionShell` must still return the existing credential and leave an unknown
identity unchanged while the original writer's uncommitted row remains readable
through its own connection. A full Store open goes red with `database is locked`;
a minimal credential read passes without acquiring the writer. Print the
open/read duration diagnostically, never as a timing assertion, and never print
or compare credentials in a way that exposes their value. Close both handles
before root teardown; the shared writer owner also covers test cancellation.
