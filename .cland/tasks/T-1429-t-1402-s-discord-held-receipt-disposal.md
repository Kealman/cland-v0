---
id: T-1429
kind: task
title: T-1402's Discord held-receipt disposal test fails 1 of 5 load-gate repeats on a loaded macOS cover
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: null
branch: null
created: 2026-10-28T14:23:53.218Z
updated: 2026-10-29T15:59:40.213Z
---

## Summary

The load gate in the E-1311 stage-2 macOS cover ab376574 at cfcd0c61 (A-13338) ran T-1402's new test `hub/test/discord-messenger.test.ts` "Discord hub fixture aborted held receipt joins writers before Store close" 4/5: repetition 3 failed with "Discord exchange disposal incomplete" (AggregateError at hub/test/fakes/discord/exchange.ts). Peak load was 20.95. It passed 5/5 alone on the same Mac right after (coord, 2026-10-28 14:25Z). Load flake: filed under the flaky-rerun rule.

## Acceptance criteria

- [ ] C1. The disposal bound in the Discord exchange fake is attributed from receipts under load, and the test passes 10/10 under two workers plus CPU load on macOS, or the bound is sized from measured receipts.

## Notes

Regression candidate of T-1402 (the test's origin). The identity will leave the load gate's new-test set once stage-close durations are refreshed.
