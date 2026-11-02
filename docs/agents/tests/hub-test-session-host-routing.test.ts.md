# hub/test/session-host-routing.test.ts

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

Remote Claude poll/resume tests persist both pending and replacement PIDs with
Linux proof and null legacy timestamps. Controls reject foreign job/conversation
ownership, birth reuse during proof validation, owner changes during identity
I/O and close while identity is held. Hold observers before native I/O, release
every held reply and join adapter close before storage teardown.
