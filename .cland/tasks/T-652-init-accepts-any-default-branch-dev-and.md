---
id: T-652
kind: task
title: "Init accepts any default branch: dev and the territory start from it, and the territory records it"
state: open
status: review
size: M
criterion_seq: 7
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by:
  - T-647
topic: topic-546
branch: t/T-652-init-accepts-any-default-branch-dev-and
created: 2026-10-16T16:24:00.971Z
updated: 2026-10-19T03:13:34.160Z
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

- [x] C1. `cland init` in a clone whose default branch is `master` creates `dev` from `master`, seeds the territory with `master` and `dev`, and leaves the clean root on `dev` (territory-cli.test.ts).
  - done: impl-652 · 2026-10-19T03:12:04.381Z
- [x] C2. The territory's configuration holds `cland.defaultBranch = master`, and a project initialised without it reads `main`.
  - done: impl-652 · 2026-10-19T03:12:04.736Z
- [x] C3. A push that updates or deletes `master` in that territory is refused by the hook with a message naming `master`, while task-branch pushes pass.
  - done: impl-652 · 2026-10-19T03:12:05.175Z
- [x] C4. `cland init --undo` in that clone returns the root to `master`.
  - done: impl-652 · 2026-10-19T03:12:05.610Z
- [x] C5. `cland doctor` in that project reports the territory healthy, and reports `territory master is missing` once that ref is deleted from it.
  - done: impl-652 · 2026-10-19T03:12:05.946Z
- [x] C6. A repository whose only branch is `trunk` gets `dev` from `trunk`; one with two branches, neither `main` nor `master`, and no `origin/HEAD` is refused before any write, naming both branches.
  - done: impl-652 · 2026-10-19T03:12:06.384Z
- [x] C7. Demo: in a scratch HOME, a clone of a local upstream whose HEAD is `master`, then `cland init`, `git branch` and `git -C .cland/territory.git branch` show `dev` started from `master`.
  - done: impl-652 · 2026-10-19T03:12:06.821Z

## Comments

### impl-652 · 2026-10-19T03:12:04.369Z

Implemented default discovery before territory writes/remote rename; records cland.defaultBranch once with legacy main fallback; provisioning/protection/undo/doctor/taskBase now use it. TDD red→green on master init, hook, undo, doctor and fallback; real Git T3 scratch-machine fixtures own HOME/XDG/identity and clear secrets. Host npm run check passed; territory-cli 22/22 (35.39s), first-commit compatibility 15/15 (20.65s). C7 demo A-5738 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5738-t-652-scratch-home-demo-master-seeds-dev-and-territory.log. QA policy scope none/after-stage; no per-item QA required. Source review next, then same-head mode-free droplet verification.

### rev-30 · 2026-10-19T03:13:34.160Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-652-source
commit: 8c642cccfbd6d77fdf0d0ae5a895b2d13d0dd0c7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no Standards or Spec findings. A-5739 records all five files, discovery order and refusal before territory writes, write-once default with legacy main fallback, native hook protection, doctor/undo/taskBase consumers, async config-map reuse, docs and test controls. C7 scratch demo A-5738 retained. C1–C7 remain unverified pending accepted exact-head gate and final evidence reconciliation; QA scope none.
