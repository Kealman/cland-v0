---
id: T-1697
kind: task
title: Host agent checkpoint writes share one fixed '.new' temp name; a concurrent or late checkpoint fails with ENOENT
state: open
status: in progress
size: S
criterion_seq: 3
labels: []
assignee: null
parent: E-1881
blocked_by: []
topic: topic-1538
branch: t/T-1697-host-agent-checkpoint-writes-share-one
created: 2026-11-05T19:31:45.062Z
updated: 2026-11-16T07:50:20.197Z
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
- [x] C2. Concurrent checkpoints of one file never fail and never leave a partial file, and the last completed write wins (test).
  - done: impl-1697 · 2026-11-16T07:43:31.973Z
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
