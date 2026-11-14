---
id: T-1851
kind: task
title: The suite-timeouts fast-exit fixture's ps wrapper intercepts the hub's own admission probes
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
regression_of: T-1846
topic: topic-1503
branch: t/T-1851-the-suite-timeouts-fast-exit-fixture-s
created: 2026-11-14T03:50:52.949Z
updated: 2026-11-14T05:51:42.517Z
closed: 2026-11-14T05:51:42.517Z
---

## Summary

`hub/test/suite-timeouts.test.ts` "verify reports unverified fast-exit pipe cleanup once…" installs its `ps` wrapper on the entire fixture hub's PATH. The wrapper therefore also intercepts the hub's own admission identity probes (`LocalExecutor.#start`, hub/src/executor/local.ts:96–102). When the wrapper is slow before the fixture is armed, admission fails with "cannot establish suite worker process identity", no gate is written, and the worker reports its gate deadline. T-1846 landed a snapshot-ordering repair and permanent failure diagnostics. The diagnostics then showed this cause in batch a52745fe (A-19260: armed missing, snapshotPublished false).

## Evidence

A controlled reproduction by T-1846's implementer (2026-11-14 03:48Z), with a 3500 ms delay on non-self `ps` probes before arming:
- old global-PATH setup: the case failed after 19.3 s, with admission outcome "cannot establish suite worker process identity" and the gate unpublished;
- narrowed setup: the case passed in 10.4 s, with native close 0 and no pre-arm wrapper receipt.

## What to build

The hub and worker launch with the native `ps` on PATH. The deny-census preload redirects the worker's `ps` to the wrapper only after the fixture's armed receipt exists. The parent's explicit snapshot uses the wrapper's absolute path. Every assertion of the case (unverified cleanup reported once, unrelated processes preserved, successor admitted, denied census, real reparent, ownership and mute) stays driven by the product's own observation.

## Acceptance criteria

- [x] C1. With a 3500 ms pre-arm delay on non-self `ps` probes, the case passes, and the same delay applied to the previous global-PATH setup reproduces the unpublished-gate failure (test).
  - done: impl-1851 · 2026-11-14T03:56:04.025Z
  - verified: rev-35 [reviewer] · run rev-35-1851-final-1 · 2026-11-14T04:22:57.253Z · commit e7b7dcdcae0b60dcc528bbf397d516a2d26ef9b6
- [x] C2. The case passes five lone repetitions and one paired run on macOS, plus the task's mode-free verify, with every product assertion retained (test).
  - done: impl-1851 · 2026-11-14T04:21:55.478Z
  - verified: rev-35 [reviewer] · run rev-35-1851-final-1 · 2026-11-14T04:22:57.253Z · commit e7b7dcdcae0b60dcc528bbf397d516a2d26ef9b6

## Comments

### impl-1851 · 2026-11-14T03:56:33.070Z

A-19274 retains controlled pre-arm 3500ms red (gate unpublished, non-self probe intercepted), five lone greens and serial two-file paired pass at source hash 2dc58017; local darwin arm64 Node24.21, targeted T3 only, all producers closed. Every inventory13501→13501 delta0; pre-existing preserved. Secret-scan positive control matched before zero-match declared-output scan. Source review requested at e7b7dcdca; mode-free verify pending source verdict; C2 not yet complete.

### rev-35 · 2026-11-14T03:59:38.419Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1851-source-1
commit: e7b7dcdcae0b60dcc528bbf397d516a2d26ef9b6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review clear, no findings. A-19277 records scoped post-armed worker ps routing, native admission PATH, explicit parent snapshot and unchanged product observation/assertion boundaries. Independent A-19274 audit confirms five lone plus serial paired passes, code0/signalnull, matching pinned source SHA256, controlled global-PATH red with unpublished gate/trap receipt and qualified actual error, and full retained inventory sets with zero task delta. Source-hash/launcher/capture/scan and timing limits preserved; no production/public-contract change. C1 targeted proof and C2 targeted portion supported; final C1/C2 remain pending exact-head mode-free verification and actual generated case/file receipt reconciliation. C2 intentionally not done yet. Broader T3/Linux/T4/stage evidence separate. Reviewer read-only.

### impl-1851 · 2026-11-14T04:22:07.710Z

C2 done: exact reviewed head e7b7dcdca mode-free local run5a47a4f2/A-19280 passed T0,T1,fallbackT2,changedT3,Web;6273pass0fail/skip/cancel. Actual named fast-exit finish pass8.197671583s; changed file19passing identities. darwinarm64 Node24.21/Nvim0.12.5,workers1 (Web records2),isolatedHeadlessShell1248/CfT156.0.8078.4. Budgets/lints report-only; remainingT3/T4/Linux unexecuted. Final evidence reconciliation sent to Reviewer. Targeted evidence A-19274 secret-scan positive matched first,zero declared-output matches.

### rev-35 · 2026-11-14T04:22:57.253Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1851-final-1
commit: e7b7dcdcae0b60dcc528bbf397d516a2d26ef9b6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final C1/C2 verified on same-head5a47a4f2/A-19280. A-19281 records independent6,273 base test/692 file positives, separate125 load test/file positives, zero negatives/skips. Exact fast-exit case pass@32762(8.197671583s); whole suite-timeouts file pass@32795, all19 cases pass once, product assertions retained. A-19274's source-hashed controlled global-PATH red, five lone passes and serial paired pass support C1/C2 with actual-error/launch/capture qualifications. T0/T1/fallback-all T2/changed T3/Web exit0; local darwin arm64 Node24.21/nvim0.12.5, actual Headless Shell1248/Chrome156.0.8078.4. Advisory budget/lint and targeted-only inventory scope retained; broader T3/T4/Linux/stage remain separate. Clean unchanged source, no findings; Reviewer read-only.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-14T05:51:42.517Z

Merged ab672226fb7b2de69f8ccfc99ac33114512a60eb onto dev.
