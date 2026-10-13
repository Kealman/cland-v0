---
id: T-192
kind: task
title: Layers on items, messages and artifacts; pins and mutes on topics,
  sessions and artifacts kept in ui.json
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: impl-192
parent: E-115
blocked_by:
  - T-190
topic: topic-134
branch: t/T-192-layers-on-items-messages-and-artifacts
created: 2026-10-10T16:25:06.507Z
updated: 2026-10-11T14:46:51.383Z
closed: 2026-10-11T14:46:51.522Z
---

## Parent

T-115, slice 3 of 6. Read the epic's Contents, its choice where the spec is silent ([visibility] keyed by surface and kind, each value a layer) and its Constraints.

## What to build

The items panel's filters as layers; messages older than 7 days archived; artifact lists by layer; pin and mute on topics, sessions and artifacts, kept in `ui.json`.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-192 · 2026-10-11T13:24:01.419Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-192-5 · 2026-10-11T13:28:06.508Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-192-7 · 2026-10-11T14:25:06.985Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-192-9 · 2026-10-11T14:46:38.177Z · commit 91b6de94753534c77c30104887f19a8f348a5707
- [x] C2. Demo: the human mutes a noisy topic and pins a Reviewer, and both survive a restart.
  - done: impl-192 · 2026-10-11T11:42:12.156Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-192-1 · 2026-10-11T11:55:06.254Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-192-2 · 2026-10-11T12:09:32.331Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-192-3 · 2026-10-11T12:13:49.680Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-192-5 · 2026-10-11T13:28:06.508Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-192-7 · 2026-10-11T14:25:06.985Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-192-9 · 2026-10-11T14:46:38.177Z · commit 91b6de94753534c77c30104887f19a8f348a5707
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-192 · 2026-10-11T11:42:12.409Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-192-1 · 2026-10-11T11:55:06.475Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-192-2 · 2026-10-11T12:09:32.331Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-192-3 · 2026-10-11T12:13:49.680Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-192-5 · 2026-10-11T13:28:06.508Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-192-7 · 2026-10-11T14:25:06.985Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-192-9 · 2026-10-11T14:46:38.178Z · commit 91b6de94753534c77c30104887f19a8f348a5707
- [x] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
  - verified: rev-13 [reviewer] · run rev-13-20261011-192-6 · 2026-10-11T14:20:05.641Z
  - done: impl-192 · 2026-10-11T14:44:17.075Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-192-8 · 2026-10-11T14:45:26.717Z · commit 91b6de94753534c77c30104887f19a8f348a5707
  - verified: rev-13 [reviewer] · run rev-13-20261011-192-9 · 2026-10-11T14:46:38.178Z · commit 91b6de94753534c77c30104887f19a8f348a5707

## Comments

### impl-192 · 2026-10-11T11:23:28.455Z

Claimed at dev 1697ced in the hub-created T-192 worktree. Implementing §3.5 through the existing classifier and persisted UI-state seams; protocol and headless Neovim tests are the agreed acceptance seams.

### impl-192 · 2026-10-11T11:42:11.475Z

Implemented hub-owned pin/mute preferences via a human-only visibility.set frame, preserving ui.json layout fields; added item layer filters and background folds, topic folds/archive, and thread archive toggling with recent-answer preservation. Protocol restart/permissions/needs-you checks and headless layers, artifact browser, UI persistence, board and item tests pass. Historical DST fixtures now use explicit archive. Final full-suite evidence remains pending on committed head fd67d40; origin/dev was fetched and is already merged.

### impl-192 · 2026-10-11T11:51:46.148Z

Internal spec review found and verified fixes for concurrent ui.json writers, plan-mode layer filtering, and archive retrieval beyond 200 messages. Added boundary regressions; existing UI preferences 9/9 and plan 11/11 tests pass, as does typecheck. Pushed head 3648437e329ec93b12cc441a62453861a59090e4; origin/dev fetched and already current. Review and full suite requested next; C4 remains pending.

### rev-13 · 2026-10-11T11:55:06.661Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261011-192-1
commit: 3648437e329ec93b12cc441a62453861a59090e4

Medium — hub/src/hub/visibility-preferences.ts:46: visibility.set calls synchronous filesystem mutation on the serving path (dispatch.ts:1029), violating hub/README.md:410,439's shared-loop async boundary.

Medium — nvim/lua/cland/vboard.lua:200 and nvim/lua/cland/plan.lua:632: default sections omit done, while more accepts only Background; a done task raised to Watch/Now by items.done override or topic pin disappears despite §3.5's foreground rule.

Medium — hub/src/hub/visibility-preferences.ts:60 and nvim/lua/cland/ui.lua:77: stale recovery unlinks the pathname without retaining ownership of the observed lock; two recoverers can delete a newly acquired live lock and overlap read/replace, losing a persisted choice. Lua also treats EPERM liveness failure as dead.

C1 failed. C2/C3 separately verified with this run from restart key/protocol coverage and docs; C4 remains pending. Independent typecheck and diff checks pass on clean pushed 3648437. A-1233: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1233-t-192-at-3648437-serving-path-promoted-done-and-stale-lock-findings.md keeps Standards and Spec findings separate with concrete scenarios and validation limits. No edits or reviewer suites.

Criteria: C1 failed (visibility.set performs synchronous request-path filesystem I/O; foreground done items vanish from board/plan; competing stale-lock recovery can overwrite persisted choices.).

### impl-192 · 2026-10-11T12:05:17.763Z

Fixed all A-1233 findings in cf42f36: async serialized visibility writes with resumed measurement, unique-owner directory-lock recovery preserving replacement/uncertain owners, and Now/Watch done rows through closed ancestry in board/plan. Boundary regressions pass; visibility 14/14, layers 12/12, vboard 7/7, plan 11/11, UI 9/9, init/update 2/2 and typecheck pass. Fetched/merged origin/dev 4846a44, pushed resulting head 88b990372452d5d2bad24566c4cae184ec23fe22. A new review and full-suite request follows; superseded suite was interrupted (A-1234), C4 stays pending.

### impl-192 · 2026-10-11T12:06:41.461Z

Suite A-1236 failed typecheck at 88b9903 due to a final-cleanup arrow-object syntax error. Corrected in 7197c0ba73e4708e8da06cac31f963c5be623b7b; typecheck and the three focused asynchronous persistence protocol regressions pass. origin/dev fetched and already merged, head pushed. Requesting review/new full suite at 7197c0b; C4 remains pending.

### rev-13 · 2026-10-11T12:09:32.331Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-192-2
commit: 7197c0ba73e4708e8da06cac31f963c5be623b7b

No high, medium or low findings remain. All three prior C1 findings are resolved: preference writes are async/serialized with resumed measurement; unique-owner directory recovery preserves replacements and uncertain PID owners; foreground done rows remain visible in board/plan through closed ancestry. Boundary assertions cover responsiveness, concurrent choices, replacement/EPERM preservation and config/topic promotion. Both axes are clear.

C1–C3 freshly verified at 7197c0; restart demo and docs remain supported. Independent typecheck and diff checks pass, clean local/pushed heads match. C4 remains pending the fresh same-head full suite. A-1236 is failed evidence at superseded 88b9903, not acceptance; no exception applied. A-1240: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1240-t-192-corrected-7197c0-c1-c3-clear-full-suite-pending.md records separate axes and validation limits. No edits or reviewer suite runs.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-192 · 2026-10-11T12:12:33.217Z

Coordinator supplied shared dev test fix 7eb519c from T-171 for both moved-draft artifact tests; cherry-picked unchanged as 9ed0f38d3c415d022015251171ba12f6b75e5349 and pushed. No implementation changes from reviewed 7197c0b. origin/dev fetched/already merged. Stopped the old-head suite while it was waiting on the lock (A-1244), requesting same-head review and replacement full suite.

### rev-13 · 2026-10-11T12:13:49.680Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-192-3
commit: 9ed0f38d3c415d022015251171ba12f6b75e5349

No high, medium or low findings. Both axes confirm the only delta adds the previously reviewed source-artifact readiness waits to both moved-draft tests, preserving timeouts and move/reconnect/save assertions. Product behavior, corrected C1 implementation, restart demo and docs remain unchanged; C1–C3 are freshly verified at 9ed0f38.

Diff check passed, local/pushed heads match clean 9ed0f38. Typecheck passed on predecessor 7197c0 and was not repeated for the test-only addition. C4 awaits the replacement full suite on this head; A-1244 was intentional old-head lock-wait interruption, not acceptance evidence. No exception applied. A-1248: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1248-t-192-readiness-only-delta-at-9ed0f38-c1-c3-clear.md records separate axes. No edits or reviewer tests.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-13 · 2026-10-11T13:17:32.006Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261011-192-4
commit: 9ed0f38d3c415d022015251171ba12f6b75e5349

Medium — nvim/lua/cland/vboard.lua:63: the foreground ancestry bypass leaks planned T-30 onto the center board after its epic closes, violating the documented open-parent scope. Coordinator 42c64934 requires a code fix and unchanged shell.test.ts:1345; promoted done rows belong inside vertical/plan views.

Medium — hub/src/hub/visibility.ts:147: planned is selected before release membership, placing unparented T-19 in Watch. Coordinator b0d17bb7 requires unscheduled Background regardless of status, inside-release planned Watch coverage, and retained PANELS-013 unfold reachability.

Medium — nvim/test/qa.test.ts:94 and nvim/test/shell.test.ts:1059,1101,1320: A-1268 has five failures, so C4 is unmet. Update future-row and closed-topic expectations with explicit unfold/A reachability under §3.5, preserving navigation, persistence, read/close/resolve assertions; fix the two product issues above.

Typecheck passed; hub 1217/1217 and Neovim 276/281, total 1493/1498, five failures, zero cancel/skip/todo, exit 1. C1/C4 failed; C2/C3 evidence stands. No exception or edits. A-1269: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1269-t-192-full-suite-at-9ed0f38-scope-classification-fixes-and-c4-failure.md records separate axes, screens/stacks and both scope decisions.

Criteria: C1 failed (Shared compose leaks Now/Watch tasks beneath closed parents onto the center board; planned unparented items are Watch instead of unscheduled Background under Coordinator scope decisions.), C4 failed (A-1268 full suite exits 1: hub 1217/1217, Neovim 276/281; five QA/topics/board failures, no exception.).

### impl-192 · 2026-10-11T13:24:01.301Z

Repaired C1/C4 findings at e9d0a615384dae44cd3005004df29cc637b27ae0. Restored centre-board open-parent scope while vertical/plan preserve foreground promotion; planned classification now requires current-release membership. §3.5 evidence and archive/unfold reachability in A-1270 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1270-t-192-repaired-scope-and-release-classification-at-e9d0a61.md). Fetched/merged origin/dev b1add76 (T-171) and pushed; targeted classifier, warning integration, session/inbox and layer coverage passes. Requesting repaired-head review and new locked all suite; C4 pending.

### rev-13 · 2026-10-11T13:28:06.508Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-192-5
commit: e9d0a615384dae44cd3005004df29cc637b27ae0

Standards: clear; no high or medium finding remains.
Spec: clear for C1–C3 at e9d0a615384dae44cd3005004df29cc637b27ae0. nvim/lua/cland/vboard.lua:53 restores the centre-board open-parent boundary; private panel composition at :83 preserves vertical promotion. hub/src/hub/visibility.ts:163 checks current-release membership before planned Watch placement. Archive/unfold test updates retain reachability and operation assertions; T-171 warnings preserve severity, dismissal rules and needsYou exclusion through human pin/mute integration. Cold-restart persistence and docs remain supported.
Independent typecheck exit 0; clean local/pushed head and diff check verified. A-1270 targeted evidence reviewed. Full two-axis evidence: A-1272, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1272-t-192-repaired-e9d0a61-c1-c3-clear-full-suite-pending.md.
Verified C1,C2,C3. C4 is pending the fresh complete same-head all suite; no old run or exception is acceptance evidence.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-192 · 2026-10-11T14:19:04.508Z

C4 complete on reviewed/pushed head e9d0a615384dae44cd3005004df29cc637b27ae0: locked cland suite all 4901de55-8f77-473b-93f0-f939ba0efee9 exits 0; 1499/1499 pass, zero fail/cancel/skip/todo. Typecheck and both package phases completed. Durable evidence A-1283: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1283-suite-4901de55-8f77-473b-93f0-f939ba0efee9-all-at-e9d0a61.log. C1–C3 already clear in rev-13-20261011-192-5; reviewer receives this same-head suite directly. Keeping claim for final gate/merge.

### rev-13 · 2026-10-11T14:20:05.641Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-192-6
commit: e9d0a615384dae44cd3005004df29cc637b27ae0

No high, medium or low findings. C4 explicitly verified at unchanged clean/pushed e9d0a615384dae44cd3005004df29cc637b27ae0 from complete A-1283: typecheck and both full test phases pass; hub 1218/1218 + Neovim 281/281 = 1499/1499, zero failures/cancellations/skips/todo, exit 0. The five prior presentation/scope cases pass; no exception applied.
C1–C3 remain verified at this same head in rev-13-20261011-192-5/A-1272. Both source review axes stand; all criteria now support final readiness.
A-1284: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1284-t-192-final-c4-at-e9d0a61-full-1499-1499-clear.md. Read-only review; no edits or extra suite.

Criteria: C4 verified.

### impl-192 · 2026-10-11T14:23:23.303Z

Merged origin/dev 405165d per Coordinator e1ae3ad6, resolved sole browser-test conflict retaining both delete cases and all layer/pin/mute cases. Pushed new head 91b6de94753534c77c30104887f19a8f348a5707. gP/gM do not collide with x; deletion of a pinned artifact leaves active sections and zR, remains reachable with A. Browser 11/11, layers 16/16, visibility 15/15 pass; row-readiness waits remove a search-before-render race in the restart demo. Evidence A-1285: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1285-t-192-t-219-browser-merge-key-and-deletion-filtering-checks.md. New review and suite all requested; C4 freshness pending the new head's run.

### rev-13 · 2026-10-11T14:25:06.985Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-192-7
commit: 91b6de94753534c77c30104887f19a8f348a5707

No high, medium or low findings. Both axes clear on the T-219/T-166 merge. Browser x is distinct from registered gP/gM; cancel/confirm and attachment-only delete coverage remain beside layer tests. fileDeleted forces even pinned artifacts out of active sections and zR; A reaches the tombstone. Creation and attachment chips retain deletion marks. Inbox caps use shared layers without altering needsYou or warning dismissal rules.
Restart demo waits for rendered rows before searches, retaining persistence/cold-restart/filter/toggle assertions. Docs and prior C1–C3 behavior remain supported.
Independent typecheck exit 0, clean local/pushed head and diff check verified. A-1285 targeted browser 11/11, layers 16/16 and visibility 15/15 inspected. C1–C3 freshly verified; C4 awaits the new full suite at this exact head, and predecessor A-1283 is historical only. No exception.
A-1286: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1286-t-192-browser-merge-at-91b6de9-c1-c3-clear-new-suite-pending.md. Read-only review.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-192 · 2026-10-11T14:44:17.185Z

New-head C4 full validation passes at 91b6de94753534c77c30104887f19a8f348a5707: suite all 93f59f63-9bd2-440a-864c-20d32c47c0a6 exits 0, typecheck and both test phases complete, 1519/1519 passing with zero fail/cancel/skip/todo. A-1288: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1288-suite-93f59f63-9bd2-440a-864c-20d32c47c0a6-all-at-91b6de9.log. C1–C3 already freshly verified at this head in rev-13-20261011-192-7. No changes since review. Reviewer has same-head suite; claim retained until merge.

### rev-13 · 2026-10-11T14:45:26.717Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-192-8
commit: 91b6de94753534c77c30104887f19a8f348a5707

No high, medium or low findings. C4 explicitly verified at unchanged clean/pushed 91b6de94753534c77c30104887f19a8f348a5707 from complete A-1288: typecheck and both full phases pass, hub 1232/1232 plus Neovim 287/287 = 1519/1519, zero failure/cancellation/skip/todo, exit 0. Browser pin/mute, pinned x cancel/confirm deletion, attachment-only deletion and cold-restart cases all pass. No exception applied.
C1–C3 retain same-head verification from rev-13-20261011-192-7/A-1286, so all criteria support final readiness.
A-1289: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1289-t-192-final-c4-at-91b6de9-full-1519-1519-clear.md. Read-only review; no changes or extra suite.

Criteria: C4 verified.

### rev-13 · 2026-10-11T14:46:38.178Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-192-9
commit: 91b6de94753534c77c30104887f19a8f348a5707

No high, medium or low findings. Re-recording C1–C4 with explicit commit 91b6de94753534c77c30104887f19a8f348a5707 per Coordinator b42b78eb after T-209 activation; old C1–C3 marks lacked a commit. Clean local/pushed head is unchanged.
C1 end-to-end integration, C2 cold-restart preferences and C3 docs remain supported by exact-head A-1286/run 192-7. C4 exact-head A-1288 passes typecheck and full hub 1232/1232 plus Neovim 287/287 = 1519/1519, zero failures/cancellations/skips/todo, exit 0. A-1289/run 192-8 records full-suite review. All four criteria checked; no exception or additional edits/tests.
A-1290: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1290-t-192-commit-bound-c1-c4-re-record-at-unchanged-91b6de9.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-11T14:46:51.383Z

Merged 8bde6353ce61db9dcf988dda07c1c4e08839e97c onto dev.
