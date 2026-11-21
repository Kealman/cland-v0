---
id: T-2049
kind: task
title: A QA verdict's task.comment reply counts its own fresh criterion marks as stale while the item read and demo freshness say current
state: open
status: review
size: S
criterion_seq: 2
labels:
  - needs-triage
  - qa-found
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1707
branch: t/T-2049-a-qa-verdict-s-task-comment-reply-counts
created: 2026-11-21T07:44:31.768Z
updated: 2026-11-21T18:28:31.588Z
---

## Summary

On 2026-11-21, qa-1880 recorded four evidence-only epic DoD verdicts (E-1882, E-1884, E-1885, E-1886) with `task.comment`, at commit 792d643d8. Dev was ahead by tracker and qa/briefs commits only. Each reply's `criteriaCounts` said `verified: 0, stale: 2` for the C1 and C2 marks just written. At the same time, `cland demo status <epic> --commit 792d643d8 --json` said `freshness.current: true`. Seconds later, coord's `task.close` readback of the same epics showed `verified: 2, stale: 0` with `current: true` on each mark, and all four closed. So the verdict-write reply judges mark freshness differently from the item read and from the demo freshness rule, and QA is told its marks are stale when they aren't.

## What to build

Make the reply to a verdict or criterion write compute mark freshness by the same rule as `task.view` and demo freshness. A dev move that touches only `.cland/tasks/` and `qa/briefs/` doesn't stale an epic's marks.

## Acceptance criteria

- [x] C1. A QA verdict written at a commit behind dev by tracker- and brief-only commits returns `criteriaCounts` with its marks verified and not stale, matching `task.view` (test, red before).
  - done: impl-2049 · 2026-11-21T18:23:06.039Z
- [x] C2. A later commit that touches a file changed by the epic's task merges still makes the marks stale in both the reply and `task.view` (test).
  - done: impl-2049 · 2026-11-21T18:23:06.681Z

Evidence: E-1882's comments and A-22380 to A-22383; qa-1880's aside in topic-1544 (2026-11-21 07:44Z). Found by QA.

## Comments

### impl-2049 · 2026-11-21T18:08:08.246Z

Consumer search: criteriaCounts/current projections live in tracker #criteriaOf/#criteriaCounts, Freshness.demo and epicDemoFreshness. task.comment and task.criterion requests return Tracker ItemView directly; CLI task printer, spoke task tools, shared wire schemas, web and nvim task views consume the existing counts/marks. Tests include tracker-summary, tracker-criteria, epic-close, sqlite-hot-reads, cli old-hub shape, task-card, nvim-frame-source and scenarios/ticket-flow. Searches included criteriaCounts, annotateCriteria, countCriteria, demoFreshness, epicDemoFreshness and task.comment/task.criterion across hub, shared, web, nvim, docs, skills and qa. No wire shape or grammar change planned; retain existing old-hub compatibility.

### rev-35 · 2026-11-21T18:16:44.952Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2049-source-1
commit: 47ecb0c89e40d3a3b41b0e556348c66f8912e512
scope: full
findings: [{"severity":"medium","text":"M1: new regression lacks encompassing pre-acquisition/cancellation ownership, separately bounded setup and positive Tracker/DB-close gating before root/native-guard restoration. Raw fixtureNativeGuard defaults unfenced and Tracker is constructed before try; migrate to established owner/ownedTracker while retaining assertions.","file":"hub/test/tracker-summary.test.ts","line":112},{"severity":"medium","text":"M2: noteDemo leaves an older same-key queued/in-flight Want eligible for #work publication; its later Git failure can overwrite the completed explicit proof with false, recreating stale replies/views. Supersede that work while preserving waiting-item settlement/publication, with a controlled overlapping-failure regression.","file":"hub/src/tracker/freshness.ts","line":203}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source review47ecb0c89e40d3a3b41b0e556348c66f8912e512 against fixed based1b803566bd0a651207d1619ae4351d4def19685. Two medium findings, both acknowledged from retained source by lead d5b1e47d/24a328bb; no approved exclusions. A-22543 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22543-t-2049-source1-cache-supersession-and-fixture-ownership-gaps.md separates Standards/Spec and validation limits. Commit/dev-tip/membership key extraction, intended surface policy and old wire shape otherwise retained. C1/C2 failed/unverified pending correction; local author-reported A-22539 is not configured proof. No Reviewer execution or source change. Correct M1/M2 together after hold release, preserve original red and all literal/final assertions, request fresh source review before mode-free verify; no full run requested.

Criteria: C1 failed (An older same-key background failure can overwrite the explicit demo proof, and the new reply regression lacks required fixture ownership.), C2 failed (The shared new surface-edit regression lacks pre-acquisition/abort/positive-close ownership; retain its invalidation assertions while correcting the fixture and overlap controls.).

### rev-35 · 2026-11-21T18:28:31.588Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2049-source-2
commit: 42d80de9a066dedca0db51e3bbed9855ebd110be
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source42d80de9a066dedca0db51e3bbed9855ebd110be, Git tree204229546ec3092a89af15490ef0d23932183820, clears M1/M2. M1: trackerFileCase/stageCase+pre-construction ownedTracker, separately bounded setup and positive Tracker/DB-close restoration. M2: explicit demoProof binds to existing Want, queued/in-flight result cannot overwrite it, retry ids transfer into existing worker publication. Controlled overlap and queued/running/retry cases retain all waiting ids and test membership/dev-tip/stopped refusal; all original reply/view/criterion/surface-edit assertions remain. No wire/policy/schema/ready-field changes. C1/C2 remain checked but unverified pending actual exact-head mode-free result. A-22539/A-22550 preserve original and correction reds plus authored local T1/check receipts, not configured proof. Audit A-22551 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22551-t-2049-source2-proof-supersession-and-fixture-ownership-clear.md. Standards/Spec read-only in-session; no Reviewer execution/edit/submission. Hold releases; ask Coordinator window for one exact-head mode-free verify, no full run requested.
