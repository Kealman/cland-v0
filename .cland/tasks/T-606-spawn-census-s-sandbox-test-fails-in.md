---
id: T-606
kind: task
title: "spawn-census's sandbox test fails in integrated macOS runs: the sandboxed child inherits NODE_V8_COVERAGE"
state: open
status: in progress
size: XS
labels:
  - v0.1.3
  - hub
  - test
assignee: null
parent: E-426
blocked_by: []
regression_of: T-394
topic: topic-374
branch: t/T-606-spawn-census-s-sandbox-test-fails-in
created: 2026-10-16T12:29:04.656Z
updated: 2026-10-16T12:29:33.333Z
---

## Summary

The v0.1.3 macOS release run dbf1b763 at 0e2a0aee (A-3904) failed hub/test/spawn-census.test.ts:93, "a sandbox denying census log writes preserves child stdout, exit and spawns". Since T-394, integrated dev runs record coverage, so `NODE_V8_COVERAGE` is set to the run's coverage-map.json.raw directory. The test passes `...process.env` to a child under `(deny file-write*)`. That child can't write its coverage file and prints `EPERM: Failed to write file …/coverage-….json` to stderr, which breaks the test's `stderr === ''` assertion. Droplet runs skip the test, because they have no sandbox-exec, so only an integrated macOS run shows it.

## What to build

In that test only, remove `NODE_V8_COVERAGE` from the env given to the launcher, so neither the launcher nor its sandboxed child writes coverage. Grep hub/test and nvim/test for other sandbox-exec tests that pass `process.env` to a child under a write-denying profile, and apply the same removal there if any exist. No production change.

## Acceptance criteria

- [ ] C1. The test passes on macOS both with and without `NODE_V8_COVERAGE` set in the parent's environment (run once each way), and every other sandbox-exec test file under hub/test and nvim/test passes with it set.
