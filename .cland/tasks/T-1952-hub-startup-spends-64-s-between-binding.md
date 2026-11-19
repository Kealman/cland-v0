---
id: T-1952
kind: task
title: Hub startup spends 64 s between "binding listeners" and "binding web listener", so a restart gap exceeds the 60 s bridge expiry
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1639
branch: t/T-1952-hub-startup-spends-64-s-between-binding
created: 2026-11-17T21:09:36.382Z
updated: 2026-11-19T02:44:41.688Z
---

## Summary

Hub restart #82 (2026-11-17, pid 57331, at ca5f70ca4) had an 87 s gap between stop (21:02:34Z) and serving (21:04:01Z), over the 60 s limit after which a session's mod bridge expires. The startup journal shows 64 s from "binding listeners" to "binding web listener" (21:02:52Z to 21:03:56Z); the journal read took 6.6 s, and every other step under 5 s. impl-1950 traced daemon.ts: that step only awaits the websocket and socket edge creation, and executor recovery starts after serving, so no lease read sits inside it (topic-1605). Background I/O from T-1950's 4,202-lease reads may contend, but that is not measured.

## What to build

Find what the edge creation waits on for 64 s with a startup profile or step-level timing receipts, and bring the step within its normal few seconds. Each startup step's duration is recorded so the next long gap names its step.

## Acceptance criteria

- [x] C1. The cause of the 64 s step is named with evidence, for example a profile, per-await timings or a reproducer on a fake root with many artifacts or leases (test or artifact).
  - done: impl-1952 · 2026-11-19T02:33:38.623Z
- [ ] C2. After the fix, a fixture hub with the same scale of retained state binds its listeners within a stated budget, and startup records each step's duration (test).
  - failed: rev-36 [reviewer] · 2026-11-19T02:44:41.688Z · note Listener timing diagnostics can discard acquired edges or replace bind errors, and the new regressions lack complete caller/setup and fake-native boundary ownership.

## Comments

### coord · 2026-11-18T06:13:51.239Z

Restart #83 (2026-11-18, dev 303b482b8, with T-1950 live): the step from "binding listeners" to "binding web listener" took 57.7 s again, against 64 s at restart #82. So the released-lease read was not the cause; T-1950's index removed readLease cost (0.4% of a 15-minute profile, down from 7–9%) without shortening this step. Every other startup step is under 6 s, and this one alone keeps hub restarts over the 60 s bridge expiry (gap 78 s at #83). Source: the hub operator session's restart report.

### coord · 2026-11-18T12:31:25.680Z

Restarts #84 and the respawn after it (2026-11-18, dev 93026cbe9, same code and tree): on pid 20702 (clean stop, then start) "binding listeners" → "binding web listener" took 2.0 s, and the gap was 50 s. Four minutes later, on pid 52877 (launchd respawn after a fatal exit without cleanup), the same step took 51.7 s and the gap was 70 s. Restarts #82 and #83 were clean stops too and took 57–64 s, so "clean versus unclean stop" isn't the whole explanation; the step varies between 2 s and 64 s on the same code. Source: the hub operator session's report.

### human · 2026-11-18T19:17:07.579Z

Restart #85, 2026-11-18 18:34:57Z, pid 62039 at d7050e7e2: 'binding web listener' took 148,145 ms (gap 175 s). Restart #86 at 19:10:48Z, pid 71467 running a343e305a code: the same step took 615 ms (gap 23 s). Earlier: 64 s (#82), 57.7 s (#83), 2.0 s (#84), 51.7 s (respawn 52877). (cland-impl)

### impl-1952 · 2026-11-19T00:45:52.297Z

Consumer search for additive hub-startup-listener-completed receipts: daemon log producer; cli/startup-diagnostic.ts reads only existing step starts; measure-memory.ts reads existing starts/serving; startup-ready-component, startup-replies-scale, startup-cleanup, startup-deadline-component and startup-diagnostic tests; docs/hub/coordinator-subscription-procedure.md. Existing step names/shapes remain unchanged, including older-hub diagnostics. No wire reply, setting or admission contract changes.

### impl-1952 · 2026-11-19T00:53:37.373Z

Preliminary red evidence published as A-21461. Full startup scale green is waiting for T-1646 to land and a new native slot (Coordinator instruction). Candidate defers scheduled freshness until serving, yields between answers, and logs each listener await including failures. T2 startup-ready-component: 6/6 pass on the uncommitted candidate, local macOS arm64 Node v24.21.0. Whole-project typecheck passes. Consumer inventory also includes every Tracker.start caller; deferFreshness is optional and defaults false so standalone trackers retain immediate scheduling. The daemon is the only opt-in caller and resumes both listening and stdio-only hubs after serving. Existing freshness workers retain stop drainage ownership over their new immediate yield.

### impl-1952 · 2026-11-19T02:18:34.905Z

Additional consumer inventory for optional onChange batch wrapper / publishTaskBatch: production createHubBase (server.ts) opts in; dispatcher guard invalidation, merge-queue reconciliation and adapter sessions retain the original per-item callback and argument. Legacy single-listener consumers in tracker-summary, merge-policy, stage-closure-component, task-worktrees, freshness and merge-recovery tests remain unchanged and exercise the previous callback shape. ItemChange and task wire frames are unchanged; no nvim, frozen CLI bytes, persisted readers or skill examples use the new optional wrapper. Inspector stack: Store.topics -> HubCore.refreshExplorerContext -> publishTask -> Tracker.announce -> announceBatch -> Freshness.settled/work. Work-count red observed 4 topics reads for a four-item batch; candidate observed 1.

### impl-1952 · 2026-11-19T02:25:48.661Z

Follow-up (S, Tech debt): hub/src/verification-tree.ts committedTree() catches every committedTreeOrThrow rejection into null, including native launch guard refusal; Tracker constructor stageTree default consumes that null as unknown. Coordinator to assess structured failure metadata under rule 39.

### rev-36 · 2026-11-19T02:44:41.688Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1952-source-1
commit: 0aea22c4a875b945f51b4ecc469d48f87717e67e
scope: full
findings: [{"severity":"medium","text":"The new bind timing wrapper logs from finally without containing sink failure. If logging throws after an edge was acquired, bind rejects before ws/spoke/edge assignment and the cleanup owner loses that listener; if acquisition failed, the diagnostic replaces the original failure. Preserve the acquired edge and original outcome through ancillary logging failure, with real edge/cleanup and bind-rejection controls.","file":"hub/src/hub/daemon.ts","line":657},{"severity":"medium","text":"The new scale callback and the batch-work-count callback in startup-ready-component.test.ts:23 acquire fixtures directly without a pre-acquisition whole-caller fence/join or separately named setup bound. Resource helpers do not own the callers' later seed/import/wait/request continuations, so timeout can outlive cleanup and mock/guard restoration. Compose an existing whole-case owner around these affected callbacks, preserving their assertions.","file":"hub/test/startup-listener-scale.test.ts","line":17},{"severity":"medium","text":"The new fake-only batch callback has no positively controlled native-launch guard, and the scale callback installs its guard only after fixture acquisition/seeding. Cover the complete new setup/body/cleanup sequences and explicitly inject any reachable stage-tree/native boundary; keep the existing positive guard and avoid unrelated fixture enrollment.","file":"hub/test/startup-ready-component.test.ts","line":23}]
finding_counts: {"high":0,"medium":3,"low":0}

Full Standards and Spec source review at 0aea22c4a875b945f51b4ecc469d48f87717e67e, tree 1a4b5bdc836fd35b72274e91d133b9cd547c4265, fixed base 3e99d425b after the pre-first-review dev merge. Three medium findings; none high or low. A-21501 records source, calibration, consumer checks and retained-evidence limits.

The new listener timing finally can discard an acquired edge before ws/spoke/edge assignment or replace the original bind error. Both new regression callbacks lack a whole-caller setup/cancellation owner despite resource helpers. The new T2 callback has no positive native-launch guard, while the T3 guard starts after acquisition/seeding. The Implementer confirmed all three in bb9f33bc, without an omitted owner or approved disposition.

The batch-context policy, default-preserving deferred freshness, post-serving resumption in both modes, worker yield/stop join, additive old-reader event shape and stageTree fixture forwarding were checked. The work-count red4!=1 and inspector stack name a concrete repeated full-context refresh; they do not prove every historical long bind had only that cause. Coordinator a72f16af/fe29dfff accepts the 375-want gate and report-only1500; 613785c4 accepts standing E-880. The exact-case15s allowance expires2026-11-26 and explicitly labels Linux projection rather than a Linux sample.

A-21496 retains positive macOS arm64/Node24.21 guarded working-tree T3 outputs:375 wants bind14.352ms/request85.442ms;1500 bind12.333ms/request317.957ms, with exact during-drain response and native code0/signalnull. Their tested whole trees are unknown and differ from exact-head verification. A-21500 enumerates61 distinct pinned T1 filenames with file closes across two attempts; initial init-roots code1/HOME failure, resumed48 positives and prior invalid-owner lint failure remain retained. These are not an aggregate case pass. Final precommit full lint/typecheck exit0 excerpts, unknown raw/native/tree facts, deferred T2/T3/T4/browser/configured phases and incomplete retained QA filename census are explicit. Reviewer ran no tests, probes or scanners; source is clean and unchanged.

C2 failed; C1 remains done but unverified. No criterion verified. This consolidated verdict releases the source/experiment pin for the three scoped corrections. Preserve the calibration, work-count/response assertions and historical failure scopes; request fresh immutable-head source review before configured verification under the Coordinator's window.

Criteria: C2 failed (Listener timing diagnostics can discard acquired edges or replace bind errors, and the new regressions lack complete caller/setup and fake-native boundary ownership.).
