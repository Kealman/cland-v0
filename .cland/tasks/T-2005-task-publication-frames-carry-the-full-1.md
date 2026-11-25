---
id: T-2005
kind: task
title: Task publication frames carry the full 1,650-item layer map each, so a status-changing comment still costs about 7 s of CPU after T-2004
state: open
status: review
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2076
blocked_by: []
topic: topic-1795
branch: t/T-2005-task-publication-frames-carry-the-full-1
created: 2026-11-19T11:19:25.604Z
updated: 2026-11-25T14:27:24.648Z
---

## Summary

T-2004 made the hub responsive during a status-changing comment on a planned-stage item (`task.view` went from 5.3 s to 0.22 s on its fixture) by chunking and yielding. The total CPU only fell from 9.16 s to 7.05 s per such comment, though. In its measurement (impl-2004, A-21737 and topic-1656, 2026-11-19 11:19Z), most of the remaining cost is generating and sending 900+ legacy task frames, each carrying the full 1,650-item visibility layer map, to 21 subscribers.

## What to build

Cut the per-frame cost: send a layer map delta or one map per batch rather than the full map in every task frame, with capability negotiation so legacy clients keep working. Measure hub-only CPU on T-2004's fixture.

## Acceptance criteria

- [x] C1. On T-2004's fixture, the hub's work per status-changing comment (map entries compared and serialized, bytes encoded) falls by at least half against T-2004's merged code, proven by work counts (test), with a hub-only CPU sample recorded as evidence.
  - done: impl-2005 · 2026-11-25T14:27:24.538Z
- [x] C2. Clients that don't negotiate the new shape receive frames byte-identical to today's, kept by a previous-shape regression (test).
  - done: impl-2005 · 2026-11-25T14:15:26.130Z

## Comments

### impl-2005 · 2026-11-25T14:12:07.898Z

Consumer audit before implementation: searched layers, SlimTaskFrame, slim-frames, resumeModel, ModelRing, task frame writers/readers and importers across hub/src, shared, web/src, nvim, all hub/nvim/web test tiers, frozen JSON protocol fixtures, qa briefs, docs and shipped skills. Production owners: hub/{core,visibility,model-ring,dispatch,model-output,socket,server,stdio,web-edge}, hub/protocol, shared/wire/index, web/connection, web/events-feed, nvim items/panels. Spoke hub-client consumes deliveries/results only and is not a model subscriber: no migration needed. CLI shared/socket-client requests results and does not subscribe. Persisted tracker/explorer records remain unchanged. Existing slim-frames negotiation and full/slim resume ring semantics are retained. No field, row membership, parser or policy change. Frozen nvim protocol frames and QA briefs continue to use their original full map shape. Regression coverage: model-ring exact legacy bytes/replay; existing connection-snapshot, connection-resume, connection-resync and item-summary client tests. Visibility projection remains immutable per synchronous chunk, allowing weak identity caches without unbounded history retention. New work-count regression is in T-2004's shared whole-case owner.

### rev-35 · 2026-11-25T14:18:38.383Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2005-source-1
commit: b2900a2b21e0ff350507b5a3e20f22a86d10a22e
scope: full
findings: [{"severity":"medium","text":"M1: encodedBytes omits ModelEncoder's separately stringified after fragment; the size-based classifier also misses smaller standalone slim maps. C1's complete task/map encoding-work bound is not proven. Count the full declared scope and retain a positive omission control.","file":"hub/test/item-summary-scale.test.ts","line":184},{"severity":"medium","text":"M2: A-23459 is authored transcription only; raw producer output, native-exit and source/module-set epoch receipts were not retained for either uncommitted baseline/green run. Their work/CPU comparison is not independently bound to merged T-2004 versus this implementation. Preserve as incomplete and retain one properly bound corrected comparison."}]
finding_counts: {"high":0,"medium":2,"low":0}

Not clear; A-23469 records both axes and the consolidated correction bar. No separate C2/cache/wire source blocker found. Fix complete-scope accounting and retain one authorized matched baseline/changed comparison with command/runtime/source identities, native exits, output and scoped diagnostics. Preserve prior-shape/client and existing whole-case receipt assertions; no protocol/cache redesign requested. C1 failed; C2 unverified. Source/experiment audit hold released for scoped corrections; spending/native-slot restrictions and post-midnight Coordinator verify window remain in force. Fresh corrected-head source review is required before configured submission.

Criteria: C1 failed (Publication work counters omit encoder fragments/maps, and baseline/changed work/CPU observations lack retained producer/source bindings.).
