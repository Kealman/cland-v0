---
id: T-806
kind: task
title: "session-stop-races: Codex post-merge forced stop waits 15 s for the descendant identity probe file under macOS load"
state: open
status: ready
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-519
branch: t/T-806-session-stop-races-codex-post-merge
created: 2026-10-18T14:13:11.905Z
updated: 2026-10-18T17:13:39.681Z
---

## Summary

hub/test/session-stop-races.test.ts:91, "Codex: post-merge forced stop succeeds when a captured descendant exits before its final identity probe", failed in E-678's second macOS stage run b73dd6cd (A-5340, 3 workers, peak load 15.4): `descendant identity probe written: not within 15000 ms` (ENOENT on probe.json). The file took 37.8 s against a 17.5 s baseline. It's a wall-clock `eventually` on a file written by a spawned descendant.

## Acceptance criteria

- [x] C1. The test waits on an observed event (the probe write or the descendant's exit), or on a FakeClock step, instead of a 15 s wall-clock deadline, keeping every assertion. It passes 20/20 with the machine phase at 4 workers on macOS.
  - done: impl-806 · 2026-10-18T16:32:08.705Z
  - verified: rev-31 [reviewer] · run rev-20261018-806-final · 2026-10-18T17:13:39.256Z · commit e24cb23d97ee644f2b1610de0b182215d2b0442a

## Comments

### impl-806 · 2026-10-18T16:22:56.230Z

Reproduced the exact 15s probe.json ENOENT timeout using a temporary 16s publication delay (A-5417). Testing an observer armed before stop plus atomic probe publication, retaining the existing T3 lifecycle seam and every assertion.

### rev-31 · 2026-10-18T16:33:21.877Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-806-source
commit: e24cb23d97ee644f2b1610de0b182215d2b0442a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-806 source review

Head: e24cb23d97ee644f2b1610de0b182215d2b0442a
Fixed base: d9d8e40944af9200a7c9c2e3b7070f87f809bfa8
Scope: full; one changed file, hub/test/session-stop-races.test.ts.

Standards: clear. The existing T3 OS-identity/process lifecycle seam remains. The watcher is armed before the operation and owned through t.signal plus onCleanup before directory disposal. Atomic rename publishes complete JSON. Promise.all observes both the stop response and publication before reading/asserting the receipt. The configured package per-test timeout bounds the event wait; no replacement fixed sleep or new process is introduced. Existing PID-reaping bounded conditions and final assertions remain.

Spec: clear. The 15-second probe polling deadline is removed for both manual and post-merge variants. All original assertion lines are identical and remain in order. No production source or duration allowance changes. A-5434's raw red receipt reproduces the original ENOENT/not within 15000 ms; all 20 raw delayed-publication receipts positively pass the selected post-merge case with zero fail/cancel/skip. Temporary planted instrumentation is absent from the committed source. The final uninstrumented whole-file log positively passes all six cases, including the post-merge probe at 4.486737 s.

Coordinator decision bce312e2-5d0d-460d-b29a-b2b398dddae7 was independently read: it accepts the deterministic 20/20 serial 16-second publication delay as local C1 proof and assigns four-worker macOS machine-phase coverage to the next Coordinator stage run. This review does not claim a local four-worker machine phase ran.

Findings: none. C1 combines source and execution evidence and remains unverified until the post-source exact-head task run. Source clearance does not lift the Coordinator's T-813 verification hold. When the all-clear arrives, one mode-free droplet verification may run at this preserved head. No per-item QA is required.

Evidence: A-5436; implementer raw receipts A-5434.

### rev-31 · 2026-10-18T17:13:39.256Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-806-final
commit: e24cb23d97ee644f2b1610de0b182215d2b0442a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-806 final evidence review

Head: e24cb23d97ee644f2b1610de0b182215d2b0442a; matches source verdict rev-20261018-806-source and pushed branch tip.
Scope: evidence. Run 5a24f49c-5a59-4e23-8f08-306efc5fe401 / A-5476, exit 0.

All six owned lifecycle cases positively pass, including Codex manual descendant probe 1.973628 s and post-merge descendant probe 2.290312 s. The file has no quarantine entries, owned runtime tier trips or owned failed budget lines. These are existing identities; no new-identity load-gate receipt is claimed. The prior audited A-5434 supplies 20/20 raw macOS delayed-publication proofs with the same 16-second delay that reproduced the old deadline failure. Coordinator bce312e2 explicitly accepted that deterministic local evidence and assigned four-worker macOS machine coverage to the next stage run; this review does not claim that stage coverage already happened.

Full Linux run completed: 2631 ordinary tests,2623 pass,0 fail,0 cancelled,8 skips. Phase rollups: hub free284/284; hub machine1967 pass+5 skips; Neovim372 pass+3 skips,165.53s. All three failure arrays are empty. Skips concern macOS sandbox/inhibitor availability and absent OpenCode; none is owned. Automatic selection fell back to full because fetch/diff was unavailable, so reduced selection is not claimed. Four inherited report-only tier trips outside the one-file diff remain separate debt; no global-zero claim.

Linux x64 c-8 lon1, workers2, Node24.21.0/Neovim0.12.5; lifetime1475s,cost$0.1024,peak load7.08. Findings:none. C1 verified under the Coordinator disposition and source+same-head execution evidence. No further task run or per-item QA required.

Review evidence: A-5478.

Criteria: C1 verified.
