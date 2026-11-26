# hub/test/executor-prepare-component.test.ts

Snapshot advisory cases use `snapshotCase` from setup through owner closure,
with separate named load-scaled `scope.wait` observations for fixture setup/stop,
snapshot setup, acquisition, release and inspection. Owner closure keeps its
shared bounded observation; the original whole continuation stays enrolled.
Base-only drift retains `stale: base` in inspection, publishes no prepare notice
and performs exactly two key reads across acquisition and inspection. Parameterized
lock, Node, recipe and provision cases publish once across a base move and executor
reopen using the persisted receipt. All provider and transport work is scripted;
the shared positive native-launch guard spans setup and cleanup. No timing bound
is asserted and no image is implicitly prepared.

Held acquisition, reap, shard release and snapshot publication cases fence the
directory write inside `guardedLeaseCase`. Each deliberately removes its root
while the writer is held, resumes and joins the original work, then asserts root
absence and the `ENOENT` code (snapshot publication uses the wrapper cause).
Removal allows three retries with a 1 ms retry delay for native filesystem
contention. Cleanup resumes and joins the writer before restoring the seam;
all provider, machine, key and watchdog calls use guarded fakes.
The scoped `heldWriterCase` composition fences both the real cleanup owner and
its nested fixture context. Required executor closers run after the original
callback joins and before nested hub/API cleanup; failed steps are retried, and
restoration is a final successful-cleanup release. Shared normal and partial
setup controls reject a required close through `drainFixtureCleanup`, observe
the retained root, mkdir seam and native guard, then repair and observe closure,
root removal and restoration through that same registered owner.
Each real control callback is enclosed by `fixtureWork` before inner setup.
Named setup and complete rejection/repair proof observations retain the original
continuation after an observer timeout; normal/signal cleanup joins it before
the real fallback can repair or drain the synthetic owner.

Non-readiness preparation cases inject install failure and subsequent release,
recovery checkpoint or recovery rejection. Assert the install outcome remains
the wrapper cause and cleanup appears in its aggregate cause. Provider create
cases assert exact primary identity and preservation of its existing cause
after lease checkpoint or release rejection. Retained recovery and lease
records identify the builder/key; a fresh executor's restart reconciliation
removes the failed-release builder, key and snapshot recovery record. All use
the guarded fake provider, machine, host and clock, with no native launch.
Reservation-checkpoint plus unlock rejection and regional-422 plus checkpoint
rejection assert exact primary identity and secondary cause. The reservation
case observes the retained budget lock, then reconciliation retries its captured
owner and observes ENOENT. Operation waits use named load-scaled scope bounds;
the guarded whole-case owner joins work before restoring fakes or removing roots.

Diagnostic-sink cases reject the regional-refusal run.log append and the final
preparation failure log callback. Acquisition retains the exact provider error;
preparation retains the install error as its wrapper cause. Each primary's
aggregate cause contains the sink rejection, and the fake provider has no
remaining droplets or keys. Both callbacks use `guardedLeaseCase` from setup
through cleanup, including its positively controlled native launch guard.

The exhausted bundle-copy case retains its two timed native-transport receipts
and asserts `DeliveryTransportError.attempts` plus the original cause identity.
Scheduler replacement limits live in executor-run-rules: one replacement in a
different region, durable retry receipt after reopen, and cumulative resource
accounting. Those tests use semantic executor receipts and a native launch guard.
The scheduler callers are enclosed before setup by the shared whole-case owner.
Separate integrated and dev-t3 counterexamples retain infrastructure metadata
after the replacement's second delivery failure and prove no worker started;
reopen keeps the one-replacement fence. Actual allocation-cap proof is in
executor-admission rather than the semantic scheduler fake.

Copy capture uses a guarded fake spawn and fake timers, with no real process.
The timeout alone must not settle the copy: the fake close receipt supplies its
final signal and stderr. Feed 131085 bytes in two chunks with a synthetic known
token crossing both chunk and tail boundaries. The raw 65536-byte tail drops
its partial first line, reporting 65566 bytes dropped and retaining the final
failure line without the token suffix. The launch guard's controls include callback
and promisified launchers. Restore the fake spawn only after copy completion.
Every failed upload retry diagnostic persists even when the next attempt succeeds.
The new callback uses copyFixtureCase's normal/signal admitted owner and named
guard/root setup deadlines; no existing fake helper callers are migrated.
The retry case also injects an append failure: the exact selected copy error
remains Error.cause, a secondary persistence diagnostic stays within 1024
characters, delivery remains unset, and no retry is admitted after that failure.

Readiness expiry cases assert `ReadinessDeadlineError.phase`, `deadlineMs` and
`observedMs` using the fixture clock. The boot probe reports `boot-readiness`;
an expired delivery lease reports `delivery-lease-expiry` through the wrapper's
`Error.cause` and starts no machine command. Keep the human-readable diagnostic
assertion too; never classify expiry by parsing that diagnostic. Neither case
uses wall-clock delay or changes a production deadline.
The bundle writer can consume 600000 simulated milliseconds while the lease
still has 300000 milliseconds left. That case must report
`delivery-budget-expiry`, with no directory command started.

Guarded propagation cases reject acquisition release and builder release,
recovery checkpoint and catalogue recovery. The original typed readiness error
keeps its phase and clock fields; `cleanupFailures` records the ancillary step
and error. Preparation and delivery wrappers preserve it as `Error.cause`.
Builder release/checkpoint rejection retains the persisted recovery record and
does not admit later image cleanup. Each test restores its seam and positively
releases the captured fake lease before fixture disposal. The native launch
guard spans fixture setup, acquisition and cleanup; it includes its own positive
controls. No real provider or native process participates.

Use the existing sealed `projectHub` fixture with scripted provider and machine
I/O and `FakeClock`. No real provider, SSH, native harness or browser is involved.
Keep builder release, snapshot and accounting assertions on their existing
durable status/journal receipts.

The fixture requires stat(`.cland/run`) ENOENT before starting its hub. The fresh
hub case then requires the run anchor directory after serving, prepares the
first fake builder and reads its durable released lease with a non-null provider
identity. `serveProject` creates the anchor during locked setup before recovery;
executor directory writers only create child levels under it.

The fresh-anchor and two hub-stop callbacks enroll guardedLeaseCase before any
fixture acquisition. Their original setup producers adopt late project roots;
resource cleanup is registered before provider acquisition. The shared positive
native-launch guard remains active through setup, body and teardown. Prototype
and filesystem observers use fixture-owned manual patches, restored after the
original work joins, independently of TestContext mock cancellation.

The two hub-stop cases capture the actual startup executor, hold demo-directory
mkdir, start hub stop and release the writer. The ordered compaction and hub-stop
completion receipts must precede a second no-op stop and the absent empty index
assertion, or stat(root) ENOENT when the root is deliberately deleted beneath
the held writer. Removal uses three bounded retries with 1 ms retry delay.
Bound setup and completion separately; always release/join the held
writer before restoring the filesystem seam. Shutdown does not start ledger
or provider recovery after the held compaction returns.

Delivery upload retries use the real `DropletRun.deliver` policy through the
injected machine transport and `FakeClock`, with bundle bytes written only in
the disposable fixture. The 9 MiB sample has a 318000 ms attempt allowance.
The first failed copy consumes 125000 simulated ms; the next successful copy
consumes 250 ms. Assert the persisted delivered lease and both timed run-log
attempts. Exhaustion must leave delivery unset and supply no failing-test
receipt to `diagnosticResult`, which must remain inconclusive. These simulated
durations are policy checks, not network throughput measurements. No real
provider, key, SSH process or network transfer is used.

For prepare report routing, submit without `report` and observe the completed
snapshot report in Agents before asserting empty General history and artifact
list (including no log chip). Prepare currently emits a report without creating
a suite log artifact; do not invent one for the test. An explicit General topic
still receives its completed report. Unlike suite log cases in
`suite-admission.test.ts`, the positive receipt here is the snapshot report.
Default raw frames retain their previous shape (omitted optional `report`);
the new hub chooses Agents and addresses the Coordinator. `--report` remains
optional in old and new executor clients. Drain preparation and stop fixture hubs
before closing the fake provider or removing any directories.

T-1709 provisioning evidence: run `node --test hub/test/executor-prepare-component.test.ts` with supported Node and inherited `CLAND_*` removed. Native T3 runs require the stage preservation lock and disposable fixture roots; never run a provisioning script on the host. Scripted component tests prove root hook ordering and failure output. Key tests prove hook and generic recipe staleness; native prepare tests hash committed hook bytes and retain no-hook snapshot coverage. Recipe inspection checks every Chromium library and both Neovim pins against project sources. QA runs these checks on stage dev; the Coordinator restarts the hub and rebuilds the snapshot before collecting full Linux suite evidence.
