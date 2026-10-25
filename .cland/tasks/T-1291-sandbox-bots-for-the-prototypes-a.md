---
id: T-1291
kind: task
title: "Sandbox bots for the prototypes: a Telegram bot, a Discord app, an xAI key"
state: open
status: backlog
size: XS
labels:
  - wayfinder:task
assignee: null
parent: M-1286
blocked_by: []
topic: null
branch: null
created: 2026-10-25T10:24:45.504Z
updated: 2026-10-25T10:24:45.504Z
---

## Question

The prototypes (map M-1286) need real bots in a sandbox, and only the human can create them. Checklist for the human; tokens never pass through a chat with a session, the human writes them into the file themselves.

1. Telegram: in BotFather create a bot for the sandbox (any name, for example cland_sandbox_bot), copy its token.
2. Discord: in the developer portal create an application with a bot, enable the Message Content intent, create a private test server with one text channel, invite the bot with the permissions the prototype asks for (view channel, send messages, read message history, attach files, embed links, use application commands), copy the bot token.
3. xAI: create an API key in the xAI console.
4. Put all three into the sandbox project's secrets file as the prototype's HOW-TO-TRY.md will describe (a git-ignored 0600 file), then tell the planning session which sandbox folder holds them.

Done when the three values are in place and the prototype can read them.
