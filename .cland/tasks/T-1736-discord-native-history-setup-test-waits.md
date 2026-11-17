---
id: T-1736
kind: task
title: Discord native history setup test waits for native acquisition with a fixed 2000 ms bound
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1881
blocked_by:
  - T-1889
topic: topic-1606
branch: t/T-1736-discord-native-history-setup-test-waits
created: 2026-11-07T13:26:06.144Z
updated: 2026-11-17T23:18:59.311Z
---

## Summary

`hub/test/telegram-polling-restart.test.ts` "Discord native history setup omitted drains its Store writers and observations" waits for the owned native acquisition with a fixed 2000 ms real-time bound (line 331, `until(() => !!owner.native(), { … timeoutMs: 2000 })`). That is a setup wait, so it must use `testWaitMs()`. Under load it fails before the behaviour under test starts.

## Evidence

- E-1533 stage-3 macOS cover b6058278 (A-17464) at dev 093f851b, local darwin arm64, workers 2, peak 1-minute load 14.21: `Error: owned native acquisition before losing setup receipt: not within 2000 ms`. It was the only failure (6918 pass), and the stage did not touch the file (last change T-1615).
- Run alone at the same tree with `CLAND_*` stripped: 5/5 green on both expansions (omitted, aborted).

## Acceptance criteria

- [ ] C1. The native acquisition wait in both expansions uses the shared load-scaled setup budget (`testWaitMs()`), and the behaviour bounds (the 1000 ms FakeClock receipt deadline) stay exact and named.
- [ ] C2. A sweep of `hub/test/telegram-polling-restart.test.ts` and its Discord/Telegram siblings replaces every other fixed real-time setup wait with `testWaitMs()`, listed in an item comment.

## Comments

### coord · 2026-11-17T23:17:35.080Z

New instance, 2026-11-17, from duplicate T-1949: the local macOS stage cover e7494d5d at ca5f70ca4 (A-20922, peak 1-minute load 12.84) failed only telegram-polling-restart "Discord native history setup omitted drains its Store writers and observations", with "owned native acquisition before losing setup receipt: not within 2000 ms" at until.ts:40 via telegram-polling-restart.test.ts:316. Both "Discord native history setup" cases passed 5/5 alone at loads 4.86–5.11. This one fault now costs a full stage cover rerun.
