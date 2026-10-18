---
id: T-631
kind: task
title: permissions = "auto" launches Claude Code with --permission-mode auto
state: open
status: review
size: S
criterion_seq: 5
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by: []
topic: topic-493
branch: t/T-631-permissions-auto-launches-claude-code
created: 2026-10-16T16:04:11.937Z
updated: 2026-10-18T09:25:38.832Z
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

- [x] C1. With `permissions = "auto"`, a Claude Code launch spawns `claude` with `--permission-mode auto` and without `--dangerously-skip-permissions` (adapter test with the fake Claude Code).
  - done: impl-631 · 2026-10-18T09:24:46.046Z
- [x] C2. A resume and a relaunch of that session carry the same flag, read from roles.toml at that moment (adapter test).
  - done: impl-631 · 2026-10-18T09:24:47.506Z
- [x] C3. `skip` still passes `--dangerously-skip-permissions`, and `""` or an absent key passes neither flag (existing tests kept green).
  - done: impl-631 · 2026-10-18T09:24:49.047Z
- [x] C4. A Codex and an OpenCode launch for a role with `permissions = "auto"` start as before, Codex with its approval and sandbox (adapter tests).
  - done: impl-631 · 2026-10-18T09:24:54.731Z
- [x] C5. A roles.toml with an unknown `permissions` value is refused with a message naming `""`, `auto` and `skip` (parser test), and the template's header comment documents `auto`.
  - done: impl-631 · 2026-10-18T09:25:01.392Z

## Comments

### impl-631 · 2026-10-18T09:22:14.775Z

Parser RED: auto rejected, unknown-value message omitted ""/auto, template omitted auto. GREEN after enum/parser/header changes. CLI-boundary RED: auto launch lacked --permission-mode; GREEN after argv support, table covers auto/skip/null/absent on launch, fresh/native-conversation spawn and relaunch. T2 policy test will cover current roles.toml on fresh resume and relaunch; rediscovery-only resume starts no process.
