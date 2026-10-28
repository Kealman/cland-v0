---
id: T-1407
kind: task
title: The /cland subcommands status, help, mute, unmute, decision and question, answered ephemerally and laid out for a phone
state: open
status: ready
size: M
criterion_seq: 5
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
updated: 2026-10-28T19:12:20.065Z
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

- [x] C1. `/cland status` answers ephemerally with a title line, bold-labelled groups ending with "This channel", one fact per line, sessions as bullets and the gateway's numbers last as small text, and no line joins facts with middle dots (test).
  - done: impl-1407 · 2026-10-28T17:57:51.432Z
  - verified: rev-26 [reviewer] · run rev-20261028-1407-evidence-2 · 2026-10-28T19:12:19.895Z · commit f8c14a467533289ca1c918e7bbb2ac1ce9f725a8
- [x] C2. `/cland help` answers ephemerally with short headed sections, the subcommands as a bullet list and the trust lines last (test).
  - done: impl-1407 · 2026-10-28T17:11:04.689Z
  - verified: rev-26 [reviewer] · run rev-20261028-1407-evidence-2 · 2026-10-28T19:12:19.895Z · commit f8c14a467533289ca1c918e7bbb2ac1ce9f725a8
- [x] C3. `/cland mute` stops General in the channel, a replayed mute interaction applies once, and `/cland unmute` answers "N messages arrived while muted" with the count held back (test).
  - done: impl-1407 · 2026-10-28T17:11:05.093Z
  - verified: rev-26 [reviewer] · run rev-20261028-1407-evidence-2 · 2026-10-28T19:12:19.895Z · commit f8c14a467533289ca1c918e7bbb2ac1ce9f725a8
- [x] C4. `/cland decision` and `/cland question` send their text to General with that kind and `via = "discord"` (test).
  - done: impl-1407 · 2026-10-28T17:11:05.504Z
  - verified: rev-26 [reviewer] · run rev-20261028-1407-evidence-2 · 2026-10-28T19:12:19.895Z · commit f8c14a467533289ca1c918e7bbb2ac1ce9f725a8
- [x] C5. A subcommand whose answer takes longer than 2 seconds under the injected clock is deferred ephemerally before 3 seconds and completed by editing the original response (test).
  - done: impl-1407 · 2026-10-28T17:11:05.866Z
  - verified: rev-26 [reviewer] · run rev-20261028-1407-evidence-2 · 2026-10-28T19:12:19.895Z · commit f8c14a467533289ca1c918e7bbb2ac1ce9f725a8

## Notes

Shared files: discord-commands.ts

## Comments

### impl-1407 · 2026-10-28T15:40:58.598Z

Consumer inventory before changes (rule 20): searched hub/src, hub/test (all manifest tiers), web/, nvim/, docs/agents/, .agents/skills. Existing frames stay unchanged: hub.status and task.list summary consumed by Telegram commands, Gateway's frame authority, both workbenches and harness startup probes; topic.send ingress consumed by Gateway/General with existing RemoteIngress deduplication. DiscordCommands is constructed only by DiscordRemote; native callback/editOriginal consumers are DiscordCommands, discord-pairing.test.ts and discordExchangeOwner. Plan additive ephemeral defer API, preserving callback/edit signatures and legacy Remote start injection. PhoneReply/statusReply/helpReply consumers: telegram-commands.ts and remote-neutral.test.ts; keep models unchanged. applyMute/suppressMutedMessage consumers: TelegramRemote, remote-neutral.test.ts and Telegram mute tests; keep receipt/storage shape unchanged, add discord.mute:<interaction id>. Discord pairing tests retain foreign-user/channel and unpaired refusals. New production frame/fake REST/ws test file will prove rendered status/help, native private callbacks, mute receipts/count, ingress kinds/via/id and deferred original edits. No new frame shape, role authority or persisted schema; no workbench/old-hub migration needed.

### rev-26 · 2026-10-28T17:56:08.288Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1407-source-1
commit: 41b3ebc635d4b2301053520f5df8fedca2da459f
scope: full
findings: [{"severity":"medium","text":"M1 Standards: new hub-test-discord-commands.test.ts.md is missing from the per-test index, so the unchanged test-docs membership guard rejects the branch. Add only the owning row and retain original red/green receipts.","file":"docs/agents/tests/index.md"},{"severity":"medium","text":"M2 Spec: renderReply/status/help can exceed Discord's 2000-code-point content budget, but #answer sends the entire result as one callback or original edit. Valid long project/session/release facts can therefore lose the private answer. Implement bounded ephemeral output preserving required groups/footer and literal facts; enforce callback/edit/followup limits in the fake and cover immediate and deferred long status.","file":"hub/src/remote/discord-commands.ts","line":44}]
finding_counts: {"high":0,"medium":2,"low":0}

A-13393 full source1 NOT CLEAR: M1 missing per-test index entry; M2 unbounded private content and fake interaction branch bypassing native size checks. Existing neutral layout, rolling identify counts/platform remaining, mute/replay, ingress/stored Sent and owned deferral/stop flows inspected. No reviewer workloads run, runtime criteria unverified. Consolidated audit complete; fresh pushed corrected source review required before verification.

Criteria: C1 failed (Valid long status text exceeds the native callback/original-edit content budget and can lose the ephemeral answer.).

### impl-1407 · 2026-10-28T17:57:36.790Z

Source1 M1/M2 corrections: added owning test-guide index row; unchanged test-docs guard red 2/3 -> green3/3, A-13392 retains actual output. Added bounded PhoneReply pages preserving Unicode/escape atoms, ordered groups and final footer; first page callback/original edit, further pages private webhook followups (no replay). Fake now enforces 2000 code points for callback/edit/followup; immediate and deferred long-status regressions first red with missing native footer (7pass2fail), now green. Callback/edit API signatures retained; additive followup method consumed only by DiscordCommands and discordExchangeOwner. Additive fake per-interaction followups array leaves existing pairing/API consumers unchanged. No protocol/storage/role change. Existing SKILL/CHANGES entries retained without additions per Coordinator. No dev merge after source1.

### rev-26 · 2026-10-28T17:59:29.547Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1407-source-2
commit: 2b49ec1848b0c9f5fb16bd78e02d6329246247c0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13394 full source2 clear resolves M1/M2: owning guide index and bounded literal PhoneReply pages; private awaited callback/edit/followup transport, flags/mention suppression, exact native 2000/2001 boundary and immediate/deferred long status controls inspected. Existing short layout, mute/replay, ingress/stored Sent, compatibility and shutdown assertions preserved. No reviewer workloads run. C1–C5 remain unverified until exact-head configured original runtime evidence; Coordinator integrated/full coverage stays separate.

### rev-26 · 2026-10-28T18:25:10.667Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1407-evidence-1
commit: 2b49ec1848b0c9f5fb16bd78e02d6329246247c0
scope: evidence
findings: [{"severity":"medium","text":"Configured 2b6968fd/A-13396 interrupted exit124: two reaction-restart failures plus cursor-restart cancellation and hung worker. T2 incomplete; Web/T3/T4 absent. Ten command base cases plus 50 scoped repeats passed, but no overall passing runtime verification exists.","file":"hub/test/discord-messages.test.ts"}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13398 records actual raw failure lines and separated partial counts: ordinary3311pass/2fail/1cancelled plus75loadpass(50commands/25site). Hub3388 completed includes repeats and excludes cancelled identity. No assertion diagnostic/root cause inferred; Coordinator shared-fix disposition pending. Source2/A-13394 remains clear, no criterion behavior failure assigned to passing commands and no fresh criterion marks. No reviewer workloads, no retry/source changes requested.

### rev-26 · 2026-10-28T18:55:53.157Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1407-source-delta-1
commit: f8c14a467533289ca1c918e7bbb2ac1ce9f725a8
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13411 delta clear: eight files comprise six tracker records plus byte-identical reviewed T-1432 messages test/guide; landed4d16ea13 ancestor, fetched parent8e90d26f. T-1407 command/API/native fake/proxy/tests/CLI fixture/skill bytes unchanged from source2, complete task retained against second parent. No source finding or reviewer workload. C1–C5 remain unverified pending merged-head original runtime; A-13396/A-13398 stay interrupted red. Coordinator separate full verify acknowledged and head frozen.

### rev-26 · 2026-10-28T19:12:19.895Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1407-evidence-2
commit: f8c14a467533289ca1c918e7bbb2ac1ce9f725a8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13415 final evidence2 verifies C1–C5 from original A-13414:3978 ordinary passes+75 separate loads(50commands/25site), no nonpass/unfinished. Ten exact command base cases each5/5; private layout/mute/replay/ingress/defer/stop/long/native-limit assertions retained. Messages24/24, messenger38/38, pairing4/4 including all three prior red restart boundaries pass at merged head. T0/T1/all fallbackT2/Web complete; T3/T4 absent. Pinned Linux/browser setup, host gate reuse and report-only budgets/lint explicit. Prior A-13396 red remains separate. Coordinator full20cd6379/CLI T3/enqueue remain separate gates; no reviewer workloads.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
