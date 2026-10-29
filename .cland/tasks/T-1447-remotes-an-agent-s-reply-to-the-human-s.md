---
id: T-1447
kind: task
title: "Remotes: an agent's reply to the human's message arrives unthreaded on Telegram and Discord"
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: null
branch: null
created: 2026-10-29T17:00:36.038Z
updated: 2026-10-29T17:02:01.514Z
---

## Summary

Found in the v0.3.0 live run (E-1314, QA qa-677, step L3, topic-1195, A-13830), on the real @cland_app_bot and the Discord bot against the sandbox hub at dev 189d5100. The human replied to messages in both apps. The sandbox Coordinator answered with `send` carrying a nonempty `replyTo`; `./sbx hub audit` shows it at 16:57:37Z and 16:58:22Z. Its replies arrived in both apps as ordinary messages, not as replies to the human's message. The human's words: «хоть координатор и написал что reply_to передано, ни в тг ни в дискорде сообшение не было ответом, в смысле не показывало сообщение на которое отвечается». The cause is not established: the hub carries `replyTo`, but the outbound mirror may not map it to Telegram's `reply_parameters` or Discord's `message_reference`.

## What to build

When a General message has `replyTo` pointing at a message mapped to a native message on that remote, send it as a native reply: `reply_parameters` with `allow_sending_without_reply` on Telegram, and `message_reference` with `fail_if_not_exists: false` on Discord. A reply target that isn't mapped on that remote, or was deleted, still sends as a plain message. This covers the human's own messages sent from either remote and the cross-remote copies.

## Acceptance criteria

- [ ] C1. An agent's `send` with `replyTo` set to the human's Telegram message goes out as a native reply to it, shown by a production-frame test on the fake Bot API that fails before the fix.
- [ ] C2. The same holds on Discord, with `message_reference` on the fake REST.
- [ ] C3. A reply target unmapped on a remote, or deleted, still delivers once as a plain message.
