---
id: T-1026
kind: task
title: Reduce the CPU of T-1003's 20,000-line incremental parse proof to fit the T2 budget
state: open
status: review
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1195
blocked_by: []
topic: topic-943
branch: t/T-1026-reduce-the-cpu-of-t-1003-s-20-000-line
created: 2026-10-20T19:23:30.653Z
updated: 2026-10-24T09:06:47.156Z
---

## Summary

The 20,000-line incremental-parse proof added by T-1003 takes about 6 s on a Linux droplet (5.7-6.3 s over five load runs), past the 5 s budget for a new T2 case; T-1003 carries a dated 8 s allowance owned by E-880 through 2026-10-27. Reduce its total CPU while keeping the deterministic caps and semantics it proves.

## Acceptance criteria

- [ ] C1. The case runs under its 5 s T2 budget in the task's mode-free verify on a Linux droplet and in five sequential local runs (timings in the ready report), with every deterministic cap assertion unchanged, its name unchanged, and the T-1003 allowance removed (test and receipts named in the item).
  - failed: rev-26 [reviewer] · 2026-10-24T08:50:44.250Z · note Mode-free Linux target timing5.490006315s exceeds explicit under5s criterion despite assertion-green overall run.

## Comments

### impl-1026 · 2026-10-24T08:37:36.849Z

Source ready at cfb1481e. Test identity unchanged: nvim/test/artifact-render.test.ts::a 20,000-line artifact yields to keys, bounds render work and caches the settled projection. Five sequential local macOS arm64 executions of that case alone passed: 2.154896583, 2.120323208, 2.675758292, 2.028385292, 2.083597958 s. These are actual top-level test durations, not Linux or load-gate evidence; all original cap assertions stayed unchanged (128 root extension rows, 64 injection regions, 256 work, 128 projected rows, 256 decorations). All samples create 6 parsers vs 201 in the pre-fix red control. Full artifact-render file: 14/14 pass. npm run check: pass; test lint in report mode, zero refusals. The exact T-1003 E-880 allowance is removed; no other allowance changed. Linux mode-free verification and C1 verification remain pending source review.

### rev-26 · 2026-10-24T08:38:26.585Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1026-source-1
commit: cfb1481e501951bcd912f324f80e1cddb365dbae
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; both axes/no findings in A-10550. Original identity, 20,000 lines and every deterministic cap/final semantic assertion retained. Per-language parser reuse clears snapshotted prior descendants before each <=64-region batch; normalized input shared, fresh shallow option copies preserved. New <=6 creation guard and 65-fence differential text/style/link oracle cover reuse. Only exact T-1003 allowance removed; baseline unchanged. Coordinator amended criterion requires ordinary Linux T2 timing under5s plus five standalone local samples, no re-triggered Linux load gate. Local check14/14/five timings are reported, originals pending final audit. Proceed with exact-head mode-free verify; C1 stays unverified until Linux receipt and local raw provenance reviewed. Preserve original stdout/exits/timings/source identity durably without transcription reruns. No Reviewer runtime/edits/delegation.

### rev-26 · 2026-10-24T08:50:44.250Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-1026-evidence-1
commit: cfb1481e501951bcd912f324f80e1cddb365dbae
scope: evidence
findings: [{"severity":"medium","text":"M1: A-10578 native target finish is pass at5.490006315s (line12377), exceeding C1's explicit under5s Linux mode-free requirement. Suite exit0/report-only budget does not establish this criterion. Further CPU reduction with unchanged name/fixture/caps, fresh source review and new configured receipt required.","file":"nvim/test/artifact-render.test.ts","line":165}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear, A-10580. Native2828ordinary/418files pass, noactual load repetitions; T1/allfallbackT2bothpackages/Web complete onLinuxc8lon1. Target5.490006315s missesC1; all14artifact cases/targetwork256rows128marks256parsers6assertions pass. Originalfive local same-head Darwin samples2.155/2.120/2.676/2.028/2.084s accepted fromA-10547/A-10551, but cannot replaceLinuxrequirement. Hostcheck reusednotremoterepeated; lint/budgets report-only,noT3T4/QAclaim. Lead acknowledges criterion unmet and further optimization; fresh source review before new verify. NoReviewer runtime/edits.

Criteria: C1 failed (Mode-free Linux target timing5.490006315s exceeds explicit under5s criterion despite assertion-green overall run.).

### impl-1026 · 2026-10-24T08:58:02.606Z

First Linux receipt bfeacdf8/A-10578 at cfb1481e: T1/T2/Web 2828/2828 ordinary assertions pass, but the exact native target timing is 5.490006315 s, above C1's requested 5 s. Executor: droplet c-8 lon1, linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5; budget mode report. C1 remains unmet, as evidence review rev-20261024-1026-evidence-1 records. No pass/ready claim. Further CPU investigation retains fixture/identity/caps; timer reuse and explicit prefix edit experiments were discarded after no material gain. RPC audit transfer compacted in WIP; decision pending on retaining all 20,000 lines with fewer repeated rich sections while explicitly proving every cap is still crossed.

### impl-1026 · 2026-10-24T09:06:13.954Z

Revised source f08e705122b677d15fa7398fbcc05c6d44dad748 / tree 64838985ce75e8a244aed07f07a28f710ba6a609 follows Coordinator decision 3577aafa: exactly 20,000 lines, 256 rich sections in eight distributed dense clusters including start/middle/end; all original cap assertions and test identity unchanged. Fully rich 65-fence recursive/context oracle unchanged. Local Darwin arm64 same-head standalone samples (all exit 0) in original A-10608: 0.658751500, 0.704180833, 0.675970167, 0.643990834, 0.643756959 s. Every sample: root 157 extensions / 20,000 rows (156.25x128); injected regions 3292 inline (51.44x64) and 261 Lua including first paint (4.08x64); 78821 extraction/projection steps (307.89x256); 20,000 applied and settled rows (156.25x128); 6400 decorations (25x256). Observed maxima still 256 work/128 rows/256 marks, and first paint viewport+4, key while pending, settled start/middle/end grids and zero-parser reopen pass. A-10606 records separate doubled-cap negative controls, each failing its original work/row/mark cap assertion; all mutations restored. Full file 14/14 and npm run check pass; lint report mode, zero refusals. Fresh full source review requested, explicitly requiring Reviewer agreement that proof strength is unchanged; Linux same-head timing still pending.

### rev-26 · 2026-10-24T09:06:47.156Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1026-source-2
commit: f08e705122b677d15fa7398fbcc05c6d44dad748
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Revised fixture source clear, A-10609. I explicitly agree required proof strength is unchanged under Coordinator3577aafa:20000rows/exactname/alloriginalcaps retained; eight32-rich-section clusters include0/1250/2499 and reach256work/128rows/256marks. Added lowerworkload guards retain large root/injection/work/projection/decoration margins; rich65-fence contextoracle unchanged. A-10606 separate512work/256row/512mark mutants each fail its ORIGINAL capassertion; restoredproduction unchangedfromcfb. CompactRPC retains every callback/allassertionfields, no samplesdropped. This intentionally reduces density/bytes, not a claim fullyrich20000linesmeetsnewtiming. C1runtimepending freshLinuxunder5s+fiveexactheadlocalreceipts; old5.490006315s remains failedprovenance. Proceedmode-freeatunchangedf08e7051. NoReviewer runtime/edits/delegation.
