---
id: T-845
kind: task
title: Setup ends in the workbench with the Aide in the centre, or in the harness's attach with `--attach`, and one closing line follows
state: open
status: backlog
size: M
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-844
  - T-843
topic: null
branch: null
created: 2026-10-19T06:34:13.540Z
updated: 2026-10-19T06:34:13.540Z
---

## Summary

Tracer bullet 4, the hand-over. After the summary line, setup opens the workbench as `cland open` does, with the launcher downloading the pinned Neovim on first use, told to open `aide-1` in the centre (N12). `--attach` runs the harness's own attach command in this terminal instead, for a machine without the pinned Neovim. One closing line follows on exit (spec §3.3 step 8).

## What to build

- **The workbench.**
  - It opens when the run is interactive and `aide-1` runs, on every run including a second one (question 14).
  - The launcher command is `cland open`'s (`CLAND_LAUNCHER` still names the tests' stand-in), with `CLAND_OPEN_SESSION=aide-1`, run through N6's terminal helper.
  - A launcher that exits non-zero adds "cland setup --attach attaches aide-1 in this terminal instead".
- **`--attach`.**
  - Setup asks the hub for the attach command (`session.attach`) and prints how to leave the harness running (Claude Code: `←` to the agent view, Ctrl+Z suspends setup together with the attach, accepted).
  - It then waits on `Press Enter to attach (Ctrl+D: not now)` and runs the attach with the terminal.
- **The closing line.**
  - After the workbench: `aide-1 may still be running: x on its row in the workbench's sessions panel stops it, or cland session stop aide-1`.
  - After `--attach`: the same stop hint, and `open the workbench: cland`.
  - `cland` is spelt as the human should type it. When the `cland` on the PATH is another checkout, the line uses `node <this entry>` and says why (the prototype's `clandCommand`).
- No hand-over without a terminal, with `--no-aide`, or when the Aide did not start. Those runs end with "open the workbench: cland".

## Acceptance criteria

- [ ] C1. An interactive run with `aide-1` running calls the injected `run` with the launcher on the root and `CLAND_OPEN_SESSION=aide-1` in its environment, then prints exactly one closing line naming `cland session stop aide-1` (T1).
- [ ] C2. `--attach` prints the hub's attach command, runs it after Enter and prints the attach closing lines, while Ctrl+D at the pause runs nothing and still prints them (T1, fake prompter and hub client).
- [ ] C3. A launcher exiting 1 adds the `--attach` hint before the closing line (T1).
- [ ] C4. Without a terminal, or with `--no-aide`, no launcher or attach runs (T1).
