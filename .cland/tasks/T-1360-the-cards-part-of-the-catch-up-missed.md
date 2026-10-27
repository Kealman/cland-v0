---
id: T-1360
kind: task
title: "The cards' part of the catch-up: missed cards, failed outcome edits, and every open card re-sent after 150 seconds"
state: open
status: review
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1310
blocked_by:
  - T-1356
  - T-1359
topic: topic-1123
branch: t/T-1360-the-cards-part-of-the-catch-up-missed
created: 2026-10-27T05:43:02.419Z
updated: 2026-10-27T20:57:23.965Z
---

## Summary

After an outage the chat gets the cards of open asks it never received and the outcome edits that did not go through, after T-1348's late messages and gap line. After an outage longer than 150 seconds, the life of a press, every open card is re-sent at the bottom with "a button pressed then may have been lost; press again", and its old copy is marked "↓ Re-sent below".

## What to build

On recovery the catch-up runs in §3.9's order:
1. what Telegram kept;
2. the gap line (T-1348);
3. the cards of open rows that have no delivered copy, and the queued or failed outcome edits;
4. when the outage lasted over 150 seconds under the injected clock, a re-send of every open card at the bottom with the note.

Each old copy is edited to "↓ Re-sent below" without buttons. The outbox drops the card job of a row that closed meanwhile (ticket 03's `sourceOpen`), so an ask answered in the web during the outage gets only its outcome edit. The outage's start and length come from T-1348's offline record. A plain hub restart shorter than 150 seconds re-sends nothing. Spec §3.9 and §3.7; builds on T-1348 and the outbox drain (T-1325).

## Acceptance criteria

- [x] C1. A 60-second fake outage during which an ask is posted ends with that card arriving after the gap line, and no open card is re-sent (test).
  - done: impl-1360 · 2026-10-27T20:51:10.494Z
- [x] C2. A four-minute fake outage in which one ask is answered in the web and another is posted ends with the outcome edit, the new card, and every open card re-sent at the bottom with the note and each old copy marked "↓ Re-sent below" without buttons (test).
  - done: impl-1360 · 2026-10-27T20:51:10.610Z
- [x] C3. A card job queued before the outage for an ask answered during it is dropped, and an outcome edit that failed during the outage is applied on recovery (test).
  - done: impl-1360 · 2026-10-27T20:51:10.705Z

## Comments

### impl-1360 · 2026-10-27T20:41:25.989Z

Pre-change consumer inventory (rule 20): searches across hub/web/nvim/shared, docs, qa and .agents for TelegramRemoteOptions, TelegramPollingOptions, TelegramOutbox, TelegramCards, publishInbox/publishApprovals, telegram.outage and native card/outcome keys. Production owners: telegram.ts -> telegram-cards.ts/telegram-outbox.ts; messenger.ts constructs TelegramRemote; telegram-prompts.ts owns explicit input effects; outbox.ts owns durable jobs/proof; telegram-gap.ts owns gap receipts; state.ts persists opaque native keys/maps. Direct test consumers: telegram-pacing, telegram-cards, telegram-approvals, telegram-polling and its fixture, telegram-inbound, telegram-mute, telegram-rendering; liveness/catchup/gap exercise production factory; polling-restart and remote-state/gateway-state retain persistence/legacy transport coverage. Startup probes, QA briefs, web/nvim and shipped skills do not read the private outage/card keys. No wire, schema, authority or Remote options change planned: new native recovery keys will be additive and old outage records readable. Generic Outbox defaults/proof classes remain unchanged; direct TelegramOutbox clients retain ungated defaults. Keep existing prior-wire gateway regressions unchanged. Docs: hub README, per-file test guide, implement skill + CHANGES. Public remote-control doc deferred until Coordinator supplies its landing/merge direction.

### rev-26 · 2026-10-27T20:53:55.772Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1360-source-1
commit: 80c04f0fb4a5de11bd475e431f90b55d1018d09e
scope: full
findings: [{"severity":"medium","text":"M1 Spec/lifecycle: a held queued card's original waiter remains pending after recovery durably drops its closed source. Generic Outbox source drops do not call settled; resume starts a new drain without reconciling deferred waiters. Require publisher settlement while adapter remains live, retaining unknown fences.","file":"hub/src/remote/telegram-outbox.ts","line":118},{"severity":"medium","text":"M2 Spec: resolved edit may mean a successful new-message fallback after edit refusal, leaving the original keyboard unchanged. catchUp nevertheless records done without incomplete retirement. Distinguish native edit receipt from fallback delivery; control definite edit refusal with successful fallback and inspect the original copy.","file":"hub/src/remote/telegram-cards.ts","line":180}]
finding_counts: {"high":0,"medium":2,"low":0}

Full consolidated source audit complete: Standards zero findings, Spec M1/M2 medium. Retained-input/gap gating, strict first-recovery 150-second boundary, durable replacement keys/plans and unknown fences otherwise reviewed. A-12901 local macOS targeted 59+19 passes/typecheck are not configured/Linux/load evidence. Runtime marks pending. Correct both findings with retained red/green controls and request fresh pushed-head source review before verification; no dev/sibling merge. QA none; Coordinator integrated cover separate.

### impl-1360 · 2026-10-27T20:55:05.650Z

Source-1 M1/M2 correction inventory before new receipt accessor: production TelegramOutbox.edit callers are only TelegramCards.catchUp, outcome and approvalOutcome; test callers are the two queued-edit calls in telegram-pacing.test.ts (both already use a key). Existing edit(): Promise<void>, fallback settlement, all payload shapes and generic Outbox remain unchanged. Additive native editApplied(key) will read the existing exact edit-job settlement; only catchUp consumes it, while existing outcome callers continue treating a delivered fallback as notification completion. No wire, schema, startup probe, QA brief or client migration. M1 revisits existing waiters after resume using unchanged completion checks; unknown sends still cannot pass. New frame/native tests capture Remote.receive's actual completion and inspect the refused original message/keyboard before requiring explicit incomplete retirement.

### rev-26 · 2026-10-27T20:57:23.965Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1360-source-2
commit: 7e29fbe54dcdad9fd1650390db67a2b997e7302c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source-2 clear on Standards and Spec. M1 resume now reconciles held publication waiters through durable terminal checks; regression requires actual Remote.receive completion after source-closed drop while hub/remote stay live. M2 exact keyed native edit receipt distinguishes successful fallback notification; original-keyboard control requires persisted incomplete retirement. Original criterion/unknown fences retained; docs/skill CHANGES updated. A-12903 local Darwin red/green and 61+19 passes/typecheck are not configured/Linux/load evidence. Runtime C1–C3 marks pending. One unchanged-head mode-free verification next, then original-record audit; no dev/sibling merge. Coordinator integrated/public-doc coordination separate.
