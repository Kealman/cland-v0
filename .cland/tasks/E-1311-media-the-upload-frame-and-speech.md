---
id: E-1311
kind: epic
title: Media, the upload frame and speech
state: open
labels:
  - epic
  - v0.3
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by:
  - E-1310
topic: null
branch: null
created: 2026-10-25T14:11:59.753Z
updated: 2026-10-28T05:05:33.933Z
---

## Goal

The human sends photos, files and voice notes from a remote and receives artifacts there: a photo becomes the human's artifact on the human's message, a voice note becomes a 🎤 transcript in General with the audio attached, and an agent's artifact reaches the phone as a photo or a document, once per remote. Today no frame turns bytes into an artifact, and every created artifact posts its own ▣ message, so the prototypes needed an in-process seam (Q-1292). This epic adds `artifact.upload`, which also gives the web composer file attachments, shows images inline in the web, and adds the speech seam with ElevenLabs and a local command. ElevenLabs returned a 30-second note's transcript in about 1.6 seconds with correct Russian punctuation (Q-1292).

## Contents

- **`artifact.upload`** (spec §3.6). A new frame of the one protocol: files as bytes, each with a name and a MIME type, the topic and an optional caption. It creates the artifacts and attaches them to one new message of the human's in a single step, without a ▣ post. The gateway calls it inside the hub, and for a remote's authority it counts as a send. A size limit in `[artifacts]` bounds it; this epic names the key, sets its default and adds it to `cland init` and `cland update`. Demo: one call with two files makes one human message with two artifacts and no ▣ post, and a file over the limit is refused.
- **The web composer's attachments** (§3.6). The composer gains file attachments through `artifact.upload`, its bytes going to an HTTP endpoint on the web edge's own listener, since a frame is capped at 1 MiB; the endpoint keeps the web edge's cookie and Origin checks (v0.2 §3.7). Demo: in headless Chromium, a PNG attached in General's composer arrives on the human's message.
- **Images in the workbenches** (§3.6). The web's artifact viewer renders PNG, JPEG, GIF and WebP inline under a size cap, and every other type as today; Neovim opens an image in the system viewer. Demo: each of the four formats renders inline, one over the cap shows as today, and Neovim's open runs the system viewer's command, faked in the test.
- **Inbound files on Telegram** (§3.6). Photos and documents become the human's artifacts on the human's message, and a caption becomes its text. An album, the items sharing one `media_group_id`, is one message with every attachment, and the group is stored before the update offset is confirmed. A file over Telegram's 20 MB download cap gets a reply saying so, and the token-bearing file URL never leaves the hub. Demo: a three-photo album on the fake arrives as one General message with three artifacts, and a hub killed mid-album loses nothing.
- **Outbound artifacts on Telegram** (§3.6). An image up to 10 MB goes as a photo and any file up to 50 MB as a document. Each artifact of a message goes exactly once per remote, captioned with the message's header, and a single artifact with a short text goes as the file captioned with the header and the text. A larger file goes as a line naming the artifact and its path; HTML and diagrams go as files. Captions go without formatting in 0.3, because a multipart upload turns newlines into CRLF and Telegram counts the CR in entity offsets. Demo: an agent's message with an image and a PDF arrives as one photo and one document, each once; a 60 MB file arrives as a line with its path.
- **The speech seam** (§3.6). `transcribe({ audio, mime, filename, languageHint?, durationSec?, signal })` returns `{ text, language?, durationSec?, segments? }`, with the language as lower-case ISO 639-1. A failure carries one of nine kinds: not-configured, auth, bad-audio, too-long, quota, rate-limited, unavailable, timeout, command-failed. The original bytes go with their MIME type and a matching file name: no transcoding, no ffmpeg in the hub, batch only, and no messenger URL ever reaches a provider. Keys are redacted from every error, and provider requests refuse redirects, as the DigitalOcean client does. Demo: each failure kind is produced against the fake provider and reported with its kind.
- **The providers** (§3.6). `elevenlabs` (Scribe v2) and `command`, chosen by `[speech] provider`, with `""` turning transcription off; `[speech] model` and `language`, empty to detect. The `command` provider is an argv array, never a shell string: it gets the original bytes on stdin and `CLAND_SPEECH_MIME` and `CLAND_SPEECH_LANGUAGE` in an environment free of remote secrets, prints the transcript on stdout, reports a non-zero exit or a signal as `command-failed` with the tail of stderr, bounded and redacted, and is killed at the deadline. No cost accounting in 0.3. Demo: a note transcribes through a fake ElevenLabs and through a fake command, and `provider = ""` leaves the audio untranscribed.
- **What is transcribed and the limits** (§3.6). Voice notes always; audio files and video notes within the same duration cap; videos and documents never. The length is checked before download from the messenger's duration against `[speech] max_seconds` (10 minutes) and Telegram's 20 MB. One deadline of 90 seconds per note; retries only for rate-limited, unavailable and timed-out attempts, at most two, with backoff and `Retry-After`. Demo: an 11-minute note is refused before any download; a 429 followed by success transcribes; a provider slower than the deadline reports `timeout`.
- **The transcript message and the echo** (§3.6). The human's message is the transcript after a 🎤 marker, with the audio attached as the human's artifact. Without a key the message is "🎤 not transcribed" with the audio, and the chat gets one line saying how to enable transcription. When the provider fails, the message still reaches General with the audio and "🎤 not transcribed: <reason>", and the chat gets one line. An empty transcript is "nothing recognised", with the audio attached. The bot echoes the transcript into the chat after a 🎤, with the note's length, the download and transcription times and the provider's name; a correction is the human's next message, and a transcript is never edited. A voice reply to a card answers its ask. Demo: each case above on the fake Bot API and the fake provider.
- **Doctor and the data-use line** (§3.6, §3.11). Doctor shows a cloud provider's key presence and whether the `command` provider's argv[0] resolves, and makes no paid call. `cland remote status` gains one line on the provider's data use with where to change it: ElevenLabs may train on audio outside enterprise plans until "Improve the models for everyone" is turned off under Terms and privacy, Data use, and it stores transcripts. Demo: doctor with and without a key and with a missing command; the status line.

Not in this epic: Discord's attachments and voice messages ("The Discord remote", whose voice waits for this epic); setup's offer of the speech key ("Setup, doctor, onboarding and the workbenches"); an xAI provider, which fits the seam and waits; transcription cost accounting (deferred to 0.3.x).

## Order

1. **`artifact.upload` in the hub.** Demo: one call, one human message, two artifacts, no ▣ post, and the size limit.
2. **Inbound photos, documents and albums on Telegram.** Demo: the album as one message, stored before the offset.
3. **Outbound artifacts on Telegram.** Demo: a photo and a document each once, a line for a file over the cap.
4. **The speech seam and its providers.** Demo: the fake ElevenLabs, the fake command and the nine kinds.
5. **Voice notes end to end.** Demo: the 🎤 message, the echo, the limits, the failures, and a voice reply that answers a card.
6. **The web and Neovim.** Demo: the composer's attachment, inline images and the system viewer.
7. **Doctor and the data-use line.** Demo: doctor's speech lines and `cland remote status`.

## Definition of done

QA runs the demo below on `dev` against the fake Bot API and a fake speech provider in the suite, with headless Chromium and headless Neovim, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. No audio goes to a real provider.

In a scratch project with the human paired on the fake, QA sends a photo with a caption, a document, a three-photo album and a 25 MB file, and reads the artifacts and messages in General and the reply about the oversized file. An agent posts a message with an image and a PDF, a single artifact with a short text, and a 60 MB file, and QA reads what the chat receives and checks that each artifact went once. QA sends a voice note, an audio file, a video note and a video, then a voice note with no key, one the fake provider fails, one with silence, one past `max_seconds`, and a voice reply to an open card, reading General, the echo and the answered ask. It switches to a fake `command` provider and transcribes again, then sets `provider = ""`. In headless Chromium it attaches a PNG in the composer and views PNG, JPEG, GIF and WebP artifacts inline, and in headless Neovim it opens an image. Finally it reads doctor's speech lines and `cland remote status`.

- [ ] C1. `artifact.upload` creates the artifacts and one human message in one step without a ▣ post, refuses a file over the `[artifacts]` limit, and counts as a send for a remote.
- [ ] C2. The web composer attaches files through the web edge's HTTP endpoint, and the web's artifact viewer renders PNG, JPEG, GIF and WebP inline under a size cap.
- [ ] C3. Neovim opens an image artifact in the system viewer.
- [ ] C4. Photos and documents from Telegram become the human's artifacts on one message with the caption as its text, an album is one message stored before the offset is confirmed, and a file over 20 MB gets a reply.
- [ ] C5. Outbound images up to 10 MB go as photos and files up to 50 MB as documents, each artifact once per remote with the header as its caption, and larger files as a line with the name and path.
- [ ] C6. The speech seam has the spec's shape and nine failure kinds, sends the original bytes with their MIME type, refuses redirects, and redacts keys from every error.
- [ ] C7. The `elevenlabs` and `command` providers work as spec §3.6 says, `provider = ""` turns transcription off, and the command runs from an argv array with no remote secret in its environment.
- [ ] C8. Voice notes, audio files and video notes are transcribed, videos and documents are not, and the length is checked before download, under one 90-second deadline with at most two retries for transient failures.
- [ ] C9. A voice note becomes the human's 🎤 message with the audio attached, a missing key or a failure still posts the audio with one line in the chat, and the bot echoes the transcript with its timings and provider.
- [ ] C10. A voice reply to a card answers its ask, doctor shows the speech key's presence and the command's resolution, and `cland remote status` shows the provider's data-use line.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). Items are written through `cland task` and the task tools, never as hand-written item files.
- **The hub's code.** TypeScript on Node 24 under the hub's tsconfig (`strict`, `erasableSyntaxOnly`, `verbatimModuleSyntax`), so no enums, namespaces or parameter properties. No new runtime dependency, no transcoding and no ffmpeg. The web keeps its rules: no hex colour outside the tokens, keys by physical code.
- **Tests.** Test first (`tdd`). The hub's frame protocol is the first seam (`hub/test/harness.ts`), the fake Bot API and a fake speech provider in `hub/test/fakes/` the second, Playwright the third for the composer and the viewer. No test sends audio to a real provider or needs a real key, so the suite runs on droplets as it is.
- **Secrets.** `ELEVENLABS_API_KEY` and `XAI_API_KEY` reach no session and no speech command. A key never appears in argv, a frame, a log line, an error, a journal record or an artifact. A Telegram file URL embeds the token, so the gateway downloads the bytes and sessions see artifacts only. The clients talk only to the messengers' and the provider's hosts. Real keys never go to droplets.
- **The frame protocol.** `artifact.upload` is a new frame of the one protocol (ADR 0003); a frame stays capped at 1 MiB, so the web's bytes go over the web edge's own HTTP endpoint.
- **Privacy.** ElevenLabs may train on the audio and stores transcripts; the data-use line says so, and setup repeats it when it offers the key.
- **The prototype.** `prototype/telegram-remote` at 33bf2b2e is never merged. The build may read its code and take what fits, but follows the spec (Q-1297).
- **Plan.** The Coordinator drafts the plan with `plan-epic`, chooses the crew and the models by the project's rules, and approves the plan itself (spec §4).
- **Order.** Last in the hub lane: follows "Remote cards and approvals". The voice and attachments of "The Discord remote" are blocked by it.

## References

- Spec: `docs/spec/v0.3.md` §3.6 (media and voice), §3.11 (doctor's speech lines), §3.12 (hygiene) and §4; `docs/spec/v0.2.md` §3.7 (the web edge's listener and checks).
- Items: R-1278; the map M-1286, round-1 decisions 10 to 13; Q-1289 (the speech research); Q-1295 (its ten points); Q-1292 (voice latency and the prototype's in-process seam); Q-1293 (an attachment sent exactly once per remote).
- Prototype, on `prototype/telegram-remote` at 33bf2b2e: `hub/src/remote/speech.ts`, media and voice in `hub/src/remote/telegram-gateway.ts`, and `hub/src/remote/replies.ts` (a message's files, each once).
- Research: `docs/research/speech-to-text.md` on `research/speech-to-text` (ac744986), the interface, the nine kinds, timeouts and retries, the `command` contract and ElevenLabs's data use; `docs/research/telegram-remote.md` on `research/telegram-remote` (2a81ecc9), file sizes and the CRLF caption shift.
- Code: `hub/src/hub/web-edge.ts`, `hub/src/hub/store.ts` (artifacts), `hub/src/init/config.ts` (`[artifacts]`), `web/src/Composer.tsx`, `web/src/artifacts/ArtifactViewer.tsx`, `web/src/artifacts/InlineArtifact.tsx`, `nvim/lua/cland/artifacts.lua`, `hub/src/executor/droplet/api.ts` (redirects refused, typed errors).
- GLOSSARY: Transcript (added for v0.3); Artifact.

## Plan

```yaml
stages:
  - name: the upload frame, the files client and the speech seam
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1381
      - - T-1382
        - T-1393
      - - T-1383
        - T-1384
      - - T-1392
  - name: media on Telegram, the composer and doctor
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1385
        - T-1386
      - - T-1387
      - - T-1391
      - - T-1394
  - name: voice end to end and the docs
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1388
        - T-1389
        - T-1390
        - T-1395
```

## Comments

### coord · 2026-10-27T23:37:48.528Z

Plan and decisions (coord, 2026-10-28 00:0xZ). Tickets T-1381–T-1395 from the draft A-12923 (coord's sub-agent, against dev c675faa3). Three stages instead of the Order's seven save four Linux+macOS cover pairs; the epic's QA demo runs on dev after stage 3.
- Messenger boundary: everything except Telegram transport and rendering is messenger-neutral (artifact.upload and its byte path, the durable media queue and album grouping, what is transcribed, the voice pipeline and its texts, the outbound image/file/line choice and the once-per-remote key, the speech seam and both providers), so E-1312's Discord media stage adds only Discord's fetch, upload and rendering.
- Open, awaiting the human (ask 62b8d32f): once-per-remote artifacts (T-1387) and the audio of a voice note that answers a card (T-1390). Both tickets carry the Coordinator's recommendation and are held until the answer; they sit in stages 2 and 3.
- T-1385 overlaps T-1378 (Bugs; the non-text update stall, ask 82ff046e): whichever lands first, the other builds on it.
- Shared-contract tickets (rule 20): T-1382 (artifact.upload frame, authority tables, [artifacts] max_upload_mb) and T-1388 (messenger factory signature) list their consumers; coord runs a full verify all before enqueueing T-1382.
- Stage 2 lanes [T-1385, T-1386] and [T-1387] share telegram.ts/state.ts/media.ts: landings serialised, T-1385 first.

### coord · 2026-10-27T23:47:38.100Z

Decision during the build (coord, 2026-10-28, on impl-1382's question): uploads and the one redactor. §3.6 "bytes, untouched" holds for every stored upload, so the redactor never rewrites an uploaded file. §3.12's one-redactor rule is met at `artifact.upload` by refusing any upload whose raw bytes contain a value the shared redactor knows (configured tokens and keys): exact byte match, every MIME type, nothing stored, no message, an error naming the kind (`secret-in-upload`) and the file but never the value; the gateway answers one line in the chat, the web composer shows the error. Captions and message text keep the existing text redaction. Applies to every producer of uploads (T-1382, T-1385, T-1388, T-1391, and E-1312's T-1414).

### coord · 2026-10-28T05:05:33.933Z

Decision (human, ask 62b8d32f, 2026-10-28 05:04Z): all three recommendations accepted. (1) Each artifact goes to a remote once ever; a later message re-attaching it replies to the earlier file with '▣ A-n … (sent above)'. (2) A voice note answering a card answers through its transcript and keeps no audio artifact; a note that cannot answer leaves the ask open and goes to General as an ordinary 🎤 message. (3) Discord attachments and voice stay in E-1312 as its last stage, blocked by E-1311. Held tickets T-1387, T-1390, T-1414, T-1415 are released. T-1378 (non-text Telegram updates stall the poller) joined 0.3 on the human's word (ask 82ff046e) and lands before T-1385, which builds on it.
