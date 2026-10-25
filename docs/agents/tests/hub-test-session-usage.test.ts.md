# hub/test/session-usage.test.ts

The journal tests drive the coalescer with `FakeClock` and the in-process fake
adapters; assert the `session.usage` frame and the journal record, not wall
time. `CLAND_TEST_USAGE_EVENT_MS` shortens the publication window.

The durable-row test uses `componentHub`/`stopComponentHub` on one scratch root
and the same `FakeClock`, so the second hub re-reads the real process table. It
relies on the restarted fake adapters starting empty: only
`harness_processes.usage` can carry the totals. Keep the per-flavour loop over
`FAKE_FLAVOURS` (Claude Code, Codex, OpenCode) and its stop/archive read of both
`processes` and `rows`, which is the workbench data source. The loop stops the
hub before the coalescer window closes and first checks that no `session.usage`
frame went out, so the row's immediate checkpoint is what is under test, not the
publication. A separate Codex case feeds a rate-limit-only object after the
restart: the stored total, last counts, raw token report and model must survive,
and a later object that carries a total must replace rather than add. It is T2
and runs alone locally.
