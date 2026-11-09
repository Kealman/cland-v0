---
id: T-1775
kind: task
title: "Hub cards: asks the hub raises and answers itself"
state: open
status: in progress
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by: []
topic: topic-1455
branch: t/T-1775-hub-cards-asks-the-hub-raises-and
created: 2026-11-09T12:44:08.860Z
updated: 2026-11-09T13:06:30.939Z
---

## Summary

The hub can raise a card itself: an ask from `hub` in a topic, with options and an optional free answer, whose answer goes to a hub handler registered for the card's kind instead of to a session. It shows in the inbox frame, the web and Neovim inboxes, and on Telegram and Discord through the v0.3 card model. The first answer wins, every copy folds, and the remotes' authority table gains no request.

## What to build

A hub card service over the asks store with three operations:
- `raise(kind, topic, question, options, free, payload)`, which returns the card id;
- `withdraw(id, reason)`;
- `onAnswer(kind, handler)`.

A card is stored with its kind and payload, so a pending card survives a restart and its handler is found by kind at start. An answer for a kind with no handler keeps the card open and is logged. Answering uses the existing human ask-answer path (the frames and the remote buttons), routed by `from: hub` to the handler, and the handler's result becomes the outcome line. A card may mark its free answer secret, as T-1791's pasted code is. A secret answer reaches the handler verbatim; history, the journal, the log and mirrored topics hold only "answered". The login cards of T-1785, T-1789 and T-1791 use this service; this ticket tests it with a test kind.

## Acceptance criteria

- [x] C1. A hub-raised card appears in the inbox frame as an ask from `hub` with its options, and on the test messenger as a card on Telegram and on Discord (test).
  - done: impl-1775 · 2026-11-09T12:58:25.291Z
- [ ] C2. An option answer from the web, Neovim, Telegram or Discord calls the kind's handler once with the payload and the answer, is never delivered to a session, and folds the card on both remotes with its outcome line (test).
  - failed: rev-37 [reviewer] · 2026-11-09T13:06:30.939Z · note Deferred Discord interaction edit overwrites the handler outcome after settling; hub-card outcome/departure also omits admitted userId.
- [x] C3. A second answer after the first is refused as already answered, and `withdraw` folds every copy with its reason (test).
  - done: impl-1775 · 2026-11-09T12:58:27.124Z
- [x] C4. A pending card survives a hub restart with its payload, and an answer after the restart reaches the handler registered at start (test).
  - done: impl-1775 · 2026-11-09T12:58:28.024Z
- [ ] C5. A secret free answer reaches the handler verbatim and appears in no history row, journal record, log line or remote outcome line (test).
  - failed: rev-37 [reviewer] · 2026-11-09T13:06:30.939Z · note Native Telegram replay state retains secret plaintext, and native Discord decline output republishes it; both exact-head native controls reproduced red.
- [x] C6. The remotes' authority table is unchanged, entry for entry (test).
  - done: impl-1775 · 2026-11-09T12:58:30.900Z

## Blocked by

None (can start immediately)

## Notes

- Hot files: `hub/src/hub/hub-cards.ts` (new), `hub/src/hub/asks.ts`, `hub/src/hub/store.ts` (kind and payload on asks), `hub/src/hub/inbox.ts`, `hub/src/remote/cards.ts` (outcome line), `hub/src/remote/redact.ts`. Registration point: `hub/src/protocol.ts` (an ask from `hub`).
- Tests: new `hub/test/hub-cards.test.ts` (T2, `projectHub` with the test messenger's Telegram and Discord fakes); the authority-table check (T1).
- ADR 0003: cards are raised by the hub. Serves epic C6 and C7 (the card model for every login card).

## Comments

### impl-1775 · 2026-11-09T12:47:58.375Z

Rule-20 sweep before contract edits: suite importingTests graph reached 670 tests and 15 unknowns (all counted reached), full list artifact A-18046; explicit field/frame/store consumers across production, web, Neovim, shared, docs, QA and skills in A-18045. Preserve previous ask wire shape: kind/payload/secret are store-only, existing AskCard and InboxAsk fields unchanged; hub uses existing fromKind hub. Ordinary answer path stays unchanged, new service routes only durable hub-kind rows. Approved extras: one core HubCards registration, harness-only startup registration hook, dispatch topic.answer secret replay digest. First local macOS Node v24.15.0 targeted T2 red: Cannot read properties of undefined (reading raise); 0/1 pass. No native tests run.

### impl-1775 · 2026-11-09T12:49:42.157Z

Correction to preceding evidence: graph artifact is A-18047, Node is v24.13.0 (from node --version), not the guessed values in the preceding comment. First T2 slice now passes locally (1/1, 106 ms case time); no verification receipt yet.

### impl-1775 · 2026-11-09T12:56:03.532Z

Local evidence correction: the actual supported runtime is Node v24.21.0 (confirmed twice from command output). Earlier guessed version strings were incorrect. Nine card cases plus the T1 authority check pass on the working tree; existing asks.test.ts also passed 11/11. Both native fake remotes fold after web, Neovim, Telegram, Discord and withdrawal. No Linux verify or T3/T4 evidence yet. Shared validation now uses exported askOptions for both Coordinator and hub cards.

### rev-37 · 2026-11-09T13:06:30.939Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1775-source-1
commit: 525467425176b617c4a94b9773a96fc51e907150
scope: full
findings: [{"severity":"high","text":"Native Telegram freezes raw secret answer.fields in telegram.answer-input before dispatch and retains it after stored:true; Dispatcher digest does not protect this SQLite receipt. Actual native free-answer red reproduced at the unchanged head; injected testMessenger bypasses this consumer.","file":"hub/src/remote/telegram-prompts.ts","line":128},{"severity":"high","text":"Returned message has no authoritative ask outcome, so DiscordCards line 201 reconstructs secret declines from raw input and ordinary replies from selected text. Native secret callback and deferred final-card overwrite both reproduced red; deferred edit also retains the raw content in outbox. Consume the redacted handler outcome and assert final content after the interaction edit settles.","file":"hub/src/hub/hub-cards.ts","line":74},{"severity":"medium","text":"Both outcome variants omit the admitted user.id, retaining only mutable user.name; ordinary Asks.answer preserves outcome.userId. Independent ask/departure attribution loses stable identity despite the answer Message retaining it. Cover users-mode option/free/decline outcomes and departures.","file":"hub/src/hub/hub-cards.ts","line":77}]
finding_counts: {"high":2,"medium":1,"low":0}

Full source review at 525467425176b617c4a94b9773a96fc51e907150: not clear. A-18073 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-18073-t-1775-full-source-review-at-525467425-not-clear.md) contains Standards/Spec assessment, all three findings and evidence limits. Update after that artifact was published: Implementer report 14f686eb-c388-47c7-80c8-38f66387a48c also reproduces the ordinary deferred overwrite: held answer, observed type-6 defer, released dispatch, observed discord.press own edit sent, stopped/joined hub, final assertion 'final native card lost the handler outcome' failed false !== true. Thus all three native probes are red at this exact unchanged head; these are Implementer-executed isolated macOS Node 24.21.0 receipts, not Reviewer-run tests. Earlier reported Telegram/Discord secret assertions failed true !== false. No Reviewer tests/typecheck/browser/full suite ran. Store-only wire metadata, shared option validation, transaction rollback, restart/missing-handler source and unchanged authority table were reviewed. No criterion is verified here; C2/C5 failed, others remain run-dependent. T-1791 native pasted-message deletion is outside these retained-data/outcome defects. Fresh corrected-head source review is required before configured verification. Affected after-stage QA remains separate.

Criteria: C5 failed (Native Telegram replay state retains secret plaintext, and native Discord decline output republishes it; both exact-head native controls reproduced red.), C2 failed (Deferred Discord interaction edit overwrites the handler outcome after settling; hub-card outcome/departure also omits admitted userId.).
