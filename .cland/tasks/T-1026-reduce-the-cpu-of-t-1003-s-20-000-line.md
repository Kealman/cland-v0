---
id: T-1026
kind: task
title: Reduce the CPU of T-1003's 20,000-line incremental parse proof to fit the T2 budget
state: closed
status: done
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
updated: 2026-10-24T09:23:34.593Z
closed: 2026-10-24T09:23:34.593Z
---

## Summary

The 20,000-line incremental-parse proof added by T-1003 takes about 6 s on a Linux droplet (5.7-6.3 s over five load runs), past the 5 s budget for a new T2 case; T-1003 carries a dated 8 s allowance owned by E-880 through 2026-10-27. Reduce its total CPU while keeping the deterministic caps and semantics it proves.

## Acceptance criteria

- [x] C1. The case runs under its 5 s T2 budget in the task's mode-free verify on a Linux droplet and in five sequential local runs (timings in the ready report), with every deterministic cap assertion unchanged, its name unchanged, and the T-1003 allowance removed (test and receipts named in the item).
  - done: impl-1026 · 2026-10-24T09:18:12.171Z
  - verified: rev-26 [reviewer] · run rev-20261024-1026-final-1 · 2026-10-24T09:18:23.896Z · commit f08e705122b677d15fa7398fbcc05c6d44dad748

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

### rev-26 · 2026-10-24T09:18:23.896Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1026-final-1
commit: f08e705122b677d15fa7398fbcc05c6d44dad748
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, A-10630; C1 verified. Fresh65945b4f/A-10627 exacthead Linuxordinarytarget1.787936153s<5s;2828ordinary/418files pass,noactualrepetitions. OriginalA-10608 fiveexactheadlocalDarwin samples0.658751500/0.704180833/0.675970167/0.643990834/0.643756959s allunder5. ExplicitA-10609 proof-strengthagreement retained:20000rows,256clusteredrichsections,alloriginalcaps/name/finalchecks,fullyrichcontextoracle unchanged; work256/rows128/marks256 maxima,157rootextensions,3292inline/261Lua,78821work,6400marks,6parsers. ExactT1003allowanceremoved; disclosed126285byteclusteredfixturetiming,notfullyrichperformanceclaim. Hostchecktree reusednotremotecheck; lint133/60/budgetsreportonly,T3T4/QA separate. Old5.490006315s remainsfailedpriorworkloadprovenance. Leadre-markedC1done/reportsfreshconflictcheck0cleanunchangedhead.

Criteria: C1 verified.

### impl-1026 · 2026-10-24T09:18:54.168Z

T-1026 ready report

Head: f08e705122b677d15fa7398fbcc05c6d44dad748
Tree: 64838985ce75e8a244aed07f07a28f710ba6a609
Branch: t/T-1026-reduce-the-cpu-of-t-1003-s-20-000-line
Test identity unchanged: nvim/test/artifact-render.test.ts::a 20,000-line artifact yields to keys, bounds render work and caches the settled projection.

Linux receipt: 65945b4f-fd7a-48fb-ae76-cbbf5cd25f42, A-10627. Native target time 1.787936153 s; all 14 artifact cases and all 2,828 ordinary assertions passed. Executor droplet c-8 lon1, cland-v0-32d4ea73, linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5, two workers; lifetime 563 s, cost $0.0391. Mode-free task fallback ran all T1 and T2 in both packages plus Web. Host check was reused at 03bb6a4d; not remotely repeated. Duration budgets and test lint are report mode. No actual five-load repetitions, T3/T4 or stage measurements are claimed.

Five sequential standalone local Darwin 27.0.0 arm64 samples at this exact head, each exit 0, preserved with original stdout/stderr in A-10608:
0.658751500 s
0.704180833 s
0.675970167 s
0.643990834 s
0.643756959 s
Local npm run check passed; targeted full artifact file 14/14 passed; test lint report mode, zero refusals.

Workload and unchanged original per-slice cap margins, observed in both the Linux receipt and all five local samples:
- Exactly 20,000 source lines and exactly 20,000 settled projected rows.
- Root: 157 continuous prefix extensions, 20,000 source rows / 128 per-extension cap = 156.25 times one extension.
- Injections: 3,553 regions in 58 batches, including first paint. Inline: 3,292 / 64 = 51.44 times the cap. Lua: 261 / 64 = 4.08 times the cap; the full document alone retains 256 Lua regions, four complete batches.
- Extraction/projection: 78,821 work steps / 256 = 307.89 times the cap.
- Applied projection: 20,000 rows / 128 = 156.25 times the cap.
- Decorations: 6,400 / 256 = 25 times the cap.
- Observed per-slice maxima still reach 256 work, 128 rows, 256 decorations.
- First paint still parses only viewport plus four rows; j and cursor movement occur while pending. Start/middle/end settled grids pass. Reopen creates zero new parsers (six before and after).

Coordinator decision 3577aafa authorized retaining all 20,000 rows with 256 rich eight-line sections. Eight distributed clusters of 32 rich sections preserve dense decoration pressure at start/middle/end; the remainder reuses short seven-line plain paragraphs with a blank boundary. Source bytes are 126,285; this timing measures that explicitly revised workload. The fully rich recursive/context oracle, including 65 nested Markdown fences crossing a batch boundary, stays unchanged by the density reduction.

A-10606 retains the original outputs of independent work512, rows256 and marks512 negative controls: each fails its respective ORIGINAL cap assertion. All mutations were restored. Source review rev-20261024-1026-source-2 / A-10609 explicitly agrees required proof strength is unchanged. Final evidence review rev-20261024-1026-final-1 / A-10630 verifies C1 at this head, no findings. C1 is marked done.

Production CPU reductions reuse injected-language parsers across batches, remove stale snapshotted descendants before reuse, normalize/split full input once, and directly copy span options. Harness avoids unused callback result allocations, repeated function classification and duplicate audit transfer. Every original deterministic cap assertion and semantic assertion remains.

Only the exact T-1003 E-880 allowance was removed from hub/test/durations.json. No other allowance or duration baseline was changed by hand.

Conflict check: fetched origin/dev a9a76af40386e214cdcc30efb7b7109cc5ba6b01; git merge-tree --write-tree HEAD origin/dev exited 0, candidate tree 5c1fb8698c198446a0b3d3718606ee3b85f17fa4. Task HEAD unchanged, working tree clean; no dev merge after review. Branch pushed to local origin; no merge performed. Coordinator owns enqueue. Stage Linux/macOS measurements remain landing evidence, as directed.

### coord · 2026-10-24T09:23:34.593Z

Merged 88d76b55477f48ea49f84aa909fc6e8bf60191f4 onto dev.
