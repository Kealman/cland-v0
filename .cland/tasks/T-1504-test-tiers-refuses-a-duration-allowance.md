---
id: T-1504
kind: task
title: test:tiers refuses a duration allowance owned by an epic
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1273
branch: t/T-1504-test-tiers-refuses-a-duration-allowance
created: 2026-10-31T08:18:54.263Z
updated: 2026-10-31T14:48:59.257Z
---

## Summary

`test:tiers` refuses a duration allowance owned by a task (T-761). An allowance owned by an epic passes, and the epic then cannot close. Extend the refusal to epics, so allowances are owned by a standing container such as E-880 from the start. Rule batch 5 (A-14855) C1, accepted by the human on 2026-10-31.

## Evidence

E-1466 owned the measure-memory analyzer allowance, and `task close E-1466` was refused. Re-owning it to E-880 (e5b310a78) changed `hub/test/durations.json`, which staled the clear QA demo, so a third demo was needed.

## Acceptance criteria

- [ ] C1. `test:tiers` refuses an allowance whose owner is an epic, with the same message shape as the task-owner refusal, naming the allowance key and a standing container to use instead.
- [ ] C2. The existing allowances in `hub/test/durations.json` pass the new check, or are re-owned in the same item with their added/expires/reason kept.

## Comments

### impl-1504 · 2026-10-31T14:46:06.446Z

Contract inventory before change: suite-durations.ts lintDurationManifest, durationOwners and durationAllowanceOwner; suite-shards.ts working/immutable lint; suite-selection.ts generated owner; run-suite.ts admission; suite-duration-budget.ts reporting/stanzas (identity shape unchanged); tests suite-tiers, suite-duration-budget, durations, duration-legacy, duration-fixture consumers (suite-admission, merge-gate), suite-tier-report, durations-runner-budget. CLI lint-tiers.ts uses hubShards; docs/agents/tests.md, hub/README.md, implement skill describe the flow. No wire/persisted shape changes; owner records already contain parent. Search included hub/nvim/web, qa and shipped skills by field and function names. Coordinator decision 74abf486: standing means category or epic directly under category; retain E-880 manifest unchanged. Test seams: existing in-process lintHubShards and lintDurationManifest/owner resolver, sealed scratch Git historical admission.

### impl-1504 · 2026-10-31T14:48:59.257Z

Red-first: suite-tiers.test.ts 16 pass/3 fail before production change. Actual failures: task hint used `open epic owner R-1`; delivery epic `Missing expected rejection`; shipped-manifest mutation `Missing expected exception`. Shared standing policy now fixes all three; 19/19 green on macOS arm64, Node 24.21.0 local single-file (no browser). Shipped durations.json remains byte-unchanged. Historical fixtures use categories with their original ids; selection fixture likewise migrated. Targeted file checks ongoing; no full local suites.
