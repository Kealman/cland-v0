---
id: T-1406
kind: task
title: Replies land in their topic, and 👌 and 👀 confirm the human's messages
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1400
topic: topic-1149
branch: t/T-1406-replies-land-in-their-topic-and-and
created: 2026-10-27T23:38:47.088Z
updated: 2026-10-28T11:22:23.347Z
---

## Summary

A reply from the human maps through its message reference to the mirrored message and lands in that topic as a reply. 👌 confirms that General stored the human's message, and 👀 that its addressee has it. Other members' replies are ignored.

## What to build

**Replies.** A type 19 message from the paired user reads `message_reference.message_id`, looks up `remote_messages` and sends `topic.send` with `replyTo` into the mapped topic. A reply to an unmapped or deleted message goes to General as a plain message. Ticket 16 handles replies to notices.

**Reactions.** They go as `PUT …/reactions/<emoji>/@me` jobs through the outbox: 👌 once the hub stores the message, and 👀 once a `delivery` frame says delivered or injected. Each reaction goes once, recorded under `discord.inbound:<message>` receipts that a restart recovers, as Telegram's do.

The fake records reactions per message and user.

Spec §3.4 (replies, feedback by reaction), §3.8 (inbound); research rule 34.

## Acceptance criteria

- [x] C1. A reply to a mirrored General message reaches General as a reply to that message, and a reply to an unmapped message reaches General as a plain message (test).
  - done: impl-1406 · 2026-10-28T11:20:29.597Z
- [x] C2. The human's message gets 👌 once General stores it and 👀 once its addressee has it, each exactly once, even with a hub restart between the two (test).
  - done: impl-1406 · 2026-10-28T11:20:29.754Z
- [x] C3. Another member's reply to a mirrored message reaches nothing and gets no reaction (test).
  - done: impl-1406 · 2026-10-28T11:14:29.619Z

## Notes

Shared files: discord-inbound.ts; hub/test/fakes/discord/ (reactions)

## Comments

### impl-1406 · 2026-10-28T11:09:12.591Z

Rule 20 consumer inventory before edits: discord.inbound:<native-id> is private persisted dedup state read/written only by DiscordInbound; retain legacy '1' tombstones and add JSON receipts there. DiscordRemote constructs inbound and forwards HubFrame results/deliveries; gateway Remote.start already supplies optional RemoteReceipt (Telegram consumer unchanged). DiscordOutbox persists private payloads; preserve existing message intents, add reaction intents and idempotent PUT replay. Consumers searched across hub/nvim/web/.agents/docs/qa: discord-messages.test.ts (outbox and restart), discord-api.test.ts (reaction pacing), fakes/discord/exchange.ts (addReaction arity), fakes/discord/fake-api.ts (additive reactions state), messenger factory and DiscordRemote. No public frame/schema/authority change; old receipts and message payloads remain readable. Frame/fake seams pre-authorized by epic. C1 first: mapped General reply plus unmapped fallback; C2 durable reaction recovery; C3 foreign reply rejection.

### impl-1406 · 2026-10-28T11:13:59.109Z

TDD evidence (local macOS Node, no browser): mapped-reply case failed with replyTo undefined before change, then passed. Restart feedback case failed 'stored reaction: not within 1500 ms' before implementation. Interrupted reaction recovery failed 'sending' !== 'sent' before availability recovery. Final touched T2 file: 22/22 passed (1829 ms total), including generated cases 'Discord routes mapped replies and leaves unknown references as plain General text' (C1/C3), 'Discord stored and delivered reactions survive a restart exactly once' and '... with a lost delivery frame' (C2), plus safe idempotent unknown-response replay and legacy 1 tombstones. Consumer docs and implement skill updated. No full local suite, Linux or browser evidence yet; source review then droplet verify pending.

### rev-31 · 2026-10-28T11:20:00.176Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261028-1406-source1
commit: 992a3f2eea4ae370cbc8055ed393b956d4366d8e
scope: full
findings: [{"severity":"medium","text":"M1 Spec: pairing is checked only before awaiting the stored reaction. If that PUT is held while the pairing changes to another user in the same channel, the delivered reaction then calls react(), which stamps the new job with the replacement user (discord-outbox.ts:28); lane admission accepts feedback for the old receipt. Preserve the captured receipt user through reaction enqueue/admission and revalidate after I/O; retain a held-reaction unpair/same-channel replacement regression.","file":"hub/src/remote/discord-inbound.ts","line":85},{"severity":"medium","text":"M2 Spec: explicit deleted references are routed through stale remote_messages mappings. Discord's referenced_message:null marks a deleted target, but the code only reads message_reference.message_id and always applies the mapping. The item requires a deleted target to fall back to plain General text. Add a known-mapping/explicit-null case and preserve existing mapped/absent-field semantics.","file":"hub/src/remote/discord-inbound.ts","line":32}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source1 A-13242: Standards 0 / Spec 2 medium. M1 preserve receipt identity through reaction admission and recheck after I/O, with held unpair/replacement controls; M2 explicit referenced_message:null must bypass a retained mapping for deleted-target General fallback. Ordinary reply/dedup/result/delivery/startup/idempotent reaction paths and consumer/docs audit inspected. Local 22/22/typecheck claims remain separate from pending configured/Linux proof. Consolidate fixes with original red/green receipts, push and request fresh source review before mode-free verify. No extra dev merge unless Coordinator directs; no per-item QA.

Criteria: C1 failed (A confirmed deleted target with a retained mapping still supplies replyTo instead of the required plain General fallback.), C2 failed (After a held stored-reaction exchange, a same-channel replacement pairing can authorize the old receipt's delivered reaction.).

### rev-31 · 2026-10-28T11:22:23.347Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261028-1406-source2
commit: bad1e90a9bc8d8c78d2288ecc38f85333e46a80f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source2 clear, A-13244. M1 captured receipt user passed through reaction intent/admission and pairing rechecked after I/O; held unpair/replacement controls retain durable settlement and no old-input eyes job/reaction assertions. M2 explicit-null deleted mapping bypass with omitted-field mapped compatibility and extended frame regression. Shared fake actually bounds/owns hold observations and control requests; preliminary contrary concern withdrawn, no extra owner requested. Source1 audit carried, no dev merge. Local reported 24/24/typecheck evidence remains distinct from pending configured/Linux proof. Restore C1/C2 claimant done from correction evidence, keep head stable, one ordinary mode-free verify then final original-record audit. No per-item QA.
