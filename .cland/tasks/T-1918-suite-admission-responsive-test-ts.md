---
id: T-1918
kind: task
title: suite-admission-responsive.test.ts awaits the fake executor-entry setup without its own named local bound
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1748
branch: t/T-1918-suite-admission-responsive-test-ts
created: 2026-11-16T16:19:25.881Z
updated: 2026-11-24T15:35:46.860Z
closed: 2026-11-24T15:35:46.860Z
---

## Summary

impl-1907 and the T-1907 final review (A-20239, nonblocking) found that `hub/test/suite-admission-responsive.test.ts` (around line 30) awaits the fake `LocalExecutor.start` entry receipt under the admission and output setup's wait, with no separately named bound. If that entry never comes, the file fails only at a broader bound, and the failure doesn't name the step.

## Acceptance criteria

- [x] C1. The fake executor-entry receipt has its own named load-scaled bound, independent of the admission and output setup, and a held entry fails with that bound's name (test, red before the fix).
  - done: impl-1918 · 2026-11-24T13:57:33.313Z
  - verified: rev-40 [reviewer] · run rev-40-20261124-1918-final · 2026-11-24T14:35:04.090Z · commit 18065de61e6c72fa8fed1e87d778170b4619f53a

## Comments

### impl-1918 · 2026-11-24T13:50:15.655Z

Confirmed C1 at the assigned fake LocalExecutor.start seam. Red before fix on macOS arm64 / Node v24.21.0: held-entry test expected /fake executor-entry setup: not within 200 ms/ but received 'pending'; file exit 1, other four T2 cases passed. Adding shared until setup wait, retaining tier and final durable-result/queue assertions.

### rev-40 · 2026-11-24T13:58:26.632Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-1918-source
commit: e24b5da7e8a3e14ff1aeb40458a8fe5a35eb1064
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear ate24b5da7e. Actual executor entry receipt now has independent `fake executor-entry setup` shared until deadline, default load-scaled setup policy; admission/output/final persisted failure/result/queue assertions unchanged. Pure held-receipt case uses injected clock100ms/factor2, proves pending at100 and named failure200, resolves hold in finally; no new native/FS acquisition. File guidance matches separate wait. A-22996 records both axes and A-22990 local5T2/17helperT1/red/static evidence limits. C1 unverified pending exact-head configured named receipts. No production/shared contract/tier change, no findings/reviewer runs/edits.

### rev-40 · 2026-11-24T14:01:11.537Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-1918-source2
commit: 18065de61e6c72fa8fed1e87d778170b4619f53a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized shared-fix delta clear at18065de61, per Coordinator e1372fef. Only suite-human-component changes; blobd7940f2e identical to canonicald28203f1a/T-2088 reviewed A-22994. Exact primary/secondary error identities and root/seam/repair/cancellation proof retained. Prior T-1918 entry-bound code/docs/source review A-22996 unchanged; no dev merge. A-23000 records both axes and explicitly authorized no-repeat-lint reuse; local changedT2 7/7 reported, not configured head proof. C1 pending same-head configured entry-bound/shared-case receipts. No findings/reviewer runs/edits.

### rev-40 · 2026-11-24T14:35:04.091Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-1918-final
commit: 18065de61e6c72fa8fed1e87d778170b4619f53a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear atunchanged18065de61. Exact-head12aaa64c/A-23024 finished/passed, canonicalc713d27b executable match. C1 verified: held-entry named/load-scaled base32249 plus5/5load32357, actual detached launch/result/queue case32257 and all5responsive basespass.17until/7shared-fix basespass, canonicalT2088case32868positive. T0/T1/fallbackT2/selectedT3/Webexit0;7processfiles100positive identities once, restT3batch/T4unexecuted;7520pass/1Mac-selector skip/0fail. NoncachedLinuxx64c8sfo2 workers2 Node24.21/Nvim0.12.5 HeadlessShell1248/CfT156.0.8078.4; budgets/lint advisory, fakeclock assertion not native latency measurement. A-23025 records both axes/limits. No findings/reviewer runs/edits.

Criteria: C1 verified.

### coord · 2026-11-24T15:35:46.860Z

Merged a177d474db53b80d8415d9c2bb792ce7a11737bf onto dev.
