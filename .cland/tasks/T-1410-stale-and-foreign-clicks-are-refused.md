---
id: T-1410
kind: task
title: Stale and foreign clicks are refused privately, and /cland inbox re-sends the open cards
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1407
  - T-1409
topic: topic-1168
branch: t/T-1410-stale-and-foreign-clicks-are-refused
created: 2026-10-27T23:38:47.898Z
updated: 2026-10-29T00:12:06.425Z
closed: 2026-10-29T00:12:06.425Z
---

## Summary

A click on a closed card gets "Already answered" privately and changes nothing. A click or modal submission from anyone but the paired human is refused privately and changes nothing. `/cland inbox` re-sends every open card at the bottom of the channel, or says "Nothing needs you".

## What to build

**Stale clicks.** A click on a card whose ask is closed is answered with an ephemeral "Already answered" and makes no hub write. So is a click the hub refuses because another client won. If that copy still shows buttons, its outcome edit is queued.

**Foreign clicks.** A click or `MODAL_SUBMIT` from another member gets an ephemeral "This card is for the project's owner" and sends no frame.

**Bad custom ids.** A custom id the hub did not issue, or one naming another ask than its message's mapping, is refused privately and changes nothing.

**`/cland inbox`.** It re-sends every open card oldest first at the bottom, with a re-send key separate from the live copy, as Telegram's `/inbox` uses. It answers ephemerally with the count, or "Nothing needs you".

Spec §3.5 (stale and foreign taps, order), §3.10 (`/inbox`); research rule 25.

## Acceptance criteria

- [x] C1. A click on a card whose ask was answered elsewhere gets an ephemeral "Already answered", sends no answer to the hub, and leaves the card without buttons (test).
  - done: impl-1410 · 2026-10-28T23:49:17.316Z
  - verified: rev-31 [reviewer] · run rev-20261029-1410-final1 · 2026-10-29T00:07:33.000Z · commit 29de634d7bd69175801fb90164936f6eb72d82e6
- [x] C2. Another member's click and modal submission are refused ephemerally and change neither the card nor the ask (test).
  - done: impl-1410 · 2026-10-28T23:40:55.834Z
  - verified: rev-31 [reviewer] · run rev-20261029-1410-final1 · 2026-10-29T00:07:33.000Z · commit 29de634d7bd69175801fb90164936f6eb72d82e6
- [x] C3. A custom id the hub did not issue, or one naming another ask than its message, changes nothing (test).
  - done: impl-1410 · 2026-10-28T23:40:55.925Z
  - verified: rev-31 [reviewer] · run rev-20261029-1410-final1 · 2026-10-29T00:07:33.000Z · commit 29de634d7bd69175801fb90164936f6eb72d82e6
- [x] C4. `/cland inbox` re-sends every open card oldest first at the bottom of the channel, or answers "Nothing needs you" (test).
  - done: impl-1410 · 2026-10-28T23:44:35.227Z
  - verified: rev-31 [reviewer] · run rev-20261029-1410-final1 · 2026-10-29T00:07:33.000Z · commit 29de634d7bd69175801fb90164936f6eb72d82e6

## Notes

Shared files: discord-interactions.ts, discord-commands.ts, discord-cards.ts

## Comments

### impl-1410 · 2026-10-28T23:38:35.969Z

Consumer inventory before changes (rule 20): DiscordCards/DiscordCommands are constructed only by remote/discord.ts; DiscordOutbox.card is called by DiscordCards and discord-cards.test.ts. Native callback consumers: fake Discord REST/ws and discord-cards.test.ts; command consumers: discord-commands/pairing/messenger tests. Shared inboxPublication, RemoteStore mappings/closure readers and Outbox delivery/recovery remain compatible. Searched hub/web/nvim, docs and shipped skills including T3/T4; no wire/schema change planned. Add optional internal resend key/callback, preserving historical payloads and existing command shapes. Admission changes are confined to mapped Discord card interactions; gateway authority stays unchanged. Coverage seam: production hub frame port + sealed fake Discord REST/ws, as pre-authorized by epic.

### rev-31 · 2026-10-28T23:44:24.319Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261028-1410-source1
commit: 9a0652af175e8f2f52654db28120b9a2394153f6
scope: full
findings: [{"severity":"medium","text":"M1: losing private follow-up is suppressed when accepted type6 acknowledgement loses/rejects its response. Issue owed refusal independently while joining acknowledgement settlement; add owned native uncertainty control.","file":"hub/src/remote/discord-cards.ts","line":103},{"severity":"medium","text":"M2: inbox.list awaits after identity admission, then publisher captures replacement pairing; obsolete command can publish under new authority. Preserve/recheck admitted guild/channel/user before enqueue, with held replacement/unpair settlement controls.","file":"hub/src/remote/discord-commands.ts","line":189},{"severity":"medium","text":"M3: explicit inbox resend never resets persisted unavailable; neutral lane skips new card while command reports count. Probe restored native delivery on explicit resends, preserving proof/nonce/source fences, and retain native mapping regression.","file":"hub/src/remote/discord-outbox.ts","line":49}]
finding_counts: {"high":0,"medium":3,"low":0}

A-13524 consolidated source1 not clear: Standards0, Spec3medium. Existing T2 seam/lifecycle valid; happy paths retain required assertions. Implementer reports replacement2!==1 and unavailable-count/no-mapping reds, no unpair red claim. Working corrections not reviewed at this head. T-1411 owns approvals/notices. No Reviewer workloads or Linux evidence. Complete corrections on same base, restore supported claimant marks, fresh source before mode-free verify.

Criteria: C1 failed (Accepted type6 with lost native response suppresses the owed private loser refusal.), C4 failed (New inbox resends cross replaced pairing authority and cannot probe recovery from persisted unavailable.).

### rev-31 · 2026-10-28T23:46:03.283Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261028-1410-source2
commit: d3a384f47435034375143a24678c5d001b578eca
scope: full
findings: [{"severity":"medium","text":"M4: parallel followup can precede native type6 acceptance; existing fake rejects unacknowledged followup404/10015. Current control releases losing result only after callback receipt. Catch/join defer settlement without requiring success before followup; add owned held-pre-accept ordering control, retaining accepted-lost response case.","file":"hub/src/remote/discord-cards.ts","line":105}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13525 consolidated source2 not clear, M4 only. M2 captured-identity check and M3 explicit availability probe resolved in source with native settlement controls; unchanged nonce/source/proof. M1 success-gating removed but Promise.all drops required ack ordering. Standards0/Spec1medium. Source-identified issue, no Reviewer runtime red or Linux proof. Same-base correction/fresh review before verify; C1–C4 runtime-unverified.

Criteria: C1 failed (Private loser followup can race before type6 acceptance and be rejected.).

### rev-31 · 2026-10-28T23:48:30.507Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261028-1410-source3
commit: 1ac2deb4422e3f49fc0b1175be03d30a29fa9dec
scope: full
findings: [{"severity":"medium","text":"M5: real100ms release after only outbound inbox.list start does not prove the losing continuation consumed its result before type6 acceptance. Under load old parallel code can pass. Replace elapsed selector with an owned deterministic boundary trace/receipt, retaining final native refusal, lost-response and exact callback assertions.","file":"hub/test/discord-cards.test.ts","line":582}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13526 source3 not clear, consolidated M5 only (timer at582; nearby final observer584). M4 production ordering fixed via caught defer settlement before followup; M2/M3 remain resolved. Standards1medium, Spec0remaining product findings. Local reported32/32/typecheck not Linux proof; no Reviewer workload. Same-base deterministic-control correction/fresh source before mode-free verify. Criteria remain runtime-unverified.

### rev-31 · 2026-10-28T23:49:59.496Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261028-1410-source4
commit: 6c5f9846582e5ca7a5ecfb3d3da1c7916b5b72f0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13527 full source4 clear; M1–M5 resolved. Exact consumed-result trace replaces elapsed selector, gate pre-owned and setup independently bounded, native final followup/type6/winner assertions retained. Optional log sink contains fixed event names only; async fake hook backward-compatible. Captured inbox identity recheck and explicit resend availability preserve proof/nonce/source fences. Same dev base. Local reported32/32/typecheck/sensitivity trace remains macOS evidence; C1–C4 runtime-unverified. No Reviewer workloads/full run/per-itemQA requested.

### rev-31 · 2026-10-28T23:50:40.995Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261028-1410-evidence1
commit: 6c5f9846582e5ca7a5ecfb3d3da1c7916b5b72f0
scope: evidence
findings: [{"severity":"medium","text":"M6: configured admission refused manual setup timer as wall-clock-wait1 above frozen0. Keep receipt/trace and independent bound using established owner/deadline or documented intentional-bound policy; do not relax allowance or bypass admission. Fresh source before resubmit.","file":"hub/test/discord-cards.test.ts","line":579}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13528: actual hub refusal720f3b09 was before execution, not a runtime test failure or Linux pass. No configured run/tier/executor finish exists. C1–C4 unverified. Source production fixes remain scoped in A-13527; blocker is static admission. No Reviewer workloads.

### rev-31 · 2026-10-28T23:51:05.197Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261028-1410-source5
commit: 29de634d7bd69175801fb90164936f6eb72d82e6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13529 source5 clear: only native-arrival setup observer changes from bespoke timer race to established until1500ms. Actual callback entry readiness remains separate from consumed-result trace; exact final ordering/native/private/type6 assertions and pre-owned gate unchanged. No allowance/production/base change. A-13528 retains admission refusal as not executed. Targeted macOS/typecheck at current tree, earlier32/32 at prior tree. C1–C4 runtime-unverified. No Reviewer workloads/full task run requested.

### rev-31 · 2026-10-29T00:07:33.000Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1410-final1
commit: 29de634d7bd69175801fb90164936f6eb72d82e6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13533 final configured evidence clear; C1–C4 verified at unchanged source5 head. Original A-13531 independently parsed4053 ordinary passes+80 separate load samples,32card cases including9new each5/5(max.691443944s); foreign/modal/forged exact no-frame/native assertions retained. Ack ordering/lost-response, obsolete inbox identity, restored mapping and all-copy closure controls pass. T0/allT1/fallbackallT2/Web complete,T3/T4 absent; Linux/CHS/host-tree/report-only warnings retained. Historical refusalA-13528 stays not executed. No Reviewer workloads/full-all or live-platform claim; Coordinator owns separate merge/coverage gate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-29T00:12:06.425Z

Merged 80d2bbcf16665e04c5853e06dc9b84ac88c18af7 onto dev.
