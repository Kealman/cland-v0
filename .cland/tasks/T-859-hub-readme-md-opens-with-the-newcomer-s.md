---
id: T-859
kind: task
title: "`hub/README.md` opens with the newcomer's first page, and the glossary's four entries match the shipped onboarding"
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-616
blocked_by: []
topic: null
branch: null
created: 2026-10-19T08:10:03.196Z
updated: 2026-10-19T08:10:03.196Z
---

## Summary

A newcomer opening `hub/README.md` first meets four steps:
1. the checkout install line Q-592 recorded;
2. `cland init` in an empty folder or a full clone;
3. `cland setup`;
4. the workbench, where the Aide leads the onboarding.

The module reference follows below. GLOSSARY.md's Setup, Onboarding, Tour and Welcome note, written at planning time, are checked against the shipped flow and amended where it changed.

## What to build

- **The first page**, at the top of `hub/README.md`, before "Modules":
  - The checkout install line from spec §3.1, with the tag this release ships (open question 7). It also says what is needed (Node 24, git) and, while the repository needs one, the credentials note.
  - `cland init` in the project folder: an empty folder or a full clone; a shallow clone is refused.
  - `cland setup`, which readies the harnesses and opens the workbench on the Aide.
  - That `cland` reopens the workbench later.
  - One line each on what setup and the onboarding do, using the glossary's words.
- **GLOSSARY.md.**
  - Onboarding names the commit and push and the Coordinator's start on the human's ok.
  - Welcome note names its title "Welcome aboard" as a note in General.
  - Setup and Tour are kept if they still match.
  - No "wizard" term appears.

## Acceptance criteria

- [ ] C1. `hub/README.md`'s first section, before "Modules", gives the checkout install line, `cland init`, `cland setup` and the workbench in that order (source review).
- [ ] C2. The install line equals spec §3.1's line with the tag the Coordinator chose (source review).
- [ ] C3. GLOSSARY.md defines Setup, Onboarding, Tour and Welcome note consistently with SKILL.md at the branch head, and Onboarding names the commit, the push and the Coordinator's launch on the human's ok (source review).
