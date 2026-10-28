---
id: T-1388
kind: task
title: A voice note becomes the human's 🎤 transcript message with the audio attached, and the bot echoes it with its timings and provider
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1383
  - T-1384
  - T-1385
topic: null
branch: null
created: 2026-10-27T23:37:28.063Z
updated: 2026-10-28T17:02:23.535Z
---

## Summary

A voice note joins the media queue. The gateway downloads it, then transcribes the original bytes through the configured provider within one 90-second deadline, and posts the human's message "🎤 <transcript>" with the audio attached. A missing key, a failure or silence still posts the audio, with "🎤 not transcribed", "🎤 not transcribed: <reason>" or "🎤 nothing recognised", and the chat gets one line. The bot echoes the transcript with the note's length, the download and transcription times and the provider's name.

## What to build

**Wiring.** The messenger factory receives the speech provider built from the reloaded `[speech]` settings and secrets by ticket 04's factory. It is rebuilt on every gateway reload.

**Shared contract change:** the `MessengerFactory` signature. Consumers to migrate: `messengerFactory` in `gateway.ts`, `ConfiguredGateway`, and the injected factories in hub tests (`hub/test/fakes/messenger.ts` and others), which E-1312's Discord factory will follow.

**A messenger-neutral voice pipeline** (`voice.ts`):
1. download through a messenger-supplied fetch, timed;
2. call `transcribeNote`, timed;
3. compose the General text, the attachment name and title, and the echo or the chat line.

The audio is uploaded with the sender's MIME type (`audio/ogg` when absent) and a matching name: `voice-<message id>.ogg`, `.mp3` or `.m4a`.

**The four outcomes.**
- **Transcribed:** General "🎤 <text>"; the echo is a reply to the note, "🎤 <text>", then "0:42 · download 0.3 s · transcription 1.6 s · elevenlabs".
- **No key:** General "🎤 not transcribed"; the chat line is "Transcription needs a key: cland secret set speech.elevenlabs_key, then cland hub reload".
- **`provider = ""`:** General "🎤 not transcribed"; the chat line is "Transcription is off ([speech] provider)".
- **Failure:** General "🎤 not transcribed: <reason by kind>", plus one chat line.

An empty transcript posts "🎤 nothing recognised".

The note's message is never edited later. A replayed note posts one message (the upload's ingress dedupe). No messenger URL reaches the provider. Spec §3.6 (the transcript message, the echo, bytes untouched); GLOSSARY Transcript.

## Acceptance criteria

- [ ] C1. A voice note on the fake with the fake ElevenLabs answering "привет, это тест" arrives in General as "🎤 привет, это тест" from `human` "via Telegram" with one `.ogg` artifact holding the note's exact bytes, and the provider received `audio/ogg` bytes rather than any URL (test).
- [ ] C2. The chat receives one echo replying to the note with the transcript, the note's length, a download time, a transcription time and "elevenlabs", and the General message is not mirrored back (test).
- [ ] C3. With no key the note arrives as "🎤 not transcribed" with the audio and the chat gets the one line naming `cland secret set speech.elevenlabs_key`, and with `provider = ""` it arrives the same way with the "off" line and the fake provider receives no request (test).
- [ ] C4. A fake failing with 402 posts "🎤 not transcribed: …" naming quota with the audio and one chat line, and an empty transcript posts "🎤 nothing recognised" with the audio (test).
- [ ] C5. Switching `[speech]` to a fake `command` and running `cland hub reload` transcribes the next note through the command, and the echo names "command" (test).

## Notes

Shared files: hub/src/remote/voice.ts (new), hub/src/remote/media.ts, hub/src/remote/telegram.ts, hub/src/remote/gateway.ts, hub/src/remote/configuration.ts
