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
updated: 2026-10-18T09:32:43.672Z
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
  - verified: rev-31 [reviewer] · run rev-20261018-630-source · 2026-10-18T09:32:43.671Z · commit 9081d7781a7e9490824821b83de437652d96d71b

## Comments

### impl-630 · 2026-10-18T09:27:44.654Z

Implemented the Aide's built-in/shipped task.import and push grants, CLI-only Aide push admission with resumed authorization, github→origin import discovery, and shipped clause/README guidance. Red→green reproduced the fixed-boundary import refusal, github-only discovery failure, and shell push refusal. C1/C2 use one new real-Git case in existing T3 push.test.ts, per Coordinator's approved tier decision (topic-491, 8640e148). T1 permissions and T2 CLI remote selection cover C3/C4. Host lint/typecheck green; touched files green one at a time. Per-item QA policy is none/after-stage.

### rev-31 · 2026-10-18T09:32:43.672Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-630-source
commit: 9081d7781a7e9490824821b83de437652d96d71b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review at 9081d7781a7e9490824821b83de437652d96d71b, fixed base 23244cfa9f1dbf53b75c2c1455d4fc9bb46f460d. Reviewed task C1–C5 and docs/spec/v0.1.4.md §3.5. No Reviewer test execution.

## Standards
No findings. Pure grant checks are T1; CLI remote-choice and UI/shell refusal controls use T2. The one added real-Git publication proof reuses push.test.ts at T3, with a 5s hard deadline and lifecycle header, per independently read Coordinator decision 8640e148-f61f-468f-b9b8-521e7f515efd. No new allowances, native hub launches or wall-clock waits. A-5121 targeted-file timings and the final request's post-merge host-gate results inspected.

## Spec
No findings. Only Aide built-in/shipped grants gain task.import/push; its fixed boundary still rejects release/sync even with extra grants. Dispatcher admits Aide push only through CLI and resolves the hub's current caller role/grants again through authorize. Existing publication queue/lock and pushDev authorization immediately before publication remain intact. Task import retains actorOf/CLAND_SESSION_ID identity and task.import frame permissions. The real-Git test verifies imported item provenance, the exact territory fast-forward, and Aide CLI audit identity for both operations.

Remote discovery tries github before origin, skips a non-GitHub candidate, and names both remotes plus --repo owner/name on failure; explicit --repo handling remains unchanged. Tests retain release/sync refusals and cover default grants for Implementer, Reviewer, QA and Lead. The shipped clause and README specify human confirmation for importing open issues and root-dev onboarding commit publication from the Aide's shell.

C5 verified by source. C1–C4 remain pending exact-head post-source-clear task verification. This is not a final execution verdict; no per-item QA required.

Standards: 0 findings. Spec: 0 findings.
Artifact A-5135.

Criteria: C5 verified.
