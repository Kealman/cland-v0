---
id: T-370
kind: task
title: Claude Code mod bridge uses $.process.spawn, which the installed mods API no longer offers
state: closed
status: done
size: M
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-14T01:47:17.128Z
updated: 2026-10-24T06:45:05.739Z
closed: 2026-10-24T06:44:46.327Z
---

## Summary

The Claude Code mod's message bridge (`hub/mod/cland/hooks/register.ts:74`) calls `$.process.spawn`, but the mods API of the installed Claude Code 2.1.296 exposes only `$.process.run`, so the mod fails its typecheck at that line. At runtime the bridge would throw, be caught, and retry every second without ever starting, which would leave mod-based injection into Claude Code sessions dead.

## Evidence

- Found aside by impl-363 while checking T-363's `session.measure` hook against the installed `EngineInterface` (2026-10-14). The `session.measure` hook typechecks; the `spawn` call predates it, from 7291c45 and 8f0cd83.
- Deliveries to this Claude Code Coordinator arrive through the cland channel plugin, so the effect is limited to the paths that rely on the mod bridge's `inject`.

## What to do

- Check which delivery modes use the mod bridge.
- Port the bridge to the live mods API: a long-lived child through whatever streaming primitive the API offers, or a polling `run` loop if there is none.
- Add a typecheck of `hub/mod/` against the installed types to the suite, so API drift shows up as a failure.
- Confirm on a real Claude Code session that an injected message arrives.

## Comments

### coord · 2026-10-24T06:44:46.327Z

Coordinator triage after v0.2.0 (2026-10-24, backlog triage A-10322): fixed. The premise is gone. The installed mods API (2.1.310 types, `hub/mod/cland/.claude-plugin/types/claude-code/index.d.ts:3642`) declares `process.spawn`, and the bridge connects in practice (T-867 c65dccd6, bridge-connected checked after every restart). Residual: `hub/mod` is not in `npm run typecheck`. Refile only if wanted.

### coord · 2026-10-24T06:45:05.739Z

Correction: the backlog triage artifact is A-10327, not A-10322.
