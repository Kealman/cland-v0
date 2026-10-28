---
id: T-1406
kind: task
title: Replies land in their topic, and 👌 and 👀 confirm the human's messages
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1400
topic: null
branch: null
created: 2026-10-27T23:38:47.088Z
updated: 2026-10-28T08:10:56.870Z
---

## Summary

A reply from the human maps through its message reference to the mirrored message and lands in that topic as a reply. 👌 confirms that General stored the human's message, and 👀 that its addressee has it. Other members' replies are ignored.

## What to build

**Replies.** A type 19 message from the paired user reads `message_reference.message_id`, looks up `remote_messages` and sends `topic.send` with `replyTo` into the mapped topic. A reply to an unmapped or deleted message goes to General as a plain message. Ticket 16 handles replies to notices.

**Reactions.** They go as `PUT …/reactions/<emoji>/@me` jobs through the outbox: 👌 once the hub stores the message, and 👀 once a `delivery` frame says delivered or injected. Each reaction goes once, recorded under `discord.inbound:<message>` receipts that a restart recovers, as Telegram's do.

The fake records reactions per message and user.

Spec §3.4 (replies, feedback by reaction), §3.8 (inbound); research rule 34.

## Acceptance criteria

- [ ] C1. A reply to a mirrored General message reaches General as a reply to that message, and a reply to an unmapped message reaches General as a plain message (test).
- [ ] C2. The human's message gets 👌 once General stores it and 👀 once its addressee has it, each exactly once, even with a hub restart between the two (test).
- [ ] C3. Another member's reply to a mirrored message reaches nothing and gets no reaction (test).

## Notes

Shared files: discord-inbound.ts; hub/test/fakes/discord/ (reactions)
