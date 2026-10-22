---
id: T-1056
kind: task
title: Fold lines for runs of agent messages
state: open
status: in progress
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
topic: topic-837
branch: t/T-1056-fold-lines-for-runs-of-agent-messages
created: 2026-10-21T14:04:15.025Z
updated: 2026-10-22T06:53:22.937Z
---

## Summary

Fold a run of agent messages into one hub-built fold line made of facts, sent with the history pages and updated by a delta as the run grows.

## Parent

E-413 (§3.4 "The fold line"; tracer step 4).

## What to build

A run is consecutive agent-to-agent messages with nothing between them that never folds: an ask, a verdict, an answer, or anything to or from the human or an Aide (v0.1 §3.14). The hub gives each run an id and its first message number. Its fold line names the first three sessions and a count of the rest, the number of messages, the latest message's kind and first words, and its age. A model never writes it. The line comes with the history pages and in a delta each time the run grows. `nvim/lua/cland/thread.lua`'s folds define the run boundaries.

## Acceptance criteria

- [x] C1. Four messages between a fake Implementer and a fake Reviewer arrive as one run whose fold line names both sessions, four messages, the latest step and its age (test).
  - done: impl-1056 · 2026-10-22T06:48:21.430Z
- [x] C2. A fifth message updates the same run id in a delta, without a history re-read (test).
  - done: impl-1056 · 2026-10-22T06:48:21.512Z
- [ ] C3. An ask, a verdict, an answer, or a message to or from the human or an Aide ends a run, and the next agent message starts a new one (test).
  - failed: rev-23 [reviewer] · 2026-10-22T06:53:22.937Z · note Pruning an unrelated older row rebuilds a retained Aide boundary with current recipient roles and can fold it (M1; A-8984).
- [x] C4. A history page that starts mid-run carries that run's id and its full fold line (test).
  - done: impl-1056 · 2026-10-22T06:48:21.687Z
- [x] C5. `hub/README.md` describes runs and fold lines.
  - done: impl-1056 · 2026-10-22T06:48:21.859Z

## Comments

### impl-1056 · 2026-10-22T06:42:07.048Z

TDD at the brief's agreed T2 history/live-frame seams: C1 red was `one full run accompanies history: undefined !== 1`; C2 red was `the message delta carries the updated full run` (undefined); C3 red was a verdict incorrectly retaining a run id. Current four criterion tests pass locally on Darwin arm64 (~0.73 s file): complete factual line, same-id fifth-message delta, ask/verdict/answer/human/Aide boundaries plus midnight, and numeric/message-id mid-run pages with full metadata including first-three/+N. C4 passes using the existing full-run projection; no new reread behavior was needed. Persistence/legacy/byte-bound checks and docs are in progress; this is targeted development evidence, not queued verification.

### rev-23 · 2026-10-22T06:53:22.937Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1056-source
commit: a64440de3c07d775c60ca468950da22eeef844de
scope: full
findings: [{"severity":"medium","text":"M1 (Spec/C3): Retention deletes every run member/fact row for an affected topic, then rebuilds eligibility using today's roleOf(recipient) at1495. A surviving message sent to an Aide therefore becomes foldable if that recipient later changes role and an unrelated older message is pruned; previously separate runs merge and the Aide boundary receives runId. The current reopen/retention test deletes the Aide-boundary message too, so misses this. Preserve role-at-send/eligibility facts for retained messages while rebuilding run identities, and test pruning only an older unrelated row with the Aide boundary retained after its role changes.","file":"hub/src/hub/store.ts","line":1476},{"severity":"medium","text":"M2 (Spec/factual fold line): assignVerifierRequest rewrites a queued review/QA report's to_json from the role name to the selected session, but the new run facts were already appended at record and are never refreshed. Later #emitMessage(assigned) calls threadRuns, whose update only scans seq greater than its watermark, so both that delta and history can show message.to=['rev-23'] with participants/foldLine still naming 'reviewer'. Keep derived run participants synchronized with this existing durable recipient mutation (or apply a consistent never-fold rule), and add queued-verifier assignment coverage asserting the emitted message and full run agree without changing run identity or counts incorrectly.","file":"hub/src/hub/store.ts","line":1054}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source not clear; fixed base689b6f95, A-8984. Spec M1 retention clears stored membership then reclassifies retained Aide recipients using current roles; test currently prunes the boundary too. M2 queued verifier assignment rewrites persisted recipients without updating derived run names; assigned message delta/history can contradict foldLine. No separate standards/lows; ordinary facts, mid-run byte pages, append/rollback/legacy paths otherwise sound. C3 failed,all C1–C5 unverified pending correction and source re-review before mode-free verify. A-8977 local summary supporting only,no independently inspected suite/raw runtime proof; no Reviewer test execution. After-stage QA separate.

Criteria: C3 failed (Pruning an unrelated older row rebuilds a retained Aide boundary with current recipient roles and can fold it (M1; A-8984).).
