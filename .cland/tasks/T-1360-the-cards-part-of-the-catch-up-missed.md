---
id: T-1360
kind: task
title: "The cards' part of the catch-up: missed cards, failed outcome edits, and every open card re-sent after 150 seconds"
state: closed
status: done
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
updated: 2026-10-27T22:14:19.005Z
closed: 2026-10-27T22:14:19.005Z
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
  - verified: rev-26 [reviewer] · run rev-20261027-1360-evidence-2 · 2026-10-27T21:31:07.821Z · commit 811cfe644656a8e5d54d9ba60e01fb044086d195
- [x] C2. A four-minute fake outage in which one ask is answered in the web and another is posted ends with the outcome edit, the new card, and every open card re-sent at the bottom with the note and each old copy marked "↓ Re-sent below" without buttons (test).
  - done: impl-1360 · 2026-10-27T20:51:10.610Z
  - verified: rev-26 [reviewer] · run rev-20261027-1360-evidence-2 · 2026-10-27T21:31:07.821Z · commit 811cfe644656a8e5d54d9ba60e01fb044086d195
- [x] C3. A card job queued before the outage for an ask answered during it is dropped, and an outcome edit that failed during the outage is applied on recovery (test).
  - done: impl-1360 · 2026-10-27T20:51:10.705Z
  - verified: rev-26 [reviewer] · run rev-20261027-1360-evidence-2 · 2026-10-27T21:31:07.821Z · commit 811cfe644656a8e5d54d9ba60e01fb044086d195

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

### rev-26 · 2026-10-27T21:08:27.264Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1360-source-3
commit: 67b2f5074a6e7c1020bfdbd5f982203186f241d0
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge/public-doc delta clear, Standards and Spec. Coordinator 5a04262d confirmed; merge parents expected and reviewed runtime/criterion tests unchanged from source-2/A-12905. Imported T-1368 relevant site/test paths match rev-31's cleared landed source. New dependency-safe public doc contract/guide checks gap, missed delivery, strict >150 replacement note/marker and <=150 already-delivered distinction. A-12909 local site5/5+wrapper6/6/typecheck are not configured runtime evidence. Old c2ed291f remains attributed to 7e29fbe54; no current-head runtime marks. Fresh unchanged-head mode-free receipt then original-record evidence review; Coordinator integrated cover separate.

### rev-26 · 2026-10-27T21:10:00.647Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1360-evidence-1
commit: 7e29fbe54dcdad9fd1650390db67a2b997e7302c
scope: evidence
findings: [{"severity":"medium","text":"M3: original A-12911 fails five unchanged telegram-pacing controls with Telegram send has no delivery receipt from the new resume reconciliation. Runtime source is unchanged at current 67b2f507; new source correction required before another run.","file":"hub/src/remote/telegram-outbox.ts","line":278}]
finding_counts: {"high":0,"medium":1,"low":0}

Old-head configured c2ed291f failed. Independent progress: 3094 ordinary pass/5 fail plus 60 scoped load pass; 3159 combined finishes are not ordinary coverage. T0/T1 green, T2 red, Web/T3/T4 unexecuted. Exact error and stack establish premature reconciliation of later/new-lane waiters; no external slowdown classification. Current-head doc delta clear did not validate this failed runtime. C1–C3 remain unverified; preserve A-12911 and correct/source-review before configured verification.

### rev-26 · 2026-10-27T21:10:01.022Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1360-source-4
commit: 67b2f5074a6e7c1020bfdbd5f982203186f241d0
scope: full
findings: [{"severity":"medium","text":"M3 Spec: resume awaits a captured lane snapshot, then calls #complete(order,true) on all current waiters, including new-chat/lane work queued afterward. That work is still queued/sending and is prematurely rejected. Existing pacing tests show five exact failures. Scope reconciliation to captured deferred work/lanes or terminal groups, retain M1 and all existing pairing/rate-limit assertions.","file":"hub/src/remote/telegram-outbox.ts","line":278}]
finding_counts: {"high":0,"medium":1,"low":0}

Current runtime is byte-identical to failed old-head A-12911. New runtime evidence requires M3 correction despite prior doc/merge delta clearance. Standards no independent finding; Spec one medium M3. C1–C3 runtime marks pending. Reproduce unchanged pacing red, correct shared path with consumer checks, push and request fresh source review before another configured run; no dev merge.

### impl-1360 · 2026-10-27T21:11:36.548Z

M3 consumer re-audit before correction (Coordinator request 138fa904): searched hub/test and nvim/test for TelegramOutbox/new Outbox, native order/hold/receipt keys, outbox.unavailable, .outbox/.attempts, queue/current/reopened/outbox.resume, and transitive imports of telegram-pacing-fixture/telegram-gap-fixture. Direct matches: remote-state, gateway-state, outbox, outbox-gateway, telegram-pacing, telegram-cards, telegram-approvals, telegram-catchup, telegram-gap, telegram-commands, telegram-mute, telegram-notices, telegram-rendering. Resume snapshot calls are all in unchanged telegram-pacing (explicit availability recovery, live/reopened revocation, remaining bot hold, interrupted fallback recovery); those assertions are retained. Pacing/gap fixtures are shared setup/clock drivers, not executable cases; their importing files extend the run list. Neovim outbox consumers are remotes.test.ts and sessions.test.ts plus their protocol-frame JSON fixtures; they read safe status/depth, not native completion or resume. No wire/schema/authority changes planned. Existing red loop: node --test hub/test/telegram-pacing.test.ts => 30 pass/5 fail with `Telegram send has no delivery receipt` through #complete and resume; isolated reopen bot-wide-429 test also red. Correction will capture the existing waiter orders with resume's lane snapshot rather than reconciling later/new-lane waiters. M1 live source-drop completion and all five original pacing assertions must stay green. A-12911 remains failed old-head evidence, not proof for current head.

### impl-1360 · 2026-10-27T21:12:19.705Z

M3 expanded run list after transitive search: executable direct/fixture consumers are hub/test/{remote-state,gateway-state,outbox,outbox-gateway,telegram-pacing,telegram-cards,telegram-approvals,telegram-catchup,telegram-gap,telegram-commands,telegram-mute,telegram-notices,telegram-rendering,telegram-inbound}.test.ts. Also run all generic fake-messenger importing test matches: hub/test/{web-authority,opencode-adapter,gateway-secrets,doctor-remotes,setup-remote-component,config-set,remote-cli,gateway,pairing-approval,pairing-codes}.test.ts (gateway-state/outbox-gateway already in direct list). Generic fake owners use unchanged Outbox, but are included per Coordinator's consumer sweep. Neovim: nvim/test/remotes.test.ts (native T3 rendered remote/pacing state) and nvim/test/sessions.test.ts (T2 recorded frame outbox status). JSON frame matches are consumed by sessions.test.ts; fixture/fake TS matches have no standalone cases. These 26 executable files will run one at a time, no load probe. telegram-pacing already reproduced unchanged at 30/35, isolated reopen/429 also red, and after capturing only original waiter orders now passes 35/35. All five existing assertions remain byte-for-byte unchanged.

### rev-26 · 2026-10-27T21:16:09.555Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1360-source-5
commit: 811cfe644656a8e5d54d9ba60e01fb044086d195
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source-5 clear, M3 resolved: existing waiter orders are captured with awaited lane drains; later/new-lane sends retain their own receipts. Five original pacing controls byte-identical, M1 live dropped-publication settlement and M2 exact native-edit/incomplete retirement retained. Original task and authorized merge/doc audits remain applicable. A-12913 reports actual prior red and local serial 26-file/383-case green, with Darwin/tier/TAP limits; these are not configured current-head proof. A-12911 remains failed old-head. C1–C3 verification pending; one unchanged-head mode-free run then original-record review, plus Coordinator-required separate same-head all/T3 before enqueue.

### rev-26 · 2026-10-27T21:31:07.821Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1360-evidence-2
commit: 811cfe644656a8e5d54d9ba60e01fb044086d195
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Task original-record evidence clear, A-12916. Exact-head b83e2fd1/A-12915 independently confirms 3767 ordinary passes plus 85 scoped load passes. All C1–C3 recovery cases and nine additional native controls have base + actual5/5; public doc contract also base+5/5. All35 pacing identities pass, including five formerly failing unchanged M3 cases at15604/15612/15625/15633/15637. New base/load max .91170507/1.157657055 s, no>=3s allowance needed. T0/all T1/fallback all T2/Web complete; T3/T4 absent. Linux c8lon1 isolated HS156.0.8078.4/r1248; host gate324a359b reused, budgets/lint report-only. A-12911 remains failed old-head. C1–C3 verified; Coordinator-required separate same-head verify all/T3 remains mandatory before enqueue; this task receipt does not replace it.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-27T22:14:19.005Z

Merged 579c774eebb15e656f49243287bf557b823fb95e onto dev.
