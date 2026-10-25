---
id: T-1291
kind: task
title: "Sandbox bots for the prototypes: a Telegram bot, a Discord app, an ElevenLabs key"
state: closed
status: done
size: XS
labels:
  - wayfinder:task
assignee: null
parent: M-1286
blocked_by: []
topic: null
branch: null
created: 2026-10-25T10:24:45.504Z
updated: 2026-10-25T10:48:15.350Z
closed: 2026-10-25T10:48:15.350Z
---

## Question

The prototypes (map M-1286) need real bots in a sandbox, and only the human can create them. Checklist for the human; tokens never pass through a chat with a session, the human writes them into the file themselves.

1. Telegram: in BotFather create a bot for the sandbox (any name, for example cland_sandbox_bot), copy its token.
2. Discord: in the developer portal create an application with a bot, enable the Message Content intent, create a private test server with one text channel, invite the bot with the permissions the prototype asks for (view channel, send messages, read message history, attach files, embed links, use application commands), copy the bot token.
3. xAI: create an API key in the xAI console.
4. Put all three into the sandbox project's secrets file as the prototype's HOW-TO-TRY.md will describe (a git-ignored 0600 file), then tell the planning session which sandbox folder holds them.

Done when the three values are in place and the prototype can read them.

## Comments

### human · 2026-10-25T10:48:15.228Z

Resolution (2026-10-25): the human created the Telegram bot and the Discord application (Message Content intent on, invited into a private test server with one channel) and placed the tokens in `~/.config/cland/sandbox-remote.secrets.toml` (mode 600; sections `[telegram] token`, `[discord] token`, `[speech] elevenlabs_key`). ElevenLabs replaces xAI as the first speech-to-text provider: xAI no longer gives free transcription credits, ElevenLabs still does. The keys are the human's real keys for later use in the app: the file is never deleted, printed or copied into a repository; prototypes read it by path. The prototype's sandbox project is `/Users/evgeniyivanov/Projects/cland/sandbox-remote`, prepared by the prototype agent (git init first, then the prototype's `cland init`).
