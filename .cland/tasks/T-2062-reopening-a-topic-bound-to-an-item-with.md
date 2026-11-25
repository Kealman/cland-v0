---
id: T-2062
kind: task
title: Topic reopen, hub startup and every landing run a synchronous whole-tree stage-containment sweep (thousands of visits) that stalls tracker storage for over 5 s
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-2076
blocked_by: []
topic: topic-1756
branch: t/T-2062-reopening-a-topic-bound-to-an-item-with
created: 2026-11-23T02:29:26.297Z
updated: 2026-11-25T04:56:54.220Z
closed: 2026-11-25T04:56:54.220Z
---

## Summary

On 2026-11-23 at 02:28:25.7Z (hub #99), creating one prompt artifact in topic-1631 reopened that topic, which is bound to the closed T-1807. Within 15 s, hub.log shows 109 `event-announced` lines, as the topic's artifacts were re-shared, and 5,838 `stage-containment-visit` lines. A `tracker-storage-stalled` "watch poll" ran from 02:28:25.878Z to 02:28:31.104Z (5.2 s), and `events.list` answered slowly (5,706 ms). It recovered on its own. The Coordinator has used topic-1631 for implementer briefs for weeks, so each brief post likely repeats this burst. Reported by cland-impl.

The same synchronous sweep runs at hub startup (130,573 visit lines in 2 minutes after restart #102) and on every landing. On hub #103, after T-2084 moved the lint warmer off-thread, T-1917's landing at 18:55Z on 2026-11-24 caused a 5.1 s ready-check stall alongside 42,303 stage-containment-visit lines; it's now the main per-landing stall.

## What to build

Make the stage-containment sweep bounded and incremental, or move it off the request path, for every trigger: a topic reopen, hub startup and a landing. For a topic reopen, also don't re-announce artifacts that were already shared, or batch the announcements, and skip the whole-tree visit for a topic whose bound item is closed. Keep the reopen semantics (the topic shows as open with its history).

## Acceptance criteria

- [x] C1. Reopening a topic bound to an item with 100 or more shared artifacts completes without a tracker-storage stall and without re-announcing artifacts that were already announced (test, red before).
  - done: impl-2062 · 2026-11-25T01:52:12.208Z
  - verified: rev-41 [reviewer] · run rev-41-20261125-2062-final · 2026-11-25T03:19:29.161Z · commit 087688619cf1bad8bf6a631482d2de8748fb1fb2
- [x] C2. The stage-containment work triggered by a topic reopen is bounded or deferred off the request path (test).
  - done: impl-2062 · 2026-11-25T01:52:12.345Z
  - verified: rev-41 [reviewer] · run rev-41-20261125-2062-final · 2026-11-25T03:19:29.161Z · commit 087688619cf1bad8bf6a631482d2de8748fb1fb2
- [x] C3. A landing on a tracker with thousands of stage rows completes its stage-containment update without a tracker-storage stall, and the request path visits only the rows the landing affects (test, red before).
  - done: impl-2062 · 2026-11-25T02:13:33.788Z
  - verified: rev-41 [reviewer] · run rev-41-20261125-2062-final · 2026-11-25T03:19:29.161Z · commit 087688619cf1bad8bf6a631482d2de8748fb1fb2

## Comments

### coord · 2026-11-24T12:14:25.614Z

Seen again after hub restart #102, from cland-impl's hub.log reading on 2026-11-24. Between 12:06 and 12:08Z the hub logged 130,573 stage-containment and ancestry-visit lines, 95,516 of them in the 12:07 minute alone, plus 151 task-freshness-settled. This is probably the startup freshness drain over the 5 tracked heads. The same synchronous per-landing visit loop runs at startup, not only when a topic is reopened.

### coord · 2026-11-24T18:57:05.144Z

On hub #103, with T-2084's warmer already moved off-thread, this is now the main per-landing stall (cland-impl, 2026-11-24). The landing of T-1917 at 18:55Z produced a 5.1 s ready-check stall (18:55:32.1–37.2Z). In the same 18:55–18:57Z window the hub logged 42,303 stage-containment-visit lines, 17 stage-ancestry-visit and 7 task-freshness-settled. CPU burst to 100% and fell back to 19%; RSS was 1.53 GB. The second warmer pass ran in the child. So the synchronous stage sweep runs on every landing as well as on topic reopen and startup. Fix it per landing too: make the sweep bounded and incremental, or move it off the request path.

### impl-2062 · 2026-11-25T01:46:51.567Z

Consumer census: stage cover/containment consumers are Tracker stageCurrent, stagesOf, explorer and planned checks; Freshness settled/tipsMoved; dispatcher restored and changed suite cover binding; stage-closure-component, stage-qa, planned-stage, suite-stage-rules, suite-persistence, suite-stage-cover and stage-close scenario tests; docs/agents/issue-tracker and review-and-qa. Artifact retention consumers are HubCore move/publishArtifact, Store setTopicStatus/moveArtifacts, artifact lifecycle cleanup and chip subscribers; artifact-create-unit, artifact-lifecycle, artifacts, topic-model, topics-component, artifact-delete/folders and remote artifact tests. Wire and persisted shapes, help exports, frozen CLI bytes, skill examples and QA frame grammar are unchanged; no migration required. Reopen retention emits chip updates without new creation/sharing subscription occurrences. Containment uses existing pending cover semantics until background settlement.

### rev-40 · 2026-11-25T01:58:24.228Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261125-2062-source
commit: 984f5e0b2c4d616bfc511f751ea6dde4eed39b43
scope: full
findings: [{"severity":"medium","text":"Stage snapshots still synchronously traverse all member facts/ancestry/overrides on each projection, including unaffected stages; deferred-containment logs do not prove C3's request-path affected-row bound.","file":"hub/src/tracker/tracker.ts","line":2016},{"severity":"low","text":"Silent retention chip updates still enumerate/filter all subscriptions per artifact even though no announcement uses the result; keep context/subscription work inside the announce path.","file":"hub/src/hub/core.ts","line":1672}]
finding_counts: {"high":0,"medium":1,"low":1}

Source not clear. M1 medium tracker.ts:2016: #stageSnapshot still scans every member/fact/override synchronously, including unaffected stages; new containment-only observer cannot prove C3's row bound. Add snapshot reuse/invalidation and an independent snapshot-member work receipt with positive control. L1 low core.ts:1672: announce=false still performs avoidable per-artifact subscription scans. Implementer confirmed both in74acece2. C3 failed; C1/C2 remain unverified pending corrected-head evidence. Artifact-lifecycle expected-event migration is justified by its positive prior same-topic announcement and preserved bytes/chips plus A-2 create/share checks. Existing32-member containment scheduling/shutdown ownership otherwise source-consistent. No Reviewer runs or measured stall attribution. Standards/Spec A-23129: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23129-t-2062-source-not-clear-at-984f5e0b2.md.

Criteria: C3 failed (Synchronous stage-snapshot member scans remain outside the containment cache/counter; affected-row request-path bound is unproven (M1).).

### rev-41 · 2026-11-25T02:13:21.511Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-2062-source2
commit: 087688619cf1bad8bf6a631482d2de8748fb1fb2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings. Prior M1 snapshot scanning and L1 subscription scanning are resolved. Reviewed snapshot invalidation across source/removal/id rewrite/import, plans/parent changes, merge/publication receipts and dev-history settlement; deferred containment shares work and joins tracker cleanup. Independent snapshot/subscription positive controls and retained artifact lifecycle assertions match the corrected behavior. Standards/Spec detail: A-23156, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23156-t-2062-source-review-clear-at-087688619.md. C1/C2/C3 remain unverified pending exact-head configured execution evidence; this source pass claims no run-dependent criterion. Task readback still has the earlier C3 failed/unchecked mark; lead should restore done for the implemented correction. No Reviewer runs or edits.

### rev-41 · 2026-11-25T03:19:29.161Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-2062-final
commit: 087688619cf1bad8bf6a631482d2de8748fb1fb2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear. Run2fc4471a/A-23219 finished/passed at unchanged source-reviewed head; source-matching verification treeb88af794 checked. Both exact regressions have paired base pass+5/5 load and passing file finishes. Reopen control preserves120 shared artifacts/history with zero duplicate announcements/tracker reads and bounded subscription work; scale diagnostic restores0, landing affected1000/unaffected0, with separate synchronous containment, positive settlement and cache invalidation assertions. Artifact-lifecycle37, stage-closure11, planned-stage16, plan-gate9 and mapped T4 guard pass with file finishes. C1/C2/C3 verified; retained red controls A-23115/A-23152 keep their scope. T0/T1/all-fallback-T2/246 selected T3/one mapped T4/Web exit0; other T3/T4 unexecuted/deferred. Linux x64 droplet c-8 fra1, Node24.21, Neovim0.12.5, Chrome for Testing156.0.8078.4 Headless Shell1248, two workers;12 prerequisite skips retained, cache unknown, duration/lint advisories report-only. A-23220: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23220-t-2062-final-review-clear-at-087688619.md. No Reviewer run, live-data benchmark or real-browser QA claimed.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-25T04:56:54.220Z

Merged 14c7ad020034840c670c03bd3507e6e9b5782d06 onto dev.
