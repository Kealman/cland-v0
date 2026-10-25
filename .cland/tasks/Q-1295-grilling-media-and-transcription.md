---
id: Q-1295
kind: question
title: "Grilling: media and transcription"
state: closed
labels:
  - wayfinder:grilling
assignee: cland-design
parent: M-1286
blocked_by:
  - Q-1289
  - Q-1292
topic: null
branch: null
created: 2026-10-25T10:24:46.165Z
updated: 2026-10-25T12:55:28.503Z
closed: 2026-10-25T12:55:28.503Z
---

## Question

After the STT research and the Telegram prototype (map M-1286): the provider interface and its two implementations, transcoding if needed, limits on size and duration, the voice marker and the audio artifact, how the transcript is echoed and corrected, the language hint, inline images in the web workbench and image handling in Neovim, inbound file limits and where artifacts from remotes are stored, outbound artifacts as photos or documents, and what happens when a provider fails or has no key.

## Comments

### human · 2026-10-25T12:55:28.383Z

## Resolution (2026-10-25, grilling round 3; the human accepted every recommendation)

1. **Upload frame.** The protocol gains `artifact.upload` (bytes, name, MIME, topic, optional caption): it creates the artifact and attaches it to a new human message without the separate ▣ post. Available to the remote and web edges; the web composer gets file attachments through the same frame. Because frames are capped at 1 MiB, the web edge takes the bytes through an HTTP endpoint on its own listener; inside the hub the remote calls it internally. The size limit comes from `[artifacts]`.
2. **What is transcribed.** Voice notes always; audio files and video notes up to the same duration cap too; regular videos and documents never.
3. **The voice message.** Its text is the transcript with a 🎤 marker in front, the audio attached as an artifact; without a key the message is "🎤 not transcribed" with the audio; the language comes from `[speech] language`, empty means detect.
4. **Echo.** The bot replies "🎤 transcript" with the note's duration, the download and transcription times and the provider's name; a correction is the human's next message, the transcript is never edited; a voice reply to a card answers the ask.
5. **Limits and failures.** 10 minutes and 20 MB are checked before download; a 90-second deadline per note; retries only for rate-limited, unavailable and timeout, at most twice; on a provider failure the message still reaches General with the audio and "not transcribed: <reason>", and the chat gets one line.
6. **Providers in 0.3.** `elevenlabs` and `command`, the interface and nine error kinds of the research; `provider = ""` switches transcription off; doctor shows key presence and whether `argv[0]` resolves; no cost accounting in 0.3.
7. **Images in the workbench.** The web renders PNG, JPEG, GIF and WebP inline in the artifact viewer with a size cap; everything else as today; Neovim opens images with the system viewer.
8. **Outbound artifacts.** Telegram: images up to 10 MB as photos, files up to 50 MB as documents; Discord: up to 20 MiB per file; larger ones as a line with the name and path; HTML and diagrams as files.
9. **Captions and albums.** A caption becomes the message text; captions go without formatting in 0.3 (the CRLF entity shift); an album with one `media_group_id` is one message with all attachments; the group is stored before the offset is confirmed. The human's own Telegram formatting is dropped on the way in (plain text only).
10. **Privacy.** Setup and `cland remote status` show one line about the provider's data policy (ElevenLabs trains on non-enterprise data until the "Improve the models for everyone" toggle is off, and stores transcripts) with where to change it.
