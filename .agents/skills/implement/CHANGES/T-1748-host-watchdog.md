# T-1748: detached host watchdog

Host provisioning arms a detached worker using the executor's arm/identity/stop
helpers. Preserve the production lease-file boundary and the shared immutable
absence receipt: hub destruction and the watchdog must settle the same timestamp.
Hub shutdown leaves this worker running; fixture cleanup must observe native
closure before removing its root. See docs/hub/host-watchdog.md and
 docs/agents/tests/hub-test-host-watchdog.test.ts.md.

Source-review corrections validate bound confirming-read receipts at every reader,
require positive native retirement proof, and retain roots when fixture joins
remain unproved. Test outer envelopes include setup and cleanup separately from
the unchanged 30-second lease behavior.
