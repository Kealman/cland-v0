---
id: T-630
kind: task
title: The Aide imports GitHub issues and runs cland push; the import finds the github remote
state: open
status: planned
size: S
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by:
  - T-629
topic: null
branch: null
created: 2026-10-16T16:04:11.801Z
updated: 2026-10-16T16:04:28.714Z
---

## Summary

The Aide gains `task.import` and `push` (push only, never `release` or `sync`), so the onboarding can import an existing project's open issues on the human's confirmation and publish its own commit on `dev`. `cland task import-github` without `--repo` reads the `github` remote, then `origin`, since `cland init` renames a clone's `origin` to `github` (spec v0.1.4 §3.5).

## What to build

- The Aide's fixed boundary, its built-in grants and the shipped `[aide.permissions] tools` list gain `task.import` and `push`. No other role gains either.
- `cland push` from the Aide's own shell is accepted: today the push, release and sync requests share one check that admits only the Coordinator from its own shell. Push admits the Aide too; release and sync keep the Coordinator-only check, whatever an Aide's list grants.
- `cland task import-github` from the Aide's shell sends its `task.import` frames as the Aide and is accepted.
- Without `--repo`, the import reads `git remote get-url github`, then `origin`, and takes the first that names a GitHub repository; when neither does, the error names both remotes and says to pass `--repo owner/name`.
- The shipped Aide clause: on the human's confirmation it imports the open issues with `cland task import-github`, and after committing the onboarding's work on `dev` it publishes it with `cland push`; `cland push` leaves the list of what it cannot do. The hub README says the same.

## Acceptance criteria

- [ ] C1. An Aide imports a fake repository's open issues through the fake `gh` with `cland task import-github` from its shell, in a project whose GitHub remote is named `github`, in a new frame-protocol test.
- [ ] C2. In the same project the Aide's `cland push` from its shell fast-forwards the territory's `dev` to the root's `dev`.
- [ ] C3. An Aide's `cland release` and `cland sync` are still refused, and an Implementer, Reviewer, QA and Lead are refused `task.import` and `push` (permission tests).
- [ ] C4. Without `--repo` the import reads `github` before `origin`, and when neither names a GitHub repository its error names both remotes (CLI tests with the fake `gh`).
- [ ] C5. The shipped Aide clause and the hub README name the import on the human's confirmation and `cland push` after the onboarding's commit.
