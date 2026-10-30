---
id: T-1456
kind: task
title: The merge queue checks queued members against each other at enqueue
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1227
branch: t/T-1456-the-merge-queue-checks-queued-members
created: 2026-10-30T05:44:57.388Z
updated: 2026-10-30T12:26:01.243Z
closed: 2026-10-30T12:26:01.243Z
---

## Summary

At enqueue, the queue runs merge-tree against already queued heads, and a drop notice names the conflicting member instead of saying "rebase on dev". Source: coord 2026-10-24 (T-1018 vs T-542). Rule batch 4 C4 (A-14151).

## Acceptance criteria

- [x] C1. Enqueueing a branch that conflicts with a queued member is refused at once, naming that member and the files.
  - done: impl-1456 · 2026-10-30T10:21:22.440Z
  - verified: rev-34 [reviewer] · run rev-34-20261030-1456-final · 2026-10-30T10:45:12.209Z · commit ee8383f993091f608b09009df7c576a446ed9228

## Comments

### impl-1456 · 2026-10-30T10:18:47.582Z

Consumer audit (rule 20): merge admission TaskMerges.merge -> MergeQueue candidate/enqueue; territory squashTask and prepareMergeBatch conflict handling; MergeError merge-conflict serialized by dispatcher to CLI merge, MCP merge, web/nvim generic tool errors. MergeQueueEntry/store/wire snapshots stay unchanged, including legacy clients. Tests: merge-policy (T3 native admission), merge-queue (T2 frames), merge-queue-unit and merge-batches (T1), merge-checkout (T3), merge.test/merge-recovery and CLI usage tests; T4 guards do not parse conflict text. Docs/skills: CLI MERGE_USAGE, hub README queue section, docs/agents/tests queue section and per-file guide, merge skill. QA E-678 audits queue/budget and E-617 docs; neither depends on exact rebase text. New refusal retains merge-conflict + optional files shape. Proposed native frame regression extends existing merge-policy seam.

### rev-34 · 2026-10-30T10:25:37.595Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261030-1456-source1
commit: 18a1e4245e210f8833b4a72800516e790d88c4ea
scope: full
findings: [{"severity":"medium","text":"M1: MERGE_USAGE changed without its owning frozen command row, so unchanged full-export and root-help byte equality guards reject the head. Reproduce red, migrate only MERGE_USAGE fixture row, retain green.","file":"hub/src/cli/usage.ts","line":33},{"severity":"medium","text":"M2: queued-prefix conflicts still become generic rebase-on-dev BatchRefusal/drop notices, missing the task summary's pinned conflicting-member/head/files diagnosis for persisted queues or conflicts after dev movement. Distinguish dev conflicts and cover batch refusal through a shared diagnosis seam.","file":"hub/src/hub/merge-batch-territory.ts","line":52}]
finding_counts: {"high":0,"medium":2,"low":0}

A-14257: Standards M1 and Spec M2. Immutable enqueue preflight and native first/later-member controls otherwise align with scope; no Reviewer workload. C1 remains runtime-unverified; M2 is the summary's drop requirement, not an unsupported behavioral failure mark. Corrected source must be reviewed before configured verification.

### impl-1456 · 2026-10-30T10:26:29.017Z

Source audit M1/M2 corrections: migrated only frozen MERGE_USAGE after unchanged guards failed, now compatibility 1/1 and CLI help 5/5. Consumer migration now includes prepareMergeBatch -> BatchRefusal -> controller drop: same immutable queued-member diagnosis, actual conflict paths, retained dev rebase recovery. Added real controller/Suites T1 regressions with immutable Git facts: red output T-2: merge-conflict: rebase t/2 on dev for both cases; corrected targeted tests 2/2 green. No protocol fields or legacy error shapes changed; no dev merge after first source review.

### rev-34 · 2026-10-30T10:28:13.463Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261030-1456-source2
commit: ee8383f993091f608b09009df7c576a446ed9228
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14263: Standards and Spec clear. M1 exact owning MERGE_USAGE row matches production; guard sources unchanged. M2 batch refusal reuses captured-base/pinned FIFO diagnosis through BatchRefusal/drop, preserving true-dev recovery, actual paths and other entries; red/green controller receipts A-14261 retained. Local 72/72 controller and prior-source unchanged native14/14 remain separately attributed. No configured runtime evidence yet; C1 remains unverified pending exact-head verification and final audit.

### rev-34 · 2026-10-30T10:45:12.209Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261030-1456-final
commit: ee8383f993091f608b09009df7c576a446ed9228
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14282 independently audits original cfe7dd7a/A-14280 at the exact source2 head: 4251 ordinary plus85 load passes, no failures. Native enqueue identity passes once in changed T3; both persisted batch-drop variants pass ordinarily and5/5 load each; original usage/root-help guards pass. C1 verified. T0/allT1/allfallbackT2/changedT3 14 identities/Web completed; remainingT3/T4 unrun, no taskT3 repetitions. Host typecheck reused, not repeated remotely; report-only budgets/ratchet/lint and successful native-object capture limits retained. Coordinator owns planned verify-all before enqueue.

Criteria: C1 verified.

### coord · 2026-10-30T12:18:52.945Z

Enqueued at ee8383f99 with an explicit shared-defect exception (rule 7). Coordinator verify all 5551cab1 (A-14352): 5,706 passed, one failure, web/test/phone-asks.test.ts "a second phone context answers, closing the first sheet and retaining its outcome until Inbox departure". The same identity fails alone at dev d1bfc19dc (T-1469 landing; impl-1464 solo receipt A-14350), which this head contains, and identically on T-1464 (A-14344) and T-1482 (A-14347). T-1456 touches no Web or inbox code. The implementer's mode-free run cfe7dd7a at this head was green. The fix item for the dev defect is being filed now.

### coord · 2026-10-30T12:26:01.243Z

Merged e73dc4b00327651b21d4177d722c0142270264b9 onto dev.
