# hub/test/host-watchdog.test.ts

`hub/test/host-watchdog.test.ts` is T3: real detached Node, fake provider only,
isolated machine HOME/Git environment, 30-second real lease. Its first case closes the lease
database owner before expiry; its second creates a full fake host and stops the
hub while the worker is alive. Each waits for the durable receipt containing both
confirming reads, provider status `gone`, and settled `hosts` spend. Setup and
receipt waits are bounded separately. Native cleanup is registered before arm.
Run serially under the epic preservation lock, with one-minute host load below 20.
No browser, Docker or real provider API is involved.

`hub/test/host-watchdog-loop.test.ts` is T2: FakeClock, production lease-file
reader and provider files. It proves renewal and ledger accounting without native
process timing. `hub/test/host-watchdog-identity.test.ts` is T1: injected probes
prove fresh identity stop and reused/unknown identity refusal.

Preserve the existing host-create-ready and host-provision-gate T3 tests and the
host-lease, host-destroy, host-create-entry, host-create-admission and
host-provision-recovery component regressions. The Reviewer receives results
through `lead T-1748` in the item topic; stage QA runs on integrated dev.

Correction regressions cover invalid receipt ownership/reads at startup and
publication conflict, first-timestamp reuse, and unknown recovered identity
retaining input/lease without signals. The T1 host-watchdog-drain test injects a
failed first stop and proves later joins, census and closure proof still run;
unknown closure retains the root. Native fixture removal uses a positive closure
guard, and incomplete rollback asserts its captured watchdog is alive.

Outer native timeouts sum named setup, arm, receipt, ledger, stop and cleanup
budgets. The behavior remains a real 30000 ms lease and literal 35000 ms receipt
bound. These timeout envelopes are failure budgets, not measured test durations.
