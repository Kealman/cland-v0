---
id: T-1117
kind: task
title: The human's message kinds and Withdraw in the hub
state: open
status: ready
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by: []
topic: topic-854
branch: t/T-1117-the-human-s-message-kinds-and-withdraw
created: 2026-10-22T15:16:12.522Z
updated: 2026-10-22T16:08:35.428Z
---

## Summary

`topic.send` gains the kind of the human's message (Message, Decision, Question), and the protocol gains a withdraw for a message that waits for a busy session and has not reached its turn yet. Neovim shows a withdrawn message as it shows a dropped one.

## Parent

E-417 (§3.4 the composer; choices "The human's kinds" and "Withdraw"; the hub half of tracer step 4).

## What to build

The human's `topic.send` takes an optional kind, `message` by default, `decision` or `question`; the message records it, and history reads and the `message` delta carry it so both clients can name it in the header. A Question addressed to a session leaves the topic waiting for that addressee; a Message and a Decision keep today's rule, under which every human message leaves the topic waiting for its addressees.A new request withdraws one of the human's own messages while no addressee's delivery has been injected: the deliveries move to the new stage `withdrawn`, nothing reaches the session, the message delta reports the stage, and the result returns the text so the client can put it back into its composer. Once any delivery is injected the withdraw is refused naming the stage. An agent cannot withdraw; the web edge allows the request for the human. Neovim draws the `withdrawn` stage with the dropped glyph and colour. The wire types gain the kind and the stage in the shared module the web imports.

## Acceptance criteria

- [x] C1. A Decision and a Question sent by the human carry their kind on the message, in a later history read and in the delta a second frame client receives (test).
  - done: impl-1117 · 2026-10-22T15:41:16.997Z
  - verified: rev-32 [reviewer] · run rev-20261022-1117-final · 2026-10-22T16:08:35.244Z · commit 0c5a6c6a57e6f0def3489c9b638e7027003cdb3b
- [x] C2. A Question addressed to a session leaves the topic waiting for that session, as `cland` reads the topic (test).
  - done: impl-1117 · 2026-10-22T16:01:03.386Z
  - verified: rev-32 [reviewer] · run rev-20261022-1117-final · 2026-10-22T16:08:35.244Z · commit 0c5a6c6a57e6f0def3489c9b638e7027003cdb3b
- [x] C3. Withdrawing a message queued for a busy fake session moves it to `withdrawn`, returns its text, and the session never receives it, also after the turn ends (test).
  - done: impl-1117 · 2026-10-22T15:41:17.167Z
  - verified: rev-32 [reviewer] · run rev-20261022-1117-final · 2026-10-22T16:08:35.245Z · commit 0c5a6c6a57e6f0def3489c9b638e7027003cdb3b
- [x] C4. A withdraw after the message was injected is refused naming the stage, and an agent's withdraw and another sender's message are refused (test).
  - done: impl-1117 · 2026-10-22T15:41:17.456Z
  - verified: rev-32 [reviewer] · run rev-20261022-1117-final · 2026-10-22T16:08:35.245Z · commit 0c5a6c6a57e6f0def3489c9b638e7027003cdb3b
- [x] C5. Neovim's thread shows a withdrawn message with the dropped glyph and colour (test).
  - done: impl-1117 · 2026-10-22T15:33:38.995Z
  - verified: rev-32 [reviewer] · run rev-20261022-1117-final · 2026-10-22T16:08:35.245Z · commit 0c5a6c6a57e6f0def3489c9b638e7027003cdb3b
- [x] C6. `hub/README.md` and `nvim/README.md` describe the kinds and the withdraw (docs).
  - done: impl-1117 · 2026-10-22T15:33:39.077Z
  - verified: rev-32 [reviewer] · run rev-20261022-1117-source-2 · 2026-10-22T15:42:06.382Z · commit 74e5f348ca0cc7196f2b413282f6f20cdc418925
  - verified: rev-32 [reviewer] · run rev-20261022-1117-source-3 · 2026-10-22T16:02:24.554Z · commit 0c5a6c6a57e6f0def3489c9b638e7027003cdb3b
  - verified: rev-32 [reviewer] · run rev-20261022-1117-final · 2026-10-22T16:08:35.245Z · commit 0c5a6c6a57e6f0def3489c9b638e7027003cdb3b

## Comments

### impl-1117 · 2026-10-22T15:26:33.160Z

TDD progress: kind/history/second-client delta tests red→green; busy fake-session withdraw red→green; raw fake-spoke tests preserve progress and next-message delivery across accepted-before-injection and late ack. A regression for completed but unconfirmed adapter submission caught false withdrawal success; a durable injection-started fence now refuses it. Applying Coordinator's decision: only human Question creates a wait; Message/Decision preserve existing questions without starting waits. Neovim withdrawal renderer test added and protocol recordings refreshed (24/24 thread assertions, local macOS); full verification awaits source review.

### rev-32 · 2026-10-22T15:40:30.632Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261022-1117-source
commit: 8d2b23aec45c772f5afdfbae7de64db725bf89ad
scope: full
findings: [{"severity":"medium","text":"M1 Standards: both new kind/wait fixtures (178,197) and topic-withdraw.test.ts:87,167,175 use projectHub without FakeClock. D53 requires an injected complete fake clock for T2; ambient scheduling also contradicts the new withdrawal fixture documentation. Inject FakeClock at every new T2 boundary.","file":"hub/test/topics-component.test.ts","line":178},{"severity":"medium","text":"M2 Standards: stopping/restarting projectHub proves only persisted withdrawal/stage/wait/queue state, which docs/agents/tests.md Test placement requires proving by reopening Store in-process. Move the durability assertions to that seam and preserve the separate public busy/late-ack/next-turn negative delivery proof.","file":"hub/test/topic-withdraw.test.ts","line":174}]
finding_counts: {"high":0,"medium":2,"low":0}

A-9240 records the complete Standards/Spec audit. Medium M1: new T2 kind/wait/refusal fixtures omit FakeClock (topics-component.test.ts:178/197, topic-withdraw.test.ts:87/167/175), contrary to D53. Medium M2: topic-withdraw.test.ts:174–175 restarts the hub solely for durable state; use Store reopen per Test placement and preserve public-frame non-delivery/late-ack/next-turn assertions. No additional production/spec finding. Source covers the authorized shared Web fixture delta. No suite/runtime pass claimed; fresh source review at the corrected head precedes verification.

Criteria: C1 failed (New kind/history T2 fixture omits required FakeClock (M1).), C2 failed (New Question wait T2 fixture omits required FakeClock (M1).), C3 failed (Durability proof restarts projectHub instead of reopening Store; new restart fixtures also omit FakeClock (M2/M1).), C4 failed (New withdrawal refusal T2 fixture omits required FakeClock (M1).).

### rev-32 · 2026-10-22T15:42:06.382Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261022-1117-source-2
commit: 74e5f348ca0cc7196f2b413282f6f20cdc418925
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-9246 carries A-9240's full production/spec audit plus the complete correction review. M1 resolved with complete shared FakeClock in new T2 fixtures; M2 resolved with Store/HubCore reopen retaining open status, withdrawn stage, next-delivery receipt and non-delivery assertion. Public busy/accepted/late-ack/digest/broadcast assertions remain unchanged; no production changes. C6 verified from matching docs. C1–C5 source paths established but run-dependent evidence remains unverified until configured same-head verification. Local macOS targeted results in A-9244 are supplemental narrative evidence; no configured suite/Linux pass claimed. Mode-free verify may now run at this exact head.

Criteria: C6 verified.

### rev-32 · 2026-10-22T15:59:44.195Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261022-1117-local-evidence
commit: 74e5f348ca0cc7196f2b413282f6f20cdc418925
scope: evidence
findings: [{"severity":"medium","text":"M3: handover's intended pending human Question is sent without kind, so default Message no longer establishes the inherited status wait. A-9267 fails at :145: actual [['general','addressed',1]], expected [['general','status',1]]. Make setup explicitly question; retain status/claim/handover assertions.","file":"hub/test/handover.test.ts","line":81}]
finding_counts: {"high":0,"medium":1,"low":0}

A-9270 audits actual failed local run dafcfcb3/A-9267 at this head, Darwin arm64/local, Node24.21.0, machine workers4. Actual AssertionError at handover.test.ts:145: actual [['general','addressed',1]], expected [['general','status',1]]. Source setup :81 omits kind:'question'; update this intended Question, preserving the original assertions. Host check/T1 completed; T2 has one failure; aggregate reported2058 tests/2057 pass/1 fail, Web unexecuted, no T3/T4 or Linux runtime receipt. Generic budgets/lint/ratchet report-only. No final C1/C3/C4/C5 verification from this failed partial run. Fresh source review on corrected head before new mode-free verify.

Criteria: C2 failed (Question-only wait contract migration leaves handover fixture implicit Message; same-head local T2 fails expected inherited status wait (A-9267).).

### rev-32 · 2026-10-22T16:02:24.554Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261022-1117-source-3
commit: 0c5a6c6a57e6f0def3489c9b638e7027003cdb3b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear A-9272, carrying complete audit A-9240/A-9246. M3 resolved by the sole added kind:'question' field at handover.test.ts:81; original inherited status-wait and all handover/claim/note/permission assertions unchanged. No production/resources/docs changes or remaining findings. C6 matching docs source-verified at this head; C1–C5 run-dependent paths established but await fresh configured same-head evidence. A-9271 local targeted handover/typecheck narrative is supplemental; A-9267 at previous head remains failed partial evidence. Mode-free verify may run at this exact head; no runtime green or Linux pass claimed.

Criteria: C6 verified.

### rev-32 · 2026-10-22T16:08:35.245Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261022-1117-final
commit: 0c5a6c6a57e6f0def3489c9b638e7027003cdb3b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear A-9278: fresh same-head run1cbd8ffb/A-9275 exits0 on local Darwin arm64 automatic capacity fallback, Node24.21.0/Neovim0.12.5. Host T0 check, T1, all-T2 hub+Neovim, Web complete; aggregate2457 pass/0fail/0skip. Eleven new identities each have completed5/5 load receipts. C1 kind/history/peer delta, C2 Question wait/addressee plus retained handover status wait, C3 busy withdrawal/late ack/progress/next-turn and Store reopen, C4 injected/agent/other-sender/submission/broadcast refusal, C5 recorded Neovim glyph/colour/old-stage rejection pass. C6 docs carried from same-head source A-9272. Generic budgets, lint and T3 ratchet report-only; zero lint refusals. No Linux/T3/T4 or integrated full-suite pass claimed. Prior red/capacity receipts remain historical. All criteria verified, no remaining findings; inherited affected/after-stage QA remains separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.
