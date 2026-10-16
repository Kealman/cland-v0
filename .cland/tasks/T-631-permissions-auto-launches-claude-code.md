---
id: T-631
kind: task
title: permissions = "auto" launches Claude Code with --permission-mode auto
state: open
status: planned
size: S
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by: []
topic: null
branch: null
created: 2026-10-16T16:04:11.937Z
updated: 2026-10-16T16:04:28.799Z
---

## Summary

A new value of `[<role>.launch] permissions`, `auto`, launches Claude Code with `--permission-mode auto` on a first launch, a resume and a relaunch, so a Claude Code role runs guarded without a prompt per command. `skip` and `""` keep their meaning, and Codex and OpenCode launches are unchanged (spec v0.1.4 §3.5).

## What to build

Today `permissions` takes `""` (the harness's own settings) or `skip` (`--dangerously-skip-permissions`). It gains `auto`:

- the roles parser accepts `auto` and refuses any other value with the three it takes;
- the Claude Code adapter passes `--permission-mode auto` for `auto` and `--dangerously-skip-permissions` for `skip`, never both, on a first launch, a resume and a relaunch, reading the role's value at that moment as it does today;
- Codex keeps `approval` and its sandbox as the guard and OpenCode its own settings: both ignore `permissions`, `auto` included;
- the template's header comment documents `auto` beside `""` and `skip`.

Which roles the template puts on `auto` is the template ticket's. The fake Claude Code records its arguments, which the tests read.

## Acceptance criteria

- [ ] C1. With `permissions = "auto"`, a Claude Code launch spawns `claude` with `--permission-mode auto` and without `--dangerously-skip-permissions` (adapter test with the fake Claude Code).
- [ ] C2. A resume and a relaunch of that session carry the same flag, read from roles.toml at that moment (adapter test).
- [ ] C3. `skip` still passes `--dangerously-skip-permissions`, and `""` or an absent key passes neither flag (existing tests kept green).
- [ ] C4. A Codex and an OpenCode launch for a role with `permissions = "auto"` start as before, Codex with its approval and sandbox (adapter tests).
- [ ] C5. A roles.toml with an unknown `permissions` value is refused with a message naming `""`, `auto` and `skip` (parser test), and the template's header comment documents `auto`.
