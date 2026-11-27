# hub/test/executor-run.test.ts

Tracked source and tracker edits staged after submission are excluded from the
delivered commit. Both delivery cases proceed, assert exactly one receiver,
compare its full Git tree and edited path bytes with the captured commit, and
retain the later local bytes as a positive mutation control. Existing script,
timing owner, test execution and provider-release assertions remain intact.
The shared whole-sequence owner registers before setup, adopts the fixture root,
and fences the complete delivery/receiver assertion sequence before cleanup.
Separate named `owner.wait` observations cover complete fixture/Git setup and
the complete launch/result/receiver proof. Both sample `remoteWaitMs()` when
that operation starts. Root adoption happens inside the setup producer before
it settles, including late completion after the observation deadline.
After shared fixture cleanup, each delivery case observes its captured native
guard's `exited` promise and the removal of that exact fixture root. A missing
or nonzero native exit cannot be replaced by PID absence or a matching log.

The committed-tracker delivery case preserves the exact lock-release/trap/first
test-echo adjacency and the release-before-execution proof. Timing output and
owner exports sit after that echo and before the same native test command.
Assert the per-run sidecar path and parse the command's owner metadata, binding
run id, head, candidate tree, command and step to the durable admitted run.
The release-string inventory in state-paths-inventory remains byte-identical;
command start/end log consumers see the same frames.

The cancel case retains its native `exit` receipt assertion (`143`) after the
sole report and confirmed provider resource release. An incomplete package
handoff preserves that status file while withholding `done`; publishing `exit`
alone cannot release the final-report closure fence. Preserve this direct
receipt consumer when changing uploaded finish/status scripts.

This T3 transport seam uses sealed disposable projects and the fake provider's
native shell delivery. Preserve admitted command facts after changing project
config, and prove the T0 timing wrapper is delivered before runtime tier wrappers.
Assert actual exit and output receipts, stop-on-failure and confirmed provider
resource release. Command-plan policy permutations belong in T1.

The raw T1/T2 duration assertions accept integers and dot-decimal seconds, matching
the tier receipt grammar. Keep the recorded output tails and exact exits (0 and
7), including stop-on-failure and config-pinning assertions; decimal timing does
not change those command facts. The recorded-shell-lines case exercises both
assertion sites, including the second assertion after the first passes.

Finish barriers use `fakes/finish-poller.ts` with a five-minute base scaled by
the shared policy when the producer arms its timer; the backstop
exits 124. Fake provider close drains owned machine writers and asserts an empty
native cwd census before removing its canonical root, including failure and
cancellation teardown. See the executor-safety guide for the positive census
and short-bound native exit regressions.

The ticket-loss collection regression writes the package owner's optional
`CLAND_SUITE_CAUSE_FILE` receipt, emits its diagnostic and exits 75 from a disposable fake machine. It asserts
The delivered runner appends its advisory UTC start receipt before command
output, on a separate log line, ignoring write errors. Calibration pairs it only
with that machine's native `/done` stamp. Existing delivery/typecheck/failure,
incremental-log and native cleanup assertions remain unchanged. Pure marker and
unknown/invalid interval cases live in suite-load-gate-plan.test.ts; scripted
calibration publication lives in suite-soak-component.test.ts.
The ticket-loss collection regression emits the package runner's reserved
infrastructure diagnostic and exit 75 from a disposable fake machine. It asserts
the collected durable result's code, cause and infrastructure classification,
and the named cause in the report. It exercises real uploaded finish/status
scripts, with no provider resources or browser. The unchanged suite fixtures
also cover remote runs that provide no infrastructure cause. Previous-shape
runners print planted diagnostics at exits 0 and 75 without a receipt: both keep
an empty cause and their original exit. Command text and failure excerpts may
still quote the diagnostic; neither is an infrastructure outcome.

These fakes execute the branch's uploaded run.sh. A task verification alone
cannot prove that script change: production uploads it from the hosting hub,
so activation requires that hub to run the updated source after restart.

The ticket-loss callback enrolls the shared whole-sequence owner before invoking
the remote fixture. Its captured fixture hooks run only after the complete
setup/body joins, including acquisitions that finish during cancellation.

Ticket-loss collection uses the generic command fixture without a typecheck
command: its subject is the uploaded finish/status scripts and hub collection,
not npm, typecheck or CLI startup. Admission uses the existing in-process spoke
to keep the native boundary at remote execution and collection. The native fake machine, exit/cause/result
assertions and provider-release assertion remain intact.

Both older-runner negative cases enroll the same pre-acquisition whole-case
owner, adopt the fixture root and join every launch, report and file-read step
before normal or signal cleanup can dispose the fixture.

The ticket collection identity has a dated C-216 allowance in durations.json:
10.353 seconds, sized at 1.5x the worst reduced-fixture passing Darwin sample
(6.901849875 seconds). The Linux receipt at the earlier fixture was 5.030561212
seconds, over the legacy five-second new-identity gate. The allowance leaves the
assertions intact and expires on 2026-11-24; replay evidence names its samples
and head separately from the next configured verification.
