---
id: T-1318
kind: task
title: "A reasonless platform skip fails the load gate on the other platform: macOS stage cover red with zero failures"
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1284
blocked_by: []
regression_of: T-543
topic: topic-1070
branch: t/T-1318-a-reasonless-platform-skip-fails-the
created: 2026-10-26T00:27:25.158Z
updated: 2026-10-26T00:27:55.571Z
---

## Summary

The macOS stage cover eb2ca0d8 at dev 998612a6 (A-12206) exited 1 with zero failing tests. T-543's new test "Linux background Claude publishes a verifiable native birth and stops through the recorded PID" uses `{ skip: process.platform !== 'linux' }`, a skip without a reason. The load gate repeats new tests five times and accepts a skip only when it carries a reason string (`hub/test/load-gate-reporter.ts` records `skipReason` only for a non-empty string), so all five macOS repetitions failed with "expected one passing receipt". The Linux cover 20f137a5 was green because the test runs there.

## What to build

Give every platform-conditional skip in the test tree a reason string, so the load gate classifies it as a skip on the other platform. Known sites: hub/test/claude-code-sessions-lifecycle.test.ts (the Linux-only native birth test) and hub/test/executor-droplet.test.ts (the macOS-only idle-sleep test). Search the hub, nvim and web test trees for any other boolean platform skip. Optionally add a test-lint finding for a reasonless boolean `skip`, report-only or enforced, matching how comparable lint rules ship.

## Acceptance criteria

- [ ] C1. Every platform-conditional `skip` in hub/test, nvim/test and web/test passes a non-empty reason string on the skipping platform, and a load-gate unit or component test shows a reasoned platform skip counts as 5/5 skipped, not as a failure (test).
