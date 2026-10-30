# hub/test/suite-runner.test.ts

This T3 file owns native runner lifecycle checks: lock ownership, interruption,
stale-process recovery, bundle prerequisites and Web repetition child cleanup.
The process boundary is necessary to observe actual child exits and owned
resources; pure selection and summary rules belong in `web-phase.test.ts`.

T-1301's held Web child contract uses a synthetic prerequisite with no browser.
Arm stdout/stderr and close observers before awaiting the persisted PID receipt
and runner progress; advance only the guard's fake clock by 60 s after those
receipts. Keep final assertions for the exact file/window message, nonzero exit,
all three owned PIDs reaped and run-root removal. Setup and timeout-message waits
are separately bounded; fixture cleanup follows observed process termination.
Two sealed nested Node controls deliberately fail setup before PID capture and
an assertion after capture, while the Web tree remains held. Shared resource
teardown uses explicit full discovery before signalling, captures descendants,
observes bounded close/pipe drain and then permits directory removal. Failure
to drain retains the root. Keep the controls' final three-PID and removal checks.
Run only this case locally with `--test-name-pattern='a stalled Web child'`;
select its failure controls with `--test-name-pattern='held Web fixture reaps'`;
the whole file's deliberate CPU-load contract requires the queued machine lease.

The T-1200 Web repetition contract creates a disposable directory with a new
synthetic `web/test/new.test.ts` and an explicit host-admitted repetition list.
It calls the real repetition launcher, which starts ten fresh file processes in
two sequential lanes of five. This synthetic file proves admission and lifecycle
behavior; it is not a real-browser load soak or an ordinary Web timing sample.
The runner does no Git lookup; T1 owns host merge-base selection and the
populated/empty/absent-list distinction. The native fixture needs no Git project.

Run this file through queued `cland verify` while the runner holds its machine
lease. Its deliberate CPU load must not run as an unleased targeted local
probe. The owning item lead requests source review before verification and
receives the exact-head receipt in the item topic; no per-item QA is required
unless the item policy or a supplied brief says otherwise.

Each repetition owns a separate directory, HOME, XDG/Git configuration and
credential-filtered launch environment. The child bootstrap waits at a gate
until its process identity is registered. Setup separately observes the owned
CPU worker's ready message with a five-second bound. Passing repetition proof
requires CPU progress across the child run, a still-live load worker, exit zero
and one typed terminal Node summary: positive passing count and no failure,
cancellation, skip or todo. Missing, torn or multiple summaries supply no proof.

Keep the final assertions: the launcher reports exactly `10/10 passed`, two
workers and ten attempts; all ten distinct repetition directories retain a
complete terminal summary; the active child-identity set is empty. These are
completion receipts, not launch acknowledgements. Native children have bounded
timeouts, and `finally` observes owned-process cleanup and child `close` before
dropping the identity. The load worker is terminated and its exit observed before
the launcher returns. Fixture removal follows that cleanup, after every writer
has stopped.

The new-file admission check starts in report mode. Its count and missing-proof
diagnostics are separate from the normal Web phase and its wall budget, and use
the existing load-worker summary prefix for running-hub compatibility. A failed
synthetic contract remains an ordinary T3 test failure. See
[Web phase](../tests.md#web-phase) for admission selection and rollout behavior.

T-450's phase-sweep backstop deliberately leaks a detached `node --test`
`hung.test.mjs` runner and its worker from a passing disposable test. The worker
publishes both live PIDs before the leaking test returns. Keep the final
assertions for the exact runner's cleanup diagnostic, both PIDs gone and the
fixture removed. The enclosing test owns emergency teardown only; the generated
leaking test must not register its runner for cleanup. A negative control that
omits the completed-phase sweep must fail the cleanup diagnostic assertion.
This selected case needs no CPU-load worker or browser and may run alone with
`--test-name-pattern='phase sweep reports and reaps'`. The complete file retains
the queued-machine requirement above.

The deliberate-leak fixture registers deferred emergency ownership before
allocating directories or launching processes. It pins a unique token and
planned phase root, recovers the published holder (including its inode/runner
identity) when available, then stops the enclosing runner and its descendants
and observes pipe close before sweeping/removing the planned phase scope. Fixture directory removal has a final drainage
guard. Its missing-marker control fails while the detached hung tree is live,
without publishing the main marker; verify both leaked PIDs and both roots are
gone after the nested test closes. Keep recovery independent of the marker and
keep the primary sweep assertions before emergency teardown. Omitting planned
phase-root recovery must fail this control's final root-removal assertion.

## T4 repetition progress (T-1489)

The selected `T4 repetition progress` case launches a sealed synthetic two-lane,
five-repetition Node test through the production progress reporter. A promise
holds lane 1 until lane 2 completes, reproducing Node's replay of lane 2's
nested completion events when its parent drains. It requires no CPU stress,
browser, Git or hub. Run it locally with
`node --test --test-name-pattern='T4 repetition progress' hub/test/suite-runner.test.ts`.
This is a reporter regression for the T4 hierarchy, not a T4 load receipt.

Use `scratchMachine` and `commandIn` for abort, process reaping and native
close/result drainage, with the final shared fixture-environment seal. The child
has a ten-second Node test timeout inside the command owner’s separate bound.
Assert exit zero after command completion,
exactly ten starts and ten finishes at nesting 2, full parent/lane/case names,
a shared id for each pair, ten reduced completions, and the native 13-pass summary
(ten cases, two lanes, one parent). The fixture root survives until child cleanup.
The full runner file still requires the queued machine lease described above.

Progress JSON fields and finish-only compatibility are unchanged. The emitter
suppresses a completion replay only after the same identified execution and
completion evidence (test number, duration, outcome and error) completed and no
new dequeue owns it. Changed or unidentified finish-only receipts survive. Genuine finish-only receipts remain visible. Consumers
must distinguish nested cases from enclosing lane and parent rows; phase totals
continue to come from Node's summaries. For historical logs such as A-14547,
review/QA audits disclose unpaired replay rows rather than counting them as
additional coverage. No historical log is rewritten.
