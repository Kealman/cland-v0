---
id: Q-597
kind: question
title: "cland setup in the terminal: harnesses, accounts, the favourite harness, the Aide attached"
state: closed
labels:
  - wayfinder:prototype
assignee: cland-design
parent: M-591
blocked_by:
  - Q-593
  - Q-594
topic: null
branch: null
created: 2026-10-16T11:26:11.633Z
updated: 2026-10-16T15:06:50.659Z
closed: 2026-10-16T15:06:50.659Z
---

## Question

What does the interactive step feel like? A runnable `cland setup` on prototype/setup: detect the three harnesses (binary, version, login), show the install command for a missing one and run it on confirmation, wait for the human's login and re-check, register the logged-in accounts, ask for the favourite harness, start the sandbox project's hub, launch the Aide with the onboarding brief and attach its terminal in place, print the next steps on exit; plus `cland init` on an empty folder (git init, main, the first commit, the territory) and its closing "next: cland setup" line. Decided on the harness research (trust, logins, accounts) and the prior-art research (step shape, library). The human tries it in a throwaway folder on this machine and reacts.

## Comments

### human · 2026-10-16T15:06:50.569Z

## Resolution

Accepted by the human on 2026-10-16 after running it in a fresh folder ("setup уже пробовал как раз сейчас, так что все получилось"). Prototype on prototype/setup at 3b2eabfe (+ 24ca0729 for the managed bgIsolation key): `cland init` on an empty folder runs `git init -b main`, commits cland's files as the first commit and creates the territory, and every init ends with `next: cland setup`; `cland setup` runs the eight steps (detection with doctor's probes; installs and logins as terminal children re-checked afterwards; accounts shown and appended on a yes; the favourite harness into `[aide.launch]`; trust granted deterministically for Claude Code and Codex; the hub and aide-1 with the onboarding brief; the workbench opened with the Aide in the centre through CLAND_OPEN_SESSION, `--attach` as the fallback), prints the open steps and exits 1 without a terminal, and takes `--json`, `--yes`, `--install`, `--harness`, `--no-accounts`, `--no-aide`. The prototype's open questions are decided in Q-599.
