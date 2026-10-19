---
id: T-864
kind: task
title: Hub start dropped all six merge queue entries as 'branch head changed or deleted' although no head had changed
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: topic-577
branch: t/T-864-hub-start-dropped-all-six-merge-queue
created: 2026-10-19T10:23:43.638Z
updated: 2026-10-19T12:05:58.321Z
closed: 2026-10-19T11:48:09.786Z
---

## Summary

At hub start (restart #18, 2026-10-19 10:19:21Z, first new hub pid 2351) the merge queue dropped all six entries with "branch head changed or deleted": T-665 bbfaafe8, T-833 1e595402, T-836 77a5c646, T-837 6c3d7ad8, T-848 4f6c6775, T-853 6ccfc55a. None of those heads had changed; the Coordinator confirmed each on origin afterwards and re-enqueued them.

## Problem

`MergeQueue.reconcile` (hub/src/hub/merge-queue.ts ~37–49) runs with `refreshed = true` when `branchTips` returned a map. It then treats a branch missing from that map (`tips.get(entry.branch) ?? null`) as deleted. The drop fired about 7 s into a tracker-storage stall during the startup ready check. So an incomplete or empty tip read is likely the cause: a map that lacks branches still counts as an authoritative refresh.

## Acceptance criteria

- [x] C1. A refresh whose tip read is incomplete or fails drops no entry. An entry is dropped as deleted only when an authoritative read shows its branch absent, and as changed only when the read names a different head. A component test feeds the queue a partial or failed tip read at startup and keeps every entry.
  - done: impl-864 · 2026-10-19T10:29:59.276Z
  - verified: rev-30 [reviewer] · run rev-20261019-864-final · 2026-10-19T10:48:52.501Z · commit fdc5bfb19337ee248e025be0c6d1092e1bc8ae83
- [x] C2. A real deletion and a real head change still drop their entry with the same reasons (existing tests stay green).
  - done: impl-864 · 2026-10-19T10:29:59.745Z
  - verified: rev-30 [reviewer] · run rev-20261019-864-source · 2026-10-19T10:31:22.087Z · commit fdc5bfb19337ee248e025be0c6d1092e1bc8ae83
  - verified: rev-30 [reviewer] · run rev-20261019-864-final · 2026-10-19T10:48:52.501Z · commit fdc5bfb19337ee248e025be0c6d1092e1bc8ae83

## Comments

### impl-864 · 2026-10-19T10:26:11.773Z

RED reproduced before production changes: node --test --test-name-pattern='startup preserves' hub/test/merge-queue.test.ts fails in 0.43 s. Reopened in-process hub receives a valid partial for-each-ref response missing the still-live task ref; hub.status shows [] instead of the durable queued entry. No process restart or wall-clock wait needed.

### rev-30 · 2026-10-19T10:31:22.087Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-864-source
commit: fdc5bfb19337ee248e025be0c6d1092e1bc8ae83
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-5950. Standards/Spec: no findings. Whole malformed snapshot rejected; omissions require complete positive absence receipts, failed/partial confirmation authorizes no snapshot drops, and cache notifications cannot bypass validation. Genuine deletion/head-change reasons retained, C2 source verified. Six-entry T1 cases plus reopened projectHub T2 startup/deletion controls preserve original assertions. A-5949 red/green host evidence retained; historical stall not causally reconstructed. C1 awaits exact-head mode-free task gate. No Reviewer edits/tests; QA none.

Criteria: C2 verified.

### rev-30 · 2026-10-19T10:48:52.501Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-864-final
commit: fdc5bfb19337ee248e025be0c6d1092e1bc8ae83
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; A-5953. Full A-5952/a6bcd8df audited: 1502/1502 ordinary passed, zero fail/cancel/skip/TODO, zero tier-mismatch rows and all 425 load groups 5/5. Five new six-entry/unit controls plus startup-retention and explicit-deletion component cases pass ordinarily and 5/5; existing changed-head/verdict/closure control remains green. C1/C2 verified; source A-5950 unchanged, no findings. Historical stall not causally reconstructed. T3 remains landing evidence; report-only lint/budget diagnostics retained.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T11:48:09.786Z

Merged 702ddf507b80fa4e32fa8a0653217f2514a6566f onto dev.

### coord · 2026-10-19T12:05:58.321Z

Landing evidence: batch run d11beb94 (A-5991) passed 1728/0, landed at 702ddf50. Live check at hub restart #19 (2026-10-19 12:05Z, serving on port 51026): all seven queue entries survived. T-509, T-836 and T-854 (batch, rerun as 22fe413f) and T-838, T-841, T-524 and T-842 were still queued, against six lost at restart #18.
