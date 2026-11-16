# hub/test/suite-command.test.ts

T2 uses fake child streams, native process operations and timers. No process,
socket, network request or real-time stall is needed. Run with
`node --test hub/test/suite-command.test.ts` after targeted admission.

The stall cases finish a file, then hold command close pending. One keeps the
command alive; the other emits native exit 0 while a fake inherited writer holds
the pipes. Assert the retained pre-cleanup exit/EOF evidence and pid/name census,
completed-file exclusion, cleanup ownership, unchanged exit 1 and stall duration,
and exclusion of argv from diagnostics. The signal case retains compatibility
with the previous `{ code, cause }` result shape.

Before admission the stall cases register an owner that waits for launch or
rejection, supplies a terminal fake-child receipt and joins the command before
destroying streams and restoring native mocks, including on early test failure.

Inspection-failure variants reject before emitting the census. They retain the
semantic command-state receipt through in-memory reduction and 40 later noise
lines, with a long unfinished test name pushing state beyond the ordinary
cause excerpt. Both live-command and exited-with-open-pipes states are asserted;
no cleanup authority is granted by the failed inspection.

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
