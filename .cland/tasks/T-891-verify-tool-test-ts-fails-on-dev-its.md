---
id: T-891
kind: task
title: "verify-tool.test.ts fails on dev: its fixture has no [verification] test since T-666"
state: closed
status: done
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
updated: 2026-10-19T19:38:07.620Z
closed: 2026-10-19T19:38:07.620Z
---

## Summary

hub/test/verify-tool.test.ts (T-793, T2) fails 2 of 3 cases on dev at fc46edb1. Its fixture project names no `[verification] test`, and since T-666 verify refuses such a project ("no [verification] test for this project"). The two items landed in separate T1+T3 batches, and no post-merge run executes T2, so the interaction surfaced only in T-887's task run (impl-887, 2026-10-19 19:07Z).

## Acceptance criteria

- [x] C1. (T2) The verify-tool fixture project names its check and test commands, so all three cases of hub/test/verify-tool.test.ts pass on dev, each 5/5. No assertion changes.
  - done: impl-891 · 2026-10-19T19:10:30.815Z
  - verified: rev-30 [reviewer] · run rev-20261019-891-final · 2026-10-19T19:13:57.709Z · commit a71592901e7a78a41ef5197c1a7396849b9fdc1d
  - verified: rev-30 [reviewer] · run rev-20261019-891-cland-fixture-final · 2026-10-19T19:20:10.863Z · commit 67a01b6f32e77198a58a812c8ee7c8077a9373ea

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

### rev-30 · 2026-10-19T19:13:57.709Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-891-final
commit: a71592901e7a78a41ef5197c1a7396849b9fdc1d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6359 Final same-head evidence clear: A-6356/f0fdcae0 ordinary478/478 zero fail/cancel/skip/TODO, all23 load groups5/5 including each of three owned controls5/5 (maximum owned body .253358390s), no budget/resource rows. A-6347 original source-identical precommit Mac captures each3/3 across five fresh serial runs qualified separately. Source A-6344 keeps every assertion. C1 verified; no claim of landed-dev or task T3 execution.

Criteria: C1 verified.

### impl-891 · 2026-10-19T19:14:57.268Z

Coordinator's compatibility revision applied as second commit 67a01b6f32e77198a58a812c8ee7c8077a9373ea: cland-shaped root and worktree fixtures preserve injected selection on T-667. Only prescribed single file changed; assertions unchanged. New each-test 5/5 local targeted runs and hub typecheck pass. Requesting delta source review, then new mode-free verification; a7159290 is superseded as shared-fix head.

### rev-30 · 2026-10-19T19:15:28.935Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-891-cland-fixture-source
commit: 67a01b6f32e77198a58a812c8ee7c8077a9373ea
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6364 Revised delta source clear. Exact Coordinator90ed1942 patch uses default cland-shaped root fixture and seeds claimed worktree before admission, preserving T-667 runner detection/injected reason and T-666 explicit commands. All assertions/permutations unchanged, no native process added. A-6362 five fresh source-identical host captures each3/3 audited, earlier exact-head result historical. C1 pending revised-head mode-free verification.

### rev-30 · 2026-10-19T19:20:10.863Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-891-cland-fixture-final
commit: 67a01b6f32e77198a58a812c8ee7c8077a9373ea
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6381 Final revised-head clear. A-6374/1a4310e6 ordinary478/478 all0fail/cancel/skip/TODO; all23groups5/5 including three ownedcontrols5/5, max.271754845s, no budget/resource rows. SourceA-6364 preserves assertions with cland-shaped root/worktree. OriginalA-6362 host5/5 captured precommit source-identical, separately qualified. C1verified; priora7159290 evidence historical, no taskT3/landeddev claim.

Criteria: C1 verified.

### coord · 2026-10-19T19:38:07.620Z

Merged 66d16437bec2ec6f3bc0e90351642c6e957ef382 onto dev.
