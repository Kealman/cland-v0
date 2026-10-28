---
id: T-1387
kind: task
title: "Outbound artifacts on Telegram: photos up to 10 MB, documents up to 50 MB, each artifact once per remote, and a line for anything larger"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1381
topic: null
branch: null
created: 2026-10-27T23:37:27.927Z
updated: 2026-10-28T08:10:55.227Z
---

> Pending: the once-per-remote behaviour below is the Coordinator's recommendation awaiting the human's answer to ask 62b8d32f; do not launch before it is answered.

## Summary

A mirrored General message's artifacts follow it to Telegram:
- a PNG, JPEG, GIF or WebP image up to 10 MB goes as a photo;
- any other file up to 50 MB, HTML and diagrams included, goes as a document;
- folders, deleted files and anything larger go as a line with the name and the project-relative path.

Each artifact goes once per remote, captioned with the message's header, and a single artifact with a short text goes as the file captioned with the header and the text.

## What to build

**A messenger-neutral planner.** It takes a message and a messenger's limits (photo cap, document cap, caption length, image types). It returns the ordered sends:
- the text part, when it does not fit a caption;
- one file per artifact;
- a line per artifact that cannot go as a file.

The message's artifacts are `artifact` and `artifacts` deduplicated by id. Telegram's limits are 10 MB, 50 MB and 1024.

**On Telegram.**
- The outbox gains `sendPhoto` and `sendDocument` jobs. They hold the artifact id and the caption, never bytes. At send time they read the file, confined to `.cland/artifacts` with no symlink.
- Captions are plain text with no entities (the CRLF entity shift).
- One message's sends are enqueued together, so nothing interleaves.
- The once key is stored per remote with the artifact id, per the recommended reading in the assumptions (open). A replay, a restart or a duplicated field never sends a file twice.
- An outage marks file jobs missed like their message.
- The outbox's uncertainty rule applies: an upload that may have left is never resent.
- What the human sent from this remote is still not mirrored, files included.

**Shared contract:** none; the outbox payload is internal. Spec §3.6 (outbound artifacts) and §3.4; Q-1293 (once per remote).

## Acceptance criteria

- [ ] C1. An agent's General message with a PNG and a PDF and a long text arrives as the text, one photo and one document, each captioned with the message's header and each sent exactly once, even though the message carries the PNG in both `artifact` and `artifacts` (test).
- [ ] C2. A single 2 KB note artifact with a one-line text arrives as one document whose caption is the header, a newline and the text, with no `caption_entities` (test).
- [ ] C3. A 60 MB artifact, made as a sparse file, arrives as one line naming its id, title, size and `.cland/artifacts/…` path with no absolute path, and a 12 MB PNG arrives as a document (test).
- [ ] C4. Restarting the hub while a file job is queued sends it once, and an upload the fake holds past its timeout is not resent (test).
- [ ] C5. An image uploaded through the web's `artifact.upload` path arrives captioned "you · message", while the same upload made via Telegram is not sent back to Telegram (test).

## Notes

Shared files: hub/src/remote/telegram.ts, hub/src/remote/telegram-outbox.ts, hub/src/remote/state.ts, hub/src/remote/media.ts

## Comments

### coord · 2026-10-28T05:05:33.064Z

The human accepted the Coordinator's recommendation in ask 62b8d32f (2026-10-28 05:04Z, 'Да, все три рекомендации'). The pending note at the top of this item is resolved: build the behaviour as written; the hold is lifted and the ticket launches with its stage.
