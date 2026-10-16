---
id: T-673
kind: task
title: "nvim sessions test: the reset-label case depends on the time of day and fails near Kolkata midnight (18:30Z)"
state: open
status: backlog
size: S
labels:
  - bug
  - flaky
  - nvim
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-16T18:32:31.742Z
updated: 2026-10-16T18:32:31.742Z
---

## Summary

nvim/test/sessions.test.ts "source windows keep severity, local resets and stale age, wrap at 30 columns and leave default sessions unnamed" depends on the time of day. It runs the UI in TZ=Asia/Kolkata (UTC+5:30) and builds reset times from `Date.now()`, so a run near Kolkata midnight (18:30Z) crosses a day boundary between the test's clock and the UI's render, and the weekday/date labels it expects change. It failed this way in T-657's droplet run 84ec4964 (A-4107, log lines 7155–7170), which reached the Neovim phase at about 18:30Z: `stale.includes('↻<weekday> <time>')` for the tomorrow window was false.

## What to build

The test takes a fixed instant well away from a day boundary in its zone, or injects the UI's clock, so the labels it asserts don't depend on when the suite runs. Each assertion keeps its meaning: today's reset shows a time, tomorrow's a weekday and time, a later one a date.

## Acceptance criteria

- [ ] C1. The case passes when the suite's clock is set just before and just after Kolkata midnight, proved by running it with the two instants (an injected clock or a fixed `now`), with its assertions' meaning unchanged.
- [ ] C2. nvim/test/sessions.test.ts passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
