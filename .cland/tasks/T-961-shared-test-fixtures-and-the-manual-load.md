---
id: T-961
kind: task
title: "Shared test fixtures and the manual load harness follow rule 15: own HOME and Git config, credential filter after every overlay"
state: open
status: in progress
size: S
labels:
  - ready-for-agent
  - tech-debt
assignee: null
parent: E-952
blocked_by: []
topic: topic-731
branch: t/T-961-shared-test-fixtures-and-the-manual-load
created: 2026-10-20T09:56:10.745Z
updated: 2026-10-20T09:56:40.184Z
---

## Summary

Rule 15 (adopted 2026-10-20) requires real-machine work to run sealed. The shared fixtures don't fully do this yet. hub/test/account-fixture-env.ts isolates the XDG and account roots and blanks DIGITALOCEAN_TOKEN, but it doesn't replace HOME or the Git config. `clandWithEnv` in hub/test/harness.ts overlays the environment without the shared `withoutExecutorCredentials` filter. The manual hub/test/inbox-load.ts harness serves a disposable project but inherits process.env, HOME, and the provider and account variables. Found by impl-951 and impl-768.

## What to build

The shared fixture environment builders give every child its own scratch HOME, XDG directories and Git config (GIT_CONFIG_GLOBAL and GIT_CONFIG_NOSYSTEM, or equivalent). They apply the shared credential filter after every overlay. inbox-load.ts uses the same builder. A T1 self-test, extending the poisoned-HOME self-test in setup-machine.test.ts, fails if any shared builder leaks a poisoned HOME, Git config or provider variable into the child environment.

## Acceptance criteria

- [ ] C1. account-fixture-env.ts, harness.ts `clandWithEnv` and inbox-load.ts produce child environments with scratch HOME and Git config and no provider/account variables, after every overlay.
- [ ] C2. A T1 self-test with a poisoned parent environment (HOME, Git config, DIGITALOCEAN_TOKEN, a provider key) fails against the old builders and passes against the new ones.
