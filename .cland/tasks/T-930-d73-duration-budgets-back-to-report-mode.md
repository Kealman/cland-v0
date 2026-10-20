---
id: T-930
kind: task
title: "D73: duration budgets back to report mode until the v0.1.4 release"
state: open
status: ready
size: XS
criterion_seq: 3
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
regression_of: T-915
topic: topic-685
branch: t/T-930-d73-duration-budgets-back-to-report-mode
created: 2026-10-20T02:57:12.479Z
updated: 2026-10-20T03:06:43.608Z
---

## Summary

D73 (stand-in under D24, ask 8fe184d2, 2026-10-20 02:56Z): duration budgets go back to report mode until the v0.1.4 release. Under enforce mode (T-915) every stage cover went red only on duration-budget lines, with zero test failures, because tests near their budget cross it by load variance (±15–20 %), and the headroom rounds (T-923, T-929) were overtaken by each next run.

## What to build

Set `budget.mode` in `hub/test/durations.json` back to `"report"`, or remove it, whichever the manifest validator treats as report. Change nothing else in the manifest: all allowances, baselines, owners and the D72 legacyOwner stay. Update the wording in docs/agents/tests.md (and hub/README.md if it says budgets enforce) to "report mode until after v0.1.4 (D73); enforcement returns under E-880".

## Acceptance criteria

- [x] C1. The manifest diff is exactly the mode line, and a dry-run shows `budget (report only)` lines.
  - verified: rev-31 [reviewer] · run rev-20261020-930-source · 2026-10-20T02:59:38.813Z · commit 68a3ad477cadd488a81dffaaa81cbb5175281c3c
  - verified: rev-31 [reviewer] · run rev-20261020-930-final · 2026-10-20T03:06:29.831Z · commit 68a3ad477cadd488a81dffaaa81cbb5175281c3c
  - done: impl-930 · 2026-10-20T03:06:41.871Z
- [x] C2. The docs state D73.
  - verified: rev-31 [reviewer] · run rev-20261020-930-source · 2026-10-20T02:59:38.813Z · commit 68a3ad477cadd488a81dffaaa81cbb5175281c3c
  - verified: rev-31 [reviewer] · run rev-20261020-930-final · 2026-10-20T03:06:29.831Z · commit 68a3ad477cadd488a81dffaaa81cbb5175281c3c
  - done: impl-930 · 2026-10-20T03:06:42.346Z
- [x] C3. A mode-free verify at the reviewed head is green.
  - verified: rev-31 [reviewer] · run rev-20261020-930-final · 2026-10-20T03:06:29.831Z · commit 68a3ad477cadd488a81dffaaa81cbb5175281c3c
  - done: impl-930 · 2026-10-20T03:06:42.939Z

## Comments

### impl-930 · 2026-10-20T02:58:42.228Z

Implemented at 68a3ad477cadd488a81dffaaa81cbb5175281c3c: manifest diff exactly budget.mode enforce → report; D73 wording in docs/agents/tests.md; hub/README.md does not claim tier enforcement, so unchanged. A-7009 is the mode-free CLI dry-run (no stored-baseline overages; T3 ratchet report only); A-7010 previews the unchanged budget reporter with the committed manifest and one explicitly simulated overage, printing budget (report only): would fail. git diff --check passes. Source review requested before mode-free verification.

### rev-31 · 2026-10-20T02:59:38.813Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-930-source
commit: 68a3ad477cadd488a81dffaaa81cbb5175281c3c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7012: source clear,no findings. D73recorded in spec/tracker authorizes report mode forv0.1.4 and returnunderE-880. Manifesttext/parsed comparison confirms exactlybudget.mode enforce→report; all other sections/allowances/owners/legacyOwner unchanged. Docsupdateboth current-mode/rolloutclaims;README no contradictoryclaim. A-7009exact-head CLIdryrun showsreport-onlyratchet/no baselineoverages;A-7010clearly simulated reporterpreview prints literalbudget(report only):would fail withoutmanifestchanges, matching unchangedreporterlogic. C1/C2verified,C3awaitsfresh configured mode-freegreen at exacthead. No newtests neededforone-line data/docschange;QA none;no Reviewer tests/edits.

Criteria: C1 verified, C2 verified.

### impl-930 · 2026-10-20T03:06:09.483Z

Configured mode-free verify d30f3145-9c57-4482-b824-a2fead412ed9 green at unchanged reviewed head 68a3ad477cadd488a81dffaaa81cbb5175281c3c: 1920 passed, zero failed/skipped/cancelled. A-7013 durable log. Linux x64, c-8 lon1, lifetime 348 s, cost $0.0242. Actual run includes budget (report only) baseline diagnostic. Reviewer received same-head result for final C3 settlement; no source changes since review.

### rev-31 · 2026-10-20T03:06:29.831Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-930-final
commit: 68a3ad477cadd488a81dffaaa81cbb5175281c3c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7014: final clear. Whole A-7013 audit at unchanged reviewed/pushed68a3ad47 confirms1920/1920ordinarypasses,zero nonpasses/loadgroups/durationfailures/resource mismatches. Hostcheck/allT1/fallbackallT2bothpackagesgreen. Actual report-onlyheartbeatbaseline notice and ratchet label retained; no current overage. C1mode-only diff/simulatedreporterpreview and C2D73docs sourceA-7012remaincurrent;C3freshgreen nowestablished. C1–C3verified,no findings. QA none;T3deferred;no Reviewer tests/edits.

Criteria: C1 verified, C2 verified, C3 verified.
