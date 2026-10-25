---
id: Q-1288
kind: question
title: Discord facts for a cland remote
state: open
labels:
  - wayfinder:research
assignee: cland-design
parent: M-1286
blocked_by: []
topic: null
branch: null
created: 2026-10-25T10:24:45.093Z
updated: 2026-10-25T10:27:23.095Z
---

## Question

Which facts of Discord's bot platform fix the design of a cland remote (map M-1286, round-1 decisions 3, 4, 7, 9, 10, 11, 12, 14, 15)? Primary sources only (discord.com/developers/docs, the developer portal pages, discord.js guide where it cites the API).

Cover: creating an application and bot, the bot token's shape and rotation, the OAuth2 invite URL with the permission set a remote needs (view channel, send messages, read message history, attach files, embed links, use application commands, manage messages?); the gateway websocket: identify, heartbeat, resume, session limits, the identify rate limit, what happens with two gateway sessions on one token (one bot across several projects, each hub a separate connection) and whether events are duplicated; intents, the privileged MESSAGE_CONTENT intent and the 100-server rule; REST rate limits (global, per route, per channel for messages) and the 429 headers; message limits (2000 characters, embeds, attachments per boost level, the current default attachment size), splitting; components: buttons (styles, custom_id size, 5 rows × 5), select menus, interaction responses (the 3-second acknowledgement, deferred and ephemeral responses, follow-ups), editing a message to remove components after an answer; INTERACTION_CREATE over the gateway vs an interactions endpoint URL (we want no public endpoint); slash commands: guild vs global registration, propagation delay, the `/cland pair <code>` shape; replies (message_reference), threads and forum channels for later; fetching channel history after downtime (GET messages?after=id, limits); voice messages (the IS_VOICE_MESSAGE flag, OGG/Opus, waveform, whether bots may send them, how to download attachments); identifying users (author.id, guild_id, channel_id) and bot-authored messages (to avoid echo loops); libraries (discord.js, @discordjs/core, raw ws + fetch) with a recommendation for a hub-embedded gateway. Record limits with their source lines and the date checked.
