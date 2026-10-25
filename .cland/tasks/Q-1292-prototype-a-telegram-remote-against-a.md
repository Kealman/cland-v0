---
id: Q-1292
kind: question
title: "Prototype: a Telegram remote against a sandbox hub"
state: closed
labels:
  - wayfinder:prototype
assignee: cland-design
parent: M-1286
blocked_by:
  - Q-1287
  - Q-1289
  - T-1291
topic: null
branch: null
created: 2026-10-25T10:24:45.624Z
updated: 2026-10-25T12:51:33.793Z
closed: 2026-10-25T12:51:33.793Z
---

## Question

How should a Telegram remote feel on the human's phone (map M-1286, round-1 decisions 2, 3, 6, 9, 10, 11, 12, 14, 15)? A throwaway gateway edge on a prototype branch, run against a sandbox hub, never this project's hub: pairing by code and deep link; General mirrored both ways with the author · kind header and Markdown conversion; needs-you asks as cards with inline buttons, "Other answer" and "Decline…", edited into their outcome; replies routed to their topic; photos and documents as artifacts; voice notes transcribed through the ElevenLabs provider with the transcript echoed; `/mute`, `/unmute`, `/status`, `/inbox`, `/help`; a restart with catch-up. The human reacts on their phone; the ticket closes with what felt right, what did not, and the decisions it settled.

## Comments

### human · 2026-10-25T12:11:02.245Z

Human reaction after steps 1–4 (2026-10-25): paired @cland_app_bot on the phone and tried every scenario (reports with the author · kind header, Markdown in rich and plain, long texts, desk messages, silent progress, a burst of 20, mute/unmute, a restart, free text and replies from the phone with the 👌/👀 reactions): «попробовал все отлично, rich выглядит хорошо». Settled: Rich Messages are the default format, plain text plus entities the fallback; the header line and the silent progress notes stay. Prototype commits so far: 0fa46b9d (steps 1–3), 68820807 (step 4) on prototype/telegram-remote.

### human · 2026-10-25T12:21:59.706Z

Prototype progress (2026-10-25, steps 5–7; the human is away and will try them later): cards (9f2fbc73, bb73429f), media both ways (7ee1216b), voice through ElevenLabs (2f1d34ce).

Voice latency measured from the Mac with the prototype's provider code and the human's key, synthesized 30-second notes uploaded as AAC (~128 KB, close to Telegram's 32 kbps Opus), six calls:

| Note | ElevenLabs Scribe v2, request → transcript | Language detected |
|---|---|---|
| English, 29 s | 1.60–1.81 s | en |
| Russian, 30 s | 1.35–1.82 s | ru |

Russian came back with correct punctuation and capitals, so the transcript can go to the Coordinator unedited. The download from Telegram adds a fraction of a second; each real note logs download and transcription times (event remote-voice) and the echo on the phone shows them. Caps (10 minutes, 20 MB) are checked before download; a 90 s deadline per note; retries only for rate limits, outages and timeouts; no key → the audio still reaches General as "not transcribed" plus a one-line hint in the chat; a voice reply to an ask card answers the ask.

### human · 2026-10-25T12:28:28.688Z

Prototype progress (2026-10-25, steps 8–9, commits c24f3800 and a7d6d779): all nine steps of the brief are built. `/status` answers from hub.status and task.list (reads of the remote's table): hub version and uptime, the Coordinator and the needs-you count, up to six sessions, the verification and merge queues, the open release, the chat's own state (muted or live, format, Bot API calls and rate-limit waits). The command menu is set once per hub start.

Restart and catch-up: after a hub restart the gateway first drains what Telegram kept (late messages marked "written on Telegram at …; the hub was down until …"; a press made in the last 150 s still closes its card), then one line "N General messages missed since HH:MM while …" instead of a replay, cards for open asks the chat never got, outcome edits that did not go through, and, when the outage outlasted 150 s, every open card re-sent at the bottom with "A button pressed then was lost; press again" while the old card says "↓ Re-sent below". Network outages while the hub runs get the same catch-up: a failed send or poll marks the gateway offline, the queue drops jobs and the catch-up counts them, polls turn short so recovery is noticed at once. Testing aid (prototype only): `cland remote pause telegram <seconds>`. Checked on the fake Bot API: a restart after a backdated four-minute outage (a late message, two cards re-sent), a 10 s pause with three General posts and a workbench answer ("4 General messages missed since 13:24", the card edited to the workbench answer), a 5 s pause caught up 5.0 s after it began.

Finding: after a pure hub restart the "N missed" line is almost always 0, because nothing posts to General while the hub is down; it matters for network or Telegram outages while the hub runs, which is also when the 150 s press loss bites. The real phone shows no activity since 12:10; the human tries steps 5–9 later.

### human · 2026-10-25T12:30:43.734Z

Prototype final report (2026-10-25; the human's reactions to steps 5–9 pending): branch prototype/telegram-remote at bd4087b5 (9 commits, origin only), hub/src/remote/README.md is the map; the sandbox hub and the stand-in Coordinator keep running for the human's trial (HOW-TO-TRY.md covers every scenario).

Worked well: pairing by QR code and deep link (paired 24 s after the code was minted); the in-process edge is one conversation on the dispatcher (messages, inbox, ask, approval and delivery events in; topic.send, topic.answer, approval.answer out), so the hub changes stay small; Rich Messages accepted every agent sample (headings, a table, code, an 8 KB report, List<T>, @aide, /tmp/x), nothing fell back to plain; cards (taps, ForceReply free answers, declines, stale presses, workbench answers, outcome edits) and a real Codex approval through Approve and Deny from the card; voice about 1.6 s per 30-second note with correct Russian punctuation.

Rubbed: no upload frame in the protocol (bytes cannot become an artifact, every created artifact posts its own ▣ message), so photos and voice needed an in-process seam; an ask's outcome has no `via`; a reply to a 📥 notice lands in its item topic but the agent's answer there is not mirrored back; `@aide` is refused as unknown, also from the web; the "N missed" line is nearly always 0 after a plain hub restart (it matters for network outages while the hub runs); Telegram formatting of the human's own text is dropped; album items are gathered 1.5 s after the offset is confirmed.

Limits hit: multipart CRLF shifts caption entity offsets (computed on the CRLF text; JSON sends unaffected); a 50 s long poll hid recovery, so the gateway polls with timeout 0 while offline; presses live 150 s, so open cards are re-sent after longer outages; a 20-message burst sent one at a time got no 429; the largest card (9 options of ~200 chars plus 2 buttons, ~1.9 KB markup) was accepted; file caps as researched. Bot API latency (small sample): sendMessage 203 ms, sendRichMessage 313 ms, editMessageText 474 ms.

Settles for the spec (pending the human's taste on 4–6): (1) the gateway as an in-process edge with the web table minus pairing and pause, `via: "telegram"` on human messages and approval outcomes, which also suppresses echoes; (2) pairing state as ids only (the direction itself follows Q-1294); (3) Rich Messages by default with skip_entity_detection, plain text plus entities on any 400, never MarkdownV2, splitting only on the plain path (the hub caps messages at 8 KiB); answers and the human's own asks are not mirrored as messages, their cards carry them; (4) 👌/👀 reactions as feedback; (5) progress and hub notices silent, everything else notifies; (6) cards as plain text with entities, one button per row, short callback keys checked in state, ForceReply for free answers, a reply or voice reply to a card answers it, coloured approval buttons, Claude Code approvals point to the harness, plans as notices, requests and messages in item topics as notices with reply routing; (7) media both ways (inbound photos and documents as the human's artifacts on one General message, albums grouped; outbound images ≤ 10 MB as photos, files ≤ 50 MB as documents, larger by path); (8) voice through the research's seam with ElevenLabs default, 🎤 transcript as the human's message with the audio attached, a transcript echo, a one-line hint without a key; (9) catch-up: drain first with late marks, then one "N missed" line, cards the chat never saw, outcome edits that did not go through, open cards re-sent after 150 s, offline detection on failed sends and polls; (10) `/status`, `/inbox`, `/mute`, `/unmute`, `/decision`, `/question`, `/help`, `/cancel`, menu set once per hub start.

For the spec to decide: an upload-or-attach frame for remote edges; `via` on ask outcomes; `@aide` from a remote; whether a remote follows a thread it started; whether audio files and video notes are transcribed; CLAND_TELEGRAM_TOKEN and ELEVENLABS_API_KEY on the sessions' environment deny-list (the prototype keeps them out of the speech command only). Carried into Q-1295 and Q-1296.

### human · 2026-10-25T12:38:28.301Z

Follow-up (2026-10-25, commits 3ae5ece1 and 10f47d5e): pairing reversed per Q-1294 (Start in the bot yields an 8-character code, the sender's numeric id and the exact approve command as tap-to-copy spans; `cland remote approve telegram <code>` in the terminal prints the paired name and id; codes last an hour, at most three pending, an unpaired account gets two replies then silence; approving replaces the earlier pairing and tells the old chat; `cland remote unpair telegram` forgets it; the forward pairing with QR and deep link is gone; one prototype frame `remote` carries approve, unpair and pause). Remote state moved into `remote_*` tables in hub.db on the gateway's own connection (scalars, the reply map, cards and callback keys, pending pairing requests, stranger reply counts), with a one-time import of the JSON file; the human's pairing survived. For the spec: approving clears every pending request, since one chat is paired per project. The Telegram agent has stopped; the Discord prototype (Q-1293) continues on the same branch.

### human · 2026-10-25T12:51:33.625Z

Resolution (2026-10-25): the human tried every scenario on the phone, steps 1–9 and the reversed pairing, and accepted («все попробовал, принимаю»): rich rendering, the author · kind header, silent progress notes, the 👌/👀 reactions, one button per row with the outcome line, the transcript echo and its speed, and the single gap line after an outage all stand as the prototype built them. Capture: branch prototype/telegram-remote at 10f47d5e (origin only, never merged), hub/src/remote/README.md as the map; the settled decisions and the open points for the spec are in the final report comment above and go into Q-1295, Q-1296 and the spec. The sandbox keeps running for the Discord prototype (Q-1293).
