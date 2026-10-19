---
id: T-834
kind: task
title: Doctor requires a harness only when a role uses it, and `gh` only with a `github` remote
state: open
status: planned
size: M
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-832
topic: null
branch: null
created: 2026-10-19T06:34:12.522Z
updated: 2026-10-19T06:34:21.629Z
---

## Summary

On a bare machine doctor fails nine checks, because every missing harness and `gh` counts (Q-592). Doctor now requires only the harnesses the project's roles launch on and `gh` only when the root has a `github` remote. Other missing tools show as information (map decision 5, Q-599 resolution 4).

## What to build

- **The harnesses in use.** One exported function lists the harnesses a project's roles use: every `[<role>.launch] harness` in `.cland/roles.toml`, with the built-in defaults for keys the file leaves out, plus the harness of every account a role names. Setup's login step (N8) uses the same function.
- **Doctor's rows.**
  - A harness in use that is missing or signed out fails, as today.
  - A harness no role uses gives an `ok` row: "not installed; no role uses it".
  - A signed-out harness that no role uses also gives an `ok` row, naming its login command.
- **Without a project or without `roles.toml`** (question 8): no single harness is required, but a machine with none installed fails one row, "cland needs at least one harness", naming the installers.
- **gh.** `gh` and `gh auth` are checked only when the root has a remote named `github`. Otherwise one `ok` row says "not needed: no github remote".
- `--json` keeps its shape. The hub README's doctor section names the rule.

## Acceptance criteria

- [ ] C1. In a project whose roles all launch on claude-code, doctor with Codex and OpenCode missing has no `fail` row for them and exits 0 when the rest passes (T1/T2 with injected probes).
- [ ] C2. The same project with Claude Code signed out has a `fail` row for `claude-code auth` naming `claude auth login`.
- [ ] C3. A role naming an account adds that account's harness to the harnesses in use (T1 over the function).
- [ ] C4. Without a `github` remote, doctor runs no `gh` probe and shows the "not needed" row. With one, a missing `gh` fails as today (T1 with injected remotes and probes).
- [ ] C5. Outside a project, doctor with no harness installed has exactly one harness `fail` row, "cland needs at least one harness", and with one harness installed it has none.
