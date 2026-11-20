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

The restart turn holds Claude's asynchronous `UserPromptSubmit` child before
process creation. After the same input's native Stop hook has completed and
the mod's idle state is observed, it releases that child and waits for its
completion. The next tunnel response still has the original 15-second bound.
This reproduces a late native start timestamp overwriting a completed mod turn
without CPU load. The fake's structured close receipts name job, prompt, event,
PID, exit code, signal and spawn error. A successful close and independent
production interpretation of that exact prompt are both required; a `done` log
line is insufficient. Missing close metadata is explicitly incomplete.

The whole callback uses the shared normal/signal case owner and the SSH fixture's
`runOwned` admission. Initial setup has its own `4 * testWaitMs() + 20000` budget.
Response and replacement observers are admitted before the trigger and joined
on every exit; cleanup releases the hook hold before removing fixture roots.
Failure diagnostics retain at most 32 KiB of the hub log and preserve the
selected response error if status requests, reads or closing the log fail.

The final step shuts down the hub without an explicit post-turn Claude stop:
T-1678 owns that shared refusal, with failed captures retained in A-16593. This
scenario keeps its survival assertions and uses the fixture's existing native
writer census/join before removal; the native preservation files keep their
explicit stop assertions.

T-1692 sets the outer guard to `8 * testWaitMs() + 120000` (240 s with
the default15 s setup budget; `CLAND_TEST_WAIT_MS` overrides that budget).
Initial carrier/welcome setup uses the shared budget. Both post-restart welcome
calls retain an explicit15000 ms behaviour deadline, as do response receipts.
The required real20 s downtime remains unchanged.
