---
id: T-1504
kind: task
title: test:tiers refuses a duration allowance owned by an epic
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1273
branch: t/T-1504-test-tiers-refuses-a-duration-allowance
created: 2026-10-31T08:18:54.263Z
updated: 2026-10-31T15:24:38.803Z
---

## Summary

`test:tiers` refuses a duration allowance owned by a task (T-761). An allowance owned by an epic passes, and the epic then cannot close. Extend the refusal to epics, so allowances are owned by a standing container such as E-880 from the start. Rule batch 5 (A-14855) C1, accepted by the human on 2026-10-31.

## Evidence

E-1466 owned the measure-memory analyzer allowance, and `task close E-1466` was refused. Re-owning it to E-880 (e5b310a78) changed `hub/test/durations.json`, which staled the clear QA demo, so a third demo was needed.

## Acceptance criteria

- [x] C1. `test:tiers` refuses an allowance whose owner is an epic, with the same message shape as the task-owner refusal, naming the allowance key and a standing container to use instead.
  - done: impl-1504 · 2026-10-31T14:51:56.695Z
  - verified: rev-32 [reviewer] · run rev-20261031-1504-evidence1 · 2026-10-31T15:18:44.332Z · commit a830e2b73507e2ac60eabd83a1d40e8df30e1544
- [x] C2. The existing allowances in `hub/test/durations.json` pass the new check, or are re-owned in the same item with their added/expires/reason kept.
  - done: impl-1504 · 2026-10-31T14:51:57.345Z
  - verified: rev-32 [reviewer] · run rev-20261031-1504-evidence1 · 2026-10-31T15:18:44.332Z · commit a830e2b73507e2ac60eabd83a1d40e8df30e1544

## Comments

### impl-1504 · 2026-10-31T14:46:06.446Z

Contract inventory before change: suite-durations.ts lintDurationManifest, durationOwners and durationAllowanceOwner; suite-shards.ts working/immutable lint; suite-selection.ts generated owner; run-suite.ts admission; suite-duration-budget.ts reporting/stanzas (identity shape unchanged); tests suite-tiers, suite-duration-budget, durations, duration-legacy, duration-fixture consumers (suite-admission, merge-gate), suite-tier-report, durations-runner-budget. CLI lint-tiers.ts uses hubShards; docs/agents/tests.md, hub/README.md, implement skill describe the flow. No wire/persisted shape changes; owner records already contain parent. Search included hub/nvim/web, qa and shipped skills by field and function names. Coordinator decision 74abf486: standing means category or epic directly under category; retain E-880 manifest unchanged. Test seams: existing in-process lintHubShards and lintDurationManifest/owner resolver, sealed scratch Git historical admission.

### impl-1504 · 2026-10-31T14:48:59.257Z

Red-first: suite-tiers.test.ts 16 pass/3 fail before production change. Actual failures: task hint used `open epic owner R-1`; delivery epic `Missing expected rejection`; shipped-manifest mutation `Missing expected exception`. Shared standing policy now fixes all three; 19/19 green on macOS arm64, Node 24.21.0 local single-file (no browser). Shipped durations.json remains byte-unchanged. Historical fixtures use categories with their original ids; selection fixture likewise migrated. Targeted file checks ongoing; no full local suites.

### rev-32 · 2026-10-31T14:56:50.899Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261031-1504-source1
commit: a830e2b73507e2ac60eabd83a1d40e8df30e1544
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source1 clear, A-14897. Standards/Spec: no findings. Shared standing-owner policy follows Coordinator74abf486; working/immutable admission, hints and generated-owner resolver agree. New T1 task/delivery-epic refusals retain key/source-line assertions and standing acceptance; fixtures migrated without weakening historical assertions. durations.json byte-identical (357 entries, legacyOwner E-880); pinned E-880 open epic under open category C-327. C1/C2 runtime verification pending original same-head configured receipt. One unchanged-head mode-free verify may proceed, then final evidence review; no full-all or runtime-clear claim.

### rev-32 · 2026-10-31T15:18:44.332Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261031-1504-evidence1
commit: a830e2b73507e2ac60eabd83a1d40e8df30e1544
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record evidence clear, A-14922 from214a8a16/A-14920 and source1/A-14897. Matched4647 ordinary test passes/522 files, separate140 load tests/files, no adverse/unpaired facts. C1 delivery task/epic and C2 exact shipped manifest each pass once+five load reps (18receipts; max2.015511827s). Eight touched files positive; four changedT3 files205identities once/no repetitions. T0/T1/allT2/changedT3/Web exit0, remainingT3/T4 unexecuted; Linux droplet/HeadlessShell1248, footer candidate tree reproduced; host gate reused. Lint/budget/ratchet report-only. Preserve limitation: emitted stanzas consume R-1523, admitted selection/running host version absent, and predecessor-host attribution explicitly withdrawn; no end-to-end new-host selector claim or stanza application. C1/C2 established independently by candidate lint/resolver/manifest assertions. No source change or rerun.

Criteria: C1 verified, C2 verified.

### rev-32 · 2026-10-31T15:24:38.803Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261031-1504-delta1
commit: e4ec52be8f8504548fefdf9bed7d4018323b63c3
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta source clear, A-14934. Actual tree70c5ea3373f068590966b1646dccfd2175d66380; parents a830e2b73+da255b5d0. All own nonREADME paths exact predecessor; incoming nonREADME files exact dev parent. README preserves OpenCode and standing-owner sections once, with prior approved owner wording. A-14930 supplies local summary typecheck/246passes, not original raw capture/configured run. OriginalA-14920/A-14922 remain predecessor-only with R-1523 generated-output provenance limit. C1/C2 current-head runtime not refreshed; Coordinatorb371793f requires full all run at merged head after source clear. No extra mode-free or final-ready claim.
