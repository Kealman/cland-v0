---
id: T-929
kind: task
title: "Budget headroom at 60 % across eight logs (cover #3 Linux red on three budget lines only)"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
regression_of: T-923
found_by: cover
topic: topic-684
branch: t/T-929-budget-headroom-at-60-across-eight-logs
created: 2026-10-20T02:12:27.274Z
updated: 2026-10-20T02:31:52.204Z
closed: 2026-10-20T02:31:52.204Z
---

## Summary

Stage cover #3's Linux run 3d721aab at 2d2eb91f (A-6948) had zero test failures but went red on three enforce-mode budget lines: `suite-timeouts.test.ts::verify reaps a captured detached pipe holder…` at 11.377 s and `…verify kills a silent test tree and spoke…` at 10.252 s against 10 s (T3), and `suite-admission-cost.test.ts::suite.start admission over a repository-sized manifest` at 3.191 s against 2 s (T2). T-923 covered identities at 80 % or more of their budget in six logs, and these were below that bar there.

## What to build

The T-923 method with a lower bar: allowances (observed peak plus 50 %, owner E-880, Oct 20 → Nov 19, D72) for every identity or file whose peak in any of A-6792, A-6795, A-6796, A-6900, A-6763, A-6767, A-6948 and A-6951 reaches 60 % or more of its budget, plus raises for existing allowances that a peak exceeds. Additions and raises only, with the receipt listing each one.

## Acceptance criteria

- [x] C1. A replay of all eight logs through the production checker shows zero budget failures, and no identity at 60 % or more lacks an allowance.
  - verified: rev-31 [reviewer] · run rev-20261020-929-source · 2026-10-20T02:19:17.778Z · commit 96c19ac1b0eca39099d86105a81245bc619b98b2
  - done: impl-929 · 2026-10-20T02:27:01.442Z
  - verified: rev-31 [reviewer] · run rev-20261020-929-final · 2026-10-20T02:27:31.422Z · commit 96c19ac1b0eca39099d86105a81245bc619b98b2
- [x] C2. The dry-run and the mode-free verify at the reviewed head are green.
  - done: impl-929 · 2026-10-20T02:27:02.040Z
  - verified: rev-31 [reviewer] · run rev-20261020-929-final · 2026-10-20T02:27:31.422Z · commit 96c19ac1b0eca39099d86105a81245bc619b98b2

## Comments

### impl-929 · 2026-10-20T02:12:49.673Z

Started eight-log replay using T-923 A-6902 at 60%, with E-880 dated additions and exceeded-cap raises only. Item topic topic-684.

### impl-929 · 2026-10-20T02:13:55.522Z

Committed and pushed bf650ee4 (origin/dev already merged). Replay A-6960 / script A-6961: 88 test additions, 108 exceeded-cap raises (101 test, 7 file), all temporary E-880 allowances expiring 2026-11-19. All eight logs have zero production-checker budget failures; 217 >=60% observations all allowed. Baselines/source/budgets and unrelated allowances unchanged. Typecheck and exact-head dry-run passed. QA policy none; source review requested before mode-free verify.

### impl-929 · 2026-10-20T02:18:09.276Z

Corrected review finding: inherited A-6902 read raw tier descriptor objects; switched replay to production readTierAssignments plus recognized-tier assertions as A-6907. Head 96c19ac1 adds five allowances and six missed exceeded-cap raises; correct totals 93 additions / 114 raises / 234 qualifying keys. Receipt A-6974, script A-6975 supersede A-6960/A-6961. All eight normalized replays zero failures; no qualifying key lacks allowance. Exact-head dry-run passes. No dev merge after first source review.

### rev-31 · 2026-10-20T02:19:17.778Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-929-source
commit: 96c19ac1b0eca39099d86105a81245bc619b98b2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6981: corrected source clear, no remaining findings. Initial descriptor-tier gap resolved before verdict. Independent normalized eight-log audit finds234qualifying keys, exactly93testadditions/114exceeded-cap raises(106test/8file), zero unallowed qualifying keys and zero enforce failures. Every cap/per-logpeak/report/original/date/reason/file flag matches A-6974; E-880Oct20→Nov19. Baseline/source/budget sections and other allowances preserved, enforce unchanged. A-6975uses production tier reader/recognized assertions/checker. All raises authorized by ticket;temporary list per Coordinatorf5e2418f. C1verified. C2awaits fresh configured mode-free green at unchanged96c19ac1; reported exact-head dryrun green. No writer/test execution by Reviewer;QA none.

Criteria: C1 verified.

### impl-929 · 2026-10-20T02:27:02.524Z

Same-reviewed-head mode-free verification 5a55f063-7cb6-4c24-914b-43c3f4cd2cb2 passed at 96c19ac1 (A-6995): 1917/1917 tests, zero failures; all T1 + fallback all T2 across hub/Neovim. Linux x64 droplet c-8 lon1, 417 s lifetime, $0.0290. T3 remains deferred to periodic dev and integrated occasions per configured tiers. C1/C2 done; Reviewer received same result for final exact-head verdict.

### rev-31 · 2026-10-20T02:27:31.422Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-929-final
commit: 96c19ac1b0eca39099d86105a81245bc619b98b2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6996: final clear. Independently audited wholeA-6995 at exact unchanged96c19ac1:1917/1917ordinarypasses,no nonpasses/loadgroups/duration/resource/missing diagnostics;hostcheck/allT1/fallbackallT2bothpackagesgreen. A-6976exact-head dryrun admitted without failures;C2established. C1normalized eight-log234qualifying/93additions/114raises andzero uncovered/failures sourceA-6981remainscurrent. Allclaimantdoneconfirmed3b7b9357. No findings;T3taskexclusionexplicit,QA none;no Reviewer tests/edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T02:31:52.204Z

Merged b9d2a9e1877dc73f2790ad8357ff541b850a61bb onto dev.
