# hub/test/worktree-host.test.ts

T3 native Git plus recording local Host. Use preparedProject and fixtureEnvironment
for disposable repository, HOME, Git and credential isolation. The recording Host
checks territory-lock exclusion inside every operation, delegates to local Host,
and returns a distinct warning to prove forwarding. Reuse-only diagnostics do not
count as native worktree creation. Assert filesystem receipts after add/remove,
root node_modules resolution and stale warnings after reuse, and claim/item-launch/
prune operation counts with fakeHarness Sessions. Stop Sessions and Tracker before
fixture removal. No provider or native harness starts.

Behaviour preservation requires individual unedited runs of
hub/test/task-worktrees.test.ts, hub/test/task-worktrees-lifecycle.test.ts,
hub/test/worktree-cli.test.ts and hub/test/territory-lock.test.ts.
The existing hub/src/hub/worktrees.test.ts also covers prune races and CAS rollback.

Held native-registration and branch-command continuations cover raced parent
replacement before install I/O, install-error preservation, and authorization
revocation after durable branch creation. Bound setup with eventually and release
all holds plus join the operation before restoring mocks or removing roots.
Check captured-tip deletion and concurrent-writer retention separately.
