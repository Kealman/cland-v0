---
id: T-1400
kind: task
title: "One General message each way: the durable Discord outbox posts with a header and an enforced nonce, and the human's text reaches General"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1397
  - T-1399
topic: null
branch: null
created: 2026-10-27T23:38:45.835Z
updated: 2026-10-27T23:38:59.948Z
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

- [ ] C1. An agent's General message arrives in the paired channel once with the "author · kind" header, a nonce with `enforce_nonce`, suppressed embeds and an empty `allowed_mentions`, and its Discord id is mapped in `remote_messages` before the job counts as sent (test).
- [ ] C2. The paired human's text reaches General as a `message` with `via = "discord"`, is not mirrored back into the channel, and reaches the paired Telegram chat under "you (Discord)" (test).
- [ ] C3. Messages from another member, a bot, a webhook, another channel, a system message type and the bot itself never reach the hub, and a MESSAGE_CREATE delivered twice is handled once (test).
- [ ] C4. The stored last message id advances only after the hub has stored the message (test).

## Notes

Shared files: discord.ts; new hub/src/remote/discord-outbox.ts, discord-inbound.ts; hub/test/fakes/discord/ (gateway MESSAGE_CREATE)
