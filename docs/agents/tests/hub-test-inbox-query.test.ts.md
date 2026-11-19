# hub/test/inbox-query.test.ts

The candidate-window regression seeds 100,000 unread messages on one in-memory
connection with one transaction and a reused insert. Before the window change,
the control decoded 100,000 rows for three returned messages. Its fixed oracle
records newest-first IDs, needsYou, unread count and readSeq; the bound permits
returned rows plus one. The SQLite probe counts rows at the candidate decoder
boundary and checks the timestamp-range index in the actual query plan. This is
a work-count check, not a whole-hub latency claim. The recorded facts stay fixed;
the complete-reply comparison to the frozen previous query runs in the small
policy fixture, so the volume case never decodes all retained history through
that oracle after proving the production decode bound.

A small differential fixture retains policy overrides, topic/session pins,
topic mute, tied/backdated timestamps, the exact seven-day boundary, hour 24,
noncanonical/invalid timestamps (including SQLite's special `now` spelling), old requests, explicit reads, human replies
and waiting-topic transitions. Both projections use the same fake clock.
See [the consumer inventory](../../hub/inbox-window-consumers.md) for scope and
the conservative timestamp and durable-wait paths kept unchanged.

`hub/test/inbox-query.test.ts` (T2) builds 50,000 synthetic messages across 200 topics, including 5,000 unread agents in one topic and 2,000 departed requests. It never reads the live hub database. The frozen SQL in `inbox-query-oracle.ts` is the pre-T-1628 oracle; compare candidate order, flags and decoded messages, including request settlement, explicit replies, reads, asks and actionable hub notices.

The timing diagnostic distinguishes the old full query with its frozen message decoder, new full cold call and median of five warm full calls. Timings are reported as evidence, not asserted: the gate checks the partial index and request-set-driven plan (no retained message scan), unchanged candidate count after doubling history with 50,000 irrelevant progress messages, and full equality with the frozen oracle. CROSS JOIN keeps SQLite from reversing the bounded request set and scanning messages. The startup test removes the new schema from a synthetic database before copying it to a disposable project and checks the index, unsettled-request backfill and actual `hub.status` receipt within 15 seconds. No harness OS processes or browser are needed. The fake-clock burst uses real spoke sends, observes all 1,000 companion Agents notices and checks each durable source message. Groups of 20 advance beyond the real rate and loop windows; the message policy stays enabled. The real-path regression fails with 51 rebuilds when the companion-notice guard is absent. A subsequent review request to the human must rebuild, publish and appear in inbox.list. The earlier direct observer mutation control produced 11 rebuilds.
