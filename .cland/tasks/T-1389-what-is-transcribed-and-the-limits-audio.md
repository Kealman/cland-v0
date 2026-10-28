---
id: T-1389
kind: task
title: "What is transcribed and the limits: audio files and video notes within the cap, never videos or documents, and the length checked before download"
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1388
topic: topic-1160
branch: t/T-1389-what-is-transcribed-and-the-limits-audio
created: 2026-10-27T23:37:28.350Z
updated: 2026-10-28T19:32:59.203Z
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

- [x] C1. An audio file and a video note within the cap each arrive as a 🎤 transcript message with their file attached, while a video and an audio document arrive as plain attachments and the fake provider receives no request for them (test).
  - done: impl-1389 · 2026-10-28T19:25:30.474Z
- [x] C2. An 11-minute voice note gets the one-line refusal, `getFile` is never called for it, the provider receives nothing, and nothing reaches General (test).
  - done: impl-1389 · 2026-10-28T19:25:30.699Z
- [x] C3. A note whose provider answers 429 then 200 is transcribed, a provider slower than 90 seconds under the injected clock posts "🎤 not transcribed" naming the timeout, and the fake records at most three attempts for a persistent 503 (test).
  - done: impl-1389 · 2026-10-28T19:25:31.656Z

## Notes

Shared files: hub/src/remote/voice.ts, hub/src/remote/media.ts, hub/src/remote/telegram.ts

## Comments

### impl-1389 · 2026-10-28T19:21:40.923Z

Consumer inventory before admission change: telegram.ts is the sole voiceNote caller and native MediaFile producer; media.ts persists/reads MediaInput without a schema change; telegram-voice*.test.ts and telegram-inbound.test.ts exercise these records; speech/index.ts and speech*.test.ts own durationSec, deadline/retries; gateway-config.ts/gateway.ts/config-set.test.ts own live speechSettings reload; CLI/setup/doctor/public docs consume config only. Searched hub/src, hub/test (all tiers), web, nvim, qa, shipped skills and docs for voiceNote, MediaFile, mediaFile, speechSettings, max_seconds. No wire/reply/schema fields change. Optional filename input preserves existing voiceNote defaults and old durable media records; missing speechSettings retains 600 seconds. Existing previous-wire tests remain unaffected.

### impl-1389 · 2026-10-28T19:24:51.433Z

Spec gap resolved by Coordinator decision 0ef9a955-4b94-4a37-8f22-e677521cbfcb: standalone audio/video notes transcribe within cap; grouped audio stays one album message retaining every attachment without transcription. Multi-transcript albums are a follow-up owned by Coordinator. Added two-audio album regression. TDD red observations: audio/video_note cases timed out awaiting voice completion on original plain-attachment implementation; duration/size refusals failed native line assertion 0 !== 1 before admission guard. Both slices green after changes. C3 retries/deadline already implemented in speech wrapper; new end-to-end regression controls pass without speech changes.

### rev-31 · 2026-10-28T19:28:01.478Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261028-1389-source1
commit: 4e28e4fcf3c48b736fd68a47e90399e45d756ab9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13425 full source1 clear: Standards0/Spec0. Reviewed recording admission/live cap, pre-getFile duration/size refusal, original MIME/name/bytes/caption, optional filename compatibility and unchanged90s/three-attempt wrapper. New bounded T2 controls retain actual requests, retry scheduling, durable media/echo completion and exact final assertions. Coordinator0ef9a955 grouped-audio exception explicitly accepted with two-audio preservation control/follow-up; no missing album transcription requirement. Consumer inventory/config reload/docs checked; no schema/permission/dependency/new process change. Local reported macOS19/19/typecheck not Linux/configured evidence. C1–C3 runtime-unverified, keep head stable, one mode-free verify then original-record audit with new-case load/timing receipts. No per-item QA; integrated gates Coordinator-owned.

### coord · 2026-10-28T19:32:59.203Z

Decision (ask c848fe23, answered 19:32:50Z under the human's standing yes of 05:04Z): a Telegram album of audio files stays one message with every file attached and no transcription in 0.3; per-file album transcripts are T-1433 in Follow-ups.
