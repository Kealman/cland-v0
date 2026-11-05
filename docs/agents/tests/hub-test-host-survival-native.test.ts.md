# hub/test/host-survival-native.test.ts

`hub/test/host-survival-native.test.ts` uses the three fake native harness binaries,
two authenticated fake SSH hosts, real Unix forwards and production spokes.
It stops the embedded hub for a real twenty seconds, restarts it, kills one
master and requires durable spoke responses after each boundary. Persistent
session rows retain their recorded PID and birth. The fixture joins hub, carrier,
agent and worker owners before removing their roots. No real SSH accounts,
provider services or browser are used.

The tunnel-response wait remains 15 seconds. A host-driven Codex resume must
announce its confirmed subscription so input refused during disconnection is
retried. Presence alone is not that receipt; the test still requires the exact
response after master replacement. On failure it drains the process log and
reports a bounded tail of recovery and injection events.

The final step shuts down the hub without an explicit post-turn Claude stop:
T-1678 owns that shared refusal, with failed captures retained in A-16593. This
scenario keeps its survival assertions and uses the fixture's existing native
writer census/join before removal; the native preservation files keep their
explicit stop assertions.
