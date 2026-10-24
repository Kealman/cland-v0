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
