---
id: T-152
kind: task
title: "An Aide takes an item: its claim gives it the worktree and branch, moves status, makes it the lead, and its work passes the same gate"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-111
blocked_by:
  - T-148
topic: null
branch: null
created: 2026-10-10T05:33:01.124Z
updated: 2026-10-10T05:33:01.124Z
---

## Parent

T-111 (The human's own session), slice 5 of 5. Spec §3.3 (Tools, a claim is allowed).

## What to build

An Aide's claim works like an Implementer's: it gets the item's branch and worktree, its claim moves the item's status like an Implementer's (the epic's choice), `@lead T-n` resolves to it while it holds the claim, and its work goes through review and the merge gate unchanged.

## Acceptance criteria

- [ ] An Aide claims a task and gets its worktree and branch; the status moves to `in progress`.
- [ ] A Reviewer reviews its work and the merge gate treats it like an Implementer's, including the self-verdict refusal.
- [ ] `@lead T-n` resolves to the Aide while it holds the claim.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. ADRs 0001 (roles are hub-held state), 0004 (local git territory), 0003. Research `research/harness-surfaces` (where each adapter puts the role clause; Codex puts it in its first turn). References: `prototype/panels` ("yours" group and `␣A` in `panels.lua`, `palette.lua`), mockups `SessionsPanel.dc.html`, `Palette.dc.html`, `Thread.dc.html`; spec words win, then prototype behaviour, then mockups. The epic's choices where the spec is silent apply. Tests through the v0 seams: hub frame protocol, fake harnesses, headless Neovim; no new seams inside the hub. Instance lines (roles.toml) are listed exactly in the report; the Coordinator commits them.
