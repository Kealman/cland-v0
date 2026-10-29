---
id: T-1445
kind: task
title: Fake-droplet tests leak a polling 'npm test' and node pair whenever a run ends without writing the finish file
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1194
branch: t/T-1445-fake-droplet-tests-leak-a-polling-npm
created: 2026-10-29T16:09:32.114Z
updated: 2026-10-29T16:48:52.003Z
---

## Summary

On 2026-10-29 the Mac had 97 orphaned `npm test` processes (ppid 1, 10–15 days old), each with a `node -e` child that checks every 50 ms for `$HOME/finish`. Their cwd was `…/T/cland-fake-do-*/droplet-*/home/runner/cland`. That's about 194 processes, adding load while swap was nearly full (396 MB free). Coord stopped them with SIGTERM; free swap rose to 1.5 GB. Tests that start that finish-polling child: `executor-safety`, `executor-run`, `suite-candidate`, `suite-close-recovery` and `suite-remote-process`. A run that ends, is cancelled or times out without writing `finish` leaves the pair running forever.

## What to build

Every fake-droplet run's remote command exits or is killed when its test or fixture ends: write `finish`, or kill the process group in the fixture's cleanup, including timeout and abort paths. The poller itself also gives up after a bounded time. Add a census assertion so a leaked pair fails the test.

## Acceptance criteria

- [x] C1. Each listed test file leaves no `npm test` or finish-polling `node` process behind after it passes, fails or is aborted, shown by a process census in the test.
  - done: impl-1445 · 2026-10-29T16:24:22.032Z
- [x] C2. The finish poller exits by itself after a bounded time even if nobody writes `finish`.
  - done: impl-1445 · 2026-10-29T16:24:22.166Z

## Comments

### impl-1445 · 2026-10-29T16:17:00.187Z

Scope/seams: fake provider close + native process census for owned disposable machine roots (C1); test-owned barrier command native exit without finish (C2). Consumer search: fakeDigitalOcean used by remote-fixture, executor fixtures/tests and cloud/test helpers; remote-fixture supplies executor-run/safety, close-run-fixture supplies suite-close-recovery/suite-remote-process. suite-candidate uses local suite-fixture instead. No production/wire/schema/admission contract changes planned; existing fake close signature retained. Will place ownership cleanup at fake provider boundary, with census assertions and bounded barriers.

### impl-1445 · 2026-10-29T16:20:12.359Z

Red receipts (macOS local working tree): close census [82495,82521] remained after old provider close, assertion failed; C2 without deadline got null exit from 2s exec timeout instead of 124. Both owned processes drained in finally. Green executor-safety.test.ts: 8 tests, including shell/host timeout, failed-provider cleanup, cancel/stopped-hub watchdog, new provider close census and independent deadline. New case durations 992ms and 78ms on macOS. npm run typecheck passed. Shared helper fixes canonical stateRoot + close-owned process drainage/census; no production contracts changed. All fake-api callers retain old close signature; scripted close skips OS scans. Consumer inventory: executor-safety, suite-dry-run, executor-admission, executor-droplet, startup-ready-component, suite-unit-fixture, executor-prepare, daemon, droplet-fixture, executor-prepare-component, remote-fixture; their transport behaviour unchanged except guaranteed teardown.
