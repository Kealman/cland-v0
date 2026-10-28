---
id: T-1385
kind: task
title: Photos and documents from Telegram become the human's artifacts on one message, through a durable media queue, and no paired update stalls the poll loop
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1381
  - T-1382
topic: null
branch: null
created: 2026-10-27T23:37:27.517Z
updated: 2026-10-28T08:10:54.534Z
---

> Overlap: T-1378 (Bugs, regression of T-1341) proposes a smaller fix for the same poll-loop stall and awaits the human's answer to ask 82ff046e. If T-1378 lands first, build on it and keep its tests; otherwise this ticket's fallback reply closes T-1378's criteria too.

## Summary

A photo or document from the paired human becomes their message in General, or a reply in the replied message's topic. The file is an artifact and the caption is the text, with `via = "telegram"`. The item is stored in a durable media queue before the offset is confirmed. A file over 20 MB gets a reply saying so, and the token-bearing URL never leaves the hub. Every other message kind gets a one-line reply instead of stalling the loop.

## What to build

**The durable media queue.** A messenger-neutral media module (`media.ts`) owns a durable per-chat queue in `hub.db`, keyed by chat and message id.
- The poller's media handler records the attachment's facts: kind, `file_id`, name, MIME type, declared size, duration, caption, reply target and `date`. It resolves only once that record is durable, so the offset follows it.
- A per-chat worker drains the queue in order, and recovers it at start.
- An ordinary text that arrives while the chat has queued media is queued behind it. Presses, commands and prompts are not.

**Each item.**
- A photo takes its largest size, named `photo-<message id>.jpg` as `image/jpeg`. A document keeps its name and MIME type, with `application/octet-stream` when absent.
- A declared size over the limit gets one reply and no download: "<name> is 25 MB: a bot can download at most 20 MB, so it was not stored". The limit is 20 MB or `max_upload_mb`, whichever is smaller.
- Otherwise the bytes are downloaded through ticket 01's capped download and passed to `artifact.upload` beside the frame, with the ingress id, the caption as text (formatting dropped), and General or the replied message's topic.
- The 👌/👀 receipts work as for text, and the late-message suffix of T-1348 applies to the caption.
- A failure gets one reply, and the item stays queued only for transient errors.
- Audio files, video notes and videos are stored the same way here. Voice and transcription come in ticket 08.

**The fallback.** Stickers, locations, contacts, polls, edited messages and every other kind from the paired human get one reply ("This kind of message does not reach General") and are confirmed.

**Shared contract:** none beyond ticket 02's frame. Spec §3.6 (inbound files), §3.9 (store, then confirm) and §3.12.

## Acceptance criteria

- [ ] C1. A photo with the caption "the error" sent on the fake arrives as one General message from `human` "via Telegram" with that text and one `.jpg` artifact whose bytes match the largest size, and the photo message gets 👌 (test).
- [ ] C2. A document replying to a mirrored message in an item topic lands in that topic as a reply carrying the document artifact with its name, and a document without a caption arrives with an empty text and the artifact (test).
- [ ] C3. A document declared as 25 MB gets the 20 MB reply, `getFile` is never called for it, and nothing reaches General (test).
- [ ] C4. After a stopped hub restarts on a media item that was stored and confirmed but not yet uploaded, it is uploaded exactly once, and a text sent after it reaches General after it (test).
- [ ] C5. No frame, hub log line, journal record, artifact or General message produced by these cases contains the made-up token or a `/file/bot` URL, and a sticker and an edited message each get the one-line reply while a later text still reaches General (test).

## Notes

Shared files: hub/src/remote/telegram.ts, hub/src/remote/telegram-inbound.ts, hub/src/remote/state.ts, hub/src/remote/media.ts (new)
