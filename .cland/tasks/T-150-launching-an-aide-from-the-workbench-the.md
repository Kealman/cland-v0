---
id: T-150
kind: task
title: "Launching an Aide from the workbench: the palette action, a and ␣A with the role's defaults and a brief field; the yours group at the top of the sessions panel"
state: open
status: planned
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-111
blocked_by:
  - T-148
  - T-149
  - T-136
topic: null
branch: null
created: 2026-10-10T05:33:00.581Z
updated: 2026-10-10T09:25:25.469Z
---

## Parent

T-111 (The human's own session), slice 3 of 5. Spec §3.3 (Launch and place), §3.11.

## What to build

The palette action, `a` and `␣A` open the launcher filled from the `aide` role's defaults, with the project root as working directory and a brief field. The sessions panel shows a "yours" group at the top holding the human's Aides; an Aide attaches in the centre like any session. Keys go through the action registry.

## Acceptance criteria

- [ ] `␣A`, a one-line brief and Enter launch `aide-1`, which appears under "yours" and attaches in the centre.
- [ ] The palette action and `a` in the sessions panel do the same; each key is registered.
- [ ] Headless QA cases cover the launcher and the "yours" group; `nvim/README.md` documents them.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. ADRs 0001 (roles are hub-held state), 0004 (local git territory), 0003. Research `research/harness-surfaces` (where each adapter puts the role clause; Codex puts it in its first turn). References: `prototype/panels` ("yours" group and `␣A` in `panels.lua`, `palette.lua`), mockups `SessionsPanel.dc.html`, `Palette.dc.html`, `Thread.dc.html`; spec words win, then prototype behaviour, then mockups. The epic's choices where the spec is silent apply. Tests through the v0 seams: hub frame protocol, fake harnesses, headless Neovim; no new seams inside the hub. Instance lines (roles.toml) are listed exactly in the report; the Coordinator commits them.
