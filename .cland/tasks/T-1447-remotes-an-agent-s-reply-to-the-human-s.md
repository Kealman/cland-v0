---
id: T-1447
kind: task
title: "Remotes: an agent's reply to the human's message arrives unthreaded on Telegram and Discord"
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1201
branch: t/T-1447-remotes-an-agent-s-reply-to-the-human-s
created: 2026-10-29T17:00:36.038Z
updated: 2026-10-29T18:06:35.972Z
closed: 2026-10-29T18:06:35.972Z
---

## Summary

Found in the v0.3.0 live run (E-1314, QA qa-677, step L3, topic-1195, A-13830), on the real @cland_app_bot and the Discord bot against the sandbox hub at dev 189d5100. The human replied to messages in both apps. The sandbox Coordinator answered with `send` carrying a nonempty `replyTo`; `./sbx hub audit` shows it at 16:57:37Z and 16:58:22Z. Its replies arrived in both apps as ordinary messages, not as replies to the human's message. The human's words: «хоть координатор и написал что reply_to передано, ни в тг ни в дискорде сообшение не было ответом, в смысле не показывало сообщение на которое отвечается». The cause is not established: the hub carries `replyTo`, but the outbound mirror may not map it to Telegram's `reply_parameters` or Discord's `message_reference`.

## What to build

When a General message has `replyTo` pointing at a message mapped to a native message on that remote, send it as a native reply: `reply_parameters` with `allow_sending_without_reply` on Telegram, and `message_reference` with `fail_if_not_exists: false` on Discord. A reply target that isn't mapped on that remote, or was deleted, still sends as a plain message. This covers the human's own messages sent from either remote and the cross-remote copies.

## Acceptance criteria

- [x] C1. An agent's `send` with `replyTo` set to the human's Telegram message goes out as a native reply to it, shown by a production-frame test on the fake Bot API that fails before the fix.
  - done: impl-1447 · 2026-10-29T17:30:49.464Z
  - verified: rev-34 [reviewer] · run rev-34-20261029-1447-final · 2026-10-29T17:55:47.059Z · commit db6760bb4dfe356fb7b1a23f4296bbdd4ad1f34e
- [x] C2. The same holds on Discord, with `message_reference` on the fake REST.
  - done: impl-1447 · 2026-10-29T17:30:50.540Z
  - verified: rev-34 [reviewer] · run rev-34-20261029-1447-final · 2026-10-29T17:55:47.059Z · commit db6760bb4dfe356fb7b1a23f4296bbdd4ad1f34e
- [x] C3. A reply target unmapped on a remote, or deleted, still delivers once as a plain message.
  - done: impl-1447 · 2026-10-29T17:30:51.562Z
  - verified: rev-34 [reviewer] · run rev-34-20261029-1447-final · 2026-10-29T17:55:47.059Z · commit db6760bb4dfe356fb7b1a23f4296bbdd4ad1f34e

## Comments

### impl-1447 · 2026-10-29T17:03:22.688Z

Consumer inventory before optional native-reply changes: General frame producers/readers retain existing Message.replyTo shape; telegram.ts receive plans rich/plain/file payloads consumed by TelegramOutbox and TelegramApi; discord.ts publication calls DiscordOutbox (sendGroup, publication, #enqueue, #deliver) then DiscordApi. RemoteStore native mappings include inbound and outbound records. Tests/QA/docs consumers found via replyTo/reply_parameters/message_reference searches: telegram-{inbound,notices,voice,api,artifacts}, discord-{messages,render,artifacts,inbound-media,cards}, gateway and old payload recovery tests; shipped skills and QA briefs use unchanged frames. Only optional reply fields on existing payloads will be used, with old payloads readable. No public reply/list/schema/authority changes.

### rev-34 · 2026-10-29T17:27:25.700Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261029-1447-source1
commit: 9cf13f97df46d8644db082c6ce3539816c1794f6
scope: full
findings: [{"severity":"medium","text":"M1: Explicit General replyTo is overridden/dropped on reused-artifact reference paths. Telegram file() replies to the previous upload or omits reply metadata; Discord publication line153 similarly overrides the mapped human target with prior upload id. Preserve explicit mapped reply precedence and deleted-target plain fallback, retaining artifact dedup/no-reupload and default sent-above behavior without explicit reply. Add native repeated-artifact controls with a distinct human target.","file":"hub/src/remote/telegram-outbox.ts","line":73},{"severity":"medium","text":"M2: New paired tests register Store.close in onCleanup resource phase, whereas projectHub.stop is registered in beforeDirectories hub phase. If an assertion/setup step fails before explicit hub.stop, injected Store closes while hub/remotes are still live. Pre-own bounded dynamic hub acquisition/stop ahead of Store/fake/root disposal and cover missed/aborted setup; retain all native reply and exactly-once fallback assertions.","file":"hub/test/discord-messages.test.ts","line":584}]
finding_counts: {"high":0,"medium":2,"low":0}

A-13859: full source not clear, M1 explicit-reply precedence for reused artifact references and M2 new paired fixture disposal order on failure. Normal text cross-remote flags/maps and optional payload/nonce compatibility are source-consistent. Consolidate controls/corrections and request fresh pushed-head review before verification. Local macOS only; no Reviewer execution or runtime verification.

Criteria: C1 failed (Artifact-reference branch can discard explicit human native reply target on Telegram.), C2 failed (Reused-artifact reference can override explicit human reply target with prior upload on Discord.).

### rev-34 · 2026-10-29T17:32:49.330Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1447-source2
commit: db6760bb4dfe356fb7b1a23f4296bbdd4ad1f34e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13871: full source clear, M1/M2 resolved. Explicit mapped reply wins for reused artifacts; explicit unmapped suppresses default artifact thread while absent marker preserves old behavior/no-reupload. Four native cases retain request/cardinality controls; pacingOwner drains dynamic hub before Store, with missed/aborted startup controls. T-1448 caption omission remains separate per Coordinator. Local macOS receipts only; C1–C3 runtime verification pending exact-head configured evidence. No Reviewer execution.

### rev-34 · 2026-10-29T17:55:47.059Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1447-final
commit: db6760bb4dfe356fb7b1a23f4296bbdd4ad1f34e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13891: Original A-13885 independently parsed4166ordinary passes plus30task/75unrelated site load passes. Four native reply/reused-artifact/fallback cases and two ownership controls each ordinary+5/5load,all<3s. C1–C3 verified; host tree reuse,T-1448 separation,report-only and noT3/T4 limits retained.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-29T18:06:35.972Z

Merged 25e9fb51d17b3dc7b8029de10e6ce36d78a0164c onto dev.
