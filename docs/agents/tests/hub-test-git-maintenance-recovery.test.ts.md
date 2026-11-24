# hub/test/git-maintenance-recovery.test.ts

Policy-only temporary directories use awaited filesystem writes and test cleanup;
they import no native process cleanup helper and launch no collector or writer.

T1 exercises private durable ownership with explicit native observations and a
fake recovery clock. Dead, live-then-gone, reused, unverified and signal-surviving
identities are distinct outcomes. Only the matching live identity is signalled;
unknown or surviving owners keep their receipt and report the PID. A reused PID's
possible replacement `gc.pid` is preserved. No process starts or real time passes.

Async and sync recovery receive two unknown inspections followed by a confirmed
gone group, and remove both the durable owner and its matching `gc.pid` in the
same call without signalling. Exhaustion controls assert three inspections,
fake 50/100 ms backoff, retained owner, no signals and the structured unknown
diagnostic with the actual attempt count. These are policy receipts, not native
OS timeout or loaded-machine timing evidence.

The retention matrix reaches the public maintenance/native-command boundary
with literal expected grace flags for idle, retained batch/jobs, malformed state,
cached leases and incomplete/expired on-disk leases. It checks the completed
receipt as well as the invoked command. A separate incomplete/unreadable-receipt
control rejects and stops before any second repository. One real retained-batch
object control remains in T3; repeated policy rows do not need repeated native GC.

The repair-to-maintenance controls live in the T2
`hub/test/executor-droplet-component.test.ts`, with whole-case ownership and a
positive native-launch guard. No T1 proof is claimed for those moved controls.

The native counterpart and the synchronous/asynchronous territory gate live in
`hub/src/git-maintenance-owner.ts`; native alive/reuse/held-close checks are in
`hub/test/git-maintenance.test.ts`. T-543 owns the finer identity helper; this
reviewed ancestry uses the current UTC start-identity helper per Coordinator
2776473b. Recheck its integration before ready and take only an explicitly posted
shared fix after source review.
