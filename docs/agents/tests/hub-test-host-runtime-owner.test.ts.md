# hub/test/host-runtime-owner.test.ts


`hub/test/host-runtime-owner.test.ts` is T2. It supplies typed fake carrier and
Git owners to projectSshHosts; it starts no native process or socket and needs no
preservation lock. Run with inherited CLAND variables removed on supported Node.
Scratch directories and fixtureEnvironment isolate HOME and Git state.

The tests prove startup/runtime add share opening order, a persisted registered
host reopens after owner close, and removal invokes settlement before carrier
and Git closure. Revoked registrations cannot reopen. Native connection, session
frames and database row settlement are covered by host-runtime-join.test.ts.

The runtime lifecycle regressions also prove:

- Duplicate add retains the published Host and does not reopen or close owners.
- A throwing onAdd joins rollback through a deferred carrier-stop receipt before retry can publish a new Host.
- A failed remove retains the Host owner and defers map removal until a successful cleanup retry; both attempts retain the settlement-before-close order.
- Shutdown during deferred carrier.start prevents publication and joins rollback before close resolves; later add refuses.

Deferred setup is bounded by testWaitMs, and fixture cleanup releases every gate
before joining the owner. These cases exercise public owner results and typed
carrier/Git callback receipts, with final ownership and call-order assertions.

The rollback trace records public add rejection after Git closure and queues the
retry while carrier stop is held. The shutdown trace records public close
resolution after rollback and Git closure. These final traces reject detached
background cleanup even if every native-free cleanup callback eventually runs.
