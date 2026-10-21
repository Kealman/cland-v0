---
id: T-1061
kind: task
title: The items board and the card's progress still count only loaded open children
state: closed
status: done
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
updated: 2026-10-21T14:53:40.798Z
closed: 2026-10-21T14:53:40.798Z
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
  - done: impl-1061 · 2026-10-21T14:40:07.714Z
  - verified: rev-26 [reviewer] · run rev-20261021-1061-final-1 · 2026-10-21T14:49:27.637Z · commit e3b0d47b93cea0cb816a74cca689a7897c29abf5
- [x] C2. A headless test renders a release's and an epic's card progress from the same snapshot and reads done, in-progress, backlog and blocked counts that include closed children.
  - done: impl-1061 · 2026-10-21T14:29:46.690Z
  - verified: rev-26 [reviewer] · run rev-20261021-1061-final-1 · 2026-10-21T14:49:27.637Z · commit e3b0d47b93cea0cb816a74cca689a7897c29abf5
- [x] C3. A search of nvim/lua for other done/total or "of N done" counters finds none left counting loaded children; any found are moved too and listed in the item topic.
  - done: impl-1061 · 2026-10-21T14:29:46.708Z
  - verified: rev-26 [reviewer] · run rev-20261021-1061-source-2 · 2026-10-21T14:30:46.019Z · commit 2aaa0dc1ee1336d102080ebb352b97d1090513f0
  - verified: rev-26 [reviewer] · run rev-20261021-1061-source-delta-1 · 2026-10-21T14:40:36.447Z · commit e3b0d47b93cea0cb816a74cca689a7897c29abf5
  - verified: rev-26 [reviewer] · run rev-20261021-1061-final-1 · 2026-10-21T14:49:27.637Z · commit e3b0d47b93cea0cb816a74cca689a7897c29abf5

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

### impl-1061 · 2026-10-21T14:38:41.084Z

Configured same-head run 57da3ffe at reviewed 2aaa0dc1 exited 1. Actual failure: duration budget: web/test/palette.test.ts::the palette and area keys help 5.98 s > 5 s. Linux x64 c-8 lon1 droplet, workers2; T1 exit0, full-fallback T2 exit0, Web exit1; 2342/2342 completed assertions passed, but no overall passing receipt. Host check reused bd390ed9 (not repeated); test-lint/report-mode budget warnings remain in A-8478. Reported shared-defect candidate to lead T-1061 and holding diagnosis/head changes/reruns until Coordinator shared fix or disposition. Branch remains unchanged; source verdict rev-20261021-1061-source-2 remains at this head.

### rev-26 · 2026-10-21T14:39:56.793Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261021-1061-evidence-1
commit: 2aaa0dc1ee1336d102080ebb352b97d1090513f0
scope: evidence
findings: [{"severity":"medium","text":"Shared unmodified palette parent5.98s exceeded enforcing missing-baseline5s bound; A-8478 aggregate exits1 despite all functional and owned load assertions passing.","file":"web/test/palette.test.ts"}]
finding_counts: {"high":0,"medium":1,"low":0}

Historical same-head run57da3ffe/A-8478 is not clear: actual duration budget web/test/palette.test.ts::the palette and area keys help5.98s>5s caused Web exit1. A-8481 retains limits. T1/allT2 succeeded;2312 ordinary plus30 load repetitions all passed, including six new Neovim identities each5/5. No owned assertion/source regression identified. C1 failed solely for required aggregate gate; C2 remains unverified. Source C3 remains established at this historical head. Coordinator-posted allowance correction is now requested at e3b0d47b and will receive a separate source review; this does not convert the old failed run to green.

Criteria: C1 failed (Historical A-8478 required configured gate exited1 on shared palette duration5.98s>5s; owned board tests passed.).

### rev-26 · 2026-10-21T14:40:36.447Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-1061-source-delta-1
commit: e3b0d47b93cea0cb816a74cca689a7897c29abf5
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Coordinator-only shared delta source clear; A-8482. Compared with2aaa0dc1, only the exact palette allowance from posted3d1d3aed+385f4e79 changes: final12s, openE-880 owner, valid2026-10-21→28 dates and observed5.98–8.285s evidence. Direct Agents decisions b5dcb1e3/2fea5675 authorize these patches; no other dev/source/test/fixture/baseline change. No findings; C3 reverified from unchanged source. Prior A-8478 remains failed historical evidence. C1/C2 require a new same-head configured result. Mode-free verification may proceed at e3b0d47b; no reviewer execution.

Criteria: C3 verified.

### rev-26 · 2026-10-21T14:49:27.637Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-1061-final-1
commit: e3b0d47b93cea0cb816a74cca689a7897c29abf5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head review clear; A-8491 audits original A-8489/run2ad2bf92 at source-reviewed e3b0d47b. Auto exit0:2312 ordinary passes plus30 separate load passes, six owned identities each explicit5/5. Board aggregate/header, card status/blocker membership, category/scoped release/graph/plan and labelled partial workflow checks all pass; owned ordinary peak0.6729593s, overall owned peak0.728393039s. C1–C3 verified across source and execution. Actual T1/allT2 hub+Neovim/Web exit0 on Linux x64 c-8 droplet,425s/$0.0295; two hub/Neovim/four Web workers. Host typecheck4c73ae8a not repeated on droplet; lint/duration/ratchet report-only diagnostics retained, no4s Web-budget pass. T3 deferred, noT4/QA claim. Historical A-8478 remains failed; no findings.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-21T14:53:40.798Z

Merged 3e2133a1593e623f979ef97cf3a6c873b924a376 onto dev.
