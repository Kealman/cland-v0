---
id: T-2079
kind: task
title: seed-transaction's rollback can throw and replace the original seed failure
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by:
  - T-1995
topic: topic-1759
branch: t/T-2079-seed-transaction-s-rollback-can-throw
created: 2026-11-24T09:50:39.750Z
updated: 2026-11-25T03:04:05.396Z
closed: 2026-11-25T03:04:05.396Z
---

## Summary

Found by T-1995's reviewer at 00c594e49 and reported by impl-1995 (static finding, no failing run). In hub/test/seed-transaction.ts, lines 18 to 20, the catch block runs `exec('rollback')` when `connection.isTransaction` is set, then rethrows. If the rollback throws, its error replaces the seed failure the caller needs to see. This is the same shape T-1995 fixes for `openDatabase`'s cleanup close.

## What to build

Keep the seed error as the outcome. A failing rollback is attached as a secondary diagnostic, using the shared cleanup-diagnostic helper that T-1995 adds, and never replaces the seed error (rule 39).

## Acceptance criteria

- [x] C1. When `seed()` rejects and the rollback also throws, the helper rejects with the seed error, with the rollback error recorded as secondary. The test uses an injected connection and fails on the current code.
  - done: impl-2079 · 2026-11-25T01:40:11.411Z
  - verified: rev-35 [reviewer] · run rev-35-2079-evidence-1 · 2026-11-25T02:09:31.424Z · commit 690f1cf1d1ca960f5d76c01f5d87c97b8711e70d

## Comments

### impl-2079 · 2026-11-25T01:39:08.926Z

C1 reproduced red with injected connection: actual rollback failed versus expected seed failed. Shared withCleanupFailure now preserves seed identity and records rollback in AggregateError cause; focused seed and cleanup T1 files green (5 tests). Consumer search: seedTransaction direct callers stage-closure-component and tip-churn-fixture; transitive callers database-cleanup, tracker-summary, item-summary-scale. No wire/schema/policy contract change. Full verification pending source review.

### rev-35 · 2026-11-25T01:41:41.695Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2079-source-1
commit: 690f1cf1d1ca960f5d76c01f5d87c97b8711e70d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23102: Standards0/Spec0. Failed rollback uses unchanged withCleanupFailure to retain seed primary/secondary diagnostic, with finally method restoration intact. Injected pure T1 regression asserts primary identity, rollback cause, SQL order and restored methods; type-only SQLite imports acquire no DB. Direct stage-closure/tip-churn and transitive database-cleanup/tracker-summary/item-summary-scale consumers match inventory; signatures/normal paths unchanged. A-23101 reports focused local red/green5/5, not configured evidence. C1 remains unverified pending exact-head producing case and consumer receipts. Hold released; use Coordinator verification window.

### rev-35 · 2026-11-25T02:09:31.424Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2079-evidence-1
commit: 690f1cf1d1ca960f5d76c01f5d87c97b8711e70d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23153: exact-head eff5b521/A-23147 code0/empty cause, T0/T1/T2/7 selected T3/Web complete exit0. Exact injected rollback regression base+5/5 loaded pass; cleanup helper4/4 and four consumer files71/71 pass. C1 established with source review A-23102 and retained red provenance. All T1/T2/Web positive file receipts; remaining267T3/18T4 outside execution proof, one base macOS selector skip explicit. No remaining findings or additional run requested.

Criteria: C1 verified.

### coord · 2026-11-25T03:04:05.396Z

Merged 5dbc6af5c9f490c2acea2464a6204dbba0df843d onto dev.
