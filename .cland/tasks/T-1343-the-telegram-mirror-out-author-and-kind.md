---
id: T-1343
kind: task
title: "The Telegram mirror out: author and kind header, Rich Messages, entities fallback, numbered splits, silent notes"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1341
topic: null
branch: null
created: 2026-10-26T19:09:06.641Z
updated: 2026-10-26T19:09:13.991Z
---

## Summary

General arrives in the Telegram chat under an "author · kind" header, as Rich Messages by default. It falls back to plain text with gateway-computed entities after a rejection or under `format = "entities"`, splits the plain path into numbered parts, and never echoes what the human wrote in the chat. Progress notes and hub notices arrive silently.

## What to build

Rendering of General messages. The header names "you" for the human's workbench messages and "you (Discord)" for Discord's. No answers or asks to the human are sent as messages. Rich Message is GitHub Flavored Markdown up to 32768 characters, with entity detection and link previews off. Never MarkdownV2. The plain path splits at 4096 code points and before the 101st entity, at block boundaries and never inside an entity, with parts numbered "n/m". A conversion error falls back to plain text. Progress notes and hub notices go with disable_notification. Spec §3.4.

## Acceptance criteria

- [ ] C1. An agent's report with a heading, a table and code arrives as a Rich Message with its header, a message the fake rejects arrives as plain text with entities, and a long message under `format = "entities"` arrives in numbered parts that never split an entity (test).
- [ ] C2. A progress note and a hub notice arrive without notification, and nothing the human sent from the chat, no answer and no ask is mirrored back as a message (test).
