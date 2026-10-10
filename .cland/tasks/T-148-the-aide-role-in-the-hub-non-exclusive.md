---
id: T-148
kind: task
title: "The Aide role in the hub: non-exclusive role, its exact tools and refusals, routing that keeps Aides out of broadcasts, all, Agents notices, asks and @lead"
state: open
status: in progress
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-111
blocked_by:
  - T-141
topic: topic-69
branch: t/T-148-the-aide-role-in-the-hub-non-exclusive
created: 2026-10-10T05:33:00.073Z
updated: 2026-10-10T08:41:16.330Z
---

## Parent

T-111 (The human's own session), slice 1 of 5. Spec §3.3.

## What to build

The `aide` role: non-exclusive, in `.cland/roles.toml` (`[aide]`, `[aide.launch]` defaulting to Claude Code and the human's model, `[aide.permissions]`) and in `cland init`'s defaults. Its tools are exactly §3.3's list: the tracker in full, `artifact.create` and `artifact.promote`, `send` to any session by name and to topics, `topic.create`, `history`, `who`, `status`. It is refused `ask`, `resolve`, `session.*`, `merge`, `role.handover`, `release`, `sync` and `push`, each naming the rule. Routing keeps an Aide out of role broadcasts, `all`, Agents notices, asks and `@lead` resolution; it receives deliveries addressed to it by name and its role clause only.

## Acceptance criteria

- [ ] `cland session launch aide-1 --role aide` connects; several Aides may run at once.
- [ ] A message to every role, to `all`, an Agents notice and a pending ask never reach an Aide; a message to `aide-1` by name does.
- [ ] An Aide creates and edits an item, and is refused `session.launch`, `merge`, `role.handover`, `resolve` and `ask`, each naming the rule.
- [ ] `@lead T-n` never resolves to an Aide unless it holds the claim (slice 5).
- [ ] List the exact `.cland/roles.toml` lines for this project.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. ADRs 0001 (roles are hub-held state), 0004 (local git territory), 0003. Research `research/harness-surfaces` (where each adapter puts the role clause; Codex puts it in its first turn). References: `prototype/panels` ("yours" group and `␣A` in `panels.lua`, `palette.lua`), mockups `SessionsPanel.dc.html`, `Palette.dc.html`, `Thread.dc.html`; spec words win, then prototype behaviour, then mockups. The epic's choices where the spec is silent apply. Tests through the v0 seams: hub frame protocol, fake harnesses, headless Neovim; no new seams inside the hub. Instance lines (roles.toml) are listed exactly in the report; the Coordinator commits them.

## Comments

### impl-148 · 2026-10-10T08:41:16.330Z

Starting slice 1: verify §3.3 against default roles, hub permission gates, named/role/all/Agents/ask delivery, and lead resolution. Instance roles.toml changes will be provided for Coordinator merge.
