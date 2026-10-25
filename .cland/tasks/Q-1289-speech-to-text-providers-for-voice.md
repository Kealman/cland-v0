---
id: Q-1289
kind: question
title: Speech-to-text providers for voice remotes, ElevenLabs first
state: closed
labels:
  - wayfinder:research
assignee: cland-design
parent: M-1286
blocked_by: []
topic: null
branch: null
created: 2026-10-25T10:24:45.215Z
updated: 2026-10-25T11:18:13.253Z
closed: 2026-10-25T11:18:13.253Z
---

## Question

Which facts about speech-to-text APIs fix the transcription seam of a cland remote (map M-1286, round-1 decisions 12 and 13)? Primary sources only.

xAI (https://docs.x.ai/developers/model-capabilities/audio/speech-to-text and the neighbouring pages): endpoint and request shape, authentication, models, accepted input formats and whether OGG/Opus voice notes from Telegram and Discord are accepted directly or need transcoding, size and duration limits, language detection and hints (Russian and English), response shape (text, segments, timestamps), streaming vs batch, pricing, the free tier or credits and its rate limits as published today, data retention and privacy terms, SDK vs plain fetch. Then the alternatives the provider seam must fit: OpenAI (gpt-4o-transcribe, whisper-1), Deepgram, Groq Whisper, Google, and local whisper.cpp / faster-whisper run as a command: input formats, limits, pricing, language support, response shapes. Conclude with a provider interface shape that fits all of them (transcribe(audio, mime, language hint) → text, language, optional segments; errors; timeouts), the transcoding question (is ffmpeg avoidable for OGG/Opus), and the cost of a typical 30-second voice note per provider. Record limits with their source lines and the date checked.

## Comments

### human · 2026-10-25T10:48:15.856Z

Scope change 2026-10-25: ElevenLabs (Scribe) is the first provider the prototype uses, xAI is one alternative among the others, because xAI no longer gives free transcription credits (the human). The research agent was told to add a full ElevenLabs section and to verify xAI's free-tier status.

### human · 2026-10-25T11:18:13.129Z

## Resolution (2026-10-25)

Findings: `docs/research/speech-to-text.md` on branch `research/speech-to-text` (commit ac744986, origin only, never merged; worktree /Users/evgeniyivanov/Projects/cland/speech-to-text). Sections: what the remotes hand to the seam; ElevenLabs Scribe as the first provider; xAI as an alternative (no free tier today, prepaid credits only); OpenAI, Groq, Deepgram, Google v2, Mistral Voxtral and local engines as the shapes the seam must fit; transcoding; the provider interface; cost and latency of a 30-second note; 18 rules for the spec with sources.

What it settles:
- OGG/Opus voice notes go to every cloud provider as uploaded; no transcoding and no ffmpeg in the hub. One `fetch` with multipart (or raw bytes for Deepgram, base64 JSON for Google) is enough; no SDK.
- The gateway downloads the bytes and uploads them; a messenger URL never reaches a provider (Telegram's file link embeds the bot token). Length is guarded before download from the messenger's duration (cap 10 minutes by default).
- ElevenLabs request: `POST /v1/speech-to-text`, `xi-api-key`, `model_id=scribe_v2`, `file`, `language_code` only with a hint. About $0.0018 per 30-second note; the free plan is about 4.5 hours a month, non-commercial, trains on data unless the "Improve the models for everyone" toggle is off, stores transcripts deletable by id. xAI: `POST /v1/stt`, Bearer key, `grok-voice-transcribe-2.0`, about $0.0008 per note, 30-day retention, no training.
- Interface: `transcribe({audio, mime, filename, languageHint?, durationSec?, signal}) → {text, language? (lower-case ISO 639-1 after one normaliser), durationSec?, segments?}`; nine error kinds (not-configured, auth, bad-audio, too-long, quota, rate-limited, unavailable, timeout, command-failed); retry only rate-limited, unavailable and timeout, at most twice with backoff and Retry-After; one AbortSignal deadline per note; keys redacted from errors, as the DigitalOcean client does.
- Configuration: `[speech] provider = "elevenlabs" | "command"`, optional `model` (default scribe_v2) and `language` (empty = detect). Env overrides `ELEVENLABS_API_KEY` (and `XAI_API_KEY` when xAI is added) over `.cland/secrets.toml`; setup recommends a key scoped to speech-to-text with a credit quota and shows the privacy notice.
- The `command` provider: an argv array; original bytes on stdin, `CLAND_SPEECH_MIME` and `CLAND_SPEECH_LANGUAGE` in its environment, no remote secrets; transcript on stdout; non-zero exit = failure with the stderr tail; the deadline kills it. whisper-cli cannot read Opus (its wrapper needs ffmpeg); faster-whisper decodes Opus through its bundled PyAV.
- Empty transcript = "nothing recognised" with the audio still attached. Doctor: key presence only for cloud providers, argv[0] resolution for `command`, `ffmpeg -version` first line as information. Batch, not streaming, in 0.3. No decoder in the hub in 0.3 (the later path is `ogg-opus-decoder` plus a WAV header).

Unverified: xAI's console pages refused automated fetches; ElevenLabs billing granularity and size cap (pages disagree); whether OpenAI, Groq and Mistral accept Opus inside Ogg; latency unmeasured (the Q-1292 prototype measures it).
