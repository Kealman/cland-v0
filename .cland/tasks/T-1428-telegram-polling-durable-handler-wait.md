---
id: T-1428
kind: task
title: telegram-polling durable-handler wait fails once under a loaded macOS stage cover
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: null
branch: null
created: 2026-10-28T14:23:52.818Z
updated: 2026-10-29T15:59:01.489Z
---

## Summary

`hub/test/telegram-polling.test.ts` "Telegram waits for durable handler completion and joins its writer on stop" failed once in the E-1311 stage-2 macOS cover ab376574 at cfcd0c61 (A-13338; two workers, peak load 20.95, fseventsd busy). It passed 5/5 alone on the same Mac right after (coord, 2026-10-28 14:24Z). Load flake: filed under the flaky-rerun rule.

## Acceptance criteria

- [ ] C1. The failure is attributed from receipts (which wait or bound expired under load), and the test either passes 10/10 under two workers plus CPU load on macOS or its bound is sized from measured receipts.

## Notes

First sighting. If the same identity is red again in a cover, it becomes a fix item in the running release.
