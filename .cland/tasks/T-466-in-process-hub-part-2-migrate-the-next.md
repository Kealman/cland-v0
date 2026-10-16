---
id: T-466
kind: task
title: "In-process hub, part 2: migrate the next files to bring daemon starts per full run under 600"
state: open
status: review
size: M
criterion_seq: 2
labels:
  - v0.1.3
  - hub
  - needs-triage
assignee: null
parent: E-387
blocked_by: []
topic: topic-359
branch: t/T-466-in-process-hub-part-2-migrate-the-next
created: 2026-10-15T09:03:10.279Z
updated: 2026-10-16T05:47:05.301Z
---

## Summary

After T-393 moved its top 20 files in-process, the projected daemon starts per full run are 772 (A-2804, against A-2737's 1047). The E-387 target is under 600, so at least 173 more net removals are needed. A-2761 ranks the next candidates: tracker-levels 24, subscriptions 20, artifacts 18, tracker 16, visibility 15, epic-close and tracker-rank 14 each. Each needs the lifecycle audit T-393 used.

## Acceptance criteria

- [x] C1. The next files move to the in-process hub with their lifecycle tests kept spawned and their assertions unchanged, with an audit posted.
  - done: impl-466 · 2026-10-16T05:43:45.284Z
  - verified: rev-30 [reviewer] · run rev-20261016-466-source · 2026-10-16T05:47:05.301Z · commit 88a3630e8d0a8dc012d43935e04befa23cbd1120
- [ ] C2. A full-run census shows daemon starts under 600.

## Comments

### impl-466 · 2026-10-16T05:40:40.438Z

Migrated 28 test files using projectHub while retaining every identified hub lifecycle/restart case; helper-based startup in tracker, task-plan and plan-gate is explicitly preserved for their restart tests. Against current origin/dev08f63731 (T-574 shared fix merged), all271 test declarations and2,316 assertion callsites remain byte-identical. Targeted validation is proceeding serially in Coordinator-assigned Mac slotB, load<10/local:none with PID cwd guards; no failures so far. Coordinator corrected the load-gate assumption: unchanged identities are known; one whole-file pass per file and second passes for tracker-levels/subscriptions/artifacts/tracker/visibility, then fresh droplet gate. C2 measurement will use the one authorized post-review full local census, separately from the droplet gate. Audit artifact to follow.

### rev-30 · 2026-10-16T05:47:05.301Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-466-source
commit: 88a3630e8d0a8dc012d43935e04befa23cbd1120
scope: full

# T-466 source review clear at 88a3630e

Head88a3630e8d0a8dc012d43935e04befa23cbd1120; branch t/T-466-in-process-hub-part-2-migrate-the-next.
Fixed point08f63731abb89f5acea9c0a0d746f4ea2b19d0e4, latest dev merged before first review including T-574. Commits57daa670 migration,48555295 pre-review merge,88a3630e descriptive comments. Origin ref matches. task.view confirms claimant/C1/C2. Direct Standards/Spec review; no Reviewer execution.

## Standards
No high, medium or low findings (0).
Net scope28 test files only; no production code, harness/seam, manifest, shard, Neovim or package change. Complete changed-line audit reduces to unchanged-argument startDaemon→projectHub selections/imports, explanatory comments and three lifecycle-helper opt-ins. Independent comparison of assertion-bearing and test-declaration lines finds no changes; assertion call-start count2316 agrees with supplied A-3758 audit. A-3758 records271 syntactic declarations and byte-identical full assertion calls; embedded fixture text can add lexical test( matches, so that declaration count is attributed to the supplied audit rather than an invented parser run.
Existing projectHub invokes serveProject with fixture env, real discovery/socket/WebSocket, asynchronous project log/flush and owned-resource checks before directory teardown. Every prior fixture env object is passed through; no global process.env mutation/new signal handler is added. CLI/spoke/native fake harnesses remain real child processes. Tests whose observed lifecycle belongs to the session/native child can migrate their hub without converting that child into a fake.

## Spec
C1 verified. Retained-daemon audit has37 syntactic retained cases, expanding the two three-harness loops to41. Hub stop/restart/crash/PID cases retain original spawned starts and subsequent restart calls:
- tracker.test project helper defaults in-process, but its live-hold/persistence restart case now explicitly tempProject+startDaemon for the first hub; CLI no-hub refusal remains no hub.
- task-plan setup adds spawned=false and opts its three restart cases into true, preserving each later startDaemon.
- plan-gate setup adds options.spawned and opts interrupted migration/restart into true.
- other per-file lifecycle starts remain untouched, including role launch-reservation crash, Claude restored/PID-reuse case, subscriptions/progress across restart, artifacts/visibility retention, criteria killed-writer recovery, status startup migration and verdict provenance restart.
Signal scan checked migrated Claude/role/subscription/visibility cases: kills refer to real launched session process rows, not the embedded hub. Actual hub-PID crash case remains spawned. readDiscovery used merely to reach the real protocol is not a process-identity assertion and remains exercised through actual discovery edges.
The helper branch changes preserve the complete original assertions, test names, native process controls and bounds. No lifecycle claim is replaced by an in-process stop acknowledgement.

## Evidence audited
A-3758 contains33 actual whole-file logs:28 migrated files first pass294/294 plus the five required repeat files77/77=371/371,0fail/cancel/skip. Raw count audit independently agrees; both tracker-levels and all five repeated file receipts present. Source audit/retained-daemons/targets/typecheck included. Guard description reports load<10, local:none and only authorized T-488 overlap; primary Coordinator62fc0ad6/90c80d3e explicitly grants slotB with that precise exception. Raw proof driver enforces those conditions; no separate independent per-start admission log is claimed where only summary is supplied.
Primary Coordinator467e817e corrects the brief: unchanged names are known to the load gate, no manifest change or special5/5 policy; one pass each plus two for tracker-levels/subscriptions/artifacts/tracker/visibility, then droplet verify. This exact local sequence is complete. Typecheck output includes hub+Neovim commands and is reported green; whitespace independently clean.
C2 is not established by source call counts. Primary be0d4ab9 authorizes exactly one post-source-clear Mac spawn-census run through existing recorder/npm all/ordinary machine locks, at local:none/load<10 with Agents started/done notices. It is the measurement only; droplet verification remains the gate. Require aggregate/count attribution to actual full corpus and completion/phase evidence. A-2804 is a lower-bound projection with no completed aggregate, and historical A-2737 baseline exited before Neovim; absent a valid comparable before aggregate, report the new absolute count honestly. Do not infer under600 from number of replaced fixture calls.

Source verdict clear; verify C1 only. C2 final pending measured full Mac daemon starts<600 and exact-head fresh diff-selected Linux verification. No per-item QA; later E-387 two-platform stage covers remain separate. New head movement requires delta review; follow only Coordinator-posted picks after this first pass. Existing proposed migration-boundary rule is already acknowledged for the human batch.
No Reviewer tests, compiler/binary execution, edits, signals, installs, commits, merges, provider actions or subagents. Totals Standards0,Spec0 findings.

Artifact A-3759 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3759-t-466-source-clear-28-fixture-migrations-preserve-lifecycle-and-assertions.md

Criteria: C1 verified.
