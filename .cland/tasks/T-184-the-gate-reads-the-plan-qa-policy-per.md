---
id: T-184
kind: task
title: "The gate reads the plan: QA policy per stage or override, qa_default, qa-required retired and migrated, ready from the policy"
state: open
status: review
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: impl-184
parent: T-114
blocked_by:
  - T-183
topic: topic-101
branch: t/T-184-the-gate-reads-the-plan-qa-policy-per
created: 2026-10-10T15:38:37.537Z
updated: 2026-10-10T20:07:05.395Z
---

## Parent

T-114, slice 2 of 6. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

An item's QA policy from its stage or its override, `[plan] qa_default` outside any plan, `qa-required` retired with the labelled items migrated, `ready` from the policy, and QA-marked criteria.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-184 · 2026-10-10T20:05:44.233Z
  - verified: rev-14 [reviewer] · run rev-20261010-184-2 · 2026-10-10T20:07:05.394Z
- [x] C2. Demo: an item in a stage with `scope: none` merges on review; one in a `per-item` stage is refused without its QA verdict.
  - done: impl-184 · 2026-10-10T19:58:11.177Z
  - verified: rev-14 [reviewer] · run rev-20261010-184-1 · 2026-10-10T20:02:06.532Z
  - verified: rev-14 [reviewer] · run rev-20261010-184-2 · 2026-10-10T20:07:05.395Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-184 · 2026-10-10T19:58:11.323Z
  - verified: rev-14 [reviewer] · run rev-20261010-184-1 · 2026-10-10T20:02:06.693Z
  - verified: rev-14 [reviewer] · run rev-20261010-184-2 · 2026-10-10T20:07:05.395Z
- [ ] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).

## Comments

### impl-184 · 2026-10-10T19:53:53.489Z

Implementation in the claimed worktree: shared gate/ready evaluation now resolves the nearest plan's stage or per-item QA override, then qa_default (none/per-item by default). Plan qa_criteria require QA verifier marks. Added explicit cland task plan migrate through the hub queue: planned legacy tasks get affected/per-item overrides, out-of-plan ids are listed with the Coordinator-decided warning before labels retire. Adding end-to-end regression coverage and workflow docs.

### rev-14 · 2026-10-10T20:02:06.801Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261010-184-1
commit: d3397cfd56ac2a43ba990cfd1a370752a0aa6363

Medium — hub/src/tracker/tracker.ts:805,1661: reparenting an ancestor container changes descendant QA policy without rechecking ready; actual memory repro stays ready under affected/per-item default while gate refuses qa-missing.
Medium — hub/src/tracker/tracker.ts:854: interruption after an outside-plan label is removed loses that id from retry's fallback warning; actual memory repro first id omitted after next-item read failure.
Medium — hub/src/tracker/tracker.ts:861; hub/src/hub/journal.ts:24: task-qa-migrated is not journalled despite docs/review-and-qa.md:184 promising a durable migration report.
Low — docs/adr/0004-agents-work-on-a-local-git-territory.md:22: QA selection still references retired qa-required; amend the authorized policy addendum.

C2 and C3 verified separately in this run; C1 failed; C4 full-package evidence pending. Details and memory-only reproduction source: A-745, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-745-t-184-review-readiness-and-migration-recovery-gaps.md.

Criteria: C1 failed (Ancestor reparenting leaves descendants ready while gate refuses QA; interrupted fallback migration loses warning ids and migration report is not journalled.).

### impl-184 · 2026-10-10T20:05:44.447Z

Fixed rev-20261010-184-1 at 2dea9af80e04cc24ebe12ea9bd298d47260bfa6d. Ancestor index/removal events now invalidate descendant readiness revisions and schedule rechecks. Outside-plan migrations retain a warning comment atomically with label retirement, re-report retained ids on retries/restart, and journal both per-item warning and final report events. ADR0004 updated. Real daemon/socket regressions for tool+hand ancestor moves, interrupted native-open failure with hub restart, and journal/idempotence pass 3/3; typecheck passes. Prior-head full suite intentionally cancelled (exit 130, A-746) to test this fix head instead. origin/dev fetched and merged, already up to date.

### rev-14 · 2026-10-10T20:07:05.395Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261010-184-2
commit: 2dea9af80e04cc24ebe12ea9bd298d47260bfa6d

No high or medium findings remain. Ancestor policy changes now recheck descendant readiness; interrupted fallback migrations retain warning comments across retry/fresh-index restart; both migration events are journalled; ADR0004 is corrected.
Low — hub/src/tracker/tracker.ts:298,813: possible duplicated descendant scans; consider avoiding descendant traversal for leaf task changes as projects grow.
C1–C3 verified. C4 replacement full-package run remains unchecked. Independent actual Tracker memory probes and both review axes: A-750, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-750-t-184-re-review-clear-at-2dea9af-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.
