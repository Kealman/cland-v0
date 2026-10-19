---
id: T-839
kind: task
title: Every harness a role uses is checked for a login and signed in on yes, and the second check decides
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-838
  - T-834
topic: null
branch: null
created: 2026-10-19T06:34:12.988Z
updated: 2026-10-19T06:34:12.988Z
---

## Summary

Tracer bullet 2, the login half. For each harness a role uses (N3's function), setup checks the login. A signed-out one gets the harness's own blocking login in this terminal on the human's yes, in the environment the hub launches with, then a second check (spec §3.3 step 3).

## What to build

- **The commands.**
  - `claude auth login`, in the `CLAUDE_CONFIG_DIR` setup and the hub run with, set or unset.
  - `codex login`, in that `CODEX_HOME`.
  - `opencode auth login --standalone` against cland's OpenCode database, whose folder is created first.
- **The question.** `Sign in to <Harness> now?` defaults to Yes for Claude Code and Codex and to No for OpenCode, which is optional because its free model needs none.
- **The outcome.**
  - A login that leaves the harness signed out offers one more try. A second no is `fail` with the command.
  - A decline on the first question is `skip` with the command.
  - Harnesses no role uses get no login line beyond `skip` "no role uses it".
- Without a terminal, a login never runs: the line is `open` (OpenCode's is `skip`) with the exact command.

## Acceptance criteria

- [ ] C1. A signed-out Claude Code used by a role runs `claude auth login` on yes, and the second check reading signed in gives `claude-code login done` (T1).
- [ ] C2. A login that exits 0 but leaves the harness signed out offers one retry, and a no then gives `fail` with `run: claude auth login` (T1).
- [ ] C3. A signed-out Codex that no role uses is not offered a login, and its line says no role uses it (T1).
- [ ] C4. OpenCode's login question defaults to No, and on yes the command runs with `OPENCODE_DB` set to cland's database after its folder exists (T1, asserting the command's env).
- [ ] C5. Without a terminal, no login runs, and each signed-out harness in use is `open` with its exact command (T1).
