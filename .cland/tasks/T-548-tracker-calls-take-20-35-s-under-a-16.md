---
id: T-548
kind: task
title: Tracker calls take 20–35 s under a 16-session crew; the hub sits at 60–100% CPU
state: open
status: review
size: M
criterion_seq: 2
labels:
  - bug
  - hub
  - needs-triage
assignee: null
parent: E-425
blocked_by: []
regression_of: T-480
topic: topic-348
branch: t/T-548-tracker-calls-take-20-35-s-under-a-16
created: 2026-10-15T23:50:03.254Z
updated: 2026-10-16T01:19:16.330Z
---

## Summary
From 23:43Z on 2026-10-15, with about 16 Codex sessions live, the project hub (pid 7794) held 60–100% CPU for at least six minutes. Tracker calls slowed far past their budgets (slow-answer and slow-request in hub.log, 23:44–23:50Z):
- task.view: up to 35.3 s (9 slow)
- task.criterion: up to 34.5 s (13)
- task.comment: up to 22.2 s (6)
- merge: up to 36.7 s
- push: up to 14.9 s
- suite.start: up to 6.8 s
CLI calls hit their 10 s and 15 s limits, which caused T-537-style ambiguous outcomes: marks applied late, after "timed out". The trigger was a crew-wide burst of criterion marks and read-backs, but CPU stayed high after the burst. hub.log volume in the same window was about 987 events in 6 minutes: 170 session-usage, 111 event-announced, 87 session-state, 65 account-limits. Related cost findings: T-538 (hydrate re-queries its own kind) and T-539 (#tipsMoved full list).

## Acceptance criteria
- [x] C1. A CPU profile of the live hub under a comparable load names where the time goes (tracker hydration, journal or usage handling, event fan-out), recorded on this item.
  - done: impl-548 · 2026-10-16T00:46:06.972Z
  - verified: rev-31 [reviewer] · run rev-20261016-548-source · 2026-10-16T00:54:08.262Z · commit e15930b216f616aa469df33248674c03e7a9cc4b
  - verified: rev-31 [reviewer] · run rev-20261016-548-delta-1 · 2026-10-16T01:19:16.330Z · commit 8b5fe173a06ac0ab02c8c28381fcab0f9a062fcb
- [x] C2. With the fix, task.view and task.criterion stay within their 5 s budget under a 16-session fixture that issues a burst of 30 criterion marks, shown by a test or a recorded measurement.
  - done: impl-548 · 2026-10-16T00:46:09.093Z

## Comments

### coord · 2026-10-16T00:22:00.514Z

The hub restart at 00:19Z (pid 12296) cleared it: CPU was 9% one minute after start at load 2.2, with the same crew connected. So the high CPU was accumulated state in the long-running hub (pid 7794, up since 20:10Z), not session load alone. C1's profile should compare a hub that has run for hours with a fresh one under the same crew. Growth candidates: cached tracker state, subscriptions, event-announce fan-out.

### coord · 2026-10-16T00:34:57.020Z

Correction to 00:22Z: it isn't only accumulated state. The fresh hub, pid 12296 (started 00:18:50Z), was at 9% one minute after start, before the crew resumed. Fifteen minutes later it was back at 43–100% CPU with 357 MB RSS and machine load 15. Slow calls since 00:25Z:
- task.view: up to 41.7 s (5 slow)
- demo.exec: up to 24.3 s (8)
- session.launch: up to 20.8 s (2)
- demo.status: up to 15 s (2)
- demo.stop: up to 10.8 s
- push: up to 9.4 s
- send: 27 slow, up to 977 ms
So it is load-driven: about 20 live sessions plus demo traffic. Promoted into E-425 (Hub hygiene) and started, because it slows every tracker call for the whole crew.

### coord · 2026-10-16T00:39:55.692Z

Likely root cause (Coordinator, 00:40Z, from the code): T-480 (b9e5e0c1, merged 2026-10-15 22:26Z) added `Journal.subagents(item)` to every `task.view` in dispatch.ts. It flushes the journal, then streams and JSON-parses the whole `.cland/journal.jsonl` (74 MB, about 420k lines) to find the item's subagent-launched rows. Each task.view is a full journal scan, so bursts of reads saturate the hub. That matches the timeline (onset after 22:26Z, worst during read bursts) and the 35–42 s task.view times. Fix direction: an in-memory per-item index built once at start and updated on write, with T-480's output unchanged. Set regression_of T-480.

### impl-548 · 2026-10-16T00:40:45.884Z

Reproduction fixture prepared at the frame seam: 20 simulated adapter sessions, production-rate usage/state/account updates, 30 criterion marks and 20 concurrent task.view calls; compare empty history to 200,000 retained synthetic events (~65 MB). A separate Journal regression moves the already-open journal path after startup, so lookups must preserve restored/live rows without stat/open/scan per query. Mac load/busy gate currently blocks the first targeted run; no live hub was profiled or signalled.

### impl-548 · 2026-10-16T00:51:56.184Z

Implemented and pushed 6c16f023ca109e4fdddbef5fc7c54e5aec4fdf58. A-3505 records C1/C2 evidence; raw CPU profiles A-3502 (baseline) and A-3503 (fixed). task.view 9,926→362 ms at 200k rows/54.9 MB; final same-head load rerun max459 ms (criterion446 ms). Targeted journal-subagents regression green (red before fix); journal-async 14/14 and session-model 11/11 green. Full repo typecheck and diff check pass. Origin/dev fetched/merged before first source review. QA policy scope none/after-stage, no per-item brief. Ready for source review.

### impl-548 · 2026-10-16T00:53:26.562Z

Review admission fix: new test files registered conservatively as machine shards; npm run test:shards green (6 free / 183 machine). New exact pushed review head e15930b216f616aa469df33248674c03e7a9cc4b. Prior merge9254bee6 changed tracker/QA brief only; source and tested hub/nvim inputs match implementation6c16f023. Source review owner is the initial selected Reviewer (rev-31).

### rev-31 · 2026-10-16T00:54:08.262Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-548-source
commit: e15930b216f616aa469df33248674c03e7a9cc4b
scope: full

Source review clear at e15930b216f616aa469df33248674c03e7a9cc4b, run rev-20261016-548-source, scope full. Initial implementation 6c16f023; pre-verdict merge 9254bee6 changes tracker/QA files only, with no hub/nvim changes. Final shard-only correction e15930b2 adds both new tests as machine. No high, medium or low findings remain.

## Standards
No findings against AGENTS.md, docs/agents/tests.md, journal durability conventions or smell baseline. The transient missing-classification finding was fixed before this verdict. Shard lint reported green (6 free/183 machine); diff check passes. No new persistence or response shape is introduced. Both axes reviewed in this session because delegation is disabled. Criteria/body read from the task file, avoiding the expensive live task.view per Coordinator bd00929a.

## Spec
C1 verified. A-3505 diagnosis and raw profiles A-3502/A-3503 inspected. Independent aggregation of sample time deltas confirms baseline journal.ts per-line callback 3.926 s self CPU plus subagents 0.460 s, versus fixed one-time restore callback 0.129 s. Comparable scratch profiling is explicitly accepted by Coordinator f7cfd891-4972-4886-bcdc-446dc5f41311; no live hub profile or signal is claimed.

Journal constructor restores historical subagent rows once before queued producers append. The same required-field validation, exact item attribution, order and unreported fallback are shared by historical and live paths. Live rows enter the map only after their complete async append succeeds; failed appends still propagate through existing flush/close behavior. Serialized accepted records prevent post-write mutation. subagents(item) retains its flush barrier and returns copied rows with no stat/open/stream/JSON scan at query time.

Regression journal-subagents.test.ts checks historical/malformed/unrelated rows, empty-model fallback, renamed-path lookups without reopening, live append visibility, caller/producer mutation isolation and restart reconstruction. Tracker-load tests use the real frame edge, 20 seeded session processes, production-rate publications, 30 criterion marks and 20 concurrent views, with both fresh and 200k-event history and a 5 s bound on each request type. A-3505 records before/after large-history max view 9926→362 ms and final tested rerun max view459/criterion446 ms. This establishes the intended regression; C2 stays unverified pending exact-head gate execution.

Supporting compatibility evidence: journal-async14/14, session-model11/11, tracker-load2/2 and journal-subagents regression green reported; full typecheck green. Existing journal short-write/failure ordering was inspected with the changed append path. Local source/test inputs are unchanged by the final tracker merge and manifest addition.

Source clear permits the Coordinator-requested no-flag verify at this exact head; final verdict and C2 wait for that same-head result. No Reviewer edits, suite execution or network calls. No per-item QA criteria.
Standards: 0 findings. Spec: 0 findings.
Review artifact A-3514: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3514-t-548-source-clear-at-e15930b2-indexed-subagent-reads.md

Criteria: C1 verified.

### impl-548 · 2026-10-16T01:12:34.795Z

Scope qualification A-3537: the CPU profiles prove repeated task.view journal scans and their removal, but do not measure ProjectSessions archive sweeps, accumulated offline-recipient fan-out or workbench journal.events polling. The Coordinator's 01:11Z evidence of residual CPU despite suppressed task.view was reported separately as M/Bugs for filing; no hotspot attribution claimed from this narrower fixture. Reviewed source remains unchanged at e15930b2. Verify8efd2c7a has started via hub-authorized local fallback because remote budget6/6 is full.

### rev-31 · 2026-10-16T01:19:16.330Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-548-delta-1
commit: 8b5fe173a06ac0ab02c8c28381fcab0f9a062fcb
scope: delta

Delta source clear: e15930b2..8b5fe173 changes only hub/test/durations.json, byte-identical to Coordinator-posted 2149fe33 (A-3493 / integrated a06020a3). JSON parsing and diff check pass. Standards: no findings. Spec: no findings; original implementation and test inputs unchanged, preserving A-3514 source analysis and profile evidence. C1 reverified at this head; C2 remains pending same-head post-source gate. No Reviewer test run. Prior 8efd2c7a is not final evidence at this head. Initial hold attempt timed out and was not retried under saturation guidance.
Artifact A-3550: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3550-t-548-manifest-delta-source-clear-at-8b5fe173.md.

Criteria: C1 verified.
