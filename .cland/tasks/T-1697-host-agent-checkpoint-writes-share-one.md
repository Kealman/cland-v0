---
id: T-1697
kind: task
title: Host agent checkpoint writes share one fixed '.new' temp name; a concurrent or late checkpoint fails with ENOENT
state: open
status: review
size: S
criterion_seq: 3
labels: []
assignee: null
parent: E-1881
blocked_by: []
topic: topic-1538
branch: t/T-1697-host-agent-checkpoint-writes-share-one
created: 2026-11-05T19:31:45.062Z
updated: 2026-11-16T09:06:39.141Z
---

## Summary

In impl-1692's Linux container evidence (T-1692; `docker run --init`, arm64 Node 24.21.0, about 6.6 of load, repetition 5 of 5), `hub/test/claude-code-remote.test.ts` "lost native release reply settles without replaying native stop" failed in 5.10 s. The error was `ENOENT` opening `<fixture>/f1/home/.cland-host/run/processes.json.new`. The earlier four full-file repetitions passed 26/26.

`hub/src/host/agent/storage.ts` `checkpoint(path, value)` always writes through the fixed name `path + '.new'` and then renames it. Two weaknesses follow:
1. **Concurrent writers.** Two in-process writers (or an old and a restarted agent) checkpointing the same file share one temp name. One can rename it away under the other, or truncate it mid-write.
2. **Late writes.** A checkpoint can start after the run directory has been removed (release, reboot simulation or fixture teardown). `open(…, 'w')` then fails with ENOENT on the missing parent directory, which matches this error.

## What to build

1. Determine which ordering produced this ENOENT, with a deterministic reproduction.
2. Give `checkpoint` a unique temp name per write: the pid plus a random suffix, renamed atomically, with orphaned temp files cleaned up on start.
3. Make every caller either serialize its own checkpoints of one file or tolerate concurrency.
4. If the cause is a late write after the run directory's owner released it, fence that writer and report it, rather than recreating the directory.

## Acceptance criteria

- [x] C1. The failing order is named with a deterministic reproduction (test, red before the fix).
  - done: impl-1697 · 2026-11-16T07:43:11.702Z
  - verified: rev-37 [reviewer] · run rev-37-1697-evidence-1 · 2026-11-16T08:33:11.053Z · commit 58f83349eca11d94485f534251e0ab0951f94d9a
- [x] C2. Concurrent checkpoints of one file never fail and never leave a partial file, and the last completed write wins (test).
  - done: impl-1697 · 2026-11-16T07:43:31.973Z
  - verified: rev-37 [reviewer] · run rev-37-1697-evidence-1 · 2026-11-16T08:33:11.053Z · commit 58f83349eca11d94485f534251e0ab0951f94d9a
- [ ] C3. claude-code-remote passes 10/10 under CPU load in a Linux container run with `docker run --init` (evidence).

## Comments

### impl-1697 · 2026-11-16T07:37:24.513Z

Deterministic red reproduced: first checkpoint is held after sync, second opens/truncates the shared .new and renames it, first rename throws ENOENT ('missing rename source'). New unique pid/UUID temp passes the same order. This proves the collision, not the historical missing-parent open failure. Current AgentProcesses #persist serializes processes.json and drain fences new reconciliation and joins saves/completions; no live-parent recreation is introduced. Caller sweep: entry applied.json; bootstrap birth.json; ref-push-worker result; processes plans/admissions/release/closed/process table; watch snapshots (serialized owner); prepared plans/results (token owner); claude generation receipts; signin admission receipt; server agent.pid; supervisor restart-result. JSON bytes/paths and checkpoint(path,value) calls stay compatible. Unique temp permits independent concurrent callers. Startup cleanup preserves live/unknown pid temps and legacy .new (no captured writer identity).

### rev-37 · 2026-11-16T07:50:20.197Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1697-source-1
commit: 891ad88a95bc67737ebb8e90e531843bf1aaa2c0
scope: full
findings: [{"severity":"medium","text":"Recursive readdir materializes retained run-tree history and all candidate PIDs before listener/readiness; use incremental bounded recovery off startup, joined on close, with a work-budget regression (rule 23).","file":"hub/src/host/agent/storage.ts","line":23},{"severity":"medium","text":"Only runDir is cleaned, leaving unique orphan temps for code/applied.json and code/restart-result.json outside recovery; cover their exact owned basenames while preserving live/unknown writers.","file":"hub/src/host/agent/server.ts","line":44}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source not clear: two medium recovery findings, Standards and Spec, detailed in A-19849. Unique wx pid/UUID temps, per-write close/sync/rename cleanup and missing-parent propagation are sound by source. Coordinator permits collision proof while original missing-parent producer remains unproven. C1/C2 remain runtime-unverified; no criterion failed because findings address the explicit orphan recovery requirement and rule 23, rather than a demonstrated failing concurrency assertion. C3 remains pending 10 exact-head full-file loaded Linux Docker --init runs after corrected-head source clear, in authorized slots. Lead confirmed both findings. No Reviewer runs or edits. Artifact /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-19849-t-1697-source-review-bounded-complete-orphan-recovery.md

### impl-1697 · 2026-11-16T07:56:40.926Z

A-19849 corrections: cleanupCheckpointTemps is replaced (only consumers were server.ts and the storage T1 test) by one checkpointRecovery owner. Streaming opendir buffer32, 32 visited entries per turn, <=32 candidate observations per flush, scheduled start after persisted agent.pid/listener admission, synchronous cancellation and joined directory close. Recovery deletes are the durable progress receipts; no retained snapshot materialized. Exact external code basenames applied.json/restart-result.json precede runDir traversal; entry supplies its computed owned code directory, server default uses runDir's code sibling. No recursion into code generations. New private AgentOptions optional fields have no request/wire consumers; ordinary serveAgent callers remain compatible. Six T1 green; corrected hub typecheck green. Added T3 lifecycle readiness/close test remains unexecuted pending exclusive slot. Historical missing-parent producer unproven. Original producer excerpts/candidate linkage A-19856.

### rev-37 · 2026-11-16T08:00:27.314Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1697-source-2
commit: 58f83349eca11d94485f534251e0ab0951f94d9a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Reworked recovery source clear at exact58f83349e; Standards and Spec clear, findings []. Both A-19849 findings resolved: streamed bounded scheduled recovery outside readiness, synchronous cancellation/join on close, exact external code basenames without generation traversal. Reviewed new T1 work-budget/external controls, unexecuted native lifecycle test, per-write publication, caller compatibility, docs and regenerated closure hashes. C1/C2/C3 remain runtime-unverified. Coordinator b3dcad69 authorizes source clear before lifecycle run; assigned slot must supply that exact-head receipt plus10 loaded full-file Linux --init C3 runs, separately from configured verification. A-19856 preserves predecessor red/green provenance, not corrected-head evidence. No Reviewer runs/edits. Artifact A-19867 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-19867-t-1697-corrected-recovery-source-review.md

### rev-37 · 2026-11-16T08:33:11.053Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1697-evidence-1
commit: 58f83349eca11d94485f534251e0ab0951f94d9a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Partial evidence settlement: C1/C2 verified, C3 pending/unverified, not final item settlement. Independently reconciled A-19883/run1270b05e at source-clear58f83349e and canonical tree3efbcc01925d47cdfb6557e4c27b35aeb5364ad9; uncached Linux x64 droplet Node24.21/Nvim0.12.5, pinned Headless Shell1248 Chrome156.0.8078.4. T0/allT1/fallback allT2/changedT3 lifecycle once/Web complete.6387 base test+702 file passes; separate240 load test+240 file passes; no negative finishes. Each six storage generated names has1 base+5 load passes; closure5 base; new lifecycle1 base pass/file receipt. RemainingT3/T4 not run here; budgets/lint/ratchet report-only. A-19856 red/green plus exact-head receipts establish C1/C2; historical missing-parent producer still unproven. C3's10 loaded full-file Linux Docker --init repetitions remain separate. No Reviewer runs/edits. A-19884 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-19884-t-1697-configured-evidence-c1-and-c2-c3-pending.md

Criteria: C1 verified, C2 verified.

### impl-1697 · 2026-11-16T09:06:39.141Z

C3 disposition/revised acceptance from Coordinator decisions7d5d5de1 and73d24380 (2026-11-16): (a)10 loaded Linux Docker --init runs, entry one-minute load>=8, of originally failing case 'lost native release reply settles without replaying native stop', selected via --test-name-pattern, each bounded60s; (b)2 full-file loaded claude-code-remote.test.ts runs bounded325s (file allowance), all cases passing. Same reviewed58f83349e. Original C3 ten full files is superseded by this explicit decision. No CPU-priority tuning. Initial load prerequisite attempt ran no test. Sample1 at entryload8.04/post11.54 was cut at generic180s while progressing:22 case passes, file cancelled1/native exit1; target case passed7.925692545s. It is INCOMPLETE at the file bound, not a checkpoint failure, and counts toward neither revised part. Full raw receipt will be preserved; no checkpoint ENOENT was observed. Repetitions resume in queued slot after impl-1731.
