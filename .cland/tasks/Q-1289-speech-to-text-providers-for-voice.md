---
id: Q-1289
kind: question
title: Speech-to-text providers for voice remotes, xAI first
state: open
labels:
  - wayfinder:research
assignee: cland-design
parent: M-1286
blocked_by: []
topic: null
branch: null
created: 2026-10-25T10:24:45.215Z
updated: 2026-10-25T10:27:23.228Z
---

## Question

Which facts about speech-to-text APIs fix the transcription seam of a cland remote (map M-1286, round-1 decisions 12 and 13)? Primary sources only.

xAI (https://docs.x.ai/developers/model-capabilities/audio/speech-to-text and the neighbouring pages): endpoint and request shape, authentication, models, accepted input formats and whether OGG/Opus voice notes from Telegram and Discord are accepted directly or need transcoding, size and duration limits, language detection and hints (Russian and English), response shape (text, segments, timestamps), streaming vs batch, pricing, the free tier or credits and its rate limits as published today, data retention and privacy terms, SDK vs plain fetch. Then the alternatives the provider seam must fit: OpenAI (gpt-4o-transcribe, whisper-1), Deepgram, Groq Whisper, Google, and local whisper.cpp / faster-whisper run as a command: input formats, limits, pricing, language support, response shapes. Conclude with a provider interface shape that fits all of them (transcribe(audio, mime, language hint) → text, language, optional segments; errors; timeouts), the transcoding question (is ffmpeg avoidable for OGG/Opus), and the cost of a typical 30-second voice note per provider. Record limits with their source lines and the date checked.
