# hub/test/git-maintenance.test.ts

T3 proves native loose/cruft expiry, snapshot freshening, `gc.log` and durable
collector recovery in sealed disposable roots. Every Git/collector command uses
the shared fixture environment after overlays. Positive controls establish
existence, packed storage, lack of refs, readiness and the original stale-log
warning; final assertions check native receipts and object access.

`git-maintenance-fixture.ts` registers group cleanup before launch. The private
exec gate holds the command until the shared fixture owner captures its identity;
timeout/cancellation drains descendants and close before rejection or removal.
A held descendant writer reproduces the old direct-parent timeout bug. Cat-file
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
