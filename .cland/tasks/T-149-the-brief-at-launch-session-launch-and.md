---
id: T-149
kind: task
title: "The brief at launch: session.launch and the CLI take a brief (text or artifact), delivered once after the role clause on all three adapters, never again on reconnect"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-111
blocked_by:
  - T-141
topic: null
branch: null
created: 2026-10-10T05:33:00.327Z
updated: 2026-10-10T05:33:00.327Z
---

## Parent

T-111 (The human's own session), slice 2 of 5. Map T-81, "Settled while charting" (a brief at launch).

## What to build

`session.launch` and `cland session launch` take a brief: text, or an artifact id `A-<n>` whose content is read at launch. The hub delivers it once, right after the role clause and before the session's first turn, through the ordinary queue and stages, on Claude Code, Codex and OpenCode. It is never delivered again on reconnect or hub restart; the journal records it like a message.

## Acceptance criteria

- [ ] An Implementer launched with a brief starts on it with no other message, on each of the three fake harnesses; the brief arrives after the clause.
- [ ] A reconnect or a hub restart does not redeliver the brief; a test proves both.
- [ ] A brief naming an artifact delivers that artifact's content; an unknown artifact is refused at launch.
- [ ] The brief does not race the hub's welcome (the T-106 concern).
- [ ] `hub/README.md` documents the brief.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. ADRs 0001 (roles are hub-held state), 0004 (local git territory), 0003. Research `research/harness-surfaces` (where each adapter puts the role clause; Codex puts it in its first turn). References: `prototype/panels` ("yours" group and `␣A` in `panels.lua`, `palette.lua`), mockups `SessionsPanel.dc.html`, `Palette.dc.html`, `Thread.dc.html`; spec words win, then prototype behaviour, then mockups. The epic's choices where the spec is silent apply. Tests through the v0 seams: hub frame protocol, fake harnesses, headless Neovim; no new seams inside the hub. Instance lines (roles.toml) are listed exactly in the report; the Coordinator commits them.
