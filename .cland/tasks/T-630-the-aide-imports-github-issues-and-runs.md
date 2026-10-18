---
id: T-630
kind: task
title: The Aide imports GitHub issues and runs cland push; the import finds the github remote
state: open
status: review
size: S
criterion_seq: 5
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by:
  - T-629
topic: topic-491
branch: t/T-630-the-aide-imports-github-issues-and-runs
created: 2026-10-16T16:04:11.801Z
updated: 2026-10-18T09:28:25.694Z
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

- [x] C1. An Aide imports a fake repository's open issues through the fake `gh` with `cland task import-github` from its shell, in a project whose GitHub remote is named `github`, in a new frame-protocol test.
  - done: impl-630 · 2026-10-18T09:27:44.836Z
- [x] C2. In the same project the Aide's `cland push` from its shell fast-forwards the territory's `dev` to the root's `dev`.
  - done: impl-630 · 2026-10-18T09:27:45.737Z
- [x] C3. An Aide's `cland release` and `cland sync` are still refused, and an Implementer, Reviewer, QA and Lead are refused `task.import` and `push` (permission tests).
  - done: impl-630 · 2026-10-18T09:27:46.332Z
- [x] C4. Without `--repo` the import reads `github` before `origin`, and when neither names a GitHub repository its error names both remotes (CLI tests with the fake `gh`).
  - done: impl-630 · 2026-10-18T09:27:46.915Z
- [x] C5. The shipped Aide clause and the hub README name the import on the human's confirmation and `cland push` after the onboarding's commit.
  - done: impl-630 · 2026-10-18T09:27:47.555Z

## Comments

### impl-630 · 2026-10-18T09:27:44.654Z

Implemented the Aide's built-in/shipped task.import and push grants, CLI-only Aide push admission with resumed authorization, github→origin import discovery, and shipped clause/README guidance. Red→green reproduced the fixed-boundary import refusal, github-only discovery failure, and shell push refusal. C1/C2 use one new real-Git case in existing T3 push.test.ts, per Coordinator's approved tier decision (topic-491, 8640e148). T1 permissions and T2 CLI remote selection cover C3/C4. Host lint/typecheck green; touched files green one at a time. Per-item QA policy is none/after-stage.
