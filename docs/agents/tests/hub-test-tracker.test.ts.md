# hub/test/tracker.test.ts

`a hand edit of an item file is re-indexed before its CLI projections are checked`
uses `reindexedAfter` to capture the log prefix before writing, then waits for a
new `task-reindexed` receipt naming the exact file and `source: hand`. It retains
the CLI title, state and label assertions. The harness condition deadline is a
failure budget, not a claim about filesystem latency on a loaded executor.

The 100 ms settling contract is covered with fake time in
[`tracker-summary.test.ts`](hub-test-tracker-summary.test.ts.md). Do not restore
elapsed-time assertions or use CLI startup as the watcher completion boundary.
The fixture's native hub is required for the real filesystem watcher receipt.
