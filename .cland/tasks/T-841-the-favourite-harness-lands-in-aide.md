---
id: T-841
kind: task
title: The favourite harness lands in `[aide.launch]`, marked as the human's choice
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-837
topic: null
branch: null
created: 2026-10-19T06:34:13.175Z
updated: 2026-10-19T06:34:13.175Z
---

## Summary

Setup asks which installed harness the human talks to. It writes the answer as `[aide.launch] harness` in `.cland/roles.toml`, with the `CHOSEN` mark that `projectSetUp` reads (T-651), and an effort that harness takes. Afterwards `cland open` stops printing `next: cland setup`.

## What to build

- **The choice.**
  - The installed harnesses are offered, in the order Claude Code, Codex, OpenCode, with the first as the default. A signed-out one is labelled.
  - With one installed, there is no question.
  - `--harness <h>` picks without asking, and fails when `<h>` is not installed.
  - `--yes` takes the default.
  - Without a terminal and without `--harness` or `--yes`, the step is `open`, naming both flags.
- **The write.** One table, through the roles editor:
  - the harness line carries the `CHOSEN` comment;
  - a change of harness resets `effort` (Claude Code `max`, Codex `high`, OpenCode none) and sets `model = ""`;
  - every other line of the file stays byte-identical.
- An already-marked favourite that is still installed is `ok` and asks nothing, unless `--harness` names another.
- A `roles.toml` the hub would refuse is `fail`, "repair it (cland doctor names the line)", and left untouched.

## Acceptance criteria

- [ ] C1. Choosing Codex writes `harness = "codex" # the human's favourite, chosen in cland setup`, `effort = "high"` and `model = ""` in `[aide.launch]`, and no other line of the file changes (T1, a line diff).
- [ ] C2. After the write, `projectSetUp` is true, and a second run reports `favourite ok` without a question (T1).
- [ ] C3. With one installed harness, no question is asked and that harness is written (T1).
- [ ] C4. `--harness opencode` with OpenCode not installed is `fail` naming the installed set, and without a terminal and without flags the step is `open` and writes nothing (T1).
