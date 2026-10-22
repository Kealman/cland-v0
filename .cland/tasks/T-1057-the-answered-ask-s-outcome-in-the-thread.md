---
id: T-1057
kind: task
title: The answered ask's outcome in the thread and the inbox departure
state: open
status: review
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
topic: topic-836
branch: t/T-1057-the-answered-ask-s-outcome-in-the-thread
created: 2026-10-21T14:04:15.186Z
updated: 2026-10-22T06:55:36.643Z
---

## Summary

Carry an answered ask's outcome into its thread and into the inbox's departure, so a client folds it in place to one line.

## Parent

E-413 (§3.4 "The answered ask" and "The inbox's leave rule, refined"; tracer step 4).

## What to build

An ask's record carries its outcome for good: the option or the free answer, who answered and when. The thread shows it, and the inbox's departure reports the row as `answered` with that outcome. How long a client keeps the folded row is the client's choice; the hub reports the outcome.

## Acceptance criteria

- [x] C1. Answering an ask with an option makes its thread entry carry the option, the answerer and the time, also on a later history read (test).
  - done: impl-1057 · 2026-10-22T06:52:43.954Z
- [x] C2. The inbox's departure for that row says `answered` with the same outcome (test).
  - done: impl-1057 · 2026-10-22T06:52:44.042Z
- [x] C3. A free-text answer is carried the same way (test).
  - done: impl-1057 · 2026-10-22T06:52:44.116Z
- [x] C4. `hub/README.md` describes the outcome fields and the departure.
  - done: impl-1057 · 2026-10-22T06:52:44.193Z
  - verified: rev-32 [reviewer] · run rev-20261022-1057-source-2 · 2026-10-22T06:55:36.643Z · commit 18709f18dc6b2a67f992c91bdb994d53a45c0c72

## Comments

### impl-1057 · 2026-10-22T06:41:18.051Z

Implemented durable AskCard.outcome {status, text, option?, by, at}, with a declined/reason union variant reserved for T-1059. Inbox departures persist the identical outcome, publish pending departures on the next coalesced event, and retain them in archive reads across restart. Added three criterion-level T2 public-frame tests with disposable projectHub/FakeClock; C1 and C2 observed missing-field red assertions before their implementation; C3 exercises the shared path for multiline text and stand-in attribution. Targeted Darwin arm64 checks: ask-outcomes 3/3, asks 11/11, inbox-actions 5/5, ask-chain 13/13; root typecheck passed; test lint report mode has zero refusals. No Linux or full-suite receipt yet. README and test guidance updated. Proposed durable-outcome retention rule to the supervising lead in the item topic.

### rev-23 · 2026-10-22T06:47:59.546Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1057-source
commit: 4ba70438ded15f4a39259afdcff99841baa63340
scope: full
findings: [{"severity":"medium","text":"M1 (Spec/C2-C3): A human ask answered before any inbox list/projection can lose its departure and archive outcome entirely. Wait rows are registered only from currently open asks at line330; createAsk does not register one. If the ask closes before that first read, it is absent from both open asks and inboxWaits, and departInbox also refuses an ask with no wait row (store.ts:1610). The new C3 test does not prevent the unrelated asynchronous journal projection from calling inbox.list first (core.ts:597/631), so its local pass does not prove the no-first-projection case. Make rapid answered asks durably settle without that incidental read, and add a deterministic test that holds/disables the journal inbox projection through answer, then observes exactly one matching departure/archive outcome.","file":"hub/src/hub/inbox.ts","line":309},{"severity":"medium","text":"M2 (Standards): The changed exact-card assertion requires outcome.at to equal answer.message.ts under the default real clock (hubFor(t) at line99). Asks.answer samples its timestamp before synchronous closeAsk/SQLite work, while sendFromHuman samples the message timestamp later; real time may cross a millisecond or advance substantially on Linux storage. This introduces a timing-dependent failure unrelated to the specified outcome. Inject a complete FakeClock into this case (as in the new outcomes tests) while retaining the exact-card assertion, or establish one canonical production timestamp if equality is the intended contract. See docs/agents/tests.md 'When you write or change a test': one complete Clock for timestamps/scheduling.","file":"hub/test/asks.test.ts","line":125},{"severity":"low","text":"L1 (Standards): C1 and C2 restart a whole projectHub solely to prove persisted outcome reads (also lines64–67). docs/agents/tests.md explicitly says to prove persistence by reopening the Store/Tracker in process, not stopping/restarting a hub. Keep public-frame live/history/departure assertions, and move persistence verification to the narrow Store reopen seam unless a separate hub lifecycle behavior is explicitly required.","file":"hub/test/ask-outcomes.test.ts","line":34}]
finding_counts: {"high":0,"medium":2,"low":1}

Full source not clear; fixed base918951c2, consolidated A-8976. Spec M1: ask closes before first inbox read => no wait row => no answered departure/archive; C3 may be masked by incidental journal projection. Standards M2: asks.test exact outcome.at===message.ts uses real clock across SQLite work; inject complete FakeClock/retain assertion. L1low: persistence-only new tests restart projectHub despite documented Store-reopen seam. Ordinary durability/relay/migration/wire/docs paths otherwise sound; C4 source matches. A-8970 is local summary only, no original suite receipt; no Reviewer execution/failure claim. C2 failed,all criteria unverified. Correct then fresh source review before mode-free verify; after-stage QA separate.

Criteria: C2 failed (Rapid answer before first inbox projection can leave no wait row, departure or archived outcome (M1; A-8976).).

### impl-1057 · 2026-10-22T06:52:44.369Z

Source-review corrections committed/pushed at 18709f18dc6b2a67f992c91bdb994d53a45c0c72 (tree b422874844ede3bd0c59ad86c13dc6c49225fa52); no dev merge after first source review. M1: human ask creation now atomically registers its durable inbox wait. C3 uses the existing no-journal startHub socket fixture, guaranteeing no incidental inbox projection before answer; exactly one matching departure/archive outcome and no repeated later departure. Original deterministic red A-8979 (actual departures undefined), first post-fix green A-8980. M2: the exact option-card assertion uses one complete FakeClock and explicit coalesced publication advance. L1: removed projectHub persistence restarts; added T1 Store reopen coverage for both option and multiline free-text outcomes, original first stdout A-8982. At this source, local Darwin arm64 targeted tests passed: ask-outcomes 3/3, asks 11/11, inbox-actions 5/5, ask-chain 13/13, store 28/28. Root typecheck passed; test/static lint passed with zero refusals in report mode. These direct checks are not Linux or configured-suite evidence. Fresh source review requested before mode-free verification; QA remains after-stage.

### rev-32 · 2026-10-22T06:55:36.643Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261022-1057-source-2
commit: 18709f18dc6b2a67f992c91bdb994d53a45c0c72
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear, Standards 0 findings / Spec 0 findings. Prior M1 resolved by atomic message+ask+inbox-wait registration before any projection; deterministic no-journal C3 observes the first completed departure, exact full outcome, one archive entry and no repeat at a later publication. M2 exact-card assertion now uses complete FakeClock with explicit coalesced publication advance. L1 persistence-only projectHub restarts removed; option/free-text reply-independent durability covered by T1 Store reopen. Full production/wire/rollback/departure/docs paths rechecked against base918951c2 and previous A-8976. C4 README source verified; C1–C3 run-dependent marks pending unchanged-head mode-free verify. Local A-8979/A-8980/A-8982 are labelled prior dirty-tree targeted support, not Linux/configured evidence. No reviewer execution. After-stage QA remains separate. Audit A-8985: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8985-t-1057-corrected-source-clear-at-18709f18.md.

Criteria: C4 verified.
