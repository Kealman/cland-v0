# hub/test/session-host-routing.test.ts

Every case keeps the positive native launch guard through cleanup. The local
PID collision case checks the sweep's local-only `orphanSessions` input
directly. Native sweeping remains covered by T3 `host-orphans.test.ts`, whose
case "remote rows neither protect nor authorize sweeping local matching PIDs"
checks actual removal and preservation. This component file remains T2.

`hub/test/session-host-routing.test.ts` is T2. Use projectHub with real adapters
and recording Hosts; no real harness, provider, login, browser or SSH is needed.
The remote PID deliberately equals the test worker PID. The local spy must see
no operation for startup, the adapter poll, resume or stop. Observe the completed
Host poll with a bound, and assert the final persisted stopped row. The orphan
sweep uses a disposable root and receives no authority from a remote row.

Pending-stop recovery uses a recorded Linux birth without a legacy timestamp;
assert the durable pending receipt and process row are removed after Host stop.
The CLAND_TEST_HOSTS frame test checks the explicit stop refusal, live colliding
local PID and flushed hub.log Host operations. A remote Claude row without a
PID refuses native job-id stop. Fixture environments use fixtureEnvironment.

`session-host.test.ts` additionally checks mismatched boot/start proofs, malformed
or missing Linux identities, local legacy upgrades and remote legacy rollback.
Keep `session-stop-races.test.ts` and `session-async-processes.test.ts` unedited as
local behaviour preservation evidence. Unknown-host and prior-wire compatibility
remain in `host-registry.test.ts`; native orphan authority is in
`host-orphans.test.ts`.

Remote Claude resume tests persist both pending and replacement PIDs with
Linux proof and null legacy timestamps. Remote poll tests retain the original
PID ownership without discovery. Controls reject foreign job/conversation
ownership, birth reuse during proof validation, owner changes during identity
I/O and close while identity is held. Hold observers before native I/O, release
every held reply and join adapter close before storage teardown.

T-1556 migrates the two remote Claude poll acquisition cases: timer ticks now
assert no discovery and no candidate PID proof/acquisition, preserve the saved
Linux birth identity and native owner, and observe Host liveness only for a
recorded PID. The resume acquisition cases retain their assertions.

Attach rendering also consumes a row Host's layout. Recording doubles supply the
scratch local Host's pure layout resolver without changing their name, process
methods or signal refusal. The CLAND_TEST_HOSTS frame case still uses that
registry's identity/stop implementations; only its adapter-side layout is supplied.
The first case excludes the pure limitPolls setup getter from its process trace,
while retaining its no-local-operation and local PID survival assertions. All
birth, stop, persistence and collision assertions remain.
