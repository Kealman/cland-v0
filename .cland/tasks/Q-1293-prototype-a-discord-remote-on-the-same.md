---
id: Q-1293
kind: question
title: "Prototype: a Discord remote on the same gateway"
state: open
labels:
  - wayfinder:prototype
assignee: cland-design
parent: M-1286
blocked_by:
  - Q-1288
  - T-1291
  - Q-1292
topic: null
branch: null
created: 2026-10-25T10:24:45.865Z
updated: 2026-10-25T13:25:37.427Z
---

## Question

How should a Discord remote feel, and what does Discord add or complicate against Telegram (map M-1286, round-1 decisions 7, 9, 10, 15)? On the Telegram prototype's branch: the gateway websocket with intents, `/cland pair <code>` in the designated channel, the mirror and ask cards with button components and interaction responses, replies, attachments and voice messages, history catch-up after a restart, and a look at one bot serving two sandbox projects. The human reacts in their test server; the ticket closes with the decisions it settled and the Discord-specific rules for the spec.

## Comments

### human · 2026-10-25T12:30:43.982Z

Started 2026-10-25 ahead of Q-1292's close on the human's standing instruction («если что продолжай, думаю мне все в прототипах понравится»): the Telegram remote is built and the human has pre-approved the prototypes; the Discord remote is built on the same branch and sandbox while the human's trial of the Telegram steps 5–9 is pending. Brief: scratchpad remote-map/p2-brief.md.

### human · 2026-10-25T13:04:35.531Z

Prototype progress (2026-10-25, steps 1–3 plus 4, 5 and the restart logic of 7 built against a fake Discord; commits 132f9149, 81000bae, 5995f47b on prototype/telegram-remote): the Discord remote runs on the sandbox hub beside the Telegram remote, passed its start checks (Message Content on, Interactions Endpoint URL empty), registered `/cland` globally, identified and is READY in zero servers; the human pairs when back (Developer Portal: Install Link "None", Public Bot off; invite with `permissions=117824`; `/cland pair` in a channel, then `cland remote approve discord <code>` on the Mac).

Facts from real Discord (a passive probe session): `session_start_limit` 1000 with `max_concurrency` 1; the app holds the self-serve Message Content flag (1<<19); an unclean drop followed by RESUME worked (RESUMED, 0 replayed). The research's invite set (117760) lacks ADD_REACTIONS, which the 👌/👀 feedback needs, so the invite uses 117824. Discord snowflakes exceed 2^53: the hub.db remote tables store ids as integers, so the Discord prototype keeps a JSON state file for now; the spec stores remote ids as TEXT. Header-driven pacing kept a burst of twelve free of any 429 in the fake. A first version backed off identifies on every dropped connection and delayed recovery by about 33 s after an outage; fixed to back off only on identifies that fail before READY.

### human · 2026-10-25T13:17:25.973Z

Prototype progress (2026-10-25, step 5 on real Discord; the human paired at 13:09Z and tried cards, commands and a quick restart; commits up to 985a32e5): every interaction answered 0.42–0.69 s after the click (each callback call 0.3–0.47 s from this machine), so the 3-second deadline is comfortable; an option press turns the card into its outcome in one UPDATE_MESSAGE; "Other answer…" opened the modal in the Components V2 layout (a Text Display with the question and a Label around the input) and Discord accepted it. Quick restart (hub stopped 24 s): the session RESUMEd and its replay carried the two button presses made during the outage, 15 and 21 s old and too late to answer, so the hub re-sent only that card and the next press worked.

Measured with passive probe sessions: the resume window is between 90 and 120 s (a session closed for 60 or 90 s resumes; after 120, 150 or 180 s Discord answers op 9), so hub restarts under about 1.5 minutes RESUME and see exactly which cards were pressed meanwhile; longer ones identify afresh, read the channel history and re-send every open card. Step 8 answered in substance: every session of a bot gets every event, interactions included (a second throwaway project on the same token replayed the same `/cland` command, bot message and press); two hubs on one token would both see every click and race to answer it (the loser gets 40060), and the identify counter is shared (999 → 998 when the second project identified). One bot per project is the supported path. Open: photos, files and voice from Discord (step 6, needs the human's phone), a restart over 2 minutes and `cl remote pause discord 60` (step 7), then the final report.

### human · 2026-10-25T13:19:07.353Z

Human reaction on the phone (2026-10-25 ~14:17 local): «Все нравится, кроме ответов на эти команды, как-то все скомкано и ничего не понятно, нужно сделать красивое форматирование чтобы все читалось нормально». Cards, the modal, the 👌/👀 reactions and the quick restart are accepted; the replies to `/cland status` and `/cland help` (and the same commands in Telegram) must be restructured: a title line, groups separated by blank lines with bold labels and one fact per line, sessions as bullets, technical gateway statistics as small subtext at the end or behind a verbose form, help in short headed sections with the commands as a bullet list. Settled for the spec: command replies are structured for a phone screen, never a run-on line of facts joined by middle dots. The Discord agent is reformatting both messengers' replies.

### human · 2026-10-25T13:21:39.440Z

Bug found by the human (2026-10-25 ~14:20 local) with both remotes paired: a photo or voice message sent in Discord reaches Telegram as the human's own message (expected, like a desk message) but its attachment arrives twice (two identical artifact bubbles A-5 voice, A-6 image); the text arrives once. Likely a double send from the message's artifacts plus the separate artifact event in the prototype's in-process seam. The Discord agent fixes it for both directions. For the spec: an artifact attached to a human message is sent exactly once per remote, captioned with the message header.

### human · 2026-10-25T13:24:50.395Z

The human confirms the double attachment in the reverse direction too (a Telegram photo or voice note arrives twice in Discord), so the double send sits in the shared mirror-out path of the human's own messages with artifacts; the Discord agent fixes it once in the shared code.

### human · 2026-10-25T13:25:37.427Z

Prototype final report (2026-10-25; branch prototype/telegram-remote at 83f3db5a, the verdict also in hub/src/remote/discord/README.md; three follow-ups still open before the close: trailers, the double attachment, the command reply formatting).

What felt different from Telegram: a press is answered in one call that rewrites the card and drops its buttons (0.42–0.69 s after the click) where Telegram needs a callback answer plus an edit; "Other answer…" and "Decline…" open a real modal instead of a reply prompt, so no pending reply mode and no /cancel; `/cland` answers and the pairing code are visible only to the human, which matters in a channel with other members (ignored, their presses privately refused); Discord forgives nothing during an outage (a press must be answered within 3 s, so a press while the hub is down is always lost) but has real channel history, so no typed message is ever lost; the gateway is most of the extra code (about 590 lines of socket, REST and types against 111 for the Telegram client) and brings the identify cap; agent Markdown renders almost as is (tables, deep headings, rules, task boxes and `||` rewritten), messages cap at 2000 code points; setup has more steps (Public Bot off, an invite URL with permissions, a channel).

Limits hit: none; header pacing kept every request under its limit (the reaction route one call per 250 ms, a channel about 5 sends per 5 s by its headers); 13 of the day's 1000 identifies used.

Catch-up: quick restart tried by the human (24 s down): RESUMEd, the replay carried both presses made meanwhile, only that card was re-sent, one silent gap line. Resume window measured: resumes after 60 and 90 s, op 9 after 120, 150 and 180 s. Long restart over 2 minutes: a fresh identify, history read back to the last processed id, every open card re-sent, one gap line (passed on the fake; on real Discord still for the human). Real channel history: newest first, `before` pages continue exactly, `after` with a limit returns the messages right after the cursor, newest first within the page (answers the research's open paging question).

Two sessions (step 8): every session of a bot receives every event, interactions included (a passive second session saw all six events of a five-minute window; a resumed second session replayed the same command, bot message and press); a second identify does not disturb the first; one shared identify budget (999 → 998); two hubs on one token would race to answer each click (the loser gets 40060). One bot per project. The second session was stopped and its token copy deleted.

Settles for the spec: (1) a hand-written client on the pinned ws and fetch with vendored types; (2) `/cland pair` gives a private 8-character code, `cland remote approve discord <code>` binds guild, channel and user id, the code lives 15 minutes (the interaction token's life) so the private reply turns into "Approved"; (3) one global `/cland`, admins only, written once on the first start and only compared afterwards; (4) one bot per project; (5) cards as legacy messages with up to three rows, options five to a row, labelled when every option fits 34 characters and numbered otherwise, then Other answer… and Decline…; a press answered by UPDATE_MESSAGE, free text by a modal (a Text Display and a Label), a card edited once; (6) interaction callbacks bypass the send queue, work gets 2 s then the remote defers and edits; (7) a hub stop closes resumably, a start younger than about 90 s RESUMEs and re-sends only the pressed cards, otherwise a fresh identify plus history and every open card re-sent, always dedupe by id, one silent gap line; (8) Discord ids stored as TEXT; (9) the invite asks for 117824 (the research's 117760 plus Add Reactions), setup checks Public Bot, the Message Content flag and an empty Interactions Endpoint URL; (10) identify guard: at least 5.5 s apart, back off only after identifies that never reached READY, a daily cap and a floor on `remaining`.

Not tried on real Discord: Codex approval cards, the long restart, the pause outage, the bot's presence after a stop. Leftovers to delete later: ~/Projects/cland/sandbox-discord-fake and ~/Projects/cland/sandbox-remote-two.
