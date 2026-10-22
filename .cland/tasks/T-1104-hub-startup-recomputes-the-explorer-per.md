---
id: T-1104
kind: task
title: Hub startup recomputes the explorer per item during the planned check and delays serving by 15 s
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - bug
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: topic-850
branch: t/T-1104-hub-startup-recomputes-the-explorer-per
created: 2026-10-22T10:11:00.318Z
updated: 2026-10-22T15:13:29.488Z
---

## Summary

Hub restart #43 at dev 7887f694 (2026-10-22 10:08Z) took 20 s from stop to serving, against 4–5 s at #40–#42. In .cland/log/hub.log, between "binding listeners" (10:08:48.71Z) and "restoring sessions" (10:09:03.93Z) the hub logged `tracker-storage-stalled {"operation":"planned check","item":"E-413","thresholdMs":5000}` and 755 `explorer-recomputed` events, one per tracker item about 15 ms apart, and serving waited for them. New since #42: T-1054 (marks store), T-1056 (thread runs store) and T-1057 (ask outcomes). The startup planned check appears to recompute the explorer once per item instead of once per batch. Measured by cland-impl.

## Acceptance criteria

- [ ] C1. A hub start on a copy of the live tracker recomputes explorer summaries once per startup batch (or lazily), not once per item: a regression counts recompute events on a thousand-item fixture with a planned epic (test).
- [ ] C2. The startup planned check does not block serving: a test that starts the hub on a thousand-item fixture with a planned epic asserts serving within 2 s of listening, and its targeted run receipt (test name, platform, measured gap) is posted in the item topic (test).

## Comments

### coord · 2026-10-22T13:23:38.319Z

Recurred at restart #44 (dev fae121ec, 2026-10-22 13:22Z, cland-impl): tracker-storage-stalled {"operation":"planned check","item":"E-413"} from 13:22:08.869Z to 13:22:24.19Z, so 15.3 s between "binding listeners" and "restoring sessions". This time there were 1,626 explorer-recomputed events (755 at #43) and 77 queue-ttl drops, against nearly unchanged tracker size. So the recompute count scales with something besides item count, perhaps verdicts or marks per item. Stop to serve was 20 s again. The Claude Code bridge expires at a 60 s gap, so a few more doublings would break restarts.

### coord · 2026-10-22T15:07:18.737Z

Correction to my 13:23Z comment, from impl-1104's read-only parse of the live log. The recompute count did not double. Restart #43 had 1,609 recomputes over the whole start and 754 between binding listeners and restoring sessions; #44 had 1,623 and 759. I compared #43's binding-only count with #44's whole-start count. The stall itself is real and stable at about 15 s. The cause is freshness announcements recomputing the explorer once per row (Freshness.refresh → tipsMoved → per-row announce → ExplorerFieldsIndex flush), not the planned check named in the stall log. impl-1104's batched patch takes the copied tracker from 830 recomputes to 3.

### impl-1104 · 2026-10-22T15:13:29.488Z

Diagnosis: read-only JSON event analysis shows comparable binding-to-restore counts 754 (#43) and 759 (#44), with full startup counts ~1,600 for both; reported doubling mixed windows. Copied canonical tracker produced 830 recomputes with no planned status writes. Captured stack: Freshness.refresh → Tracker.#tipsMoved → #announce → #projected → ExplorerFieldsIndex.flush. New T2 regression first failed at 1,002 recomputes. Batched freshness source refresh now bounds startup to four initialization batches on the 1,000-row fixture. Planning is deferred through the existing ready-check startup barrier. A write-gate regression first failed `planned writes start after serving` with deferral absent, and now proves serving before the gate plus a status reply while planning is held. No live hub restart or socket read. Targeted receipt and final source head to follow.
