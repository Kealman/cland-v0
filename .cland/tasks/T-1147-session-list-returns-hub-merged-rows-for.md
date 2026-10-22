---
id: T-1147
kind: task
title: session.list returns hub-merged rows for archived sessions
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by: []
topic: topic-861
branch: t/T-1147-session-list-returns-hub-merged-rows-for
created: 2026-10-22T16:51:34.536Z
updated: 2026-10-22T17:20:30.762Z
closed: 2026-10-22T17:20:30.762Z
---

## Summary

`session.list {archived: true}` returns processes only, while the hub-merged `SessionRow[]` exists only in snapshots and deltas, which leave archived sessions out. T-1132's Stopped group with its archived count and the archive toggle need merged rows for archived sessions without merging them in the browser. This prerequisite adds them under rule 19, so it lands and the hub restarts before T-1132 is enqueued.

## What to build

`session.list` gains an additive `rows` field carrying the hub-merged session rows for the sessions it returns, archived ones included, built by the same projection the snapshot uses. The existing fields stay unchanged for every current consumer (Neovim, CLI, tests).

## Acceptance criteria

- [x] C1. `session.list {archived: true}` returns a `rows` field whose entries equal the snapshot's merged row shape for each archived session, and the existing fields are byte-identical for current callers (test).
  - done: impl-1147 · 2026-10-22T17:06:03.292Z
  - verified: rev-23 [reviewer] · run rev-20261022-1147-final · 2026-10-22T17:16:12.165Z · commit f034a362f6daa3f035291ce4458359804fc03011
- [x] C2. The web edge allows the read, and the wire types and conformance cover the new field (test).
  - done: impl-1147 · 2026-10-22T16:55:22.821Z
  - verified: rev-23 [reviewer] · run rev-20261022-1147-final · 2026-10-22T17:16:12.165Z · commit f034a362f6daa3f035291ce4458359804fc03011

## Comments

### impl-1147 · 2026-10-22T16:54:43.358Z

TDD: added the requested public session.list/snapshot T2 regression; observed failure (actual rows undefined), then passed with shared HubCore.sessionRows composition. Legacy fields are serialized identically; archived reads exclude unrelated unmanaged presence. Shared wire SessionListRows has a compile-time conformance assertion (observed missing-type red first); web policy explicitly retains read permission. No per-item QA brief or outstanding QA criteria; qaPolicy is after-stage.

### rev-23 · 2026-10-22T16:56:42.744Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1147-source
commit: dfc568aa8dbb8b8bae5667714150f5ac525e32d8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, A-9348. Standards0/Spec0. session.list retains legacy fields/order and appends the snapshot's same hub projection; archived filtering excludes unrelated presence. Public-frame T2 regression retains exact merged-shape/serialized legacy assertions, with authority T1 and wire T0 conformance. Matching docs updated, authority itself unchanged. C1/C2 remain unverified pending mode-free exact-head configured evidence. A-9347 labels its targeted runs pre-merge; retain original exact-head check/test outputs when available, without transcription reruns. After-stage QA separate.

### rev-23 · 2026-10-22T17:04:35.856Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1147-workload-evidence
commit: dfc568aa8dbb8b8bae5667714150f5ac525e32d8
scope: evidence
findings: [{"severity":"medium","text":"Every session.list now calls full presence composition and reads pending metadata again after list() already read it; existing verifier workload fails35 pending reads versus26 allowed. Preserve merged rows and original workload bound while reusing loaded facts.","file":"hub/src/adapters/sessions.ts","line":598}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear, A-9357, original A-9354. Actual failure: '8 deliveries and 8 explicit views allow no synchronous whole-presence reads (35 pending reads)' at inbox-archive-workload.ts287. T1 passes; T2 fails, Neovim/Web incomplete/not run. This is an enforced assertion, not a timing warning. C1 failed, C2 remains unverified. Earlier source clearance is superseded by this integration finding. Correct/test the query regression with existing assertion retained, then request fresh source review before verification.

Criteria: C1 failed (session.list additive projection violates retained workload bound: 35 pending reads exceeds 26 for 8 deliveries/views.).

### impl-1147 · 2026-10-22T17:05:52.100Z

Verification 74f90300 at dfc568aa failed on Linux droplet: `8 deliveries and 8 explicit views allow no synchronous whole-presence reads (35 pending reads)`. Reproduced locally with the existing unchanged workload test. Cause: common sessionRows projection reread connected session holds/pending after presence() had already loaded them. Reused the loaded presence facts; original query bound now passes. Local macOS correction-tree targeted results: inbox-workload 8/8, connection-snapshot 13/13, computed-sessions 4/4, repository typecheck passed. No suite pass claimed; fresh source review required.

### rev-23 · 2026-10-22T17:06:49.079Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1147-source-2
commit: f034a362f6daa3f035291ce4458359804fc03011
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear, A-9361; incorporates A-9348 and A-9357. Fresh synchronous presence already contains exact identity holds/pending, now reused for connected rows; disconnected lookups and stopped pending suppression retain original semantics. No test/bound/legacy field/archive behavior changes, no dev merge. Standards0/Spec0. Reported correction-tree workload8/snapshot13/computed4 and typecheck green are targeted local evidence only. C1/C2 remain unverified pending fresh exact-head mode-free configured receipt; old dfc568aa run remains failed.

### rev-23 · 2026-10-22T17:16:12.165Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1147-final
commit: f034a362f6daa3f035291ce4458359804fc03011
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final C1/C2 clear, A-9370; A-9369/run dd02f665 at exact source-clear f034a362. Parsed2504 ordinary tests/381 files pass; new archived-row identity ordinary+5 unique load repetitions pass, original inbox workload bound passes unchanged. Authority and snapshot/computed-session files pass; host check/wire gate4261ff3 reused/not repeated remotely. All T1/fallback all hub+Neovim T2/actual Web pass on Linuxx64 c-8lon1 workers2/Web4. Generic budgets/lint/ratchet report-only; Web49.326s exceeds40s report-only budget. No T3/T4/QA/full-cover claim. Old dfc568aa receipt remains failed.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-22T17:20:30.762Z

Merged de40ac3c93e5f1713c775831ce1f475bd17c07e1 onto dev.
