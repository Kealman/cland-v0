---
id: R-1278
kind: release
version: 0.3.0
title: Remote control through Telegram and Discord
state: open
labels: []
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-25T09:40:57.049Z
updated: 2026-10-25T14:12:34.554Z
---

## Goal

Telegram and Discord become remote-control channels for cland: a gateway edge inside the hub mirrors the project's General topic and the human's needs-you rows into paired messenger chats (remotes), and accepts the human's messages, answers, approvals, photos, files and voice notes from them, with transcription through a provider seam. Spec: `docs/spec/v0.3.md` (complete, 2026-10-25). Vocabulary: Gateway, Remote, Pairing, Remote card, Transcript, Gap line, Outbox in `GLOSSARY.md`.

## Notes

- Planned by the map M-1286 (2026-10-25): research Q-1287 (Telegram), Q-1288 (Discord), Q-1289 (speech-to-text), Q-1290 (prior art); prototypes Q-1292 (Telegram) and Q-1293 (Discord) on `prototype/telegram-remote` at 33bf2b2e, accepted by the human on the phone; grilling Q-1294 to Q-1297. Research and prototype branches are never merged; the build follows the spec through TDD and may read the prototype's code.
- Epics in build order: E-1307 The gateway edge and its authority → E-1308 Pairing, secrets and configuration → E-1309 The Telegram remote → E-1310 Remote cards and approvals → E-1311 Media, the upload frame and speech; E-1312 The Discord remote after E-1310 (its voice slice after E-1311); E-1313 Setup, doctor, onboarding and the workbenches after E-1308, beside E-1309 to E-1312; E-1314 Release v0.3.0 from the item last. About 50 tasks.
- The Coordinator decides the crew by the project's rules and approves every epic plan itself (the human, Q-1297).
- QA: every demo on fake platform servers in the suite (a fake Bot API, a fake Discord gateway and REST); the human joins one live run on the sandbox bots, Telegram and Discord from the phone, only before the release; real tokens never go to droplets (the human, Q-1297).
- Deferred to 0.3.x: Telegram groups and forum topics, Discord Components V2, a thread per item, following a thread started from the chat, several humans, webhooks, transcription cost accounting, Web Push.
- The build starts after 0.2.2 ships, on the human's word.
