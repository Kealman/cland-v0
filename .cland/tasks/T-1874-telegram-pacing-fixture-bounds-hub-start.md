---
id: T-1874
kind: task
title: Telegram pacing fixture bounds hub start with a fixed 1 s setup deadline (remotes scenario fails under load)
state: open
status: backlog
size: S
labels:
  - flaky
  - release-blocker
assignee: null
parent: R-1530
blocked_by: []
topic: null
branch: null
created: 2026-11-15T17:13:05.465Z
updated: 2026-11-15T19:34:13.584Z
---

## Summary

`hub/test/scenarios/remotes.test.ts::Both remotes share answers, media, restart catch-up and isolate revoked Telegram` failed in merge batch 537bdc1c (T-1870 alone), run 47201382, on a Linux droplet: c-8, nyc1, workers 2, peak load 14.7, slow disk fsync of 26 ms, log A-19743. The error was `Telegram pacing fixture setup receipt deadline reached` at 2.2 s. The cause is `hub/test/telegram-pacing-fixture.ts`, which bounds the hub start in fixture setup with a fixed `options.setupTimeoutMs ?? 1_000` ms deadline. Under batch load, `projectHub` takes longer than that to start. The deadline is a setup barrier, not a behaviour under test, so a fixed 1 s bound breaks the rule that setup readiness uses the shared load-scaled waits (T-1853). T-1870 doesn't touch this file or its imports. The hub's singleton bisect dropped T-1870 on it.

## What to build

Make the pacing fixture's setup deadline use the shared load-scaled wait (`testWaitMs()` or `remoteWaitMs()`) with a named reason. Check every caller that passes `setupTimeoutMs`, and the other fixtures that copy this pattern. Behaviour bounds under test stay exact.

## Acceptance criteria

- [ ] C1. The fixture setup deadline is load-scaled, and every caller and sibling fixture with a fixed setup deadline is listed and fixed or justified (test).
- [ ] C2. remotes.test.ts passes 20 out of 20 runs at a 1-minute load of at least 8, with unchanged assertions (test).
