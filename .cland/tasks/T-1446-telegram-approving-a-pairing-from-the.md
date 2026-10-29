---
id: T-1446
kind: task
title: "Telegram: approving a pairing from the CLI sends no confirmation to the phone"
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1196
branch: t/T-1446-telegram-approving-a-pairing-from-the
created: 2026-10-29T16:50:28.430Z
updated: 2026-10-29T17:30:51.042Z
---

## Summary

Found in the v0.3.0 live run (E-1314, QA qa-677, step L2, topic-1195, A-13818), on the real @cland_app_bot against the sandbox hub at dev 189d5100. The human pressed Start and got the code. `./sbx remote approve telegram <code>` succeeded, and the stored numeric identity matches the phone. But no confirmation reached the phone. The human's words: «Ничего не пришло в бот». At 16:46:59Z the remote's `lastOutbound` still predated the approval, and the outbox was 0, so no confirmation was ever queued.

## What to build

Find why approval queues no "Paired with <project>" line on Telegram. The spec and the prototype send it, and Discord edits its pairing reply to "Approved". Make the approval send exactly one confirmation through the durable outbox, and then send any open cards as the spec says. Cover it with a production-frame test on the fake Bot API that is red before the fix.

## Acceptance criteria

- [x] C1. After `cland remote approve telegram <code>`, the paired chat receives exactly one confirmation through the outbox, shown by a T2 production-frame test on the fake Bot API, red before the fix.
  - done: impl-1446 · 2026-10-29T16:59:07.822Z
- [x] C2. Open cards are sent after the confirmation, in order.
  - done: impl-1446 · 2026-10-29T17:08:18.361Z

## Comments

### impl-1446 · 2026-10-29T16:55:34.784Z

Consumer search before change: pairing.approve production callers are hub/src/cli/remote.ts, hub/src/setup/hub.ts and nvim/lua/cland/pairing_card.lua. Shared callback traverses dispatch.ts → daemon.ts/configuration.ts → gateway.ts; Discord implements pairingApproved, Telegram does not. Existing fake messenger/legacy adapter tests exercise optional callback compatibility. Production-frame tests include pairing-approval, telegram-pairing, setup-remote-component, remote-workbench, telegram-mute, doctor-remotes and web-authority; UI pairing tests and qa/briefs/E-1313.md consume unchanged approval frames. No frame/schema/admission change planned: add existing optional adapter hook to Telegram only. Legacy adapters, persisted outbox readers and other tiers retain their shapes. Seam agreed by assignment: production frames/CLI and fake Bot API.

### impl-1446 · 2026-10-29T17:04:56.625Z

Review M2 extends the consumer inventory to TelegramOutbox: existing payload.key gains an internal pairing-confirmation prefix; no schema or wire fields change. Consumers searched: telegram-outbox.ts enqueue/dedup/held/complete/resume and tests, TelegramRemote publication/poll recovery, RemoteStore outbox persistence (state.ts), generic outbox.ts and existing payload fixtures (Telegram API/mute/cards/artifact/pacing/restart tests). Old payloads without the prefix remain unheld; no external client parses this prefix. Card admission will consult queued/sending confirmations durably per chat, so live/coalesced cards cannot overtake a paced confirmation after restart. Uncertain sends retain their existing replay fences and settled failure policy.

### rev-26 · 2026-10-29T17:05:13.542Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1446-source-1
commit: 3327b52ad0fef47a2cca13ccf7a294101df48a2c
scope: full
findings: [{"severity":"medium","text":"M1: REMOTE_USAGE changed without owning frozen commands.json migration; unchanged compatibility/root+remote help guards fail. Retain guard sources and red/green, migrate only owning row.","file":"hub/src/cli/usage.ts"},{"severity":"medium","text":"M2: parallel inbox/ask/approval publications can enqueue prioritized cards while plain confirmation waits for pacing; Outbox reselects after beforeNext, allowing cards before confirmation. Gate card admission/publication through settlement and add pending-slot/live-publication native regression.","file":"hub/src/remote/telegram.ts","line":562},{"severity":"medium","text":"M3: new until/native request observers and raw UI acquisition lack shared cancellation/join disposal through failed triggers/setup. Own them before invocation and join before Store/fake/root closure, preserving durable native assertions.","file":"hub/test/telegram-pairing.test.ts","line":58}]
finding_counts: {"high":0,"medium":3,"low":0}

A-13836 full10-file source audit complete M1–M3 only. Missing optional hook root cause identified; C1 route through committed pairing/durable outbox source-established but runtime unverified. C2 ordering invariant fails across receive and callback publication routes. Consumer inventory/docs/T2 placement checked; no wire/schema change, skill freeze respected. Lead working fixes outsidehead; fresh source before verify. Local A13826 summary not configured execution evidence; no Reviewer workloads.

Criteria: C2 failed (Other card publications can overtake the plain confirmation job while its paced send is pending.).

### rev-26 · 2026-10-29T17:30:51.042Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1446-source-2
commit: 1ab83f4e1506fe20f04d0cef956e61ead83fe364
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13868 complete8-file correction and extendedoutbox consumers audited. M1 exact REMOTE_USAGE-only frozen insertion/guardsunchanged. M2 persisted queued/sending confirmation-key gate filters every card/edit path per chat before comparator, survives pacing/429/restart; unknown replay semantics retained. Live publication red reproduced in localsummary; four new ordered variants preserve exact5native/sent rows. M3 owner-observed abortable native reads/poll/close/welcome + joined current predicates and synchronous prehello frame ownership, workbench native observers owned. SourceA13836 carried forward/no further findings. C1/C2 done/runtime pending; localA13840 notconfigured proof. No Reviewer workloads/full-all request, QA none; frozenhead modefree then original-record review.
