---
id: T-840
kind: task
title: The accounts step offers only profiles with their own directory, asks with the default No, and never registers a harness's default profile
state: open
status: backlog
size: M
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-839
topic: null
branch: null
created: 2026-10-19T06:34:13.082Z
updated: 2026-10-19T06:34:13.082Z
---

## Summary

Setup shows the signed-in profiles not yet in `~/.config/cland/accounts.toml`, each with who it is signed in as (shown, never written). It appends them only on an explicit yes, with the default No, because every project's hub reads that file. From the human's run on 2026-10-16: a harness's default profile is never offered, since it is the harness default already, and a path-less Claude Code entry makes the hub poll a signed-out profile (the T-603 family).

## What to build

- **Candidates.**
  - `~/.claude-<x>/` profiles as `claude-<x>` with `config_dir`.
  - `~/.codex-<x>/` profiles as `codex-<x>` with `home`.
  - Only signed-in profiles count, and only those not already registered (same harness and directory).
  - Never the default profile of the hub's environment, and never an explicit `~/.claude`.
  - OpenCode offers nothing.
- **Who it is.** Claude Code's `auth status --json` gives email and org. Codex's comes from a short-lived app-server's `account/read`, whose process group is ended afterwards. Both are shown only.
- **The question.** Before it, setup says when Yes is worth it: several accounts per harness, or limits. It also says the file is machine-wide. `Write them to ~/.config/cland/accounts.toml? [y/N]`.
  - Yes appends names, harnesses and paths, extending the file without rewriting it, and gives `done`.
  - No records the declined names in `[setup] declined_accounts` and gives `skip` (question 4).
  - A later run reports `ok` "declined earlier: <names>; add them to accounts.toml by hand to use them" and asks only about profiles not seen before.
- **Flags.** `--no-accounts` gives `skip` and reads nothing. `--yes` takes the default, so nothing is written (question 3). Without a terminal the step is `ok` when nothing is new and `open` when there are candidates. It never writes.
- A malformed registry is `fail`, "repair it by hand", and is left untouched.

## Acceptance criteria

- [ ] C1. With signed-in default Claude Code and Codex profiles and a signed-in `~/.claude-work`, the only candidate is `claude-work` with `config_dir = "~/.claude-work"` (T1).
- [ ] C2. Enter at the question writes nothing and leaves `accounts.toml` absent, and a second run asks nothing and reports `ok` naming the declined profile (T1).
- [ ] C3. Yes appends the entry to an existing registry, keeping its other bytes, and no line written holds an email or org (T1).
- [ ] C4. No run of the step ever writes a path-less `claude-code` entry or `config_dir = "~/.claude"` (T1 over every candidate set in the test).
- [ ] C5. `--no-accounts` reads no profile and reports `skip`, and `--yes` without a terminal leaves `accounts.toml` absent (T1).
- [ ] C6. The Codex identity read starts one app-server and ends its process group when it returns (T1 with an injected spawner recording the kill).
