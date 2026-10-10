---
id: T-151
kind: task
title: "The Aide speaks for the human: the crew's clauses say so; the thread's speaks-for-you mark and dashed blue bar; Aide messages never fold"
state: open
status: planned
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-111
blocked_by:
  - T-148
  - T-135
topic: null
branch: null
created: 2026-10-10T05:33:00.860Z
updated: 2026-10-10T09:25:25.755Z
---

## Parent

T-111 (The human's own session), slice 4 of 5. Spec §3.3 (Its voice is the human's), §3.14.

## What to build

The crew's role clauses say that an Aide speaks for the human, decisions included. An Aide's messages show as `aide-1 [Aide]` with the thread's "speaks for you" mark and the human's blue as a dashed bar (§3.14); messages to or from an Aide never fold.

## Acceptance criteria

- [ ] The default Coordinator, Implementer, Reviewer and QA clauses state that an Aide speaks for the human; list the exact `.cland/roles.toml` lines.
- [ ] In the thread, an Aide's message carries the "speaks for you" mark and the dashed blue bar, and never folds.
- [ ] Demo: an Aide tells the Coordinator to rank one task above another, and the Coordinator treats it as the human's decision.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. ADRs 0001 (roles are hub-held state), 0004 (local git territory), 0003. Research `research/harness-surfaces` (where each adapter puts the role clause; Codex puts it in its first turn). References: `prototype/panels` ("yours" group and `␣A` in `panels.lua`, `palette.lua`), mockups `SessionsPanel.dc.html`, `Palette.dc.html`, `Thread.dc.html`; spec words win, then prototype behaviour, then mockups. The epic's choices where the spec is silent apply. Tests through the v0 seams: hub frame protocol, fake harnesses, headless Neovim; no new seams inside the hub. Instance lines (roles.toml) are listed exactly in the report; the Coordinator commits them.
