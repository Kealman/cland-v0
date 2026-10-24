# hub/test/tracker-summary.test.ts

T-539's public Tracker tip-refresh seam warms the summary projection, moves an
injected Git tip through the `scheduleTips` callback, and observes fixture-owned SQLite results:
no unrelated rows are hydrated and unchanged answers emit no task event. The
TrackerIndex seam checks freshness-dependent ids in rank/id order with one query,
including multiple configured planning kinds, closed rows, verdict-only rows,
branched rows and stale ready rows. An empty planning level still selects the
other cases. Both use `sqliteProbe`; do not replace SQLite builtins or prototypes.

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
