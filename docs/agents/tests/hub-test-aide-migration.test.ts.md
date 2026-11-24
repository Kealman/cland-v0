# hub/test/aide-migration.test.ts

`hub/test/aide-migration.test.ts` is T2. It serves isolated projects with fake
harnesses and clocks. Setup uses `testWaitMs()`; it has no migration latency
assertion. Publication and policy assertions remain exact.

The held-read regression starts cleanup while `projectHub` is still loading
roles. It releases that read, joins startup and cleanup, then observes the
hub's stopped receipt, removed discovery file and cleared scheduling. The ready
startup control keeps the existing client, hub, directory cleanup order. The
shared fixture registers cleanup before its first asynchronous acquisition so
a caller timeout cannot leave a late hub outside teardown ownership.

The cleanup controls enroll `caseDeadlines` with the shared normal/signal
owner before acquisition. Roots are adopted before subsequent fenced steps;
setup receipts have names and their own `testWaitMs(5000)` observation bound.
The shared `fakeNativeGuard` positively denies callback and custom-promisify
launch routes. Its verification and filesystem-patch restoration follow the
whole-case join and captured cleanup, including directory removal.

The card-registration and readiness rejection controls run the acquired embedded
hub with fake harnesses. They retain the original thrown error, observe completed
process-log closure before rejection, then drain the fixture hooks and their
resource check before asserting discovery/socket removal and cleared scheduling. The
readiness fault uses the real assertion with a false input at its named boundary.
These controls enroll the synthetic context's exact drainage before acquisition.
`guardedLeaseCase` retains patches and the positive native guard until that
drainage succeeds; a settled startup promise alone never enables restoration.
The rejected-close control requires the exact original error and the secondary
receipt from `projectHubStartupCleanupFailures(context)`. It exercises actual
guarded root removal and seam release while the log close rejects, then repairs
the close and confirms drainage. The caller-cleanup control requests teardown
while startup is held at log close, expires only its fake-clock observation,
observes the retained root and refused seam release, then releases the producer
and confirms cleanup and actual root removal. No global mock is restored in a
finally on these paths.

The expiry control advances the hub's injected clock across a 1 ms cleanup
observation bound, exercises the real directory-removal guard, observes the
retained subject directory, then releases startup. It requires the hub's stopped
receipt without invoking fallback cleanup first. The startup-to-stop producer
remains owned after the observer rejects; resource checks join that producer.
`ProjectHubOptions.startupCleanup` injects this observation clock/budget only;
it is consumed by the fixture and never forwarded to the served hub.

Loaded process-exit evidence needs the Coordinator's native slot. T-1947 uses
N=10 sequential fresh test processes, recording each load, native close, exit
and signal. Its manual helper source and results are published as artifacts;
the helper is not a verification tier or a committed suite entry point.

The T-1947 baseline at the initial `.cland/log` mkdir used a 2300 ms hold
before acquisition completed: all ten processes printed their seven test
outcomes, then remained open until the probe's 15 s watchdog sent TERM
(A-20991). With the fixed harness and setup budget, the same hold produced
ten native exit-0 closes and seventy structured passing case receipts
(A-20992). The close measurements include the injected hold and all startup
and teardown; they are not a comparison of execution speed. An earlier roles
read hold produced ten cancellations with clean closes (A-20987), and a
two-worker admission attempt ran no tests because load stayed below 8.

These loaded receipts belong to the first source epoch (`e69f3bf35` candidate
contents); they are retained evidence, not configured verification or a new
loaded receipt for the later review corrections. Those corrections have their
own targeted red/green evidence. No additional stress or native run was made
for the corrections.

The T3 sample receipt (A-20993) records eight host-fixture-cleanup and six
fixture-socket-lifecycle passes. The selected release-item case still hit its
existing 5000 ms deadline, but closed natively in 6.4 s; the Coordinator
attributed that test cancellation to T-1951. It is not a passing sample.
The exported probe and capped preload sources are A-20994 and A-20989.
