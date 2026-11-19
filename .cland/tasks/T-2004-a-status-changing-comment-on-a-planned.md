---
id: T-2004
kind: task
title: A status-changing comment on a planned-stage item blocked the hub loop for about 19 s after a 1,627-item explorer refresh
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1656
branch: t/T-2004-a-status-changing-comment-on-a-planned
created: 2026-11-19T10:54:30.279Z
updated: 2026-11-19T11:49:37.036Z
---

## Summary

Hub pid 72462 (db53a0cb9, restart #87) blocked its event loop for about 19 s at 10:52:33Z on 2026-11-19, ending in tracker-storage-stalled at 10:52:52.376Z and a 23,146 ms `task.comment`. The call was rev-39's small not-clear verdict on T-1728 (about 2.4 KB body), which also marked C1 failed and moved the status from review to in progress. In hub.log (read by v0-6a; hub.db untouched): a stage-ancestry visit for head 3ead64f1a at 10:52:32.204Z; the comment starts at 10:52:32.785Z; explorer-recomputed for 1,627 items at 10:52:33.034Z (durationMs 9.6); then no line at all until 10:52:52.363Z. The recompute itself is fast, so the 19 s went into synchronous work after it, possibly announce or stage-cover dependents for E-1883's plan stage. A second stage-ancestry visit at 10:52:55Z didn't block.

## What to build

Name the owner of the 19 s synchronous block with a CPU profile or per-step timings on a fixture that reproduces a status change on a planned-stage item at production scale. Then make that path bounded or yielding, as T-1952 did for the freshness announcements.

## Acceptance criteria

- [x] C1. The blocking owner is named with evidence: a profile or per-step timing on a fixture that changes a planned-stage item's status with a status-and-verdict comment at about 1,650 items (evidence).
  - done: impl-2004 · 2026-11-19T11:28:32.246Z
- [x] C2. On that fixture, a `task.view` request issued during the status change answers within 2 s, red on the current code (test).
  - done: impl-2004 · 2026-11-19T11:49:37.036Z

## Comments

### impl-2004 · 2026-11-19T11:17:00.554Z

Consumer inventory before finalizing publication path: Tracker.#announceBatch callers are Freshness settled and #tipsMoved. Tracker.onChange consumers: hub/server (publishTask with publishTaskBatch wrapper), hub/dispatch (presence/work), hub/merge-queue (reconcile), adapters/sessions (verifier/claim ownership), and tracker/component tests. Frame consumers searched by task, layers, frame/event type and publication function names across hub/src, web/src, nvim/lua, shared/wire, hub/mod, all hub/test and nvim/test tiers, docs, qa and shipped skills: web connection.ts and browser-notifications.ts; Neovim init.lua/items.lua; CLI socket-client/events follow plumbing; spoke hub-client; mod bridge hooks consume delivery/message frames rather than raw task summaries. ModelRing/replay and full/slim numbered clients retain their existing task frame format; no field/schema/text changes. Existing item-summary, model-output/ring, visibility, events, mod-bridge, web connection and Neovim task fixtures cover these clients. QA/skills have no announcement-batch API caller. The new regression retains a full legacy task subscriber while additional clients acknowledge subscription then drain native bytes. C1 baseline diagnosis: A-21737. No source review requested yet.

### coord · 2026-11-19T11:22:32.868Z

Follow-up after landing (impl-2004, 2026-11-19 11:21Z): the new 1,650-row scale fixture spends about 11 s in setup and cleanup. Adapt it to T-1988's cheap synthetic tracker fixture helper once T-1988 lands, and drop the 40 s C-216 allowance with it. Track it under T-2005 or as a Tech debt item when T-2004 closes.

### rev-35 · 2026-11-19T11:38:27.720Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2004-source-1
commit: 691e280be970d133aa4750aca5e302e7ca73346a
scope: full
findings: [{"severity":"medium","text":"Standards M1: the new 1650-row regression uses raw TestContext for guard installation, seed/Store/hub/client acquisition and its enclosing body. Resource hooks do not fence/join the original setup and observed/secondChange/tail/comment continuations; scheduleTips.poke also discards read() ownership. Guard restoration is not gated on positive hub/resource closure after rejected cleanup. Enroll a whole-case owner before acquisition, separately bound setup, retain/join all original work and late acquisitions, and retain roots/seams/native guard until positive closure. Keep the exact latency, durable comment and mid-publication ordering assertions.","file":"hub/test/item-summary-scale.test.ts","line":74}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source NOT CLEAR at clean691e280be970d133aa4750aca5e302e7ca73346a/tree362c74ed, base1ae83dc7. A-21754 records1medium Standards finding, nohigh/low or additionalSpec issue. New1650-row raw-t case lacks enclosing admission/setup/body/original async joins; projectHub/tempProject resource owners are narrower, poke drops read() ownership and guard restoration lacks positive hub-close fencing. Leadc5eac69d confirms no other owner or disposition. Correct only the new case/necessary seams, preserve exact response, durable comment and second-write tail assertions. Production16-row hydration/publication chunks, synchronous Visibility scope cleared before yielding and unchanged legacy/full/slim wire shapes reviewed positively. T-1952 assertion migration explicitly checked: default1000-row fixture preserved, old4batches allowed<=4000row visits, replacement1000–2100 is tighter; retained original3/2052 vsfixed6/2058 and unchangedE2/R1source-once assertion preserved.40sC216 allowance matchesaf8e16c2/Nov26/projection, behavior2sunchanged; T2005 owns remainingfull-mapCPU/setupfollow-up. C1fixtureowner/profile evidence qualified, not exclusive historical attribution. A21737/A21747 andc5eac69d retain distinct16sparserred, finalidentical-fixture5349.336→219.715ms/CPU9158.659→7049.441ms scopes, intermediatefailed/incomplete rounds and unknownrootretention. All are precommit evolving epochs/no independent invocation/source/native hashes; no exact-head suite claim.112selectedT1/1192,46/47thenchangedscale5/5,finallint/typecheck0 are scopedlocalmacOSarm64/Node24.21 observations, not one combined green full batch. C1doneunverified,C2failed,nothingverified. Hold released; fresh pinned source review before configured window. Static Reviewer inspection only.

Criteria: C2 failed (The new scale regression lacks a pre-acquisition whole-callback owner joining setup, original observations and scheduled freshness work, with positive resource-close fencing of root/seam/native-guard restoration.).

### impl-2004 · 2026-11-19T11:47:02.683Z

M1 correction scope: only the new scale callback plus optional timeout on stageCase.wait. Whole-case owner precedes acquisitions; original detached view/tail/second-edit/poke work stays enrolled; raw sinks register a close event receipt; projectHub/inProcessSpoke partial resources register through owner.resources; explicit owner.close confirms positive closure before root/native-guard restoration. Shared helper consumer search: dev-t3-coverage-component, item-summary-scale existing serving case, stage-closure-component, startup-listener-scale (T3), startup-ready-component, suite-persistence. Their existing 5000 ms wait and cleanup bounds remain unchanged; only the new callback selects setup 15000 ms and detached observation 60000 ms. Existing actual refused Suites.close/native-guard retention control passed. A-21754 remains the authority for prior diagnostic epochs/provenance limits; no prior evidence is upgraded or reconstructed.
