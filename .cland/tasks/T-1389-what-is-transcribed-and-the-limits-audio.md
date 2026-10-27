---
id: T-1389
kind: task
title: "What is transcribed and the limits: audio files and video notes within the cap, never videos or documents, and the length checked before download"
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1388
topic: null
branch: null
created: 2026-10-27T23:37:28.350Z
updated: 2026-10-27T23:37:28.350Z
---

## Summary

Audio files and video notes go through the voice pipeline when their duration is within `[speech] max_seconds`. Videos and documents are only attached. A voice note over `max_seconds` or over 20 MB is refused before any download, with one line in the chat. Transcription keeps ticket 03's single 90-second deadline and at most two retries.

## What to build

The media module routes each kind:
- a voice note always goes to the voice pipeline;
- an audio file (`audio`, with its MIME type and name) and a video note (`video/mp4`, `video-note-<id>.mp4`) go to the voice pipeline when the declared duration is within `max_seconds`, else they are stored as plain attachments without a 🎤;
- a video or a document is stored as a plain attachment, with its caption as the text.

A voice note's duration and declared size are checked before `getFile`. Over `max_seconds` it gets "🎤 a 11:00 note is over the 10-minute limit; it was not stored", and nothing reaches General. Over 20 MB it gets ticket 05's reply.

The pipeline passes `durationSec` to the provider. A transcribed audio file's or video note's message is the 🎤 transcript, and the sender's caption, if any, follows on a second line. `max_seconds` reloads live. Spec §3.6 (what is transcribed, limits).

## Acceptance criteria

- [ ] C1. An audio file and a video note within the cap each arrive as a 🎤 transcript message with their file attached, while a video and an audio document arrive as plain attachments and the fake provider receives no request for them (test).
- [ ] C2. An 11-minute voice note gets the one-line refusal, `getFile` is never called for it, the provider receives nothing, and nothing reaches General (test).
- [ ] C3. A note whose provider answers 429 then 200 is transcribed, a provider slower than 90 seconds under the injected clock posts "🎤 not transcribed" naming the timeout, and the fake records at most three attempts for a persistent 503 (test).

## Notes

Shared files: hub/src/remote/voice.ts, hub/src/remote/media.ts, hub/src/remote/telegram.ts
