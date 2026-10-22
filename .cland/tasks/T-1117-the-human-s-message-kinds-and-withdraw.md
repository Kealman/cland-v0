---
id: T-1117
kind: task
title: The human's message kinds and Withdraw in the hub
state: open
status: review
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
updated: 2026-10-22T15:58:34.671Z
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
- [x] C2. A Question addressed to a session leaves the topic waiting for that session, as `cland` reads the topic (test).
  - done: impl-1117 · 2026-10-22T15:41:17.085Z
- [x] C3. Withdrawing a message queued for a busy fake session moves it to `withdrawn`, returns its text, and the session never receives it, also after the turn ends (test).
  - done: impl-1117 · 2026-10-22T15:41:17.167Z
- [x] C4. A withdraw after the message was injected is refused naming the stage, and an agent's withdraw and another sender's message are refused (test).
  - done: impl-1117 · 2026-10-22T15:41:17.456Z
- [x] C5. Neovim's thread shows a withdrawn message with the dropped glyph and colour (test).
  - done: impl-1117 · 2026-10-22T15:33:38.995Z
- [x] C6. `hub/README.md` and `nvim/README.md` describe the kinds and the withdraw (docs).
  - done: impl-1117 · 2026-10-22T15:33:39.077Z
  - verified: rev-32 [reviewer] · run rev-20261022-1117-source-2 · 2026-10-22T15:42:06.382Z · commit 74e5f348ca0cc7196f2b413282f6f20cdc418925

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
