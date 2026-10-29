---
id: T-1422
kind: task
title: Dev T3 search calls a flaky file already-fixed on a green tip reached only through tracker commits
state: open
status: review
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1192
branch: t/T-1422-dev-t3-search-calls-a-flaky-file-already
created: 2026-10-28T10:16:48.937Z
updated: 2026-10-29T16:13:31.157Z
---

## Summary

The periodic dev T3 culprit search marks a failing file "already-fixed" on one green rerun at the dev tip, even when every commit between the red head and the tip is tracker-only. On 2026-10-28 search a396c52c (A-13191) reported web/test/items.test.ts "already fixed on dev at a7e17ddc". a7e17ddc only changes .cland/tasks, and the failure is T-1419's load flake (red twice at 95e764b1, green at 0988520d and a7e17ddc, 29–56 s each run).

## Acceptance criteria

- [x] C1. The search reports "already-fixed" only when a commit after the red head changes a non-tracker file; a green tip reached only through tracker-only commits is reported as an unconfirmed flake that names the red and green runs.
  - done: impl-1422 · 2026-10-29T16:08:45.004Z

## Notes

Evidence: A-13191, A-13192 (red rerun at 95e764b1), A-13198 (green at 0988520d), A-13199 (green at a7e17ddc). Related: T-1419.

## Comments

### impl-1422 · 2026-10-29T16:05:37.012Z

Rule 20 consumer inventory before edits: SearchBoundary/DevT3Search are instantiated in hub/src/hub/dispatch.ts and hub/test/dev-t3-search.test.ts; SearchReport/FileSearch is consumed by hub/src/hub/dev-t3-report.ts, dev-t3-search-component.test.ts and suite-soak.test.ts (including persisted dev-t3-searches metadata). Probe receipts are also consumed by dev-t3-probe.ts/tests. Repository Git seam flows through dispatch options and remote-fixture.ts. Searched all hub/web/nvim tests, shipped skills, docs/QA and startup probes for DevT3Search, SearchBoundary, SearchReport, already-fixed and verification-dev-t3-search. Preserve report/result/receipt wire shapes, use existing flake and inconclusive classes; add an optional repository-evidence callback with conservative missing-evidence behaviour. Existing checkpoint without tip regression retained. Docs: hub/README.md, docs/agents/tests.md and per-file guides; frozen implement skill text will be proposed in topic. No remote-platform spec behaviour is changed.

### rev-31 · 2026-10-29T16:13:31.157Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1422-source1
commit: d310dba98ab8f2b3ea7e55b91e6d7a65d4c94e82
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source1 clear: Standards 0, Spec 0. Commit-history ancestry/path evidence gates already-fixed; tracker-only/same-head green is unconfirmed flake naming both runs; absent/unknown facts and partial green remain inconclusive. Old unreported checkpoint reclassification, native edit/revert and production report controls reviewed. Additional unchanged suite-cover/merge-batches construction sites checked and unaffected. A-13770 records full audit and local-evidence limits. C1 final runtime verification awaits ordinary same-head configured receipts, including the changed T3 file. No Reviewer execution.
