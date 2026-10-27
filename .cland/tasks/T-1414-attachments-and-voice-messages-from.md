---
id: T-1414
kind: task
title: Attachments and voice messages from Discord become the human's artifacts and 🎤 transcripts
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1406
  - T-1413
  - E-1311
topic: null
branch: null
created: 2026-10-27T23:38:48.717Z
updated: 2026-10-27T23:38:48.717Z
---

> Pending: whether Discord attachments and voice stay in this epic (blocked by E-1311) or move to a 0.3.x release awaits the human's answer to ask 62b8d32f; the Coordinator's recommendation keeps them here. Do not launch before it is answered.

## Summary

A photo or file sent in the paired channel is fetched at once from its signed URL, without the token, and becomes the human's artifact on one message in General with the text as its caption. A voice message becomes the human's 🎤 transcript with the audio attached, echoed in the channel. A voice reply to a card answers its ask.

## What to build

**Attachments.** A counted message's attachments are checked by `size` against the `[artifacts]` limit before download. Each is fetched with a plain GET from its signed `url`, with no `Authorization` header and redirects refused. Only Discord's CDN hosts are allowed, or the fake's loopback origin under the fake root. If the URL has expired, the message is read again for a fresh one.

Together they go through E-1311's `artifact.upload` as one human message, with the content as its text and `via = "discord"`. A file over the limit gets a reply in the channel saying so.

**Voice.** A voice message is flag 8192 with one `audio/` attachment. Its `duration_secs` is checked against `[speech] max_seconds` before download. Its bytes go to E-1311's transcription path with their content type (`audio/ogg` when absent). The result is the 🎤 message with the audio attached, plus the echo as a reply in the channel (`fail_if_not_exists: false`) with the length, the times and the provider. A voice reply to a card answers its ask through the same path as a typed one.

The fake serves a CDN that records request headers and supports expiring URLs.

Spec §3.6 (inbound files, voice, bytes untouched), §3.8 (inbound voice); research rule 33.

## Acceptance criteria

- [ ] C1. A photo with a caption sent in the channel becomes one human message in General with the photo as the human's artifact and the caption as its text, and the fake CDN sees no `Authorization` header (test).
- [ ] C2. A photo sent in Discord reaches the paired Telegram chat exactly once, captioned "you (Discord)" (test).
- [ ] C3. A voice message becomes the human's 🎤 message with the audio attached through the fake speech provider, and the channel gets the echo as a reply with the length, times and provider (test).
- [ ] C4. A voice message longer than `[speech] max_seconds` is refused before any download, and a voice reply to a card answers its ask (test).

## Notes

Shared files: discord-inbound.ts; new hub/src/remote/discord-cdn.ts; hub/test/fakes/discord/ (CDN)
