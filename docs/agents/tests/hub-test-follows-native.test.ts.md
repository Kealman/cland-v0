# hub/test/follows-native.test.ts

Freshness scheduling and Git batching have native contracts in
`follows-native.test.ts`: generate 1,000 commits, hold a demo history read, then
require the settled ancestor/contains receipt within two seconds. Each native
repository-setup Git command, including fast-import, has a five-second timeout;
demo entry has its own five-second observation bound. These setup bounds are
separate from the unscaled two-second foreground bound. The test prints the
observed foreground time, retains both final
cache assertions and requires the demo to remain outstanding until that receipt.
It then observes demo completion and counts two history reads, with no per-commit
`diff-tree` calls. A native merge/side-branch/rename/revert case keeps exact
conflict commit/path results. Closed-demo restart reads and pending-tree cover
filtering use T2 injected facts.

For copied-live diagnostic evidence, `node hub/scripts/measure-freshness.ts
/absolute/project` copies tracker, durable finished suite history and private Git
objects/refs into a disposable project, starts a `projectHub` with sealed fixture
accounts/config and observes E-412 stage 3 through the `task.plan show` request.
This repository-specific probe retains the Linux and macOS cover IDs. Source
hooks, remotes, provider credentials, PIDs and queued workers are excluded; the
fake hub clock suppresses schedules, while timings use the real monotonic clock.
`--recompute` additionally removes only the scratch derived stage-closure
checkpoints, recreating a restart before closure persistence. Label that stronger
case separately. Output records elapsed time, Git invocation counts and history
scan ranges; publish it with source head/tree and platform. This is a diagnostic,
not a suite receipt. Let other local measurements finish before comparing times.
