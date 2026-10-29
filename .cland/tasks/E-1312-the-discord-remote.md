---
id: E-1312
kind: epic
title: The Discord remote
state: closed
criterion_seq: 10
labels:
  - epic
  - v0.3
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by:
  - E-1310
topic: topic-1174
branch: null
created: 2026-10-25T14:11:59.875Z
updated: 2026-10-29T10:37:51.532Z
closed: 2026-10-29T10:37:51.532Z
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
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1312 · 2026-10-29T10:37:30.682Z · commit 5a4477bd86842c0ab5edf5d8237b68a33baf8b2b
- [ ] C2. The socket uses intents 33281 on API v10, detects a zombie connection and resumes, and gives a 4003 one fresh identify.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1312 · 2026-10-29T10:37:30.682Z · commit 5a4477bd86842c0ab5edf5d8237b68a33baf8b2b
- [ ] C3. Identifies are at least 5 seconds apart, resume comes first, back-off follows only identifies that never reached READY, the floor of remaining starts holds, and the human is warned at 500 in a day.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1312 · 2026-10-29T10:37:30.682Z · commit 5a4477bd86842c0ab5edf5d8237b68a33baf8b2b
- [ ] C4. `/cland` is one global command with its eight subcommands, written once and then only compared, answered ephemerally and laid out for a phone screen.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1312 · 2026-10-29T10:37:30.682Z · commit 5a4477bd86842c0ab5edf5d8237b68a33baf8b2b
- [ ] C5. `/cland pair` gives a private code for 15 minutes, approval binds the guild, channel and user ids, and other members' messages are ignored and their clicks refused privately.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1312 · 2026-10-29T10:37:30.682Z · commit 5a4477bd86842c0ab5edf5d8237b68a33baf8b2b
- [ ] C6. General is mirrored both ways in Discord's Markdown with an empty `allowed_mentions`, fence-safe splits at 2000 code points and the reactions, and inbound counts only from the paired channel and user.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1312 · 2026-10-29T10:37:30.683Z · commit 5a4477bd86842c0ab5edf5d8237b68a33baf8b2b
- [ ] C7. Cards take spec §3.5's Discord form, a click is answered within 3 seconds by one update to the outcome, modals take free answers and declines, and one gate holds across Discord, Telegram and the workbenches.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1312 · 2026-10-29T10:37:30.683Z · commit 5a4477bd86842c0ab5edf5d8237b68a33baf8b2b
- [ ] C8. REST follows its rate-limit headers with no 429 in a burst, never repeats a 401, 403 or 404, and a send retried with its enforced nonce posts once.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1312 · 2026-10-29T10:37:30.683Z · commit 5a4477bd86842c0ab5edf5d8237b68a33baf8b2b
- [ ] C9. A restart within the resume window re-sends only the cards pressed meanwhile, and a longer one reads history back to the last id, at most 500 messages, re-sends every open card and adds one gap line above 0.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1312 · 2026-10-29T10:37:30.683Z · commit 5a4477bd86842c0ab5edf5d8237b68a33baf8b2b
- [ ] C10. Attachments become the human's artifacts without the token, outbound files go once per remote within Discord's limits, a voice message becomes a 🎤 transcript, and every Discord id is TEXT in `hub.db`.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1312 · 2026-10-29T10:37:30.683Z · commit 5a4477bd86842c0ab5edf5d8237b68a33baf8b2b

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

## Plan

```yaml
stages:
  - name: socket, pairing and one message
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1396
        - T-1398
        - T-1399
        - T-1400
      - - T-1397
  - name: the budget, close codes, REST pacing, the mirror and the commands
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1401
        - T-1402
        - T-1403
      - - T-1404
      - - T-1405
      - - T-1406
      - - T-1407
  - name: cards and modals
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1408
        - T-1409
        - T-1410
        - T-1411
  - name: resume and history catch-up
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1412
        - T-1413
  - name: attachments and voice
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1414
      - - T-1415
```

## Comments

### coord · 2026-10-27T23:39:09.819Z

Plan and decisions (coord, 2026-10-28 00:1xZ). Tickets T-1396–T-1415 from the draft A-12924 (coord's sub-agent, against dev c675faa3). Five stages: the draft's stages 2 and 3 are merged (independent lanes), saving one Linux+macOS cover pair; the epic's QA demo runs on dev after the last stage.
- Transport: hand-written on the pinned `ws` 8.21.3 (already a hub runtime dependency, named in spec §3.8) and fetch; no new dependency.
- T-1397 is a behaviour-preserving prefactor that moves the gap line, the General mirror filter, phone replies, the mute receipt and the card order out of telegram*.ts into neutral modules. It lands before E-1311's stage-2 Telegram lanes (T-1385, T-1387) start.
- Shared contracts (rule 20): T-1398 (messenger factory, cland remote help and status), T-1399 (Remote gains an optional pairingApproved hook), T-1401 (RemoteStopCause gains interactions-endpoint, gateway-refused, identify-budget; T-1372 reads them).
- Open, awaiting the human (ask 62b8d32f): Discord attachments and voice (T-1414, T-1415) stay here as the last stage, blocked by E-1311, or move to 0.3.x. Both tickets are held until the answer.
- Downstream: T-1371 (setup) needs T-1396 and T-1398; T-1372 (doctor, Remotes row) needs T-1401 and T-1402; both stay blocked by E-1312 as filed.

### coord · 2026-10-28T05:05:34.064Z

Decision (human, ask 62b8d32f, 2026-10-28 05:04Z): all three recommendations accepted. (1) Each artifact goes to a remote once ever; a later message re-attaching it replies to the earlier file with '▣ A-n … (sent above)'. (2) A voice note answering a card answers through its transcript and keeps no audio artifact; a note that cannot answer leaves the ask open and goes to General as an ordinary 🎤 message. (3) Discord attachments and voice stay in E-1312 as its last stage, blocked by E-1311. Held tickets T-1387, T-1390, T-1414, T-1415 are released. T-1378 (non-text Telegram updates stall the poller) joined 0.3 on the human's word (ask 82ff046e) and lands before T-1385, which builds on it.

### hub · 2026-10-29T10:20:16.079Z

demo 89dfff9b-d2f8-4f91-b7ca-e0dcb4a76e7f created: droplet cland-v0-89dfff9b, commit 5a4477bd86842c0ab5edf5d8237b68a33baf8b2b, deadline 2026-10-29T11:33:22.097Z.

### hub · 2026-10-29T10:31:55.340Z

demo 89dfff9b-d2f8-4f91-b7ca-e0dcb4a76e7f destroyed: lifetime 797505 ms; cost $0.0554.

### qa-677 · 2026-10-29T10:37:30.683Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-dod-2026-10-29-677-1312
commit: 5a4477bd86842c0ab5edf5d8237b68a33baf8b2b
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| case | surface / executor | result | observation and evidence |
| --- | --- | --- | --- |
| M1 (C1) | hub-api / droplet + local source | PASS | 38 messenger + 12 doctor cases passed; General cause/fix traced through scoped stop, persistence callback, daemon General notice and shared wording. General text is source evidence. discord-messenger.test.ts, doctor-remotes.test.ts; source-checks.json |
| M2 (C2) | hub-api / droplet + local source | PASS | Heartbeat, zombie, resume and one-fresh-4003 assertions passed. Source identifies intents 33281 and REST API v10. discord-messenger.test.ts; source-checks.json |
| M3 (C3) | hub-api / droplet | PASS | Identify spacing, count persistence, equal-jitter delays, floor and 500th warning passed on the injected clock. discord-messenger.test.ts |
| M4 (C4) | hub-api / droplet + local source | PASS | Global registration/restart comparison, private commands and bounded phone replies passed. Eight subcommands: pair, status, inbox, mute, unmute, decision, question, help. discord-pairing.test.ts, discord-commands.test.ts; source-checks.json |
| M5 (C5) | hub-api / droplet | PASS | Pairing expiry, TEXT restart persistence, foreign click refusal and paired-only input assertions passed. discord-pairing.test.ts, discord-cards.test.ts, discord-messages.test.ts |
| M6 (C6) | hub-api / droplet | PASS | Markdown, safe splits, mention suppression, durable mapping, replies and both reaction restart modes passed. discord-render.test.ts, discord-messages.test.ts, discord-api.test.ts |
| M7 (C7) | hub-api / droplet + local source | PASS | Cards, modal outcomes, one gate and both workbench answer paths passed. Neovim ran (1/1, no skip). Card source matches spec §3.5 (five options/row, 34-character numbering threshold, at most three rows, modal paragraph 4000, defer 2 s). discord-cards.test.ts, gateway.test.ts, nvim/test/remote-via.test.ts; source-checks.json |
| M8 (C7) | web-terminal / droplet | PASS | Web pairing 4 top-level + 1 nested test and Web remote-via 2 tests passed. Source, built and served stamp match; printed names retained in required-case-audit.json and logs. web/test/pairing.test.ts, web/test/remote-via.test.ts; web-stamp.log |
| M9 (C8) | hub-api / droplet | PASS | Header pacing, callbacks bypass, capped/global 429 delays, terminal statuses and durable nonce retry assertions passed. discord-api.test.ts, discord-messages.test.ts |
| M10 (C9) | hub-api / droplet + local source | PASS | All 8 T3 cases passed alone. Full-scale 500/620: 22.658880466 s < 45 s; native kill: 6.528050430 s < 10 s. Card resume/history cases passed; source limit 500. discord-cards.test.ts, telegram-polling-restart.test.ts; source-checks.json |
| M11 (C10) | hub-api / droplet | PASS | Inbound media 14/14 and outbound artifacts 13/13 passed, including byte/file limits, once-per-remote, redirects, voice and lost multipart receipt. discord-inbound-media.test.ts, discord-artifacts.test.ts |
| M12 (C4,C5,C6,C10) | hub-api / local macOS source | PASS | All required source lines present: platform identifier TEXT columns, invite permissions=117824, ephemeral flags 64, empty allowed_mentions, paired channel/user filter. source-checks.json |
| M13 (C1–C10) | hub-api / local macOS record audit | PASS | All 20 children closed done, clear hub reviews + green same-reviewed-head receipts, Item/Reviewed-by landing trailers and cover ancestry. Five stages closed; corrected final cover pair green. C1-final.json; T-1396-landing-reconciliation.json; C2-cover-receipts.json; epic.json |

qa clear E-1312. No high, medium or low findings. C1–C10 verified by qa-dod-2026-10-29-677-1312 at 5a4477bd86842c0ab5edf5d8237b68a33baf8b2b.

The 15 declared files ran sequentially on the demo: 250 top-level + 1 nested native test passed; 0 failed/cancelled/skipped/todo. A supplemental Web stamp probe passed (1). Web built first. Required generated names, source-file hashes, source excerpts and redacted native logs are retained. Reused results are counted once. Commands: Node v24.21.0 --test <file>, via cland demo exec E-1312; source/record audits used the clean detached pinned checkout on local macOS. No product edits or full suites ran in this QA demo.

Runtime: Linux x64 droplet, Node v24.21.0, Neovim v0.12.5, Chrome Headless Shell 156.0.8078.4, Playwright revision 1248. Browser binary: /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell. The browser used a scratch user-data-dir; fixtures used sealed HOME/XDG/Git through the shared builder with provider/account filtering. Fake Discord, Telegram and speech only. Browser cleanup censuses ended at zero. Source, bundle and served page stamp all equal 4a468700a6e84eccb05877ab9f8a1e9f9b482457bfb93e3d94346fa0a9f610c2 (web-stamp.log).

M10 ran alone on the exclusive demo executor, with no concurrent suite or targeted file. Before it, a 1-second /proc/stat sample showed 99.2518703% CPU idle, load averages 0.34/0.33/0.15. Full-scale history: 22.658880466 seconds against 45; native kill: 6.528050430 against 10. Native case durations exclude provisioning, transport, preceding cases, CPU sample and teardown outside the cases. Both allowances passed on the first run.

Covers were read, not rerun: Linux d7f17125/A-13645 and macOS 781f8b3c/A-13643 at a9314b5a3b210f7721991ec4d86f56292d8e46d4, verification tree a1caa13d33a8f786624a08ad858c77901225e320. Their static gate and T1–T4 plus Web receipts are green; Linux's static gate was host npm run check, not a remote typecheck. Native summaries: Linux 5635 passes/9 skips and macOS 5643 passes/1 skip, 0 failures. All 250 scoped top-level identities passed on both, with no scoped skip. Native totals and separate load repetitions are retained in cover-summary.json. Duration budgets and Web repetition gate were report-only. T4 repetitions were explicitly excluded (14 base-only files); excluded repetitions are not passes. Linux cover machines were c-8 nyc1: lifetimes 1808.467 and 1586.727 seconds; costs $0.1255879861 and $0.110189375, total $0.2357773611. Admission-to-remote-finish durations were 1828.15 and 1612.15 seconds; these are not a summed wall time. macOS had no droplet cost.

Every child has a clear hub review, a same-reviewed-head green verify and the reviewed delta landed on dev; branch and integration SHAs differ. All 20 children are closed done, all five stages closed, and the cover head contains all landings including T-1415. The strict patch audit initially flagged T-1396; every nonblank delta matches and only one CHANGES blank line was omitted at integration. T-1407 uses its later valid pre-landing receipt 20cd6379/A-13429. No waiver was required. The raw initial audit and reconciliation are retained.

The Web pairing parser initially counted top-level lines only; its unchanged log and derived audit retain the nested cleanup PASS. Two public test-label fragments were masked by broad credential registration; original name hashes confirm their generated identities. These are capture/extraction corrections, not product failures or reruns.

Source-only evidence is labelled: General stop notice cause/fix wiring, intents/API version, card layout, eight subcommands, history cap 500, TEXT schema, invite117824, ephemeral/mention fields and paired filter. General wording was not asserted by a runtime case. All brief-required source checks are present. Real platforms, real credentials, human-browser flow, E-1313 setup/rows and T-1433/T-1436 follow-ups remain out of scope.

Freshness current:true. Demo lease 89dfff9b-d2f8-4f91-b7ca-e0dcb4a76e7f, deadline 2026-10-29T11:33:22.097Z, pinned commit 5a4477bd86842c0ab5edf5d8237b68a33baf8b2b. Confirmed released before verdict; final lifetime 797505 ms and cost $0.055382291666666666. Final accounting comes from demo-stop.json; earlier active status was an estimate.

Evidence: A-13649, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13649-e-1312-dod-qa-clear-at-5a4477bd-evidence-and-receipts/report.md. All 13 recorder rows are in runs.jsonl. Publication scan passed across 67 declared files and 340 fixture-source dependencies with positive controls; no credential matches.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified, C9 verified, C10 verified.

### coord · 2026-10-29T10:37:51.532Z

The Discord remote is complete. All five stages closed with green cover pairs; the last was d7f17125 (Linux, A-13645) and 781f8b3c (macOS, A-13643) at a9314b5a. QA DoD clear: qa-dod-2026-10-29-677-1312 at 5a4477bd, M1–M13 PASS, C1–C10 verified, no findings (A-13649, brief qa/briefs/E-1312.md). Follow-ups outside this epic: T-1436 (batched durable commits for history catch-up), T-1437 (test-lint message for a lost T3 header) and T-1433 (album transcripts). History allowances (45 s full-scale, 10 s native kill) are owned by R-1278.
