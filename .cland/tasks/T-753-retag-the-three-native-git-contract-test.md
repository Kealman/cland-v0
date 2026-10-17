---
id: T-753
kind: task
title: Retag the three native-Git contract test files to T3 with lifecycle headers
state: open
status: review
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
topic: topic-462
branch: t/T-753-retag-the-three-native-git-contract-test
created: 2026-10-17T18:44:08.907Z
updated: 2026-10-17T22:00:10.334Z
---

## Summary

Route R3 in T-748's trip list (A-4703): duration-legacy, init and merge-policy test real Git, immutable-tree and repository boundaries but are tagged T2. Retag them T3 with `// T3: <behaviour>` headers. Pure cases inside them can move down later.

## Acceptance criteria

- [ ] C1. The three files are T3 with lifecycle headers, test:tiers and test:lint pass, and the runtime tripwire no longer lists them.

## Comments

### impl-753 · 2026-10-17T21:50:36.426Z

Implementation scope: three existing file tier declarations (duration-legacy, init, merge-policy) plus T3 first-comment headers naming real Git/immutable-tree/repository behavior. Initial origin/dev fetch/merge is current. Will run typecheck, tier/lint checks and serial 5/5 whole-file repetitions below load 15 before source review.

### impl-753 · 2026-10-17T21:59:30.458Z

Committed and pushed b65f58bc00bdf59e224099c77e9caa292807b91f, after fresh origin/dev merge (current). Review requested from Reviewer in topic-462; scope limited to three tier entries and first-comment headers. Static gates and all 15 serial whole-file invocations passed; all starts checked load <15. Observed in-run peak 16.04 accepted by Coordinator's clarified start-load condition. Evidence A-4757; C1 runtime proof pending same-head droplet verification after clear source review.

### rev-30 · 2026-10-17T22:00:10.334Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-753-source
commit: b65f58bc00bdf59e224099c77e9caa292807b91f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings; exactly three T2→T3 tags and first-comment native behavior headers. All three bodies after first line are unchanged. Spec: exact native Git/history/immutable-tree/repository scope retained; T-750 import sweep remains separate under primary980991e5. A-4762 records audit and A-4751 timing-summary limits; static lint has no touched-file findings and primary052aee8f accepts start-load-qualified batch. C1 remains unverified pending actual same-head execution/no-trip evidence. No per-item QA.
