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
updated: 2026-10-26T17:49:38.344Z
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

## Comments

### human · 2026-10-25T14:13:56.821Z

## Handover to the Coordinator (2026-10-25, commit 1475cdaf on dev)

The planning of v0.3 is complete: `docs/spec/v0.3.md` (status complete), the glossary entries (Gateway, Remote, Pairing, Remote card, Transcript, Gap line, Outbox; General, Setup and Card amended), and the eight epics E-1307 to E-1314 under this item with their blocking edges and self-contained bodies (goal, contents, order, definition of done, constraints, references). The map M-1286 is closed with eleven decisions; every research and prototype branch is on origin only and is never merged (research/telegram-remote 2a81ecc9, research/discord-remote 1f59ae25, research/speech-to-text ac744986, research/messenger-bridges ffee79d8, prototype/telegram-remote 33bf2b2e with hub/src/remote/README.md and hub/src/remote/discord/README.md as maps).

What the human decided for the build (Q-1297): the Coordinator leads, decides the crew by the project's rules and approves every epic plan itself; QA runs every demo on fake platform servers in the suite (a fake Bot API, a fake Discord gateway and REST, a fake speech provider); the human joins one live run on the sandbox bots, Telegram and Discord from the phone, only before the release (E-1314); real tokens never go to droplets. The build starts after 0.2.2 ships, on the human's word.

Practicalities: the human's bot tokens and ElevenLabs key live in `~/.config/cland/sandbox-remote.secrets.toml` (mode 600; never print, copy into a repository or delete; the live run reads it by path). The prototype sandbox `/Users/evgeniyivanov/Projects/cland/sandbox-remote` is stopped (hub and stand-in Coordinator); it can be restarted by its HOW-TO-TRY.md for reference. Two throwaway folders from the Discord prototype, `/Users/evgeniyivanov/Projects/cland/sandbox-discord-fake` and `sandbox-remote-two`, hold only fake tokens and id-only logs and may be deleted. The repository's `.git/gc.log` (and the research worktrees' copies) block automatic maintenance: a `git prune` when convenient.

### coord · 2026-10-26T17:49:38.344Z

Human decision, General, 2026-10-26 17:49Z (msg 9079df95): «по поводу живого прогона, давай без песочных, а сразу подключим к текущему проекту и проверим все, в смысле чтобы у меня были сразу ремоуты на этом проекте настроеные, чтобы несколько раз отдельно это не делать».
This replaces the sandbox-bot live run in Q-1297 and E-1314. The live run before release connects real Telegram and Discord remotes to this project, cland/v0, and they stay configured afterwards.
Unchanged:
- Only the human creates the bots and places the tokens: `cland secret set telegram.token` and `discord.token` from stdin in this project, git-ignored in .cland/secrets.toml.
- Real tokens never go to droplets. Verify bundles carry only the committed tree, and T-1329 keeps the token variables off every child environment.
- The sandbox secrets file is not used.
- QA demos stay on the fake platform servers.
