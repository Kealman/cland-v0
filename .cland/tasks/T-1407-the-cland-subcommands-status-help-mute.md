---
id: T-1407
kind: task
title: The /cland subcommands status, help, mute, unmute, decision and question, answered ephemerally and laid out for a phone
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1397
  - T-1399
  - T-1400
topic: topic-1156
branch: t/T-1407-the-cland-subcommands-status-help-mute
created: 2026-10-27T23:38:47.247Z
updated: 2026-10-28T15:40:58.598Z
---

## Summary

The paired human's `/cland status`, `help`, `mute`, `unmute`, `decision` and `question` are answered ephemerally within Discord's 3 seconds, or deferred and completed when an answer takes longer. Replies follow the phone layout, with "This channel" for the remote's own state. Mute silences General in this channel only.

## What to build

**Status and help.** Both render 02's reply model as Discord Markdown: a bold title line, groups under bold labels with one fact per line, sessions as bullets, and the gateway's numbers last as `-#` small text. The numbers are the outbox depth, identifies today and remaining session starts. `help` has short sections, the subcommands as a bullet list and the trust lines last.

**Mute.** `mute` and `unmute` use `applyMute` with the receipt `discord.mute:<interaction id>`. `unmute` answers "N messages arrived while muted", where N counts the General messages held back.

**Decision and question.** They send their text field to General as kind `decision` or `question` with `via = "discord"`, using the interaction id as the ingress message id, and answer "Sent".

**Timing.** An answer that needs more than 2 seconds is deferred ephemerally (type 5, flag 64) and completed by editing `@original`. The router from 04 still refuses anyone but the paired user in the paired channel.

Spec §3.10 (Discord, `/status`, `/help`, the phone layout), §3.4 (mute); Q-1293 (the replies' layout).

## Acceptance criteria

- [ ] C1. `/cland status` answers ephemerally with a title line, bold-labelled groups ending with "This channel", one fact per line, sessions as bullets and the gateway's numbers last as small text, and no line joins facts with middle dots (test).
- [ ] C2. `/cland help` answers ephemerally with short headed sections, the subcommands as a bullet list and the trust lines last (test).
- [ ] C3. `/cland mute` stops General in the channel, a replayed mute interaction applies once, and `/cland unmute` answers "N messages arrived while muted" with the count held back (test).
- [ ] C4. `/cland decision` and `/cland question` send their text to General with that kind and `via = "discord"` (test).
- [ ] C5. A subcommand whose answer takes longer than 2 seconds under the injected clock is deferred ephemerally before 3 seconds and completed by editing the original response (test).

## Notes

Shared files: discord-commands.ts

## Comments

### impl-1407 · 2026-10-28T15:40:58.598Z

Consumer inventory before changes (rule 20): searched hub/src, hub/test (all manifest tiers), web/, nvim/, docs/agents/, .agents/skills. Existing frames stay unchanged: hub.status and task.list summary consumed by Telegram commands, Gateway's frame authority, both workbenches and harness startup probes; topic.send ingress consumed by Gateway/General with existing RemoteIngress deduplication. DiscordCommands is constructed only by DiscordRemote; native callback/editOriginal consumers are DiscordCommands, discord-pairing.test.ts and discordExchangeOwner. Plan additive ephemeral defer API, preserving callback/edit signatures and legacy Remote start injection. PhoneReply/statusReply/helpReply consumers: telegram-commands.ts and remote-neutral.test.ts; keep models unchanged. applyMute/suppressMutedMessage consumers: TelegramRemote, remote-neutral.test.ts and Telegram mute tests; keep receipt/storage shape unchanged, add discord.mute:<interaction id>. Discord pairing tests retain foreign-user/channel and unpaired refusals. New production frame/fake REST/ws test file will prove rendered status/help, native private callbacks, mute receipts/count, ingress kinds/via/id and deferred original edits. No new frame shape, role authority or persisted schema; no workbench/old-hub migration needed.
