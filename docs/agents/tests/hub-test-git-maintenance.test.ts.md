# hub/test/git-maintenance.test.ts

T3 proves native loose/cruft expiry, snapshot freshening, `gc.log` and durable
collector recovery in sealed disposable roots. Every Git/collector command uses
the shared fixture environment after overlays. Positive controls establish
existence, packed storage, lack of refs, readiness and the original stale-log
warning; final assertions check native receipts and object access.

`git-maintenance-fixture.ts` registers group cleanup before launch. The private
exec gate holds the command until the shared fixture owner captures its identity;
timeout/cancellation drains descendants and close before rejection or removal.
A held descendant writer receives SIGTERM through a fixture-scoped replacement
of cleanup's SIGKILL, then keeps writing for 900 ms and 5100 ms (crossing the
maintenance owner's 750 ms and fixture cleanup's 5000 ms windows). An explicit
release also keeps it alive until the test has observed the acknowledgement and
positive native-live control. Its acknowledgement precedes a
pending-cancellation assertion. Cancellation errors carry each captured writer's
native receipt: direct-child close, or independent descendant signal-0 ESRCH,
with the admitted PID, native birth and group. Group membership is bracketed by
stable births from the sealed shared asynchronous reader before cleanup. The
reader's zombie callback has no birth metadata, so this fixture conservatively
waits for ESRCH. A missing /proc record alone never settles a writer. The helper
joins those receipts rather than treating PID visibility (which includes zombies)
as liveness. A cleanup timeout stays in `cleanupDiagnostics`; cancellation keeps
its original outcome and remains pending until native exit, including after a
bounded cleanup refusal. A ten-second observation overrun adds an incomplete
diagnostic while retaining ownership and waiting for exit.
Listing and unexpected observation errors also retain cancellation and the
guarded root; controlled live-writer cases cover listing/observation errors and
missing/replacement identity reads before valid capture. Each receipt's birth
is compared with the independent native admission reading. The slow and fault
callbacks enroll the shared normal/signal whole-case owner before acquisition,
adopt late roots, bound setup independently, and join the command/caller before
root removal or manual mock restoration. Pure T1 receipt-policy controls cover
replacement and unknown identities without launching native code. Cat-file
absence accepts only its native absence outcomes; infrastructure failures escape.

The collector case observes its durable PID/birth/group before command readiness,
withholds the native close event, aborts, and checks exact PID death before the
lock is released with durable ownership retained. The next real pass recovers
that receipt and matching dead `gc.pid`, preserving fresh owned/foreign temporary
packs. First-mutation native cases reap a matching live group and preserve an
unrelated reused PID. Normal close clears ownership; incomplete close never
counts as native completion. The production command bound stays thirty seconds.

Fresh loose and cruft-packed objects share the fourteen-day grace despite
aggressive inherited config; the actual verification snapshot writer freshens
an old reused unreachable tree. Retained/malformed jobs, batches and leases
select never. Background integration observes serving, advances its thirty-second
delay, then awaits the completed receipt. Default T2 probes replace native work.
Run this file alone under cover-quiet admission. Linux durations >=3 s need the
Coordinator's duration allowance before ready; retain the measured case names.
