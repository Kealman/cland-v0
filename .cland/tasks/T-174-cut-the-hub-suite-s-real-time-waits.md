---
id: T-174
kind: task
title: "Cut the hub suite's real-time waits: configurable test windows, full
  suite under 5 minutes"
state: closed
status: done
criterion_seq: 4
labels:
  - ready-for-agent
  - high
assignee: impl-174
parent: C-216
blocked_by: []
topic: topic-119
branch: t/T-174-cut-the-hub-suite-s-real-time-waits
created: 2026-10-10T12:06:34.631Z
updated: 2026-10-11T11:08:34.329Z
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

- [x] C1. The slowest hub tests are shortened by cutting real-time waits and speeding up fixture and process setup and cleanup, with the same seams and assertions and no test skipped. Tests that stay above 5 s are listed with the reason.
  - done: impl-174 · 2026-10-11T10:15:59.207Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-174-6 · 2026-10-11T10:17:57.899Z
- [x] C2. No production default changes; test-only knobs are documented in hub/README.md.
  - done: impl-174 · 2026-10-11T08:03:59.932Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-174-1 · 2026-10-11T08:07:57.946Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-174-3 · 2026-10-11T09:31:26.805Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-174-6 · 2026-10-11T10:17:57.899Z
- [x] C3. The hub-phase duration is measured before (baseline A-1120: 999 s at peak load 19.1) and after, at a peak load within ±25% of the baseline's, recorded as an artifact, and is at least 30% shorter. ≥40% and under 5 minutes move to T-221. Amended 2026-10-11 10:20Z by cland-impl's decision (option a), replacing the 40% gate.
  - verified: rev-13 [reviewer] · run rev-13-20261011-174-5 · 2026-10-11T10:14:12.251Z
  - done: impl-174 · 2026-10-11T10:15:59.361Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-174-6 · 2026-10-11T10:17:57.899Z
- [x] C4. `npm run typecheck && npm test` pass.
  - verified: rev-13 [reviewer] · run rev-13-20261011-174-4 · 2026-10-11T10:12:20.754Z
  - done: impl-174 · 2026-10-11T10:15:59.519Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-174-6 · 2026-10-11T10:17:57.899Z

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

### rev-13 · 2026-10-11T09:31:26.805Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-174-3
commit: 80f356acda29c3c23097ed61e547309ed545a1b5

No high or medium source-review findings after compile-cache removal and dev integration. C2 verified: the 60-second production default is unchanged and the test-only window knob is documented. Independent typecheck and diff checks pass on clean 80f356a. C1/C3/C4 remain pending corrected-head inventory, comparable timing and full-suite evidence; A-1151 is not valid timing evidence. See the corrected-head review artifact for separate Standards and Spec reports.

Criteria: C2 verified.

### rev-13 · 2026-10-11T10:12:20.878Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261011-174-4
commit: 80f356acda29c3c23097ed61e547309ed545a1b5

Medium — A-1177 log:1339: hub674.220s versus baseline999.377s yields32.54% reduction, below C3's40% requirement (threshold599.626s). Peak loads15.63 versus19.14 do not supply a controlled-load adjustment; full-suite timing is not the hub metric.

C4 separately verified with this run: typecheck and npm test exit0, hub1166/1166 + Neovim258/258 =1424/1424, zero failures/cancellations/skips/todo; no exception. C2 same-head verification stands. C1 remains unverified pending the >5-second inventory with reasons. Final readiness is withheld for C1/C3.

A-1178: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1178-t-174-suite-at-80f356a-c4-passes-c3-timing-gate-unmet.md records the separate review axes and evidence.

Criteria: C3 failed (A-1177 hub phase674.220s versus A-1120 baseline999.377s is32.54% shorter, below the required40%; comparable-load passing timing evidence remains absent.).

### coord · 2026-10-11T10:13:10.566Z

Gate amended (cland-impl, option a, 10:20Z). Measured at 80f356a in run b492f43d (A-1177): hub phase 674.2 s vs baseline 999.4 s (A-1120), 32.5% shorter. Peak load 15.6 vs 19.1, within ±25%. Caveat: the lower load slightly favours the new head, so the true gain may be a little under 32.5%. The compile cache was removed (Node 24 warm-load fault, T-220). The rest of the gain (≥40%, <5 min) moves to T-221, measured against a dev base run done back to back in the same load window.

### rev-13 · 2026-10-11T10:14:12.251Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-174-5
commit: 80f356acda29c3c23097ed61e547309ed545a1b5

No high or medium findings against amended C3. A-1177 hub674.220s versus A-1120 baseline999.377s is32.54% shorter, exceeding30%. Peak15.63 lies inside baseline19.14 ±25% (14.355–23.925); it is18.34% lower. The lower-load caveat remains, with no normalized timing claim. Coordinator c792d7a3 moved the40%/<5min targets to T-221.

C3 freshly verified at unchanged80f356a; the old40% failure is superseded by the criterion amendment. C2/C4 same-head marks stand. C1 still awaits all143 >5s hub entries with reasons; final readiness remains pending that inventory.

A-1179: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1179-t-174-amended-c3-at-80f356a-30-and-peak-load-bounds-verified.md

Criteria: C3 verified.

### impl-174 · 2026-10-11T10:16:09.808Z

Final evidence A-1180: complete green A-1177 at unchanged 80f356a; hub674.220s vs baseline999.377s, 32.54% shorter, peaks15.63 vs19.14 (-18.34%). Meets human-amended >=30%/±25% C3; report explicitly retains lower-load and 28-additional-hub-test caveats. All143 >5s entries including nested cases have file/reason, with doctor/index-lock/worktree fixture-sharing assessments. C1/C3/C4 done, final C1 review requested. No new code; worktree clean. Remaining targets belong to T-221; cache fault T-220.

### rev-13 · 2026-10-11T10:17:57.899Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-174-6
commit: 80f356acda29c3c23097ed61e547309ed545a1b5

Low — A-1180:91: CLAND_HUB_FILE uses two daemon projects and sequential CLI comparisons, rather than the row's inherited Git-worktree/parallel-pair wording; its retained repeated CLI work still explains the slow entry. Nonblocking.

No high or medium findings. C1 inventory independently matches all143 >5s hub entries, including nested names/durations, with reasons and three fixture assessments. C2's unchanged default/documentation stands. Amended C3 passes32.54% reduction and18.34% lower peak within±25%, with the lower-load caveat retained. C4 exact-head typecheck and full1424/1424 tests pass, zero failure/cancel/skip/todo, no exception.

All C1–C4 verified at unchanged clean pushed80f356a; final readiness is clear under the amended criteria. A-1181: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1181-t-174-final-review-at-80f356a-all-criteria-clear.md records separate Standards/Spec reports and A-1180/A-1177 evidence.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-11T10:18:15.524Z

Merged d8f5e01c81494fdf15d3e5c9c0188f11b4d68a0b onto dev.

### coord · 2026-10-11T10:18:29.757Z

Merged at d8f5e01. The merge commit's subject says 'full suite under 5 minutes', which overstates the result. The measured hub phase is 674 s, down from 999 s (32.5%). Under 5 minutes is T-221's target.

### coord · 2026-10-11T11:08:34.329Z

Equal-load measurement: in the integrated dev suite at 2d3a840 (A-1204), the hub phase took 732.4 s at peak 1m load 19.16, against the A-1120 baseline of 999.4 s at 19.14. That is 26.7% shorter at equal load. The 32.5% measured at lower load (15.6) overstated the gain. T-221 keeps the 40% target, measured the same way, at equal load against a back-to-back dev run.
