---
id: T-652
kind: task
title: "Init accepts any default branch: dev and the territory start from it, and the territory records it"
state: open
status: backlog
size: M
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by:
  - T-647
topic: null
branch: null
created: 2026-10-16T16:24:00.971Z
updated: 2026-10-16T16:24:13.305Z
---

## Summary

The territory hard-codes `main`: a repository whose default branch is `master` gets no `dev`. Init now finds the repository's default branch, `main`, `master` or another, starts `dev` and the territory from it, protects it as it protects `main` today, and records it in the territory's configuration for the commands that follow (map M-591 decision 8; spec v0.1.4 §3.2; ADR 0004).

## What to build

- **Finding it** (in `hub/src/territory.ts`, before `origin` is renamed `github`): the target of `refs/remotes/origin/HEAD` when the clone has one; else `main` when it exists; else `master`; else the only local branch; else init refuses with the local branches named and how to choose (`git symbolic-ref` on `origin/HEAD`, or a branch named `main`). A project init has just made a repository uses the branch of its first commit.
- **Recording it.** `cland.defaultBranch` in the territory's Git configuration, written once; a territory without it (every project initialised before 0.1.4, this repository included) reads `main`. One exported reader, `defaultBranch(root)`, which `taskBase`, doctor, undo and ticket T-653 use.
- **What changes in `provisionTerritory`.** `dev` is created from the default branch; the territory is seeded with the default branch and `dev`; the clean root on the default branch switches to `dev`, and `cland.originalBranch` names it, so `cland init --undo` returns to it.
- **Protection.** The territory's update hook protects `refs/heads/<default>` and `dev`, reading `cland.defaultBranch` at run time so the hook's text stays one constant; its refusal message names the branch.
- **Doctor and task branches.** `territoryProblems` checks the default branch where it checks `main`; `taskBase` falls back to it where it falls back to `main`.
- **Tests** in `hub/test/territory-cli.test.ts`, with a fixture whose GitHub stand-in's HEAD is `master`; the existing `main` tests pass unchanged.
- **Docs.** The hub README's territory section and ADR 0004's consequences note (an amendment line) say that the default branch is recorded and is `main` when absent.

## Acceptance criteria

- [ ] C1. `cland init` in a clone whose default branch is `master` creates `dev` from `master`, seeds the territory with `master` and `dev`, and leaves the clean root on `dev` (territory-cli.test.ts).
- [ ] C2. The territory's configuration holds `cland.defaultBranch = master`, and a project initialised without it reads `main`.
- [ ] C3. A push that updates or deletes `master` in that territory is refused by the hook with a message naming `master`, while task-branch pushes pass.
- [ ] C4. `cland init --undo` in that clone returns the root to `master`.
- [ ] C5. `cland doctor` in that project reports the territory healthy, and reports `territory master is missing` once that ref is deleted from it.
- [ ] C6. A repository whose only branch is `trunk` gets `dev` from `trunk`; one with two branches, neither `main` nor `master`, and no `origin/HEAD` is refused before any write, naming both branches.
- [ ] C7. Demo: in a scratch HOME, a clone of a local upstream whose HEAD is `master`, then `cland init`, `git branch` and `git -C .cland/territory.git branch` show `dev` started from `master`.
