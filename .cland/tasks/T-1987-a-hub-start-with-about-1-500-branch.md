---
id: T-1987
kind: task
title: A hub start with about 1,500 branch freshness answers serves task.view within a named bound once T-1984 and T-1646 have both landed
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by:
  - T-1984
  - T-1646
topic: topic-1699
branch: t/T-1987-a-hub-start-with-about-1-500-branch
created: 2026-11-18T20:13:06.075Z
updated: 2026-11-21T08:02:00.555Z
---

## Summary

Split from T-1984 (its C3) by the Coordinator on 2026-11-18. T-1984 bounds stage-cover fan-out per freshness drain (1,500 → 0 dependent announcements), and T-1646 makes the per-branch explorer refresh incremental. T-1984's startup component test failed on the droplet run 8c6a55b1 (A-21401, evidence verdict rev-36-1984-evidence-1, A-21405). Repetitions 1–4 have no startup outcome, and repetition 5 armed the behaviour observer and hit `first Git answer to validated task.view response: not within 2000 ms` under the load gate. So with T-1984 alone, `task.view` can still wait behind the drain. The remaining per-answer cost was the explorer refresh (`#announceBatch` → `#refreshExplorer` → `#rawSummary`), which T-1646 addresses.

## What to build

On dev with both T-1984 and T-1646, a hub-start component test seeds about 1,500 branch wants and measures `task.view` while the freshness drain runs. Count work per answer as the primary proof. If the bound fails again, name the remaining hot path from a work census before changing anything.

## Acceptance criteria

- [x] C1. A hub start with about 1,500 branch freshness answers serves `task.view` within a named behaviour bound while the drain runs, with the startup outcome and drain state recorded as positive receipts (test; first timing sample on a droplet verify).
  - done: impl-1987 · 2026-11-21T08:00:11.568Z
- [x] C2. Per-answer work during the drain (explorer summaries computed, rows hydrated, dependents announced) is bounded and recorded, with a control that fails on d7050e7e2 (test).
  - done: impl-1987 · 2026-11-21T08:00:11.717Z

## Comments

### impl-1987 · 2026-11-21T07:44:06.645Z

Test seams: existing startup-listener-scale fixture extended from 375 to 1500 unique verdict commits/fake branches, with summary SQL computations and hydrated titled rows counted from fixture-owned SQLite handles, stageDependents from structured settled receipts, and exact per-item resolved publication plus producer completion receipts. Added separate work-only case for local rollback control; latency case first runs on droplet. No wire/policy/production contract change planned unless census identifies remaining hot path. Native slot queued sixth by Coordinator.

### impl-1987 · 2026-11-21T08:00:11.960Z

Local red/green work census published as A-22404, durable path /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22404-t-1987-local-red-control-and-work-census. Keeps all earlier unsupported/incomplete attempts; exact final control admission load1 was 4.74072265625 (corrects preliminary slot-release estimate). Both source and test runtime contract unchanged; item adds regression/evidence only. Fetched/merged origin/dev once before review (fast-forward to c0198410b, tracker-only delta). No QA brief needed: qaPolicy scope none. First latency sample awaits droplet verification.

### rev-41 · 2026-11-21T08:02:00.555Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261121-1987-source1
commit: 86f77941fb415fa50780ce3f6e008bf486e3bdd5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review clear at86f77941fb415fa50780ce3f6e008bf486e3bdd5 against c0198410b. Standards:0 findings. Spec:0 findings. Test+file guide only; unchanged production/wire. Both cases retain T3 classification. stageCase owns pre-acquisition setup, hub/resources, tracked callbacks, SQLite patch and roots with positive close and native-launch guard. Separate setup/request bounds and actual validated task.view reply remain; observer is armed before explicit freshness read. The latency case records reply-bound counters and asserts a read entered and fewer than1500 commits were resolved, keeping request latency separate from full drain/listener measurements. All startup listener receipts must be bound and scheduling follows serving.

Work census counts fixture-owned SQLite summary computations and hydrated titled rows over explicit freshness read through all1500 distinct resolved item publications. Aggregate limits10 summaries/40 hydrated rows per answer are enforced synchronously at the consuming SQL trace, with final assertions retained. Resolved item publication, Git reads and announcement producer completed receipt are checked separately. Structured settled receipts report zero stage dependents. Existing setup and cleanup scope remain owned; no new native process.

Independently read A-22404 assessment,current-census.log and control-node24-fourth.log. Supported macOSarm64 Node24.21 work-only T3 control: d7050e7e2 native exit1 with literal 'freshness work exceeded budget before completion',3065 summaries/60001 hydrated/16 publications. Candidate local work-only exit0:1500 reads/1500 publications,3003 summaries,25888 hydrated,0 dependents, all listener bound; reported producer receipt joined. Counts exclude startup/teardown. Reported case3251.34ms is reporter duration, not task.view latency or speedup. Earlier unsupported/incomplete runs retained and excluded. Candidate work evidence was produced before tracker-only base merge; it is selected diagnostic evidence, not configured same-head full proof. Full lint/typecheck reported passed. C1 timing case intentionally unexecuted locally: first timing sample awaits droplet verification. No final criterion marks yet; final C1/C2 verification awaits exact-head configured run and its named identity receipts. Reviewer ran no tests, stress/native/browser work or edits.
