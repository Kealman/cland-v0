---
id: T-1470
kind: task
title: Held human deliveries drain on any idle observation and on a timer
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1468
blocked_by: []
topic: topic-1253
branch: t/T-1470-held-human-deliveries-drain-on-any-idle
created: 2026-10-30T07:50:17.481Z
updated: 2026-10-30T19:27:50.995Z
---

## Summary

A human message held for `busy` leaves the queue only on an idle transition, so a stuck busy holds it until the 24 h TTL. Flush whenever any source observes idle, transition or not. While a human delivery is held, re-check the session on a timer.

Root cause: A-14159 (deaf-bridge RCA, 2026-10-30). Epic E-1468.

## Acceptance criteria

- [x] C1. A human delivery held for a busy session is sent within 60 s after any signal source reports the session idle, even when the state did not change.
  - done: impl-1470 · 2026-10-30T19:20:17.847Z
- [x] C2. While a human delivery is held, the hub re-evaluates the session at least every 60 s and logs `human-hold-recheck` with the state source and its age.
  - done: impl-1470 · 2026-10-30T19:25:50.918Z
- [x] C3. A busy state that comes only from a poll and is older than 5 min with no push signal no longer holds human deliveries.
  - done: impl-1470 · 2026-10-30T19:25:51.077Z

## Comments

### impl-1470 · 2026-10-30T19:16:47.574Z

Contract consumer inventory before change: human busy gating exists in HubCore.#sendTo (queued delivery) and Sessions.#inject (acknowledged delivery); both will use one HubCore predicate with Sessions supervision. State producers: Sessions.#hookSignal and host.signal, Claude/Codex/OpenCode adapter watch/resume paths. Consumers: spoke ack/role delivery, session.signal requests and clients (wire unchanged), persisted queued/uninjected Store readers, subscriptions and topic-withdraw regressions. Searches covered source, all hub/web/nvim test tiers, startup probes, docs/agents, qa briefs and shipped skills for fromKind/human, busy, flushQueued, #signal, host.signal, pendingFor and uninjected. No wire/schema field change; bare HubCore keeps its existing busy default. Existing legacy frame clients remain unchanged. Focused regression seam: memory HubCore + Sessions + fake harness/clock, observing exact delivery/injection records; no native process.

### coord · 2026-10-30T19:16:50.090Z

More evidence (coord, 2026-10-30 19:20Z): the same held-delivery class also hits agent reports to coord, not only human messages. The journal shows seven deliveries to coord with `acked` but no `injected` for hours, all injected together at 19:16:12.99–13.11Z:
- merge-batch:334e3a59…:T-1477, acked 09:17:12Z, about 10 h late;
- 502d08ba (impl-373), 4654cc18 (impl-1483), 6a0cc1ef (impl-1484), 1d8dcc3e (impl-1460), 4671e075 (rev-26) and 543a551b (impl-1471), acked between 15:37:19Z and 15:37:51Z, about 3 h 39 min late.

The 15:37Z group were replies to a coord broadcast (d4eb4f30). Neither hub restart #64 (19:05:27Z, which re-injected coord's role clause at 19:05:49Z) nor many later coord turns released them. They went out only at 19:16Z.

So an acknowledged delivery can sit outside the inject path across a restart and many idle and busy cycles. C1 and C2 should cover any held delivery to a session, not just human ones. If extending the scope is too much for an S item, report that and I'll file the agent-delivery path separately.

### rev-31 · 2026-10-30T19:25:03.912Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261030-1470-source1
commit: 28b9b1e69412b7faeaa7f6413e8e713cb49e9581
scope: full
findings: [{"severity":"medium","text":"M1: owning guide H1 and Notes index row missing; unchanged complete docs guard rejects it. Preserve metadata-only red/green.","file":"docs/agents/tests/hub-test-human-hold.test.ts.md","line":1},{"severity":"medium","text":"M2: stale poll observation can describe idle while Core is newly busy via retained-pool crew reuse. Eligibility/episode omit observation.state and direct state writers bypass new map, allowing fresh non-poll busy handoff to release human input. Unify state provenance and retain public reuse regression.","file":"hub/src/adapters/sessions.ts","line":1956},{"severity":"medium","text":"M3: in-memory supervision is not seeded from durable pending work after restart. Valid resume-unavailable/alive running path retains watch without retry; acknowledged agent delivery can remain unsupervised until external idle/reconnect. Seed at configured recovery and cover persisted agent + uncertain/terminal exclusions.","file":"hub/src/adapters/sessions.ts","line":1962}]
finding_counts: {"high":0,"medium":3,"low":0}

Consolidated source1 A-14641 has three medium findings. C1 accepted-idle normal drainage otherwise aligns; Coordinator-expanded agent/restart class included. A-14633/local and later working-tree corrections preserve attribution; no Reviewer workload or configured proof. Fix same base, preserve red/green/assertions, refresh claimant marks and request fresh source before Coordinator-owned full runtime verification.

Criteria: C2 failed (Retained acknowledged input may have no minute supervision after a valid live-but-discovery-unavailable restart.), C3 failed (Fresh crew-reuse busy can inherit an old poll-idle timestamp and bypass human delivery gating.).

### impl-1470 · 2026-10-30T19:26:30.589Z

Successor 9b5743610 fixes consolidated source1 M1–M3 on the same base. Consumer inventory now explicitly includes all direct Sessions state writers (crew reuse, stop, signal, process exit) through #setObservedState, plus both successful and alive/discovery-unavailable resume recovery. A-14643 records retained-pool and recreated-Sessions red/green receipts and exclusions. Local macOS arm64 Node24.21.0: human-hold.test.ts 8/8 and reviewer-requested owning test-docs.test.ts 3/3; typecheck pass; final test:lint exit0, zero refusals with 123 existing report-only findings and known T-1484 diagnostic. No T2/T3/T4/Web/full local suite. Successor source review routed to Reviewer (rev-32).

### rev-32 · 2026-10-30T19:27:50.995Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1470-source2
commit: 9b5743610b0a593018129a6bef17bb1d3faa4fca
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Successor full source clear A-14647. Same base66cf804fb/no dev merge. rev-31/A-14641 M1–M3 closed: canonical guide/index; all Sessions state writers share provenance with busy-state eligibility/continuation; successful and alive/unavailable recovery seed captured durable delivered ids. Public pool-reuse and retained-agent recovery controls retain exact injection receipts plus uncertain/terminal exclusions. Existing inflight/backoff and native signal trust unchanged; owned minute timers stop at close. T1 memory/fake-clock tests, docs/skill/CHANGES match. A-14633/A-14643/local lint summaries not configured runtime proof; C1–C3 remain unverified. Source-clear handoff to Coordinator-owned runtime verification; no Reviewer workload or new full/all task-head request.
