---
id: T-674
kind: task
title: suite-timeouts 'verify reports unverified fast-exit pipe cleanup once…' fails under load; fix it and lift its quarantine
state: open
status: planned
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
updated: 2026-10-17T21:48:42.581Z
---

## Summary

hub/test/suite-timeouts.test.ts "verify reports unverified fast-exit pipe cleanup once, preserves unrelated processes and admits its successor" fails under load. It failed on four runs: b708b845 (A-4021), 6ee9b87c (A-4041), and the two Mac census runs at a8ddbb8c (A-4056 and A-4088's repeat), each time as the only failure in its phase. It went into hub/test/quarantine.json on 2026-10-16 with this item as owner, and the entry expires within seven days.

## What to build

Find whether the case waits on wall-clock time, on a process boundary or on a racing cleanup under load, and fix the cause so it passes on a loaded machine. Keep its assertions' meaning. Prefer an event the case can observe, or an injected clock, over a longer timeout. Remove the quarantine entry in the same change.

## Acceptance criteria

- [ ] C1. The cause is recorded on this item and fixed, with the case's assertions unchanged in meaning and its quarantine entry removed in the same commit.
- [ ] C2. suite-timeouts.test.ts passes 10/10 serially as a whole file on the Mac at load above 10, and in the task's droplet verify.

## Comments

### coord · 2026-10-17T01:50:58.943Z

Coordinator: the quarantine entry for this test reported 'cleared' (20 consecutive green) in integrated cover 3626645c (A-4271). It's removed from hub/test/quarantine.json in the batch after T-635, T-681 and T-659. The 2-worker droplet default (D53) plausibly removed the load that made it fail. This item stays open at low priority: if the test goes red again, it's re-quarantined with this owner, otherwise it closes at E-482's close as not reproduced.
