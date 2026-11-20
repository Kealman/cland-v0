# hub/test/worktree-host.test.ts

The durable branch-revocation case holds the public owned-Git result only after
native completion. A positive hold check precedes revocation or the concurrent
writer. The original captured-tip/removal assertions remain, with command owners
and whole-callback work joined before observer restoration and root cleanup.

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

Occupancy controls supply a Host-only cwd alias: list must show its occupant and
prune must refuse it. Return occupants at locked admission and at the final
pre-Git cleanup check separately; assert the native directory remains and no
Host removal occurred. Host statDirectory controls change a synthetic worktree
or session inode at validation, while the native paths remain unchanged; both
must retain the worktree. Record Host realpath and statDirectory inputs for each.

Preserve both identity-change and occupant facts when they coincide. The unedited
hub/test/tracker-native-boundary.test.ts alias races cover both diagnostic
expectations; run that whole file after changing pre-removal checks.

T-1702 remote-checkout regressions use bounded real territory-lock acquisition inside fake Host removal/registration to reproduce the push-join cycle without a30s stall. Add, relaunch and removal must permit that acquisition. Removal checks a durable `removing` row, rejects concurrent add/relaunch and preserves changed row, tip or lease state after re-acquisition with a named refusal. Local recording-Host preservation cases retain their original locked behavior.

The preflight contention regression first observes native receive-pack advertisement, arms its exact lock-record observer, then triggers prune; the observer closes that admitted receive and prune must wait for native close/release. Setup bounds use testWaitMs. Nested add/relaunch/prune callers refuse before reading or writing checkout state, preserving the outer owner. Simulated join-cycle cases use the named100ms RECEIVE_JOIN_BOUND_MS behaviour cap.

Finalization controls hold the final occupant or validation observation, then durably reopen the Tracker item or replace the ownership row. Both retain the branch and row with a named changed outcome. Public relaunch admission controls admit a real native receive first, observe the contender reading its exact lock record, optionally close the item, and close/join that receive before checking admission. The nested public caller must refuse before entering the serial queue or reading item state. Register native daemon/client ownership before setup awaits and drain them before closing Tracker/Store.
