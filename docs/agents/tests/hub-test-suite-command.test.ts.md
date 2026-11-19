# hub/test/suite-command.test.ts

The scoped CLI guard regression uses an in-memory callback fake as its
underlying launch. It proves the exact scoped callback is delegated once,
while unscoped/altered entries, custom promisification and spawn are refused;
caught violations remain a failed guard verification receipt.

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

Infrastructure cases mock the dedicated file receipt independently of stderr.
The same planted stderr line with exits 0 and 75 cannot supply a cause without
that receipt. A positive receipt retains the previous `{ code, cause }` shape.
The matrix observes the command's settled outcome immediately and bounds its
launch setup separately at five seconds using a native timer captured before
behaviour timers are mocked; setup failure cannot strand an unobserved rejection.

The shared fake-native guard positively denies every child-process launch entry,
the ChildProcess prototype, and both exec/execFile custom promisifiers before
installing expected fake spawn. Its final census includes cleanup. Receipt
faults retain exit75 through read failure, receipt close failure and oversized
input; the fake reader counts at most4096payload bytes plus one oversize sentinel.

Inspection publication controls inject throwing summary and callback sinks,
including rejected callback promises, beside selected exits75and0. Both sinks
are attempted independently; primary code/cause and inspection remain available,
secondary diagnostics contain error classes only, and actual signal-listener
sets return to their captured baseline before fixture teardown. Rejection-path
worker controls retain the original failed inspection and exactly one durable
receipt even when both publication sinks fail.

Register the caller's teardown before acquiring the guard. Its mandatory
registerRestore callback captures restoration before the first mutation; the
guard's installation try/catch also covers partial installation. Fault controls
exercise a partial install and a caller setup failure, then observe all module
functions and the prototype restored. Matrix teardown joins the fake command,
destroys streams and restores mocks before releasing the guard.
