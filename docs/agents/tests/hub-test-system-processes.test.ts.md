# hub/test/system-processes.test.ts

`hub/test/system-processes.test.ts` is T3. Its real OS case positively requires a
non-null native identity agreeing between asynchronous production listing and
synchronous fixture capture. On Linux that proves boot-id/start ticks; on macOS
it proves the OS-shipped Perl syscall bridge and 648-byte kinfo ABI. The isolated
synthetic native-process boundary holds lstart constant while microseconds change:
stop refuses the replacement and signals the matching managed identity. It also
covers legacy rows, missing native proof during stop, descendant revalidation and
incomplete outcomes. Each subprocess uses a disposable cwd and fixtureEnvironment.

A held acquisition probe recycles a descendant between initial ps selector
discovery and native birth collection. Both native reads bracket the authoritative
ps ownership snapshot; the replacement is never captured while a stable managed
descendant is still signalled. Force both missing Perl (ENOENT) and an interpreter
exit failure: the native result becomes unknown and no destructive signal occurs.
The actual native ABI receipt is macOS 27.0.1 (26A434), arm64; x86_64 remains
unexecuted locally and other macOS layouts must degrade to unknown.

Recovery-child checkpoints use the same isolated native signal boundary with
real SQLite and owned filesystem paths. Seed a legacy pending child, fail every
pending-stop write for two retries, and retain the child, its directory and the
legacy durable receipt with no signal. Once writes recover, a separate database
reader at the native signal boundary must see the committed precise upgrade;
only then may termination, directory removal and durable receipt settlement
complete. Both the restored LaunchFiles object and its retained PendingStop.files
must roll back an unsaved snapshot.

Short-lived descendants may exit between the authoritative ps snapshot and its
second native-birth probe. The initial-capture and grace-discovery regressions
stage that exact boundary and require a positive absent-PID observation before
ignoring the stale row; the managed leader and unchanged child still terminate.
A live descendant with unreadable birth remains a refusal with no signals.
Missing native proof alone never supplies the absence receipt. Real Claude
stop/resume and crew-launch consumers must also retain their stop assertions.
An unverified vanished parent and every listed descendant must each have a native
ESRCH receipt before the stale branch settles. A present or unverified survivor
keeps termination incomplete, so no surviving branch is silently dropped.
Permission or unexpected liveness errors do not prove absence. Keep the EIO
refusal control. system-process-probe.ts shares this isolated OS boundary with
the Linux ENOENT/ESRCH cases in claude-code-sessions-lifecycle.test.ts.

An optional identityError on an unverified internal row retains the native
read/validation failure step from before or after the ownership snapshot.
Refusal logs and Claude stop errors include it; old rows without it retain the
conservative fallback. The diagnostic is not identity, ownership or exit proof.

Native dead-state controls force Linux Z/X or Darwin SZOMB only at the final
probe after a running ps snapshot. Production snapshots omit exited leaves and fully exited branches;
precise and legacy liveness return false, and cleanup sends them no signal while
a stable managed child is still killed. An earlier dead observation followed by
a live replacement at the final read must still refuse, with no signals. A
separate final pre-signal zombie receipt skips that signal. These native exit
receipts require no extra probe on normal precise liveness or snapshot paths.
Legacy liveness also reads native state before its existing timestamp fallback.
Raw kill(0) remains an OS PID-presence check: explicit reaping assertions still
wait for the parent's ESRCH receipt.

Keep the frozen-descendant control: a child exits after SIGSTOP while its PID
still exists. Its final native exit receipt removes the captured stop from
recovery, so it receives neither SIGKILL nor SIGCONT; the managed leader still
receives SIGKILL. The optional systemProcesses exit observer retains that native
receipt even though the returned live-row list omits the zombie.
A wrong-selector native zombie reply names another PID and leaves the requested
process conservatively live; it supplies neither its exit receipt nor signal proof.

The non-leaf exit matrix keeps authoritative L -> C -> G ancestry, then makes C
or L native-exited while G survives and reparents. Keep the exited ancestor as
an unknown-birth ancestry row until every listed descendant is confirmed exited;
both stop and fixture cleanup must refuse rather than silently drop G. The
matching fixture cases assert the root remains, the writer receives no signal,
and root removal succeeds only after simulated branch reaping. Stop retries
retain a positive managed-leader signal and settle a fully exited branch.
The shared retainProcessAncestry walk is linear and keeps cycles bounded by PID.

## Native-default liveness control (T-1451)

`default process liveness observes the real PID birth without an injected observer`
uses a disposable project and fixtureEnvironment. It captures the test process's
real native birth, then requires default `processAlive` to accept it and reject a
different birth. Unavailable native proof cannot pass the rejection assertion.
On macOS this exercises the native Perl probe; Linux reads procfs. A negative
control replacing only the default identity observer with an unavailable result
must fail that rejection. No signal is sent to the observed process.
The optional canSignalTargets owner-scope callback receives the captured tree and
current native snapshot before each signal phase, including before a leader TERM
can forward to its group. The production-frame probe keeps a refusal with zero
signals and a previous-options positive termination control. Only isolated
LocalExecutor cleanup opts in; all other callers retain the previous options
shape. The native gone-leader/outside-group case and in-owned-child recovery live
in measure-memory.test.ts and the unchanged suite-cancel restart regression.


With canSignalTargets present, recovery SIGCONT also needs matching captured native
birth, a fresh in-scope snapshot and another birth check after the callback.
Positive exit/reuse drops only the old frozen identity; unknown or outside proof
retains the target and throws an explicit incomplete-thaw error. Injected reuse,
unavailable and outside-scope controls require no CONT/KILL, while the matching
in-scope control resumes. Omitted-hook callers retain the old best-effort thaw;
the existing unavailable/reuse/CONT regressions remain unchanged.


Fresh local launches keep a nonpersisted authority bound to the exact lease and
captured native leader birth. The signal fence can extend that authority only
through positively observed native ancestry, retaining captured child births
across leader exit so owned detached children in nested phase roots can drain.
Restore, copied/replaced leases, PID reuse and a group number alone grant none
of that authority; those targets still require the recovery cwd/birth fence.
Lease binding is rechecked after awaited scope proof and at the native signal
boundary. No generic temporary-directory grant is added. The original cancellation and
setup-failure cleanup controls and native no-inherited-authority cases must pass
alongside outside-group refusal and ordinary restart recovery.
