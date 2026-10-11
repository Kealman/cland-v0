---
id: T-174
kind: task
title: "Cut the hub suite's real-time waits: configurable test windows, full suite under 5 minutes"
state: open
status: review
criterion_seq: 4
labels:
  - tech-debt
  - ready-for-agent
  - high
assignee: impl-174
parent: T-216
blocked_by: []
topic: topic-119
branch: t/T-174-cut-the-hub-suite-s-real-time-waits
created: 2026-10-10T12:06:34.631Z
updated: 2026-10-11T09:26:48.663Z
---

## Parent

T-19 (follow-ups). From the stand-in's suite-queue analysis on 2026-10-10.

## What to build

The full hub suite runs 961 tests in 3172 s of test time, at concurrency 4: 10–14 minutes wall. 403 tests take 3 s or more. The slowest wait in real time:
- 65 s: equal events outside the sixty-second window;
- 36 s: session launch --item (twice);
- 33 s: doctor on a healthy project;
- then 27 s, 24 s, 20 s and more.

Cut the real-time waits without weakening what the tests check. Make windows and timeouts configurable for tests (an environment value, or an injectable clock), and set them short in the harness. Target a full hub suite under 5 minutes.

## Acceptance criteria

- [ ] C1. The slowest hub tests are shortened by cutting real-time waits and speeding up fixture and process setup and cleanup, with the same seams and assertions and no test skipped. Tests that stay above 5 s are listed with the reason.
- [x] C2. No production default changes; test-only knobs are documented in hub/README.md.
  - done: impl-174 · 2026-10-11T08:03:59.932Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-174-1 · 2026-10-11T08:07:57.946Z
- [ ] C3. The hub-phase duration is measured before (baseline A-1120: 999 s at peak load 19) and after at comparable load, recorded as an artifact, and is at least 40% shorter. Under 5 minutes stays the target, not the gate. Decided by the Coordinator 2026-10-11 07:55Z under the human's timing-only scope.
- [ ] C4. `npm run typecheck && npm test` pass.
  - failed: rev-13 [reviewer] · 2026-10-11T09:20:18.338Z · note All suite exit 1: hub 298/980 pass, 682 failures with repeated startup/private-brand errors; Neovim phase never runs.

## Notes

Size M. tech-debt.

## Comments

### impl-174 · 2026-10-11T06:27:36.293Z

Claimed. Timing-only scope: preserve every test/assertion and production default. First capture the unchanged dev baseline at concurrency 4 via the hub suite, then shorten configurable windows and remove waits only by observing the same readiness condition. Final current-dev suite will record before/after hub duration and load.

### impl-174 · 2026-10-11T07:57:44.305Z

Baseline A-1120/A-1122: hub 999.38s, full 1214.33s at peak load 19.14; 1391/1391 passed. Coordinator approved fixture/process timing optimizations and changed gate to >=40% faster at comparable load, under 300s as target. Boundary test was red with 300ms wait before its knob existed (1 event instead of 2), then green with the 250ms configurable window and identical assertions. Implementing per-phase Node compile cache and cheaper test-only process-table/cwd scans; ownership proof and all existing cleanup safety assertions retained.

### impl-174 · 2026-10-11T08:04:25.928Z

Implementation pushed at 3716cd7 (902d9e8 plus current origin/dev 343226b). Timing-only delta in 10 files; baseline and fixture-sharing assessment are A-1122/A-1124. Original assertions remain (worktree stdout comparison uses the same two CLI results in a parallel read-only pair). Added a clock-driven public-edge test proving the unchanged 59999/60000ms default boundary, green in 1.01s. Existing subscription-hygiene tests passed; the newly added test needed explicit role assignment in its fixture, now fixed and green. Review requested before final all suite; C1/C3/C4 wait for complete current-head timing and validation evidence.

### rev-13 · 2026-10-11T08:07:57.946Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-174-1
commit: 3716cd7ccc63db0f8ec1a34327aab8c6144dc52e

No high, medium or low implementation findings. Production event-window default remains60000ms; documented finite-positive test override and injected-clock59999/60000 boundary preserve it. Process cleanup ownership/start rechecks and whole-group/EPERM safeguards remain; original fault injector and CLI assertions retain their seams. Compile caching shares compilation only.

C2 verified at3716cd7. C1 retained assertions/seams inspected, but final >5s timings/reasons pending. C3 comparable-load >=40% hub improvement and C4 complete same-head suite remain unverified; final readiness withheld.

Independent typecheck/diff check passed. A-1125 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1125-t-174-review-at-3716cd7-retained-checks-and-c2-clear-timing-evidence-pending.md records both axes and baseline/targeted evidence. No exception applied.

Criteria: C2 verified.

### rev-13 · 2026-10-11T09:20:18.338Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261011-174-2
commit: 3716cd7ccc63db0f8ec1a34327aab8c6144dc52e

High — hub/test/harness.ts:310: hub fixtures repeatedly fail startup with private-brand errors ('Receiver must be class #roles/#topicStatuses/#items' and others), producing 682 hub failures. Cause is not yet established; this fails C4.

A-1151: typecheck completed; hub 298/980 pass, 682 fail, zero cancel/skip/todo; Neovim never starts, all exit 1. The 189-second failed phase cannot establish C3 improvement because most tests failed early. C1 final >5s reasons and C3 valid comparable-load timing remain pending; C2 same-head source review stands.

A-1152 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1152-t-174-c4-at-3716cd7-682-hub-failures-timing-comparison-invalid.md records the result. No exception applied; final readiness withheld.

Criteria: C4 failed (All suite exit 1: hub 298/980 pass, 682 failures with repeated startup/private-brand errors; Neovim phase never runs.).

### impl-174 · 2026-10-11T09:26:37.403Z

Corrected head 80f356acda29c3c23097ed61e547309ed545a1b5 pushed after merging origin/dev 0ed3774. Removed automatic compile-cache activation after minimal Node 24 cold/warm reproduction (A-1154); Coordinator filed T-220 for that fault. Timing cuts remain, no delta in harness.ts/run-suite.ts. Node 24 merged-head typecheck and both boundary tests pass. A-1156 supersedes the cache portion of A-1124 and retains the three-family sharing assessment. A-1151 failed duration is invalid evidence; requesting corrected-head review and a complete all suite.
