# hub/test/startup-ready-component.test.ts

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
