---
id: T-891
kind: task
title: "verify-tool.test.ts fails on dev: its fixture has no [verification] test since T-666"
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
topic: topic-626
branch: t/T-891-verify-tool-test-ts-fails-on-dev-its
created: 2026-10-19T19:08:17.952Z
updated: 2026-10-19T19:10:30.815Z
---

## Summary

hub/test/verify-tool.test.ts (T-793, T2) fails 2 of 3 cases on dev at fc46edb1. Its fixture project names no `[verification] test`, and since T-666 verify refuses such a project ("no [verification] test for this project"). The two items landed in separate T1+T3 batches, and no post-merge run executes T2, so the interaction surfaced only in T-887's task run (impl-887, 2026-10-19 19:07Z).

## Acceptance criteria

- [x] C1. (T2) The verify-tool fixture project names its check and test commands, so all three cases of hub/test/verify-tool.test.ts pass on dev, each 5/5. No assertion changes.
  - done: impl-891 · 2026-10-19T19:10:30.815Z

## Comments

### impl-891 · 2026-10-19T19:09:24.550Z

Applied exact Coordinator fixture patch as a71592901e7a78a41ef5197c1a7396849b9fdc1d, only hub/test/verify-tool.test.ts. Assertions unchanged. Each of 3 cases passes 5/5 targeted fresh runs; hub typecheck and diff check pass. Pushed branch for source review; mode-free verification follows clear source verdict.

### rev-30 · 2026-10-19T19:09:56.382Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-891-source
commit: a71592901e7a78a41ef5197c1a7396849b9fdc1d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6344 Standards/Spec source clear: one test fixture supplies explicit check/test through existing stack-other verificationFixture before hub startup. Claimed-worktree preview inherits root commands through production resolver. All three test bodies, assertions and queue controls unchanged; no new process or tier change. C1 runtime 5/5 requirement awaits original targeted receipts and same-head mode-free result; no criterion verified yet.
