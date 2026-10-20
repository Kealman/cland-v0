---
id: T-945
kind: task
title: The Coordinator's role clause is 7707 bytes, over the 7680-byte reserve below the send cap (T-798 regression)
state: closed
status: done
size: XS
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-617
blocked_by: []
regression_of: T-798
found_by: cover
topic: topic-706
branch: t/T-945-the-coordinator-s-role-clause-is-7707
created: 2026-10-20T07:35:44.633Z
updated: 2026-10-20T07:55:06.458Z
closed: 2026-10-20T07:55:06.458Z
---

## Summary

The periodic dev T3 run 3998189d at eaa11b6 (A-7200) failed `hub/test/roles.test.ts:36` "defaults clause snapshots…": the defaults Coordinator clause reply is 7707 bytes, and the test reserves 512 bytes below the 8192-byte send cap. T-798 (8ed94bda) added `cland publish` text to hub/src/roles/default-roles.ts. T3 tests don't run in T1-only batches (D67), so it landed.

## Acceptance criteria

- [x] C1. The defaults Coordinator clause is at most 7680 bytes with the publish guidance kept, by tightening wording (no content dropped that a test or doc relies on), and every role's clause stays under the reserve.
  - verified: rev-31 [reviewer] · run rev-20261020-945-source · 2026-10-20T07:42:28.682Z · commit aebd9cfcd82f1ab156a693aaa8a5bc5aadca5d5a
  - verified: rev-31 [reviewer] · run rev-20261020-945-final · 2026-10-20T07:50:15.317Z · commit aebd9cfcd82f1ab156a693aaa8a5bc5aadca5d5a
  - done: impl-945 · 2026-10-20T07:50:31.698Z
- [x] C2. roles.test.ts passes whole on the fix head, and the clause snapshot tests that pin clause text are updated, not loosened.
  - verified: rev-31 [reviewer] · run rev-20261020-945-final · 2026-10-20T07:50:15.317Z · commit aebd9cfcd82f1ab156a693aaa8a5bc5aadca5d5a
  - done: impl-945 · 2026-10-20T07:50:32.400Z
- [x] C3. A mode-free `cland verify` at the reviewed head is green, plus a T3 run of roles.test.ts named in the evidence.
  - verified: rev-31 [reviewer] · run rev-20261020-945-final · 2026-10-20T07:50:15.317Z · commit aebd9cfcd82f1ab156a693aaa8a5bc5aadca5d5a
  - done: impl-945 · 2026-10-20T07:50:33.033Z

## Comments

### impl-945 · 2026-10-20T07:36:29.174Z

Implementation started: narrow wording change in the shipped Coordinator clause, unchanged reserve and publish behavior; update exact clause snapshots and record whole-file targeted T3 evidence before source review.

### impl-945 · 2026-10-20T07:40:55.338Z

Source ready at aebd9cfcd82f1ab156a693aaa8a5bc5aadca5d5a, branch t/T-945-the-coordinator-s-role-clause-is-7707, pushed to origin after fetching/merging origin/dev (already current). Evidence A-7203 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7203-t-945-targeted-test-evidence-at-aebd9cfc: whole T3 roles.test.ts 4/4; roles-snapshot.test.ts 11/11; roles-component.test.ts 5/5, run sequentially at this commit. Typecheck passed. Defaults Coordinator reply 7529 bytes, 151 below unchanged 7680 reserve; every role fits. Publish guidance retained and pinned. Snapshot wording updated without loosening. Requesting source review before mode-free verification; qaPolicy scope none.

### rev-31 · 2026-10-20T07:42:28.682Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-945-source
commit: aebd9cfcd82f1ab156a693aaa8a5bc5aadca5d5a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7207: full Standards/Spec source review clear. Coordinator wording -178 UTF-8 bytes with required publish/release/crew/approval/ready guidance preserved; cap and 512-byte reserve unchanged, every role fits. Exact snapshot checks updated and strengthened. Retained T3 whole-file 4/4 plus snapshots 11/11 and component 5/5 independently read in A-7203. C1 verified; C2/C3 final marks await same-head mode-free gate, retaining explicit T3 evidence.

Criteria: C1 verified.

### impl-945 · 2026-10-20T07:49:55.639Z

Mode-free verification 8edde52e-0f6a-4a59-b3a6-6dabf4b6f0a1 passed at the exact reviewed and unchanged head aebd9cfcd82f1ab156a693aaa8a5bc5aadca5d5a: 1944/1944 tests, no fail/cancel/skip/TODO; T1 and T2 exit 0, fallback all T2. A-7212: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7212-suite-8edde52e-0f6a-4a59-b3a6-6dabf4b6f0a1-auto-at-aebd9cf.log. Executor Linux x64 droplet, lifetime 365s, cost $0.0253. The explicit whole-file T3 roles.test.ts 4/4 at this same commit remains in A-7203; T3 is deferred in mode-free task selection. Awaiting final Reviewer verdict; no merge enqueued.

### rev-31 · 2026-10-20T07:50:15.317Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-945-final
commit: aebd9cfcd82f1ab156a693aaa8a5bc5aadca5d5a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7213: exact-head A-7212/8edde52e audited: 1944 ordinary passes, host/T1/fallback T2 green, updated component text checks pass and zero resource/duration failures. C1–C3 verified with source A-7207 and explicit whole T3 roles.test.ts 4/4 A-7203 (all-role unchanged reserve); T3 task exclusion remains explicit. Claimant done marks absent at final view.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T07:55:06.458Z

Merged b1abc9e9b89f3bbedf77f77eec12635581ee32b8 onto dev.
