---
id: T-1863
kind: task
title: "suite-cancel: run worker found dead right after a refused cross-session cancel (Linux cover)"
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1523
branch: t/T-1863-suite-cancel-run-worker-found-dead-right
created: 2026-11-15T03:12:15.172Z
updated: 2026-11-15T12:16:51.528Z
---

## Summary

`hub/test/suite-cancel.test.ts::suite cancel refuses another session's run while the human can cancel it by id` failed at line 141, `assert.equal(pidAlive(job.pid!), true)`, with false !== true after 2.5 s. This was in the E-1537 stage-4 Linux droplet cover 3845b0b3 at 881114bfd (shard-2, c-8, workers 2), log A-19475. Other files in the stage were unrelated, and the test file has been unchanged since 5a0ce0799 (2026-11-03). The assertion means the worker of the launched fake run (`node -e "setTimeout(()=>{},30000)"`) was already gone by the time the reviewer's refused cancel returned. So either the worker exited or was reaped early under load, or the refused path still signalled it.

## What to build

Find out why the worker pid was dead. There are three candidates: the fake worker's own lifetime, launch completing before the pid is recorded, or a refused cancel that still reaches the process. A refused cancel must never signal the run. If that is the cause, it's a product defect and the fix goes in the cancel path, not the test. If the test is at fault, make the liveness check wait on the run's recorded state, not a single pidAlive sample. The behaviour assertions stay exact.

## Acceptance criteria

- [x] C1. The cause is shown from a reproduction under load or from instrumentation. A refused cross-session cancel is proven to send no signal to the run's process group (test).
  - done: impl-1863 · 2026-11-15T11:44:53.532Z
  - verified: rev-36 [reviewer] · run rev-36-1863-final-1 · 2026-11-15T12:16:50.028Z · commit 794ab6f6d3553b1119202b924d89e26dfc372c78
- [x] C2. The test passes 20 out of 20 runs at a 1-minute load of at least 8, on Linux in a local Docker container run with `--init` (as T-1854 did), or on macOS with the reason recorded when Docker is unavailable, with unchanged refusal and human-cancel assertions (test).
  - done: impl-1863 · 2026-11-15T11:51:59.129Z
  - verified: rev-36 [reviewer] · run rev-36-1863-final-1 · 2026-11-15T12:16:50.028Z · commit 794ab6f6d3553b1119202b924d89e26dfc372c78

## Comments

### impl-1863 · 2026-11-15T11:40:20.878Z

Deterministic red and diagnosis: A-19631. Forced queued launch has pid=null, no native exit; old pidAlive(null) fails. Wait recorded PID + body receipt; native signal observer sees zero on refusal and positive human SIGTERM. Mac T3 suite-cancel 8/8; C2 pending authorized Linux Docker load slot. Source review requested before C2 per Coordinator.

### rev-36 · 2026-11-15T11:44:35.417Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1863-source-1
commit: f2f078b100425f58dc9a8e774f4af86aeef2fad9
scope: full
findings: [{"severity":"medium","text":"The reviewer spoke closes via a standalone t.after registered after the shared fixture cleanup hook. spawnSpoke owns its native child without this TestContext, so root disposal can precede reviewer process/transport closure on early assertion/readiness failure. No earlier owner exists (claimant confirmed). Register rev.close through onCleanup's resource phase before hub/directory disposal.","file":"hub/test/suite-cancel.test.ts","line":135}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source audit A-19635: one medium Standards finding, no additional Spec findings. Startup-snapshot diagnosis/worker+body readiness repair and unsuppressed native signal observer with human positive control otherwise match the task. Exact original Linux cause remains unknown as honestly documented. A-19634 transcribed runtime greens precede final type correction, no original inventories/publication scan; limits retained. C2 warmup produced no repetitions/no pass evidence. No runtime criteria verified. Correct cleanup, restore C1 implementation mark and request fresh source review before final-head C2/verify. Reviewer read-only, no tests/probes/Docker/delegation.

Criteria: C1 failed (The changed native refusal fixture has no resource-phase reviewer-spoke close before root disposal; repair cleanup ownership before accepting its proof.).

### rev-36 · 2026-11-15T11:45:47.295Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1863-source-2
commit: 794ab6f6d3553b1119202b924d89e26dfc372c78
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear: A-19636 carries full A-19635 source audit. Sole one-line delta registers reviewer close immediately in shared onCleanup resource phase before hub/root disposal; confirmed earlier medium closed. Assertions/readiness/signal proof otherwise unchanged. C1 done restored; no runtime criteria verified; C2 still incomplete. HEAD confirmed, tracked source unchanged beyond repair. Four untracked owned C2/capture entries remain and must not silently enter eventual verified source snapshot; preserve originals durably and exclude owned staging before verify. A-19634 precommit/transcript/inventory/publication and original-Linux-cause limits retained. No Reviewer runtime execution. Final-head C2/configured evidence pending Coordinator slot conditions.

### impl-1863 · 2026-11-15T11:51:59.354Z

Final reviewed head 794ab6f6d: C2 Linux arm64 Docker --init, 20/20 serial focused T3 passes, 1-minute load before/after 8.00..12.16; each test native exit0/signal null/error null. A-19637 raw receipts, A-19638/A-19639 sealed runners. CPU children joined SIGTERM, Docker exit0/container gone before all locks released. Original warmup attempt incomplete 0 repetitions. Owned staging removed after durable capture. No full-suite/Web claim; mode-free verify next.

### rev-36 · 2026-11-15T12:16:50.028Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1863-final-1
commit: 794ab6f6d3553b1119202b924d89e26dfc372c78
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear: A-19642, receipt/consumer ledger A-19641, original configured A-19640/runb8174aa5. C1/C2 verified: instrumented startup-snapshot diagnosis plus exact refusal/human signal positive control; all8 changed T3 base cases pass, and separate A-19637–39 final-head Linux arm64 Docker --init 20/20 passes with native code0/signalnull/errornull, sampled load8.00–12.16, CPU closures/Docker completion retained. Historical original Linux cause remains unknown, not overclaimed. 6355 positive base tests/701 files; separate185 load test/file passes. All982 manifest paths accounted,264 T3/17 T4 deferred, zero missing lower/Web. Exact droplet head/tree/browser provenance, clean source, report-only budgets/lint. Prior transcript/inventory/publication/linkage limits retained. No Reviewer runtime execution. qaPolicy none; hub/Coordinator own ready/landing.

Criteria: C1 verified, C2 verified.
