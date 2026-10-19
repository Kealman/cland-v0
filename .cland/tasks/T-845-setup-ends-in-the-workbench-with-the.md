---
id: T-845
kind: task
title: Setup ends in the workbench with the Aide in the centre, or in the harness's attach with `--attach`, and one closing line follows
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-844
  - T-843
topic: topic-642
branch: t/T-845-setup-ends-in-the-workbench-with-the
created: 2026-10-19T06:34:13.540Z
updated: 2026-10-19T20:14:39.879Z
closed: 2026-10-19T20:14:39.878Z
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

- [x] C1. An interactive run with `aide-1` running calls the injected `run` with the launcher on the root and `CLAND_OPEN_SESSION=aide-1` in its environment, then prints exactly one closing line naming `cland session stop aide-1` (T1).
  - done: impl-845 · 2026-10-19T20:08:50.115Z
  - verified: rev-31 [reviewer] · run rev-20261019-845-final · 2026-10-19T20:09:31.477Z · commit b43a0adadaf4bb2a21d7be7174ad3d3d2470aa36
- [x] C2. `--attach` prints the hub's attach command, runs it after Enter and prints the attach closing lines, while Ctrl+D at the pause runs nothing and still prints them (T1, fake prompter and hub client).
  - done: impl-845 · 2026-10-19T20:08:51.040Z
  - verified: rev-31 [reviewer] · run rev-20261019-845-final · 2026-10-19T20:09:31.477Z · commit b43a0adadaf4bb2a21d7be7174ad3d3d2470aa36
- [x] C3. A launcher exiting 1 adds the `--attach` hint before the closing line (T1).
  - done: impl-845 · 2026-10-19T20:08:52.248Z
  - verified: rev-31 [reviewer] · run rev-20261019-845-final · 2026-10-19T20:09:31.477Z · commit b43a0adadaf4bb2a21d7be7174ad3d3d2470aa36
- [x] C4. Without a terminal, or with `--no-aide`, no launcher or attach runs (T1).
  - done: impl-845 · 2026-10-19T20:08:53.262Z
  - verified: rev-31 [reviewer] · run rev-20261019-845-final · 2026-10-19T20:09:31.477Z · commit b43a0adadaf4bb2a21d7be7174ad3d3d2470aa36

## Comments

### impl-845 · 2026-10-19T19:43:02.711Z

Implementing post-summary workbench/--attach handover. Agreed criterion seams are injected terminal run, prompter and hub client (T1), plus CLI wiring. No process fixtures needed.

### impl-845 · 2026-10-19T19:47:11.356Z

Implementation pushed at b43a0adadaf4bb2a21d7be7174ad3d3d2470aa36; evidence A-6492 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6492-t-845-implementation-and-criterion-evidence.md. Root typecheck, tiers, report-only test lint and five targeted files (37 tests) passed. Source review request queued with the next free live Reviewer; no verification before source clear.

### rev-31 · 2026-10-19T20:01:33.131Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-845-source
commit: b43a0adadaf4bb2a21d7be7174ad3d3d2470aa36
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards/Spec source clear; post-summary workbench and --attach match C1–C4 and §3.3. Root/env/default launcher, repeated run, Enter/EOF, failures, nonterminal/noAide/Aide-failure guards and checkout command spelling are covered by injected T1 tests. Existing terminal/protocol seams reused; no new process fixture or allowance. A-6538; host evidence A-6492. Final C1–C4 await same-head configured mode-free receipt with nine new handover identities 5/5; no task T3 run requested.

### impl-845 · 2026-10-19T20:01:51.534Z

Source clear rev-20261019-845-source / A-6538 at unchanged b43a0adadaf4bb2a21d7be7174ad3d3d2470aa36. Mode-free verification d0e311e0-9f48-4df2-848a-f714f7ab0183 admitted, queue position 1; reports to topic-642, Reviewer and claimant. Waiting for hub result; branch remains clean and frozen.

### impl-845 · 2026-10-19T20:09:01.864Z

Unchanged-head mode-free run d0e311e0 passed: 1657/1657, zero fail/cancel/skip/TODO; all nine setup-handover T1 identities passed 5/5 load repetitions. A-6560 log at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6560-suite-d0e311e0-9f48-4df2-848a-f714f7ab0183-auto-at-b43a0ad.log. Linux x64 / Node v24.21.0 / Neovim v0.12.5; droplet c-8 lon1, lifetime 369s, cost $0.0256. Claimant C1–C4 done marks added. Awaiting Reviewer final verdict; epic T3 demo remains separate.

### rev-31 · 2026-10-19T20:09:31.477Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-845-final
commit: b43a0adadaf4bb2a21d7be7174ad3d3d2470aa36
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Configured mode-free d0e311e0/A-6560 passes at unchanged source head: 1657/1657 ordinary, 355/355 load finishes, all 71 groups 5/5, no tier mismatch/non-pass. All nine T1 handover controls pass ordinary/5/5, including root/env/repeat/one hint, Enter/EOF, launcher error, guards and CLI integration. Max owned body .024891793s, rep .026693136s, file .293441416s. C1–C4 established with source A-6538; A-6564 retains entire-log audit and known external report-only notices. No outstanding findings; epic T3 demo separately owned.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-19T20:14:39.878Z

Merged 661c22460bfe47085c76d6549c35b9f815ed398f onto dev.
