---
id: T-1061
kind: task
title: The items board and the card's progress still count only loaded open children
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1044
topic: topic-808
branch: t/T-1061-the-items-board-and-the-card-s-progress
created: 2026-10-21T14:08:05.830Z
updated: 2026-10-21T14:30:46.019Z
---

## Summary

T-1044 moved the items list rows onto the hub's `child_counts`, but two other workbench surfaces still count from the open-only snapshot: the items board and the item card's progress section. On the human's workbench after restart #38 (14:07Z), the Explorer showed R-377 3/13, E-1006 7/7 and E-415 8/10. At the same time the board showed E-1006 "0/0", E-415 "0/2" and R-377 "0/11", and R-377's card read "0 of 10 done".

## What to build

Every done/total counter in the Neovim workbench reads the hub's `child_counts`:
- the board rows and the board header ("N in work · N done"): nvim/lua/cland/vboard.lua counts `items.children` by state and loaded tasks by status;
- the card's progress section: nvim/lua/cland/explorer_card.lua iterates `members` from the loaded index.

Done items stay hidden where they are hidden today ("done hidden").

## Acceptance criteria

- [x] C1. A headless test renders the board from an open-only snapshot of a tracker with closed children and reads each container's done/total equal to `child_counts`, header included.
  - done: impl-1061 · 2026-10-21T14:21:28.324Z
- [x] C2. A headless test renders a release's and an epic's card progress from the same snapshot and reads done, in-progress, backlog and blocked counts that include closed children.
  - done: impl-1061 · 2026-10-21T14:29:46.690Z
- [x] C3. A search of nvim/lua for other done/total or "of N done" counters finds none left counting loaded children; any found are moved too and listed in the item topic.
  - done: impl-1061 · 2026-10-21T14:29:46.708Z
  - verified: rev-26 [reviewer] · run rev-20261021-1061-source-2 · 2026-10-21T14:30:46.019Z · commit 2aaa0dc1ee1336d102080ebb352b97d1090513f0

## Comments

### impl-1061 · 2026-10-21T14:12:45.502Z

C1/C2 test-first at the headless Neovim rendered board/card seams. Red board output: release 0/4 instead of 1/4, mixed epic 0/3 instead of 2/5, completed epic 0/0 instead of 2/2. Red card release: 0 of 3 done instead of 1 of 4. Both targeted tests now pass on the working tree (local Darwin arm64); recorded-frame maintenance is pending. C3 audit additionally found Explorer category open/done and scoped release task-detail counters, plus board direct-task group totals unavailable from current hub aggregates; implementing Coordinator's direct-child/level-label decision.

### rev-26 · 2026-10-21T14:26:15.736Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261021-1061-source-1
commit: e01d67cc8a6956dcfb07c6cd560b473532b24bdc
scope: full
findings: [{"severity":"medium","text":"Release blocked count falls back to direct tasks when all epics are closed/unloaded; aggregate fraction counts epics, so progress mixes different member sets.","file":"nvim/lua/cland/explorer_card.lua","line":192},{"severity":"medium","text":"Centre plan title does not observe the items-panel render; the previous board already contains the asserted E-2 2/5 row. Wait for the anchored plan-panel receipt, retaining the assertion (rule 9).","file":"nvim/test/progress-counts-component.test.ts","line":111},{"severity":"medium","text":"Plan PROGRESS status summary remains loaded-only and unlabelled: missing closed stage items are counted planned. Label it loaded under the partial-counter disposition or use complete matching data, and include it in the audit.","file":"nvim/lua/cland/plan.lua","line":512}]
finding_counts: {"high":0,"medium":3,"low":0}

Source review not clear; A-8460 records both axes and exact diff/tree. M1: release card blocked membership changes when its closed epics are unloaded, mixing direct tasks into aggregate epic progress. M2: new plan-panel test observes a centre title rather than the separately rendered panel, which can still contain the prior board's same fraction. M3: plan PROGRESS status summary remains an unlabelled loaded-only count. Coordinator's direct-child and explicitly-loaded partial-counter dispositions are accepted; no hub or Web expansion required. No reviewer execution. Correct the source and request fresh review before verification.

Criteria: C2 failed (Release blocked progress counts direct tasks when all epic progress members are closed and unloaded.), C3 failed (Plan PROGRESS summary still reports unqualified loaded-only done/status counts; plan-panel regression also lacks its exact render receipt.).

### rev-26 · 2026-10-21T14:30:46.019Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-1061-source-2
commit: 2aaa0dc1ee1336d102080ebb352b97d1090513f0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-8471 documents closure of M1–M3 and the full counter audit. Aggregate-backed release blocked members exclude direct tasks even with no loaded epics; anchored plan-panel row/section observation precedes the retained fraction assertion; plan workflow counts omit unloaded members and say loaded. No remaining findings. C3 established by source under Coordinator's partial-rollup disposition; C1/C2 await configured same-head evidence. A-8470 exact-head local macOS plain T2 replay is 6/6, with supporting precommit/red/static evidence explicitly labelled. No reviewer execution. Supersedes prior source not-clear; mode-free verification may proceed at 2aaa0dc1.

Criteria: C3 verified.
