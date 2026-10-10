---
id: T-134
kind: task
title: "Folded agent runs: one message-layer rule, manual per-run folds with the fold keys and Enter, the folded count, what never folds"
state: open
status: in progress
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-110
blocked_by:
  - T-133
topic: null
branch: t/T-134-folded-agent-runs-one-message-layer-rule
created: 2026-10-10T01:20:46.817Z
updated: 2026-10-10T03:56:42.818Z
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
