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
updated: 2026-10-18T07:40:27.090Z
---

## Summary

On 2026-10-18 at 03:52Z, impl-723's load watchdog sent SIGTERM to two companion test files (daemon and orphan-servers) mid-run. A `hub serve` started by one of them, in a temp project (cland-proj-*), survived re-parented to launchd for about 50 minutes, until cland-impl stopped it by hand. `cland doctor --fix` didn't touch it, because its root was outside this project. The temp directory was left behind.

## What to build

A fixture-started hub dies with its test worker: a process group or a parent-death watch, or the worker's SIGTERM handler stops its fixtures before exiting. The test cleanup also removes the temp project. A sweep of fixture-root hubs can back this up.

## Acceptance criteria

- [x] C1. A T3 test SIGTERMs a test worker that holds a fixture hub, finds no surviving hub process and no temp project left within the cleanup bound, and fails before the fix.
  - verified: rev-31 [reviewer] · run rev-20261018-771-final · 2026-10-18T07:37:53.706Z · commit 004f53acdc08c32ecde71d737c3c141a6ab724c9
  - done: impl-771 · 2026-10-18T07:38:06.676Z

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

### rev-31 · 2026-10-18T07:37:53.706Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-771-final
commit: 004f53acdc08c32ecde71d737c3c141a6ab724c9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-771 final evidence review — clear

Commit:004f53acdc08c32ecde71d737c3c141a6ab724c9.
Scope:evidence. Source continuity:rev-20261018-771-source-2 /A-5042.
Read-only audit; no Reviewer execution or edits.

## Standards

No remaining findings. M1 remains resolved: original identity seeds survive forced root discovery, preserving replaced PIDs/children while recovering unrecorded hubs and dead-leader writers. Source/Mac evidence remains current: A-5040 ten whole-file receipts,145passes,0fail/skip/cancel, and both retained red proofs A-5035/A-5039. No head move since source-2.

## Spec and execution

Independently audited raw A-5070 /42bfddc8-ce56-44c5-85e5-e369984a9926 at the exact reviewed commit. Hub records passed/exit0, automatic full selection due shared process-cleanup infrastructure.

All29 owned cases execute positively: lifecycle1case in1.448120932s; process-cleanup28cases totaling3.734058486s. No owned skip. The signal-replacement control passes in0.114920639s. Both new identities also pass5/5 load repetitions,10/10. The lifecycle retains actual worker SIGTERM,exit143,fixture hub PID gone and project directory removed within its bounds; the synthetic control separately proves unrelated replacement identities survive.

Overall2530tests,2522pass,0fail/cancelled,8prerequisite skips. Raw phase summaries reconcile as free218pass, machine1913pass+5skip, Neovim391pass+3skip. Full Neovim completed153.27s; no known-failure exception is needed.

Linux x64/Node24.21.0/Neovim0.12.5,c-8 lon1,2workers; peak load8.10,lifetime1511s,cost$0.1049. Current origin branch still names the same commit. Earlier A-5048 remains a failed historical receipt (T-724 QA SIGTERM signature); matched Mac controls A-5052 and the green retry are distinct evidence, not a relabeled failed run.

## Verdict

Final review clear; verify C1. The original red and current Mac/Linux proofs establish the criterion. Claimant may refresh C1 done using this green receipt; no further task run or per-item QA requested.
Standards:0 findings. Spec:0 remaining gaps.

Durable review:A-5071.

Criteria: C1 verified.

### impl-771 · 2026-10-18T07:39:45.050Z

Coordinator-authorized one origin/dev merge (b27f71f4) completed as 7eb2137e, then lint header correction/shrink committed and pushed as 5601d0cf. First comment now uses exact T3: declaration. npm run test:lint passed before npm run test:lint -- --shrink; shrink passed and only serialized an empty baseline entry for the new file (no allowance). Typecheck/test:tiers pass. Both owned test files 5/5 serial at start load 3.63–3.95; raw logs A-5072. Delta review and a fresh exact-head droplet run now required; prior green at 004f53ac remains historical.

### rev-31 · 2026-10-18T07:40:27.090Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-771-integration-delta
commit: 5601d0cf989c1dbb04bf8e825599b4eac34cd87b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-771 authorized integration delta — clear

Commit:5601d0cf989c1dbb04bf8e825599b4eac34cd87b.
Scope:delta. Prior source/final:004f53ac, A-5042/A-5071.
Read-only; no Reviewer execution or edits.

Independently read Coordinator97a28e33-7523-46a0-91a2-79c6ef9573c6: trial merge was refused by the newly live T-684 lifecycle-header gate; one fetched dev merge, exact header correction, lint/shrink, two-file5/5, delta review and fresh droplet were required.

Merge7eb2137e has parents004f53ac andb27f71f4, with the approved T-684/T-767 integration inherited. No conflict or manual production resolution. Task process-cleanup.ts and process-cleanup.test.ts are byte-identical to the accepted head. The lifecycle test changes only its first comment to the exact T3: lifecycle form. Against the merged dev baseline, lint-baseline.json only adds its empty file entry; no policy suppression, allowance or count increase.

A-5072 raw refreshed transcript independently audited: both complete files5/5,145passes,0failures/skips/cancellations/todo, no late asynchronous diagnostics. Admitted load3.63427734375–3.95263671875. Existing red proofs and ownership/assertion analysis remain applicable. Typecheck, tiers and live lint/shrink are reported passed.

Standards:0 findings. Spec:C1 source design remains established, while its prior execution mark at004f53ac is historical for the new merged head. Source delta clear; leave C1 final verification pending the required ordinary mode-free fresh droplet result. A-5070 remains valid prior-head evidence, not a new-head full-green claim. No extra Mac run or per-item QA requested.

Durable review:A-5073.
