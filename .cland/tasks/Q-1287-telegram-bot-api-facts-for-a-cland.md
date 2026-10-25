---
id: Q-1287
kind: question
title: Telegram Bot API facts for a cland remote
state: closed
labels:
  - wayfinder:research
assignee: cland-design
parent: M-1286
blocked_by: []
topic: null
branch: null
created: 2026-10-25T10:24:44.971Z
updated: 2026-10-25T11:36:52.674Z
closed: 2026-10-25T11:34:21.768Z
---

## Question

Which facts of the Telegram Bot API fix the design of a cland remote (map M-1286, round-1 decisions 3, 4, 6, 9, 10, 11, 12, 14, 15)? Primary sources only (core.telegram.org/bots/api, core.telegram.org/bots/features, BotFather docs).

Cover: long polling with getUpdates (offset, timeout, allowed_updates, how long undelivered updates are kept, one poller per token); rate limits per chat and global, and the 429 retry_after contract; message limits (text 4096, caption 1024) and what happens past them; formatting: HTML vs MarkdownV2 parse modes and their escaping rules, which is safer for converted Markdown; inline keyboards, callback queries (callback_data size, answerCallbackQuery, editMessageText and editMessageReplyMarkup for turning a card into its outcome), force_reply or reply_parameters for "answer by reply"; reply semantics (reply_to_message, message_thread_id); media: sendPhoto and sendDocument limits, getFile and the download size limit, file_id reuse; voice messages (the voice field, OGG/Opus, duration, how to download), video notes and audio; deep links t.me/<bot>?start=<code> and the /start payload for pairing; identifying the sender (from.id, chat.id, private vs group chats); privacy mode and what the bot sees in groups; setMyCommands for the command menu; forum topics in supergroups (message_thread_id) as a later multi-project mode; what a bot cannot do (start a chat first, read a user's other chats); bot token format, rotation via BotFather, and what a leaked token allows; Node libraries (grammY, telegraf) against plain fetch, with a recommendation for a hub-embedded gateway. Record limits with their source lines and the date checked.

## Comments

### human · 2026-10-25T11:34:21.460Z

## Resolution (2026-10-25)

Findings: `docs/research/telegram-remote.md` on branch `research/telegram-remote` (commits 124bccdc and c2d423dc, origin only, never merged; worktree /Users/evgeniyivanov/Projects/cland/telegram-remote). Sources: Bot API 10.3 (2026-08-24), the features page, the FAQ and the BotFather guide; limits the docs omit come from the official Bot API server (tdlib/telegram-bot-api e3e9dd8e) and TDLib (ea3f69ce), each with its source line. 38 rules for the spec in section 14.

What it settles:
- Long polling fits decision 4 as is: outbound HTTPS only, updates wait on Telegram's side for at most 24 hours, confirmed by the next poll's `offset` after handling; the server clamps `timeout` at 50 s; one consumer per token, a second poller gets 409 "terminated by other getUpdates request" (report it, never retry in a tight loop); always pass an explicit `allowed_updates`.
- Catch-up has hard edges: a bot cannot read chat history; messages are kept 24 h but button presses (callback_query) only 150 s, so after any outage the gateway re-sends its open cards and says what may have been lost.
- Pacing: about one message per second per chat, bursts tolerated, then 429 with `retry_after` (also a Retry-After header); one outbound queue per chat with one request in flight, cards first, General bursts coalesced; HTTP timeouts of 30 s or more because the server absorbs up to 8 s of flood wait.
- Formatting: Bot API 10.1 Rich Messages take GitHub Flavored Markdown (tables, lists) up to 32768 characters and stay editable; the fallback is plain text plus an `entities` array (no escaping); MarkdownV2 is ruled out (one unescaped character fails the send); only 100 styled entities survive per message; regular text is 4096 code points after entity parsing, entity offsets count UTF-16 units; captions 1024.
- Cards: inline keyboards; `callback_data` ≤ 64 bytes and untrusted; answer every callback at once; `editMessageText` turns a card into its outcome (no edit time limit for the bot's own messages; "message is not modified" counts as success); `force_reply` on the card's keyboard (10.3) takes "Other answer" by plain reply; the server silently drops buttons beyond 12 per row and 300 total; a message that ever carried a reply keyboard or ForceReply can never be edited; deletes only within 48 h.
- Media: uploads 10 MB photos, 50 MB documents; downloads 20 MB through a URL that contains the token (never leaves the hub); voice notes are OGG/Opus with a sender-declared MIME type; album items grouped by `media_group_id`; photos resized server-side to at most 2560 px.
- Pairing: `t.me/<bot>?start=<code>`, code ≤ 64 characters of `A-Za-z0-9_-`, the bot receives `/start <code>`; identity = `from.id` plus `chat.id` of a private chat, numeric ids only; everything else gets silence; a blocked bot learns it from `my_chat_member` and 403.
- Token: total control of the bot, present in every request URL, so one redactor for every log line, error and artifact; validate the token format (`^[1-9]\d{0,16}:[A-Za-z0-9_-]{24,}$`, ≤ 80 chars) before building any URL because a failed URL parse echoes it.
- Library: plain `fetch` on Node 24 with hand-written types, no runtime dependency; grammY would add 9 packages and its node-fetch v2 errors carry the token-bearing URL; telegraf unmaintained since 2024; node-telegram-bot-api 2.x too new.
- 2026 features worth knowing: topics in private chats (9.3/9.4), draft streaming with Stop (9.5/10.0), managed bots, button colours and disabled buttons, `force_reply` on inline keyboards (10.3).

Unverified, left to the Q-1292 prototype: the callback-answer deadline, whether edits count against the rate limit, photo recompression, album captions, the incoming voice MIME type, rich-message rendering on the human's clients, BotFather owner restrictions and immediate `/token` revocation, edits of weeks-old cards, `chat.id` equal to `user.id` in private chats.

### human · 2026-10-25T11:36:52.674Z

Branch note (2026-10-25): research/telegram-remote was squashed into one commit, 2a81ecc9 (on dev 15d47490), replacing 124bccdc and c2d423dc named in the resolution; the file docs/research/telegram-remote.md is unchanged in substance, with the folded helper facts cited against the server (e3e9dd8e) and TDLib master (ea3f69ce).
