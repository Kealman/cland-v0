---
id: T-1375
kind: task
title: suite-remote-process budget-slot test leaks a child process under a loaded macOS stage cover
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: topic-1118
branch: t/T-1375-suite-remote-process-budget-slot-test
created: 2026-10-27T16:48:16.391Z
updated: 2026-10-27T17:43:15.896Z
---

## Summary

`hub/test/suite-remote-process.test.ts::finished remote runs free both budget slots despite failed spend settlement` failed once in the macOS stage cover e39a3a5a (dev 20c93783, local, 2 workers, peak 1m load 8.88; log A-12840). Its body passed; the projectHub leak check after it found one `PROCESSWRAP` still active. Alone it passed 5/5 on the same tree.

## What to build

The test ends right after the two waiting runs are admitted, so their remote launches (with `faults.create = 422`) can still own a child process when the leak check runs on a loaded host. Make the test await each admitted waiter's terminal result (or its owned child's exit) before it returns, so cleanup observes no live process, and prove it under CPU load.

## Evidence

- Failure: `AssertionError: projectHub leaked resources; active before=CloseReq,PipeWrap,PipeWrap,PipeWrap,TCPServerWrap after=PipeWrap,PipeWrap,PipeWrap`, actual `resources: ['PROCESSWRAP']` (hub-resources.ts:33 via process-cleanup.ts:100).
- Linux stage cover 9e9aeedb at the same commit green (A-12836).
- Flaky-rerun rule: 5/5 alone on macOS at 20c93783; one cover resubmit.

## Acceptance criteria

- [ ] C1. The test awaits the terminal state of every run it admits before returning, and the leak check finds no active process.
- [ ] C2. The identity passes 10/10 under two workers plus owned CPU load on macOS.

## Comments

### coord · 2026-10-27T17:19:28.368Z

Second macOS stage cover at the same tree (8f990137, A-12841, peak load 9.76) failed on the same identity with the same PROCESSWRAP leak, so it is not a one-off flake (flaky-rerun rule: same test red twice → report). History: it passed in all three macOS stage covers at 91d2dc4a (1e276de4, ce65f192, c6a30da9) and in the Linux covers at both 91d2dc4a and 20c93783; it fails in both macOS covers at 20c93783. Between them only e59731e6 (tracker) and T-1374 landed (test-only files plus durations.json and lint-baseline.json), so the likely trigger is changed shard scheduling and neighbours under load, not product code. It blocks the E-1310 stage 2 / E-1313 stage 1 close.

### impl-1375 · 2026-10-27T17:43:15.896Z

TDD at existing T3 nativeProjectHub/fake DigitalOcean seam: temporarily wrapped only waiters' ssh-keygen with a 4-second owned-fixture delay and recorded PIDs. Old tail plus terminal assertion failed: `admitted waiter a3e67297-f8c6-4e13-a927-caf15b4770da has no terminal result` (macOS local, one identity, 14.45661025 s). Same control plus waits for both waiter terminal reports passed (15.975540125 s). This proves the early-return boundary; the original PROCESSWRAP leak has not yet reproduced in this control (cleanup reaped the delayed children). Testing the unmodified schedule with creation-stack capture under the approved owned-load probe before attributing the exact leak.
