---
id: T-813
kind: task
title: executor status RPC hangs while executor reconcile or lease recovery is deferred
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-526
branch: t/T-813-executor-status-rpc-hangs-while-executor
created: 2026-10-18T16:28:28.718Z
updated: 2026-10-18T18:12:07.989Z
---

## Summary

Since about 16:23Z on 2026-10-18, `cland executor status` on the serving hub (pid 68650, after restart #11) has not answered within 30 s. Other RPCs (`verify queue`, `inbox`, `session list`, `hub status`) answer in under a second. The executor path seems to block the status RPC: a reconcile or lease recovery holding a lock, or a provider call with no deadline.

## Evidence

- Three tries in a row from 16:23Z: "the hub did not answer on .cland/hub.sock within 30000 ms". At 15:24Z, right after restart #11, the same command answered.
- Hub journal: 16:24:14Z `executor-reconcile-failed: lease recovery deferred`; 16:25:17Z `provider sweep deferred`; an executor sweep with leases 3, failures 2.
- The hub was at 95% CPU and load 11 after 11 lane launches between 16:14Z and 16:21Z. The droplets were fine: 2 cland c-8 for cover db7d5479, and no strays.
- Related: in T-810, impl-810 found that a fixture hub's stop takes about 120 s. It logs `stopping`, then `executor-reconcile-failed: lease recovery deferred` at +60 s. That may be the same blocking path.
- Candidate changes since restart #10: T-797 (executor safety), T-802 (spend accounting), T-609 (ledger path).

## Acceptance criteria

- [x] C1. `cland executor status` answers within 2 s while a reconcile, lease recovery or provider sweep is in progress or deferred, and reports that state.
  - done: impl-813 · 2026-10-18T16:45:05.454Z
- [x] C2. Every provider call and lock wait in the executor reconcile, lease-recovery and sweep paths has a deadline; a regression test with a provider that never answers proves the status RPC and hub stop still finish within their bounds.
  - done: impl-813 · 2026-10-18T18:11:20.750Z
- [x] C3. The inspect tick does no work for a finished job whose report already failed permanently (for example, a forbidden artifact.create for a role-less session): #restoreRemoteResult skips it or records a terminal state, and #save writes nothing when the jobs are unchanged; a regression test with 6 such jobs shows zero suite-jobs writes over several ticks.
  - done: impl-813 · 2026-10-18T16:45:07.358Z
- [x] C4. Finished jobs stop growing the suite-jobs meta blob: they are kept out of the snapshot that #save rewrites (separate rows or a bounded tail), so one save stays under 1 MB with 930 jobs in history.
  - done: impl-813 · 2026-10-18T17:16:29.095Z
- [x] C5. The spend-ledger lock is released on every exit path of reconcile, lease recovery and sweep (failure, deferral, timeout), and a holder never awaits work that needs the same lock; a regression test that fails reconcile mid-hold proves the next admission takes the lock within 1 s.
  - done: impl-813 · 2026-10-18T17:44:08.542Z

## Comments

### coord · 2026-10-18T16:30:02.426Z

16:29Z findings:
- The lock owner in ~/.local/state/cland/spend.json.lock is the serving hub, pid 68650, with its own token. The lock and spend.json both have mtime 16:24:11Z; the lock was never released.
- The hub has been at about 98% CPU since. T-801 and T-777 verify admissions were refused after 60 s waiting on that lock.
- Likely trigger (impl-810, T-810): startFreshnessDaemon in the worktree-cli fixture calls serveProject without env isolation. Fixture hubs inherited the real DIGITALOCEAN_TOKEN (presence checked as a boolean only) and the global executor state. Each ran a startup sweep(true) and lease recovery against the real ledger, and Dispatcher.close awaits #dropletReady. A 50-attempt repro loop ran these at the same time as the live hub.
- Scope for this ticket: the live hub must never keep the ledger lock while spinning, and lock waits and provider calls need deadlines. The fixture isolation fix is T-810's.

### human · 2026-10-18T16:32:38.554Z

CPU profile of the serving hub pid 68650 (cland-impl, 2026-10-18 16:52Z, V8 inspector via SIGUSR1, 8 s at 0.5 ms sampling, 10100 samples; file scratchpad/prof9/profile-68650.txt in the stand-in session). Self time: idle 31.8%, suites.ts #save (line 240) 21.7%, store.ts setMeta (605) 11.8%, sqlite all/run/prepare/get ~16%, store.toMessage 2.1%. Inclusive, project code: #save 37.0%, #inspect (suites.ts 862) 28.0%, inbox.list (inbox.ts 211) 17.2%, #restoreRemoteResult (827) 9.4%, store.inboxMessages 9.3%, epicDemoFreshness 4.7%. Paused stack: idle in processTimers (not wedged, spinning on timers). Mechanism: #save does setMeta('suite-jobs', JSON.stringify(this.#jobs)) and the blob is 8,848,331 bytes for 930 jobs (486 finished droplet, 437 finished local). Six finished droplet jobs are unreported and keep failing their report with 'forbidden: artifact.create (a session with no role has no tools)': 97a70087 T-550, de3df9c9 T-556, 3df8e38c T-505, 4cff14eb T-559, 85b2c03a T-517, f2baa6f7 T-604. Each inspect tick re-runs #restoreRemoteResult on them (their receipt files exist), which sets state and calls #save, so the hub rewrites the 8.8 MB snapshot several times per tick, forever. Suggested fix: save only when something changed in #restoreRemoteResult (skip when job.state is already finished with the same receipt), stop retrying reports whose session has no role, and trim the snapshot (archive finished jobs out of the meta blob). The ledger lock ~/.local/state/cland/spend.json.lock held by pid 68650 since 16:24:11Z is a separate symptom under the same CPU starvation; executor status still times out at 30 s.

### impl-813 · 2026-10-18T16:45:05.362Z

Implemented and pushed d188b465: reproduced the starvation-induced async lock release leak and forbidden-report spin; added isolated dead-owner restart, failed publication, legacy deferral, status/stop never-provider, six-job no-write and 930-job persistence regressions. Host lint/typecheck and 12 targeted test files pass. Source review requested; verify remains held pending Coordinator all-clear.

### coord · 2026-10-18T16:45:46.954Z

Restart #12 (cland-impl, 16:41–16:44Z):
- Stop: `cland hub stop` reported that pid 68650 did not exit after SIGTERM. The pid exited on its own 45 s later.
- First start: missed the CLI's 15 s deadline. It was listening at +8 s but never logged "serving", the T-293 class; probably the 8.8 MB suite-jobs load plus a 5 s tracker rescan.
- Second start: served in 12 s as pid 83539.
- The ledger lock was released.
- db7d5479 posted its result on recovery, code 0.
- `executor status` answers again but took 26 s, close to the 30 s CLI limit, so something in that RPC is still slow. The C1 bound of 2 s must hold on a hub with 930 jobs in history; include start-to-serving time with the C4 history in the evidence.

### rev-30 · 2026-10-18T16:49:12.915Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-813-source
commit: d188b46584eea801b50be8914d2f9afdf51e6627
scope: full
findings: [{"severity":"medium","text":"Finished jobs now move to suite-job:<id> before cleanup, but the cleanup error proof still reads only suite-jobs; the completed report-gap reconstruction at lines 277–280 edits the now-empty active snapshot and silently loses its recovery control. Migrate both storage carriers and audit completed-job readers.","file":"hub/test/suite.test.ts","line":250}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear at d188b465: M1 medium in suite.test.ts finished-job recovery carriers. A-5455 records both review axes and the scope of remaining combined-history evidence. Claimant has confirmed and is fixing M1; no other source finding in this pass. No verification at this head; replacement source must be reviewed first.

Criteria: C4 failed (The finished-job storage migration leaves existing cleanup and report-gap recovery test carriers reading or mutating only the active snapshot.).

### impl-813 · 2026-10-18T16:53:07.594Z

Replacement addad230 fixes source finding M1, audits all suite-jobs carriers, adds combined 930-job startup/status proof, and preserves event-driven report recovery after a role grant. Final combined measurement: 8,876,189-byte legacy → 2-byte active; 930 history rows; serving 266.8ms; status 1.31ms during never-answering provider sweep. Host lint/typecheck and full touched test files pass. Fresh source review before verify.

### rev-30 · 2026-10-18T16:55:04.212Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-813-source-correction
commit: addad23099337f5b7f18b618ef95bb616dcc08c7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at addad230. M1 resolved: exact archived cleanup/report-gap rows with preconditions and original ownership/single-result assertions preserved; completed scenario diagnostic migrated. Combined 930-job startup/status proof and requester-scoped role-grant retry reviewed. A-5467 records both axes, initial mechanisms, carrier audit and evidence limits. C1–C5 remain unverified pending the accepted exact-head gate; Coordinator all-clear permits one normal mode-free droplet submission.

### rev-30 · 2026-10-18T17:16:06.832Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-813-runtime
commit: addad23099337f5b7f18b618ef95bb616dcc08c7
scope: evidence
findings: [{"severity":"medium","text":"M2: reopen(jobs) writes the replacement active snapshot but retains old suite-job history rows, so the constructor restores the original finished fixture run and corrupts exact historical-cover expectations. Replace both stores only when explicit jobs are supplied; preserve ordinary reopen history and all assertions.","file":"hub/test/suite-unit-fixture.ts","line":154}]
finding_counts: {"high":0,"medium":1,"low":0}

Runtime not clear: A-5482/7001c1d1 exits1 at addad230. Sole ordinary failure is suite-cover exact last-ten ordering, caused by fixture reopen(jobs) retaining archived original run. A-5485 records M2 and distinguishes 290/291 ordinary from 630/631 repeated-body completions. Seven lock/persistence controls and 35 repetitions pass; T2 liveness and later phases not reached. Claimant reproduced and is correcting; new source review required before replacement verification.

Criteria: C4 failed (Archived-history migration leaves explicit fixture job replacement incomplete; exact-head T1 gate fails suite-cover ordering before machine/Neovim.).

### impl-813 · 2026-10-18T17:16:29.529Z

Runtime M2 fixed in d3fde51a: explicit fixture history replacement now replaces archive + active snapshot in one transaction; normal reopen still preserves all rows. Red/green exact cover list reproduced, unchanged assertion now 9/9 green. Explicit seed and normal persistence callers audited; seven targeted files and host typecheck/lint pass. Fresh source review before another gate.

### rev-30 · 2026-10-18T17:17:11.228Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-813-history-fixture-correction
commit: d3fde51af8bfe04a5a0992d2cfc20dfc56f8040a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at d3fde51a. M2 resolved by transactionally replacing archive+active fixture history only for explicit reopen(jobs); ordinary reopen preserves both carriers. Production and all exact count/order/ownership assertions unchanged. A-5488 records both axes, seeding/restart caller checks and limits. A-5467 source audit/combined-history proof remains applicable; C1–C5 still await accepted replacement gate. No dev merge or new finding.

### rev-30 · 2026-10-18T17:41:15.804Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-813-runtime-2
commit: d3fde51af8bfe04a5a0992d2cfc20dfc56f8040a
scope: evidence
findings: [{"severity":"medium","text":"M3: shared acquireLockAsync.release now calls synchronous readFileSync/rmSync, breaking adapter/tracker async-native contracts and bypassing existing promise unlink fault/race controls; restore async release with safe owned-token/concurrent-release/retry semantics.","file":"hub/src/hub/lock.ts","line":370},{"severity":"medium","text":"M4: outer provider timeout now throws a plain deadline Error before the existing DigitalOcean time-bound diagnostic, so both late-create/key tests stop before proving durable ownership and cleanup. Retain compatible error semantics and all downstream resource assertions.","file":"hub/src/executor/droplet/deadline.ts","line":10}]
finding_counts: {"high":0,"medium":2,"low":0}

Runtime not clear at d3fde51a: A-5501/77ed317e has 26 failures across six files; Neovim not reached. A-5502 groups M3 shared synchronous release (24 failures) and M4 provider timeout compatibility (2), preserving eleven passing owned controls/55 repetitions and the 930-job latency diagnostic. I missed M3's async contract in source review. Claimant confirmed both; new source review required before another gate, no same-head rerun.

Criteria: C5 failed (Shared asynchronous release and fault/race integration regressions account for 24 ordinary failures.), C2 failed (Two ambiguous provider timeout tests fail their existing time-bound contract before cleanup assertions execute.).

### impl-813 · 2026-10-18T17:44:08.884Z

M3/M4 correction 479a7ada pushed: release uses serialized async own-token I/O with no new guard/deadline and retryable unlink failures; bounded providers retain DigitalOceanError transport/deadline semantics. All 26 runtime failures now pass in full local files; native guards, cleanup resource assertions and ownership controls retained. Added concurrent-release successor receipt proof + provider error contract tests. Host lint/typecheck green. Fresh source review before next gate.

### rev-30 · 2026-10-18T17:45:23.235Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-813-async-release-correction
commit: 479a7adac13b1c3bbe84081cca0707dd0ef1d9e6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 479a7ada. M3 restored asynchronous own-token release with concurrent joining, settled success and retryable failed unlink; native/failure/race assertions retained. M4 restores DigitalOcean transport/time-bound versus explicit-deadline semantics with fake-time contract tests; ambiguous mutation cleanup tests unchanged. A-5504 records both axes, reported full local regression checks and limits. M1/M2 changes preserved; C1–C5 await accepted exact-head runtime. No dev merge, new allowance or disabled guards.

### rev-30 · 2026-10-18T18:10:03.318Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-813-runtime-3
commit: 479a7adac13b1c3bbe84081cca0707dd0ef1d9e6
scope: evidence
findings: [{"severity":"medium","text":"M4 remains: computed transport cap is forwarded as an explicit provider deadline; when inner API abort wins, api.ts emits deadline rather than transport/time-bound. Ambiguous-key test fails before ownership/cleanup assertions. Preserve error kind on both inner/outer paths and add an inner-provider-rejection control.","file":"hub/src/executor/droplet/deadline.ts","line":33}]
finding_counts: {"high":0,"medium":1,"low":0}

Runtime not clear: A-5507/a08abb39 at unchanged 479a7ada has one ordinary failure, executor-droplet ambiguous-key time-bound expectation. A-5508 explains the synthetic-deadline/inner-API race, records 2264/2270 ordinary passes and 3059/3065 completed bodies, and retains all passing async native/fault controls plus 930-job metrics. Neovim not reached. Task-owned M4 needs correction/source re-review before another gate; no unchanged retry.

Criteria: C2 failed (Ambiguous-key timeout contract still fails when the inner API wins; no green final gate or completed late-key cleanup proof.).

### impl-813 · 2026-10-18T18:11:21.728Z

805d888b fixes remaining M4 timer-race semantics: transport cap bounds only the outer wait; provider receives actual caller/phase deadline or undefined. Three deterministic inner rejection/provenance cases red before fix, green after; existing never-answering controls and unchanged full late-key/resource cleanup file pass. Host lint/typecheck green; fresh source review before gate.

### rev-30 · 2026-10-18T18:12:07.989Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-813-inner-timeout-correction
commit: 805d888b0765f7cfc6174058a1c4728496b5ba83
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 805d888b: remaining M4 resolved by forwarding only real caller/phase deadlines and bounding transport wait separately. Three deterministic inner-rejection/provenance controls retain error identity/longer explicit deadlines; never-answering and unchanged late-key cleanup assertions remain. A-5510 records both axes and reported host checks. Async release/persistence changes unchanged; C1–C5 await accepted same-head gate. No dev merge or new finding.
