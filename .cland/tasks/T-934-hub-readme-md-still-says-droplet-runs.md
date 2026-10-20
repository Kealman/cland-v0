---
id: T-934
kind: task
title: hub/README.md still says droplet runs use four workers; D53 set two
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-687
branch: t/T-934-hub-readme-md-still-says-droplet-runs
created: 2026-10-20T04:18:24.341Z
updated: 2026-10-20T04:27:54.565Z
---

## Summary

E-578's DoD demo (qa-3, run qa-20261020-3f, at 824105c5) found that hub/README.md (~line 2801) still describes the droplet worker default as four. D53 set droplet workers to 2 from the c-8 measurements (A-4106, A-4156; T-655's closure), and `.cland/config.toml` is 2 at the release candidate.

## What to build

The README's worker wording matches the configured default and names where it was measured. Any other doc that repeats the old number is corrected too.

## Acceptance criteria

- [x] C1. hub/README.md and docs/agents/tests.md state droplet workers 2 (D53, measured on c-8), and a grep over hub/README.md and docs/ finds no remaining statement of a four-worker droplet default.
  - verified: rev-31 [reviewer] · run rev-20261020-934-source · 2026-10-20T04:20:46.235Z · commit 49031175d8b5b4df383d4bd381079ceb1ce178f4
  - verified: rev-31 [reviewer] · run rev-20261020-934-final · 2026-10-20T04:27:41.910Z · commit 49031175d8b5b4df383d4bd381079ceb1ce178f4
  - done: impl-934 · 2026-10-20T04:27:53.187Z
- [x] C2. A mode-free `cland verify` at the reviewed head is green.
  - verified: rev-31 [reviewer] · run rev-20261020-934-final · 2026-10-20T04:27:41.910Z · commit 49031175d8b5b4df383d4bd381079ceb1ce178f4
  - done: impl-934 · 2026-10-20T04:27:53.829Z

## Blocked by

None. Land after the open v0.1.4 demos (E-482, E-578) record their verdicts, in the same batch as T-933.

## Comments

### impl-934 · 2026-10-20T04:19:10.410Z

Read the claimed item and searched hub/README.md plus docs/ for worker/default statements. Planned narrow wording fix: distinguish local 4 from configured droplet 2, name D53 and c-8/T-655 evidence, and qualify the superseded T-396 research default. No tests/code change and no edits near docs/agents/tests.md:808; no merge request while dev is frozen.

### rev-31 · 2026-10-20T04:20:46.235Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-934-source
commit: 49031175d8b5b4df383d4bd381079ceb1ce178f4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7048: source clear,no findings. Committeddropletoverride2andD53T-655c8measurementsmatchREADME/testpolicy; generic/local4inheritance preserved. T-396prior default/retention prose explicitly historical/superseded. Independent README/docs scan finds no currentfour-worker dropletdefault; remainingfour referenceslocal/history/fixtures orT-215fixed-build experiment. Docs-onlyscope,noT-933line808overlap/code/config/test/allowancechanges. C1verified,C2pendingexact-head configuredmode-freegreen. QA none;devfreeze/no-merge remains;no Reviewer tests/edits.

Criteria: C1 verified.

### impl-934 · 2026-10-20T04:27:26.683Z

Mode-free verification b8658979-fb56-46a1-a9cf-c02d75bf615a green at reviewed unchanged head 49031175d8b5b4df383d4bd381079ceb1ce178f4: 1920 pass, 0 fail/cancelled/skipped. T1 plus full T2 fallback. Linux x64 c-8 lon1, workers 2, lifetime 358s, cost $0.0248. Durable receipt A-7050 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7050-suite-b8658979-fb56-46a1-a9cf-c02d75bf615a-auto-at-4903117.log). Reviewer receives the same-head result and settles final verdict. No merge requested during dev freeze.

### rev-31 · 2026-10-20T04:27:41.910Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-934-final
commit: 49031175d8b5b4df383d4bd381079ceb1ce178f4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7051: final clear. WholeA-7050at unchanged reviewed/pushed49031175has1920/1920ordinarypasses,no nonpasses/loadgroups/durationfailures/resource mismatches;hostcheck/allT1/fallbackallT2bothpackagesgreen,configured dropletworkers2. Knownheartbeatbaseline notice report-only. C1sourceA-7048remainscurrent;C2freshgreen established. C1/C2verified,no findings. QA none,devfreeze/no-merge remains;no Reviewer tests/edits.

Criteria: C1 verified, C2 verified.
