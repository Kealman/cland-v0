---
id: T-925
kind: task
title: A red run whose only failures are enforce-mode budget lines reports cause test-failure with no tests (periodic A-6900)
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
regression_of: T-915
found_by: cover
topic: topic-677
branch: t/T-925-a-red-run-whose-only-failures-are
created: 2026-10-20T01:24:30.644Z
updated: 2026-10-20T01:40:11.786Z
closed: 2026-10-20T01:40:11.786Z
---

## Summary

The periodic dev T3 run e8f0c390 at 0f8cb85b (A-6900) went red with cover cause "test-failure" but an empty failing-tests list. Its only failures were two enforce-mode `duration budget:` lines (T2 tests at 2.06 s and 2.39 s against 2 s); all 1091 tests passed. So the culprit search reported "inconclusive; no failing files identified", and the run looks like a mystery failure.

## What to build

Classify a red run whose only failures are budget lines with its own cause, for example `budget`. List the over-budget identities in place of failing tests, and have the culprit search say "budget only: <identities>" rather than inconclusive. Test failures keep today's behaviour.

## Acceptance criteria

- [x] C1. A T2 test: a run log with only `duration budget:` failures yields cause `budget` with the identities listed, and the periodic culprit search message names them.
  - done: impl-925 · 2026-10-20T01:27:11.433Z
  - verified: rev-31 [reviewer] · run rev-20261020-925-source · 2026-10-20T01:28:26.461Z · commit 332608902e5d3defac35e0a8cd919ee809c12e08
  - verified: rev-31 [reviewer] · run rev-20261020-925-final · 2026-10-20T01:36:07.250Z · commit 332608902e5d3defac35e0a8cd919ee809c12e08
- [x] C2. A run with a real test failure and a budget line is still classified test-failure, with the test listed.
  - done: impl-925 · 2026-10-20T01:27:12.024Z
  - verified: rev-31 [reviewer] · run rev-20261020-925-source · 2026-10-20T01:28:26.461Z · commit 332608902e5d3defac35e0a8cd919ee809c12e08
  - verified: rev-31 [reviewer] · run rev-20261020-925-final · 2026-10-20T01:36:07.250Z · commit 332608902e5d3defac35e0a8cd919ee809c12e08
- [x] C3. A mode-free verify at the reviewed head is green.
  - done: impl-925 · 2026-10-20T01:35:19.721Z
  - verified: rev-31 [reviewer] · run rev-20261020-925-final · 2026-10-20T01:36:07.250Z · commit 332608902e5d3defac35e0a8cd919ee809c12e08

## Comments

### impl-925 · 2026-10-20T01:25:25.388Z

Diagnosis: tier-labelled enforce-mode duration lines are not matched by existing cover parser. Implementing at existing cover/periodic result/report seams; required T2 projectHub regression will exercise real emitted log formats and periodic culprit notice, plus mixed real test failure.

### rev-31 · 2026-10-20T01:28:26.461Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-925-source
commit: 332608902e5d3defac35e0a8cd919ee809c12e08
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6920: source clear, no Standards/Spec findings. Shared cover parser accepts legacy/current tier-labelled full/short duration failures, preserving deduplication and real failure/cancellation/timeout precedence. Actual A-6900six matched lines deduplicate to its two over-budget identities; no real-failure markers and structuredfailures[]. Optional periodicbudgetIdentities only on causebudget, durable search reports names without probes; mixed input retains real-file probing and ordinary flake/culprit/Bug behavior. New projectHub T2regression covers actual report path,duplicates and no probes; two mixed branches retain assertions. C1/C2verified. C3awaits configured mode-free green at exact unchanged head including new T2identity5/5. Local21reported passes and dryrun are pre-gate evidence, no Reviewer tests/edits; QA none.

Criteria: C1 verified, C2 verified.

### impl-925 · 2026-10-20T01:35:20.319Z

Mode-free reviewed-head verify a83fcf3f-a159-49f4-b8cb-ee76eb8517fb green at 332608902e5d3defac35e0a8cd919ee809c12e08: 1916 tests pass, 0 failures. T1/T2 full fallback. Linux x64 droplet c-8 lon1, workers 2, lifetime 365s, cost $0.0254. Durable log A-6924: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6924-suite-a83fcf3f-a159-49f4-b8cb-ee76eb8517fb-auto-at-3326089.log. C3 marked done; final evidence verdict remains with Reviewer.

### rev-31 · 2026-10-20T01:36:07.250Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-925-final
commit: 332608902e5d3defac35e0a8cd919ee809c12e08
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6926: final clear. Independent completeA-6924 audit at unchanged33260890:1916ordinary+5loadpasses,zero nonpasses/no duration/resource/missing diagnostics. New budget-only regression ordinary.377391447s,5distinctloadpassesmax.417051288s,explicit5/5at44327. Both mixed-failure branches pass .601002783/.447423529s;component3/3,sum1.425817759s. Hostcheck/allT1/fallbackallT2bothpackagesgreen. C1/C2sourceA-6920 remainscurrent,C3nowestablished;allclaimantdone. No findings;T3periodic/integrated;QA none;no Reviewer tests/edits.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T01:40:11.786Z

Merged f5ab71074ea16a478b6e71d3b29b29155eafbdaa onto dev.
