---
id: T-1736
kind: task
title: Discord native history setup test waits for native acquisition with a fixed 2000 ms bound
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1881
blocked_by:
  - T-1889
topic: null
branch: null
created: 2026-11-07T13:26:06.144Z
updated: 2026-11-17T23:14:11.074Z
---

## Summary

`hub/test/telegram-polling-restart.test.ts` "Discord native history setup omitted drains its Store writers and observations" waits for the owned native acquisition with a fixed 2000 ms real-time bound (line 331, `until(() => !!owner.native(), { … timeoutMs: 2000 })`). That is a setup wait, so it must use `testWaitMs()`. Under load it fails before the behaviour under test starts.

## Evidence

- E-1533 stage-3 macOS cover b6058278 (A-17464) at dev 093f851b, local darwin arm64, workers 2, peak 1-minute load 14.21: `Error: owned native acquisition before losing setup receipt: not within 2000 ms`. It was the only failure (6918 pass), and the stage did not touch the file (last change T-1615).
- Run alone at the same tree with `CLAND_*` stripped: 5/5 green on both expansions (omitted, aborted).

## Acceptance criteria

- [ ] C1. The native acquisition wait in both expansions uses the shared load-scaled setup budget (`testWaitMs()`), and the behaviour bounds (the 1000 ms FakeClock receipt deadline) stay exact and named.
- [ ] C2. A sweep of `hub/test/telegram-polling-restart.test.ts` and its Discord/Telegram siblings replaces every other fixed real-time setup wait with `testWaitMs()`, listed in an item comment.
