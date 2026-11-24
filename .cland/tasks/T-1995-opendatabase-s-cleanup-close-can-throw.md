---
id: T-1995
kind: task
title: openDatabase's cleanup close can throw and replace the original initialization error
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2076
blocked_by: []
topic: topic-1726
branch: t/T-1995-opendatabase-s-cleanup-close-can-throw
created: 2026-11-19T03:19:07.689Z
updated: 2026-11-24T09:50:19.564Z
---

## Summary

`openDatabase` (hub/src/database.ts) catches an initialization failure, calls `db.close()`, then rethrows. If `close()` also throws, that second error replaces the original initialization failure, so the caller sees the close refusal and never the real cause. impl-1988 found this in T-1988 on 2026-11-19 with a controlled close refusal ("controlled database close refusal" at database.ts:10).

## What to build

Keep the initialization error as the outcome. A failing `close()` in that cleanup is attached as a secondary diagnostic (for example as the cause, or alongside it) and never overwrites it (rule 39).

## Acceptance criteria

- [x] C1. When the busy_timeout pragma throws and `close()` also throws, `openDatabase` rejects with the pragma error, with the close error recorded as secondary (test with an injected `open`, red on the current code).
  - done: impl-1995 · 2026-11-24T09:48:27.920Z
- [x] C2. Every caller of `openDatabase` is listed with its disposition (rule 41).
  - done: impl-1995 · 2026-11-24T09:48:29.724Z
  - verified: rev-40 [reviewer] · run rev-40-20261124-1995-source · 2026-11-24T09:50:19.564Z · commit 00c594e496ceac7ab263aef0b2464385a09432a9

## Comments

### coord · 2026-11-19T03:35:28.261Z

A second path with the same pattern, reported by T-1988's reviewer from static source at 3eebc59c: the existing `finally` in hub/test/tip-churn-fixture.ts:47–49 can replace an original seed or schema failure when `index.close()` or `connection.close()` also throws. This item should cover both, the test fixture and `openDatabase`, keeping the original error primary with close failures attached as secondary. C2's census should list both.

### coord · 2026-11-19T21:03:15.407Z

Reproduction from T-2015 (impl-2015, 2026-11-19 21:03Z): a test that makes every `db.exec` throw hits the initial PRAGMA setup in `openDatabase`. The original error is replaced by the cleanup close: the literal caught error was `Error: injected close refusal` at hub/src/database.ts:10, instead of `injected constructor rejection`. T-2015 narrowed its own control to the tracker_items schema, so this item still owns the `openDatabase` fix.

### coord · 2026-11-24T07:23:53.250Z

Reproduced again by impl-2069 during T-2069's M1 fault control on 2026-11-24. A planted constructor rejection was expected; the actual error was "Error: planted native close rejection at database.ts:10". The close error still replaces the initialization error.

### impl-1995 · 2026-11-24T09:05:07.335Z

Caller census (repository-wide field/function/import search across hub, nvim, web, docs and skills): openDatabase direct callers are Store constructor and hasRoleMappedSession (hub/src/hub/store.ts), Processes constructor (hub/src/adapters/processes.ts), orphan row reader (hub/src/orphans.ts), TrackerIndex constructor (hub/src/tracker/index-db.ts), and test helpers in pid-identity.test.ts and termination-ownership.test.ts. All keep the same successful return and original mutable Error identity; only failed close adds an AggregateError cause retaining any prior cause. Frozen/non-Error primary values are retained as aggregate cause and first errors entry. Indirect injected-open consumers in daemon, Tracker, sessions, harness and fixtures remain signature-compatible. tipChurnFixture consumers are tracker-summary.test.ts and item-summary-scale.test.ts; both keep their existing two-argument default, with owner retention unchanged. No wire, persisted shape, help or policy changes. New third injected-open argument permits fake-only fault coverage; constructor-failure and seed-body-failure branches both close once. Red on original paths: actual Error: injected close rejection versus expected injected pragma/schema/seed rejection. Focused green: 7 cases on macOS local Node v24.21.0; no native database/browser/process execution.

### impl-1995 · 2026-11-24T09:12:47.340Z

Typecheck completed green across hub, nvim, shared wire and web on macOS local Node v24.21.0. First full test:lint exited 1 at lint-repository-tier-plan.ts:19 because new tier entries were not sorted; corrected. Second full test:lint was stopped on Coordinator load-stop instruction (exit 143), with own process and observed children confirmed gone; it is incomplete, not a pass. Lint-slot request is pending in topic-1726. Reachable 81 T1 file run and final updated focused tests remain pending under the new load-under-8 condition. No review or verify requested yet.

### impl-1995 · 2026-11-24T09:48:46.829Z

Review head 00c594e496ceac7ab263aef0b2464385a09432a9 pushed with clean worktree. Full lint exit 0 under granted slot, typecheck exit 0. All 81 reachable T1 files plus database-cleanup.test.ts T2 passed individually at load below 8 on macOS local Node v24.21.0. Focused new tests: 4 T1 and 4 T2 cases. Durable evidence A-22795 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22795-t-1995-red-and-targeted-validation-evidence.md) and A-22796 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22796-t-1995-82-targeted-file-exit-receipts.json). Source review requested; full verify awaits clear review and Coordinator window.

### rev-40 · 2026-11-24T09:50:19.564Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-1995-source
commit: 00c594e496ceac7ab263aef0b2464385a09432a9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. Shared helper preserves mutable primary Error identity/prior cause with secondary close diagnostic; immutable/non-Error fallback keeps primary cause/first entry. openDatabase pragma and tipChurnFixture constructor/seed catch paths preserve selected errors, close once and retain prior database owner; normal success unchanged. New injected-handle T2 guard and pureT1 controls inspected. C2 direct/indirect caller census verified including newdatabase-cleanup regression; additive open seam and existing return contracts compatible. A-22796 independently has82unique exit0/signalnull records but no per-case/head attestations; local red/green case counts/static results are reported working-tree evidence, not configured proof. C1 stays unverified pending exact-head configured receipt. Existing seedTransaction rollback masking separately reportedXS/Bugs, outside scope. No reviewer runs/edits.

Criteria: C2 verified.
