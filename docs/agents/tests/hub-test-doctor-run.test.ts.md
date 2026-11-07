# hub/test/doctor-run.test.ts

T2 exercises the owned native-command boundary with a mocked child process and
fake timers. Legacy five-argument callers retain their exact timeout, error and
incomplete-cleanup results. An optional sixth-argument `AbortSignal` terminates the
same owned process group and retains pending state until native close; a signal
already cancelled before launch starts no child. Signals and destroyed pipes
are never counted as close receipts. No native process starts in this file.

`hub/test/git-maintenance.test.ts` covers real group reaping and recovery after
cancelling a collector; its fixture retains the root until writers are gone.

Cancellation remains the sixth positional argument. Optional encoding is seventh
(default utf8); the native birth reader passes undefined for cancellation and
latin1 for binary kinfo bytes. The combined binary/cancel control preserves
bytes 00/80/ff, observes the group signal, holds the native close event, and
keeps its original pending/terminal assertions. Old five-argument calls and
sixth-slot AbortSignal calls retain their behavior.

The pre-aborted probe's additive no-process receipt records zero spawn calls.
`native no-PID error admission` compares joined close, missing close and an
already-observed PID. Only joined no-PID error grants positive non-admission;
error alone, a missing close and a PID seen before error keep existing unknown
semantics. All children/timers in these cases are mocked.
