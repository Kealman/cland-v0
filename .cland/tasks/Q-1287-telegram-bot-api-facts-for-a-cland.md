---
id: Q-1287
kind: question
title: Telegram Bot API facts for a cland remote
state: open
labels:
  - wayfinder:research
assignee: cland-design
parent: M-1286
blocked_by: []
topic: null
branch: null
created: 2026-10-25T10:24:44.971Z
updated: 2026-10-25T10:27:22.965Z
---

## Question

Which facts of the Telegram Bot API fix the design of a cland remote (map M-1286, round-1 decisions 3, 4, 6, 9, 10, 11, 12, 14, 15)? Primary sources only (core.telegram.org/bots/api, core.telegram.org/bots/features, BotFather docs).

Cover: long polling with getUpdates (offset, timeout, allowed_updates, how long undelivered updates are kept, one poller per token); rate limits per chat and global, and the 429 retry_after contract; message limits (text 4096, caption 1024) and what happens past them; formatting: HTML vs MarkdownV2 parse modes and their escaping rules, which is safer for converted Markdown; inline keyboards, callback queries (callback_data size, answerCallbackQuery, editMessageText and editMessageReplyMarkup for turning a card into its outcome), force_reply or reply_parameters for "answer by reply"; reply semantics (reply_to_message, message_thread_id); media: sendPhoto and sendDocument limits, getFile and the download size limit, file_id reuse; voice messages (the voice field, OGG/Opus, duration, how to download), video notes and audio; deep links t.me/<bot>?start=<code> and the /start payload for pairing; identifying the sender (from.id, chat.id, private vs group chats); privacy mode and what the bot sees in groups; setMyCommands for the command menu; forum topics in supergroups (message_thread_id) as a later multi-project mode; what a bot cannot do (start a chat first, read a user's other chats); bot token format, rotation via BotFather, and what a leaked token allows; Node libraries (grammY, telegraf) against plain fetch, with a recommendation for a hub-embedded gateway. Record limits with their source lines and the date checked.
