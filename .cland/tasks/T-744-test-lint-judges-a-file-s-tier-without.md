---
id: T-744
kind: task
title: Test lint judges a file's tier without following its fixture and helper imports
state: open
status: review
size: M
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-676
blocked_by: []
topic: topic-454
branch: t/T-744-test-lint-judges-a-file-s-tier-without
created: 2026-10-17T16:06:54.285Z
updated: 2026-10-17T17:46:18.911Z
---

## Summary

T-690's review (2026-10-17, review message ce02a5ed) found test files the lint qualifies as T1 or T2 whose imported fixtures use forbidden resources. Native fixtures open projectHub and socket peers, remote-fixture runs git and a socket hub, and suite fixtures spawn spokes and candidate workers. The lint reads only the test file itself, so its "qualifies" tier is lower than what the test really does. Once T-684 refuses on the lint, it would accept such files at the wrong tier.

## What to build

The lint resolves a test file's local imports (hub/test helpers and fixtures, transitively, within the repo) and charges the file with every resource used along the import graph, including in-process seams marked as allowed. Cache per module so a run stays fast.

## Acceptance criteria

- [x] C1. Planted T1 tests importing a projectHub helper and a child-spawning helper each get a reachable-resource diagnostic naming the import path, a pure helper adds none, and the direct qualifies result and findings used by admission are unchanged, proved by lint tests.
  - done: impl-744 · 2026-10-17T17:37:55.035Z
- [x] C2. The review request lists every dev file whose reachable tier differs from its direct qualification, names the harness-initialization-only subset separately, and shows npm run test:lint under 10 s on the Mac.
  - done: impl-744 · 2026-10-17T17:46:05.425Z

## Comments

### impl-744 · 2026-10-17T17:15:17.134Z

Merged origin/dev f0036591 before implementation. Read T-690 M1–M3. C1 is tested at the public lintTests seam using planted repo files (T1, filesystem only); resource source text is never executed. Whole-module graph analysis will conservatively charge every imported module resource, including unused helper exports; inert strings/comments and declaration-only type imports remain negative cases.

### impl-744 · 2026-10-17T17:34:26.496Z

Scope supersedes the initial whole-module note: Coordinator decisions 383d1b85, 29ff668c and 4725ee1c require named-export reachability, genuine import-time work, and a separate diagnostics-only reachable report. Direct qualifies and admission findings remain exactly T-743 (314/314 dev comparisons). Base origin/dev41fa3742 merged. Graph reports91 diagnostic differences, with zero existing-file ceilings solely from harness initialization; T-747/T-748 own harness cleanup/runtime enforcement. Mac final lint5.87s; typecheck/test:tiers pass. Full 5/5 serial refresh is running at load below15. No per-item QA (scope none/after-stage).

### impl-744 · 2026-10-17T17:46:16.425Z

Review requested via role reviewer at pushed head d49003393b4f07bc1af8159ceeed41a0eccf7a8c; routed to the Reviewer. Final evidence A-4671 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4671-t-744-final-review-evidence-at-d4900339-census-checks-and-serial-5-5-logs): typecheck/test:tiers pass; final Mac test:lint7.24s; 24 lint tests; test-lint/suite-tiers/suite-runner5/5 serially after last source change, peak one-second sampled load5.581<15. Direct-source314/314 unchanged;91 reachable-only differences listed in full in request/census; harness-init-only subset zero. C1/C2 marked done. Await clear source verdict before exact-head droplet verify, per protocol; no per-item QA required.
