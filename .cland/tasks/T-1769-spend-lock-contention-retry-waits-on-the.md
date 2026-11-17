---
id: T-1769
kind: task
title: Spend lock contention retry waits on the hub FakeClock, so T2 projectHub fixtures deadlock
state: closed
status: done
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1882
blocked_by: []
topic: topic-1577
branch: t/T-1769-spend-lock-contention-retry-waits-on-the
created: 2026-11-09T07:45:15.143Z
updated: 2026-11-17T02:08:24.189Z
closed: 2026-11-17T02:08:24.189Z
---

## Summary

The spend ledger lock's contention retry (`acquireLockWithRetry`, a 25 ms wait) runs on the clock it is given. In a `projectHub` T2 fixture that is the hub's FakeClock. A transaction that meets contention, for example with the startup `DropletExecutor.sweep`, never retries unless the test advances the clock. The test then hangs, and teardown waits on the held create. It showed on Linux in T-1751's load-gate repetition (verify 36772956, A-18003); macOS ordering hid it. T-1751 works around it with a fixture barrier on the startup sweep's completion.

## Acceptance criteria

- [x] C1. Lock contention retry in tests doesn't depend on the test advancing a FakeClock: the backoff uses a real timer, or the fixture lock carries its own clock (test).
  - done: impl-1769 · 2026-11-17T00:08:41.790Z
  - verified: rev-35 [reviewer] · run rev-35-1769-final-1 · 2026-11-17T00:46:09.591Z · commit 0de17eb019c79d407ce63eb24c8fd1f02c6de9b9
- [x] C2. A T2 `projectHub` case with startup-sweep contention completes without an explicit barrier on Linux and macOS (test).
  - done: impl-1769 · 2026-11-17T00:08:42.402Z
  - verified: rev-35 [reviewer] · run rev-35-1769-final-1 · 2026-11-17T00:46:09.591Z · commit 0de17eb019c79d407ce63eb24c8fd1f02c6de9b9

## Comments

### impl-1769 · 2026-11-16T23:55:58.009Z

Reproduced at projectHub startup-sweep/host-spend seam: node --test hub/test/pool-spend-cap.test.ts (macOS arm64, Node 24.21.0, local targeted T2; no browser) failed the new case with `reservation durably published after startup contention: not within 1000 ms`; existing five cases passed. Regression holds startup ledger publication, observes contender inspection of the held lock, releases it, then asserts durable reservation and sweep completion with no FakeClock advance. Fix gives default filesystem lock retry/deadline native time; explicit scripted waits retain injected clock.

### impl-1769 · 2026-11-16T23:59:46.427Z

Source ready at pushed clean 6dbfbca59dd5ef39ceeed92d4ca909ed0770717b; Reviewer request delivered. Evidence A-20479. npm run test:lint completed exit 0, test-lint refusals 0; closed-item wording 0 findings; existing report-only baseline/diagnostics remain. Native macOS arm64/Node 24.21.0 targeted receipts: pool-spend-cap 6/6, executor-lock-liveness 9/9, executor-spend 20/20, shared hub-priority 1/1, typecheck exit 0. No full or Linux verification yet. Coordinator authorized unmodified T-1923 cherry-pick 15757e4d4 as 2776eb997; matching patch hash documented in A-20479. Await clear source verdict, then Coordinator verify window.

### rev-35 · 2026-11-17T00:05:13.764Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1769-source-1
commit: 6dbfbca59dd5ef39ceeed92d4ca909ed0770717b
scope: full
findings: [{"severity":"medium","text":"Default sweep now omits the #wait wrapper carrying #abort.signal; sweepProjects passes no signal, allowing native backoff to acquire/publish after executor close. Dispatcher joins the sweep before storage closes, but does not restore cancellation. Preserve native timing with shutdown cancellation and appropriate joining (rule 12).","file":"hub/src/executor/droplet/droplet.ts","line":590},{"severity":"medium","text":"The new contention callback acquires/writes setup and installs the rename hold before a whole-sequence owner. Later per-resource cleanup/finally cannot fence and join all setup/body continuations or adopt late resources before mock restoration/root removal (rule 12).","file":"hub/test/pool-spend-cap.test.ts","line":155},{"severity":"medium","text":"Generic processes.reads growth can be satisfied by own-identity probes before the target lock is attempted/read, so releasing the sweep does not prove contention/backoff was exercised. Observe an exact filesystem/held-owner contention receipt and retain durable reservation/sweep/unchanged-clock assertions (rule 9).","file":"hub/test/pool-spend-cap.test.ts","line":178}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source not clear, A-20485, three medium findings consolidated. Intended native lock retry/deadline versus caller accounting clock is coherent; generic direct lock behavior/API stays unchanged, and existing scheduler retry assertions remain after removing the workaround. Implementer confirms all three gaps with no earlier owner/approved disposition. Coordinator d6400286 authorizes identity-only shared-fix check; independent raw diff equality confirms separate 2776eb997 matches 15757e4d4 exactly. A-20479/A-20483 retain original native red output, reported local green counts, source-to-commit/raw/hash/signal/scan limits and current consumer/tier dispositions. Linux/full verification/browser/load are unexecuted; report-only advisories remain. C1/C2 failed; no criteria verified. Hold released for consolidated correction and fresh source review before configured verify. No Reviewer edits/runtime or post-review dev merge.

Criteria: C1 failed (The default native sweep timing change drops executor shutdown cancellation and can admit ledger work after executor close.), C2 failed (The new contention regression lacks whole-callback ownership and a deterministic receipt that contention actually occurred.).

### impl-1769 · 2026-11-17T00:06:56.612Z

Consolidated correction underway. New native-default shutdown regression reproduced finding 1 at prior production source: node --test hub/test/pool-spend-cap.test.ts exited 1, 6 passed/1 failed, `executor close joins the admitted sweep: false !== true`. Strengthened contention oracle observes actual spend-lock link EEXIST. Both new callbacks now compose fixtureWork before any acquisition; roots/hubs/locks adopted, body joined before mock restoration. Public rememberProject/sweepProjects receive optional trailing AbortSignal (existing positional calls remain valid); all direct production callers are in DropletExecutor, tests listed in A-20483 plus pool regression. Propagating executor signal and tracking/joining admitted sweeps in close.

### impl-1769 · 2026-11-17T00:09:40.778Z

Correction source review queued at 0de17eb019c79d407ce63eb24c8fd1f02c6de9b9, tree fc9bb4e37d42c9530587553ca2badea711659fcd; clean pushed source, no post-first-review dev merge. A-20488 retains consolidated change/evidence limits. Final npm run test:lint exit0, refusals0, report-only diagnostics unchanged; closed-item wording0. Targeted macOS T2 pool-spend-cap7/7, executor-admission-lock11/11 and typecheck pass, from implementation trees. No configured/Linux verification yet; waiting fresh clearance and Coordinator window.

### rev-35 · 2026-11-17T00:15:44.902Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1769-source-2
commit: 0de17eb019c79d407ce63eb24c8fd1f02c6de9b9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear A-20493. All three A-20485 findings resolved: admitted sweeps are tracked/joined by executor close; shutdown signal reaches both registry calls and lock timing on native/scripted paths; both new callbacks create fixtureWork before setup and adopt late resources with releases/restorations behind body/resource drain; exact spend-lock fs.link EEXIST replaces generic process reads. Durable reservation/sweep/unchanged-time assertions remain; new shutdown test checks joined/deferred sweep and unchanged ledger after holder release. Default native clock versus caller accounting clock and old positional API compatibility retained; separate shared fix unchanged. A-20488 retains new red/green, 7/7 and scripted admission-lock 11/11; later lint completion f9069783 reconciles pending status. All precommit/raw/hash/signal/scan/platform limits retained, no configured/Linux/browser proof inferred. C1/C2 implementation/test design clear but both test-dependent criteria remain unverified for final evidence. No findings; hold released. Obtain Coordinator window for one mode-free same-head verify. No Reviewer runtime or dev merge.

### rev-35 · 2026-11-17T00:46:09.591Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1769-final-1
commit: 0de17eb019c79d407ce63eb24c8fd1f02c6de9b9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear A-20514. Independent A-20510 parsing confirms6,524ordinary passes/707files,0fail/cancel/skip; separate265loadpasses. Startup contention ordinary24875 plus five load records and native shutdown ordinary24881 plus five load records all pass; scheduler retry24857 and all seven pool-spend-cap identities pass. A-20512 now supplies the C2-required separate clean exact-head macOS7/7/exit0/no fail/cancel/skip at Node24.21 arm64, with source unchanged before/after; older dirty runs remain separate. Source-reviewed durable lock conflict/reservation/sweep/join/unchanged-clock assertions retained. All224T1/428fallbackT2/55Web complete;269T3/17T4 unexecuted, with direct native consumers deferred. Exact Linux provenance/normalized tree checked, actual isolated HeadlessShell1248/CfT156.0.8078.4; report-only budgets/lint/ratchet/skip checks and raw/hash/signal/scan limits retained. C1/C2verified; no findings; hold released. No Reviewer runtime or further run requested.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-17T02:08:24.189Z

Merged 4496ae8ef0fdf7c4b45f48103d1fd6517bd80c63 onto dev.
