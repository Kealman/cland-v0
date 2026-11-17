# hub/test/startup-ready-component.test.ts

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
