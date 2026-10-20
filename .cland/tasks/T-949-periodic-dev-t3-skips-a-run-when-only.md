---
id: T-949
kind: task
title: Periodic dev T3 skips a run when only tracker files moved since the last one (compare the verification tree, not the head)
state: closed
status: done
size: XS
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: topic-738
branch: t/T-949-periodic-dev-t3-skips-a-run-when-only
created: 2026-10-20T08:36:43.941Z
updated: 2026-10-20T11:41:05.544Z
closed: 2026-10-20T11:41:05.544Z
---

## Summary

The human, 2026-10-20 08:36Z in General, approved this for the post-release debt sweep (D76). The periodic dev T3 occasion (`[verification] dev_t3_every`) starts a run when dev's head differs from the last started run's head (hub/src/hub/suites.ts, around the dev-t3 scheduler). A tracker-only commit (`.cland/tasks`, `.cland/RULES.md`) moves the head without changing what is tested, so it can trigger a run of about 23 minutes and $0.10 that proves nothing new. The nightly soak already compares the tree.

## Acceptance criteria

- [x] C1. The periodic dev T3 compares the verification candidate tree (the shared exclusion definition of verification-tree.ts) with the last started run's tree, and skips when they are equal; a T2 test with a fake clock shows a tracker-only commit after the interval starts no run and a code commit does.
  - done: impl-949 · 2026-10-20T11:28:33.095Z
  - verified: rev-23 [reviewer] · run rev-20261020-949-final · 2026-10-20T11:36:45.566Z · commit f0e61c29cea6ba73abe567984e15440232eebec4
- [x] C2. docs/agents/tests.md and hub/README.md say the periodic run starts only when the tested tree changed.
  - done: impl-949 · 2026-10-20T11:28:33.837Z
  - verified: rev-23 [reviewer] · run rev-20261020-949-source · 2026-10-20T11:29:39.639Z · commit f0e61c29cea6ba73abe567984e15440232eebec4
  - verified: rev-23 [reviewer] · run rev-20261020-949-final · 2026-10-20T11:36:45.566Z · commit f0e61c29cea6ba73abe567984e15440232eebec4
- [x] C3. A mode-free `cland verify` at the reviewed head is green.
  - done: impl-949 · 2026-10-20T11:36:24.632Z
  - verified: rev-23 [reviewer] · run rev-20261020-949-final · 2026-10-20T11:36:45.566Z · commit f0e61c29cea6ba73abe567984e15440232eebec4

## Comments

### impl-949 · 2026-10-20T11:28:53.812Z

Implementation committed and pushed at f0e61c29cea6ba73abe567984e15440232eebec4. Both periodic eligibility comparisons now use the shared verification tree. C1/C2 done; fake-clock T2 regression was red at 2 != 1 and now passes; local targeted component/scheduler/clause checks, typecheck and lint passed. C3 intentionally remains pending until post-source-review mode-free verification. qaPolicy scope none/after-stage; no per-item QA required.

### rev-23 · 2026-10-20T11:29:39.639Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-949-source
commit: f0e61c29cea6ba73abe567984e15440232eebec4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Spec: both periodic checks compare stored last-started verification tree through shared SuiteCandidate, without new exclusions; clean/fetched-dev admission, cursor/interval and overlap rules preserved. Fake-clock T2 models changed metadata HEAD/same tree then changed code tree, retaining exact queued identities and completion observations. Matching docs/help/config/skill/clause pointers establish C2. A-7562 records full review; A-7561 targeted macOS component/scheduler checks are supplemental, not task gate/load proof. C1 runtime and C3 remain pending mode-free verification at this exact head. No item QA required.

Criteria: C2 verified.

### impl-949 · 2026-10-20T11:36:25.259Z

All claimant criteria done. Mode-free verification 51881e0e-9139-43f7-83c4-824651e93f38 is green at the unchanged source-reviewed head f0e61c29cea6ba73abe567984e15440232eebec4: T0–T2, all-T2 fallback across both packages; 2051 passed, 0 failed/skipped. Linux x64 droplet c-8 lon1, Node v24.21.0, duration budgets report-only; lifetime 350 s, cost $0.0243. This is task verification, not T3/integration coverage. Durable log A-7565: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7565-suite-51881e0e-9139-43f7-83c4-824651e93f38-auto-at-f0e61c2.log. Reviewer received same-head result automatically; awaiting final evidence verdict.

### rev-23 · 2026-10-20T11:36:45.566Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-949-final
commit: f0e61c29cea6ba73abe567984e15440232eebec4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7566 audits A-7565/run 51881e0e at the exact source-cleared head: 2051/2051 ordinary tests; new tracker-only/code-tree T2 case passes ordinarily and 5/5 load repetitions. Shared-tree source comparison plus scheduler proof establish C1, matching docs C2, green mode-free receipt C3. T2 synthetic candidate jobs are not native Git or actual T3 suite proof. Linux T1/all-T2 includes Neovim; T3/T4 deferred. Host check 10254ddd recorded, not repeated; lint/budgets/ratchet report-only with ten missing baselines and incomplete timing. No item QA.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T11:41:05.544Z

Merged 944b17bf4ea6be00d7be60a7e8505a7e93b38155 onto dev.
