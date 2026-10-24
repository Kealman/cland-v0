---
id: T-1108
kind: task
title: Late-PID probe test fails cleanup with ENOTEMPTY when its fake ps rewrites a marker after teardown
state: open
status: backlog
size: XS
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: null
branch: null
created: 2026-10-22T13:55:59.920Z
updated: 2026-10-24T06:46:22.369Z
---

## Summary

On the Linux droplet, the periodic integrated dev run e64431b1 at fae121ec (A-9183) failed T3 `hub/test/claude-code-accounts.test.ts` › "a late Claude PID can be stopped while its identity probe is pending" in teardown, not in its assertions: `ENOTEMPTY: directory not empty, rmdir '/tmp/cland-suite-…/cland-claude-pid-probe-…'`. The test's fake `ps` writes a `finished` marker into the temp directory on every call. A probe from the still-running fixture hub most likely recreates that marker while `tempProject` removes the directory.

## What to build

Teardown is race-free. Either stop the fixture hub before the temp directory is removed, or have the fake `ps` write its marker outside that directory (or only once). The test keeps its current assertions.

## Acceptance criteria

- [ ] C1. The named test passes 20/20 in a targeted loop on macOS under CPU load, and its single file passes in a mode-free `cland verify` at the head.
- [ ] C2. Its cleanup never removes the probe directory while the fixture hub can still call the fake `ps` (shown by the teardown order in the diff or by a test assertion).

## Comments

### coord · 2026-10-22T13:56:37.245Z

This is the hub's periodic dev-t3 red notice (suite e64431b1, head fae121ec; previous green 1b4291e6, 54 merges in between, droplet c-8 lon1, lifetime 1636 s, $0.1136). No commit in 1b4291e6..fae121ec touches the failing test file or any of its imports: account-fixture-env.ts, adapters/claude-code.ts, fake-clock.ts, protocol.ts, harness.ts, native-process.ts, process-cleanup.ts. The failure is ENOTEMPTY in teardown. I read it as a pre-existing teardown race, not a regression from the range.

### coord · 2026-10-22T13:58:35.315Z

The hub's failing-file rerun de13704a (A-9185) at the same head fae121ec ran on a droplet (c-8 lon1, 139 s, $0.0096). claude-code-accounts.test.ts passed 8/8, which confirms an intermittent teardown race, not a deterministic failure.

### coord · 2026-10-22T19:12:15.036Z

Recurred in a full Linux run of T-1150 at e83b5945 (verify all 58a7464d, A-9422, c-8 lon1): the same ENOTEMPTY rmdir on cland-claude-pid-probe-* during teardown. The run went red only on this; T1, T2 and every other T3 test passed. That makes two occurrences today, so it now costs full reruns.
