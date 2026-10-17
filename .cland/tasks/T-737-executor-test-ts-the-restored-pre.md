---
id: T-737
kind: task
title: "executor.test.ts: the restored pre-executor job case reads job.pid before the launched worker reports it (load)"
state: open
status: ready
size: S
criterion_seq: 1
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-440
branch: t/T-737-executor-test-ts-the-restored-pre
created: 2026-10-17T14:18:58.698Z
updated: 2026-10-17T14:25:52.027Z
---

## Summary

`hub/test/executor.test.ts::a pre-executor running job restored from hub.db reports as local exactly once` failed in integrated cover 3fed9129 (A-4528) and earlier on T-689's branch (A-4259, 2026-10-17 00:27Z) at `assert.ok(job.pid)`, right after `f.launch()`. It passes 10/10 alone on the Mac. Under load the launch returns before the worker's pid is recorded.

## What to build

Make the fixture's launch wait for the hub's own "running with pid" receipt (status or journal) before returning, or have the case wait for it, instead of asserting on the first launch reply. Keep every later assertion: stop, the hub.db rewrite to a pre-executor row, the restore and the single local report.

## Acceptance criteria

- [x] C1. The case passes 5/5 on the Mac and in the task's droplet verify, with no new real-time wait and its assertions unchanged.
  - done: impl-737 · 2026-10-17T14:25:28.446Z
  - verified: rev-31 [reviewer] · run rev-20261017-737-final · 2026-10-17T14:25:51.610Z · commit 76d33d442cccecec2478e1aa9648d260056dc773

## Comments

### impl-737 · 2026-10-17T14:21:32.659Z

Implemented at 76d33d442cccecec2478e1aa9648d260056dc773 and pushed to origin. The legacy restore case opts into a bounded hub.status wait for its exact run's state=running and pid before launch returns and worker ownership is registered. Every assertion retained; no new real-time wait or production change. Typecheck and test:tiers pass. executor.test.ts passed 5/5 serially on macOS: 5.724, 5.736, 5.770, 5.881, 5.878 seconds; starting one-minute loads 3.03–3.63 (<15). Droplet verification follows clear source review; C1 will be marked done after its receipt.

### rev-31 · 2026-10-17T14:22:22.534Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-737-source
commit: 76d33d442cccecec2478e1aa9648d260056dc773
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards 0 / Spec 0 findings, A-4533. Only executor.test.ts changes. Affected legacy restore case opts into bounded hub.status observation for exact run id, running state and PID before ownership/return; no fixed elapsed delay, new timing knob or allowance. Original PID/stop/DB rewrite/finish/restart/local platform/exactly-once assertions remain unchanged. Existing T3 lifecycle reason applies and is named in the case. A-4530 reports whole-file Mac 5/5, 3/3 per run, load 3.03–3.63, static checks green; raw transcripts not included in that summary. Origin tip matches requested commit. C1 execution verification remains pending exact-head droplet and supporting Mac receipt audit. No Reviewer edits/tests/delegation.

### impl-737 · 2026-10-17T14:25:29.096Z

Exact reviewed head 76d33d442cccecec2478e1aa9648d260056dc773 passed droplet verify d119d24e-8214-41db-bcbf-d5d70f2ff7e4 (A-4539): hub-selected, 37/37 pass, zero failures/cancelled/skipped/todo; linux x64, c-8 lon1, lifetime 123s, cost $0.0086, suite duration 52.67s, peak 1m load 2.63. Mac 5/5 whole-file transcripts A-4535 already audited by Reviewer. C1 marked done; head unchanged, ready for final evidence verdict.

### rev-31 · 2026-10-17T14:25:51.610Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-737-final
commit: 76d33d442cccecec2478e1aa9648d260056dc773
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; Standards 0 / Spec 0 findings, A-4540. A-4535 independently audited five complete Mac whole-file transcripts, each 3/3 with no failures/skips or asynchronous-activity diagnostics. Exact-head A-4539 / d119d24e finishes exit 0: selected hub 25/25 and Neovim smoke 12/12, total 37 passes, zero failures/skips. Affected legacy restore case runs and passes at 5.351512243 s; duration regression notice disclosed, no sub-five-second claim or C1 ceiling. Source A-4533 remains current at unchanged origin head: exact running+PID observation replaces admission timing inference, assertions preserved. C1 verified, no further run or per-item QA needed. No Reviewer edits/tests.

Criteria: C1 verified.
