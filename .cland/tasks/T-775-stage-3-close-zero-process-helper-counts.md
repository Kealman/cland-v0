---
id: T-775
kind: task
title: "Stage-3 close: zero process-helper counts outside contract, scenario and T3-header files, and measure T3 seconds and hub starts"
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - v0.1.4
  - verification
  - hub
  - tests
  - ready-for-agent
assignee: null
parent: E-677
blocked_by:
  - T-684
  - T-708
  - T-772
  - T-773
  - T-774
  - T-895
  - T-896
  - T-897
  - T-898
  - T-899
  - T-900
  - T-901
  - T-902
  - T-903
topic: topic-628
branch: t/T-775-stage-3-close-zero-process-helper-counts
created: 2026-10-18T04:49:35.780Z
updated: 2026-10-19T21:22:02.391Z
closed: 2026-10-19T21:22:02.391Z
---

## Summary

These are T-708's former C2–C4, run once the stage-3 migrations land: T-708, T-772, T-773 and T-774, on top of T-684's lint baseline and gate. Make the process-helper rule absolute, then measure the result. The C3 target is set from A-4961's projection: the conservative same-title moves reach about 2109 s, not the original 1800 s. The rest is a follow-up item.

## What to build

Zero the process-helper counts outside contract, scenario and T3-header lifecycle files in T-684's baseline, with the shrink tool. Then measure on a full run.

## Acceptance criteria

- [x] C1. The process-helper counts in the lint baseline are zero outside contract, scenario, T3-header and T4-lifecycle-header files (the T4 exemption T-901 added, e.g. orphan-servers-perf), and a planted `spawnSpoke` in a T2 file is refused, proved by the lint run and a lint test.
  - done: impl-775 · 2026-10-19T21:16:46.759Z
  - verified: rev-30 [reviewer] · run rev-20261019-775-final · 2026-10-19T21:17:01.244Z · commit 10ebf1267b67136d78fcdbfa70be4459c00ddddc
- [x] C2. A durations refresh from a green full run after the stage-3 merges shows T3 manifest seconds of 2150 s or less, recorded on this item with the per-tier totals. (D66: the measured value is recorded on this item and accepted for v0.1.4; reaching the target is studied later in E-880 under Ideas.)
  - done: impl-775 · 2026-10-19T19:25:10.188Z
  - verified: rev-30 [reviewer] · run rev-20261019-775-source · 2026-10-19T20:43:54.892Z · commit 10ebf1267b67136d78fcdbfa70be4459c00ddddc
  - verified: rev-30 [reviewer] · run rev-20261019-775-final · 2026-10-19T21:17:01.244Z · commit 10ebf1267b67136d78fcdbfa70be4459c00ddddc
- [x] C3. A spawn census against T-708's 150-start goal: not measured in v0.1.4, because the local census run starved the shared hub on the crew machine (2026-10-19 19:34–19:39Z, load 51). The measurement is carried into E-880 under Ideas (D66).
  - done: impl-775 · 2026-10-19T19:40:31.742Z
  - verified: rev-30 [reviewer] · run rev-20261019-775-source · 2026-10-19T20:43:54.892Z · commit 10ebf1267b67136d78fcdbfa70be4459c00ddddc
  - verified: rev-30 [reviewer] · run rev-20261019-775-final · 2026-10-19T21:17:01.244Z · commit 10ebf1267b67136d78fcdbfa70be4459c00ddddc

## Comments

### coord · 2026-10-18T12:21:44.278Z

Unclassified slowdown to measure here (coord, 2026-10-18 12:22Z, from impl-709). In T-709's verify d94b92f3, nvim/test/shell.test.ts took 66.9 s against a 48.6 s baseline, and explorer.test.ts 15.6 s against 10.4 s. Both are recorded-frame stub consumers and still T3 pending T-774. Their sources and the replay helper are unchanged since 5a9c0879. A plausible cost is the 11.6 MB, 4464-frame catalog, which is read and JSON-parsed once per stub process: shell has 85 cases, explorer 18. On a serial Mac run (A-5093) they took 37.8 s and 9.5 s. Measure producer against replay on one quiet machine, with catalog startup accounted separately. If the catalog parse dominates, a per-file catalog slice or a pre-indexed format is the fix.

### coord · 2026-10-18T15:58:30.149Z

Budget overruns in T-774's migrated T2 Neovim files (rev-30, A-5407/A-5408; report-only, no allowance added): thread generated rendering 15.759 s (also T-809), delayed history 2.640 s, rewrites 2.185 s; events-quiet keys/persistence 2.798 s; explorer preferences 2.622 s; whole files shell-component 36.949 s and thread 32.892 s against 30 s. Record them in the stage-3 close census, then either cut them (per-file catalog slices, as T-774 did for shell and explorer) or file one follow-up with the list.

### impl-775 · 2026-10-19T19:26:51.239Z

A-6408 records the corrected 40-file C1 per-helper count/disposition table (163 static sites; not runtime starts), four truthful lifecycle-header corrections and 36 pending migrations/policy decisions, plus the T-774 Neovim overrun debt for migration lanes. No migration performed in T-775. C2 source: A-6297/cd21226d full green at 1d81bd6e; refresh 595c7f01 and run-head tiers: T1 13.827949 s/81 files, T2 423.221029 s/160, T3 2356.811994 s/184, T4 120.126922 s/10, zero missing timings. C2 target miss 206.811994 s is recorded honestly and accepted under D66; E-880 holds the target study. C2 claimant done. C1 and C3 remain open; awaiting migration dispositions and Coordinator-cleared local census slot. test-lint: 32/32 pass, 0 fail/skip; typecheck and shrink lint pass.

### impl-775 · 2026-10-19T19:38:01.254Z

C3 remains OPEN. A-6441 retains the incomplete local census at 1d81bd6e: exit 143 after 446.19 s, peak 1m load 52.19, Node v25.6.1 (outside declared engines), default 4 workers. Partial canonical-helper count 64 across 17 attributed files; 36 coverage-gap file entries, zero truncated lines. Hub and Neovim coverage incomplete; do not compare 64 as a full-suite total to the 150 goal. Three reported failures occurred before interruption (two demo-release and one demo recorder recovery); no diagnosis or retry under load. Runner preserved five ambiguous-ownership PIDs; no manual signalling or fixture/worktree removal performed. Requested Coordinator direction for any later explicitly Node24/2-worker census. C1 remains blocked on T-895–T-903; source review not requested.

### impl-775 · 2026-10-19T19:40:31.668Z

C3 disposition supersedes my earlier partial-census comment: not measured in v0.1.4; the census run starved the shared hub on the crew machine. Coordinator decision 44c61115 confirms the deliberate SIGTERM stop during 19:34–19:39Z hub starvation and directs no restart. Under revised C3/D66, E-880 (Ideas) owns the later measurement. Partial census output is discarded as measurement evidence; A-6441 is withdrawn/archived. No partial process count or target assessment is claimed. Prepared detached worktree kept. C3 claimant done against the revised disposition. Source review continues to wait on T-895–T-903.

### impl-775 · 2026-10-19T20:42:05.888Z

Source review requested from reviewer at pushed head 10ebf1267b67136d78fcdbfa70be4459c00ddddc (base c388c844, all migration blockers landed); assigned rev-30. A-6667 contains the final 485-file baseline/direct-call audit, full per-file CSV/JSON and reproducible script: all 341 non-exempt files are zero. Single nonzero T4 row: orphan-servers-perf/startDaemon 1 under the authorized T-901 exemption now reflected in C1. Six-file delta only: four lifecycle headers, T1 regression, baseline shrink adding 60 empty entries. Fresh merged-source tests 50 pass, no failures/skips; typecheck/lint/static/tiers and own-delta whitespace pass. Pre-push fetch/merge-tree clean. C2 and C3 done under their revised D66 dispositions (A-6408/A-6454). Awaiting source verdict before exact-head mode-free verify; no further dev merge after this first review unless Coordinator directs.

### rev-30 · 2026-10-19T20:43:54.892Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-775-source
commit: 10ebf1267b67136d78fcdbfa70be4459c00ddddc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, A-6674; Standards/Spec no findings. Six-file scope preserves lifecycle assertions/tiers and all old baseline counts; exactly 60 empty entries added. Independent manifest/baseline/header audit agrees with all 485 rows, 341 non-exempt zero-helper files, sole nonzero T4 orphan-servers-perf/startDaemon:1 under revised C1. Raw local 50/50 passes; new T1 planted-spawnSpoke refusal .001199083 s. C1 final runtime awaits exact-head mode-free gate. C2 verified under revised D66: independently recomputed accepted historical T3 2356.811994 s, gap 206.811994 s, not current-head timings/target attainment. C3 verified as explicit Coordinator stop/no-restart/not-measured disposition with E-880 owning later measurement; no partial census accepted. QA none; no Reviewer execution.

Criteria: C2 verified, C3 verified.

### impl-775 · 2026-10-19T21:00:52.491Z

Exact-head mode-free verify b572f618/A-6697 is red at 10ebf126. Hub base phase 1869 pass, zero failures. Only completed failure: migrated nvim/test/items.test.ts::recorded item frames render trees, map groups, details, board and edited files, load-gate repetition 4 (4/5 pass), ERR_ASSERTION line76 on the anchored Items panel/impl row match. Logged screen contains the row; cause not diagnosed. This file is outside this item's six-file source delta. C1 claimant done remains pending accepted verification. Reported blocker to lead T-775; awaiting Coordinator shared fix/disposition, no retry or head change. Droplet Linux x64, Node24.21.0/Neovim0.12.5; lifetime934s, cost$0.0648. C2/C3 source dispositions remain verified under D66.

### rev-30 · 2026-10-19T21:00:56.199Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-775-runtime
commit: 10ebf1267b67136d78fcdbfa70be4459c00ddddc
scope: evidence
findings: [{"severity":"medium","text":"Exact-head A-6697 is red: recorded item frames render trees/map groups/details/board/edited files passes ordinary but repetition 4 fails its row regex; load group is 4/5. Final gate requires lead/Coordinator disposition before diagnosis/fix/retry; no defect or flake attribution made.","file":"nvim/test/items.test.ts","line":76}]
finding_counts: {"high":0,"medium":1,"low":0}

A-6700: independently audited A-6697, ordinary1869/1869; 276/277 groups5/5, one Neovim item group4/5, zero tier/resource mismatches. Owned new lint regression ordinary+five pass, max .328408150 s; no owned trip. Source A-6674 remains clear and C2/C3 dispositions remain verified, but final C1 is withheld on the red mode-free gate. Failing file is outside source delta. Preserve receipt/head and obtain lead/Coordinator classification under rule11 before diagnosis/fix/retry. No Reviewer tests or census restart; QA none.

### rev-30 · 2026-10-19T21:17:01.244Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-775-final
commit: 10ebf1267b67136d78fcdbfa70be4459c00ddddc
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, A-6715. Direct Coordinator authorizes single unchanged-head retry after A-6697 external Items flake classification/T-909; first red/A-6700 retained. Independently audited A-6714/22cd7b4e:1869/1869, zero fail/cancel/skip/TODO, all277 groups5/5, zero resource mismatch/owned overrun. Owned T1 refusal ordinary+five max .262560445 s; prior failing Items ordinary+five now pass. Source A-6674 plus current gate settles C1. C2 retains revised D66 historical2356.811994 s accepted measurement, target miss disclosed; C3 remains explicitly not measured/no census restart under Coordinator decision. All C1–C3 verified; no current-head speed/census claim, no Reviewer tests; QA none.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-775 · 2026-10-19T21:17:02.918Z

C1 claimant done after accepted authorized retry 22cd7b4e/A-6714 exits0 at unchanged reviewed head 10ebf126. Ordinary receipts: 1869 pass, no failures/cancellations/skips; new owned lint regression ordinary plus 5/5 load passes; previously failing migrated item-frames case now 5/5. C1 source audit remains A-6667: 341 non-exempt files zero baseline and direct helpers; sole T4 row explicitly disclosed. First red b572f618/A-6697 remains recorded and was classified by Coordinator as unrelated T-902 flake owned by T-909; exactly one retry authorized and used. C2/C3 retain verified D66 dispositions. Reviewer final evidence settlement pending; no head/source change, dev merge or census restart. Green Linux x64 droplet Node24.21/Neovim0.12.5, 877s lifetime, $0.0609 cost.

### coord · 2026-10-19T21:22:02.391Z

Merged 0ca04fa34450a7dea17d2aabdf401688b3c4d47a onto dev.
