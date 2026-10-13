---
id: T-134
kind: task
title: "Folded agent runs: one message-layer rule, manual per-run folds with the
  fold keys and Enter, the folded count, what never folds"
state: closed
status: done
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: E-110
blocked_by:
  - T-133
topic: topic-56
branch: t/T-134-folded-agent-runs-one-message-layer-rule
created: 2026-10-10T01:20:46.817Z
updated: 2026-10-10T04:56:55.500Z
---

## Parent

T-110 (Threads that read), slice 3 of 5. Spec §3.14 (Folds), §3.5 (Messages row).

## What to build

One message-layer function classifies every message as now (addressed to the human; asks), watch (the Coordinator's reports to the human; a clear verdict) or background (agent to agent). Until the `report` kind of "A quiet Coordinator" exists, every Coordinator message to the human counts as now. The function is the single place later epics replace ("Visibility and artifacts").

A run of consecutive background messages folds into one faint line, such as "impl-58 → rev-6 · 4 messages". Asks, verdicts, answers, and anything to or from the human or an Aide never fold. An agent's artifact post with no addressee folds into the run around it. Folds are manual, per run and per window, because automatic folds do not update while the human types in the composer. `zo`, `za`, `zc`, `zR`, `zM` and Enter work on runs, and they are registered in the action registry. The thread's header counts the folded messages. An open run stays open across rewrites.

## Acceptance criteria

- [ ] An Implementer and a Reviewer's exchange of four messages shows as one line that `za` opens and closes, and Enter does the same.
- [ ] Asks, verdicts, answers, and messages to or from the human never fold; a test covers each.
- [ ] An open run survives an append and a full rewrite; folds are per window.
- [ ] The header shows the folded count.
- [ ] The classification lives in one function, with tests for every row of the §3.5 Messages table.
- [ ] Headless QA cases cover the keys, as the successor of `THREAD-KEYS`.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. References in order of authority: spec §3.14 and §3.5 (the Messages row), then `prototype/thread` (commit `faec351`: `nvim/lua/cland/thread.lua`, `thread_md.lua`, `hl.lua`; checks in `nvim/proto/thread/`), then the mockup `docs/design/main-screen/Thread.dc.html` and `screens/v01-thread.png`. Research `docs/research/nvim-rendering.md` (T-86). ADR 0005: bundled tree-sitter, extmarks, `'statuscolumn'`, folds, no plugins. Keys go through the action registry (T-126); text fitting through the cell-budget fitter (T-125). Tests: headless Neovim on the stub hub; QA cases in `qa/cases/` at 120 and 80 columns.

## Comments

### coord · 2026-10-10T02:43:21.637Z

Coordinator note for the Implementer: T-86's narrow-width breakage 'foldtext clipping' was deferred from T-133 to this ticket, because the folds are built here. Fit the fold summary line through the cell-budget fitter, and add an 80-column QA case for it.

### impl-134 · 2026-10-10T03:57:40.947Z

Implementation started from a818642. Read the item, epic, spec, accepted prototype and predecessor notes; fold state will follow surviving run members per window, with fitted summaries and headless key coverage at both widths.

### impl-134 · 2026-10-10T04:07:03.845Z

Implemented thread.layer, manual day-bounded runs, per-window surviving-member state, all requested registry keys, Enter, fitted summaries and actual closed-message header counts. THREAD-005/006 pass at 120/80; the extended rendering differential passes all four histories/96 live mutations with alternating open runs plus fold metadata, and the separate membership differential passes extension/split/eviction/union/rewrite/hidden-window changes. Registry audit passes. Final typecheck, commit and one locked root suite follow.

### rev-7 · 2026-10-10T04:12:15.051Z

verdict: review
result: not clear
by: rev-7 [reviewer]
run: rev-7-134-1
commit: 4cc1b16cc1693d93c0e6c5ae09788e287091db1e

Medium — nvim/lua/cland/thread.lua:985: hidden-window saved membership is not extended during appends/retention; once all originally saved ids expire, re-entry closes a continuously extended open run, breaking append inheritance and hidden-window state preservation.

Confirmed on pinned production Lua in native Neovim, read-only: LIMIT=2, open same-day background [a,b], switch the window to scratch, append c/d, return. Retained ids are [c,d] but left_states is still {a=true,b=true}; folded_count is 2, expected 0. The same path fails at LIMIT=200 after enough hidden appends. Update hidden-window membership as blocks mutate and add a differential that evicts every initially saved member while hidden. Current hidden test appends once with original ids surviving and misses it.

Full ten-file review against a818642. Standards clear; Spec has this one medium finding. Classifier/boundaries, manual keys, visible-window identity rules, fitted summaries/80-column QA, counts and local-only options otherwise align. Diff check passes; no suite or shipped QA case run.

Evidence: A-410, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-410-t-134-review-rev-7-134-1-at-4cc1b16-hidden-retention-loses-open-state.md.

### impl-134 · 2026-10-10T04:15:55.219Z

Corrected the hidden-window retention defect found by rev-7 at b46a66c787b7cfa9ec23b42fca66cc9c90b88d6c (copied from git log -1). Per-window state now transitions for every append/eviction regardless of visibility and collects evicted ids; rendering consumes the model. Extended hidden differential is red on 4cc1b16 and green after appending through complete original-member eviction with one and then both windows hidden, preserving independent open/closed states. Focused differential, budget, option, QA width checks and typecheck pass. Queued old-head root suite cancelled per Coordinator; delta review next.

### rev-7 · 2026-10-10T04:18:04.697Z

verdict: review
result: clear
by: rev-7 [reviewer]
run: rev-7-134-2
commit: b46a66c787b7cfa9ec23b42fca66cc9c90b88d6c

No high, medium or low findings remain. Full-item clear at b46a66c787b7cfa9ec23b42fca66cc9c90b88d6c: carry forward rev-7-134-1/A-410's baseline checks and resolve its sole medium hidden-retention defect.

The three-file delta transitions every window's fold model on mutation, propagates openness to new members before eviction, and rebuilds maps to collect expired IDs. fold_ready keeps stale native folds from replacing saved state on re-entry. README and the strengthened hidden differential agree: complete original-member eviction, both windows hidden, fresh-render comparison and independent open/closed maps are checked. No assertion weakened or new window-option/text-seam mutation introduced.

A-410's exact read-only native production-source probe now passes: retained [c,d] is open (folded_count=0), with state {c=true,d=true} and expired a/b removed. An additional both-hidden-window retention probe also passes: open window count0, closed window count2, maps exactly {e=true,f=true}/{e=false,f=false}. Independent Standards and Spec axes clear; diff check passes. No suite or shipped QA case run.

Evidence: A-413, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-413-t-134-delta-review-rev-7-134-2-at-b46a66c.md.

### impl-134 · 2026-10-10T04:37:17.652Z

Root b46a66c suite exposed a deterministic vertical-board rank regression: head 3/3 failures versus base a818642 3/3 passes. One-variable probes: removing fold-count lookup, window-entry handler, or new mappings each remained red; disabling native reconstruction passed. Replacing only normal! zE with Ex folddelete passed the unchanged vboard file three times. Added a red regression showing non-thread windows reached native fold commands (3 commands); applying guards and Ex-only reconstruction now, with thread differential and unchanged board file under verification.

### impl-134 · 2026-10-10T04:45:52.909Z

Committed board regression correction at b05b8340a7e347d5ed62277480b4e61a206a0c3b (copied from git log -1), pushed to local territory. Guard every fold read/build/key/count target; skip empty native reconstruction. Actual manual deletion stays scoped zE because Neovim has no Ex deletion and automatic resets fail Insert-mode QA. Final real-run board reset/zero-fold-level/state/T-J-K check is red at b46a66c and green here; unchanged vboard 4/4, full thread 19/19, width QA 2/2, typecheck/diff check pass. Evidence A-426. Per Coordinator, committed-head locked test:nvim follows; previous hub 838/838 carries forward.

### rev-67 · 2026-10-10T04:49:43.196Z

verdict: review
result: clear
by: rev-67 [reviewer]
run: rev-67-134-1
commit: b05b8340a7e347d5ed62277480b4e61a206a0c3b

Full-item clear at b05b8340a7e347d5ed62277480b4e61a206a0c3b, carrying rev-7-134-2 / A-413's full-item clearance at b46a66c and reviewing the correction delta.

Standards: 0 actionable findings. Spec: 0 actionable findings. No high or medium findings remain.

All fold operations validate the target thread buffer; unsuppressed normal! zE runs only inside the guarded thread window. Empty/no-fold threads skip commands; stale folds are deleted. New regression checks board state and T/J/K ranking without weakening existing assertions.

Read-only native Neovim v0.12.5 probe passed: two-message background run rebuilt and fully rendered from real composer Insert mode, preserving mode i, focus and cursor; foreign fold targets were rejected. git diff --check passed and worktree is clean. No suite run or source edits.

Evidence: A-429 — /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-429-t-134-full-item-clear-review-at-b05b834.md

### impl-134 · 2026-10-10T04:56:26.721Z

Final committed-head verification passed on b05b8340a7e347d5ed62277480b4e61a206a0c3b (git log -1): locked npm run test:nvim 183/183, zero failures/skips, 136.23s run after 468.03s lock wait, peak load 5.96. Both QA widths, real-run board guard/reset/T-J-K check, unchanged vboard rank test and all fold differentials pass. Retained append 1.164ms and warm rewrite/redraw 19.638ms stay within budget. Typecheck passed; worktree clean. Full-item review clear at this head (rev-67-134-1/A-429); Coordinator-approved carry-forward hub 838/838 from A-418. Suite log A-430 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-430-t-134-committed-head-neovim-suite-b05b834-183-183-passed.log. No merge performed.

### coord · 2026-10-10T04:56:42.508Z

Merged 14065d4039248bd360a957856e4bc452108870fe onto dev.

### coord · 2026-10-10T04:56:55.500Z

Merged by the Coordinator through `cland merge T-134`, after `cland push`: squash 14065d4 on dev.
Gate: review rev-67-134-1 clear on b05b834 (A-429), carrying forward rev-7-134-2 (A-413). Earlier rounds:
- rev-7-134-1 (A-410): hidden-window fold state was lost when every original member was evicted; fixed by state transitions that are independent of visibility, with garbage collection of evicted ids.
- The full suite on b46a66c found a vertical-board regression: vboard.test.ts:96 failed 3 of 3 on head and passed 3 of 3 on base. The cause was `normal! zE` running Normal mode during background rendering. The fix guards every fold target, runs `zE` only inside a guarded thread-window call and only when needed, and skips empty threads. A real-run board check proves the folds are deleted and the board state is preserved (A-426, A-427).
Decisions:
- one layer classifier, replaceable by T-115;
- run identity: append inherits, split preserves both halves, first-member eviction preserves, join takes the union;
- foldtext clipping from T-133 is done here;
- `zE` stays, because deletion has no Ex form;
- no `silent!` suppression.
Evidence: Neovim 183 of 183 on b05b834 (A-430). Hub 838 of 838 carries over from b46a66c, since the delta changes only Neovim code. Append 1.2 ms, warm rewrite 19.6 ms.
