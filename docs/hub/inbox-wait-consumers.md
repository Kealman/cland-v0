# Inbox wait reconciliation consumers

T-1989 keeps the Inbox wire shape, ordering, unread counts, departure reasons,
and hidden wait retention. `inboxWaits()` without arguments retains its complete
inventory contract. The optional message-id selection is used only by
`InboxBoard.list`; asks, approvals, plans and dirty message waits remain eligible.
No client migration is required. The previous query remains an independent
oracle in `hub/test/inbox-query-oracle.ts`.

Search before implementation: `inboxWaits`, `inbox_waits`, `waitInInbox`,
`departInbox`, `inboxMessages`, `inbox.list`, `InboxBoard`, and importers of
`hub/inbox.ts` and `hub/store.ts`, across production, shared wire, hub/web/Neovim
tests (all tiers), frozen fixtures, shipped skills, QA briefs and docs. The wire
consumer inventory is [inbox-window-consumers.md](inbox-window-consumers.md).

Direct wait consumers:

- `hub/src/hub/store.ts`: persistence, candidate query, pruning, approval restore,
  archive and complete inventory. Indexed wait topic/sequence metadata and the
  durable change set are additive. Existing writers are covered by triggers.
- `hub/src/hub/inbox.ts`: selected reconciliation, complete request verdict
  settlement, exact approval settlement. The verdict path keeps the complete
  inventory; list uses a candidate map instead of repeated candidate searches.
  `inboxWaitChangePage()` captures one bounded page for both projections;
  `finishInboxWaitChangePage()` checkpoints its last examined key in store meta.
  `hasInboxWaitChanges()` supplies an indexed continuation receipt after progress.
- `hub/src/hub/asks.ts`, `hub/src/hub/hub-cards.ts`: create ask waits; unchanged.
- `hub/src/hub/store.test.ts` (T1): wait/outcome persistence; unchanged API.
- `hub/test/sqlite-hot-reads.test.ts` (T2): complete inventory and cached statement
  checks; unchanged no-argument API.
- `hub/test/inbox-query.test.ts` (T2): fake-store work bound, SQLite volume
  receipt and recorded previous-query departure differential.
- `hub/test/inbox-query-oracle.ts`: frozen complete query; deliberately unchanged.
- `hub/test/inbox-actions.test.ts` (T2): archive and request/read actions.
- `hub/test/inbox-workload.test.ts` (T2): complete inventory for durable wait
  receipts; unchanged no-argument API.
- `hub/test/measure-memory.ts`: complete method instrumentation; unchanged API.
- `qa/briefs/E-414-stage-3.md`: persisted approval metadata; preserved.
- `qa/briefs/E-1466.md`: stored wait capture; preserved.

There are no other direct wait consumers in web, Neovim, shared wire, shipped
skills or frozen JSON fixtures. Their Inbox field readers and raw socket readers
receive the same shape, as listed in the wire inventory. Existing client fixtures
continue exercising that previous shape. T3/T4 importers remain selected by the
verification planner; this inventory does not claim they ran locally.

The change set records individual reads, topic watermarks and same-topic or
cross-topic human request replies durably before publication. Departure deletes
the change key. Deaf notices stay eligible for process reconciliation. One-time
upgrade backfill reconstructs metadata and already settled waits from persisted
facts. Candidate decoding and reconciliation share a 128-key change page.
Requests retain their old descending sequence departure order; message waits
retain their original insertion order, explicitly ordered by wait rowid after
selection. The indexed change queue carries that order across pages. A bulk
read or reply leaves the remaining keys durable for subsequent calls; coalesced
publications continue the drain after progress or an observed sentinel key,
yielding between pages. The durable cursor advances after every examined page,
including pending deaf notices, and wraps on exhaustion. Indexed seeks read at
most 128 keys plus one sentinel; both candidate and wait projections receive the
same captured keys. A full unchanged cycle goes quiet while retaining pending
keys for the next relevant event. Archive
counts describe departures already committed by that page; the full archive
converges to the prior projection when the queue drains. Pins and visibility
overrides can still expose old messages without changing their original since.

The C1 fake-store page-bound fixture retains 50,000 durable waits. The repeated
SQLite differential uses 1,000 durable message waits, 997 age-hidden;
visible ids `wait-1000`, `wait-999`, `wait-998`; unread 1,000. The indexed
page decodes three candidates and reconciles three waits. Individual read of
`wait-1`, topic read through `wait-2`, and replies to hidden `wait-3`/`wait-4`
match the previous query's full Inbox/archive replies. These are work counts,
not latency measurements or full-project coverage.

The repeated drain fixtures retain all 1,000 age-hidden waits through both bulk
topic-read and human-reply transitions. Every page decodes and reconciles at most
128 changed waits, and the complete final Inbox and ordered archive match the
previous query. Equal-timestamp waits inserted in reverse ID order separately
prove insertion ordering. A 257-request fixture proves the prior descending
candidate order across pages. An injected-clock publication fixture proves
scheduled continuation through a partially drained queue.
Each drain requires eight bounded pages. The old path still decodes 1,000
rows on one call, positively confirming that the smaller fixture rejects the
unbounded implementation. The old clean-window differential also decodes 1,000
rows against the current three-row bound. Coordinator's fixture-size ruling
keeps 50,000 waits only in C1's page-bound case; earlier 50,000-wait drain
and migration receipts remain historical evidence in A-23366 at 5f7de472c.

The starvation regression places 128 pending deaf keys before one hidden read.
The first page records no departure; its cursor survives a new Store constructor,
and the exact hidden read departs by the second scheduled page. Every examined
page remains bounded, the cursor seek uses the change-order index, an unchanged
wrapped cycle stops scheduling, and all pending notices remain durable until a
later process inventory settles them.

When the last change key leaves, its deletion also removes the cursor in the
same SQLite write. Page finish preserves that reset after observing an empty
queue. An independent invalidation therefore starts at the insertion-order
head. The fixed-clock differential settles a middle wait, positively observes
the empty queue, then bulk-reads the other 299 waits and compares the complete
300-departure archive with the prior query, including tied timestamp order.

The populated-store migration fixture removes the new columns, triggers, index,
change table and marker before opening the new Store. It verifies one metadata
backfill, all 1,000 indexed rows, settled read restoration, no backfill on a
second open, and old SQL writers' cross-topic request reply/deletion. A local
macOS Node 24.21.0 historical 50,000-wait sample measured 79.813 ms for the
migration constructor and 2.954 ms for reopen. Those historical diagnostics use synthetic in-memory SQLite and
exclude hub startup and disk IO; they are not latency gates. An older binary
continues its complete inventory path, ignores the additive schema fields, and
its SQL writes still fire the new triggers. Rollback keeps the index current.
