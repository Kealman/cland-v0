---
id: T-1344
kind: task
title: "The Telegram mirror in: the human's text, decision and question kinds, replies to topics, and the delivery reactions"
state: open
status: review
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1341
topic: topic-1095
branch: t/T-1344-the-telegram-mirror-in-the-human-s-text
created: 2026-10-26T19:09:06.927Z
updated: 2026-10-26T23:45:43.328Z
---

## Summary

The human's Telegram text reaches General as their message to the Coordinator with `via = "telegram"`. `/decision` and `/question` send the other kinds, a reply goes to its message's topic, formatting is dropped, and 👌 then 👀 confirm delivery.

## What to build

Inbound mapping through the gateway as the human (T-1321) with `via` (T-1322). Mentions resolve as in the workbench, and `@aide` is no mention. A reply to a mirrored message routes through T-1323's chat-message map to its topic. React 👌 once General has the message and 👀 once the addressee's session has it. Spec §3.4.

## Acceptance criteria

- [x] C1. Free text, `/decision`, `/question` and a message with bold text reach General as the human's messages of the right kind with `via = "telegram"` and the formatting dropped (test).
  - done: impl-1344 · 2026-10-26T23:45:43.243Z
- [x] C2. A reply to an agent's mirrored message lands in that message's topic, and the fake sees 👌 then 👀 in that order (test).
  - done: impl-1344 · 2026-10-26T23:45:43.328Z

## Comments

### impl-1344 · 2026-10-26T23:19:34.832Z

Rule 20 pre-change consumer inventory: native TgMessage/TelegramApi consumed by telegram.ts, telegram-polling.ts, messenger.ts, fake-api.ts, telegram-api.test.ts, telegram-messenger.test.ts, telegram-polling-fixture.ts and telegram-polling/restart tests. Remote.start/frame port is consumed by gateway.ts, configuration.ts, test/fakes/messenger.ts, gateway tests (including old synchronous shape), outbox/gateway-state/gateway-secrets/remote-cli/config-set/project-hub-lifecycle tests and harness injection. Conversation.receive is called by gateway.ts, transport.ts/http.ts and dispatch unit/peer fixtures; its current optional via parameter remains valid. topic.send is consumed by workbench Web/Neovim, CLI, recordings, all-tier topic/send/approval/gateway tests and shipped skill/QA examples; no wire shape or gateway authority change planned. RemoteStore.message maps are read by remote-state/outbox/gateway-state and native mirror-out; keep their schema and semantics additive. Docs/skills: hub README, implement skill, Telegram API/messenger/polling guides; T3 polling-restart fixture and all QA/startup-probe searches included. Planned internal additive admission metadata carries platform chat/message identity separately from frames, atomically stores inbound source map with topic.send and returns original receipt on replay; ordinary legacy frames unaffected. New client regression will keep previous frame shape and prove forged ingress fields cannot choose an identity.

### impl-1344 · 2026-10-26T23:23:11.421Z

C1 native/frame red: no stored final inbound message before handler wiring; green now covers literal free text, decision/question and bold/link/code entities dropped. C2 test setup initially lacked model subscribe; corrected before using its result as evidence. Replay red reproduced `2 !== 1` human messages after interrupting a held reaction and restarting projectHub. Green uses a deterministic messenger/chat/message key passed as trusted internal metadata to existing topic.send; Store.record already atomically persists the message and its deliveries. This supersedes the earlier transaction/map plan: no schema/core change is required. Frame fields cannot supply that key, and existing requests/constructors remain valid.

### impl-1344 · 2026-10-26T23:29:24.767Z

Consumer inventory correction/expansion from full-tree searches: actual Conversation transport users are hub/src/hub/server.ts, socket.ts, stdio.ts and web-edge.ts (the earlier transport.ts/http.ts names were inaccurate). They pass only raw frames and retain no ingress metadata; production adapters/sessions use other conversations and are unaffected. Dispatcher fixture consumers include validation-support, harness, account-coalescing, journal-flush/journal-async, connection-resync/connection-snapshot, roles-snapshot/roles-session-refresh, heartbeat, verify-submission, crew-launch/launch-admission, hub-status-component, session-resume(+component)/session-async-processes, claude-code-environment, executor-droplet-component and fakes/harness. Their existing raw/optional-via shapes remain valid. Native factory/Remote users additionally include web/test/harness.ts and remote-via.test.ts, plus hub/test/web-authority, pairing-approval/pairing-codes, outbox-gateway, gateway-state/gateway-secrets, config-set and remote-cli tests. No frame shape, persisted schema, T3/T4 consumer or startup-probe migration required. Source code, tests, shipped skills and QA briefs were searched; onboarding/wayfinder and E-418-stage-2 hits use prose 'conversation', not the native ingress contract. New gateway regression retains old wire frames and proves forged messageId/ingress fields cannot choose the durable input id.

### rev-34 · 2026-10-26T23:36:17.680Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261026-1344-source1
commit: 56c9d4df0e0f9419b277c5e83603ae20ab543d3a
scope: full
findings: [{"severity":"medium","text":"M1: REMOTE_USAGE adds paired text/kind/topic help but its owning frozen commands.json row is unchanged. Existing strict compatibility/root/remote help guards disagree. Reproduce and migrate only that row; preserve equality/template.","file":"hub/src/cli/usage.ts","line":67},{"severity":"medium","text":"M2: work.then releases reaction ownership after the final work check. A delivery arriving after 👀 was skipped but before deletion joins the completed owner; delivered=true remains with no worker to send 👀. Close the drain/ownership handoff gap and retain ordered one-owner/session-receipt regression (lead reproduced red).","file":"hub/src/remote/telegram-inbound.ts","line":90},{"severity":"medium","text":"M3: delivery is durable in hub before the asynchronous remote_state bit update. Crash after input offset confirmation in that window loses the event; restart does not reconcile pending feedback against durable stage, so 👀 may never appear. Add dropped-delivery/restart proof and trusted startup reconciliation without wire authority expansion.","file":"hub/src/remote/telegram-inbound.ts","line":47}]
finding_counts: {"high":0,"medium":3,"low":0}

Consolidated first source NOT CLEAR at56c9d4df, which lead explicitly supersedes as final source head while adding native crash proof. A-12518: Standards1mediumM1, Spec2mediumM2/M3. Native identity/human/via/routing and additive old-wire design otherwise appropriate; source consumer inventory and docs reviewed. Lead has confirmed M1 unchanged guards and M2 exact frame/HTTP microtask red; fixes still uncommitted/unreviewed here. M3 is separate durable-stage recovery boundary. Preserve existing routing/delayed-delivery/replay/old-frame assertions and add native SIGKILL exactcommit-beforeadapterreceipt test per Coordinator. No Reviewer tests/edits or runtime marks. Finish consolidated corrections, push/request fresh source review before any verification; no dev merge unless authorized.

Criteria: C1 failed (M1: changed input help lacks its owning frozen fixture migration and breaks exact-byte help guards.), C2 failed (M2/M3: valid session delivery can permanently miss 👀 at reaction-owner handoff or restart after durable delivery before remote receipt.).

### impl-1344 · 2026-10-26T23:36:51.397Z

M3 recovery contract inventory before edit: add optional fourth Remote.start callback for trusted durable input lookup and optional Conversation.messageReceipt for gateway-only use; current native callers are gateway.ts and TelegramRemote, and all older injected remotes/Conversation fixtures retain their old argument shapes. Socket/stdio/web/server transports expose no new wire action. Gateway hashes messenger/chat/message before lookup and redacts output; only durable human messages from that messenger qualify. Add RemoteStore.entries(prefix) for messenger-scoped literal-prefix receipt enumeration (no schema change), consumed only by native recovery and storage tests. Existing state/outbox/pairing callers remain unchanged; all-tier dispatcher/Remote consumers are in the earlier inventory. New frame/fake restart proof drops an actual delivered frame after offset confirmation and requires one recovered 👀 without repeating 👌.

### impl-1344 · 2026-10-26T23:42:59.652Z

Source-1 corrections complete before replacement review: M1 reproduced unchanged CLI help exact-equality reds and migrated only fixtures/cli-usage/commands.json REMOTE_USAGE; root/subcommand help and compatibility now green. M2 native API-receipt/frame interleaving red (`executor operation deadline reached` at missing eyes) now green with synchronous reaction-owner release. M3 confirmed-offset + dropped real delivered frame + shutdown/reopen red (missing eyes) now green with startup reconciliation against a messenger-scoped optional trusted durable-stage lookup; no wire action added. Native postcommit SIGKILL test first red (`native SIGKILL after committed Telegram input: not within 3000 ms`), then green with one committed message, absent adapter receipt/offset, positive native exit and exact same id after restart. Both prior unhandled-input tests now inject edits because new text is handled; all original boundary assertions remain. Latest native crash local/macOS body 0.623s, not Linux timing. New lower storage assertion retains literal-prefix and messenger isolation. Callback/consumer inventory precedes the recovery edit. No dev merge after first review. Coordinator's 575d394d decision replaces mode-free verify: after source clear I report head/clean merge-tree, and Coordinator owns full verify all.

### rev-34 · 2026-10-26T23:45:24.480Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261026-1344-source2
commit: 7b2a572c01008368e2389c0209a638b8ee68780c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Replacement source CLEAR at7b2a572c/tree82424899. A-12523 records Standards0/Spec0 findings, full source review with source1 context. M1 exact owning help row now matches; strict guards unchanged. M2 synchronous final-check/owner release and actual frame/HTTP microtask control resolve the handoff gap. M3 trusted messenger-scoped durable-stage recovery plus confirmed-input/dropped-delivery/restart control resolve missing feedback. Additive optional callback/old-wire authority and literal-prefix isolation retained. Native SIGKILL postcommit/pre-adapter-receipt regression preserves owned live birth/native exit, absent receipt/offset and original-id replay; older pre-handler crash/unmatched-input assertions retained through edit inputs. Docs/skill CHANGES and consumer inventory reviewed. No Reviewer tests/edits; Implementer macOS-only receipts A-12521 are not Linux/full evidence. C1/C2 runtime verification remains pending; lead notified that task.view still had source1 failed/unchecked marks. Per Coordinator575d394d, do not submit mode-free task verify: report source-cleared exact head/merge-tree for Coordinator's sole full verify all, then audit that head-bound result. A source clear is not an integrated pass.
