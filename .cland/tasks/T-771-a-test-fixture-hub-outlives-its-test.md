---
id: T-771
kind: task
title: A test-fixture hub outlives its test worker when the worker is SIGTERMed mid-file
state: open
status: review
size: S
criterion_seq: 1
labels:
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-484
branch: t/T-771-a-test-fixture-hub-outlives-its-test
created: 2026-10-18T04:44:16.774Z
updated: 2026-10-18T06:36:43.392Z
---

## Summary

On 2026-10-18 at 03:52Z, impl-723's load watchdog sent SIGTERM to two companion test files (daemon and orphan-servers) mid-run. A `hub serve` started by one of them, in a temp project (cland-proj-*), survived re-parented to launchd for about 50 minutes, until cland-impl stopped it by hand. `cland doctor --fix` didn't touch it, because its root was outside this project. The temp directory was left behind.

## What to build

A fixture-started hub dies with its test worker: a process group or a parent-death watch, or the worker's SIGTERM handler stops its fixtures before exiting. The test cleanup also removes the temp project. A sweep of fixture-root hubs can back this up.

## Acceptance criteria

- [ ] C1. A T3 test SIGTERMs a test worker that holds a fixture hub, finds no surviving hub process and no temp project left within the cleanup bound, and fails before the fix.
  - failed: rev-31 [reviewer] · 2026-10-18T06:34:27.358Z · note Seedless root recovery can re-authorize a replaced registered PID and its children; carry original identities through discovered signal cleanup and prove preservation.

## Comments

### impl-771 · 2026-10-18T06:31:02.131Z

C1 reproduced red: a raw fixture hub publishes discovery before any CLI/readDiscovery receipt registers its PID; SIGTERM exits the worker but leaves that hub alive. Added interruption-only recovery through cleanupProcesses on inode-verified fixture roots. All fixture writers are stopped before any directory is removed. Regression uses one worker and one fixture-only detached hub; parent cleanup recovers red-run/startup failures.

### rev-31 · 2026-10-18T06:34:27.358Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-771-source-1
commit: 4dad61eb3d1405fff0010486122b02f1686ce6d7
scope: full
findings: [{"severity":"medium","text":"M1: cleanupProcesses(dir) drops original seeds, so the root sweep can signal replacement PIDs/children preserved by the first identity-checked cleanup pass.","file":"hub/test/process-cleanup.ts","line":411}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-771 source review — not clear

Commit:4dad61eb3d1405fff0010486122b02f1686ce6d7.
Fixed point:222e880b5f9fb5873a20f0a6488dac30cc3bdc45.
Scope:full; read-only review, no Reviewer execution.

## Standards

M1 medium — hub/test/process-cleanup.ts:411. The signal handler first calls cleanupOwnedProcesses with captured identities, then invokes cleanupProcesses(dir) without those seeds. The discovered-cleanup replacement guard at lines217–223 only protects registered replacement PIDs and descendants when supplied their original identities. The new seedless root pass can select a replacement inside the fixture root after the first pass correctly preserved it. Existing process-cleanup tests explicitly establish that even fixture-contained replacement children must remain unsignalled.

Carry the original captured identities through forced discovered root cleanup, retaining dead-leader/unrecorded recovery, and add a synthetic signal-path control proving both properties together: replaced seed/children stay unsignalled and the unrecorded owned hub is reaped. Implementer confirms this gap (3494fe0b) and will request a corrected-head review.

No other source finding identified. Inode-checked roots and two separate stop-all-writers/remove-all-directories loops otherwise preserve the required removal ordering. The new T3 header correctly justifies one worker and one detached fixture hub. Parent ownership covers red-run recovery; readiness precedes SIGTERM, worker exit143 is separately bounded, and final OS PID/directory assertions remain.

## Spec and evidence

The regression exercises the requested missed-registration boundary: it reads discovery directly without recording a PID in the worker, then SIGTERMs that worker. Normal completed CLI/PID-registration teardown alone would not reproduce the bug. A-5025 documents the deterministic red before root recovery and initial five-pass summaries for lifecycle and process-cleanup. Raw transcripts A-5031/A-5032 and captured red tool output are being supplied; they have not yet been independently audited.

C1 remains incomplete because the new cleanup pass must preserve process identity protections. Correct source first, then fresh source review before exact-head task verification. No per-item QA.
Standards:1 medium finding. Spec:positive recovery path present; ownership safety correction and final execution evidence pending.

Durable review:A-5036.

Criteria: C1 failed (Seedless root recovery can re-authorize a replaced registered PID and its children; carry original identities through discovered signal cleanup and prove preservation.).

### impl-771 · 2026-10-18T06:35:57.665Z

Addressed source review M1 in 004f53ac: original identity seeds now persist across forced discovered signal-root cleanup. Added a combined signal-path control proving replacements/descendants remain unsignalled while the unrecorded hub and dead-leader child are reaped. The control fails red against 4dad61eb (A-5039). Corrected-source typecheck, tier lint and test lint pass; both test files passed five serial runs at load 3.45–5.22 (raw logs and receipts A-5040). C1 original red output A-5035. No dev merge after first source review, per rule 11.

### rev-31 · 2026-10-18T06:36:43.392Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-771-source-2
commit: 004f53acdc08c32ecde71d737c3c141a6ab724c9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-771 corrected source review — clear

Commit:004f53acdc08c32ecde71d737c3c141a6ab724c9.
Scope:full source continuation. Fixed original base222e880b; prior review A-5036.
Read-only, no Reviewer execution or edits.

## Standards

M1 resolved. The signal handler captures its original identity seeds once, uses them for recorded cleanup and retains them through forced discovered cleanup for each inode-verified root. Forced discovery preserves dead-leader/unrecorded recovery rather than short-circuiting to the targeted-only path. Replacement PIDs and their descendants remain protected by the shared discovered-cleanup guard.

The new synthetic signal-path control invokes the real SIGTERM handler in an isolated probe. It retains a replaced registered PID and child inside the fixture root, reaps an unrecorded hub plus a dead-leader child, and observes exit143 and root removal. It asserts the exact two permitted signal operations and surviving replacement identities. A-5039's raw red shows the prior seedless pass removed both protected replacements; the current control passes.

The original T3 lifecycle regression is unchanged: one owned worker launches an unrecorded detached fixture hub, publishes discovery before SIGTERM, and the parent separately bounds worker exit and PID/root absence. Parent recovery owns failed-start/red-run fixtures. Signal cleanup stops writers across all registered roots before its separate directory-removal pass. Existing ancestor/group/PID guards and native positive defaults remain in the shared helper. No unrelated merge, allowance or tier change beyond the new lifecycle entry.

## Spec and evidence

C1 source design and red/green Mac proof are established. A-5035 explicitly labels the original red as captured terminal output rather than an original standalone log: worker SIGTERM left the hub/root condition unsatisfied after the1s observation bound, and parent teardown recovered it. A-5039 is the independent ownership-correction red.

A-5040 raw transcript independently audited: ten current-source serial whole-file invocations, lifecycle1case×5 and process-cleanup28cases×5,145 passes total, zero failures/skips/cancellations/todo and no late asynchronous diagnostics. Every combined signal control passes. Admitted loads3.453125–5.21875. Lifecycle wall1.399–2.305s; process-cleanup2.472–3.296s. Host typecheck/tiers/report-only lint are reported passed; no new policy exemption.

C1 final verification remains pending exact-head diff-selected droplet execution. No task verification has run at this corrected head. Submit ordinary mode-free verification after clear source; no manual full task run or per-item QA requested.

## Verdict

Source clear. C1 is not marked fully verified until its Linux receipt is audited. No remaining findings.
Standards:0 findings. Spec:source and Mac red/green established; Linux execution pending.

Durable review:A-5042.
