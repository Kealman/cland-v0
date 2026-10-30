---
id: T-1453
kind: task
title: cland verify runs the tier lint and T3 header check locally before submitting
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1232
branch: t/T-1453-cland-verify-runs-the-tier-lint-and-t3
created: 2026-10-30T05:44:56.925Z
updated: 2026-10-30T10:20:14.352Z
---

## Summary

Before admission, `cland verify` runs `npm run test:tiers` and the T3 lifecycle header check in the caller's worktree and names the cause (stale duration keys after a rename, unsorted tier rows, imports above or a missing `T3:` header), so a refusal costs seconds instead of a review round. On 2026-10-29 five submissions were refused this way (T-1445, T-410, T-1436, T-1082, T-1373). Rule batch 4 C1 (A-14151).

## Acceptance criteria

- [ ] C1. The local check reports each refusal class the hub's admission reports, with file and line, before any queue entry.

## Comments

### impl-1453 · 2026-10-30T10:20:14.352Z

Consumer inventory before shared admission extraction: hub/src/hub/suite-candidate.ts (production suite admission), hub/src/territory.ts (merge policy; unchanged), hub/src/protocol.ts (existing refusal codes; unchanged), CLI suite.ts (new local caller), suite-shards.ts / test-lint-policy.ts (shared existing checks), suite-selection.ts (infrastructure full-selection trigger). Tests across tiers found by names/fields: suite-admission*, suite-dry-run, suite-protocol, suite-task-selection, suite-selection, suite-tiers, test-lint, merge*, durations, web-phase, request-guard. Shipped docs/skills: implement SKILL.md, docs/agents/tests.md, hub/README.md; QA brief consumers use verify unchanged. No wire/schema change; retain prior-wire regression in suite-admission.test.ts. Only CLI adds an invocation; hub refusal policy stays identical.
