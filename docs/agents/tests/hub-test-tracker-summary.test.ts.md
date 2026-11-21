# hub/test/tracker-summary.test.ts

The epic verdict reply regression uses fake Git history and an in-memory index.
Through `handleTaskRequest`, it writes QA marks at a build behind dev by tracker
and brief changes, checks literal verified/stale counts in the immediate reply
and `Tracker.view`, then retains those marks through a criterion edit. After a
surface-file edit it checks demo freshness and the stale counts and mark flags
in both the criterion reply and the view. The native-launch guard stays active
through tracker shutdown and fixture cleanup. Each callback uses
`trackerFileCase` for separately bounded setup and complete work ownership,
with `ownedTracker` registered before construction so database-close receipts
gate root disposal and native-guard restoration.

The overlapping variant holds the older background Git resolution before the
explicit verdict check, then releases its failure and observes worker settlement
before asserting reply/view counts again. Direct `Freshness` cases retain all
waiting-item ids through queued, running and retry supersession; they also check
that changed membership, a moved dev tip and stopped caches cannot borrow that
proof. Their `stageCase` owner releases controlled holds, joins work and observes
cache shutdown before restoring the native guard.

The ten-branch churn case uses `tip-churn-fixture.ts`: 1,650 synthetic rows,
fifty epic trees and 1,600 branch tips, ten of which move. It records summary
work through the raw summary's blocker query and title-bearing SQLite row
hydration before requested list/view reads. Bounds are 100 summaries and 400
hydrated rows per ten-branch move. The explorer log records projection work
separately. All complete list bytes must remain equal across the move, including
criteria and current demo verdicts. The diagnostic SHA-256 normalizes only
receipt timestamps for comparison across runs; the equality assertion does not.
A positively controlled native-launch guard covers fake Git and cleanup.
`fixtureNativeGuard` registers verification/restoration through shared
`afterCleanup`, after owned resources, hubs and directories; an ordinary early
`t.after` restoration would leave directory cleanup unguarded.
Record the old producer's work counts and result hash before changing it.

The fixture builds its own scratch SQLite index through public `TrackerIndex.put`
in one owned transaction with reused prepared statements. The seed-only adapter
restores the driver methods, commits or rolls back, and closes the writer before
Tracker starts. Explicit backlog/updated fields retain the original migrated
oracle without exercising 1,600 unrelated status migrations during setup. No live
database is read or copied. The original oracle and work bounds stay unchanged.

The file fixture uses one pre-acquisition `stageCase` sequence spanning root
creation, seeding, tracker acquisition, warmup and the single churn callback.
Worker admission keeps its native load-scaled timeout/outcome. Following its
positive receipt, setup has a separate 15-second bound and the callback has the
owner's five-second bound; expired observers retain their original work. Callback
trace/socket after-hooks route to the file owner, and raw-context cancellation
joins the callback before resource closure. The root-removal guard and control
restoration require original-work joining and positive resource-close receipts.
`ownedTracker` enrolls disposal before construction, captures opened connections
before schema work, and closes them directly if construction never returns.
On successful acquisition the Tracker owns their closure; retained open
connections refuse fixture disposal. No shared constructor is changed.
The seed writer uses the same pre-enrolled `ownedDatabases` close fence, so a
failed seed/index close cannot leave an unowned open connection after the
original seed sequence has joined. Ordinary seed cleanup still closes its
index before Tracker acquisition; fallback disposal is checked by the file owner.

Five fake-only controls exercise registered cleanup during held setup and a late
callback/finally, rejected close retention with separate actual-root/native-guard
and seam receipts, and an injected schema-construction failure with a positive
native SQLite close before root removal. A refused constructor-fallback close
keeps the original schema error selected, records cleanup as a secondary cause,
and retains the root/guard until that same owner confirms closure. Held work is released by an outer
owner on failure. These need no child process, real Git or socket. They cover
the new item-local fixture lifetime, without migrating the file's other cases.

The churn seed, tracker acquisition and initial warm refresh are file-level setup
(T-1988). Only this case uses that root and mutable tip set. Register this setup
before any tests so file cleanup cannot attach to an earlier test. The case
retains its oracle, observer arming, moved-tip refresh and 100-summary/400-row
bounds unchanged. File totals include seed/startup/warmup and ordered teardown;
case timings exclude them. The setup allowance is removed. No live database is
opened, and the native guard covers the complete file-owned fixture lifetime.

The pre-change oracle for this synthetic case has timestamp-normalized SHA-256
`022b27e1c78253fc0c96f0df78a3cf228227db51cb68ace680868503562bd745`.
The original producer computed 3,300 summaries and hydrated 14,800 title-bearing
rows for ten moved tips, although no projected row changed. These are refresh
work counts, excluding the following list read, rather than timing evidence.
The tip invalidation case also covers additions, deletion/confirmed absence,
unchanged reads, dev moves and a configured base switch/move.

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

The open startup paging test injects a 1,800-byte row budget through the Tracker constructor and traverses twelve multibyte-title rows through handleTaskRequest. It asserts UTF-8 byte boundaries, numeric identity order despite reversed rank, complete unique membership and literal default (122,880) and first-reply cap (131,072) values.

T-2050 exercises automatic ready through the Tracker public API with fake Git,
fake time, injected verification receipts and a positively controlled native
launch guard. A durable writer-queue edit observes the initial ready decision;
subsequent receipt changes wait with bounds for persisted ready/review statuses.
Keep this block below the awaited file-level churn setup: registering a test
before that setup can attach its cleanup to the earlier case and fail a focused
single-name run with `fixture work admission closed`, even when the case passes.
Launching, running, red, cancelled, missing, older-head and missing-finished-time
receipts stay in review. Finished green and projected same-tree cached receipts
permit ready, while a later pending submission demotes it. No command and an
empty base diff retain verdict-only readiness. All fixtures use disposable roots;
no live hub database or native Git is consulted.
