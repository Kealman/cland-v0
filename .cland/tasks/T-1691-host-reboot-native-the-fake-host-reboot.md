---
id: T-1691
kind: task
title: "host-reboot-native: the fake-host reboot CLI exits non-zero under heavy load (macOS load gate 4/5)"
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1613
topic: null
branch: t/T-1691-host-reboot-native-the-fake-host-reboot
created: 2026-11-05T15:07:14.237Z
updated: 2026-11-05T15:07:51.703Z
---

## Summary

The E-1532 stage-5 macOS cover df57f563 at e786b48f (A-16872, local darwin arm64, peak 1m load 15.2) passed every base test. Its load gate, which runs five repetitions alongside the phase, passed `hub/test/host-reboot-native.test.ts` "reboot retires one host without stop or signals and bootstraps a fresh supervisor and agent" only 4/5. Repetition 1 failed in 3.96 s with `Command failed` from a child process. The fixture's separate `fake-host.ts reboot` CLI exited non-zero; its stderr is redacted in the receipt. T-1686 measured this test 10/10 under 5 burners on macOS and 10/10 in a Linux container (A-16838). The earlier failing cover 5768d4e4 also showed a reboot-native load-gate failure.

## What to build

Find why the reboot CLI command exits non-zero under heavy load. Candidates: the authenticated controller connect or `controlRequest` timeout (the reboot path uses an explicit 15000 ms), the supervisor or master restart racing the CLI, or a fixture-lifetime ownership check. Fix the cause in the fixture or product, keeping every assertion. Also make the failure keep the CLI's own stderr, redacted but present, so the next failure names its cause.

## Acceptance criteria

- [ ] C1. The failing step and its cause are named, with a reproduction under CPU load (evidence).
- [ ] C2. After the fix, host-reboot-native passes 10/10 under heavy CPU load on macOS (load 12 or more) and in a Linux container run with `docker run --init`, with assertions unchanged (evidence).
