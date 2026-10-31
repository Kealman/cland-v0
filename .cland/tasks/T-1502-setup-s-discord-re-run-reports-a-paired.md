---
id: T-1502
kind: task
title: Setup's Discord re-run reports a paired remote as open while the gateway reconnects
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
regression_of: T-1371
topic: null
branch: null
created: 2026-10-31T06:16:04.978Z
updated: 2026-10-31T06:16:04.978Z
---

## Summary

A non-interactive re-run of `cland setup` reports the paired Discord remote as `open` rather than `ok` if it samples the gateway while it reconnects. This reddened the 0.3.1 release cover 70e41a22 (A-14832, shard-2) at e5b310a78. The failing test was `setup-remote-component.test.ts` "Discord setup checks application before enabling and pairs through native /cland pair (repair=false)", at line 183 (`'open' !== 'ok'`).

## Evidence

- Linux droplet shard-2 at e5b310a7882d7354118984e7137e586b071b45e0. Disk fsync was 25.86 ms on shard-2 against 7.59 ms on shard-1. In the same shard, Discord and Telegram tests ran 2–10× slower than baseline: discord-messenger 1.5 → 14.2 s, telegram-inbound 1.5 → 13.3 s, discord-cards 9.3 → 21.1 s.
- The failing test passed 5/5 alone on macOS at the same head (15 passes in total).
- In `hub/src/setup/steps/discord.ts`, the up-front `ok` check needs `connection === 'connected'` at a single instant. The interactive path already waits up to 10 s while the connection is `disconnected`. The non-interactive path does not wait, so a transient non-connected state while the gateway is paired yields `open`.

## Acceptance criteria

- [ ] C1. A test that holds the paired Discord gateway in a non-connected state and connects it within the bound gets `ok` from the non-interactive setup re-run. A gateway that stays down past the bound still gets `open`. Both outcomes are on fake clocks or fake gateways, not wall-clock sleeps.
- [ ] C2. The existing `setup-remote-component.test.ts` Discord cases pass 10/10 alone, and the Telegram counterpart is checked for the same single-sample pattern and fixed or ruled out in the item's notes.
