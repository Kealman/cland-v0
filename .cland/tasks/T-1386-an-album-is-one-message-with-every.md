---
id: T-1386
kind: task
title: An album is one message with every attachment, stored before the offset is confirmed, and a hub killed mid-album loses nothing
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1385
topic: null
branch: null
created: 2026-10-27T23:37:27.669Z
updated: 2026-10-28T08:10:55.067Z
---

## Summary

Items sharing one `media_group_id` become one human message with all their attachments, in order, captioned with the album's first non-empty caption. Each item joins the durable group before its update is confirmed. A hub killed between items finishes the album after its restart, with nothing lost and nothing doubled.

## What to build

The media queue gains groups. An item with a group id joins the open queue entry for that chat and group, inside the same durable write that lets its update be confirmed. The group closes in one of two ways:
- no item has arrived for 2 seconds under the injected clock;
- the chat's next update outside the group arrives.

A closed group becomes one `artifact.upload` with every file in Telegram's order. The ingress id is the group's first message, and every item's chat message is mapped to the one cland message, for replies and receipts.

An item over the download cap is left out, and the reply names it. The other items still arrive. A restart recovers open and closed groups, and closes an open group by the same 2-second rule measured from the restart. The group key is opaque, so E-1312 can reuse grouping for Discord's several attachments per message. Spec §3.6 (albums), §3.9.

## Acceptance criteria

- [ ] C1. A three-photo album on the fake arrives as one General message with three artifacts in the album's order and the first item's caption as its text (test).
- [ ] C2. A hub stopped after the album's second update is confirmed, and restarted before the third, posts one message with all three artifacts, and the fake shows every update confirmed exactly once (test).
- [ ] C3. A four-item album with one 25 MB document arrives as one message with three artifacts, and the chat gets one reply naming the oversized file (test).

## Notes

Shared files: hub/src/remote/media.ts, hub/src/remote/telegram.ts, hub/src/remote/state.ts
