---
id: T-961
kind: task
title: "Shared test fixtures and the manual load harness follow rule 15: own HOME and Git config, credential filter after every overlay"
state: open
status: review
size: M
criterion_seq: 2
labels:
  - ready-for-agent
  - tech-debt
assignee: null
parent: E-952
blocked_by: []
topic: topic-731
branch: t/T-961-shared-test-fixtures-and-the-manual-load
created: 2026-10-20T09:56:10.745Z
updated: 2026-10-20T10:11:50.329Z
---

## Summary

Rule 15 (adopted 2026-10-20) requires real-machine work to run sealed. The shared fixtures don't fully do this yet. hub/test/account-fixture-env.ts isolates the XDG and account roots and blanks DIGITALOCEAN_TOKEN, but it doesn't replace HOME or the Git config. `clandWithEnv` in hub/test/harness.ts overlays the environment without the shared `withoutExecutorCredentials` filter. The manual hub/test/inbox-load.ts harness serves a disposable project but inherits process.env, HOME, and the provider and account variables. Found by impl-951 and impl-768.

## What to build

The shared fixture environment builders give every child its own scratch HOME, XDG directories and Git config (GIT_CONFIG_GLOBAL and GIT_CONFIG_NOSYSTEM, or equivalent). They apply the shared credential filter after every overlay. inbox-load.ts uses the same builder. A T1 self-test, extending the poisoned-HOME self-test in setup-machine.test.ts, fails if any shared builder leaks a poisoned HOME, Git config or provider variable into the child environment.

## Acceptance criteria

- [x] C1. account-fixture-env.ts, harness.ts `clandWithEnv` and inbox-load.ts produce child environments with scratch HOME and Git config and no provider/account variables, after every overlay.
  - done: impl-961 · 2026-10-20T10:09:33.435Z
- [x] C2. A T1 self-test with a poisoned parent environment (HOME, Git config, DIGITALOCEAN_TOKEN, a provider key) fails against the old builders and passes against the new ones.
  - done: impl-961 · 2026-10-20T10:09:34.854Z

## Comments

### impl-961 · 2026-10-20T10:07:48.138Z

Implemented pure fixtureEnvironment plus sealed worker/CLI/spoke/projectHub/manual harness environments, T1 poisoned-parent and synthetic-provider validation, T2 CLI receipt proof, and native synthetic-auth adapter injection. Coordinator expanded scope to M to migrate explicit synthetic provider dependencies in remote fixture/restart callers, lifecycle, liveness, preparation and suite dry-run. Initial targeted env/native-auth files green on local macOS working tree; serial targeted provider validation in progress. Manual load/repetition probes not run because one-minute load >6. Broad T0 raw-spawn guard is a follow-up gap acknowledged by Coordinator; no public command/role/verification policy changed.

### impl-961 · 2026-10-20T10:11:50.329Z

Source review requested from reviewer role at pushed d5e81806a0800c172a69c9ce36df307b3b7e1283; assigned rev-23. A-7380 is the implementation/seam inventory and evidence limitations; provider targeted run A-7368 is 61/61 on the preceding working tree, final watchdog delta A-7371 is 1/1. At exact candidate head, npm run typecheck and T1/T2 env regression command completed green locally on macOS (6 assertions including nested tests). These targeted runs apply no runtime tier/budget/load gate; static lint remains report only (131 findings in 59 files). No manual load run or >=5 repetitions at current load >6. Mode-free hub verification waits for clear source review.
