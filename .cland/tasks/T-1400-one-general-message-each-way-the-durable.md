---
id: T-1400
kind: task
title: "One General message each way: the durable Discord outbox posts with a header and an enforced nonce, and the human's text reaches General"
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1397
  - T-1399
topic: topic-1135
branch: t/T-1400-one-general-message-each-way-the-durable
created: 2026-10-27T23:38:45.835Z
updated: 2026-10-28T03:29:45.742Z
closed: 2026-10-28T03:29:45.742Z
---

## Summary

An agent's General message reaches the paired channel once, through a durable outbox whose sends carry an enforced nonce and whose message ids are stored before a send counts as done. The paired human's text in the channel reaches General as their message with `via = "discord"`. Every other author is ignored silently.

## What to build

**Out.** `DiscordOutbox` wraps the neutral `Outbox` with one lane per channel; ticket 09 adds bucket pacing. Every create carries:
- a nonce derived from the job (at most 25 characters) with `enforce_nonce`;
- the empty `allowed_mentions`;
- `SUPPRESS_EMBEDS`.

The attempt is recorded before the send. The returned id is written to `remote_messages` (the channel id as `chat_id`) in the same write that marks the job sent. `prove` follows the assumption above: the nonce seen on the bot's own MESSAGE_CREATE, else a same-nonce re-send inside the window, else `uncertain`. General messages go out through `mirrorOut` with the header line and plain text; ticket 10 renders Markdown.

**In.** A MESSAGE_CREATE counts only when all of these hold:
- it is in the paired channel, from the paired user;
- it is not from a bot or a webhook;
- its type is 0 or 19.

It becomes `topic.send` into General, kind `message`, through the gateway's ingress (channel id, message id). The stored cursor `discord.lastMessageId` advances only after the hub has stored the message. Events are deduplicated by message id. The bot's own messages and everything else are dropped without a reply and logged by ids only.

Spec §3.4 (out, in), §3.8 (inbound, REST), §3.9 (store, then confirm); research rules 21, 31.

## Acceptance criteria

- [x] C1. An agent's General message arrives in the paired channel once with the "author · kind" header, a nonce with `enforce_nonce`, suppressed embeds and an empty `allowed_mentions`, and its Discord id is mapped in `remote_messages` before the job counts as sent (test).
  - done: impl-1400 · 2026-10-28T03:06:52.370Z
  - verified: rev-26 [reviewer] · run rev-20261028-1400-evidence-1 · 2026-10-28T03:23:38.978Z · commit 5deacdd03e53fba959941615870ed10e490fe1cb
- [x] C2. The paired human's text reaches General as a `message` with `via = "discord"`, is not mirrored back into the channel, and reaches the paired Telegram chat under "you (Discord)" (test).
  - done: impl-1400 · 2026-10-28T03:00:40.785Z
  - verified: rev-26 [reviewer] · run rev-20261028-1400-evidence-1 · 2026-10-28T03:23:38.979Z · commit 5deacdd03e53fba959941615870ed10e490fe1cb
- [x] C3. Messages from another member, a bot, a webhook, another channel, a system message type and the bot itself never reach the hub, and a MESSAGE_CREATE delivered twice is handled once (test).
  - done: impl-1400 · 2026-10-28T03:00:41.134Z
  - verified: rev-26 [reviewer] · run rev-20261028-1400-evidence-1 · 2026-10-28T03:23:38.979Z · commit 5deacdd03e53fba959941615870ed10e490fe1cb
- [x] C4. The stored last message id advances only after the hub has stored the message (test).
  - done: impl-1400 · 2026-10-28T03:00:41.238Z
  - verified: rev-26 [reviewer] · run rev-20261028-1400-evidence-1 · 2026-10-28T03:23:38.979Z · commit 5deacdd03e53fba959941615870ed10e490fe1cb

## Notes

Shared files: discord.ts; new hub/src/remote/discord-outbox.ts, discord-inbound.ts; hub/test/fakes/discord/ (gateway MESSAGE_CREATE)

## Comments

### impl-1400 · 2026-10-28T02:57:22.121Z

Consumer inventory before implementation (rule 20): searched hub/src remote gateway, messenger factory, Discord API/socket/commands, neutral Outbox/RemoteStore, Telegram inbound/mirror; hub/test all tiers and fakes; docs/agents/tests, shipped implement skill, QA briefs and startup probes. No shared wire/schema change planned: existing Remote.start/receive, RemoteSend ingress and result frames remain unchanged, optional native handlers remain first. New private Discord outbox payload/receipt and discord.lastMessageId keys only; existing remote-cli prior-hub and gateway injected-client regressions remain unaffected. Native Discord dispatch consumers: DiscordCommands and injected options.handlers must retain existing behavior. Mirror consumers Telegram and Discord reuse mirrorOut; Telegram cross-remote projection tested. Seams: production frame port with loopback REST/ws fake (authorized by epic), plus native durable outbox/fake receipt recovery.

### rev-26 · 2026-10-28T03:05:13.836Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1400-source-1
commit: 626e4b5372e243c1a00a14906b919e3a7e9248a1
scope: full
findings: [{"severity":"medium","text":"M1 Standards/rule16: new Discord messages guide missing owning index row; preserve unchanged guard red/green and add row.","file":"docs/agents/tests/index.md"},{"severity":"medium","text":"M2 Standards/rules9/12: bounded held observer can reject before fault setup returns and before await attaches a handler; disposer does not cancel/join it. Pre-own/catch/cancel/join observer/setup/send, add omitted/aborted setup controls with same owner; retain durable assertions.","file":"hub/test/discord-messages.test.ts","line":147},{"severity":"medium","text":"M3 Standards/cancellation: startup resume REST uses only private abort; Gateway stop aborts supplied signal then joins startup before private abort. Held replay ignores cancellation until35s API timeout. Link replay cancellation before join and prove native drainage/no late writes.","file":"hub/src/remote/discord.ts","line":41},{"severity":"medium","text":"M4 Spec3.9: prove invokes deliver directly for a recovery POST without new durable attempt fence. Record each recovery send separately; original uncertain-send timestamp must anchor nonce eligibility. Held recovery POST must show persisted attempt before release, retaining one message/atomic settlement.","file":"hub/src/remote/discord-outbox.ts","line":38}]
finding_counts: {"high":0,"medium":4,"low":0}

Full consolidated source1 A-13047: Standards3medium,Spec1medium. C2–C4 ingress/result/cursor/exclusion paths and outbound atomic mapping/filter inspected; no runtime marks. A-13045 five localmac T2/typecheck summary is not configured/Linux proof. All four findings delivered; working-tree fixes outside reviewed head. Push consolidated corrections and request fresh source review before verification, restore C1 done with attempt control; no dev merge unless Coordinator directs. QA none.

Criteria: C1 failed (Safe same-nonce recovery POST bypasses a distinct durable attempt fence before I/O.).

### rev-26 · 2026-10-28T03:08:34.666Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1400-source-2
commit: 5deacdd03e53fba959941615870ed10e490fe1cb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full successor source review A-13049 clears M1–M4 at exact pushed5deacdd03/tree473207dc. Standards0/Spec0: owning guide index; retained/caught/cancelled/joined observer/setup/send ownership and omitted/aborted controls; startup replay abort propagation/native drainage; distinct recovery attempt before REST with first-attempt eligibility and final I/O guard. Original C1–C4 assertions retained; no wire/schema/authority change. A-13046/A-13048 localmac8T2/docs/typecheck/TDD remain targeted, not configured/Linux proof. C1–C4 done, runtime-unverified. One mode-free verify at unchanged head then original-record evidence review; no dev merge unless Coordinator directs. QA none.

### rev-26 · 2026-10-28T03:23:38.979Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1400-evidence-1
commit: 5deacdd03e53fba959941615870ed10e490fe1cb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final A-13051 independently checks original same-head A-13050/bb12355b:3832 ordinary passes+65 separate load passes,0 fails/skips/cancel/unfinished;40 load passes are eight Discord message cases each5/5,25site docs. Exact C1–C4 native mirror/ingress/cursor/dedup and correction ownership/cancellation/recovery-attempt records pass; source2A-13049 unchanged. Maxnewbase.353558726s/load.426075348s<3s. T0/allT1/fallbackallT2/Web complete; T3/T4 absent, integrated cover separate. Linux6.8x64 c8lon1 Node24.21/Nvim.12.5 HS156/r1248, hostgate950ec276 reused/notremote. Budgets/lint134/61files/7missingbaseline/incompleteT3 census remain report-only. Lifetime742s/$0.0515infra. QA none; Coordinator additional cover/enqueue after fresh conflict check, head frozen.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-28T03:29:45.742Z

Merged ed1c2db851c30f0d7cf5da7fb15b3214a6cedac8 onto dev.
