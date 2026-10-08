---
id: T-44
kind: task
title: "cland CLI: find the hub from a worktree of the project"
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-08T19:01:49.025Z
updated: 2026-10-08T19:14:43.398Z
---

## Parent

Part of T-19. Found while preparing T-42 (dogfooding): the Implementer for T-43 works in `.cland/worktrees/T-43`, and every `cland` command run there answers `no hub running for …/.cland/worktrees/T-43` while the project's hub is up.

## Problem

`projectRoot(cwd)` (`hub/src/project.ts:96`) stops at the first ancestor holding `.git` or `.cland/`. A git worktree of the project has both (its `.git` file and the committed `.cland/tasks`, `roles.toml`, `config.toml`), so the CLI looks for `.cland/hub.json` inside the worktree, where the ignored hub files never are. The spoke and `cland hook` honour `CLAND_HUB_FILE`; the other CLI commands (`task`, `session`, `hub status`, `hub stop`) do not: they read `readDiscovery(layout(projectRoot(cwd)).discovery)`.

## What to build

- `cland` resolves the project from a worktree: when `.git` is a file (`gitdir: …/.git/worktrees/<name>`), the project root is the main worktree's root (`git rev-parse --git-common-dir`, or the gitdir path's grandparent), and `.cland/hub.json` is read there. A `.cland/` without `hub.json` inside a worktree is not the project.
- Every CLI command honours `CLAND_HUB_FILE` the way the spoke does, so a launched session's environment can name the hub outright.
- Tracker writes still land in the main worktree's `.cland/tasks` (the hub's root), never in the worktree's copy: say so in `docs/agents/issue-tracker.md` and `hub/README.md`.

## Acceptance criteria

- [ ] `cland hub status`, `cland task view T-1` and `cland session list` run from `.cland/worktrees/<x>` of a project with a running hub answer as from the root
- [ ] `CLAND_HUB_FILE=<file>` makes any `cland` command use that hub, from any directory
- [ ] A test in `hub/test/` adds a worktree to a temporary project with a running hub and runs the CLI there as a child process
- [ ] `hub/README.md` and `docs/agents/issue-tracker.md` say where the CLI finds the hub from a worktree and where item files are written
- [ ] `npm run typecheck && npm test` pass

## Comments

### human · 2026-10-08T19:14:43.398Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/43 (filed during the T-42 run; the numbers differ, the item is the source of truth).
