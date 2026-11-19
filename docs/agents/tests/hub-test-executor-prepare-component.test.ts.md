# hub/test/executor-prepare-component.test.ts

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
