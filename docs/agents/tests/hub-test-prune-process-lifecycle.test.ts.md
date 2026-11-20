# hub/test/prune-process-lifecycle.test.ts

T3 uses two disposable fake Git executables with the same command identity.
One runs inside a background merge prune and the other has a separate owner.
Readiness files bind each PID before stop. Actual signal calls positively show
termination of the owned Git and no signal to the unowned Git. Successful stop
requires native close and prune settlement; later territory writes stay fenced.
Writer routes require the durable PID/birth receipt before fake Git readiness
and retirement after settlement. The direct read route requires a captured
in-memory native birth and no durable writer record. Both fake executables ignore TERM; the owned process
requires the SIGKILL positive control. A pre-acquisition whole-callback stage
owner retains manual seams and its child registry through failed cleanup; root
removal follows positive close. No provider,
credential, network or live repository is used.

An incomplete product stop emits a bounded diagnostic from the observed native
termination calls and original child-close events. It retains at most eight
termination attempts, twelve producer events per attempt and sixteen child
receipts, with omitted children counted explicitly.
Failure assertion text also embeds that receipt, including the original report
events, so a reporter dropping diagnostic-only frames cannot discard it.
Fixture-only tracing captures up to64 native probe/close/signal/checkpoint steps
per attempt and aggregates Linux proc-read count/timing without retaining file
contents. Whole-table versus selected-PID census, native spawn classes and
observed row counts are named; missing close stays pending and omitted steps
are counted. Successful base cases retain the same trace for comparison.
The single-Git fixture caps18 ps,8 pgrep,24 perl and48 total native probe spawns per stop.
The ps allowance includes authoritative rounds, fresh signal-start probes and
macOS caller-ancestry reads; Linux ancestry uses direct proc stat reads. The
pgrep allowance includes repeated discovery through grace and freeze. macOS
Perl calls batch before/after birth brackets and fresh per-signal native births;
Linux reads proc stat directly and does not spawn Perl. These are
work caps for this fixed lifecycle, not production deadlines.
Each authoritative snapshot parses at most65 rows: up to64 protected caller
links plus the one owned Git. The observer counts these rows through the shared
process-table parser in `parsedRows`, retaining raw stdout-line count in
`stdoutLines` and the previous `entries` field for older diagnostic readers. It keeps at
most64KiB of an unfinished line, drains overflow and marks the row receipt
incomplete. Start-time-only ps output has a raw line count but no snapshot row
count. The earlier Linux203–204 was aggregate stdout lines across repeated
probes, including ten caller-ancestor reads and repeated twelve-row snapshots;
it was not a per-round or unique-process count. No header explanation is assumed.
The parsed rows and native-birth reads are scoped to the owned tree and protected
caller ancestors. Descendant discovery uses `pgrep -P`, which enumerates the
process table natively outside this counter. The stop budget under load is the
goal, rather than independence from the machine's process population.
Probe stages overlap and are not added as exclusive elapsed time. The 1.5-second merge stop
deadline and one-second native cancellation deadline are product bounds; the
test's observation headroom does not scale those deadlines. A task verification
runs each changed T3 case once. Batch load evidence additionally requires the
production load gate's five fresh sequential repetitions per identity, with two
gate workers alongside T3; an unloaded or quiet-host pass does not prove the
loaded Linux occasion. Successful repetition whole-case seconds include setup,
behavior and cleanup. They do not provide native.end latency when the reporter
omits per-repetition native diagnostics (T-2027).

The crash/restart case launches real foreground hubs under a whole-callback
owner. It holds the task branch's actual territory publication after durable
release, explicitly aborts and joins the original production request transport
with its selected error, then sends SIGKILL only to the captured hub root after
fresh PID/birth verification. Original native root close precedes restart. The
writer must still be alive with its persisted record; restart settles it before
serving and removes that exact record. A positive loader receipt identifies the
optional `CLAND_TEST_CRASH_RECOVERY_CONTROL=without-recovery` red control, which
disables only the replacement child's recovery function. Main-process cleanup
retains real recovery and native-close/root guards in both modes.
The preload publishes each diagnostic trace by private temporary file and atomic
rename. Readers wait with a bound for the exact original-child birth or close
receipt, including a close publication racing durable-record retirement.

The complete crash setup, from prepared repository through task creation and
durable released-writer admission, has a distinct named aggregate deadline in
addition to the whole-case and individual setup bounds. Writer survival compares
the actual native birth with the captured record; recovery waits for a structured
exact-owner absence receipt (independent native ESRCH or a positively different
birth). Unknown PID errors and missing identity remain unknown. The T2 companion
controls EPERM/EACCES/EIO, absent identity, exact/replaced birth and a PID change
between absence probes without acquiring a real process.

The supported-reader and legacy-reader native cases use fake Git executables
that positively record success or code129 refusal of `--no-lazy-fetch version`.
Only confirmed support takes the direct route; the legacy read has a durable
PID/birth gate and retains matching-unowned no-signal and native-close assertions.
