---
id: Q-1296
kind: question
title: "Grilling: catch-up, noise, limits and failure modes"
state: closed
labels:
  - wayfinder:grilling
assignee: cland-design
parent: M-1286
blocked_by:
  - Q-1288
  - Q-1292
topic: null
branch: null
created: 2026-10-25T10:24:46.289Z
updated: 2026-10-25T13:01:22.210Z
closed: 2026-10-25T13:01:22.210Z
---

## Question

After the prototypes (map M-1286): the catch-up policy after hub or gateway downtime for each messenger, the outbound queue and its persistence, rate limiting and backoff, splitting rules, the "missed N messages" line, mute semantics, duplicate and echo protection, what the human sees when a token is wrong or revoked or the network is down (doctor, General, the workbench), reconnect behaviour across the frequent hub restarts of this project, and the Discord-specific rules (one bot across projects, command registration scope).

## Comments

### human · 2026-10-25T13:01:22.026Z

## Resolution (2026-10-25, grilling round 4; the human accepted every recommendation)

1. **Catch-up policy.** First what the messenger held, late messages marked with the time they were typed; then one gap line, cards for open asks the chat never got, outcome edits that did not go through. When the outage outlasted 150 s (Telegram) or RESUME failed (Discord), every open card is re-sent at the bottom with "a button pressed then may have been lost; press again" and the old card says "↓ below". A late message never answers an ask automatically.
2. **Outbox.** A durable queue per messenger in hub.db; an "attempt" record is written before sending; only what provably never left is retried (Discord: `nonce` with `enforce_nonce`; Telegram: the message map); edits are merged; during an outage jobs are not dropped but marked missed and counted in the gap line (unlike the prototype); jobs whose source closed are removed.
3. **Limits and backoff.** One queue per chat with one request in flight, about one message per second in Telegram; in Discord one lane per bucket and channel following `X-RateLimit-*`; a 429 waits `retry_after` capped at 5 minutes; backoff with jitter and a cap; an identify budget (at least 5 s apart, RESUME before IDENTIFY, a daily counter that warns the human at 500); commands are registered only when the list changed, in both messengers.
4. **Noise.** Progress notes and hub notices are silent, everything else notifies; `/mute` silences the General stream while cards always arrive; `mute_default` in the config; `/unmute` posts one line "N messages arrived while muted".
5. **Duplicates and echo.** Dedupe by `update_id` and (chat, message_id) in Telegram, by message id and interaction id in Discord; the bot's own messages are dropped; the human's messages are not mirrored back, the 👌 and 👀 reactions replace the echo; the first answer wins everywhere and every other copy of the card loses its buttons.
6. **One poller per token.** A lease in hub.db with pid and start time; a 409 at start is waited out for up to 60 s and nothing is killed; a persistent 409 shows as "another consumer of the token" in doctor, General and `cland remote status`.
7. **Liveness from traffic.** Telegram: the poll loop restarts when getUpdates has not returned for timeout plus 15 s; Discord: a missed heartbeat ACK leads to terminate and RESUME; "connected" is shown only after a recent successful exchange.
8. **Telling the human.** After a 3-minute grace period the hub writes to General "Telegram remote offline since …: <reason>", then a recovery line; the Remotes row in the workbench turns red at once; doctor shows the state; the chat gets the gap line on recovery. A revoked token (401), a blocked bot (403) and Discord's fatal close codes (4004, 4010–4014) stop the gateway with the reason and the action in General.
9. **Hub restarts.** The gateway starts with the hub, cursors and the lease come from hub.db, Discord resumes if the window has not passed; a restart sends nothing to the chat except the gap line when N > 0 and the re-sent cards after 150 s.
10. **Aide and threads.** There is no `@aide` mention, in the web or in a remote; from the phone the Aide is addressed by name (`@aide-1`) and launched by asking the Coordinator. A reply to a 📥 notice goes to its topic, but the mirror does not follow the thread: only cards and 📥 notices, no mirroring of another topic in 0.3.
11. **`via` on ask outcomes.** The hub records `via` in an ask's outcome as it does for approvals, so a card says exactly where the ask was answered.
12. **Discord specifics.** One bot per project; `/cland` is global with subcommands, `decision` and `question` are subcommands with a text argument (a message starting with a slash is taken as a command by Discord); a 4014 gets a plain explanation about the intent in doctor and General; history is caught up with `before` pages back to the last id, capped at 500; clicks during an outage are lost and cards are re-sent as in Telegram. Discord ids exceed JavaScript's safe integers and are stored as strings.
13. **Two refinements.** The glossary term is **Remote card** (Card is taken by the Explorer's item card). Approving a pairing grants new access like `web.link`: allowed from Neovim (an inbox card) and the CLI, refused from the web and from remotes; the web shows the request with "approve in the terminal or Neovim".
