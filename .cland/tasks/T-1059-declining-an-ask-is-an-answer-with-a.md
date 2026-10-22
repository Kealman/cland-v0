---
id: T-1059
kind: task
title: Declining an ask is an answer with a reason
state: open
status: ready
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by:
  - T-1057
topic: topic-840
branch: t/T-1059-declining-an-ask-is-an-answer-with-a
created: 2026-10-21T14:04:19.059Z
updated: 2026-10-22T07:54:28.169Z
---

## Summary

Make declining an ask an answer with the value `declined` and a reason that the asker receives, with the topic left open.

## Parent

E-413 (§3.4 "Declining"; tracer step 5).

## What to build

`topic.answer` takes `declined: true` with a non-empty reason. The asker's delivery reads `declined: <reason>`. The topic stays open and may ask again; there is no separate "ask me later". The outcome travels through the thread and the inbox's departure as `declined`, with who and when. Neovim shows a declined ask folded with its reason; declining from Neovim is not part of 0.2.0. The role clauses say a declined ask is a decision, never consent (ADR 0007: it reaches the asker as a delivery).

## Acceptance criteria

- [x] C1. A fake Implementer's ask declined with a reason delivers `declined: <reason>` to the asker, and its topic stays open for its next ask (test).
  - done: impl-1059 · 2026-10-22T07:40:36.857Z
  - verified: rev-23 [reviewer] · run rev-20261022-1059-final · 2026-10-22T07:54:27.877Z · commit 94b619b90cf7853499292f29c4a4590ee7bad3e0
- [x] C2. Declining without a reason is refused (test).
  - done: impl-1059 · 2026-10-22T07:40:36.952Z
  - verified: rev-23 [reviewer] · run rev-20261022-1059-final · 2026-10-22T07:54:27.877Z · commit 94b619b90cf7853499292f29c4a4590ee7bad3e0
- [x] C3. The thread and the inbox's departure carry `declined` with the reason, who and when (test).
  - done: impl-1059 · 2026-10-22T07:40:37.025Z
  - verified: rev-23 [reviewer] · run rev-20261022-1059-final · 2026-10-22T07:54:27.877Z · commit 94b619b90cf7853499292f29c4a4590ee7bad3e0
- [x] C4. Neovim's thread shows the declined ask folded with its reason (headless test).
  - done: impl-1059 · 2026-10-22T07:40:37.192Z
  - verified: rev-23 [reviewer] · run rev-20261022-1059-final · 2026-10-22T07:54:27.877Z · commit 94b619b90cf7853499292f29c4a4590ee7bad3e0
- [x] C5. The role clauses state that a declined ask is a decision and never consent, within the clause byte reserve; `hub/README.md` and `nvim/README.md` describe declining.
  - done: impl-1059 · 2026-10-22T07:40:37.266Z
  - verified: rev-23 [reviewer] · run rev-20261022-1059-final · 2026-10-22T07:54:27.877Z · commit 94b619b90cf7853499292f29c4a4590ee7bad3e0

## Comments

### impl-1059 · 2026-10-22T07:40:37.372Z

Implemented and pushed 94b619b90cf7853499292f29c4a4590ee7bad3e0 (tree ccd654901710980afae7844533ca42d18d090124). Human decline frame, required reason, ordinary delivery, structured relay outcome, declined inbox departure/archive and recorded-frame headless Neovim folded rendering are complete. C1–C5 have local evidence; final clause audit A-9015 preserves the unchanged 6528-byte ceiling (largest 6526). Original root check log A-9017; related targeted Darwin arm64 files 74/74 plus unchanged thread 23/23 and final clause 27/27. Local check evidence only; no configured/Linux/load/T3 pass claimed yet. Source review requested before mode-free verify. T-1090 owns the unrelated stale thread fixture minimum; its slice/guard remain untouched.

### rev-23 · 2026-10-22T07:43:55.571Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1059-source
commit: 94b619b90cf7853499292f29c4a4590ee7bad3e0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-9022: source clear, Standards 0 / Spec 0 findings. Reviewed decline validation/delivery/relay, durable outcome and inbox reason, Neovim recorded folded rendering, all twelve clause wording changes and unchanged reserve assertions. C1–C5 final verification awaits ordinary mode-free same-head configured evidence; local targeted summaries do not establish Linux/load coverage. QA affected/after-stage, no per-item brief/criteria.

### rev-23 · 2026-10-22T07:54:27.877Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1059-final
commit: 94b619b90cf7853499292f29c4a4590ee7bad3e0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear: original A-9036 / 75793e29 matches accepted source head. Independently audited 2425 ordinary passes, 370 file passes, four owned identities each five distinct passing load receipts plus explicit 5/5 (20 total), and roles-clauses 27/27. C1–C5 verified with A-9022 source. Linux c-8 lon1, 532s/$0.0369; host bccf5bd0 reused, actual T1/all-T2/Web pass. Report-only lint/duration/ratchet overages retained; no T3/T4/stage/QA claim. Final artifact posted in topic.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
