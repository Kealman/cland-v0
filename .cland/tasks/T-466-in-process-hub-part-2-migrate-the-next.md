---
id: T-466
kind: task
title: "In-process hub, part 2: migrate the next files to bring daemon starts per full run under 600"
state: closed
status: done
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
updated: 2026-10-16T06:14:46.753Z
closed: 2026-10-16T06:14:46.752Z
---

## Summary

After T-393 moved its top 20 files in-process, the projected daemon starts per full run were 772 (A-2804, against A-2737's 1047). The E-387 target is under 600. A-2761 ranks the next candidates: tracker-levels 24, subscriptions 20, artifacts 18, tracker 16, visibility 15, epic-close and tracker-rank 14 each. Each needs the lifecycle audit T-393 used.

Coordinator split, 2026-10-16 06:13Z: this item moved 28 files and measured the full run at 743 starts (census A-3775). That shows the 772 projection undercounted the current corpus. Reaching under 600 moved to T-575.

## Acceptance criteria

- [x] C1. The next files move to the in-process hub with their lifecycle tests kept spawned and their assertions unchanged, with an audit posted.
  - done: impl-466 · 2026-10-16T05:43:45.284Z
  - verified: rev-30 [reviewer] · run rev-20261016-466-source · 2026-10-16T05:47:05.301Z · commit 88a3630e8d0a8dc012d43935e04befa23cbd1120
  - verified: rev-30 [reviewer] · run rev-20261016-466-final · 2026-10-16T06:14:24.709Z · commit 88a3630e8d0a8dc012d43935e04befa23cbd1120
- [x] C2. A full-run census at the reviewed head is recorded with its per-file table, and the migrated files' own starts are reported (historical 310 → current 84); the under-600 target is carried by T-575.
  - done: impl-466 · 2026-10-16T06:13:34.917Z
  - verified: rev-30 [reviewer] · run rev-20261016-466-final · 2026-10-16T06:14:24.709Z · commit 88a3630e8d0a8dc012d43935e04befa23cbd1120

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

### impl-466 · 2026-10-16T06:12:19.672Z

Completed full Mac census at source-reviewed88a3630e, exit0:2301/2301 ordinary-phase tests plus all discovered task load-gate repetitions green. A-3775 contains original log/aggregate/report, raw records, historical selected comparison and remaining-file ranking.742 canonical-helper starts;743 observed including a copied coverage fixture. Original C2 under600 is NOT met.156 potential recorder gap files and4186 originating launches marked with a gap mean no exhaustive descendant count. The28 migrated files compare historical310→current84 (−226), with different-head/corpus and incomplete historical-baseline limitations; no matched full-run reduction or speed claim. Fresh Linux A-3762 is325/325 at the same head; Reviewer accepted source/gate. Coordinator9afae72c instructs no branch extension and will confirm amended criterion/follow-up after final count. C2 remains unmarked; no source changes.

### impl-466 · 2026-10-16T06:13:35.487Z

Amended C2 done per Coordinator a1da848d: A-3775 records the completed full Mac census at unchanged reviewed88a3630e, canonical742 + copied fixture1 =743 observed starts, full per-file table, current migrated84 versus historical310 with corpus qualifications, original aggregate/log/report and durable raw records.2301/2301 ordinary phases and all task load-gate repetitions passed; no full-head paired reduction/exhaustive descendant/speed claim. Under600 now belongs to T-575, E-387 stage4. A-3762 is the fresh same-head Linux gate325/325; Reviewer A-3772/publication audit independently reproduce counts. Requesting final evidence verdict; no source changes or new runs.

### rev-30 · 2026-10-16T06:14:24.709Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-466-final
commit: 88a3630e8d0a8dc012d43935e04befa23cbd1120
scope: evidence

# T-466 final evidence review clear

Head `88a3630e8d0a8dc012d43935e04befa23cbd1120`; branch `t/T-466-in-process-hub-part-2-migrate-the-next`. Local and pushed origin heads agree. No source/head changes since source clearance A-3759 / rev-20261016-466-source. Evidence-only settlement; direct read-only audit, no Reviewer execution or mutation of source.

## Standards

Source clearance stands: 28 test-file fixture migrations, unchanged assertions/names and preserved spawned lifecycle cases. No production, harness, package, manifest or Neovim edits. A-3758's 33 whole-file targeted receipts total 371/371. No new high, medium or low findings (0/0/0).

## Spec

Both current criteria verified. C1 carries the reviewed lifecycle/assertion audit at this exact head.

C2 was explicitly amended by Coordinator a1da848d-d2eb-4826-baec-203569600fb4 after the completed measurement: record the reviewed-head full census/per-file table and historical migrated-file comparison, with the under-600 target carried by T-575. task.view confirms that exact criterion, claimant done marks, current claim and source verification. T-575 exists under E-387 with its own under-600 census criterion. This is acceptance of the amended scope, not a claim that the original threshold passed.

A-3775 provides the completed clean-head Mac census, original aggregate/log/report, durable raw recorder records, full per-file table, remaining ranking and historical comparison. I independently reproduced all per-file counts from both original and durable records (zero malformed JSONL), and verified aggregate/log/count JSON copies byte-identical. Exact canonical helper records total **742**, plus **one copied coverage-fixture start**, giving **743 observed**. Migrated 28-file comparison sums to historical **310**, current **84**, difference **−226**.

The comparison is historical across different heads/corpora; the older A-2737 run stopped before Neovim and A-2804's 772 was a projection. It is not a controlled matched full-run reduction or speed claim. The current task workload includes extra load repetitions. Recorder reports **156 potential gap files / 4186 gap-marked originating launches**; no exhaustive descendant-process count is claimed. These qualifications are preserved in A-3775 and audit A-3772.

## Runtime gate

Fresh exact-head actual Linux droplet run **6e81ca60-fd63-4350-aa11-80c73739325a / A-3762** exits 0: **325/325**, no failures/skips, all 28 changed whole files plus Neovim smoke. A-3763 previously audited the raw receipts. This remains the verification gate.

The separately authorized full Mac census exits 0: hub free 38/38, hub machine 1870/1870, full Neovim 393/393 = **2301/2301**, zero failures/skips/cancellations; task load repetitions green. Suite 1267.06 s, wall including queue 1267.42 s, peak one-minute load 22.65, load-gate extra wall 43.54 s. This is measurement evidence, not a replacement Linux gate or a low-load speed benchmark.

Final review clear; refresh **C1/C2** at the unchanged head. No new run is required. Under-600 work remains T-575; E-387 after-stage QA/covers remain separate. Standards findings 0; Spec findings 0.

Artifact A-3778 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3778-t-466-final-clear-amended-census-criterion-and-exact-head-linux-gate-verified.md

Criteria: C1 verified, C2 verified.

### coord · 2026-10-16T06:14:46.752Z

Merged 6c6531df6f56795e8e17b4cbf9098e1ce670d399 onto dev.
