---
id: T-250
kind: task
title: 'tracker-ready "ready and the merge gate agree … qa_default per-item=true": merge yields no result within 30 s under load'
state: closed
status: done
criterion_seq: 3
labels:
  - v0.1.1
  - ready-for-agent
  - tech-debt
assignee: impl-250
parent: T-230
blocked_by: []
topic: topic-159
branch: t/T-250-tracker-ready-ready-and-the-merge-gate
created: 2026-10-11T21:10:12.396Z
updated: 2026-10-12T00:50:07.238Z
---

## What happened

`hub/test/tracker-ready.test.ts`, case "ready and the merge gate agree on one fixture: stale patch, unchanged rebase, qa_default per-item=true", failed three times:
- In the integrated dev run at 7f12b6c (A-1390): `rebased gate accepts: not within 15000 ms (last error: no result for merge within 30000ms)`, at test line 146, after 62 s, peak load 19.4.
- In T-221's 6-worker run (A-1251), with the same message.
- Run alone on dev ef7c910 at 21:08Z while other suites held the machine: not ok. Three earlier solo timings were 44 s, 81 s and 63 s.

It passed in the integrated run at fdb8c5c (A-1363). The case drives a real `merge` through Git and the gate, and the merge call doesn't return within the 30 s RPC window when the machine is loaded.

## What to build

Find out whether the merge is slow because of load (real Git work plus the gate's preparation) or because something waits on a fixed delay or races. Make the case wait on an observable condition: the merge result or the journal's merge row. Don't lengthen timeouts and don't drop assertions. If a real slowness in merge preparation shows up, fix it or file it.

## Acceptance criteria

- [x] C1. The cause is identified, with evidence (timings of the merge phases under load).
  - done: impl-250 · 2026-10-11T23:12:45.411Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-250-1 · 2026-10-11T23:14:03.076Z · commit b529bfc25d2c7476bcebd05ed4194fa4563e7784
  - verified: rev-18 [reviewer] · run rev-18-20261011-250-3 · 2026-10-11T23:37:03.141Z · commit c7db08bb37b2a5450f46142673f48ec3966bb3f1
  - verified: rev-18 [reviewer] · run rev-18-20261012-250-5 · 2026-10-12T00:17:06.350Z · commit f85accd7be2d99c5a60fb38f1e0ee39103720466
- [x] C2. The case passes repeatedly under induced load (parallel CPU stress), recorded in an artifact, with assertions unchanged.
  - done: impl-250 · 2026-10-11T23:12:45.606Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-250-1 · 2026-10-11T23:14:03.076Z · commit b529bfc25d2c7476bcebd05ed4194fa4563e7784
  - verified: rev-18 [reviewer] · run rev-18-20261011-250-3 · 2026-10-11T23:37:03.142Z · commit c7db08bb37b2a5450f46142673f48ec3966bb3f1
  - verified: rev-18 [reviewer] · run rev-18-20261012-250-5 · 2026-10-12T00:17:06.351Z · commit f85accd7be2d99c5a60fb38f1e0ee39103720466
- [x] C3. `npm run typecheck && npm test` pass.
  - done: impl-250 · 2026-10-12T00:49:26.470Z
  - verified: rev-18 [reviewer] · run rev-18-20261012-250-5 · 2026-10-12T00:49:43.030Z · commit f85accd7be2d99c5a60fb38f1e0ee39103720466

## Comments

### impl-250 · 2026-10-11T23:04:29.825Z

Claimed at dev fa3a864; targeted true fixture running on Node 24.21.0. Will record phase timings under CPU load and preserve all gate/readiness assertions and existing timeout budgets.

### impl-250 · 2026-10-11T23:10:12.944Z

Cause isolated: scheduled 250 ms freshness polls accumulate refresh callers, keeping #readAgain set and starving merge's refresh. Deterministic controlled-Git regression fails before fix and passes afterward. Node 24.21.0 + 12 CPU workers: instrumented original fixture 82.919 s, final merge 28.278 s (gate 8.328 s; preparation 19.361 s, including 9.140 + 9.541 s freshness waits; landing 0.210 s; follow-up 0.358 s). Fixed fixture 13.554 s, final merge 2.249 s (gate 0.459 s, preparation 1.198 s, landing 0.220 s, follow-up 0.352 s). Coalescing scheduled calls fixes genuine gate-preparation slowness. The fixture now observes its correlated result within existing 15 s budget, retaining every assertion. Instrumentation removed; three clean loaded repeats of both QA configurations underway.

### impl-250 · 2026-10-11T23:12:45.855Z

Evidence A-1432 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1432-t-250-node-24-load-diagnosis-and-three-repeated-fixtures. Three clean consecutive Node 24.21.0 / 12 CPU worker runs passed both real-daemon fixtures, six cases total, with true timings 14.637/13.655/13.751 s and false 13.646/13.466/14.153 s. All 168 tracker-ready assertions identical to baseline. Targeted freshness file 6/6. Branch b529bfc25d2c7476bcebd05ed4194fa4563e7784 pushed to origin; fetched and merged origin/dev (already up to date). C1/C2 done; C3 pending managed all suite. QA policy is after-stage with no per-item QA criteria, so review only is required here. Correction to the first baseline comment: the linked worktree selected Node 25 from PATH; all recorded evidence in A-1432 explicitly uses Node 24.21.0, and exploratory Node 25 results are excluded.

### rev-18 · 2026-10-11T23:14:03.076Z

verdict: review
result: clear
by: rev-18 [reviewer]
run: rev-18-20261011-250-1
commit: b529bfc25d2c7476bcebd05ed4194fa4563e7784

No high or medium findings. Scheduled refresh callers share one in-flight read while foreground own-reread and resumed authorization semantics remain. Controlled-Git regression and raw Node 24 phase traces support freshness starvation as the cause. Three 12-CPU-worker repeats pass both QA configurations (six cases); all 168 tracker-ready assert lines independently confirmed byte-identical. Correlated merge observation retains the existing 15s deadline and retries only settled pending refusals. C1/C2 verified; C3 awaits exact-head managed full verification. Standards/Spec details: A-1433 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1433-t-250-review-at-b529bfc-freshness-starvation-and-load-evidence-clear.md

Criteria: C1 verified, C2 verified.

### rev-18 · 2026-10-11T23:35:30.594Z

verdict: review
result: not clear
by: rev-18 [reviewer]
run: rev-18-20261011-250-2
commit: b529bfc25d2c7476bcebd05ed4194fa4563e7784

Medium — hub/test/shards.json:49: landed T-129 launch-recovery.test.ts lacks classification, so positive manifest admission rejects the integrated tree before any test phase. Classify this process fixture machine or integrate the same correction; retain the lint. C3 fails from A-1441 (Node 24.21.0, typecheck pass, exit 1, no test totals). C1/C2 source/loaded diagnosis marks are retained; no failure of the freshness fix is established. Details: A-1442 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1442-t-250-c3-blocked-by-missing-integrated-shard-classification.md

Criteria: C3 failed (A-1441 exits 1 before tests: launch-recovery.test.ts is missing from shard manifest; typecheck passes, full suites never run.).

### impl-250 · 2026-10-11T23:36:11.156Z

Admission fix committed separately as c7db08bb37b2a5450f46142673f48ec3966bb3f1: one machine classification line after launch-admission, matching Coordinator's identical integration fix. Node 24.21.0 manifest lint passes (5 free/117 machine files). Freshness code and targeted tests are unchanged from b529bfc; A-1432 remains applicable. Fetched/merged origin/dev before corrected full run (already up to date), pushed corrected head. A-1444 records correction; C3 pending fresh managed all run.

### rev-18 · 2026-10-11T23:37:03.142Z

verdict: review
result: clear
by: rev-18 [reviewer]
run: rev-18-20261011-250-3
commit: c7db08bb37b2a5450f46142673f48ec3966bb3f1

No high or medium source findings remain. The only change since b529bfc classifies the inherited launch-recovery fixture machine; all 122 test files now match the manifest (5 free/117 machine), preserving lint. Freshness/controlled regression/correlated merge source is byte-identical, so reviewed Node 24 phase and repeated-load evidence A-1432 remains applicable. C1/C2 freshly verified; C3 awaits a complete green exact-head managed suite. Details: A-1445 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1445-t-250-manifest-corrected-review-at-c7db08b-c1-c2-clear.md

Criteria: C1 verified, C2 verified.

### rev-18 · 2026-10-12T00:04:51.658Z

verdict: review
result: not clear
by: rev-18 [reviewer]
run: rev-18-20261012-250-4
commit: c7db08bb37b2a5450f46142673f48ec3966bb3f1

Medium — hub/test/launch-recovery.test.ts:122: recovered conversation retry fails with no rollout found. Initial relaunch follows launch acceptance without observing first turn persistence, while the fake requires a completed turn; this is a readiness hypothesis to reproduce, not a proven cause. C3 fails from A-1453 (typecheck pass; 1302/1303 hub; Neovim omitted; exit 1). C1/C2 marks retained; no defect in freshness coalescing established. Details: A-1459 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1459-t-250-second-c3-failure-retained-rollout-readiness.md

Criteria: C3 failed (A-1453 exits 1: launch-recovery.test.ts:122 fails no rollout found; 1302/1303 hub, Neovim not run.).

### impl-250 · 2026-10-12T00:15:52.509Z

Coordinator requested isolated launch-recovery comparisons and five historical repeats, then classified the no-rollout failure as a rare T-129 fixture race and filed it separately (decision 8d52ba85). A-1463 and A-1466 record all results. Current head f85accd7be2d99c5a60fb38f1e0ee39103720466 integrates origin/dev (including T-102/T-213/T-234), plus exact shared machine classification for termination-ownership.test.ts committed separately at 9728a5f. Integrated isolated launch-recovery passed 4/4; manifest lint 5 free/118 machine passed. Latest fetched/merged origin/dev before full submission; pushed current head. T-250 freshness implementation/regression/result fixture unchanged from b529bfc, load evidence A-1432 applicable. No T-129 test source changes. C3 remains pending a fresh managed all run; if only the separately filed launch-recovery case fails, report to Coordinator before re-running.

### rev-18 · 2026-10-12T00:17:06.351Z

verdict: review
result: clear
by: rev-18 [reviewer]
run: rev-18-20261012-250-5
commit: f85accd7be2d99c5a60fb38f1e0ee39103720466

No high or medium task-source findings. Original freshness/controlled regression/tracker-ready source is byte-identical to b529bfc; reviewed Node 24 phase/load evidence A-1432 remains applicable. New dev integration and machine entry leave all 123 tests classified (5 free/118 machine). A-1466 documents the separately filed recovery fixture investigation without establishing absence of an interaction. C1/C2 freshly verified; C3 awaits a complete green exact-head full suite. Details: A-1468 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1468-t-250-integrated-source-re-review-at-f85accd-c1-c2-clear.md

Criteria: C1 verified, C2 verified.

### impl-250 · 2026-10-12T00:49:27.016Z

Final managed full suite d49c08db-a6c6-4580-b581-87352067e301 passed at exact current pushed head f85accd7be2d99c5a60fb38f1e0ee39103720466: typecheck + all package suites, 1600/1600 passed, zero failures/cancellations/skips. Log A-1476 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1476-suite-d49c08db-a6c6-4580-b581-87352067e301-all-at-f85accd.log. Working tree clean; C3 marked done, clearing the earlier failed-suite mark. All acceptance criteria done; awaiting reviewer's exact-head C3 verification and hub ready event.

### coord · 2026-10-12T00:50:07.238Z

Merged 8fedc015f829561027525a8e7c54079fc7e9fff8 onto dev.
