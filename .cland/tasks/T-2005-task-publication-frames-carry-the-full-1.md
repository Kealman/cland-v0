---
id: T-2005
kind: task
title: Task publication frames carry the full 1,650-item layer map each, so a status-changing comment still costs about 7 s of CPU after T-2004
state: closed
status: done
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
updated: 2026-11-26T19:19:12.708Z
closed: 2026-11-26T19:19:12.708Z
---

## Summary

T-2004 made the hub responsive during a status-changing comment on a planned-stage item (`task.view` went from 5.3 s to 0.22 s on its fixture) by chunking and yielding. The total CPU only fell from 9.16 s to 7.05 s per such comment, though. In its measurement (impl-2004, A-21737 and topic-1656, 2026-11-19 11:19Z), most of the remaining cost is generating and sending 900+ legacy task frames, each carrying the full 1,650-item visibility layer map, to 21 subscribers.

## What to build

Cut the per-frame cost: send a layer map delta or one map per batch rather than the full map in every task frame, with capability negotiation so legacy clients keep working. Measure hub-only CPU on T-2004's fixture.

## Acceptance criteria

- [x] C1. On T-2004's fixture, the hub's work per status-changing comment (map entries compared and serialized, bytes encoded) falls by at least half against T-2004's merged code, proven by work counts (test), with a hub-only CPU sample recorded as evidence.
  - done: impl-2005 · 2026-11-25T14:27:24.538Z
  - verified: rev-40 [reviewer] · run rev-40-20261126-2005-final · 2026-11-26T02:27:38.532Z · commit 6b07cc81e59ff5501a0e9c6f097671ba9e70a68e
- [x] C2. Clients that don't negotiate the new shape receive frames byte-identical to today's, kept by a previous-shape regression (test).
  - done: impl-2005 · 2026-11-25T14:15:26.130Z
  - verified: rev-40 [reviewer] · run rev-40-20261126-2005-final · 2026-11-26T02:27:38.532Z · commit 6b07cc81e59ff5501a0e9c6f097671ba9e70a68e

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

### rev-40 · 2026-11-25T14:28:57.310Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-2005-source2
commit: 6b07cc81e59ff5501a0e9c6f097671ba9e70a68e
scope: full
findings: [{"severity":"low","text":"L1: encodedBytes diagnostic still labels all-interval JSON as task/map bytes and quotes historical partial64,062,183 rather than corrected matched66,743,717;32M bound remains valid.","file":"hub/test/item-summary-scale.test.ts","line":203}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear with low L1; A-23480 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23480-t-2005-correction-source-clear-at-6b07cc81e.md). M1 corrected complete-interval counting with literal71-byte/2-entry omission control. M2 A-23477 independently binds matched source manifests/admissions/runner/native exits/raw TAP: only core/ring differ, both production hashes and identical fixture/counter match stated heads; stable before/after. Baseline1/5pass1fail remains red; changed0/6pass. Entries2,989,800->201,300, JSON66,743,717->9,332,782; scoped publishTask CPU891,699->282,195us, not whole-comment/wall/gate. Prior incomplete A-23459 retained. Legacy exact wire/replay and full/slim policy unchanged. C1/C2 final marks await exact-head configured and required consumer receipts. Low stale diagnostic is XS Bugs follow-up for lead, not blocker. Local46/static0 scoped; no full graph/browser/T3/T4 proof. Human midnight/Coordinator hold retained. Reviewer made no edits or executions.

### rev-40 · 2026-11-26T02:27:38.532Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261126-2005-final
commit: 6b07cc81e59ff5501a0e9c6f097671ba9e70a68e
scope: evidence
findings: [{"severity":"low","text":"L1 retained: complete-interval JSON diagnostic still says task/map bytes and historical partial64,062,183; correct matched baseline66,743,717 leaves32M gate valid.","file":"hub/test/item-summary-scale.test.ts","line":203}]
finding_counts: {"high":0,"medium":0,"low":1}

Final clear with lowL1; C1/C2 verified. A-23531 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23531-t-2005-final-clear-at-6b07cc81e.md). Exact-head ea8d68ef/A-23530 passed, canonicalba9844b9 executable match. Scale case pass executes final receipts/work bounds, records201300/201300entries and9329107all-intervalbytes; literal71-byte/2-entry control and previous-wire replay pass base+5/5. Ring5 and client/projection17/3/4/10/1 pass. Independently bound macOS A-23477 matched counts/CPU retained; Linux single CPU is not a cross-platform speedup. T0/T1/fallbackT2/246selectedT3/one mappedT4 base/Web exit0; Linuxc8nyc1 workers2 Node24.21/Nvim0.12.5 HeadlessShell1248/CfT156 noncached,12prerequisite skips. OtherT3 batch/otherT4/repetitions unexecuted; budgets advisory. Low diagnostic follow-up remains, no high/medium findings. No Reviewer edits/executions.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-26T19:19:12.708Z

Merged 768cc3cf200c834fb3d67f732632b29349592ba6 onto dev.
