---
id: T-1190
kind: task
title: Duration allowances expire overnight with no warning and fail every shard plan
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1195
blocked_by: []
topic: topic-925
branch: t/T-1190-duration-allowances-expire-overnight
created: 2026-10-24T00:03:56.390Z
updated: 2026-10-24T06:57:28.088Z
---

## Summary

At 00:00Z on 2026-10-24 the duration allowance for `hub/test/cli-identity.test.ts::a launched session cannot borrow another identity…` expired. From then on every T3 shard plan failed with `ShardManifestError: expired duration allowance`: periodic dev T3 run 3bb25b4e at 7bdf8367, A-10287. Twenty-four more E-880 allowances were due to expire by 2026-10-26. The Coordinator renewed all 25 to 2026-11-23 under D72 (6673d75e). Expiry is a calendar event, but nothing warns before it: a whole release cover can turn red overnight with no code change.

## What to build

Warn ahead of expiry instead of failing at shard planning. For example:
- the periodic dev T3 report and the hub's heartbeat list allowances expiring within 48 hours, with their owner;
- `cland durations renew --owner <id> --until <date>` applies a reviewed renewal within the owner's span limit.

Planning still refuses an expired entry, but the refusal names every expired key and the renewal command.

## Acceptance criteria

- [ ] C1. An allowance expiring within 48 hours appears in the periodic dev run report and the Coordinator's heartbeat, naming the test and owner (test).
  - failed: rev-23 [reviewer] · 2026-10-24T06:57:28.088Z · note Heartbeat publication uses session identity/role/process/crew/schedule captured before the durationWarnings await; rename or eligibility changes can publish a stale heartbeat.
- [x] C2. A shard-planning refusal for expired allowances lists every expired key, not only the first (test).
  - done: impl-1190 · 2026-10-24T06:52:05.168Z

## Comments

### impl-1190 · 2026-10-24T06:50:56.795Z

Implementation uses one reusable midnight-UTC expiry listing in suite-durations.ts. Shard planning aggregates expired keys. The hub reads the current project manifest at Coordinator heartbeat and periodic dev-T3 report time, warning for every allowance at <=48h and already expired entries. Added failing-then-green tests at packageShards, native heartbeat injection with FakeClock, and published periodic result. Optional renew CLI omitted; seconds/reasons and durations.json unchanged. hub/README.md documents flow; docs/agents/tests.md left untouched for T-1199.

### rev-23 · 2026-10-24T06:57:28.088Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-1190-source
commit: 9bda24e3bae795f58282be705bee1e5d9dc55111
scope: full
findings: [{"severity":"medium","text":"M1: re-resolve current session identity and heartbeat eligibility after the asynchronous warning read; pre-await name/role/process/crew/schedule can be invalidated by rename, handover, disable or stop/prune before publication. Add held-read public regressions.","file":"hub/src/hub/core.ts","line":380}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1190 full source review — not clear

Head 9bda24e3bae795f58282be705bee1e5d9dc55111; tree fc13ed21e209aa0a83e25def26fa5bbd71571c3d. Fixed base b16fa823dca02f77b569084c12cdb318be3f14b4. Comparison: git diff b16fa823dca02f77b569084c12cdb318be3f14b4...9bda24e3bae795f58282be705bee1e5d9dc55111. Scope: nine files, 125 additions / nine removals. Run rev-20261024-1190-source.

## Standards

M1 (medium), hub/src/hub/core.ts:380–387. The new asynchronous duration-warning read separates the heartbeat's eligibility decision from publication. The session name/role snapshot, running-process test, crew heartbeat setting and durable schedule are all captured before the await. Only hub closure is checked afterward. A rename, Coordinator handover/role clear, heartbeat disable or process stop/prune can complete while that read is held. When it resolves, the old name is still passed to replaceHeartbeat and recordNotice, and firedHeartbeat consumes the old interval. Rename can queue a notice to an obsolete name; role or stop changes can publish a Coordinator warning after eligibility has ended. This interleaving did not exist in the previous synchronous tick. Resolve the current session identity, role/process/crew eligibility and schedule at the commit boundary, retaining serialization and closure handling. Add held-read public heartbeat regressions for rename and role/terminal invalidation, observing the held boundary and exact resulting/no stale delivery. The implementer accepted this finding and is correcting it; no corrected head has been reviewed.

No separate smell finding. The shared UTC date/expiry helper is appropriately narrow. Existing tier/lifecycle seams are reused; no new process/browser is added. New shard-planning test uses a restored mock of Date.now and an owned file-only fixture; new heartbeat coverage uses FakeClock plus existing fake harness/native injection receipt; the periodic result test observes the actual published report. Existing assertions are retained. Reviewed against AGENTS.md, docs/agents/tests.md, Coordinator seam decision 0a137d09 and the applicable project rules. Both review axes were performed in-session under the Crew's no-subagent policy.

## Spec

No additional source finding. Valid dated allowances use one midnight-UTC interpretation, include the exact 48-hour boundary, retain already-expired entries, and exclude date-free legacy allowances. Warnings name keys and owners, use the current project manifest, and are added to Coordinator heartbeat text and periodic dev-T3 report/detail. Read/parse errors are caught so the reporting path can remain available. The periodic test reads a manifest written while the detached run was in progress and distinguishes due/later/legacy entries.

Planning still refuses expiry. After entry validation it collects all valid expired keys into one ShardManifestError and gives a manual added/expires renewal hint. The public packageShards regression includes two expired keys (one exactly at UTC midnight) and excludes a future key. No allowance amount, reason, duration manifest, dependency, tests.md or role clause changes are included. The illustrative renewal CLI is deliberately omitted and README explicitly describes reviewed manual edits and existing span limits; there is no undocumented command.

C1 is not clear because M1 permits the heartbeat's warning delivery to use stale ownership/eligibility. C2's source and targeted regression shape are sound, but runtime-dependent verification remains pending. No criterion is verified by this source verdict.

Evidence and limits: A-10328 corrects the targeted count to 109 tests in 14 serial files, local Darwin arm64 Node 24.21.0, plus npm run check reported passing. The prior 129 count is superseded. Scripted Linux facts in report fixtures are not Linux executor coverage. The lead is preserving original stdout/exits from session records with actual source provenance; no rerun for transcription is requested. No configured verification has been admitted for this head, and no Linux/full-suite/T3/T4 coverage is claimed. Reviewer performed read-only source, Git and artifact inspection, without tests/probes, edits, live browser, merge or delegation.

Complete finding set: M1 only. Correct it, preserve original receipt provenance, incorporate only the Coordinator-authorized shared fix, then request fresh source review at the pushed replacement head before verification. QA policy none/after-stage with no per-item QA brief; after-stage QA is separate.

Standards: one medium finding. Spec: zero additional findings; C1 blocked by M1.
Durable review A-10333.

Criteria: C1 failed (Heartbeat publication uses session identity/role/process/crew/schedule captured before the durationWarnings await; rename or eligibility changes can publish a stale heartbeat.).
