---
id: T-1431
kind: task
title: tracker-summary's dropped-events test waits only 5 s for macOS to deliver a native FSEvents callback and fails on a busy Mac
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1206
branch: t/T-1431-tracker-summary-s-dropped-events-test
created: 2026-10-28T15:10:06.059Z
updated: 2026-10-29T18:48:28.680Z
closed: 2026-10-29T18:48:28.680Z
---

## Summary

`hub/test/tracker-summary.test.ts` "a healthy watcher with dropped events still indexes hand edits, additions and removals" (from T-1377) waits 5000 ms for macOS to deliver the native FSEvents callback it then drops ("native notifications deliberately dropped: not within 5000 ms", line 480). It failed in the E-1311 stage-2 macOS cover aadf5738 at 60ad6021 (A-13360, T1, peak load 8.99, fseventsd at about 90–125% CPU all afternoon). It passed 5/5 alone right after (coord, 2026-10-28 15:10Z). The rescan is mocked; only native delivery latency is bounded, by a guess. Same family as T-1427 (FSEvents latency on a busy Mac).

## Acceptance criteria

- [x] C1. The native-delivery wait is sized from measured FSEvents latency receipts under load, or replaced with a trigger the test owns, without weakening what the test proves (healthy watcher, events dropped, safety rescan indexes everything), with 10/10 under two workers plus CPU load on macOS.
  - done: impl-1431 · 2026-10-29T18:16:57.795Z
  - verified: rev-34 [reviewer] · run rev-34-20261029-1431-final · 2026-10-29T18:34:58.111Z · commit 5849789b175ea972b96afd503c03dc82d5559145

## Notes

Load flake under the flaky-rerun rule (first sighting; one cover resubmit). Regression candidate of T-1377.

## Comments

### impl-1431 · 2026-10-29T18:14:03.512Z

Scope: test-only at the existing public Tracker/watchFolder filesystem seam; no reply/schema/permission or production contract changes. Keep production watchFolder and safety timer; replace only fs.watch with a fixture-owned healthy event source, inject dropped notifications deterministically, and retain exact edit/add/remove/rename receipts plus final projections and watcher cleanup. Native FSEvents remains covered in tracker.test.ts. Red control: healthy source emits nothing, exposing the old 5 s native-callback dependency; green: explicitly deliver and drop events. C1 load proof pending exclusive macOS capacity from Coordinator.

### impl-1431 · 2026-10-29T18:17:42.511Z

Implementation pushed 5849789b175ea972b96afd503c03dc82d5559145. C1 done; targeted T1 file 18/18 and npm run typecheck green on macOS arm64/Node24.21.0. Required stress 10/10, two workers + CPU Worker, actual 2.139342 s; A-13923 contains native/TAP/CPU progress receipts; A-13925 documents red/green, setup-failure exclusion and exact timing scope. Source review requested from reviewer; verification waits on source clear. No per-item QA requirement.

### rev-34 · 2026-10-29T18:19:38.391Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1431-source1
commit: 5849789b175ea972b96afd503c03dc82d5559145
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13929: Standards/Spec source clear. Owned fs.watch callbacks retain healthy production watchFolder/safety timer, stale-before-interval and exact reconciliation/cleanup assertions. Original local A-13923 ten native passes/two lanes/one progressing CPU worker audited with raw head/CPU-exit capture limits; 0-test failed setup remains separate. C1 final runtime unverified pending exact-head configured evidence. No Reviewer execution or further stress run.

### rev-34 · 2026-10-29T18:34:58.111Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1431-final
commit: 5849789b175ea972b96afd503c03dc82d5559145
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13958: Original A-13957 confirms 4192 ordinary passes; required watcher case .031951091 s and retained durable reconciliation assertions. Separate original macOS 10/10 two-lane CPU proof/capture limits preserved from A-13929. C1 verified. Host reuse, report-only warnings, existing identity/no task load repetitions, absent T3/T4 retained. Coordinator owns integration/enqueue.

Criteria: C1 verified.

### coord · 2026-10-29T18:48:28.680Z

Merged ff60b359f16e0181ae1b679e4e437065f0f0aaa6 onto dev.
