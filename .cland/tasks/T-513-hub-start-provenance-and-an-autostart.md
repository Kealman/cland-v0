---
id: T-513
kind: task
title: Hub start provenance and an autostart grace period after a deliberate stop
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-425
blocked_by: []
topic: topic-322
branch: t/T-513-hub-start-provenance-and-an-autostart
created: 2026-10-15T16:26:22.615Z
updated: 2026-10-15T20:52:41.158Z
---

## Problem

On 2026-10-15 a stopped hub was restarted within 0.5 s three times by something other than the restart script (T-204). The cause is the Neovim workbench's autostart: nvim/lua/cland/hub.lua:37/:45 has autostart on by default, and :222–224 and :263–267 run `cland hub start` after failed connects. That spawns `hub serve` detached with the workbench's own environment (hub/src/cli/hub.ts:99). An env-dependent restart, such as a changed token or knob, can therefore come up with the wrong environment, and the hub-started record doesn't say who started it.

## Acceptance criteria

- [ ] C1. hub-started records its starter: client kind (cli, nvim or other), parent pid and cwd. It never records environment values.
- [ ] C2. `cland hub stop` leaves a stop-in-progress marker with a short grace period that autostart honours. A deliberate stop-and-restart by the CLI therefore isn't pre-empted, while a crashed hub still autostarts.
- [ ] C3. A test stops the hub with a fake Neovim autostart client attached, and the CLI's own start serves first.

## Comments

### impl-513 · 2026-10-15T20:52:41.158Z

Plan: use the established CLI + real daemon/socket seam for a deterministic fake Neovim client attached during stop; assert its autostart is deferred and explicit CLI start serves first. Add starter client/parent PID/cwd only (no environment capture), a short .cland/run stop grace marker, and label Neovim automatic starts. Cover actual Lua client behavior at the existing headless workbench seam. Epic E-425 has no additional Coordinator comments; qaPolicy is none/after-stage.
