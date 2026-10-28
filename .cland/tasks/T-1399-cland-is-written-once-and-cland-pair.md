---
id: T-1399
kind: task
title: /cland is written once, and /cland pair pairs a channel through cland remote approve discord
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1398
topic: topic-1134
branch: t/T-1399-cland-is-written-once-and-cland-pair
created: 2026-10-27T23:38:45.567Z
updated: 2026-10-28T02:32:50.843Z
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

- [x] C1. The first hub start writes `/cland` with its eight subcommands, `contexts [0]`, `integration_types [0]` and `default_member_permissions "0"`, a second start writes nothing, and a definition changed on the fake is overwritten once (test).
  - done: impl-1399 · 2026-10-28T02:30:25.789Z
- [x] C2. `/cland pair` answers ephemerally within 3 seconds with an 8-character code, the user id and the approve command, the code waits as a Discord pairing row that expires after 15 minutes, and a stranger's third request gets no reply (test).
  - done: impl-1399 · 2026-10-28T02:25:50.767Z
- [x] C3. `cland remote approve discord <code>` binds the guild, channel and user ids, prints the paired name and id, and edits the ephemeral reply to "Approved", and the interaction token never reaches `hub.db`, a log line or a frame (test).
  - done: impl-1399 · 2026-10-28T02:30:27.108Z
- [x] C4. After pairing, another member's `/cland status` and the paired user's `/cland status` in another channel are refused privately and send no frame to the hub, and a replaced pairing gets one line in its old channel (test).
  - done: impl-1399 · 2026-10-28T02:25:51.317Z
- [x] C5. Guild, channel and user ids above 2^53 survive a hub restart as identical TEXT in `hub.db` and in `cland remote status --json` (test).
  - done: impl-1399 · 2026-10-28T02:25:51.509Z

## Notes

Shared files: new hub/src/remote/discord-commands.ts, discord.ts, hub/src/remote/gateway.ts, configuration.ts, hub/src/hub/dispatch.ts, hub/src/hub/daemon.ts, hub/test/fakes/messenger.ts; hub/test/fakes/discord/ (commands, interactions)

## Comments

### impl-1399 · 2026-10-28T02:19:37.394Z

Rule 20 inventory before implementation: Remote implementers TelegramRemote, DiscordRemote, fake messenger, inline test remotes (gateway/configuration/pairing approval); Gateway -> ConfiguredGateway -> daemon control -> dispatch pairing.approve. Add optional hook; old remotes and held-remote-boundary remain valid, Telegram omits it. Legacy remote hub and remote-cli prior-wire tests unaffected (no wire change). Consumers searched across hub/src, hub/test including T3/T4, web, nvim, .agents, qa and docs: pairing-codes/approval, web-authority, setup remote pairing, remote-workbench, doctor-remotes, gateway, telegram mute/pacing tests; nvim pairing_card and web pairing show the unchanged pairing rows/reply. Persisted state readers and startup probes retain identical pairing schema. Docs consumers pairing.md, hub README and implement skill will document optional notification. No frame/list/schema or authorization change.

### rev-26 · 2026-10-28T02:29:53.905Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1399-source-1
commit: c38194940bb960ea01c5ef0446a0c71acb14e798
scope: full
findings: [{"severity":"medium","text":"M1 Standards: discord-pairing classification unsorted; guide missing index row; changed REMOTE_USAGE missing frozen fixture row. Retain unchanged tier/docs/help guard red/green and migrate owning inputs.","file":"hub/test/tiers.json","line":19},{"severity":"medium","text":"M2 Spec: pairingApproved redacts display name as routing; a newly registered secret matching stored name disables the remote post-grant. Map name through text as pairingReplaced; retain numeric routing collision refusal and content regression.","file":"hub/src/remote/gateway.ts","line":215},{"severity":"medium","text":"M3 Spec: template-key projection ignores extra required options on pair, so changed writable definition can compare equal and is not repaired. Normalize full owned writable definition; actual drift plus metadata-only no-write controls.","file":"hub/src/remote/discord-commands.ts","line":15},{"severity":"low","text":"M4 evidence: successful edit sample is 2999+896000=898999ms, not guide/evidence899999ms. Align last-valid-ms and next-ms expiry or state actual sample.","file":"hub/test/discord-pairing.test.ts","line":140}]
finding_counts: {"high":0,"medium":3,"low":1}

Full consolidated source1 A-13038: Standards1medium+1low, Spec2medium. Native private pairing, expiry/cap, optional hook wiring, old-wire shape, SQL TEXT and isolated REST/ws controls inspected. Local A-13036 4/10 passes/typecheck are targeted claims, not configured/Linux proof. Working-tree red/green fixes are outside reviewed head. C1/C3 failed pending correction; all runtime marks pending. Push consolidated fixes and request fresh source review before verify; no dev merge unless Coordinator directs. QA none.

Criteria: C1 failed (Writable command drift adding a required pair option is ignored by template-only comparison.), C3 failed (Post-grant approval notification can disable the remote when stored display name collides with a newly registered secret.).

### rev-26 · 2026-10-28T02:32:50.843Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1399-source-2
commit: 3f504ffe2e416742c2763c67a4f0c742f86aff81
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full successor source review A-13040 clears M1–M4 at exact pushed 3f504ffe2/tree c5ccd1240. Standards0/Spec0: owning tier/index/frozen-help inputs corrected; approval name mapped through content with numeric collision refusal; full writable command comparison and actual required-option drift/metadata no-write controls; exact899999/900000ms lifetime. Source1 A-13038 retained. A-13037/A-13039 local macOS guard/TDD/typecheck receipts remain targeted, not configured/Linux proof. C1–C5 done but runtime-unverified. Proceed with one mode-free verification at unchanged head and request original-record evidence review; no dev merge unless Coordinator directs. QA none.
