# hub/test/poller-lease.test.ts

T1 ownership seam: `PollerLease` over `Store.remotes`, `FakeClock` and
`fakes/poller-processes.ts`. Two Store handles must target the same disposable
hub.db. Observe the durable owner row and the terminal acquisition/refusal
promise; a timer count alone is not ownership or completion evidence.

Keep the exact 60-second fake-time refusal, release acquisition, dead-holder
recovery, same-ps-second native birth mismatch, unreadable holder preservation,
unknown own birth refusal, persisted-owner reopen, cancellation and delayed
probe/successor race. The process boundary has inspection only, with no signal
or stop method. Native production inspection uses the shared precise birth
probe, with a probe deadline capped by the remaining lease wait. Test timeouts
bound fixture mistakes; they are not elapsed-time evidence.

The held native-probe case uses `fakes/held-remote-boundary.ts`. It installs an
unconditional resource owner before launch, bounds setup with 1000 ms of fake
time, and makes setup abortable through both the fixture and test signals.
Disposal aborts setup, releases the producer, joins the actual lease operation,
then releases owned leases and closes SQLite. Keep both omitted-receipt and
aborted-setup controls: they invoke the exact registered disposer and retain
the cancelled acquisition result and closed-database assertions. The original
successor/CAS assertions remain in the normal held-probe case.
