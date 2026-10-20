---
id: T-807
kind: task
title: Headless Neovim test fixtures and their stub hubs outlive a removed task worktree for hours; doctor should find fixture processes whose worktree is gone
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: topic-714
branch: t/T-807-headless-neovim-test-fixtures-and-their
created: 2026-10-18T14:25:18.084Z
updated: 2026-10-20T09:52:09.381Z
---

## Summary

Found by cland-impl on 2026-10-18 at about 14:15Z. Two headless Neovim fixture processes (`nvim --clean -u .cland/worktrees/T-<n>/nvim/init.lua --headless`), each with its stub-hub child, had been reparented to launchd after their task worktrees were removed. T-724's ran 7 h 12 min at 99 % CPU and ignored SIGTERM; T-709's ran 9.5 h idle. They raised the Mac's load during macOS stage runs, and cland-impl killed both by hand. This is the same class as T-450 (a hung fixture run leaves its processes behind).

## Acceptance criteria

- [ ] C1. `cland doctor` lists fixture processes (headless nvim with a worktree init.lua, stub hubs, fixture hubs) whose worktree path no longer exists, and `doctor --fix` ends them, matching by pid identity and never by command-line pattern alone.
- [ ] C2. Merge cleanup (worktree removal) ends fixture processes still rooted in that worktree, proved by a T2 test with an injected process table.

## Comments

### impl-807 · 2026-10-20T09:43:19.827Z

A-7125 triage confirmed REAL-CREW/M: current orphan classifier excludes nvim/stub hubs and all three removal paths bypass process cleanup. Tests will exercise the acceptance criteria's doctor/orphan and worktree-removal boundaries with injected OS process facts (T2), including human processes and PID reuse. Investigating a fixture ownership receipt rather than treating cland-* path/argv as authority.
