---
id: T-1346
kind: task
title: Telegram commands laid out for a phone and the menu registered only on change
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1342
topic: null
branch: null
created: 2026-10-26T19:09:07.381Z
updated: 2026-10-26T19:09:13.606Z
---

## Summary

The Telegram commands `/status`, `/inbox`, `/mute`, `/unmute`, `/decision`, `/question`, `/cancel`, `/help` and `/start` answer in a layout made for a phone screen. The command menu is registered for private chats only when it differs from what Telegram holds.

## What to build

Replies open with a title line, then groups under bold labels (Hub, Coordinator, Sessions, Queues, Release, This chat), one fact per line, with sessions as bullets and the gateway's numbers last as small text. `/help` has short headed sections with the commands as a bullet list and the trust lines last. Replies are text with entities. The reads go through the gateway's allowed reads (T-1321). Spec §3.10.

## Acceptance criteria

- [ ] C1. `/status`, `/inbox` and `/help` render in the specified layout as text with entities, and `/cancel` and `/start` answer as spec §3.10 says (test).
- [ ] C2. The first hub start registers the menu for private chats, and a second start with the same menu registers nothing (test).
