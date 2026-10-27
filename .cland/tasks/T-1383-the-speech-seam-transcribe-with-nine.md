---
id: T-1383
kind: task
title: "The speech seam: transcribe with nine failure kinds, retries within one 90-second deadline, and the ElevenLabs provider against a fake"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by: []
topic: null
branch: null
created: 2026-10-27T23:37:27.091Z
updated: 2026-10-27T23:37:39.043Z
---

## Summary

A messenger-neutral speech module defines `transcribe({ audio, mime, filename, languageHint?, durationSec?, signal })`, returning `{ text, language?, durationSec?, segments? }`, and a `SpeechError` carrying one of the nine kinds. It wraps any provider in one deadline with at most two retries for transient kinds. Its first provider is ElevenLabs Scribe v2, tested only against a loopback fake.

## What to build

**The seam.**
- `SpeechProvider { name, transcribe }`.
- `SpeechError { kind, message, retryAfterMs? }` with exactly the kinds not-configured, auth, bad-audio, too-long, quota, rate-limited, unavailable, timeout and command-failed.
- A language normaliser that lower-cases the value, keeps the primary subtag and maps ISO 639-3 codes and English names to ISO 639-1 (`eng`, `english` and `en` become `en`).
- `transcribeNote(provider, input, { deadlineMs: 90_000, clock, random })`:
  - one deadline signal for the note;
  - each attempt bounded at 30 seconds inside it;
  - retries only for rate-limited, unavailable and timed-out attempts, at most two;
  - exponential backoff with jitter, or `Retry-After` when present, never past the deadline;
  - a deadline reached reports `timeout`.
- Every error message passes the remote redactor, with the speech keys registered.

**ElevenLabs.**
- `POST <root>/v1/speech-to-text` with the `xi-api-key` header and `redirect: 'error'`.
- Multipart fields `model_id` (from `[speech] model`), `tag_audio_events=false`, `language_code` only with a hint, and `file` as the original bytes with their MIME type and file name. No transcoding.
- Status and error-code mapping per the research's table:
  - 401 and 403 are auth; 402 and `insufficient_credits` are quota; 429 is rate-limited;
  - `audio_too_long`, `request_too_large` and 413 are too-long;
  - `invalid_audio`, `invalid_audio_format`, `invalid_file_type` and `audio_too_short` are bad-audio;
  - 5xx, a transport failure and a refused redirect are unavailable.
- A missing key is not-configured, and no request is made.
- The root is `https://api.elevenlabs.io`, or `CLAND_ELEVENLABS_API_ROOT` only when it is loopback HTTP with a port.

**The fake**, in `hub/test/fakes/speech/`: it scripts per-request responses (status, `detail` body, `Retry-After`, delay, a 302 to another loopback server) and records the multipart fields and whether a key header arrived. It never logs the key.

Spec §3.6 (the speech seam, providers, bytes untouched); research Q-1289 §7 and its rules 1, 2, 4 and 7 to 10; the DigitalOcean client (`hub/src/executor/droplet/api.ts`) as the precedent.

## Acceptance criteria

- [ ] C1. An OGG note transcribes through the fake ElevenLabs into `{ text, language: "ru" }` from a `"rus"` response, and the fake recorded `model_id=scribe_v2`, `tag_audio_events=false`, no `language_code` without a hint, and the original bytes with `audio/ogg` and `voice.ogg` (test).
- [ ] C2. Against the fake, a missing key, 401, `invalid_audio`, `audio_too_long`, 402, persistent 429, persistent 503 and a response slower than the deadline each reject with not-configured, auth, bad-audio, too-long, quota, rate-limited, unavailable and timeout respectively (test).
- [ ] C3. A 429 with `Retry-After: 2` followed by a 200 transcribes after a 2-second wait under the injected clock, a third consecutive 503 is not retried, and auth, bad-audio, too-long and quota are never retried (test).
- [ ] C4. A 302 from the fake is not followed and the redirect target receives no request, and no `SpeechError` message from any kind contains the made-up key, even when the fake echoes it in its error body (test).

## Notes

Shared files: hub/src/speech/ (new), hub/src/remote/redact.ts, hub/test/fakes/speech/ (new)
