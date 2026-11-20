# hub/test/login-snapshots.test.ts

T2 filesystem fake-provider tests, FakeClock, no network or native processes.
Each disposable root is registered with ownDirectory before allocation continues;
scheduler close joins provider writes before database and root disposal.

The synthetic 10,000-login corpus uses prepared inserts of final ready disk
records in a scratch SQLite database initialized by LoginRecords. All production
indexes and triggers stay enabled; setup checks capacity-index membership and a
pending binding's increment/decrement receipts. Seeding performs at most one
write per retained row instead of replaying creation, transition and revision
writes. Diagnostics separately report seed, positive controls and traced-save
time; these exclude schema setup, scheduler startup and cleanup.
`one login save has bounded scheduling work across ten
thousand retained logins` controls JSON decodes, query count and EXPLAIN plans;
a full list is the positive control for both decode and scan detection. One save
permits at most eight decodes and twelve queries, with no scan or temp sort.
`pending binding defers scheduled and manual backups until settlement` checks
the persisted deferred reason, no freeze or snapshot effect, and a confirmed
snapshot after settlement. Existing daily-backup cases keep absent-phase legacy
bindings as positive controls. No live corpus, harness or native process is used.
`settling a binding preserves a future daily backup deadline` verifies that a
pending bind alone does not request an early backup or move the daily deadline.
`pending detection bounds binding-row work for a login with many readers` builds
1,000 settled reader bindings through the public API in a scratch database. A
full binding read is the returned-row positive control. Saves with no pending
binding, one pending binding, and after its settlement return at most eight rows
total and require an EXPLAIN search on both login and phase through the pending
index. This complements query-count controls: one indexed query returning every
binding would still exceed the row budget.

- `third confirmed backup retains only the newest two snapshots`: C1, confirms
  provider history and persisted ids after the third backup.
- `in-use backup runs at 24 hours under freeze and thaw, including snapshot failure`:
  C2, exact hub-clock deadline, ordered freeze/thaw receipts and pending failure.
- `rate limit persists exact retry deadline and restart resumes detached backup`:
  C4/C6, fake snapshotWindowMs=1000, no snapshot at 999 ms, confirmed receipt at 1000.
- `release notification returns before detached provider work and key login names its missing disk`:
  C3/C4/C5 at the approved release-owner seam; a held provider request never holds
  the synchronous notification. T-1779 owns real host deletion/detach integration.
- `due backup survives a stopped hub and release makes a ready detached disk eligible`:
  C3/C6, time advances while the scheduler is closed; release queues the due disk.
- `sign-in snapshot rate preserves its terminal outcome`: ready with pending retry,
  followed by one confirmed backup. `sign-in snapshot failed preserves its terminal outcome`:
  non-rate provider failure retains the signed-out outcome.
- `snapshot refuses a resolved disk with a different durable volume identity`:
  no provider effect for a mismatched resolved volume.
- `unfinished pruning resumes retained snapshot deletion without creating another backup`:
  retains three ids on incomplete deletion, retries pruning after restart, no new snapshot.

The unchanged login-signin.test.ts proves exactly one successful sign-in snapshot;
login-add.test.ts proves the fake harness terminal flow. Native preservation slots
apply to the latter. No duration allowances are needed for these component cases.


Recovery and ownership regressions:

- `legacy in-use row without a sign-in timestamp keeps one persisted daily deadline`:
  C2/C6; a null legacy timestamp cannot postpone its timer on each evaluation.
- `freeze that takes effect then rejects is still thawed and recorded`: C2,
  uncertain native reply still owns a thaw obligation.
- `release joins a held freeze and thaw before provider snapshot starts`:
  C3/C4; release fences admission before joining native freeze settlement.
- `startup thaws a retained freeze and publishes its captured snapshot without another provider request`:
  C2/C6; crash fixture retains intent and receipt, then startup thaws first.
- `ownership change after resolve await fences publication and later effects`,
  and its `freeze` and `provider` variants: changed binding/state blocks later
  effects; admitted provider receipt stays retained, with no ID publication.
- `release during held provider I/O retains confirmed thaw outcome`, and the
  `unconfirmed` variant: confirmed thaw permits release while provider remains
  held; unconfirmed thaw retains intent and release fence.
- `fixture cleanup joins held snapshot work before database and root disposal`:
  shared onCleanup resource phase joins every scheduler before closing SQLite;
  ownDirectory's removal check requires the database already closed.

- `startup keeps a freeze fenced when its host generation is replaced`: the
  matching-generation startup case above is the positive control; a replacement
  causes zero thaw/provider effects and retains the old intent.

- `retained snapshot receipt from another volume is refused before publication`:
  C1, wrong-volume receipt cannot become an id on the current row.
- `changing volume cannot transplant an in-flight snapshot outcome onto a new disk`:
  C1, creating-row replacement refuses while an admitted outcome remains held.
- `successful provider send queued before release is refused at its final send boundary`:
  C2/C3, provider would succeed after the held step; release completes thaw first,
  and the final native authorization prevents any snapshot effect.

- `renewal drains an older held snapshot generation then admits its own backup`
  holds a real manual owner's resolver before native admission, signs out and
  starts renewal, then observes the old rejection and the renewal's own single
  freeze/snapshot/thaw receipt. Matching-admission duplicate callers coalesce.
- `renewal drains an older held snapshot generation then refuses an invalidated admission`
  interrupts while that prior owner is held; both waiting callers refuse after
  drainage without native effects, last-sign-in or a successful backup claim.
  These T2 cases bound setup through until/testWaitMs; all domain time is shared
  through FakeClock. No native process is started.
