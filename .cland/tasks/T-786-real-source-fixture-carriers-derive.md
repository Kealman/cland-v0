---
id: T-786
kind: task
title: Real-source fixture carriers derive their copied file set from the import graph instead of hand-written lists
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - verification
  - hub
  - ready-for-agent
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: topic-610
branch: t/T-786-real-source-fixture-carriers-derive
created: 2026-10-18T07:21:29.054Z
updated: 2026-10-19T19:08:33.012Z
closed: 2026-10-19T19:08:33.012Z
---

## Summary

Tests that copy real sources into a temp project keep hand-written lists of roots and helpers: suite-coverage's harness copy, typecheck's compiler fixture and the archived selector. On 2026-10-18 these lists broke three times. T-684 added until.ts (A-4990), T-709's neutral extraction missed shared/test-support (its M2), and T-709 and T-684 then conflicted on the same list. Each new harness module means another manual edit and another red run.

## What to build

One shared helper computes each carrier's copy set from the import closure of its entry files, using T-744's reachable-import analysis or an equivalent, plus an explicit list of non-import assets. Every carrier uses it. The actual-source coverage proof stays as it is.

## Acceptance criteria

- [x] C1. Adding a new module imported by harness.ts needs no change to any carrier list, proved by a test that plants such a module and runs the coverage carrier green. The carriers' existing assertions stay unchanged.
  - done: impl-786 · 2026-10-19T15:57:37.479Z
  - verified: rev-31 [reviewer] · run rev-20261019-786-final · 2026-10-19T15:58:06.831Z · commit 015e59564c00785fdfff547ccfc0b14153e4d5f6

## Comments

### impl-786 · 2026-10-19T15:30:36.753Z

C1 red: the existing coverage carrier with a planted harness side-effect import fails ERR_MODULE_NOT_FOUND for planted-carrier-module.ts. Shared closure helper and all three carrier integrations are in progress; preserving all prior coverage/compiler assertions.

### impl-786 · 2026-10-19T15:32:36.446Z

Implementation pushed at 015e59564c00785fdfff547ccfc0b14153e4d5f6. C1 planted-module carrier green; all existing assertions retained. Typecheck/lint and targeted carrier/helper tests pass; current and pre-neutral archived selector replays pass. Evidence A-6157: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6157-t-786-implementation-and-pre-review-evidence.md. Source review requested from Reviewer; mode-free verification follows clear source verdict.

### rev-31 · 2026-10-19T15:37:24.107Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-786-source
commit: 015e59564c00785fdfff547ccfc0b14153e4d5f6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Spec: no findings. All three real-source carriers use the shared whole-module import closure plus explicit assets; the planted harness import exercises the actual-source coverage carrier. Original coverage and compiler assertion lines are retained. Exact archived-tree source reading and historical selector behavior reviewed. See the source review artifact posted in topic-610. C1 remains unverified pending unchanged-head mode-free task verification; source clear permits that submission.

### impl-786 · 2026-10-19T15:57:44.291Z

Same-head mode-free verification 709338b6-8309-4a7f-bc82-7306991665a4 passed at 015e59564c00785fdfff547ccfc0b14153e4d5f6: 1560 tests passed, zero failures/cancellations/skips. C1 claimant done marked. T3 deferred to merge batch as required. Linux x64 droplet c-8 lon1, lifetime 1102s, cost $0.0765. Durable log A-6187: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6187-suite-709338b6-8309-4a7f-bc82-7306991665a4-auto-at-015e595.log. Reviewer received the hub result and owns final evidence verdict.

### rev-31 · 2026-10-19T15:58:06.831Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-786-final
commit: 015e59564c00785fdfff547ccfc0b14153e4d5f6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Spec: no findings. Independently audited A-6187 / 709338b6 at the source-cleared head: 1560 ordinary passes, all 480 gates 5/5. The two new source-fixture controls pass ordinarily and 5/5; both selector-package controls also pass. No owned budget/resource violations. C1 verified across the source-reviewed planted actual-carrier proof, A-6157's disclosed exact-head host carrier/compiler and archived-selector results, and this same-head configured task receipt. Host native results are summaries, not independently parsed raw transcripts; coverage/compiler T3 cases were not executed by this Linux task and remain landing-batch evidence. The final evidence artifact retains all 26 external budget rows and four known onboarding trips (T-877 overlap); roles-editor overlaps T-875.

Criteria: C1 verified.

### coord · 2026-10-19T19:08:33.012Z

Merged 3666d4d1afdde022e47607b91ee26001487b4eff onto dev.
