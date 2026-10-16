---
id: T-674
kind: task
title: suite-timeouts 'verify reports unverified fast-exit pipe cleanup once…' fails under load; fix it and lift its quarantine
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - flaky
  - hub
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-16T19:04:11.816Z
updated: 2026-10-16T19:04:11.816Z
---

## Summary

hub/test/suite-timeouts.test.ts "verify reports unverified fast-exit pipe cleanup once, preserves unrelated processes and admits its successor" fails under load. It failed on four runs: b708b845 (A-4021), 6ee9b87c (A-4041), and the two Mac census runs at a8ddbb8c (A-4056 and A-4088's repeat), each time as the only failure in its phase. It went into hub/test/quarantine.json on 2026-10-16 with this item as owner, and the entry expires within seven days.

## What to build

Find whether the case waits on wall-clock time, on a process boundary or on a racing cleanup under load, and fix the cause so it passes on a loaded machine. Keep its assertions' meaning. Prefer an event the case can observe, or an injected clock, over a longer timeout. Remove the quarantine entry in the same change.

## Acceptance criteria

- [ ] C1. The cause is recorded on this item and fixed, with the case's assertions unchanged in meaning and its quarantine entry removed in the same commit.
- [ ] C2. suite-timeouts.test.ts passes 10/10 serially as a whole file on the Mac at load above 10, and in the task's droplet verify.
