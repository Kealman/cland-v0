# hub/test/planned-stage.test.ts

Use the sealed `tempProject` and in-process `planStageHub` fixture with injected
`PlanGit` history. `task plan show` checks the CLI projection; Tracker views and
the next task's persisted `planned` status check stage closure and advancement.

Evidence-only completion requires closed `done`, a null branch, no landing
receipt and no dev `Item:` trailer. Keep the mixed landed/evidence-only regression
and the empty unlanded branch counterexample. A second trailer-free stage's
closure observes the shared history read before asserting that a task with an
`Item:` trailer and a missing receipt stays open. Hold and fail the Git history
read to prove unknown/error handling, then drive the fake clock for its retry.
History is shared per dev tip; old landing-only stage hashes stay compatible.

The per-item landing/ten-close workload uses `sqliteProbe` on its fixture-owned
tracker connection, counting executed tracker statements rather than replacing
`DatabaseSync.prototype.prepare`. T-539 measured the same landing at 3,432
statements before indexed freshness selection and 3,403 afterwards, with three
stage checks in each run (local macOS arm64, Node v24.21.0, no duration gate;
baseline source `8de5c988`). The old prototype counter measured 3,475 prepares
on that tree across all connections, rather than executions on the tracker
connection, so it is not directly comparable to the fixture-owned trace. The
historical ~9,795 count predates T-538's own-id hydration fix. Keep the 10,000
workload budget; the T1 summary regressions enforce freshness-only selection
without relying on a tight total-workload threshold.
