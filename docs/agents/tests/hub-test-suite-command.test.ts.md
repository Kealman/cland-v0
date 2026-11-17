# hub/test/suite-command.test.ts

T2 uses fake child streams, native process operations and timers. No process,
socket, network request or real-time stall is needed. Run with
`node --test hub/test/suite-command.test.ts` after targeted admission.

The stall cases finish a file, then hold command close pending. One keeps the
command alive; the other emits native exit 0 while a fake inherited writer holds
the pipes. Assert the retained pre-cleanup exit/EOF evidence and pid/name census,
completed-file exclusion, cleanup ownership, unchanged exit 1 and stall duration,
and exclusion of argv from diagnostics. The signal case retains compatibility
with callers consuming the previous `{ code, cause }` result fields.

Before admission the stall cases register an owner that waits for launch or
rejection, supplies a terminal fake-child receipt and joins the command before
destroying streams and restoring native mocks, including on early test failure.

Inspection-failure variants reject before emitting the census. They retain the
semantic command-state receipt through in-memory reduction and 40 later noise
lines, with a long unfinished test name pushing state beyond the ordinary
cause excerpt. Both live-command and exited-with-open-pipes states are asserted;
no cleanup authority is granted by the failed inspection.

The retry cases inject three failures followed by successful captures, or seven
consecutive failures, with mock Date and timers. They assert continued retries,
one secret-free summary, failure counts, recovery and the five-second ancestry
bound in the command result. Semantic retention keeps the summary after noise.
Exit status and cause remain unchanged because these diagnostics are report-only.
The ownership variant recovers after three failures, captures a writer, then
fails again. Its stall cleanup retains that writer after reparenting and never
signals the unrelated process found by the cleanup census.

New inspection cases and the watchdog sequences enroll the whole callback in
`fixtureWork` before admission. Teardown fences that callback, releases the fake
child/launch wait, joins callback and command, then destroys streams/restores
global mocks. Cancellation checks fence resumed setup and timer continuations.
The worker-result case runs the production worker writer against a scratch root
with empty compatibility locks, fake command/native identity operations and fake
Git/Node probes. It holds a silent fake child through seven seconds, makes every
ancestry probe (including cleanup) fail, and reads the atomically published
result JSON after worker completion. It asserts the original failure code/cause
and the crossed ancestry bound in the durable result, with no native signals.
The Git/Node fake replaces the complete execFile binding and supplies its own
custom promisifier, both sharing the same callback fake. Before replacement a
synthetic native boundary proves the custom-route negative control; after worker
completion its count must be unchanged. A native ChildProcess.spawn guard also
refuses any accidental delegation. Admission races fake launch against early
worker completion so a refused setup cannot strand the callback on a launch wait.

The startup cases feed a fake file-start with no first test and advance native
mock timers to one millisecond before and exactly at the 30-second allowance.
They assert owned termination and the same command/pipe/process stall evidence.
Other cases cover load factor 2, a half-stall-time cap, duplicate starts,
unrelated file progress/output, first test/suite receipts, completed empty files,
normal command close, same-file progress from a different reporter, and the
previous untyped progress shape. Reporter UUIDs in existing progress IDs keep
parallel repetitions from acknowledging each other's startup. No native process
or real-time wait is used. The startup guard is setup headroom; test behaviour
deadlines remain exact.

Ownership cases cover a new runner's normal start/finish, native exit without
finish, malformed ownership markers, and a hung inner owner falling back to the
no-output guard. The unmarked held child remains the old-candidate control.
