---
id: T-1845
kind: task
title: The Hosts view test waits 1000 ms of real time for uptime to advance
state: open
status: backlog
size: S
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-13T17:28:32.927Z
updated: 2026-11-13T17:28:32.927Z
---

## Summary

`web/test/hosts.test.ts` "Sessions Hosts renders pushed facts and alert recovery" (desktop) waits for the Hosts row's uptime text to change, with a real-time bound of 1000 ms (`until(…, { what: 'uptime advances without a push', timeoutMs: 1000 })`). In T-1844's local mode-free verify f6402387 (log A-19208, darwin arm64, Chrome Headless Shell 1248, head 9aae88c06, no web/ change in the diff), the desktop case failed with "uptime advances without a push: not within 1000 ms" while its phone counterpart passed.

## What to build

The uptime-advance check drives the page clock (or the test's fake clock) past the next uptime tick, then asserts that the text changed, instead of waiting on wall-clock time for the page's own timer. The case then passes regardless of host load, and a stalled uptime timer still fails it.

## Acceptance criteria

- [ ] C1. The uptime-advance assertion in hosts.test.ts advances a controlled clock and no longer depends on a real-time 1000 ms wait; a page whose uptime timer is stopped still fails it (test).
- [ ] C2. The file passes the load gate's five lone repetitions on macOS and Linux, desktop and phone (test).
