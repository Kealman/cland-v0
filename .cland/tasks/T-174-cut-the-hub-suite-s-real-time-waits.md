---
id: T-174
kind: task
title: "Cut the hub suite's real-time waits: configurable test windows, full suite under 5 minutes"
state: open
status: backlog
labels:
  - tech-debt
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-10T12:06:34.631Z
updated: 2026-10-10T12:06:34.631Z
---

## Parent

T-19 (follow-ups). From the stand-in's suite-queue analysis on 2026-10-10.

## What to build

The full hub suite runs 961 tests in 3172 s of test time, at concurrency 4: 10–14 minutes wall. 403 tests take 3 s or more. The slowest wait in real time:
- 65 s: equal events outside the sixty-second window;
- 36 s: session launch --item (twice);
- 33 s: doctor on a healthy project;
- then 27 s, 24 s, 20 s and more.

Cut the real-time waits without weakening what the tests check. Make windows and timeouts configurable for tests (an environment value, or an injectable clock), and set them short in the harness. Target a full hub suite under 5 minutes.

## Acceptance criteria

- [ ] The ten slowest tests are cut to under 5 s each, with the same assertions.
- [ ] No production default changes; test-only knobs are documented in hub/README.md.
- [ ] The full hub suite runs under 5 minutes wall on the dev machine at concurrency 4, measured and recorded as an artifact.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M. tech-debt.
