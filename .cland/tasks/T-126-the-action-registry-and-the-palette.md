---
id: T-126
kind: task
title: "The action registry and the palette: every command, toggle, view, launch and ask answer registered with its key; ␣p over actions and objects with prefixes; ␣a on artifacts"
state: open
labels:
  - ready-for-agent
  - v0.1
assignee: null
parent: T-109
blocked_by:
  - T-125
topic: null
branch: null
created: 2026-10-09T21:57:18.399Z
updated: 2026-10-09T21:57:18.399Z
---

## Parent

T-109 (Workbench basics), slice 3 of 5. Spec §3.11 (The palette).

## What to build

**The action registry.** One registry holds every `:Cland` subcommand, panel toggle, view switch, session launch and open ask's answer. Each entry has a title, its key, and the place a panel-local key works, or says it has no key. Existing keymaps are generated from the registry, or checked against it, so the two cannot drift.

**The palette.** `␣p` opens a floating palette.
- Without a prefix it searches actions and objects together, grouped in a fixed order: actions, items, sessions, artifacts, topics. The cursor sits on the best match.
- Prefixes narrow it to one kind: `>` actions, `#` items, `@` sessions, `~` artifacts and `/` topics. `␣a` opens it on `~`.
- Each action shows its key. An open ask's options are one action per option.
- Keys: Enter runs or opens, `C-v` opens in a split, Tab moves to the next kind, Esc closes.
- Matched characters are blue. Until the visibility layers land, closed items, stopped sessions and closed topics are dimmed.

Matching uses Neovim's built-in fuzzy matching (ADR 0005).

## Acceptance criteria

- [ ] `␣p` and a few letters toggle the sessions panel; `#` and an id open an item; an open ask is answered from the palette and the answer reaches the hub.
- [ ] Every registered action shows its key or "no key"; a test fails when a mapped key is missing from the registry.
- [ ] Prefixes, group order, Tab, `C-v` and Esc behave as above; `␣a` opens on artifacts.
- [ ] Headless QA cases cover the palette; `nvim/README.md` documents the palette and the registry.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M. Implementer: Codex. Reference: `prototype/panels` `palette.lua`; mockup `Palette.dc.html` and `screens/v01-palette.png`. The later Neovim epics reach their views through this registry, so keep its API small and documented.
