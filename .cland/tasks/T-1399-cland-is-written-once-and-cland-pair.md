---
id: T-1399
kind: task
title: /cland is written once, and /cland pair pairs a channel through cland remote approve discord
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1398
topic: null
branch: null
created: 2026-10-27T23:38:45.567Z
updated: 2026-10-27T23:38:58.840Z
---

## Summary

The hub writes the global `/cland` command on its first start and afterwards only compares it. `/cland pair` gives the human a private code that lives 15 minutes. `cland remote approve discord <code>` binds the guild, channel and user ids and turns the private reply into "Approved". Anyone else's `/cland` is refused privately, and the ids survive a restart exactly.

## What to build

**The command.** At start, the hub reads the global commands and bulk-overwrites only when the definition differs or is missing. The definition is `cland` with `contexts [0]`, `integration_types [0]` and `default_member_permissions "0"`. Its subcommands are `pair`, `status`, `inbox`, `mute`, `unmute`, `decision` (a required text option), `question` (the same) and `help`.

**The router.** `discord-commands.ts` holds the interaction router, which later tickets extend. Every interaction checks the guild, channel and user against the pairing before anything else. Before pairing, only `pair` is served. The other subcommands answer "Not paired yet: run `/cland pair` in the channel…".

**`pair`.** It must run in a guild text channel. It calls the trusted `pair` callback with the guild, channel and user ids and the display name. The reply is ephemeral (type 4, flag 64) and carries the code text. When the callback returns `null`, the interaction gets no answer.

The interaction token is kept in memory only, keyed to the waiting request, for at most 15 minutes. On approval, the new optional `Remote.pairingApproved(pairing)` hook edits that ephemeral `@original` to "Approved: this channel is paired with <project>". `pairingReplaced` posts one line in the old channel. The paired user's `pair` in the paired channel answers "Paired with <project>"; in another channel it issues a new code, so approval moves the remote there.

**Refusals.** After pairing, another member, or the paired user in another channel, gets a private refusal, and no frame reaches the hub.

**The fake.** It gains global command GET and PUT with a write counter. Its control can create interactions as the human, the other member or an administrator, in either channel. It records callbacks with their type and flags, refuses a callback after 3 seconds under the injected clock (10062) or a second acknowledgement (40060), and accepts webhook edits of `@original` for 15 minutes.

**Contract:** the `Remote` type gains the optional `pairingApproved`, and the dispatcher's control gains `pairingApproved`, called after the `pairing.approve` transaction. The change is additive; Telegram does not implement the hook. Consumers: `Gateway`, `ConfiguredGateway`, the `daemon.ts` wiring, `dispatch.ts`, `hub/test/fakes/messenger.ts`, `legacy-remote-hub.ts`, `held-remote-boundary.ts`, `pairing-approval.test.ts`, `docs/agents/pairing.md` and `hub/README.md`'s pairing contract.

Spec §3.2, §3.8 (the command), §3.10; research rules 28 to 30.

## Acceptance criteria

- [ ] C1. The first hub start writes `/cland` with its eight subcommands, `contexts [0]`, `integration_types [0]` and `default_member_permissions "0"`, a second start writes nothing, and a definition changed on the fake is overwritten once (test).
- [ ] C2. `/cland pair` answers ephemerally within 3 seconds with an 8-character code, the user id and the approve command, the code waits as a Discord pairing row that expires after 15 minutes, and a stranger's third request gets no reply (test).
- [ ] C3. `cland remote approve discord <code>` binds the guild, channel and user ids, prints the paired name and id, and edits the ephemeral reply to "Approved", and the interaction token never reaches `hub.db`, a log line or a frame (test).
- [ ] C4. After pairing, another member's `/cland status` and the paired user's `/cland status` in another channel are refused privately and send no frame to the hub, and a replaced pairing gets one line in its old channel (test).
- [ ] C5. Guild, channel and user ids above 2^53 survive a hub restart as identical TEXT in `hub.db` and in `cland remote status --json` (test).

## Notes

Shared files: new hub/src/remote/discord-commands.ts, discord.ts, hub/src/remote/gateway.ts, configuration.ts, hub/src/hub/dispatch.ts, hub/src/hub/daemon.ts, hub/test/fakes/messenger.ts; hub/test/fakes/discord/ (commands, interactions)
