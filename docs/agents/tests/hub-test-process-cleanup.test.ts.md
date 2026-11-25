# hub/test/process-cleanup.test.ts

`fenceFixtureCleanup` is opt-in; the legacy cleanup owner still aggregates
errors and attempts every phase. Fenced contexts record only fulfilled steps,
share each in-flight close, retain failed steps for repair, and do not remove
directories or release scripted/native guards after a rejected writer close.
The per-root removal guard consults the same writer receipts. Releases run in
reverse registration order only after resources, hubs, directories and checks
succeed. The fake-only held/rejected-close and repair proof lives in T2
`claude-code-schedule.test.ts`; this T3 file retains the native cleanup contracts.

`guardedLeaseCase` always enrolls this fence before acquisition. Its manual
`releaseSeams` also checks fulfilled resource, hub and directory receipts;
`canRestore` adds caller-specific conditions and `deferRestore` retains caller
control of timing. An empty pending-work set does not grant restoration.
The rejected-close and positive-repair regression is in
`case-deadlines.test.ts`, with the original rejection retained as its outcome.

`hub/test/process-cleanup.test.ts` is T3. Its synthetic native boundary retains
equal lstart timestamps while changing birth microseconds, preserves the reused
PID, and positively signals a separate original identity. With a live writer and
an unreadable native birth, cleanup must reject and keep its directory. Restore
native proof before fixture disposal. Real process-group cases still prove
confirmed death before directory removal.

The synchronous acquisition boundary also recycles a descendant after selector
discovery, before its native read. Bracket the authoritative ps snapshot with
stable native identities; preserve the replacement and still stop the original
runner and unchanged child.

The Linux probe counters exercise the Web browser's synchronous capture/register
pair and a confirmed-reaped browser with an empty group. Registration may reuse
the precise observation just made by its caller only in the current JavaScript
turn; it must expire at the next microtask. captureProcess reads and destructive
identity checks always stay fresh. The startup budget is at most the baseline
two ps spawns and no Perl; /proc reads are counted separately. Empty teardown
requires an absent-PID receipt plus one targeted group census and performs no
self/ancestor/ownership ps snapshot. Live members retain full guarded cleanup.

For comparison against a source baseline, run the same counter fixture against
the extracted helper in a disposable root with fixtureEnvironment. Keep baseline
counts distinct from a wall-time measurement or configured suite evidence.

The Linux and Darwin stale-capture signal cases capture birth A, replace it with
same-PID/same-lstart birth B before synchronous ownProcess registration, and
assert registration consumed A. Cleanup must leave B unsignalled; a separately
registered unchanged process must still receive its expected group signal.
These cases cover the cache-to-destructive-check boundary as well as expiry.

Unknown fixture proof retains an optional identityError from native capture.
A refusal distinguishes missing captured proof from the current read failure,
including Linux boot-id/stat errno or validation stage, without logging stat or
command contents. Existing identities without this field remain readable.

The Linux Z/X and Darwin SZOMB cases capture a live managed writer, then force
its native exit after the authoritative running ps row. The final native read
settles it without any signal even while kill(pid, 0) succeeds. A separately
captured unchanged writer still receives its expected group signal. Keep the
full refusal cases for live unreadable births and recycled PIDs. The shared
reader's exit receipt is distinct from parent reaping; real suite-check, detached
suite-recovery and Codex reaping cases retain their final ESRCH assertions.

For non-leaf native exit, retain an exited ancestor while a listed descendant
lacks an exit receipt. The Linux Z/X and Darwin SZOMB child/leader matrix puts
the exit after the authoritative ps row, with a reparented surviving writer.
The fixture removal guard must refuse and keep the root and writer intact.
After the branch is confirmed reaped, removal completes and the unchanged
managed leader remains a positive signal control.

After native parent exit during teardown, re-read every listed descendant against
its own captured birth before settling the branch. A matching captured descendant
already sent SIGKILL stays in the bounded drain loop; it does not turn the exited
parent into an unknown identity. The Linux/Darwin `zombie parent drains its
captured live descendant before settling` cases hold the zombie PID alive while
the spoke remains live through the first post-signal snapshot, then positively
remove the spoke before cleanup returns. The Linux/Darwin injected
`exited parent confirms its captured descendant … before cleanup` matrix covers
gone and same-second replacement receipts plus unchanged-live and unreadable
refusals after the group signal. The unchanged-live control advances the deadline
and checks the bounded failure with captured PID diagnostics. A parent exit alone grants no descendant exit
receipt or signal authority; preserve unrecorded branches too.

The Linux/Darwin escaped-group controls keep a captured child's native birth
unchanged while reparenting it into another group at the signal boundary. The
live case must hit the bounded drain failure and retain its root; the positive
exit case must observe the child gone before root removal. Post-signal liveness
uses PID and birth independently of group. Pre-signal group authority remains
unchanged, and the escaped group is never signalled from its new membership.

Descendant liveness accepts only ESRCH as absent. The injected EIO and EPERM
controls combine unreadable native birth with liveness failure after the group
signal: both refuse settlement, with unexpected errors preserved as diagnostics.
`default FrameClient accounts a real child and cleanup reaps it before removing
its root` uses a sealed disposable root and an IPC-ready native child. Feed its
PID through a correlated FrameClient result with the default observer, check the
captured birth identity, then observe native close and absent identity before
removing the root. The immediate native close observer never expires; readiness, spawn and each
close wait have separate bounds. Both emergency cleanup and the directory
beforeRemove fence join that same close receipt, retaining the root on an
incomplete outcome with native exit/signal diagnostics. The shared owner also
proves omitted and aborted readiness cleanup; each control observes a live child,
then native close with the root present before removal. This guards the native default
alongside the scripted Claude fixture's local observer opt-out.

Private fixture socket directories are removed at the directory-removal boundary,
after resource/hub drainage and native process cleanup. Every resource, directory
and final check is attempted even after earlier errors; all errors are reported
in order. Only a live-writer guard or an unverifiable native identity retains its
owned root and sockets. An unrelated resource error does not retain drained roots. Native normal/killed-listener and live failed-drain retention controls
are in `hub/test/fixture-socket-lifecycle.test.ts`.
