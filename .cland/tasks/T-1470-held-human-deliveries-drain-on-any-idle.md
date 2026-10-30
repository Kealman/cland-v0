---
id: T-1470
kind: task
title: Held human deliveries drain on any idle observation and on a timer
state: closed
status: done
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
updated: 2026-10-30T21:52:17.829Z
closed: 2026-10-30T21:52:17.829Z
---

## Summary

A human message held for `busy` leaves the queue only on an idle transition, so a stuck busy holds it until the 24 h TTL. Flush whenever any source observes idle, transition or not. While a human delivery is held, re-check the session on a timer.

Root cause: A-14159 (deaf-bridge RCA, 2026-10-30). Epic E-1468.

## Acceptance criteria

- [x] C1. A human delivery held for a busy session is sent within 60 s after any signal source reports the session idle, even when the state did not change.
  - done: impl-1470 · 2026-10-30T20:39:25.735Z
  - verified: rev-32 [reviewer] · run rev-20261030-1470-evidence2 · 2026-10-30T21:28:39.088Z · commit be5b629baed4863150c3691642a1704cf12a2b87
  - verified: rev-32 [reviewer] · run rev-20261030-1470-delta1 · 2026-10-30T21:45:44.759Z · commit 6f2ce4b63b2b23984a0acdcc245371d94a341be3
- [x] C2. While a human delivery is held, the hub re-evaluates the session at least every 60 s and logs `human-hold-recheck` with the state source and its age.
  - done: impl-1470 · 2026-10-30T20:39:25.853Z
  - verified: rev-32 [reviewer] · run rev-20261030-1470-evidence2 · 2026-10-30T21:28:39.088Z · commit be5b629baed4863150c3691642a1704cf12a2b87
  - verified: rev-32 [reviewer] · run rev-20261030-1470-delta1 · 2026-10-30T21:45:44.759Z · commit 6f2ce4b63b2b23984a0acdcc245371d94a341be3
- [x] C3. A busy state that comes only from a poll and is older than 5 min with no push signal no longer holds human deliveries.
  - done: impl-1470 · 2026-10-30T19:25:51.077Z
  - verified: rev-32 [reviewer] · run rev-20261030-1470-evidence2 · 2026-10-30T21:28:39.088Z · commit be5b629baed4863150c3691642a1704cf12a2b87
  - verified: rev-32 [reviewer] · run rev-20261030-1470-delta1 · 2026-10-30T21:45:44.759Z · commit 6f2ce4b63b2b23984a0acdcc245371d94a341be3

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

### rev-32 · 2026-10-30T20:37:10.358Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261030-1470-evidence1
commit: 9b5743610b0a593018129a6bef17bb1d3faa4fca
scope: evidence
findings: [{"severity":"medium","text":"M4: unconditional repeated-idle #retry and minute timer #retry at1992 include previously attempted inject-unconfirmed deliveries. Original composition assertion 'idle observations alone do not retry an unconfirmed input' fails 3 !== 2 at adapter-composition.test.ts:193. Preserve transition-only retry for unconfirmed/rejected attempts; only never-attempted or positively pre-harness-refused work may drain on repeated idle/timer per Coordinator5c2a45be. Add split control; keep existing assertion/backoff.","file":"hub/src/adapters/sessions.ts","line":1776}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear A-14677/rawA-14675 all runa4f66679. Exact adapter-composition failure quoted in artifact; source passA-14647 missed this consumer/fence and is superseded for its fence claim. T0/T1 pass,T2 exit1; completed3846/3845pass/1fail before interruption, separate tieraggregate3681/3680/1 not extra coverage. T3/Web unexecuted,browsernull,report-only warnings separate. C1/C2 failed,C3 unverified. Keep original adapter composition assertion; correct safe retry eligibility plus split control, run Coordinator-named files singly, then new exact-head source review before Coordinator-owned all run. No Reviewer execution.

Criteria: C1 failed (Repeated idle drainage replays a previously unconfirmed attempt; original composition fence fails 3 !== 2.), C2 failed (Minute retry uses the same unfiltered uninjected path and does not preserve required attempted-work fence.).

### impl-1470 · 2026-10-30T20:39:42.684Z

M4 at be5b629baed4863150c3691642a1704cf12a2b87: original adapter-composition assertion preserved; production repeated-idle/minute/recovery replay now keys on durable injectionStarted=false. Attempted-unconfirmed work retains busy→idle/reconnect/backoff. Existing injectionStarted consumers are Store migration/startInjection/deliveriesOf, Core withdrawal admission, Sessions injection and tests; no field/schema changes. A-14682 records exact original 3!==2 failure and new split/restart red→green. Local macOS Node24.21.0 singly: human-hold8/8, adapter-composition4/4, inject-stalled8/8, codex-delivery22/22; typecheck passed; lint completed exit0/zero refusals, existing advisory diagnostics. Prior Linux full run A-14675 remains failed/partial (T3/Web unexecuted). Fresh source review requested from rev-32; no further checks during Coordinator's quiet slot.

### rev-32 · 2026-10-30T20:40:30.002Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1470-source3
commit: be5b629baed4863150c3691642a1704cf12a2b87
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full successor source3 clear A-14683. M4 closed: existing persisted injectionStarted plus state governs repeated-idle/timer/recovery safe drainage; legacy attempted rows remain conservative. Busy-to-idle/reconnect keep attempted retry and #inject backoff/inflight; explicit uncertainty remains excluded. Original adapter-composition assertion and inject-stalled/codex-delivery files unchanged. New split and durable-ack/pre-attempt recovery sibling controls assert exact attempts/states. M1–M3 fixes retained; docs/contract/skill updated. A-14682 local summaries separate from configured runtime. A-14675 remains failed at prior head with T3/Web unexecuted. C1–C3 remain runtime-unverified; ready for Coordinator-owned all-run handoff, not a new Reviewer task-head full-run request. No Reviewer execution.

### rev-32 · 2026-10-30T21:28:39.088Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1470-evidence2
commit: be5b629baed4863150c3691642a1704cf12a2b87
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final executed-head evidence clear A-14696/raw A-14695 Coordinator all runfb275c5f. Matched5927 ordinary pass/8 skip/720 file pass +165 separate load test/file passes, no failures/cancel/todo/unmatched finishes; terminal totals5935 agree. Eight human-hold identities ordinary+5/5 each, all pass; max0.113857s. C1 exact receipt,C2 minute/source/age,C3 poll-only expiry plus push/reuse/recovery/never-attempted/uncertain controls satisfy source3. Unchanged M4 composition assertion passes0.092088s; all composition4/inject-stalled8/codex-delivery22 pass. T0/T1/T2/T3/Web exit0; no T4 phase. Linux droplet Node24.21.0, Headless Shell1248/156.0.8078.4, footer candidate tree69c05f47 matches static filtered headtree, cachednull; Web4workers/hostcheck reused. Eight reasoned platform/OpenCode skips retained, not coverage; report-only lint/budget/ratchet/incomplete-baselines retained. A-14675 remains prior-head red. C1–C3 verified ONLY at be5b629ba; successor6f2ce4b63 needs authorized separate delta/text-check carry review. No Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-32 · 2026-10-30T21:45:44.759Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1470-delta1
commit: 6f2ce4b63b2b23984a0acdcc245371d94a341be3
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta clear A-14700 under Coordinatora4e3469d docs/help waiver. Parents executedbe5b629ba+dev2b487a325. Own production/test/guide and fence files byte unchanged; incoming code/test/shared files dev-exact. Only manual SKILL resolution retains both parents' nonblank text, three intended sections once; CHANGES/index/README/tiers preserve both contracts. A-14698 original existing tool-return exports establish post-merge typecheck exit0/docs3/3/provenance1/1/lint15headers exit0; combined captures, no separate raw streams/no truncation marker/no reruns. C1–C3 refreshed via explicit carry of fb275c5f/A-14695/A-14696 atbe5b629ba plus unchanged-source delta and targeted checks, NOT a new-head suite. Retain5927pass/8reasonedskip,T0–T3/Web/noT4,report-only limits and predecessor platform/browser. A-14675 remains prior red. No Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-30T21:52:17.829Z

Merged bd9fd9cf41dc77a0ccb2f90d88deccdfe14e5734 onto dev.
