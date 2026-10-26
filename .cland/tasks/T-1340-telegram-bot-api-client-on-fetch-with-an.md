---
id: T-1340
kind: task
title: Telegram Bot API client on fetch with an API-root override, and a fake Bot API with a control API
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by: []
topic: null
branch: null
created: 2026-10-26T19:09:06.045Z
updated: 2026-10-26T19:09:12.806Z
---

## Summary

A Telegram Bot API client and a fake Bot API with a control API that plays the human. Every later Telegram ticket builds on these two.

## What to build

A client in the hub on plain `fetch` (Node 24) with hand-written types and no Telegram library. The token is validated (T-1330) and put into a URL only inside the client. HTTP timeouts are 30 s or more, and an API-root override points it at the fake, as `CLAND_DIGITALOCEAN_API` does for DigitalOcean. A fake Bot API in hub/test/fakes/ has a control API that plays the human and a stranger. It models what the prototype met: Rich Message rejections, 429 with `retry_after`, 409, a stalled long poll, membership updates and duplicate updates. Plug it into T-1331's messenger factory for `telegram`. Spec §3.7. The prototype (33bf2b2e: telegram-api.ts, discord/fake-discord.ts) may be read, never merged.

## Acceptance criteria

- [ ] C1. Against the fake Bot API, `getMe` and a send succeed through the API-root override, and a forced error, log line or artifact carries no token, shown with a made-up token (test).
- [ ] C2. The fake's control API delivers human and stranger messages, duplicate updates, a Rich Message rejection, a 429 with retry_after, a 409, a stalled poll and a membership update, each exercised by a test (test).
