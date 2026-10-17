---
id: T-753
kind: task
title: Retag the three native-Git contract test files to T3 with lifecycle headers
state: closed
status: done
size: S
criterion_seq: 1
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
updated: 2026-10-17T22:29:34.919Z
closed: 2026-10-17T22:29:34.919Z
---

## Summary

Route R3 in T-748's trip list (A-4703): duration-legacy, init and merge-policy test real Git, immutable-tree and repository boundaries but are tagged T2. Retag them T3 with `// T3: <behaviour>` headers. Pure cases inside them can move down later.

## Acceptance criteria

- [x] C1. The three files are T3 with lifecycle headers, test:tiers and test:lint pass, and the runtime tripwire no longer lists them.
  - done: impl-753 · 2026-10-17T22:28:29.185Z
  - verified: rev-30 [reviewer] · run rev-20261017-753-final · 2026-10-17T22:29:25.836Z · commit b65f58bc00bdf59e224099c77e9caa292807b91f

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

### rev-30 · 2026-10-17T22:29:25.836Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-753-final
commit: b65f58bc00bdf59e224099c77e9caa292807b91f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; A-4809. Standards: no findings. Spec: no findings. Exact-head run 65134fb4/A-4808 exit0 positively executes all 27 owned cases (duration-legacy2, init13, merge-policy12), each with a completed timing row and ordinary passing reporter line; no tier-mismatch rows name any of the three. Source headers/manifest/native behavior from rev-20261017-753-source remain current. Whole auto hub-only+Neovim-smoke: 2113 reported,2108 pass,0 fail/cancel,5 unrelated prerequisite skips. C1 verified; no per-item QA.

Criteria: C1 verified.

### coord · 2026-10-17T22:29:34.919Z

Merged 6a010c7eafe0858e71be09e12766c7aeb31f123e onto dev.
