---
id: T-1082
kind: task
title: A forced stage-closure recompute resolves ancestry for every historical cover candidate
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1215
branch: t/T-1082-a-forced-stage-closure-recompute
created: 2026-10-21T19:04:23.933Z
updated: 2026-10-29T19:24:33.447Z
---

## Summary

When a hub has to recompute stage closures without saved checkpoints, it resolves ancestry for every historical stage-cover candidate: about 1,200 `rev-parse` and 1,219 `merge-base` calls, taking about 63 s on a copied live tracker after T-1050 removed the demo diff-tree scans (impl-1050's diagnostic, 2026-10-21). Normal restarts use saved checkpoints and are not affected. A lost or invalidated checkpoint store, however, would hold stage covers pending for about a minute.

## Acceptance criteria

- [x] C1. A forced closure recompute on a copied live tracker resolves only the candidates that can still decide an open stage; the test asserts the ancestry work count (one deciding pair at 1,200 historical covers) and records the measured wall time as a diagnostic, not an assertion.
  - done: impl-1082 · 2026-10-29T19:11:34.950Z
- [x] C2. Closed stages keep their recorded closures, and no open stage's result changes, in a differential test against the current full recompute.
  - done: impl-1082 · 2026-10-29T19:11:35.177Z

## Comments

### impl-1082 · 2026-10-29T19:08:55.528Z

Seam agreed by Coordinator: Tracker plan/view component reads with injected Git facts, plus copied pinned live tracker. No shared contract/schema change: useVerify callback, StageCover, ItemView stages, saved StageClosure stay unchanged. Consumers searched: tracker #stageCurrent/#stagesOf/#stageCover, Suites.stageCovers, stage QA/closure/plan tests and startup-scale tests, web/nvim stage projections, shipped plan/QA guidance. Only evaluation order changes; final selection differential against prior eager algorithm and ancestry-call bound will be asserted.

### rev-32 · 2026-10-29T19:23:07.996Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261029-1082-source1
commit: 725c10be058afec73ea9638fea8aa8af746bb935
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14032 full source clear, Standards0/Spec0 findings. Newest-first paired selection preserves settled oracle/fallback choices; unknown deciding evidence remains pending, fresh settlements reschedule plans. Saved closure/snapshot/QA/rollback checks unchanged. Copied pinned24-item+1200history guard asserts selected pair,one unique ancestry pair and injected sub10s timing;16history differential plus old controls retained. Timing excludes native Git latency under agreed seam. C1/C2 runtime pending same-head configured result; no Reviewer execution.

### impl-1082 · 2026-10-29T19:23:55.687Z

Coordinator decision c0a671ad: removed <10s wall-clock assertion (frozen allowance remains 0), retained exact one ancestry pair with 1,200 historical covers and elapsed-time diagnostic. Per-file guidance updated. Touched component file re-run on darwin/arm64: 9/9 pass; diagnostic 16.9ms injected Git, excludes native latency. Fresh source review required before another verify submission.

### rev-32 · 2026-10-29T19:24:33.447Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261029-1082-source2
commit: d1b200c921e4e81a9a71f4e1f979df3c31ca5b67
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14035 full successor source clear; Standards 0 / Spec 0 findings. Coordinator c0a671ad revised C1; sole correction removes the new speed assertion and aligns guide, retains exact one-pair and semantic/reopen/differential guards. Frozen allowance zero and production unchanged. Old admission refusal ran no tests. C1/C2 remain runtime-unverified pending same-head configured receipt. No Reviewer execution.
