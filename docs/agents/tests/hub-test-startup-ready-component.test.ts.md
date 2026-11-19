# hub/test/startup-ready-component.test.ts

The topic-context batch case and listener-diagnostic fault cases use the shared
whole-case owner before root acquisition, with named setup/behavior bounds and
late-root/resource adoption. The positive native launch guard covers setup,
body and cleanup; the stage-tree read is explicitly injected. Diagnostic sink
faults exercise both successful listener acquisition and original bind failure,
then check Unix removal and actual TCP rebind receipts. Captured server owners
remain as fallback fixture cleanup if an assertion exposes a listener leak.

The two yielded-freshness cases hold the actual first batch continuation after
16 source refreshes, then observe the settled producer arriving while it is held.
On release, the first batch's 65 rows finish before the queued batch starts;
source and ancestor updates are unique per batch, and the changed ancestor keeps
its notification. The stop variant joins the captured continuation and queued
producer before its close receipt, with no later source refresh or announcement.
Both use the same whole-case owner and native guard, fake Git and clock, and a
scratch in-process tracker. Cleanup releases the captured continuation before
joining writers and removing the fixture.

The cold-start CLI case runs with captured runner lock identity present and
absent. Both variants use the shared fixture CLI boundary and assert the
persisted lock identity after the embedded hub starts. Its mocked spawn acquires
the hub inside the sealed CLI scope, so the fixture metadata must survive that
scope. Whole-callback `fixtureWork` owns the root, hub acquisition and pending
CLI result; teardown releases the held ready check and joins setup/body work
before restoring the environment. A failed embedded acquisition emits a fake
child exit and keeps its rejected promise joined. No native child starts.

Lease-recovery startup coverage uses `startup-ready-component.test.ts` at T2:
persist a releasing lease before `projectHub`, hold the scripted fake DigitalOcean
provider list, inject executor lock process facts through `droplet.processes`,
observe listening separately from session restoration and serving,
and retain the unscaled two-second listening-to-serving bound. Recovery admission
(`executor-recovery-started`) must follow serving. A status socket reply while
the provider is held proves responsiveness; release the gate and observe both
`executor-sweep` and the durable released lease. Separate coverage checks every
named start/completion pair between binding and serving and finite nonnegative
monotonic `durationMs`. No provider credentials, daemon, browser or real machine
are involved; the synthetic provider uses the sealed fixture environment.
