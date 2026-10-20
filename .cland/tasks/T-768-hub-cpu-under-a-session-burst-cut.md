---
id: T-768
kind: task
title: "Hub CPU under a session burst: cut repeated SQLite statement preparation and per-session presence/visibility queries"
state: open
status: ready
size: M
criterion_seq: 1
labels:
  - hub
  - performance
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: topic-717
branch: t/T-768-hub-cpu-under-a-session-burst-cut
created: 2026-10-18T03:10:12.614Z
updated: 2026-10-20T10:14:02.168Z
---

## Summary

T-758's profile (impl-758, 2026-10-18 03:10Z, C1 artifact in topic-470) ran 9 socket sessions sending 22,052 status, send, who and history requests in 6.0 s against a fresh temporary hub. Most of the hub's CPU went to synchronous native SQLite prepare, all, get and run. These came through store.history (1.2 s inclusive, about 20 %) and repeated per-session presence, sessionHolds and roleOf visibility reads. On 2026-10-17 at 22:03Z the live hub (87 MB hub.db, 115 MB journal) stayed at 40–98 % CPU with nine sessions and missed 3 s admissions.

## What to build

Profile the live-size case: a copy of a large hub.db in a temp project under the same burst. Then cache prepared statements per connection and compute presence and visibility once per tick or request batch, not per row or per session. Keep every visibility rule.

## Acceptance criteria

- [x] C1. A bounded, connection-local statement cache serves the store's prepared statements with SQL, bindings and visibility unchanged; inbox-load.ts (or an equivalent T4 harness) reports executed SQL operations and prepare calls per burst before and after, plus an indicative CPU figure with the machine load noted. The ≥50 % CPU target and presence/visibility batching move to a follow-up in Ideas.
  - done: impl-768 · 2026-10-20T09:47:42.200Z
  - verified: rev-32 [reviewer] · run rev-20261020-768-final · 2026-10-20T10:14:00.946Z · commit b420ed7522e55d9f0e8faa1af0e2656daa8d58f3

## Comments

### impl-768 · 2026-10-20T09:47:43.072Z

Implemented a bounded 256-entry connection-local Store statement cache, mechanically routing all 172 Store prepare calls with unchanged SQL argument expressions (AST checked). Prepared calls fell 23,874 -> 16,528 (30.8%) for 400 paced requests; executions 23,474 -> 23,542, inbox rebuilds 17 both. Indicative CPU 1351.639 -> 1798.536 ms at 1-minute load 11.907 -> 9.854; after sample also overlapped targeted visibility checks, so no CPU improvement claim. Evidence A-7277 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7277-t-768-cache-implementation-and-before-after-evidence.md), raw A-7271/A-7272, committed docs/evidence/T-768-statement-cache.md. Store 20/20, inbox 8/8, name reservation 67/67, visibility 7/7, permissions 13/13, npm run check green. Query tracers and warmed-statement fault injectors now observe execution. Source review next, then mode-free verification at reviewed head.

### rev-32 · 2026-10-20T10:04:36.565Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-768-source
commit: b420ed7522e55d9f0e8faa1af0e2656daa8d58f3
scope: full
findings: [{"severity":"low","text":"Pre-existing manual harness isolation gap: it inherits process.env/HOME/provider/account settings. Coordinator disposition 65471756 explicitly assigns the fix to T-961 and directs retaining this T-768 head; no further local load runs should use this unsealed harness.","file":"hub/test/inbox-load.ts","line":46}]
finding_counts: {"high":0,"medium":0,"low":1}

## Standards

Low — hub/test/inbox-load.ts:46: Pre-existing manual harness isolation gap: it inherits process.env/HOME/provider/account settings. Coordinator disposition 65471756 explicitly assigns the fix to T-961 and directs retaining this T-768 head; no further local load runs should use this unsealed harness.

No blocking findings. Store cache is private to each connection, keys exact SQL, evicts the oldest entry at 256, and clears on close. Reviewed the Store diff after mechanically normalizing prepare routing: changes are the cache/type/close plumbing plus equivalent receiver substitutions, with SQL and binding call sites unchanged. Execution tracers wrap get/all/run once at prepare and consult current listeners, so warmed statements retain instrumentation. The changed late fault injections still target the same SQL/bindings before execution.

## Spec

No findings against narrowed C1. Coordinator decision 63992395 removes the 50% CPU target and presence batching. Retained A-7271/A-7272 and committed evidence report 400 requests per sample, prepares 23,874→16,528, executions 23,474→23,542, inbox rebuilds 17→17. Node v24.21.0 Darwin arm64/local CPU was 1351.639→1798.536ms with 1m load 11.907→9.854 and overlapping after-sample checks; this is explicitly inconclusive, not a performance pass. Deferred isolation debt is S / Tech debt, already T-961, per Coordinator; do not duplicate it.

Source clear at b420ed7522e55d9f0e8faa1af0e2656daa8d58f3. C1's source and retained measurements checked; its final verification mark awaits mode-free same-head suite evidence for semantic compatibility. No reviewer test or load execution. Reported supplemental local targeted receipts: Store 20/20, inbox 8/8, reservation 67/67, visibility 7/7, permissions 13/13; check green with diagnostic lint report-only. These are not a task-suite receipt.

Totals: Standards 1 low (explicitly deferred); Spec 0.

### impl-768 · 2026-10-20T10:13:34.908Z

Same-head verify d021f154-d5e8-4da0-81f8-0c34dd6900e1 green at b420ed7522e55d9f0e8faa1af0e2656daa8d58f3. Linux x64 droplet c-8 lon1, Node v24.21.0, Neovim v0.12.5: T1/T2 exit 0, aggregate 1947/1947 pass (0 fail/cancelled/skipped). Full T2 fallback across packages; no T3/T4 receipt here. T3 deferred to periodic dev/integrated occasions (absent from configured batch tiers). Typecheck used host gate at 54fae0a79e8a2756177c2de333370f9299593703, not repeated on droplet; local npm run check passed before source review. Lint (131 findings in 59 files) and T3 ratchet are report-only; legacy budget allowances remain. Droplet lifetime 392s, cost $0.0272, workers 2. Durable log A-7385: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7385-suite-d021f154-d5e8-4da0-81f8-0c34dd6900e1-auto-at-b420ed7.log. Reviewer also received the suite result; final C1/freshness verdict pending.

### rev-32 · 2026-10-20T10:14:00.946Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-768-final
commit: b420ed7522e55d9f0e8faa1af0e2656daa8d58f3
scope: evidence
findings: [{"severity":"low","text":"Pre-existing manual harness isolation gap: it inherits process.env/HOME/provider/account settings. Coordinator disposition 65471756 explicitly assigns the fix to T-961 and directs retaining this T-768 head; no further local load runs should use this unsealed harness.","file":"hub/test/inbox-load.ts","line":46}]
finding_counts: {"high":0,"medium":0,"low":1}

Final evidence review clear at unchanged b420ed7522e55d9f0e8faa1af0e2656daa8d58f3, following full source review rev-20261020-768-source (A-7340). C1 verified. One low persists: hub/test/inbox-load.ts:46 inherits the host environment; Coordinator 65471756 explicitly deferred this S Tech debt to T-961 and directed retaining the head.

A-7385 / run d021f154-d5e8-4da0-81f8-0c34dd6900e1 is a fresh mode-free task run at this head: exit 0, 1947/1947 reported passes; T1 exit 0 (41s), T2 exit 0 (261s), fallback all T2 in both packages. Linux x64 6.8.0-142-generic on droplet c-8 lon1, Node v24.21.0, Neovim v0.12.5. Host check/typecheck at 54fae0a79e8a2756177c2de333370f9299593703 was reused, not repeated remotely. Census/duration/T3 ratchet diagnostics were report-only; refusal policy remained enforced.

Retained log contains ordinary Store cache/fresh-binding/rollback/isolation pass plus 5/5 load receipt, and ordinary inbox workload and warmed-statement fault-regression passes. Combined with source-preserved SQL/bindings and retained A-7271/A-7272 count/CPU evidence, this establishes narrowed C1. Indicative CPU remains inconclusive under busy-machine load; no speed target or improvement is claimed.

This is T0–T2 evidence; T3/T4 were not executed and remain deferred by queue policy. No Reviewer runtime or load execution.

Criteria: C1 verified.
