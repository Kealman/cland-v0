---
id: Q-1288
kind: question
title: Discord facts for a cland remote
state: closed
labels:
  - wayfinder:research
assignee: cland-design
parent: M-1286
blocked_by: []
topic: null
branch: null
created: 2026-10-25T10:24:45.093Z
updated: 2026-10-25T11:39:16.875Z
closed: 2026-10-25T11:35:48.723Z
---

## Question

Which facts of Discord's bot platform fix the design of a cland remote (map M-1286, round-1 decisions 3, 4, 7, 9, 10, 11, 12, 14, 15)? Primary sources only (discord.com/developers/docs, the developer portal pages, discord.js guide where it cites the API).

Cover: creating an application and bot, the bot token's shape and rotation, the OAuth2 invite URL with the permission set a remote needs (view channel, send messages, read message history, attach files, embed links, use application commands, manage messages?); the gateway websocket: identify, heartbeat, resume, session limits, the identify rate limit, what happens with two gateway sessions on one token (one bot across several projects, each hub a separate connection) and whether events are duplicated; intents, the privileged MESSAGE_CONTENT intent and the 100-server rule; REST rate limits (global, per route, per channel for messages) and the 429 headers; message limits (2000 characters, embeds, attachments per boost level, the current default attachment size), splitting; components: buttons (styles, custom_id size, 5 rows × 5), select menus, interaction responses (the 3-second acknowledgement, deferred and ephemeral responses, follow-ups), editing a message to remove components after an answer; INTERACTION_CREATE over the gateway vs an interactions endpoint URL (we want no public endpoint); slash commands: guild vs global registration, propagation delay, the `/cland pair <code>` shape; replies (message_reference), threads and forum channels for later; fetching channel history after downtime (GET messages?after=id, limits); voice messages (the IS_VOICE_MESSAGE flag, OGG/Opus, waveform, whether bots may send them, how to download attachments); identifying users (author.id, guild_id, channel_id) and bot-authored messages (to avoid echo loops); libraries (discord.js, @discordjs/core, raw ws + fetch) with a recommendation for a hub-embedded gateway. Record limits with their source lines and the date checked.

## Comments

### human · 2026-10-25T11:35:48.444Z

## Resolution (2026-10-25)

Findings: `docs/research/discord-remote.md` on branch `research/discord-remote` (commit 7c0f4d47, origin only, never merged; worktree /Users/evgeniyivanov/Projects/cland/discord-remote). Sources: Discord's developer docs at discord-api-docs commit 6128d991 (now served from docs.discord.com), the help centres, staff comments, the npm registry; all checked 2026-10-25. 36 rules for the spec, each with its source.

What it settles:
- Outbound only works: `INTERACTION_CREATE` arrives over the gateway while no Interactions Endpoint URL is set (the hub checks `interactions_endpoint_url` through `GET /applications/@me` at start); every answer, the 3-second acknowledgement included, goes over HTTPS; command registration too.
- The Message Content intent is required, or `content`, `embeds`, `attachments` and `components` arrive empty over the gateway and REST alike; since 2026-06-10 an app under 10,000 users switches it on in the portal without review; close code 4014 means the toggle is off. Identify with intents 33281 (GUILDS, GUILD_MESSAGES, MESSAGE_CONTENT), no shard, API v10, no compression, on the pinned `ws` package.
- One Discord application per project, "Public Bot" off; the invite is `scope=bot&permissions=117760` (view channel, send messages, embed links, attach files, read message history), never MANAGE_MESSAGES: the bot edits only its own messages.
- The identify cap is the sharpest edge: 1000 identifies in 24 hours terminates every session and resets the token, so identify keeps a budget (check `session_start_limit.remaining`, at least 5 s between attempts, backoff with jitter), resume with `resume_gateway_url`, `session_id` and `s`, and close codes 4004 and 4010–4014 stop the gateway and surface in doctor and General; a 4003 gets one fresh identify; a hub stop closes with 1000 and a restart catches up over REST.
- Catch-up is REST history, not replay: a session resumes only for a few minutes; after a restart the hub compares the stored id with `last_message_id` and pages back with `before` to the stored id, posting ascending with a cap; events may arrive never, once or several times, so dedupe by message and interaction id; clicks made while the hub was down are lost, so open cards are re-rendered.
- Outbound: 2000 code points per message, split with part numbers, re-opened code fences and tables as code blocks; every create and edit carries `allowed_mentions: {"parse": []}` because a bot's default parses @everyone; every send carries a `nonce` (≤ 25 chars) with `enforce_nonce: true` and the returned id is stored before the item counts as sent; up to 10 files of 20 MiB each (since 2026-09-03) and 25 MiB per request, larger as a link or path; one outbound lane per bucket and channel following the `X-RateLimit-*` headers and `retry_after`, no hard-coded limit; never repeat a 401, 403 or 404; a 401 stops the remote; interaction callbacks bypass the queue (outside the global limit, due within 3 s).
- Cards: a legacy message with `content` plus at most 3 action rows of 5 buttons (nine options, "Other answer", "Decline…"), labels ≤ 80 chars, `custom_id` `ask:<id>:<option>` ≤ 100; the paired human's click gets `UPDATE_MESSAGE` with the outcome and no components within 3 s; anyone else's click gets an ephemeral reply (flag 64); "Other answer" and "Decline…" open a modal (title ≤ 45, a Label around a paragraph Text Input ≤ 4000); an ask answered elsewhere edits its card through `PATCH /channels/{id}/messages/{id}`. Components V2 is an alternative with an undocumented text cap.
- `/cland` is one global command with subcommands `pair code:<string>`, `status`, `inbox`, `help`, `mute`, `unmute`, `contexts: [0]`, `integration_types: [0]`, `default_member_permissions: "0"` (admins only; the hub still checks the paired user id); the bulk overwrite runs only when the list differs; the old one-hour propagation is gone; user and message command limits are 15 now. The pairing reply is ephemeral and stores `guild_id`, `channel_id` and `member.user.id`.
- Inbound counts only from the paired channel and `author.id`, not a bot or webhook, type 0 or 19; replies map through `message_reference.message_id`; the hub's own replies set `fail_if_not_exists: false`.
- Voice: flag 8192 with one `audio/` attachment (OGG/Opus 48 kHz mono, up to 20 minutes); download the signed `url` at once without the token; expired links are refreshed by fetching the message again.
- One bot across projects is allowed but shares the identify cap, the rate limits and every reset; one bot per project stays the supported path.
- Library: hand-write the client on the pinned `ws` 8.21.3 plus Node's `fetch`, with `discord-api-types` as a type-only dev dependency; the libraries add 11 to 20 packages and their next majors need Node 24.17, above cland's floor.

Unverified, left to the Q-1293 prototype: whether each same-shard session receives every event (two-process test); the window `after` paging returns; the per-channel send limit, the `enforce_nonce` window and the CDN URL lifetime; the Components V2 text cap; whether "Public Bot" off needs the install link cleared first; leak scanning, the resume window, and which upload limit binds above 25 MiB.

### human · 2026-10-25T11:39:16.875Z

Branch note (2026-10-25): a follow-up commit 1f59ae25 on research/discord-remote (on top of 7c0f4d47, no force-push) marks the facts not re-checked at the source as "from the reader's report" and adds direct citations for the rest (help-centre retry_after in milliseconds vs the docs; Account Caps still 10 MB; both Message Content FAQ links 404; Discord's OpenAPI spec says content maxLength 4000 vs the documented 2000; the 1–5 s wait after op 9 is a 2017 staff comment removed 2022-09-14).
