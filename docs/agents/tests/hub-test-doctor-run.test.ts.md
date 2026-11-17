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

The ninth `run` argument optionally supplies `CommandOutput`. Agent RPC callers
use a combined 1 MiB UTF-8 retention budget for stdout and stderr; overflow
retains rolling tails of at most 4096 UTF-8 bytes per stream while draining until
native close, without splitting multibyte characters. The mixed multibyte
control sends ten frame caps, checks retained strings after each chunk, keeps
the no-signal and pending-before-close assertions, and preserves the native
exit with an explicit overflow error. It also checks final stdout/stderr markers
and byte-bounded multibyte tails after overflow. An oversized first chunk through raw
agent `run` retains the existing frame-cap refusal. Doctor's default collector
is intentionally unlimited; its control deep-equals complete output above the cap.

These three cases enroll their entire callback in shared `fixtureWork` before
fake acquisition and separately enroll command/assertion promises. Teardown
fences admission, aborts even commands resumed after environment mapping,
releases the fake child close, and joins all admitted work before destroying
and observing stream closure and restoring global spawn/kill mocks. An
incomplete join retains the mocks and streams. These controls leave native
immediates and the shared cleanup deadline running; older deadline controls
continue using fake timers. No real command or process is launched.
Failure controls abandon an admitted command and hold an environment continuation
through closure. Both keep mocks installed until their work joins; the late
command sees the aborted signal and starts no child. The held continuation has
a teardown release registered before acquisition, including assertion failures.
The fixture denies unexpected spawn commands and every other child-process
launcher, including callback and promisify.custom exec/execFile routes. Positive
controls check these denials before the command under test is admitted.
The guard also traps `ChildProcess.prototype.spawn`, covering pre-captured
launchers. Every non-control denial is counted and cleanup asserts zero attempts
after work and streams have joined; catching a denial cannot hide it. Separate
public/native-delegation controls deliberately catch an error and require cleanup
to fail on the recorded attempt. The latter retains the constructor before guard
installation and exercises its guarded native delegation method. Positive
controls invoke the protected method directly, preserving tier-tripwire enforcement.

Guard assignments and their restoration belong to the fixture, independently of
node:test's automatic context mock restoration. An independent set tracks the
original body and command promises. Its join never races a deadline: if bounded
close fails, guards stay installed, and deferred disposal restores them only
after original work positively joins. A held-work control injects a failed bound,
models context mock restoration, checks guards remain installed, then releases
and joins original work before checking restoration. Its release is prearmed
before acquisition. The injected bound failure is expected only in this control;
ordinary cases propagate cleanup failures.

Counted guard installation is scoped to `fakeProbe`, acquired exclusively by
`ownedProbe` with its captured disposal and original-work join. Existing
fake-clock deadline/cancellation/binary/no-PID cases call `legacyProbe`, retaining
their original context-owned spawn/kill fakes and fake timers, without installing
the new fixture-owned guards. Their original assertions remain unchanged.
