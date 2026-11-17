# hub/test/host-runtime-join.test.ts


`hub/test/host-runtime-join.test.ts` is T3: its fake SSH transport starts native
forwarding children. Run through the preservation lock in the E-1533 stage brief,
with inherited CLAND variables removed, supported Node 24, and load below 20.
It creates no cloud resources. `sshHostFixture` owns the scratch root, HOME,
Git environment, agent and child cleanup.
The authoritative `projectHub.hostEnvironment` is captured at registry creation;
its mutable membership is shared with the running registry/carrier, while the
daemon's launch-input environment remains separate for credential isolation.
Its owned work scope fences admission synchronously at disposal and joins the
whole setup and admitted Git/FS sequences before native owners, database or root
are closed. Each next step checks that fence; newly acquired owners are recorded
before checking again. A missed 35-second work join reports incomplete and keeps
the root, database and native ownership for recovery.

- `fixture disposal joins held repository setup and fences exclude enrollment` holds the continuation after real Git init, arms an abort observer, begins the fixture's real disposal hook and observes the root still present while the exclude step is unexecuted. Releasing the hold must reject setup, then disposal completes before the exact root absence assertion.
- `fixture disposal joins a held clone sequence and fences its later filesystem write` holds after a real cloned seed receipt, observes disposal admission, reads that seed while the root remains owned, releases the hold and requires cancellation with no later write and completed root disposal. These use explicit disposal while work is pending rather than waiting for a test timeout; gates are released and all promises joined on assertion failure too.
The raw fixture initializes its disposable Git repository and excludes
`/.fixture-sockets/` through `.git/info/exclude` before enrollment and allocation.
Later `git init`, overwritten `.gitignore` files and `git add .` retain that local
exclude. Socket aliases and host markers therefore stay out of committed trees
and cloned checkouts; the private-directory guard remains enforced on real storage.

- `enrolled host socket metadata stays out of a committed and cloned fixture root` adds and commits the whole root, checks ordinary seed content is present while the exact socket subtree is absent from the Git tree, clones it and checks the seed exists and socket metadata does not. Every Git command uses the fixture's sealed environment and finishes before fixture disposal.

- `C1/C2 runtime host joins without restart and removal settles rows and closes carrier and Git` starts an embedded projectHub with no registered host, enables the fake host directory after startup, persists the record and adds it through the daemon's owner. An authenticated directory receipt precedes a bounded session.launch frame. The durable process row must be running on f1. Removal must return empty leftovers, persist revoked/stopped state, fence the captured Host and remove the Git socket.
  Before hub startup it resolves the registered socket parent under the fixture root and checks its owner UID and private permissions. After runtime admission it observes the real Git socket and requires the same path and physical parent. The raw `sshHostFixture` enrolls its root before its first registration; later fake-host setup cannot change an existing carrier's path. Directory disposal retires that enrollment after native writers close.
- `C3 runtime registered host reopens on the next hub start` adds a runtime host, observes its authenticated directory receipt, joins hub shutdown and starts another embedded hub over the same scratch database. It observes a fresh authenticated Host receipt and retains the registered state.

Setup uses testWaitMs; launch and durable launch-row bounds are exactly 5 seconds.
No browser is used. Default fake harnesses prove session routing and row settlement;
existing host-revoke-native tests separately prove native adapter settlement.

Stage QA runs these tests alongside unedited host-ssh-registry, host-relaunch,
host-survival-native and host-revoke-native preservation files. Keep each child
exit and terminal test summary; a missing receipt is incomplete evidence.
