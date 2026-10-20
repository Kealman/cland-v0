# T-768: connection-local Store statements

The Store now reuses up to 256 prepared statements per connection, keyed by exact SQL.
A full cache evicts its oldest entry, and close clears the cache before closing SQLite.
All 172 Store prepare sites use that helper. An AST comparison against the baseline
confirmed their SQL argument expressions are unchanged. Bindings, transaction boundaries,
permission checks and visibility rules are unchanged. The one-shot read-only role lookup
continues to prepare directly on its short-lived connection.

## Before/after burst

Run: `node hub/test/inbox-load.ts`, Node v24.21.0, darwin arm64, 2026-10-20.
Baseline: `2bfa813baa19b1d209b40175c3c3df867308c982`, with only the measurement
instrumentation applied. After: the same source plus the Store cache. Each run creates
300 topics and 3,000 retained messages, 20 fake sessions, and sends 400 paced protocol
requests over five seconds (200 lifecycle signals, 100 hold releases, 100 comments).
The counters cover connections injected into the serving hub, including Store, tracker
and adapter databases. Seed/setup/teardown are outside the measurement window; cached
statements prepared during startup are still traced when executed during measurement.

| Metric | Before | After |
| --- | ---: | ---: |
| Protocol requests | 400 | 400 |
| Native prepare calls | 23,874 | 16,528 |
| Executed get/all/run calls | 23,474 | 23,542 |
| Inbox query executions | 17 | 17 |
| Inbox executions per round | 3, 4, 3, 4, 3 | 3, 4, 3, 4, 3 |
| Process CPU milliseconds | 1,351.639 | 1,798.536 |
| CPU milliseconds/request | 3.379 | 4.496 |
| Elapsed milliseconds | 4,999.198 | 5,047.003 |
| Machine 1-minute load at measurement start | 11.907 | 9.854 |

Preparation fell by 7,346 calls (30.8%) across all instrumented databases; only Store
caches statements. Executed operations differed by 68 (0.29%); the paced harness also
admits background serving work, so total counts are observations, not an exact fixed
execution census. Both runs made the same 17 inbox rebuilds. No SQL workload was removed.
The deterministic Store regression separately proves repeated reads prepare the SQL once
per connection while returning fresh bound values and observing writes and rollback.

CPU increased in these indicative samples. The machine was busy with the debt sweep;
targeted visibility tests also overlapped the after sample. These CPU figures do not
establish a performance regression or improvement. No quiet-machine or 50% CPU claim is
made; the Coordinator moved that target and presence/visibility batching to a follow-up.

Raw receipts:

- A-7271: `/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7271-t-768-before-inbox-load-sql-and-indicative-cpu-counters.json`
- A-7272: `/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7272-t-768-after-inbox-load-sql-and-indicative-cpu-counters.json`

## Validation

- Store: 20/20, including per-connection reuse, fresh bindings, rollback and connection isolation.
- Inbox workload: 8/8. Query-budget tracers now observe execution so cache hits remain visible.
  The archive batch check still counts preparation of its one row-update statement.
- Name reservation: 67/67. Two late fault injections now target statement execution so warmed
  Store statements still exercise terminal publication and rollback recovery failures.
- Visibility: 7/7 unchanged. Permissions: 13/13 unchanged.
- `npm run check` passed (typechecks, static guards and test lint).
- Same-head queued verification follows source review; its hub receipt is the suite evidence.
