---
id: T-844
kind: task
title: Setup starts the hub and launches `aide-1` with the onboarding brief
state: open
status: backlog
size: M
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-841
topic: null
branch: null
created: 2026-10-19T06:34:13.450Z
updated: 2026-10-19T06:34:13.450Z
---

## Summary

Tracer bullet 4, the hub half. Setup starts this project's hub, which outlives setup (ADR 0003). It then launches `aide-1` through the hub on the favourite harness with the brief `Run the onboarding skill; project: empty | existing; harnesses: <installed>; human's harness: <favourite>` (ADR 0001: a normal hub launch, never a harness started by hand).

## What to build

- **The hub step.**
  - `ok` with its pid when one runs.
  - Otherwise it is started as `cland hub start` does, in setup's environment, so the hub sees the installers' folders on its PATH. That gives `done`.
  - A start that fails is `fail`, naming the hub log's last lines and `cland hub start`.
- **The aide step.**
  - A running `aide-1` is `ok`.
  - A stopped one is resumed with its conversation, giving `done` "resumed".
  - Otherwise `aide-1` is launched with role `aide`, the favourite harness and the brief, giving `done` with the brief in the line.
  - A launch the hub refuses is `fail`, naming the equivalent `cland session launch` command.
- **The project kind** (question 13): `existing` when the root holds a file beside cland's own paths (tracked, or untracked and not ignored), else `empty`.
- **Flags.**
  - `--no-aide` gives `skip` for both steps: "cland starts the hub with the workbench".
  - Without a terminal, the hub step is `open` unless `--yes` (question 2), and the aide step is always `open`: "the Aide needs a terminal".
- The brief names the onboarding skill even before E-616 ships it (question 12).

## Acceptance criteria

- [ ] C1. With an injected hub client and no hub running, the flow starts the hub and launches `aide-1` with role `aide`, the favourite and the exact brief, `project: empty` for a folder of cland's files only (T1).
- [ ] C2. A folder with one untracked file of the project's own gives `project: existing`, while an ignored file does not (T1 over the kind function on a temp repo, T2).
- [ ] C3. A second run with `aide-1` running reports `hub ok` and `aide ok` and launches nothing, while a stopped `aide-1` is resumed, not launched afresh (T1).
- [ ] C4. A real hub served in the test process (`projectHub`) receives `session.launch` for `aide-1` with the brief and lists it running (T2, in-process fake adapter).
- [ ] C5. `--no-aide` reports both steps `skip` and starts nothing, and without a terminal the aide step is `open` and nothing is launched (T1).
