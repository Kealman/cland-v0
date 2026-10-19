---
id: T-856
kind: task
title: On the human's ok the Aide commits the onboarding's files on `dev`, runs `cland push` and launches the Coordinator with "Work release R-<n>"
state: open
status: in progress
size: S
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-616
blocked_by:
  - T-855
topic: null
branch: t/T-856-on-the-human-s-ok-the-aide-commits-the
created: 2026-10-19T08:10:02.941Z
updated: 2026-10-19T13:28:35.530Z
---

## Summary

"The start" now does what the prototype had to ask the human to do (Q-600 resolutions 1 and 2, §3.4 steps 9 and 10). On one ok, the Aide does three things:
- it commits on `dev` what `cland init` and the onboarding wrote;
- it publishes that commit with `cland push`;
- it launches the Coordinator with the brief "Work release R-<n>", then watches for its first report in General.

## What to build

- **SKILL.md §7.**
  - **The question.** "Ready to start? When you say ok, I commit what cland init and this onboarding wrote on dev, publish it with cland push, and launch the Coordinator with this brief: Work release R-<n>." Recommend yes.
  - **The commit.** On root `dev`, stage only cland's paths and the files the onboarding wrote: `AGENTS.md`, `CLAUDE.md`, `.cland/`, `.agents/`, `.claude/`, `docs/agents/`, and `.cland/welcome.md` when written. Never stage the human's own files, never use `git add -A`, and skip the commit when nothing is staged. The message is in English.
  - **The launch.** Then `cland push`, then `session.launch` or `cland session launch coord --role coordinator --brief "Work release R-<n>"`.
  - **What goes.** The refusal paragraph goes: pasting into a terminal and the launcher's space then l. A hub refusal is reported in one line with its reason, and the Aide offers no other route to the same act.
  - **With only a map.** The commit and push still happen on ok, and the launch is skipped with the existing sentence (open question 4).
  - **After the launch.** Watch with `who` and `history` (General) and say when the Coordinator runs.
- **WELCOME.md and §6** keep their order: the note is posted before the question.
- **T2 cases.**
  - An Aide in an in-process hub with a territory runs `push` after a commit on `dev`, and the territory's `dev` moves.
  - It runs `session launch coord --role coordinator --brief "Work release R-1"` against the fake harness, and the hub lists `coord` running as the Coordinator with that brief.

## Acceptance criteria

- [ ] C1. SKILL.md §7 asks the one "Ready to start?" question naming the commit, the push and the brief "Work release R-<n>", and on ok runs them in that order (source review).
- [ ] C2. The commit step stages only cland's paths and the onboarding's files, never `git add -A` or the human's own files (source review and a T1 assertion that the skill names no `git add -A` or `git add .`).
- [ ] C3. No file of the skill asks the human to paste a command or press a launcher key to start the Coordinator or import issues (T1 assertion on the removed wording, and source review).
- [ ] C4. Run as an Aide against an in-process hub, `cland push` moves the territory's `dev` to root `dev`, and the launch line starts `coord` with role coordinator and the brief "Work release R-1" (T2 with the fake harness).
