---
id: T-818
kind: task
title: Stage runs load-gate a T4 latency test five times in parallel, so tracker-load fails on a slow droplet disk
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-554
branch: t/T-818-stage-runs-load-gate-a-t4-latency-test
created: 2026-10-18T19:36:00.067Z
updated: 2026-10-19T07:06:59.151Z
---

## Summary

The E-678 stage-1 Linux run e2915ae9 at c7417944 (A-5544, shard-1) failed only on its load gate. `hub/test/tracker-load.test.ts` › "tracker requests stay within 5 s with 20 sessions and 200000 retained events" passed 4 of 5 repetitions run alongside the phase; the failing one finished at 4.26 s. That shard's disk was slow (fsync 47 ms, SQLite 99 ms, against about 8 ms on the other shard). The test is T4, and stage runs now include T4 through the soak selection (T-714). Five concurrent copies of a latency-bound load test next to a full phase measure the machine more than the tracker.

## Acceptance criteria

- [x] C1. Load-gate repetitions skip, or run serially, tests that assert a wall-clock latency bound under self-generated load (T4 load tests such as tracker-load); the run's result names that choice, and a component test proves it.
  - done: impl-818 · 2026-10-19T05:38:07.087Z
  - verified: rev-30 [reviewer] · run rev-20261019-818-final · 2026-10-19T05:53:46.094Z · commit 3e5e5a21ca2b2ec6088708339ce6500b7fe3b5f1
  - verified: rev-30 [reviewer] · run rev-20261019-818-integration-final · 2026-10-19T07:06:58.290Z · commit 2b3666fe98b75764739b7fefd9088b07746fce5a
- [x] C2. A component test with the stage-occasion planner shows tracker-load selected exactly once in its soak phase and in no load-gate repetition, and the mode-free task verify passes at the reviewed head. The next stage run's real receipt is recorded on the item by the Coordinator after the merge, as evidence only, not as a gate.
  - done: impl-818 · 2026-10-19T05:53:09.026Z
  - verified: rev-30 [reviewer] · run rev-20261019-818-final · 2026-10-19T05:53:46.094Z · commit 3e5e5a21ca2b2ec6088708339ce6500b7fe3b5f1
  - verified: rev-30 [reviewer] · run rev-20261019-818-integration-final · 2026-10-19T07:06:58.290Z · commit 2b3666fe98b75764739b7fefd9088b07746fce5a

## Comments

### impl-818 · 2026-10-19T05:36:08.593Z

C1 implemented red→green at the assigned component seam: stage planned five tracker-load repetitions before the change; the corrected FakeClock/scripted-provider fixture proves zero T4 repetitions for stage/epic/release/soak, unchanged base T4 file selection, lower-tier controls and explicit selection/log policy. T1 occasion planner coverage extended. T-827 deadline planning consumes the filtered file list. Host lint/typecheck pass; targeted soak-component 6/6 (1.80s), tiers 13/13 (0.36s), stage-rules 8/8 (0.90s). C2 actual stage droplet proof remains for the Coordinator's next occasion; no task-mode run can claim it.

### rev-30 · 2026-10-19T05:38:02.263Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-818-source
commit: 3e5e5a21ca2b2ec6088708339ce6500b7fe3b5f1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards/Spec audit A-5795 has no task findings. T4 file allowlist filtering preserves base soak, intersects existing restrictions, reaches runner via selection transport and precedes soak deadline budgeting. Component asserts stage/epic/release/soak base T4 entries, zero measured/unknown T4 repeats, five lower-tier repeats and policy in log/result. Existing assertions retained. Coordinator 3a1f9fcb covers this new control's inherited Git probe under shared T-803, directs no port/dev merge, and owns batch zero-row check. Revised C2 read back: real stage receipt is post-merge evidence only. C1/C2 final marks await unchanged-head mode-free task gate; none verified here. QA scope none.

### impl-818 · 2026-10-19T05:53:09.471Z

Exact reviewed-head mode-free droplet gate baec0a97-56d7-4274-931e-cf1060b4cb8b passed at 3e5e5a21: 1468 tests/pass, zero fail/cancel/skip/todo; log A-5804. Linux x64 c-8 lon1, Node v24.21.0/Neovim v0.12.5; lifetime 856s, cost $0.0595. C2 claimant done recorded under revised criterion. Source unchanged; no dev merge/port. T3 deferred to merge batch. Coordinator's T-803 inherited planner exception and post-merge zero-mismatch check remain applicable; actual stage receipt is post-merge evidence only. Reviewer has the hub result for final settlement.

### rev-30 · 2026-10-19T05:53:46.094Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-818-final
commit: 3e5e5a21ca2b2ec6088708339ce6500b7fe3b5f1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-5805 combines source A-5795 and exact-head baec0a97/A-5804. Task T0–T2 1468/1468, zero fail/cancel/skip; all 388 groups pass 5/5. New component passes .248s plus 5/5 repetitions, proving retained once-in-base T4, zero extra T4 repeats, lower-tier controls and named policy for stage/epic/release/soak. Whole soak-component 6/6, tiers 13/13, stage-rules 8/8, soak 2/2. SIX report-only Git tier rows disclosed, including the new identity explicitly covered by Coordinator 3a1f9fcb under T-803; no zero-trip claim. C1/revised C2 verified. No task findings; QA none. Real stage evidence and batch zero-row check remain Coordinator-owned post-merge obligations, not completed task proof.

Criteria: C1 verified, C2 verified.

### impl-818 · 2026-10-19T06:50:09.974Z

Queue reported merge-conflict after T-803 landed. Merged origin/dev 9251cfd2 once under rule 11/Coordinator instruction, resolving only suites.ts admission planner by keeping injected durationHistory, then T4 repetition filter, then T-827 soakDeadlinePlan. Committed/pushed 2b3666fe98b75764739b7fefd9088b07746fce5a. A-5845 retains enforced per-file evidence: soak-component 6/6 1.617s; close-component 6/6 2.850s; tiers 13/13 0.424s; tier-report 6/6 0.280s; separate tier receipt has zero rows, including the new T-818 occasion identity. Host lint/typecheck pass. Task diff versus new dev remains the same five files. Fresh delta source review requested before new droplet verify; old same-head runtime cannot settle this changed head.

### rev-30 · 2026-10-19T06:50:51.999Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-818-integration-source
commit: 2b3666fe98b75764739b7fefd9088b07746fce5a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear; A-5846 audits Coordinator-authorized conflict merge 26d6e75b. Only manual conflict is admission line: injected durationHistory feeds planTierReport, then unchanged T4 filter, then soakDeadlinePlan. Task docs/planner/tests byte-identical to prior reviewed head; no controls removed. A-5845 enforced close 6/6, soak 6/6 (including formerly exempt new identity), tier-report 6/6, tiers 13/13, zero structured trip rows; host lint/typecheck green. Prior A-5804 gate is stale. C1/C2 final marks await one mode-free gate at unchanged 2b3666fe; QA none, real stage evidence remains Coordinator-owned.

### impl-818 · 2026-10-19T07:06:33.841Z

Post-integration exact-reviewed-head mode-free droplet gate a8c8b509-8ae9-427d-a75b-878ff441f4b1 passed at unchanged 2b3666fe98b75764739b7fefd9088b07746fce5a: 1469 tests/pass, zero fail/cancel/skip/todo; A-5855. Whole log has zero structured tier-mismatch rows; the new occasion policy component also passes 5/5 repetitions. T-803 inherited planner trips are gone after conflict integration. Linux x64 c-8 lon1, Node v24.21.0/Neovim v0.12.5; lifetime 891s, cost $0.0619. Tree clean; no further changes/runs. Reviewer owns refreshed C1/C2 final evidence; Coordinator re-enqueues after final ready. T3 remains merge-batch proof, later actual stage receipt is Coordinator evidence only.

### rev-30 · 2026-10-19T07:06:58.290Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-818-integration-final
commit: 2b3666fe98b75764739b7fefd9088b07746fce5a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Integrated final clear; A-5856 combines delta source A-5846, enforced components A-5845 and exact-head a8c8b509/A-5855. T0–T2 1469/1469, zero fail/cancel/skip; all 389 groups pass 5/5. Formerly exempt T4 policy component executes .160s plus five passing repetitions; whole log has ZERO tier-mismatch rows, so the prior shared exception is no longer needed at this head. Prior six-row evidence remains historical. C1/C2 refreshed verified; no findings, QA none. Real stage receipt remains Coordinator-owned post-merge evidence; no native T3/T4 task execution claimed. Ready for normal re-enqueue per 26d6e75b.

Criteria: C1 verified, C2 verified.
