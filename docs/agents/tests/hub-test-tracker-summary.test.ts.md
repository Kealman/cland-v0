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

## Watcher debounce

`hand edits settle for 100 ms after the last watcher notification before re-indexing`
injects the folder watcher, fake Git and tracker clock, and advances mocked
`setTimeout` time. It asserts no reads or changes before the last notification's
100 ms deadline, then waits for the exact edited item change and checks the
indexed title. A second notification at 99 ms must restart the settling window.
No elapsed wall time supplies evidence for the debounce contract.

The native watcher receipt is covered separately in
[`tracker.test.ts`](hub-test-tracker.test.ts.md).

The healthy-watcher loss regression (T-1431) keeps production `watchFolder` and
its safety timer, replacing only `fs.watch` with a fixture-owned, error-free event
source. It synchronously emits edit/add/remove/rename callbacks, drops them at the
Tracker watcher seam, and checks the index stays stale until the healthy safety
interval. There is no FSEvents delivery wait. It advances the mocked interval by
the production safety period, waits for the exact edit/add/remove/rename log receipts, and checks the final views.
Only interval time and the event source are mocked; file I/O remains real.
Tracker stop closes the event source before timer reset and fixture cleanup.
Builtin export synchronization is restored after the test. Native watcher
integration remains covered separately in `tracker.test.ts`.

The initial synchronous stamp and async checks use per-path maps, avoiding a
spurious full first scan. The safety-poll test counts body reads, proves an
unchanged path stays unread after a peer changes, and pins mtime, size and inode
on a same-size external write to prove ctime detection. It retains explicit
rescan coverage requiring every body read; queue-fenced views and exact index
receipts settle the tests. Raw external writes model tracker updates from editors
and Git merges without needing a Git process.
