---
id: E-1312
kind: epic
title: The Discord remote
state: open
labels:
  - epic
  - v0.3
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by:
  - E-1310
topic: null
branch: null
created: 2026-10-25T14:11:59.875Z
updated: 2026-10-25T14:12:34.081Z
---

## Goal

The human pairs one channel of their own Discord server with the project and gets what the Telegram remote gives: General in both directions, remote cards with buttons and modals, the commands, attachments and voice, and a catch-up after an outage. Discord adds a gateway websocket whose identify budget, once overrun, resets the token; a 3-second deadline on every click; sessions that resume for about 90 seconds; and real channel history. The human tried the prototype in a test server and on the phone and accepted it (Q-1293). This epic builds it on the shared gateway, against a fake Discord gateway and REST.

## Contents

- **The application and its checks** (spec §3.8). One application and bot per project, with Public Bot off and the Install Link at None; the invite `scope=bot&permissions=117824` (view channel, send messages, embed links, attach files, read message history, add reactions), never Manage Messages. The Interactions Endpoint URL stays empty, so interactions arrive over the gateway; the hub checks it and the Message Content flag at start. Demo: with the flag off on the fake, the remote stops with a plain explanation in General while the hub and the Telegram remote serve on.
- **The gateway socket** (§3.8). The pinned `ws`, API v10, JSON, no compression, no shard, intents 33281 (guilds, guild messages, message content). Heartbeats start with jitter, and a missing acknowledgement terminates the socket and resumes. Close codes 4004 and 4010 to 4014 stop the remote with the cause and the fix in General (4004 a new token, 4014 the Message Content toggle); a 4003 gets one fresh identify. Demo: a zombie connection on the fake is detected and resumed, and a 4004 stops only this remote.
- **The identify budget** (§3.8). 1000 identifies in 24 hours end every session and reset the token, and every session of the bot counts. Identify waits at least 5 seconds after the previous one, resumes first whenever it can, backs off with jitter only after identifies that never reached READY, refuses below a floor of the remaining session starts, and warns the human at 500 in a day; the count lives in `hub.db`. Demo: ten forced drops cost no identify while resume works, and a `remaining` below the floor on the fake stops the remote with a warning.
- **Resume and history catch-up** (§3.8, §3.9). A hub stop closes the socket resumably, with a code other than 1000. A start within about 90 seconds resumes: the replay carries the messages and the clicks made meanwhile, the clicks too late to answer, so only the pressed cards are re-sent. A later start identifies afresh, compares the stored last id with the channel's last message id, pages back with `before` to it and posts what it finds in order, late messages marked with their time: at most 500 messages, and past the cap one line saying the older ones were not passed on. It then re-sends every open card and adds one silent gap line when N is above 0. Events are deduplicated by message and interaction id, and the bot's own messages are dropped. Demo: a 30-second restart with a press during it re-sends only that card; a three-minute restart with two messages typed meanwhile posts them marked late and re-sends every open card.
- **REST and pacing** (§3.8, §3.9). One lane per bucket and channel following the `X-RateLimit-*` headers and `retry_after`, capped at 5 minutes, with no hard-coded limit; a 401, 403 or 404 is never repeated, and a 401 stops the remote. Every send carries a nonce with `enforce_nonce`, and its returned id is stored before the send counts as done. Interaction callbacks bypass the lanes and the outbox. Demo: a burst of twelve on the fake's 5-per-5-seconds channel limit sees no 429, and a send retried after a timeout posts once.
- **`/cland` and pairing** (§3.2, §3.10). One global command for the server's administrators, usable in servers only, written on the first start and afterwards only compared and overwritten when it differs. Its subcommands are `pair`, `status`, `inbox`, `mute`, `unmute`, `decision`, `question` and `help`, answered ephemerally; `decision` and `question` take a text field, since Discord takes a message that starts with a slash as a command. `pair` gives a private code that lives 15 minutes and turns into "Approved"; approval binds the guild, channel and user ids, and the hub checks the paired user on every interaction. Other members may read the channel; their messages are ignored and their clicks refused privately. Replies are laid out for a phone screen, as on Telegram, with "This channel" for the remote's own state. Demo: a second hub start writes no command, and another member's `/cland status` and press are refused privately.
- **The mirror** (§3.4). General out with the "author · kind" header, the human's messages from the workbench under "you" and from Telegram under "you (Telegram)"; Discord's Markdown with tables as code blocks and deep headings, rules, task boxes and `||` rewritten; embeds suppressed; an empty `allowed_mentions` on every create and edit; splits at 2000 code points that re-open code fences, numbered "n/m". Inbound counts only from the paired channel and user, never from a bot or a webhook, and only ordinary messages and replies; a reply maps through its message reference. 👌 and 👀 confirm the human's messages; `mute` and `unmute` behave as on Telegram; progress notes and hub notices go silently. Demo: an agent's report with a table renders, a mention in it pings nobody, and a reply lands in its topic.
- **Cards** (§3.5). Legacy messages: content with at most three rows of buttons, the options five to a row, labelled with their text when every option fits in 34 characters and numbered otherwise, then "Other answer…" and "Decline…"; labels within 80 characters, custom ids such as `ask:<id>:<option>` within 100. The paired human's click is answered within 3 seconds by one update that turns the card into its outcome without buttons; work that needs more than 2 seconds is deferred and the card edited afterwards. "Other answer…" and "Decline…" open a modal that shows the question above one paragraph field of up to 4000 characters, so Discord needs no reply mode and no `/cancel`. An ask answered elsewhere edits its card over REST, and one gate holds across Discord, Telegram and the workbenches. Demo: an ask answered from a Discord modal turns its Telegram copy into the outcome as well.
- **Attachments and voice** (§3.6). An attachment is fetched from its signed URL at once, without the token, and becomes the human's artifact through `artifact.upload`. Outbound files go up to 20 MiB, at most 10 per message and 25 MiB per request, each artifact once per remote, captioned with the message's header. A voice message, a flagged message with one OGG/Opus attachment of up to 20 minutes, is transcribed through the speech seam and posted as the human's 🎤 message, with the echo in the channel. Demo: a photo sent in Discord reaches Telegram once, captioned "you (Discord)"; a voice message becomes a 🎤 transcript.
- **Ids** (§3.1, §3.8). Every Discord id is a string in the hub and TEXT in `hub.db`. Demo: an id above 2^53 round-trips through a restart.

Not in this epic: Components V2 and a thread per item (deferred to 0.3.x); a bot shared by projects, since one bot per project is the supported path; setup's Discord step, doctor's Discord lines and the Remotes row ("Setup, doctor, onboarding and the workbenches").

## Order

1. **Socket, pairing and one message.** Demo: on the fake, `/cland pair`, `cland remote approve discord <code>`, and one General message each way.
2. **The budget, the close codes and the checks.** Demo: zombie detection, resume before identify, a fatal code, the Message Content check.
3. **The mirror and the commands.** Demo: rendering, mentions, splits, reactions, mute and the phone layout of `/cland status` and `/cland help`.
4. **Cards and modals.** Demo: a click, a modal answer, a decline, a foreign click, one gate with Telegram.
5. **Resume and history catch-up.** Demo: the 30-second and three-minute restarts.
6. **Attachments and voice**, after "Media, the upload frame and speech" closes. Demo: a photo each way across both remotes, and a voice message.

## Definition of done

QA runs the demo below on `dev` against the fake Discord gateway and REST, the fake Bot API and a fake speech provider in the suite, playing the human and another member through the fakes' control APIs, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The live run with the human on the sandbox bots is not part of this epic: it happens once, before the release, in "Release v0.3.0 from the item".

In a scratch project with made-up tokens and Telegram already paired, QA enables Discord with the Message Content flag off on the fake and reads the stop and its explanation, turns the flag on, pairs with `/cland pair` and `cland remote approve discord <code>`, and has another member try `/cland status` and a press. It posts an agent's report with a table and a mention and a message over 2000 code points, writes as the human, replies to an agent's message, and runs every subcommand. It answers asks with a button, a modal and a decline, answers one from Telegram and reads the Discord copy, and floods twelve messages. It forces drops, a zombie connection, a 4004 and a low `remaining`, then restarts the hub for 30 seconds with a press in between and for three minutes with two messages typed meanwhile. Finally it sends a photo and a voice message from Discord and a photo from Telegram, and reads each remote and General.

- [ ] C1. The hub checks the Message Content flag and the empty Interactions Endpoint URL at start, and a wrong one or a fatal close code stops only this remote with its cause and fix in General.
- [ ] C2. The socket uses intents 33281 on API v10, detects a zombie connection and resumes, and gives a 4003 one fresh identify.
- [ ] C3. Identifies are at least 5 seconds apart, resume comes first, back-off follows only identifies that never reached READY, the floor of remaining starts holds, and the human is warned at 500 in a day.
- [ ] C4. `/cland` is one global command with its eight subcommands, written once and then only compared, answered ephemerally and laid out for a phone screen.
- [ ] C5. `/cland pair` gives a private code for 15 minutes, approval binds the guild, channel and user ids, and other members' messages are ignored and their clicks refused privately.
- [ ] C6. General is mirrored both ways in Discord's Markdown with an empty `allowed_mentions`, fence-safe splits at 2000 code points and the reactions, and inbound counts only from the paired channel and user.
- [ ] C7. Cards take spec §3.5's Discord form, a click is answered within 3 seconds by one update to the outcome, modals take free answers and declines, and one gate holds across Discord, Telegram and the workbenches.
- [ ] C8. REST follows its rate-limit headers with no 429 in a burst, never repeats a 401, 403 or 404, and a send retried with its enforced nonce posts once.
- [ ] C9. A restart within the resume window re-sends only the cards pressed meanwhile, and a longer one reads history back to the last id, at most 500 messages, re-sends every open card and adds one gap line above 0.
- [ ] C10. Attachments become the human's artifacts without the token, outbound files go once per remote within Discord's limits, a voice message becomes a 🎤 transcript, and every Discord id is TEXT in `hub.db`.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). Items are written through `cland task` and the task tools, never as hand-written item files.
- **The hub's code.** TypeScript on Node 24 under the hub's tsconfig (`strict`, `erasableSyntaxOnly`, `verbatimModuleSyntax`), so no enums, namespaces or parameter properties. A hand-written client on the pinned `ws` and `fetch`, with the few API v10 shapes it reads vendored as types; no new runtime dependency and no Discord library.
- **Tests.** Test first (`tdd`). The hub's frame protocol is the first seam (`hub/test/harness.ts`), and a fake Discord gateway and REST in `hub/test/fakes/` the second, with sessions that replay on RESUME, `session_start_limit`, rate-limit headers and a control API that plays the human and another member. No test connects to Discord or needs a real token, so the suite runs on droplets as it is.
- **Secrets.** The token leaves the client only in the identify payload and the REST authorization; a CDN download goes without it. A token never appears in argv, a frame, a log line, an error, a journal record or an artifact. Real tokens never go to droplets.
- **The identify budget.** An overrun resets the token for every session of the bot, so the build never identifies in a loop, and the suite never touches Discord.
- **One bot per project.** Every session of a bot receives every event, clicks included (Q-1293), so two hubs on one token would race; the build supports no shared bot. A conflict is reported, never settled by stopping another process.
- **Legacy messages.** Cards stay legacy messages with action rows; Components V2 is deferred to 0.3.x.
- **The prototype.** `prototype/telegram-remote` at 33bf2b2e is never merged. The build may read its code and take what fits, but follows the spec (Q-1297).
- **Plan.** The Coordinator drafts the plan with `plan-epic`, chooses the crew and the models by the project's rules, and approves the plan itself (spec §4).
- **Order.** Blocked by "Remote cards and approvals"; its attachments and voice are blocked by "Media, the upload frame and speech", beside which it runs.

## References

- Spec: `docs/spec/v0.3.md` §3.8 (Discord), with §3.2, §3.4 to §3.6, §3.9 and §3.10 on Discord, §3.12 and §4.
- Items: R-1278; the map M-1286, round-1 decisions 7, 9, 10 and 15; Q-1288 (the Discord facts); Q-1293 (the human's acceptance, the resume window, the two-sessions experiment, the identify guard, TEXT ids, the replies' layout, attachments once per remote); Q-1296 §3 and §12.
- Prototype, on `prototype/telegram-remote` at 33bf2b2e: `hub/src/remote/discord/README.md` (what it settled against real Discord), `discord-remote.ts`, `discord-socket.ts`, `discord-rest.ts`, `discord-markdown.ts`, `discord-types.ts`, `fake-discord.ts` (a fake with a control API that plays the human) and `probe.ts`, all under `hub/src/remote/discord/`; `hub/src/remote/replies.ts`.
- Research: `docs/research/discord-remote.md` on `research/discord-remote` (1f59ae25), 36 rules.
- GLOSSARY: Remote, Remote card and Gap line (added for v0.3).
