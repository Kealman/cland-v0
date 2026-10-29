---
id: T-1438
kind: task
title: "Sealed fixtures fail open: a scratch hub with a remote enabled and no loopback API root reaches the real Discord/Telegram endpoint"
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: null
branch: null
created: 2026-10-29T10:42:10.083Z
updated: 2026-10-29T11:52:26.467Z
---

## Summary

Found by T-1371 (impl-1371, topic-1176, 2026-10-29 10:41Z). `fixtureEnvironment(root, base, extra)` strips every `CLAND_*` key from `base` and keeps only what `extra` gives. A test that passes `CLAND_DISCORD_API_ROOT` in `base`, not `extra`, loses the override. The remote then falls back to its production default (`https://discord.com/api/v10` in `hub/src/remote/discord-api.ts:57`), and made-up-token REST reads may reach Discord's real endpoint. No real token was used. Rule 15 (sealed fixtures) assumes the fixture fails closed; here it fails open.

## What to build

Make sealed fixtures fail closed for every remote and provider endpoint (Discord, Telegram, ElevenLabs): when a fixture hub has no explicit loopback root, the remote targets an unroutable loopback sentinel, or refuses at start with a plain error. It must never reach the production default. Production defaults stay unchanged outside fixtures.

## Acceptance criteria

- [ ] C1. A fixture hub with Discord enabled and no `CLAND_DISCORD_API_ROOT` in `extra` makes no request to a non-loopback host and reports a plain fixture error.
- [ ] C2. The same holds for Telegram and the ElevenLabs speech provider.
- [ ] C3. Passing the override in `base` instead of `extra` is caught by the same guard.

## Comments

### coord · 2026-10-29T10:42:29.591Z

Exposure record (impl-1371, 2026-10-29 10:42Z): before the override fix, T-1371's runs made only REST application reads with a made-up token. Setup failed before enabling Discord, so no gateway websocket and no Identify was opened. No real token or account was involved.
