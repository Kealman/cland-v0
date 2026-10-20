---
id: T-768
kind: task
title: "Hub CPU under a session burst: cut repeated SQLite statement preparation and per-session presence/visibility queries"
state: closed
status: done
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
updated: 2026-10-20T10:40:41.654Z
closed: 2026-10-20T10:40:41.654Z
---

## Summary

T-758's profile (impl-758, 2026-10-18 03:10Z, C1 artifact in topic-470) ran 9 socket sessions sending 22,052 status, send, who and history requests in 6.0 s against a fresh temporary hub. Most of the hub's CPU went to synchronous native SQLite prepare, all, get and run. These came through store.history (1.2 s inclusive, about 20 %) and repeated per-session presence, sessionHolds and roleOf visibility reads. On 2026-10-17 at 22:03Z the live hub (87 MB hub.db, 115 MB journal) stayed at 40–98 % CPU with nine sessions and missed 3 s admissions.

## What to build

Profile the live-size case: a copy of a large hub.db in a temp project under the same burst. Then cache prepared statements per connection and compute presence and visibility once per tick or request batch, not per row or per session. Keep every visibility rule.

## Acceptance criteria

- [x] C1. A bounded, connection-local statement cache serves the store's prepared statements with SQL, bindings and visibility unchanged; inbox-load.ts (or an equivalent T4 harness) reports executed SQL operations and prepare calls per burst before and after, plus an indicative CPU figure with the machine load noted. The ≥50 % CPU target and presence/visibility batching move to a follow-up in Ideas.
  - done: impl-768 · 2026-10-20T09:47:42.200Z
  - verified: rev-32 [reviewer] · run rev-20261020-768-final · 2026-10-20T10:14:00.946Z · commit b420ed7522e55d9f0e8faa1af0e2656daa8d58f3
  - verified: rev-32 [reviewer] · run rev-20261020-768-final-2 · 2026-10-20T10:23:01.310Z · commit fb64ce3a2c701054e427d7c3cdb707dd0c2e44bb
  - verified: rev-32 [reviewer] · run rev-20261020-768-final-3 · 2026-10-20T10:32:43.761Z · commit 0d1ed51721da12a906e2192e6872d1ff4e5b1ca8

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

### impl-768 · 2026-10-20T10:15:25.997Z

Merge-queue conflict recovery authorized by rule 11 and Coordinator 3018ca54: fetched origin/dev and merged 3652c6e4 at new pushed head fb64ce3a2c701054e427d7c3cdb707dd0c2e44bb. Git merged cleanly with no conflicted files/manual resolutions. All eight T-768 files are byte-for-byte identical to b420ed75 (git diff --exit-code scoped to those paths), including every cached prepare site. Local darwin arm64 npm run check passed at fb64ce3a; lint is report-only (131 findings/59 files, 0 refusals). Previous A-7385 was b420ed75 and is stale for new-head readiness. Requesting delta source review, then new mode-free same-head verification.

### rev-32 · 2026-10-20T10:16:09.509Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-768-delta
commit: fb64ce3a2c701054e427d7c3cdb707dd0c2e44bb
scope: delta
findings: [{"severity":"low","text":"Pre-existing manual harness inherits host HOME/provider/account settings. Coordinator 65471756 explicitly assigned this S Tech debt to T-961; the integration merge does not change that deferred gap.","file":"hub/test/inbox-load.ts","line":46}]
finding_counts: {"high":0,"medium":0,"low":1}

Delta source review clear at fb64ce3a2c701054e427d7c3cdb707dd0c2e44bb after the authorized merge of dev 3652c6e4938205c89b691ea176391ba1975e825d. Previous source/evidence review was b420ed75. One low carried forward: hub/test/inbox-load.ts:46 host environment isolation debt, explicitly deferred to T-961.

## Standards

No new findings. Confirmed merge parents b420ed75 and 3652c6e4; all eight T-768 files are byte-identical to the previously reviewed versions. Current task diff against dev is the original eight-file change. Reviewed intervening Store consumers in sessions, CLI topic creation, dispatch recovery and suite timing/accounting. None changes the Store connection/statement contract or introduces cached-statement mutation/reentrancy. Database opening, core/inbox and fixture-probe dependencies are unchanged. SQL, bindings, visibility and execution-aware instrumentation remain as reviewed.

## Spec

No new findings. Bounded per-connection cache and retained execution-count evidence remain applicable to the unchanged task source; indicative busy-machine CPU remains inconclusive. The dev integration does not alter narrowed C1. Source clear only at the new head: previous A-7385 Linux T0–T2 pass and C1 mark remain evidence for b420ed75, not fb64ce3a. Final C1 freshness awaits a post-source mode-free receipt at this exact head (a hub-authorized matching-tree cache receipt would be valid and must be labelled cached).

Implementer reports Darwin arm64/local check green at fb64ce3a; diagnostic lint 131 findings/59 files, zero refusals. No Reviewer execution or new runtime claim. Scope delta; Standards 1 deferred low, Spec 0.

### impl-768 · 2026-10-20T10:22:48.099Z

Post-merge same-head verification adfe34de-b5bf-4755-82a2-6fee5a57e838 passed at fb64ce3a2c701054e427d7c3cdb707dd0c2e44bb: 1959/1959 pass, no failures/cancellations/skips. Linux x64 6.8.0-142-generic droplet c-8 lon1, Node v24.21.0, Neovim v0.12.5, workers 2, lifetime 342s, cost $0.0237. T1 exit 0 (36s), T2 exit 0 (232s), all T2 across both packages via coverage fallback. T3/T4 not executed; T3 deferred to periodic dev/integrated occasions. Host typecheck gate f2aaacf9bd08704821b62f58036177dc90b0b2b0 reused, not repeated remotely; local npm run check passed at this task head before delta source review. Lint report-only 131 findings/59 files; budget/T3 diagnostics report-only, one missing duration baseline (nvim-frame-refresh.test.ts). Log A-7436: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7436-suite-adfe34de-b5bf-4755-82a2-6fee5a57e838-auto-at-fb64ce3.log. Reviewer received same result. Head unchanged; awaiting final C1 evidence verdict.

### rev-32 · 2026-10-20T10:23:01.310Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-768-final-2
commit: fb64ce3a2c701054e427d7c3cdb707dd0c2e44bb
scope: evidence
findings: [{"severity":"low","text":"Pre-existing manual harness inherits host HOME/provider/account settings. Coordinator 65471756 explicitly assigned this S Tech debt to T-961; the integration merge does not change that deferred gap.","file":"hub/test/inbox-load.ts","line":46}]
finding_counts: {"high":0,"medium":0,"low":1}

Final evidence review clear at fb64ce3a2c701054e427d7c3cdb707dd0c2e44bb after delta source verdict rev-20261020-768-delta (A-7397), following the earlier full source review. C1 refreshed at this exact head. One low remains: inbox-load.ts:46 host environment isolation debt explicitly deferred to T-961 by Coordinator 65471756.

Fresh mode-free run adfe34de-b5bf-4755-82a2-6fee5a57e838 / A-7436 matches the current branch tip, exit 0: 1959/1959 reported passes; T1 exit 0 (36s), T2 exit 0 (232s), fallback all T2 across hub/Neovim. Linux x64 6.8.0-142-generic on droplet c-8 lon1, Node v24.21.0, Neovim v0.12.5. Host check/typecheck at f2aaacf9bd08704821b62f58036177dc90b0b2b0 was reused, not repeated remotely. Census/duration/T3 ratchet diagnostics remained report-only; refusal policy enforced.

Confirmed ordinary Store cache/fresh-binding/connection/rollback pass and a separate 5/5 passed load receipt, plus warmed fault-injection passes. The unchanged task source retains original count/CPU evidence A-7271/A-7272: prepare reduction is observed; busy-machine CPU remains inconclusive, with no speed claim. Combined source and new runtime evidence establish narrowed C1 on the integrated head. Prior A-7385 remains a separate receipt for b420ed75.

T3/T4 did not execute and remain deferred by queue policy. No Reviewer tests or load execution.

Criteria: C1 verified.

### rev-32 · 2026-10-20T10:25:14.393Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-768-delta-2
commit: 0d1ed51721da12a906e2192e6872d1ff4e5b1ca8
scope: delta
findings: [{"severity":"low","text":"Pre-existing manual harness inherits host HOME/provider/account settings. Coordinator 65471756 explicitly assigned this S Tech debt to T-961; the integration merge does not change that deferred gap.","file":"hub/test/inbox-load.ts","line":46}]
finding_counts: {"high":0,"medium":0,"low":1}

Delta source review clear at 0d1ed51721da12a906e2192e6872d1ff4e5b1ca8 after authorized dev merge d53dc9be33d4777a7c087704414bbb68d5d50f41. Previous reviewed/verified head was fb64ce3a. One low remains explicitly deferred to T-961: inbox-load.ts:46 host environment isolation.

## Standards

No new findings. Reviewed the manual hasPendingWork conflict resolution: it keeps dev/T-587's queued-or-delivered predicate and explanation, with the task's this.#prepare receiver and existing bindings. Other verifier-request queries retain their cached receivers and dev semantics. Reviewed related core/session staffing changes: synchronous state mutation completes before reads through the cache; no statement is held across a callback or async operation. The automatic inbox helper overlap retains execution-aware tracing alongside T-764's scoped turn counter, finally cancellation and lifetime guards. The other six task files are unchanged; task diff against dev remains the original eight-file cache/instrumentation change.

## Spec

No new findings against narrowed C1. Cache remains connection-local/bounded, SQL and bindings follow current dev, and original retained measurement caveats remain. No new performance claim. Prior A-7436 is evidence for fb64ce3a only; C1's prior marks are stale. Source clear at this new head, with final C1 freshness pending a post-source same-head mode-free receipt.

Implementer reports local Darwin arm64 Node v24.21.0 targeted Store 20/20, routing 11/11, resolver 3/3, inbox workload 8/8 and check green (diagnostic lint report-only 131/59, zero refusals). These are supplemental targeted claims, not a new suite receipt. No Reviewer tests/run.

Scope delta; Standards 1 deferred low, Spec 0.

### impl-768 · 2026-10-20T10:32:06.680Z

Same-head run 4ae6c41b-8bf5-4e96-95aa-91ad7f729547 passed at 0d1ed51721da12a906e2192e6872d1ff4e5b1ca8 after T-587 Store conflict resolution. Linux x64 6.8.0-142-generic droplet c-8 lon1; Node v24.21.0/Neovim v0.12.5, 2 workers, lifetime 347s, cost $0.0241. 1971/1971 pass, no failures/cancellations/skips. T1 exit 0 (36s), T2 exit 0 (233s), full T2 fallback both packages. T3/T4 not run; T3 deferred to periodic dev/integrated occasions. Host typecheck gate at 1f5d84f22532f444214c7fdfafd5c104db984e77 reused, not repeated remotely; local check was green at resolved tree. Lint/budget/T3 diagnostics report-only: 131 findings in 59 files; two missing duration baselines. Durable log A-7461: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7461-suite-4ae6c41b-8bf5-4e96-95aa-91ad7f729547-auto-at-0d1ed51.log. Reviewer receives same result; awaiting refreshed final C1 evidence verdict. Head unchanged.

### rev-32 · 2026-10-20T10:32:43.761Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-768-final-3
commit: 0d1ed51721da12a906e2192e6872d1ff4e5b1ca8
scope: evidence
findings: [{"severity":"low","text":"Pre-existing manual harness inherits host HOME/provider/account settings. Coordinator 65471756 explicitly assigned this S Tech debt to T-961; the integration merge does not change that deferred gap.","file":"hub/test/inbox-load.ts","line":46}]
finding_counts: {"high":0,"medium":0,"low":1}

Final evidence review clear at 0d1ed51721da12a906e2192e6872d1ff4e5b1ca8 following delta source verdict rev-20261020-768-delta-2 (A-7450). Branch tip and hub result head match. C1 refreshed at this exact integrated head.

Fresh mode-free run 4ae6c41b-8bf5-4e96-95aa-91ad7f729547 / A-7461 exited 0 on Linux x64 6.8.0-142-generic droplet c-8 lon1, Node v24.21.0 and Neovim v0.12.5. T1 exited 0 (36s); all-T2 fallback exited 0 (233s); aggregate 1971/1971 reported passes including load checks. Host check/typecheck at 1f5d84f22532f444214c7fdfafd5c104db984e77 was reused, not repeated remotely. Diagnostic lint (131/59), duration/budget and T3 ratchet remained report-only; refusal policy enforced. Two missing duration baselines carry median projections, not measured wall-time evidence or budget passes.

The Store SQL reuse/fresh bindings/connection isolation/rollback regression passed ordinary execution and a separate 5/5 load receipt. All named Store tests and name-reservation tests passed, including the late publication/rollback checkpoint fault paths. Newly integrated uncertain-verifier staffing regressions passed as well. This settles the manual hasPendingWork conflict resolution and automatic inbox-helper overlap reviewed in A-7450 without a new source finding.

Narrowed C1 combines the source-reviewed bounded, connection-local cache with unchanged retained burst counts/CPU evidence A-7271/A-7272. Prepare-call reduction was observed on that original measurement tree; its busy-machine CPU result remains inconclusive. These historical measurements are not a new performance run at this integrated head, and no speed target/pass is claimed. The Coordinator moved the 50% CPU target and presence/visibility batching to a follow-up.

Low — hub/test/inbox-load.ts:46: Pre-existing manual harness inherits host HOME/provider/account settings. Coordinator 65471756 explicitly assigned this S Tech debt to T-961; integration does not change that deferred gap. No high or medium findings remain.

T3/T4 did not execute in this task gate; their queue/landing coverage remains deferred. No Reviewer tests or load execution. Standards: one deferred low. Spec: no findings.

Artifact A-7464: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7464-t-768-final-integrated-head-evidence-at-0d1ed517.md

Criteria: C1 verified.

### coord · 2026-10-20T10:40:41.654Z

Merged 38573213a902c53798c504c892df99325a637146 onto dev.
