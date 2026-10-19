---
id: T-839
kind: task
title: Every harness a role uses is checked for a login and signed in on yes, and the second check decides
state: open
status: review
size: S
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-838
  - T-834
topic: topic-627
branch: t/T-839-every-harness-a-role-uses-is-checked-for
created: 2026-10-19T06:34:12.988Z
updated: 2026-10-19T19:16:35.319Z
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

## Comments

### impl-839 · 2026-10-19T19:13:25.761Z

Implemented login confirmations, one retry, fresh-probe verdicts, exact remedies, launch-profile preservation and OpenCode database setup. Targeted tests: setup-flow 19/19, related setup tests 32/32; npm run check passed. Coordinator decision on --yes is pinned by a T1 test. Pushed fb33d1e846205d4478027f28184bc454d83dae77 after merging origin/dev; requesting source review before verification.

### impl-839 · 2026-10-19T19:15:09.806Z

Source review identified explicit CLAND_*_BIN overrides were not preserved by bare login names. Fixed in ec11e19bf628e716012a711bc8c8292575accd13 with a red/green T1 table for all three selected executable paths, including spaces/apostrophe. Requested fresh source review; no dev merge after initial review. Evidence A-6363.

### rev-31 · 2026-10-19T19:16:35.319Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-839-source
commit: ec11e19bf628e716012a711bc8c8292575accd13
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no remaining Standards/Spec findings. All C1–C5 controls reviewed: vendor blocking logins require terminal confirmation, fresh probes decide outcome independent of command exit, one retry maximum, unused harnesses skip, optional OpenCode defaults No and receives cland DB after directory creation, nonterminal runs no login. launch-profile env forwards through actual SetupMachine.run/terminalCommand; JSON routes child stdout to stderr. Initial explicit executable override gap confirmed during review is fixed at this head, with shell-quoted probed paths and exact remedies for all three harnesses under a T1 table. Independently read Coordinator 97065b73 confirming terminal --yes still asks; test pins it. A-6357/A-6363 report host tests/checks green; exact runtime/budget verification remains pending. No C1–C5 final marks until same-head configured task receipt. See full source review artifact in topic-627.
