# hub/test/host-runtime-join.test.ts


`hub/test/host-runtime-join.test.ts` is T3: its fake SSH transport starts native
forwarding children. Run through the preservation lock in the E-1533 stage brief,
with inherited CLAND variables removed, supported Node 24, and load below 20.
It creates no cloud resources. `sshHostFixture` owns the scratch root, HOME,
Git environment, agent and child cleanup.

- `C1/C2 runtime host joins without restart and removal settles rows and closes carrier and Git` starts an embedded projectHub with no registered host, enables the fake host directory after startup, persists the record and adds it through the daemon's owner. An authenticated directory receipt precedes a bounded session.launch frame. The durable process row must be running on f1. Removal must return empty leftovers, persist revoked/stopped state, fence the captured Host and remove the Git socket.
- `C3 runtime registered host reopens on the next hub start` adds a runtime host, observes its authenticated directory receipt, joins hub shutdown and starts another embedded hub over the same scratch database. It observes a fresh authenticated Host receipt and retains the registered state.

Setup uses testWaitMs; launch and durable launch-row bounds are exactly 5 seconds.
No browser is used. Default fake harnesses prove session routing and row settlement;
existing host-revoke-native tests separately prove native adapter settlement.

Stage QA runs these tests alongside unedited host-ssh-registry, host-relaunch,
host-survival-native and host-revoke-native preservation files. Keep each child
exit and terminal test summary; a missing receipt is incomplete evidence.
