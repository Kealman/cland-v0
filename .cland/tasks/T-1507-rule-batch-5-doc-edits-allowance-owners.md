---
id: T-1507
kind: task
title: "Rule batch 5 doc edits: allowance owners, synthetic-PID fixtures, epic QA topics, memory probe guide"
state: closed
status: done
size: XS
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1280
branch: t/T-1507-rule-batch-5-doc-edits-allowance-owners
created: 2026-10-31T08:18:54.756Z
updated: 2026-10-31T17:17:42.993Z
closed: 2026-10-31T17:17:42.993Z
---

## Summary

Doc edits from rule batch 5 (A-14855), accepted by the human on 2026-10-31. No code changes.

## Acceptance criteria

- [x] C1. The duration-allowance section of `docs/agents/tests.md` says that an allowance names a standing container (E-880) as its owner from the start, carries added, expires and a reason, and is admitted only after at least two recorded passing samples replay through the production checker.
  - done: impl-1507 · 2026-10-31T17:08:11.075Z
  - verified: rev-26 [reviewer] · run rev-20261031-1507-source-1 · 2026-10-31T17:10:42.829Z · commit 9b43f93d17f47601ab84f675d4352925753070f7
- [x] C2. `docs/agents/tests.md` says that synthetic-PID T2 fixtures inject the complete liveness and identity observer, with a child-launch guard from setup through shutdown, and that native-default observer coverage stays in T3.
  - done: impl-1507 · 2026-10-31T17:08:11.163Z
  - verified: rev-26 [reviewer] · run rev-20261031-1507-source-1 · 2026-10-31T17:10:42.829Z · commit 9b43f93d17f47601ab84f675d4352925753070f7
- [x] C3. The qa skill says that an epic QA request goes in a topic bound to the epic, never in Agents, because QA can publish artifacts only where its request arrived.
  - done: impl-1507 · 2026-10-31T17:08:11.249Z
  - verified: rev-26 [reviewer] · run rev-20261031-1507-source-1 · 2026-10-31T17:10:42.829Z · commit 9b43f93d17f47601ab84f675d4352925753070f7
- [x] C4. The measure-memory per-file test guide says that copied state is prepared in a separate process before the measured subject launches, and that a startup-memory artifact records a digest of the measured startup files.
  - done: impl-1507 · 2026-10-31T17:08:11.326Z
  - verified: rev-26 [reviewer] · run rev-20261031-1507-source-1 · 2026-10-31T17:10:42.829Z · commit 9b43f93d17f47601ab84f675d4352925753070f7

## Comments

### impl-1507 · 2026-10-31T17:07:40.150Z

Docs-only scope: C1 docs/agents/tests.md standing allowance owner plus two passing production-checker replays; C2 same file complete synthetic-PID observer and setup-through-shutdown guard; C3 qa skill epic-bound request topic; C4 measure-memory guide separate preparation process and startup-input digest. Each criterion's read-only textual acceptance check failed before its edit and passed after. No runtime contract changed, no production/test code edited; no consumer migration needed. Checks are documentation-presence evidence only, not runtime coverage. Node v24.21.0 supported. Typecheck in progress; test lint next.

### coord · 2026-10-31T17:09:52.777Z

Scope note (coord, 2026-10-31 17:10Z): includes the correction of the stale owner line in docs/agents/tests/hub-test-measure-memory.test.ts.md:15, which still names E-1466. The allowance is owned by E-880, re-owned on 2026-10-31 at e5b310a78. The Reviewer found it during T-1507's review; it's the same file as C4 and the same topic as C1.

### rev-26 · 2026-10-31T17:10:42.829Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1507-source-1
commit: 9b43f93d17f47601ab84f675d4352925753070f7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-15006 supersedes earlier-head scope note A-15005. Three docs only; C1 standing owner/dates/reason/two passing production-checker replays, C2 complete synthetic observer and setup-through-shutdown positive launch guard/T3 native default, C3 epic-bound QA topic and artifact authority, C4 separate preparation process and startup-file digest all verified by semantic source inspection. Coordinator 5062dcd8 authorized adjacent owner correction: E-880 through 2026-11-06, re-owned from E-1466 on 2026-10-31/e5b310a78 matches manifest/history; aside resolved. No code/contract/gate/default changes. Text checker evidence is documentation-only; local checks remain lead-reported. No reviewer workloads or new full run request. One proposed configured mode-free verify may proceed at this exact head, then original-record evidence review.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-31T17:17:42.993Z

Merged 94e58977ea56f881b7d9b974d11dcd932fd745a8 onto dev.
