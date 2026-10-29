---
id: T-1428
kind: task
title: telegram-polling durable-handler wait fails once under a loaded macOS stage cover
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1204
branch: t/T-1428-telegram-polling-durable-handler-wait
created: 2026-10-28T14:23:52.818Z
updated: 2026-10-29T18:14:00.296Z
---

## Summary

`hub/test/telegram-polling.test.ts` "Telegram waits for durable handler completion and joins its writer on stop" failed once in the E-1311 stage-2 macOS cover ab376574 at cfcd0c61 (A-13338; two workers, peak load 20.95, fseventsd busy). It passed 5/5 alone on the same Mac right after (coord, 2026-10-28 14:24Z). Load flake: filed under the flaky-rerun rule.

## Acceptance criteria

- [ ] C1. The failure is attributed from receipts (which wait or bound expired under load), and the test either passes 10/10 under two workers plus CPU load on macOS or its bound is sized from measured receipts.

## Notes

First sighting. If the same identity is red again in a cover, it becomes a fix item in the running release.

## Comments

### impl-1428 · 2026-10-29T18:14:00.296Z

Baseline: macOS targeted durable-handler test passed 79.795 ms. Original A-13338 contains only generic “executor operation deadline reached” at deadline.ts:20/24 (1.426460916 s total), no await-site stack, so the original expired boundary cannot honestly be attributed from that receipt alone. Plan: name/time each of the three actual receipts (handler entry, cancellation, completed hub stop), reproduce under authorized exclusive stress capacity, then retain exact writer/offset assertions. Test-only change; no shared contract consumers to migrate.
