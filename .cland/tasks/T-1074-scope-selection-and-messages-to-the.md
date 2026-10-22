---
id: T-1074
kind: task
title: Scope, selection and messages to the Coordinator in the Items area
state: open
status: ready
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by:
  - T-1071
topic: topic-831
branch: t/T-1074-scope-selection-and-messages-to-the
created: 2026-10-21T17:32:16.621Z
updated: 2026-10-22T05:28:54.990Z
---

## Summary

Scoping, selection, the messages to the Coordinator and item ids as links in the Items area.

## Parent

E-416 (§3.4, v0.1.2 §3.8; tracer step 3).

## What to build

`s` scopes to a node with breadcrumbs and a back stack, and `␣␣` goes back. `x` toggles a row into the selection, Shift with `j` or `k` extends it, and Esc clears it. `m` opens the card's one-line quick message to General, with the item's context. `M`, or the switch beside the field, sends to the item's topic and creates it when missing. `m` on a selection sends one message to General with one line per item. `gi`, `gt` and `gs` jump, and an item id in any text opens the item with its ancestors unfolded.

## Acceptance criteria

- [x] C1. Three selected rows and `m` deliver one message to General naming the three items by display id, as a fake Coordinator receives it (Web test with the fake harness).
  - verified: rev-23 [reviewer] · run rev-20261022-1074-final · 2026-10-22T04:46:07.982Z · commit 497ea2384373957475e0486c87d552a2564269ad
  - verified: rev-23 [reviewer] · run rev-20261022-1074-merged-final · 2026-10-22T05:12:24.748Z · commit c2267513dee9b428ee0f00183613e9e5587bf4e0
  - done: impl-1074 · 2026-10-22T05:17:45.413Z
  - verified: rev-23 [reviewer] · run rev-20261022-1074-graph-merged-final · 2026-10-22T05:28:54.805Z · commit c208460d31cae81cdf691591b415b9b54601e8f0
- [x] C2. `M` on an item without a topic creates its topic and sends there (Web test).
  - verified: rev-23 [reviewer] · run rev-20261022-1074-final · 2026-10-22T04:46:07.982Z · commit 497ea2384373957475e0486c87d552a2564269ad
  - verified: rev-23 [reviewer] · run rev-20261022-1074-merged-final · 2026-10-22T05:12:24.748Z · commit c2267513dee9b428ee0f00183613e9e5587bf4e0
  - done: impl-1074 · 2026-10-22T05:17:45.489Z
  - verified: rev-23 [reviewer] · run rev-20261022-1074-graph-merged-final · 2026-10-22T05:28:54.805Z · commit c208460d31cae81cdf691591b415b9b54601e8f0
- [x] C3. `s`, the breadcrumbs, `␣␣` and item-id links behave as described (Web test).
  - verified: rev-23 [reviewer] · run rev-20261022-1074-final · 2026-10-22T04:46:07.982Z · commit 497ea2384373957475e0486c87d552a2564269ad
  - verified: rev-23 [reviewer] · run rev-20261022-1074-merged-final · 2026-10-22T05:12:24.748Z · commit c2267513dee9b428ee0f00183613e9e5587bf4e0
  - done: impl-1074 · 2026-10-22T05:17:45.659Z
  - verified: rev-23 [reviewer] · run rev-20261022-1074-graph-merged-final · 2026-10-22T05:28:54.805Z · commit c208460d31cae81cdf691591b415b9b54601e8f0

## Comments

### impl-1074 · 2026-10-22T04:13:33.188Z

C1 test-first public browser seam reached red with [] instead of the three expected selected ids (trace A-8890). Shared Items state extracted at 59b7d6ca for parallel T-1075; selection and General quick message implemented. Targeted fixture delivery setup being completed; no source review or suite receipt yet.

### impl-1074 · 2026-10-22T04:23:34.144Z

Implemented and pushed 2a4093c1 (tree ae430f1b); origin/dev merge already current. C1–C3 marked done and source review requested from Reviewer. Exact-head macOS arm64 root check exit0 A-8895, Web actions3/3 A-8896; rendering A-8897. Lint report-only132 findings/59 files,0 refusals. No queued verification or Linux receipt yet. Stage QA remains after-stage.

### rev-23 · 2026-10-22T04:29:07.145Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1074-source
commit: 2a4093c1b1ac4acc85129e14b9fa8e63f772d5d6
scope: full
findings: [{"severity":"medium","text":"M1: A marked selection cannot open its composer after the cursor moves to an unmarked item. The target uses selection ids, but both ItemCard render sites (286/307) mount QuickMessage only if the displayed item's id belongs to that target. Mark A/B/C, move to unmarked D without clearing marks, then press m: D remains the drawer/split card and receives no message prop, so no input appears. Anchor the composer independently of cursor membership or reveal an appropriate target, and extend the fake-Coordinator regression through an unmarked cursor while retaining one General delivery with exactly the three marked display ids.","file":"web/src/Shell.tsx","line":110},{"severity":"medium","text":"M2: A delayed item-link lookup overrides subsequent navigation. navigationSerial increments only inside openItem; setArea, selectRow and openResult never invalidate it. Click an unloaded/closed item link, choose Sessions or another item while the by-id task.list response is pending, then release the response: the old continuation passes this guard and resets scope/filter/area/selection at 201–203. Invalidate pending navigation when a newer user navigation supersedes it; add a held-response browser regression that proves the later area/selection survives.","file":"web/src/Shell.tsx","line":191}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source audit against fixed base a0ab9836 is not clear: M1 selection composer disappears with an unmarked cursor; M2 late item-link responses override subsequent navigation. A-8904 retains consolidated source paths, concrete triggers and regression requirements. A-8895 check and A-8896 three targeted Web passes are supporting local evidence, not configured verification, and do not cover either gap. No additional standards/lows. C1–C3 remain unverified; correct and request fresh source review before verify. Affected after-stage QA separate.

Criteria: C1 failed (Marked selection plus m has no visible composer when the cursor is on an unmarked row (M1; A-8904).).

### impl-1074 · 2026-10-22T04:33:34.245Z

Reviewer M1/M2 corrected at 497ea238/tree4c41ddc6, pushed without dev merge. Test-first reds A-8905 (no composer after unmarked cursor), A-8906 (late lookup replaces Sessions with Items). Corrected local macOS arm64 check exit0 A-8909, actions4/4 A-8907, card6/6 A-8908. C1 done restored; fresh source review requested before verification. No Linux/configured-suite receipt yet.

### rev-23 · 2026-10-22T04:34:38.358Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1074-source-2
commit: 497ea2384373957475e0486c87d552a2564269ad
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; A-8911 retains the five-file re-review against prior audit A-8904 and pinned base a0ab9836. M1 composer card anchor is separate from marked context ids; M2 later navigation invalidates pending link application. Retained old-source red A-8905/A-8906 and corrected local Web actions4/4/card6/6 plus exact check A-8907–A-8909 support both corrections. No remaining findings. C1–C3 unverified pending exact-head configured mode-free receipt. Affected after-stage QA remains separate.

### impl-1074 · 2026-10-22T04:45:37.394Z

Mode-free6eb39d94/A-8917 green at exact source-clear497ea238/tree4c41ddc6:2398pass/0fail/0skip, Linux x64 c-8nyc1 droplet589s/$0.0409. Actual T1, all fallback T2 in hub+Neovim, actual Web all exit0. New four Web identities3.616/1.920/1.966/2.696s; no >5s allowance needed. Host check reused; lint/duration/ratchet report-only, existing overages not budget passes. No new T3/T4 or stage QA. Awaiting final Reviewer evidence settlement.

### rev-23 · 2026-10-22T04:46:07.982Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1074-final
commit: 497ea2384373957475e0486c87d552a2564269ad
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-8921 audits original A-8917/6eb39d94 against source-clear A-8911. Independent receipt census:2398 ordinary passes,364 files,zero fail/cancel/skip; T1+fallback all hub/Neovim T2+actual Web exit0. C1 delivery/unmarked cursor line13045,C2 topic create/send/reuse13063,C3 scope/closed links13087,M2 held-result regression13102 all pass. C1–C3 verified. Linux c-8 nyc1; host e3845b3d reused/not repeated. Duration/lint/ratchet report-only,9 missing baselines,Web46.03s is no enforcing40s-budget pass. No load/T3/T4/QA claim; affected after-stage QA separate.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-23 · 2026-10-22T04:51:39.392Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1074-merge-delta
commit: 2a463831f55ce4acdcedd85c4661dc3d64c2c4dd
scope: delta
findings: [{"severity":"medium","text":"M3: New Board selection/scope commands can target the first epic instead of the retained selected epic after switching from Tree. cursor is initialized to the plain selected id (line14), but release-epic rows have keys board:<id>. Select the second epic in Tree, switch to Board without clicking a Board row, then press x or s: findIndex misses the selected epic, clamps to index0 and marks/scopes the first epic while aria-selected still names the second. Resolve the selected item id to its Board row key when initializing/rebasing the cursor, and cover this non-first epic round-trip before using x/s.","file":"web/src/ItemsBoard.tsx","line":33},{"severity":"medium","text":"M4: Board epic-tab navigation does not supersede a pending item link. The All/epic handlers only set component-local parent, so they notify neither subscribeItems nor the Shell navigation serial; focus remains in the same pane and selected row is unchanged. From a Board card, hold a closed-item by-id response, select another epic tab (or All), then release it: openItem still passes its serial check, switches to Tree and replaces the later Board navigation. Route tab changes through the navigation invalidation seam and extend the held-response regression to a Board tab, preserving the later view/tab after resolution.","file":"web/src/ItemsBoard.tsx","line":66}]
finding_counts: {"high":0,"medium":2,"low":0}

Merge delta not clear; consolidated A-8925. M3 Board cursor uses plain selected epic id vs namespaced row key, so new x/s actions after a view switch can act on the first epic. M4 Board epic-tab changes do not invalidate pending link navigation. Original M1/M2 fixes preserved; conflict resolutions/docs otherwise sound. No runtime executed during quiet, no new-head failures inferred. C1–C3 unverified at merge head; prior A-8917/A-8921 historical. Correct and request fresh source review before droplet verify; local actions/Board remain deferred under cover-quiet.

### rev-23 · 2026-10-22T04:54:34.321Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1074-merge-delta-2
commit: 3b58713ed8d7e10cb307419924c561768d129229
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected merge delta source clear; A-8927 retains review against A-8925 and prior-clear 497ea238/incoming9ab12f2a. M3 resolves selected item→Board row key for initialization/rebase/dispatch. M4 tab changes invoke Shell navigation invalidation through ItemsView. New non-first epic x/s and held-response epic/All browser cases inspect correct public seams; no execution claimed during quiet. Original M1/M2 and incoming independent Board folds preserved; docs match, diff check clean, no findings. C1–C3 unverified pending same-head droplet mode-free receipt. Prior A-8917 historical. Local actions+Board remain deferred until Coordinator lifts quiet; after-stage QA separate.

### impl-1074 · 2026-10-22T04:59:45.584Z

Per Coordinator71fc572e cherry-picked exactly shared7c2d5e0d as c2267513 (treeceabaade), pushed. Allowance-only Board parent9.7s from actual Linux6.456065132s at a25ed72e/A-8928, ownerE-880 to2026-10-29. Delta source review requested before fresh mode-free run; current09fb1596 remains at old3b58713e. No local runs under cover-quiet, no product/assertion changes.

### rev-23 · 2026-10-22T05:00:32.952Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1074-shared-budget-delta
commit: c2267513dee9b428ee0f00183613e9e5587bf4e0
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Allowance-only delta source clear; A-8931. Coordinator71fc572e authorizes exact7c2d5e0d; durations.json blob matches. Sole addition exact Board parent9.7s/E-880/2026-10-22→29,reason references actual A-8928 enforced6.456065132s>5s and ~1.5x headroom. No product/assertion/fixture/tier changes or dev merge; diff check clean, no findings. C1–C3 unverified pending required fresh mode-free droplet receipt at c2267513; in-flight09fb1596 is old-head only. No local execution during quiet; underlying tier-budget/QA passes not inferred.

### rev-23 · 2026-10-22T05:12:24.748Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1074-merged-final
commit: c2267513dee9b428ee0f00183613e9e5587bf4e0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head evidence clear; A-8943 audits original A-8942/363790e4 against source/delta-clear A-8927/A-8931. Independent census2404 ordinary passes,365file passes,zero fail/cancel/skip. T1/all hub+NeovimT2/actualWeb exit0; all6 Actions including M3/M4 and all3 Board criterion children pass. Board parent5.474s under dated9.7s allowance, not5s/4s budget pass. Deferred local Darwin Actions6/6 A-8940 and Board4/4 A-8941 after quiet lift also pass with teardown. C1–C3 verified. Host1dd0f4c reused; lint/duration/ratchet report-only,10missing baselines. No T3/T4/load/QA claim; Coordinator joint postlanding cover pair/stage QAs separate.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-23 · 2026-10-22T05:19:01.736Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1074-graph-merge-delta
commit: c208460d31cae81cdf691591b415b9b54601e8f0
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Graph/dev merge delta source clear; A-8951. Coordinator16457447 authorization confirmed. Conflict docs preserve both test families; ItemsView retains Graph enable/render, Tree reveal and navigation invalidation. Shared Graph selection/scope/back/marks integrate through existing dispatcher/preferences. Board/M1–M4 source preserved unchanged; geometry and allowance blobs identical. Original red A-8946 and local Actions7/7/Board4/4/Graph4/4/check A-8947–A-8950 inspected; lint report-only, no configured pass inferred. No findings. C1–C3 unverified pending exact-head mode-free receipt; prior c2267513 pass historical, integrated covers/stage QAs separate.

### rev-23 · 2026-10-22T05:28:54.805Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1074-graph-merged-final
commit: c208460d31cae81cdf691591b415b9b54601e8f0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final Graph-merged evidence clear; A-8953 audits original A-8952/033cceae against source-clear A-8951. Census2409 ordinary tests/366files pass,zero fail/cancel/skip; T1/all hub+NeovimT2/actualWeb exit0. All7 Actions pass incl Graph and M1–M4; all Board/Graph criterion children pass. Local Actions7/7/Board4/4/Graph4/4/check A-8947–50 retained. C1–C3 verified. Board5.842s under approved9.7s allowance; Graph4.227s and Web40.26s report-only reference overages,not enforcing-budget passes. Host568e9696 reused,lint/duration/ratchet report-only,11missing baselines; no T3/T4/load/QA claim. Joint integrated covers/stage QAs separate.

Criteria: C1 verified, C2 verified, C3 verified.
