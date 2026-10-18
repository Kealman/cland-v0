---
id: T-716
kind: task
title: "Duration budgets enforce: per-tier test and file budgets fail runs, the T3 ratchet and the T2 wall refuse merges"
state: open
status: review
size: S
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-678
blocked_by:
  - T-683
  - T-679
topic: topic-489
branch: t/T-716-duration-budgets-enforce-per-tier-test
created: 2026-10-16T19:59:44.270Z
updated: 2026-10-18T09:44:51.254Z
---

## Summary

Decision 3: budgets report for one week after `tiers.json` lands (T-683), then refuse. This ticket is the switch. It replaces today's rule, under which only a new test over 5 s or a new file over 60 s fails, with T-683's per-tier budgets, applied to every test.

## What to build

- **The switch.** `durations.json` `budget.mode` is `"report"` (T-683's behaviour) or `"enforce"`. The Coordinator commits `"enforce"` no earlier than seven days after T-679 merged.
- **Enforce.** A test or file over its tier's per-test or per-file budget without a valid allowance fails the run with a named `duration budget` diagnostic.
- **Merge refusals.** T3 growth over the base manifest without an allowance refuses the merge (or its enqueue, with T-710) with `merge-budget`. So does a projected T2 wall over 480 s at the configured workers.
- **The T3 wall.** It refuses only once the base manifest's projected T3 wall is itself under 900 s. Until then, the result says `T3 wall 900 s not yet enforced: base <s> s` and the ratchet alone applies, because a hard 900 s wall against today's ~2640 s would refuse every merge.
- **Seed allowances.** In the same commit as `"enforce"`, the Coordinator adds allowances for the tests still over budget. Each names its E-677 owner ticket and expires within seven days.

## Acceptance criteria

- [x] C1. In enforce mode, a planted T2 test at 2.5 s without an allowance fails the run, and with a valid allowance passes, proved by a durations-runner test.
  - done: impl-716 · 2026-10-18T09:32:52.219Z
- [x] C2. In enforce mode, T3 growth without an allowance and a projected T2 wall over 480 s each refuse with `merge-budget`, proved by merge-gate tests.
  - done: impl-716 · 2026-10-18T09:44:07.322Z
- [x] C3. The T3 wall refuses only when the base projection is under 900 s and otherwise prints the not-yet-enforced line, proved by a test with two planted manifests.
  - done: impl-716 · 2026-10-18T09:44:07.673Z
- [x] C4. In report mode, every existing durations and durations-runner test passes unchanged.
  - done: impl-716 · 2026-10-18T09:32:53.726Z
- [x] C5. `docs/agents/tests.md` describes enforce mode, `merge-budget` and the T3 wall condition.
  - done: impl-716 · 2026-10-18T09:32:54.217Z
  - verified: rev-31 [reviewer] · run rev-20261018-716-source-2 · 2026-10-18T09:44:51.254Z · commit 933b5f16729f6167f2928780715eb75fd66dca71

## Blocked by

T-683 (per-tier budgets, report mode), T-679 merged seven days before the mode switch is committed.

## Comments

### coord · 2026-10-17T01:52:35.917Z

Coordinator decision (D53 detail), 2026-10-17 01:53Z: the existing duration allowances in hub/test/durations.json become legacy allowances, owned by E-677 and expiring when E-677 closes, with no calendar date. Reasons and seconds are kept. New allowances keep the 7-day expiry with an open owner ticket. Budget reports list the legacy allowances separately (count and total seconds), so E-677's progress shows as that number falling. T-716's enforcement exempts legacy allowances until E-677 closes. Without this, 7-day expiries would need weekly mass renewal and would break runs once T-716 enforces.

### impl-716 · 2026-10-18T09:29:42.265Z

Implemented report/enforce duration switch without changing durations.json or legacy allowance policy (Coordinator decision). T1 red/green evidence covers a known T2 receipt at 2.5 s, exact allowance cap, file allowance and T4; merge policy covers T3 growth, T2 wall by workers, T3 base wall 2640/900/899 s, and 10 s new-source estimates per Coordinator direction. Added a real reporter enforcement contract. Typecheck passes; targeted durations.test.ts passes 17/17 in 5.88 s. Remaining local files and review preparation in progress.

### rev-31 · 2026-10-18T09:41:10.174Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-716-source-1
commit: dc3b392406893f6d9928b32409698a11377f361e
scope: full
findings: [{"severity":"medium","text":"Report-only broad catches allow required immutable read failures to skip enforce-mode merge budgets; distinguish absence and refuse failed inspection.","file":"hub/src/suite-duration-context.ts","line":72}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review at dc3b392406893f6d9928b32409698a11377f361e, fixed base 48bc5391f957be8baa445cc02b265e525509195c. Reviewed C1–C5 and independently read Coordinator decisions 5941429f (retain allowance/owner policy and live report mode) and 8c6956a9 (new unmeasured T3 estimates use per-test tier budget). No Reviewer tests.

## Standards
No findings. Pure budget/merge-policy controls are T1; the existing real reporter contract exercises enforcement through the runner. Live durations.json and legacy policy remain unchanged. A-5136 targeted serial-file/host-gate results inspected.

## Spec
Medium M1 — hub/src/territory.ts:660–661 (C2/C3): required immutable duration inspection can fail open during enforce-mode merge admission. durationBudgetContext returns null when manifest/tier reads fail, and its broad baseline/source catch returns no base or partial candidateSources after failed git-show/diff/source reads. The new caller turns null into empty failures; checkMergeBudgets skips T3 ratchet/wall without base and can miss new-source estimates with partial candidateSources. This preserves the old report-only fallback in a path that now authorizes merges. A required read failure is not evidence of absent historical data or of an under-budget candidate. Lead confirms no disposition permits it (7ad02d05-9e4c-4eaa-9b6e-63ab33c32140) and is adding an injected-read red/green control.

Distinguish genuinely absent historical paths using successful immutable listings from failed required reads, propagate inspection failure as merge-budget in enforce mode, and keep report-mode unavailability behavior. Obtain fresh source review at the corrected head before verification.

Other reviewed paths have no findings: per-test/file enforce checks use exact allowance caps and T4 stays unbounded; runner failure is independent of quarantine; merge projections use configured workers with sequential package phases and conditional base T3 wall; new identities receive labeled estimates; report mode and docs retain the deferred live switch.

C5 documentation is present; no final execution criteria verified. Source not clear pending M1.

Standards: 0 findings. Spec: 1 medium finding.
Artifact A-5151.

Criteria: C2 failed (Required immutable duration inspection errors can disable the enforce-mode T3 ratchet or omit new-source estimates.), C3 failed (A failed required baseline read can silently skip the enforce-mode conditional T3 wall.).

### rev-31 · 2026-10-18T09:44:51.254Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-716-source-2
commit: 933b5f16729f6167f2928780715eb75fd66dca71
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh full source review at 933b5f16729f6167f2928780715eb75fd66dca71, fixed base 48bc5391f957be8baa445cc02b265e525509195c; correction diff against dc3b392406893f6d9928b32409698a11377f361e independently inspected. No dev merge or Reviewer tests.

## Standards
No findings. New snapshot-boundary tests inject an in-memory Git reader at T1 and cover eight read/diff/source failures, confirmed missing historical paths, report mode, and a late estimate read failure. No new processes, waits or allowances. A-5156 records the pre-fix missing-rejection red and corrected 4/4 (0.284s), plus refreshed durations 17/17, merge-budget 4/4, report controls 6/6 and host gates green.

## Spec
Prior M1/C2/C3 resolved. A successful immutable tree listing now distinguishes a missing historical path from a failed inspection. Required read/diff/parser/source failures in enforce mode throw DurationInspectionError; territory.squashTask maps it to merge-budget before checkout/ref changes. Known report mode retains unavailable diagnostics and drops partial snapshot facts; no partial base or estimate set is accepted as complete. Confirmed absent historical data retains the documented unavailable-base behavior.

The original source paths remain without findings: report/enforce switch and exact per-test/file allowance caps, T4 exemption, quarantine-independent runner failure, full-manifest merge projections at configured workers, T3 ratchet and conditional base wall, labeled unmeasured-T3 estimates, and merge result/CLI diagnostics. Existing immutable-tree lint validates allowance dates and live owners before merge-budget admission. The live manifest and legacy allowance policy remain unchanged, with the Coordinator owning the deferred mode switch and owner-closure hand-off.

C5 verified by current documentation. C1–C4 require exact-head post-source-clear mode-free task verification; A-5136 remains supporting targeted evidence. No per-item QA required; no final execution verdict yet.

Standards: 0 findings. Spec: 0 findings.
Artifact A-5157.

Criteria: C5 verified.
