---
id: M-1286
kind: map
title: Remote control through Telegram and Discord (v0.3)
state: open
labels:
  - wayfinder:map
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-25T10:23:22.644Z
updated: 2026-10-25T11:50:05.945Z
---

## Destination

The spec `docs/spec/v0.3.md` "cland v0.3: remote control through Telegram and Discord", its glossary entries and the epics under R-1278, handed to the Coordinator. The thing it describes: a gateway edge inside the hub that mirrors the human's General topic and the needs-you rows of the inbox into paired messenger chats (remotes), and accepts messages, answers, photos, files and voice from them, with transcription through a provider seam.

## Notes

- Domain: cland's hub (Node 24 TypeScript). The web edge is the precedent for a client edge with its own authority table (docs/spec/v0.2.md §3.1 and §3.7, ADR 0003, hub/src/hub/web-edge.ts, web-authority.ts, dispatch.ts). Topics, asks, approvals and the inbox: hub/src/hub/core.ts, asks.ts, inbox.ts. Secrets precedent: the DIGITALOCEAN_TOKEN env var and the deny-list in shared/executor-credentials.ts.
- Skills: research tickets call `research`; prototypes `prototype`; grilling `grilling` and `domain-modeling`; the spec `to-spec`; the epics `to-tickets`. Dialogue with the human in Russian, every artifact in English.
- Research branches `research/<name>` and prototype branches `prototype/<name>` are pushed to origin only, never merged. Prototypes run against sandbox hubs, never this project's hub. Sub-agents never touch the hub or the tracker; the planning session records resolutions.
- Release item: R-1278 (0.3.0), a placeholder by the Coordinator. Nothing is filed under it until the handover.
- Settled in round 1 (2026-10-25, the human accepted every recommendation):
  1. The destination above, by the usual route: map, research, prototypes, grilling rounds, spec, glossary, epics under R-1278, handover to the Coordinator.
  2. The mirror is General in both directions plus the inbox's needs-you rows from any topic, as cards with buttons; answers return to their own topic; item topics and the Agents topic are not mirrored.
  3. Inbound: free text is a human message in General to the Coordinator; `@aide` and `@lead T-n` mentions work as in the web; a reply to a mirrored message goes to its topic; a reply to an ask card answers the ask; kind message by default, `/decision …` and `/question …` for the other kinds.
  4. The gateway is a new edge inside the hub process, like the web edge, with its own authority table and its own `via`; connections are outbound only: Telegram long polling, the Discord gateway websocket; no webhooks, tunnels or public addresses.
  5. A remote's authority is the web edge's deny-by-default table (no hub stop or restart, release, push, sync or configuration changes) plus answers and approvals.
  6. Telegram: one bot per project, created through BotFather; the remote is the human's private chat with the bot; the hub stores the user id and chat id; unpaired senders get silence; groups and forum topics come later. Pairing amended by Q-1294 (2026-10-25): the human opens the bot and presses Start, the bot replies once with an 8-character code and the sender's id, and the human approves on the trusted side (an inbox card in the workbench or `cland remote approve telegram <code>`); codes live 1 hour, at most 3 pending, at most 2 replies to a stranger.
  7. Discord: the bot lives in the human's own server, one channel is designated as the General mirror; the hub stores guild, channel and user id; other members read, their messages are ignored; one bot per project is the supported path (confirmed by Q-1288: a shared bot shares the identify cap, the rate limits and every reset). Pairing amended by Q-1294: `/cland pair` without an argument yields an ephemeral code, approved in the workbench or by `cland remote approve discord <code>`.
  8. Secrets: bot tokens and the STT keys live in a git-ignored 0600 `.cland/secrets.toml`, written by `cland secret set <name>` from stdin or hidden input, never argv (amended by Q-1294 from `cland remote token`); environment variables override; the names join the sessions' environment deny-list; doctor reports presence only.
  9. Asks: a card is a message with inline buttons for the options, "Other answer" and "Decline…" followed by a reason prompt; after an answer from anywhere the message is edited into the outcome and the buttons are removed; Codex and OpenCode approvals are cards with the command text and buttons; epic plan approvals are a notice with a web link, no buttons.
  10. Outbound: every General message carries an "author · kind" header; Markdown is converted to the messenger's markup; long texts are split at the limit with part numbers; artifacts: images as photos, other files as documents up to the messenger's limit, otherwise a link to the web or the path.
  11. Inbound photos and files become project artifacts attached to the human's message, the caption is its text; the web renders PNG and JPEG inline.
  12. Voice: downloaded and transcribed; the transcript becomes the human's message text with a voice marker; the original audio is attached as an artifact; the gateway echoes the transcript into the chat; without an STT key the gateway replies with how to enable it.
  13. STT providers: `[speech] provider = "elevenlabs"`; the interface is transcribe(audio, mime, language hint) → text and language; two providers in 0.3: ElevenLabs (Scribe) and `command` (a local command reading audio from stdin and printing text). Amended 2026-10-25: xAI was the first choice until the human found its free transcription credits gone; xAI stays one alternative the seam must fit.
  14. Noise and commands: all of General is mirrored; `/mute` and `/unmute` silence the General stream, asks always arrive; `/status`, `/inbox` and `/help`.
  15. Downtime and catch-up: after reconnecting, the gateway re-sends still-open asks not yet in the chat and one line "N General messages missed since …" instead of a replay; inbound during downtime comes from Telegram's update queue and from Discord channel history after the last seen id; an outbound queue with backoff per the limits.
  16. Vocabulary: Remote (a paired messenger chat mirroring the human's General and inbox: a Telegram remote, a Discord remote), Gateway (the hub edge serving remotes), Pairing, Transcript; commands under `cland remote …`.
  17. Setup gets an optional ninth step offering Telegram and Discord pairing; doctor checks token presence, connection state and pairings; the onboarding tour gets a remote-control stage.
  18. Out of scope as listed below.
  19. The map: research on Telegram, Discord, xAI STT with alternatives and prior art; prototypes of a Telegram remote and then a Discord remote on a sandbox.

## Decisions so far

- [Grilling: vocabulary, configuration, secrets and the remote's authority](Q-1294, .cland/tasks/Q-1294-grilling-vocabulary-configuration-secrets.md): pairing reversed to code-in-chat, approval on the trusted side (workbench card or `cland remote approve`); remote state in hub.db; `[remote]`, `[remote.telegram]`, `[remote.discord]`, `[speech]` keys, all hot-reloaded; `.cland/secrets.toml` 0600 with `cland secret set/list/unset` and env overrides on the deny-list; the remote's authority is exactly send, answer, approve plus reads, with `via`; approvals from the card as from the web; vocabulary adds Card, Gap line, Outbox; `cland remote status/approve/unpair/test`; one pairing per messenger, both messengers at once; a Remotes row in the workbenches and pairing requests as inbox rows; groups, forum topics, Components V2, thread per item, several humans and webhooks deferred.
- [Prior art: agent-to-messenger bridges and their failures](Q-1290, .cland/tasks/Q-1290-prior-art-agent-to-messenger-bridges.md): bridges die quietly (alive but deaf), loss sits at the acknowledgement (store, then confirm; one OS-held poller; kill nothing), asks break on meaning (first answer wins everywhere, stored before the platform ack, late never answers, foreign taps refused); authorize every update type before any work with numeric ids; capped pairing; pairing direction (code issued in the chat and approved on the trusted side, as every bridge does, vs the map's CLI code redeemed in the chat) goes to grilling; a durable outbox per token, a gap line not a replay, commands registered only on change, RESUME before IDENTIFY; BCAS dropped its bot because Discord leaked into the core; findings on research/messenger-bridges (docs/research/messenger-bridges.md, 13 failure classes, 15 patterns).
- [Discord facts for a cland remote](Q-1288, .cland/tasks/Q-1288-discord-facts-for-a-cland-remote.md): outbound only works (interactions over the gateway, answers over HTTPS); the Message Content intent is a portal toggle under 10,000 users; invite `scope=bot&permissions=117760`, no MANAGE_MESSAGES; 1000 identifies a day reset the token, so an identify budget, resume, and a hard stop on 4004 and 4010–4014; catch-up by paging channel history back to the last id, clicks during downtime lost; 2000 code points, explicit `allowed_mentions`, `nonce` with `enforce_nonce`, 10 files of 20 MiB; cards as legacy messages with 3 button rows, `UPDATE_MESSAGE` within 3 s, modals for free text and decline; `/cland` one global command with subcommands for admins; one bot per project; a hand-written client on `ws` and `fetch`; findings on research/discord-remote (docs/research/discord-remote.md, 36 rules).
- [Telegram Bot API facts for a cland remote](Q-1287, .cland/tasks/Q-1287-telegram-bot-api-facts-for-a-cland.md): long polling as decided (24 h update retention, offset after handling, one poller per token, 409 reported); button presses live only 150 s so open cards are re-sent after an outage; about 1 message/s per chat with one queue per chat and `retry_after`; Rich Messages (GFM, 32768 chars) or plain text plus entities, never MarkdownV2; keyboards silently cut at 12 per row and 300 total, `callback_data` ≤ 64 bytes, cards edited into their outcome without a time limit; uploads 10/50 MB, downloads 20 MB via a token-bearing URL that never leaves the hub; pairing by `t.me/<bot>?start=<code>`; plain fetch, no library; findings on research/telegram-remote (docs/research/telegram-remote.md, 38 rules).
- [Speech-to-text providers for voice remotes, ElevenLabs first](Q-1289, .cland/tasks/Q-1289-speech-to-text-providers-for-voice.md): OGG/Opus uploads as-is to every cloud provider, no ffmpeg in the hub; the gateway downloads bytes and uploads them, never a messenger URL; ElevenLabs Scribe v2 is the reference provider (about $0.0018 per 30-second note, free plan about 4.5 h a month, privacy toggle), xAI an alternative with prepaid credits only; one interface with nine error kinds, retries only for rate-limited, unavailable and timeout; `[speech] provider = "elevenlabs" | "command"`; the `command` contract (stdin bytes, env MIME and language, stdout text); findings on research/speech-to-text (docs/research/speech-to-text.md).
- [Sandbox bots for the prototypes: a Telegram bot, a Discord app, an ElevenLabs key](T-1291, .cland/tasks/T-1291-sandbox-bots-for-the-prototypes-a-telegram.md): the human placed the Telegram and Discord bot tokens and an ElevenLabs key in `~/.config/cland/sandbox-remote.secrets.toml` (mode 600) on 2026-10-25; ElevenLabs replaces xAI as the first STT provider because xAI no longer gives free credits; the sandbox project is `/Users/evgeniyivanov/Projects/cland/sandbox-remote`.
## Not yet specified

- The exact configuration shape (`[remote]`, `[telegram]`, `[discord]`, `[speech]` keys; hot reload or restart), the pairing state file and the secrets file format: after the API research.
- The authority table's exact rows for a remote, the `via` values, and how an approval answered from a remote is recorded.
- Catch-up details, rate limiting, the outbound queue's persistence, and where the human learns that the gateway is down (doctor, General, the workbench).
- Markdown conversion fidelity per messenger: code blocks, tables, long lines.
- Discord: one bot across projects, slash command registration scope (guild or global), threads per item later.
- The workbench side: inline images, the remotes' status in Sessions or Accounts, pairing from the workbench.
- The epics, lanes, crew and definition of done (the cut).

## Out of scope

- Web Push and background notifications beyond the messengers; the v0.2 deferral stands.
- Several humans with distinct identities or rights.
- Item topics on demand from the chat.
- Slack, WhatsApp, Matrix and other messengers.
- Speech synthesis in replies.
- Hub, release and configuration control from the chat.
- Webhooks or any public endpoint.
