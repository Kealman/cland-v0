---
id: T-1852
kind: task
title: The suite-timeouts inherited-pipe case still routes the hub's admission probes through its ps wrapper
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
regression_of: T-1851
topic: topic-1504
branch: t/T-1852-the-suite-timeouts-inherited-pipe-case
created: 2026-11-14T05:51:47.424Z
updated: 2026-11-14T08:36:23.203Z
closed: 2026-11-14T08:36:23.203Z
---

## Summary

`hub/test/suite-timeouts.test.ts` "verify reaps fast-exit inherited-pipe writers and preserves unrelated processes" (line 237) still installs its `ps` wrapper on the whole fixture hub PATH and waits on the periodic snapshot, the defect T-1851 removed only from the sibling case at line 340. It failed in the T-1849 + T-1851 local batch 6fe26f5d (A-19286, head ba94089e5, 1 worker): "fast pipe holder started after snapshot: not within 15000 ms" at :275 (18.7 s). The repaired sibling passed in the same run (8.2 s). The hub later ruled the failure flaky after green reruns, and the batch landed.

## What to build

Apply T-1851's repair to every case in suite-timeouts.test.ts that installs the `ps` wrapper or waits for "fast pipe holder started after snapshot". The hub and worker launch with the native `ps`; the deny-census preload redirects the worker's `ps` to the wrapper only after the fixture's armed receipt exists; the parent's explicit snapshot uses the wrapper's absolute path. Each case keeps its product assertions and gains the bounded failure-only diagnostics T-1846 added.

## Acceptance criteria

- [x] C1. Each affected case passes under a 3500 ms pre-arm delay on non-self `ps` probes, and the same delay applied to its previous global-PATH setup reproduces the unpublished-gate failure (test).
  - done: impl-1852 · 2026-11-14T05:57:59.228Z
  - verified: rev-35 [reviewer] · run rev-35-1852-final-1 · 2026-11-14T06:45:44.522Z · commit 12ff8f99133b3721052fbc457441eeb61336f6c7
- [x] C2. Every affected case passes five lone repetitions and one paired run on macOS, plus the task's mode-free verify, with its product assertions retained (test).
  - done: impl-1852 · 2026-11-14T06:45:05.546Z
  - verified: rev-35 [reviewer] · run rev-35-1852-final-1 · 2026-11-14T06:45:44.522Z · commit 12ff8f99133b3721052fbc457441eeb61336f6c7

## Comments

### impl-1852 · 2026-11-14T05:58:28.013Z

12ff8f991 pushed; origin/dev fetched/merged (already current) before first review. A-19299 retains old delayed red and diagnostic repeat, sibling global-PATH control, five lone greens per case and serial paired suite-command greens. All green source SHA256183d34fa; local darwin arm64 Node24.21, outer concurrency1 (tiny fake suite fixture config4). Actual diagnostic red gate=false/armed missing/snapshot=false/trap present; native cause 'hub stopped before worker admission completed'. All 15 run inventories14109→14109, set delta0; source hashes, native close0/null for green. Secret scan synthetic bearer positive matched first then declared outputs0 matches. Typecheck passed. C1 done; C2 targeted portion complete, mode-free verify pending source review. FullT3 merge batch/T4/Linux unexecuted.

### rev-35 · 2026-11-14T06:00:36.103Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1852-source-1
commit: 12ff8f99133b3721052fbc457441eeb61336f6c7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review clear, no findings. A-19300 records shared helper migration for both affected cases, unchanged native admission PATH, explicit parent snapshot/post-armed worker routing and preserved product-owned native-death versus denied-census preservation/warning/mute/successor assertions. Independent A-19299 reads confirm matching pinned source SHA256, five lone passes per case and serial paired2/2 each, native0/null; fifteen complete inventory pairs preserve identical14,109-name sets. Controlled reds retain actual unpublished-gate/trap/hub-stop outcome qualifications. Capture/scan/source-hash and targeted-only timing limits preserved. C1 targeted proof and C2 targeted portion supported; final C1/C2 pending exact-head mode-free generated case/file receipts. Broader T3/T4/Linux/stage separate; Reviewer read-only.

### impl-1852 · 2026-11-14T06:22:17.675Z

Exact reviewed-head33cf40be/A-19301 completed overall red6272pass/1fail. T0,T1,all fallbackT2,changedT3 green; both cases actual pass32738(7.3439995s),32758(8.242927292s),whole19-case file32791pass. Web sole failure hosts desktop 'uptime advances without a push: not within1000ms'35307; known T-1845 shared defect per Coordinator decision938ea9b1, who authorized exactly one unchanged-head resubmit. Local darwinarm64 Node24.21/Nvim0.12.5 workers1(Web2), HeadlessShell1248/CfT156.0.8078.4. Budgets/lints report-only; remainingT3/T4/Linux unexecuted. C2 pending green retry; no source change.

### impl-1852 · 2026-11-14T06:45:05.679Z

C2 complete: authorized unchanged-head retry a4968c82/A-19308 green6273pass0fail/cancel/skip. Exact reviewed12ff8f991 treef802df984b. Actual cases: inherited-pipe finish32739 pass10.344552833s (existing22.792s allowance); denied-census finish32759 pass8.239301458s; whole file32792 pass19cases. T0/T1/fallbackallT2/changedT3/Web completed localdarwinarm64 Node24.21/Nvim0.12.5 workers1(Web2), actual HeadlessShell1248/CfT156.0.8078.4. Duration/lints report-only; remainingT3 batch/T4/Linux unexecuted. A-19301 remains failed history for T-1845. A-19299 source-hashed delayed red/five lone+paired proofs retained; secret scan positive matched first,0 declared-output matches; all15 targeted inventory pairs unchanged14109names. Tree clean/unchanged; final evidence review requested.

### rev-35 · 2026-11-14T06:45:44.522Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1852-final-1
commit: 12ff8f99133b3721052fbc457441eeb61336f6c7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final C1/C2 verified on authorized same-head a4968c82/A-19308. A-19309 records independent6,273 base test/692 file positives, separate125 load test/file positives, zero negatives/skips. Both required fast-exit cases positive@32739/32759, all19 file cases positive with file@32792; source-hashed controlled reds and five lone+serial paired passes per case retained. First33cf40be/A-19301 stays red T-1845 history under item-specific Coordinator938ea9b1; this final verdict uses the new green receipt. T0/T1/fallback-all T2/changed T3/Web all exit0; local darwin arm64 Node24.21/nvim0.12.5, actual Headless Shell1248/Chrome156.0.8078.4. Advisory budget/capture/targeted-inventory limits preserved; full remaining T3/T4/Linux/stage separate. Source clean and unchanged, no findings; Reviewer read-only.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-14T08:36:23.203Z

Merged a6d8e538534933d80db4c7eb9e71c1f1b96a759c onto dev.
