---
id: T-938
kind: task
title: cland push leaves the local origin/dev tracking ref stale
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: C-326
blocked_by: []
topic: topic-692
branch: t/T-938-cland-push-leaves-the-local-origin-dev
created: 2026-10-20T05:13:34.736Z
updated: 2026-10-20T05:29:53.828Z
closed: 2026-10-20T05:29:53.828Z
---

## Summary

E-616's DoD demo (qa-2, run qa-2026-10-20-qa2-2; A-7030/A-7032) found that after `cland push` publishes dev to the territory (`origin`), the root's `refs/remotes/origin/dev` still shows the old commit until the next fetch. Tools that compare dev with origin/dev (merge-tree checks, QA gates) then read a stale base.

## Acceptance criteria

- [x] C1. After a successful `cland push`, `git rev-parse origin/dev` in the root equals the pushed commit, asserted inside an existing real-push case of hub/test/push.test.ts (T3, no new process starts); a T2 test with an injected Git adapter covers the update order and a failed push leaving the ref unchanged.
  - verified: rev-31 [reviewer] · run rev-20261020-938-source · 2026-10-20T05:18:22.146Z · commit 27cd698627e1189627a95c631c73ed74cb369113
  - verified: rev-31 [reviewer] · run rev-20261020-938-final · 2026-10-20T05:25:16.647Z · commit 27cd698627e1189627a95c631c73ed74cb369113
  - done: impl-938 · 2026-10-20T05:25:32.835Z
- [x] C2. A mode-free `cland verify` at the reviewed head is green.
  - verified: rev-31 [reviewer] · run rev-20261020-938-final · 2026-10-20T05:25:16.647Z · commit 27cd698627e1189627a95c631c73ed74cb369113
  - done: impl-938 · 2026-10-20T05:25:33.493Z

## Comments

### impl-938 · 2026-10-20T05:14:13.001Z

Implementation seam: cland push CLI against projectHub and a local fixture territory; assert root origin/dev equals the pushed commit after publication. pushDev currently pushes by path and fetches objects without updating tracking refs.

### impl-938 · 2026-10-20T05:17:14.123Z

Implemented and pushed 27cd6986 on t/T-938-cland-push-leaves-the-local-origin-dev. Post-publication origin/dev update, safe follow-up on tracking-ref failure, injected Git T2 logic coverage, and one assertion in the existing T3 real-push case. T2 3/3, targeted existing T3 1/1, npm run check and diff check pass. Coordinator clarified C1: real Git T3 proof plus injected Git T2 logic; no tier guard changes. Awaiting source review before mode-free verify.

### rev-31 · 2026-10-20T05:18:22.146Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-938-source
commit: 27cd698627e1189627a95c631c73ed74cb369113
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings. A-7074 records Standards/Spec review. update-ref uses the pinned published commit after success or exact lost-reply confirmation; rejection leaves tracking unchanged and ref-lock failure reports publication follow-up. Injected Git covers all native facts in new T2 tests; existing T3 case retains index/worktree/idempotence assertions and adds origin/dev equality. Original A-7072/A-7073 receipts pass 3/3 T2 and 1/1 real push. C1 verified; C2 awaits same-head configured mode-free verify and three new identities 5/5.

Criteria: C1 verified.

### rev-31 · 2026-10-20T05:25:16.647Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-938-final
commit: 27cd698627e1189627a95c631c73ed74cb369113
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-7091 independently audits A-7090 / 3f5e0372 at unchanged reviewed head. 1923 ordinary plus fifteen distinct repetitions pass, all three new identities 5/5; host check/all T1/fallback all T2 green. No tier mismatch or hard budget failure; missing file baselines are report-only. C1 real-Git proof remains A-7072/A-7073, task gate excludes T3. C1/C2 verified; claimant completion marks remain its responsibility. No merge action.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T05:29:53.828Z

Merged fbcde4bdc65e27d19661376d3e25c8a1ead0e772 onto dev.
