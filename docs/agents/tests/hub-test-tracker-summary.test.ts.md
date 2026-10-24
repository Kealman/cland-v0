# hub/test/tracker-summary.test.ts

T1: tracker list/view projections, recovery and watcher filtering use fake time
and Git. Run the file with `node --test hub/test/tracker-summary.test.ts`.

The index list query-count regression (T-538) uses an in-memory `TrackerIndex`
and the reusable fixture-owned `sqliteProbe` from `hub/test/sqlite-probe.ts`.
Tracing counts executed `get`/`all` reads only after fixture seeding. No native
SQLite prototype, process, socket or wall-clock wait is needed.

Eight rows cover every built-in kind and a configured container, retaining
legacy `T-` ids in storage. An unlinked list needs one read and zero kind
lookups (before: nine reads, eight kind lookups). Adding parent, blockers,
follows and regression references needs seven reads, six of them reference kind
lookups (before: fifteen reads, fourteen kind lookups). Assertions retain canonical
own ids, canonical referenced ids and unchanged missing references.
