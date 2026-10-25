# hub/test/git-maintenance-recovery.test.ts

Policy-only temporary directories use awaited filesystem writes and test cleanup;
they import no native process cleanup helper and launch no collector or writer.

T1 exercises private durable ownership with explicit native observations and a
fake recovery clock. Dead, live-then-gone, reused, unverified and signal-surviving
identities are distinct outcomes. Only the matching live identity is signalled;
unknown or surviving owners keep their receipt and report the PID. A reused PID's
possible replacement `gc.pid` is preserved. No process starts or real time passes.

The retention matrix reaches the public maintenance/native-command boundary
with literal expected grace flags for idle, retained batch/jobs, malformed state,
cached leases and incomplete/expired on-disk leases. It checks the completed
receipt as well as the invoked command. A separate incomplete/unreadable-receipt
control rejects and stops before any second repository. One real retained-batch
object control remains in T3; repeated policy rows do not need repeated native GC.

The native counterpart and the synchronous/asynchronous territory gate live in
`hub/src/git-maintenance-owner.ts`; native alive/reuse/held-close checks are in
`hub/test/git-maintenance.test.ts`. T-543 owns the finer identity helper; this
reviewed ancestry uses the current UTC start-identity helper per Coordinator
2776473b. Recheck its integration before ready and take only an explicitly posted
shared fix after source review.
