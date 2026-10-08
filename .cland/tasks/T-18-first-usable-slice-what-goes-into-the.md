---
id: T-18
kind: question
title: "First usable slice: what goes into the first daily-driver build"
state: closed
labels:
  - wayfinder:grilling
assignee: Kealman
parent: T-1
blocked_by:
  - T-11
  - T-12
  - T-7
  - T-8
  - T-14
  - T-9
  - T-10
  - T-17
  - T-13
topic: null
branch: null
created: 2026-10-07T14:52:45Z
updated: 2026-10-08T13:17:15.597Z
github:
  repo: Kealman/cland-v0
  number: 18
  url: https://github.com/Kealman/cland-v0/issues/18
---

## Question

Which areas go into the first build the human would use daily, and which are deferred? Given all decisions on the map, cut the first usable slice of cland v0 and record it as the scope section of the spec.

The map is complete when this is answered: everything after it is implementation, handed to `/to-tickets`.

## Comments

### Kealman · 2026-10-08T11:32:29Z

<!-- github-comment: 6058921462 -->

## Resolution

The first usable slice is cut and recorded in `docs/spec/v0.md` (225f725), sections 6 and 7, decided with the human on 2026-10-07 and 2026-10-08:

- **Slice 1, the daily driver:** the Neovim shell with the workbench layout (section 5); the hub extracted from the BCAS core; adapters for Claude Code, Codex and OpenCode (spawn, attach, inject, state, stop, resume); the four roles with clause delivery and handover; the tracker in `.cland/tasks` with the `cland task` CLI, the index and the skills in their "other" mode; the process layer (`cland init`, `AGENTS.md`, skills, Claude Code hooks, the mod, `cland doctor`); review and QA through the Reviewer and QA roles with `/codex:rescue` as the fallback.
- **Tracer-bullet order:** hub daemon + spoke + Claude Code adapter + General in the UI; then the Codex and OpenCode adapters; roles; the full topic model and asks; the tracker and skills; `cland init`.
- **Definition of done and dogfooding:** the human runs a real task of the cland project itself inside cland. cland is built with cland from slice 1 on.
- **Tracker bootstrap:** GitHub Issues until `.cland/tasks` exists, then a one-script migration.
- **Repository layout:** `hub/` (TypeScript: hub, adapters, CLI), `nvim/` (Lua), `skills/`, `docs/`; prototypes stay on branches.
- **Slice 2:** the git territory, artifacts, the QA lane infrastructure, the Agents-topic filters and the topic's artifact list.

The map is complete: nothing is left to decide before implementation. Next step for the human: `/to-tickets` on slice 1 of the spec.
