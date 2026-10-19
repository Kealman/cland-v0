---
id: T-786
kind: task
title: Real-source fixture carriers derive their copied file set from the import graph instead of hand-written lists
state: open
status: review
size: S
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
updated: 2026-10-19T15:37:24.107Z
---

## Summary

Tests that copy real sources into a temp project keep hand-written lists of roots and helpers: suite-coverage's harness copy, typecheck's compiler fixture and the archived selector. On 2026-10-18 these lists broke three times. T-684 added until.ts (A-4990), T-709's neutral extraction missed shared/test-support (its M2), and T-709 and T-684 then conflicted on the same list. Each new harness module means another manual edit and another red run.

## What to build

One shared helper computes each carrier's copy set from the import closure of its entry files, using T-744's reachable-import analysis or an equivalent, plus an explicit list of non-import assets. Every carrier uses it. The actual-source coverage proof stays as it is.

## Acceptance criteria

- [ ] C1. Adding a new module imported by harness.ts needs no change to any carrier list, proved by a test that plants such a module and runs the coverage carrier green. The carriers' existing assertions stay unchanged.

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
