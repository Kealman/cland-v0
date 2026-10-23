---
id: T-1183
kind: task
title: Web tests pause the page clock at the time it was installed, which fails under load
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by: []
regression_of: T-1173
found_by: review
topic: null
branch: t/T-1183-web-tests-pause-the-page-clock-at-the
created: 2026-10-23T20:30:13.366Z
updated: 2026-10-23T20:30:31.473Z
---

## Summary

Thirteen Web test sites call `page.clock.install({ time: T })` and then `page.clock.pauseAt(T)` for the same T. `install` starts the fake clock running from T, so under load T can already be in the past when `pauseAt` runs, which throws `Cannot fast-forward to the past`. impl-1175's targeted run hit it on 2026-10-23 at 20:29Z in web/test/phone-disconnected.test.ts:121; the same file passed alone on dev 3/3. The pattern also appears in accounts, asks, composer, events, notifications and inbox tests.

## What to build

Add one shared helper to web/test/harness.ts, for example `pausePageClock(page, time)`. It installs the page clock a little before `time` and pauses at `time`, so the pause target is always ahead of the running clock. Move every install-then-pauseAt site to the helper. Use the test-lint, or a grep check in an existing guard test, to keep the raw same-time pattern from coming back.

## Acceptance criteria

- [ ] C1. No Web test calls `page.clock.install` and then `page.clock.pauseAt` with the same time; all of them use the shared helper, and a guard test fails on a new raw pair (test).
- [ ] C2. web/test/phone-disconnected.test.ts passes 10 of 10 runs at two workers on macOS with two parallel CPU loaders (Web test).
