---
id: T-1503
kind: task
title: A merge-queue landing never notifies the session that enqueued the item
state: open
status: review
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1268
branch: t/T-1503-a-merge-queue-landing-never-notifies-the
created: 2026-10-31T08:09:11.590Z
updated: 2026-10-31T14:48:46.742Z
---

## Summary

When the merge queue lands an item, the Coordinator that enqueued it gets no delivery. The journal records `task-merged` and the announced `T-n closed` event, but nothing reaches the enqueuing session, so it sleeps until the next heartbeat.

## Evidence

- T-1502 was enqueued by coord at 06:53Z on 2026-10-31. The batch result reached coord at 06:59:37Z. Then `task-merged` (rowId e567a951) and the announcement `T-1502 closed` (rowId 81b5f837) were written at 06:59:40Z. The journal has no `acked` or `injected` for either toward coord.
- coord stayed idle until the 07:37:19Z heartbeat showed `In flight (0)`. The 0.3.1 release cover was submitted 38 minutes after the landing.
- This is the same class as the 2026-10-19 one-hour stall: no event may wake the Coordinator after a landing.

## Acceptance criteria

- [x] C1. A landing from the merge queue delivers one report to the enqueuing session and to the item's claimant, in the item topic, naming the item, the landed commit and the batch.
  - done: impl-1503 · 2026-10-31T14:47:12.160Z
- [x] C2. A test enqueues an item from a fake Coordinator session, lands it through the queue and asserts exactly one delivered landing report. Before the fix, the test asserts that none arrived.
  - done: impl-1503 · 2026-10-31T14:47:12.259Z

## Comments

### impl-1503 · 2026-10-31T14:45:23.340Z

Consumer audit: landing notice adds an ordinary report, no reply/schema changes. Producers: dispatch.ts batch land callback, TaskMerges.merge result and merge-batches.ts retry/completion flow. Consumers searched by task-merged, merge-batch-result, MergeQueueEntry, noticeTo, BatchBoundary.land across hub/web/nvim/shared tests, qa/briefs, docs and .agents: batch reports and suite/accounting reports unchanged; CLI merge replies, queue/snapshot readers and legacy wire shapes unchanged. Existing HubCore.noticeTo owns durable message/delivery deduplication. Test seam per C2: projectHub public merge frame with fake Coordinator, fake executor and sealed landing boundary.

### impl-1503 · 2026-10-31T14:48:46.742Z

Consumer audit correction M1: frozen help composition in hub/test/fixtures/cli-usage/commands.json is also an owning consumer of MERGE_USAGE (cli-usage-fixture.ts composes exports.json and help.txt). Updated only that row after complete compatibility and native help guards reproduced red. Green compatibility 1/1 and native help 5/5; command-help 18/18 and native usage-merge 2/2 pass. All local macOS, isolated native help/Git roots, no browser.
