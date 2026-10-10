---
id: T-136
kind: task
title: "The top bar counts now: now-layer messages and asks only, through the message-layer rule"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-110
blocked_by:
  - T-134
topic: null
branch: null
created: 2026-10-10T01:20:47.341Z
updated: 2026-10-10T01:20:47.341Z
---

## Parent

T-110 (Threads that read), slice 5 of 5. Spec §3.5 (How surfaces show them).

## What to build

The top bar's count takes only now-layer messages and asks, through the message-layer function from slice 3. Agent-to-agent traffic in any topic no longer raises it.

## Acceptance criteria

- [ ] A burst of agent-to-agent messages in an item topic leaves the top bar's count unchanged; a message addressed to the human raises it; an ask raises it.
- [ ] The count uses the slice-3 classifier; no second rule exists.
- [ ] Headless QA cases cover the count.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. References in order of authority: spec §3.14 and §3.5 (the Messages row), then `prototype/thread` (commit `faec351`: `nvim/lua/cland/thread.lua`, `thread_md.lua`, `hl.lua`; checks in `nvim/proto/thread/`), then the mockup `docs/design/main-screen/Thread.dc.html` and `screens/v01-thread.png`. Research `docs/research/nvim-rendering.md` (T-86). ADR 0005: bundled tree-sitter, extmarks, `'statuscolumn'`, folds, no plugins. Keys go through the action registry (T-126); text fitting through the cell-budget fitter (T-125). Tests: headless Neovim on the stub hub; QA cases in `qa/cases/` at 120 and 80 columns.
