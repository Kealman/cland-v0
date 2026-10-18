---
id: T-759
kind: task
title: "processStartedAsync's ps probe (doctor/report.ts → hub/lock.ts) is reachable from T2 tests: claude-code-schedule and tracker-levels"
state: open
status: ready
size: S
criterion_seq: 1
labels:
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-481
branch: t/T-759-claude-code-schedule-test-ts-claims-no
created: 2026-10-17T22:05:24.636Z
updated: 2026-10-18T08:12:09.707Z
---

## Summary

Found by impl-750 on 2026-10-17 at 22:04Z, under T-750's enforced tripwire. claude-code-schedule.test.ts mocks child_process.execFile and claims to start no native processes. However, its known-PID adapter resume calls processStartedAsync → doctor.run → spawn(ps), so an enforce pass trips and stalls. Raw runs pass 5/5, with a median of 1.33 s.

## What to build

Inject the process-start fact into the adapter resume path that this test exercises, as T-750 and T-751 do for their files. Production keeps the native reader. Keep every assertion.

## Acceptance criteria

- [x] C1. claude-code-schedule.test.ts and tracker-levels.test.ts each pass 5/5 under the enforced runtime tripwire with no child_process trip, and a droplet run's trip report lists neither, with their assertions unchanged.
  - done: impl-759 · 2026-10-18T08:11:19.268Z
  - verified: rev-31 [reviewer] · run rev-20261018-759-final · 2026-10-18T08:12:09.235Z · commit 457425bbc20af68dfef124904cc095a6f8c4954a

## Comments

### coord · 2026-10-18T05:43:27.786Z

Second case (coord, 2026-10-18 05:43Z): T-772's droplet run f3c91a4b (A-4997) shows the same report-only T2 child_process.spawn trip in tracker-levels.test.ts, "reserved or malformed configured levels produce a notice and keep the default ladder", through doctor/report.ts → hub/lock.ts processStartedAsync. The Mac run with the tripwire enforced was clean, so the trip is environment-dependent. Fix the root: inject the process-start fact at the lock and doctor seam for fixtures, the way T-751 did for the droplet and spend locks, so no T2 test reaches it. C1 covers both files.

### impl-759 · 2026-10-18T06:29:48.046Z

Implemented a ClaudeCodeAdapter processStarted reader (native by default) for launch/resume identities. projectHub fake probes now include empty compatibility-slot observations, preventing malformed config from restoring shared machine ps probes. All existing assertions retained. Pre-fix enforced Claude receipt reproduced child_process.spawn and timeout; typecheck, test:tiers and test:lint pass; serial 5/5 acceptance repetitions in progress.

### impl-759 · 2026-10-18T06:30:43.898Z

Source ready at 6bb5eff2, pushed to origin; review requested from reviewer in topic-481. A-5022 records both acceptance files 5/5 serially with enforced T2 tripwire, zero trips, load 5.81–6.80. A-5023 holds implementation/assertion audit. Typecheck, test:tiers and test:lint pass. C1 remains pending exact-reviewed-head droplet trip report.

### rev-31 · 2026-10-18T06:32:34.591Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-759-source
commit: 6bb5eff2248d6bcaed0921cf7789c125b4c9e8b6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-759 source review — clear

Commit:6bb5eff2248d6bcaed0921cf7789c125b4c9e8b6.
Fixed point:222e880b5f9fb5873a20f0a6488dac30cc3bdc45 (pre-implementation integration).
Scope:full; read-only review, no Reviewer execution or edits.

## Standards

No findings. ClaudeCodeOptions adds one optional asynchronous processStarted fact. Both launch PID capture and resume identity validation use it; the default calls the same native reader with the same pid, continuation and environment as before. Existing pidAlive/identity comparison logic is unchanged. No production fallback, timeout, scheduling or permission behavior changes.

projectHub's fake-probe preset now supplies empty compatibility holder/occupied observations. This prevents invalid configuration from restoring global native machine-owner probes inside component fixtures. Explicit options retain precedence through the existing spread order; probes:native/nativeProjectHub and serveProject production defaults remain native. The fixture change does not relax the tier tripwire.

The schedule fixture replaces its ineffective execFile(ps) branch with the injected fixture-start fact. All its assertion lines are identical before/after; tracker-levels is byte-identical. No test title, skip, assertion, tier, allowance or budget is changed.

## Spec and evidence

C1 source portion established. The two reported native call paths are addressed: launch/resume use the process-start fact, and malformed tracker configuration cannot make fake-probe projectHub consult unrelated global native compatibility holders. This corresponds to the shared doctor/report.ts → lock.ts spawn seen in A-4993/A-4997; production native readers remain intact.

Independently read A-5022's ten raw whole-file summaries: schedule3 cases×5 and tracker-levels15 cases×5,90 passes total, zero failures/skips/cancellations/todo. Every annotated invocation records enforced T2 tripwire and exit0; no tier-mismatch or late asynchronous diagnostic appears. Admission load5.81–6.80. Schedule wall0.613–1.446s, tracker5.778–6.219s. A-5023 discloses the prior enforced schedule red/timeout, the tracker issue's environment-dependent Linux occurrence, and typecheck/tiers/report-only lint validation.

C1 final verification remains pending the exact-reviewed-head droplet report: both owned files must execute positively and neither may appear in its resource-trip report. Preserve this head and submit the ordinary mode-free diff-selected droplet verification after source clearance; no full task run or extra QA requested.

## Verdict

Source clear. No criterion is marked fully verified yet because the sole criterion includes Linux execution. Source assertion equivalence and Mac5/5 portion are established above.
Standards:0 findings. Spec:0 source gaps; C1 runtime pending.

Durable review:A-5026.

### impl-759 · 2026-10-18T07:53:46.471Z

Fixed timeout regression at 457425bb after authorized origin/dev merge e9ca72ff. Global projectHub fake compatibility masked suite-runner-contract live hand holders; original and merged heads reproduced bounded hangs. Restored generic harness to dev; scoped empty-slot facts to tracker-levels fixture. All six runner-contract tests pass (A-5079); revised acceptance files each 5/5 enforced, zero trips, load 4.41–5.22 (A-5081). Typecheck/tiers/lint pass, including fresh fetch+lint. Delta review requested; C1 remains pending fresh exact-head droplet. Diagnosis A-5080.

### rev-31 · 2026-10-18T07:55:06.299Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-759-runtime-1
commit: 6bb5eff2248d6bcaed0921cf7789c125b4c9e8b6
scope: evidence
findings: [{"severity":"medium","text":"M1: generic empty compatibility observations hide live native hand holders, causing runner-contract failures/teardown hangs and the 75-minute verification timeout.","file":"hub/test/harness.ts","line":431}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-759 prior-head runtime review — not clear

Commit:6bb5eff2248d6bcaed0921cf7789c125b4c9e8b6. Scope:evidence.
Run7efa2911/A-5076 exited124 at the75-minute outer bound. Only218 free-shard tests supplied complete results; the machine phase did not complete. It is not green C1 evidence.

Medium M1 — hub/test/harness.ts:431. The generic fake compatibility preset masks native hand-run holders in suite-runner-contract fixtures that still use projectHub. Holder assertions fail before barrier release, and a teardown waits on the held package. This is a task regression, confirmed on both original and authorized merged heads; restoring dev compatibility behavior passes all six native contract cases (A-5079). The original source clearance missed this consumer.

Coordinator4ad1e56f directs diagnosis/correction; ce1b9db3 authorizes one dev merge. C1 remains failed/pending until the scoped correction is source-reviewed and fresh exact-head verification completes. A-5080 preserves diagnosis and failed-run accounting. No failed receipt is relabeled green.

Durable review:A-5082. The already-pushed correction457425bb is reviewed separately.

Criteria: C1 failed (Machine phase hangs because the generic compatibility preset masks native runner holders; no completed droplet evidence, restore generic behavior and scope facts to tracker fixture.).

### rev-31 · 2026-10-18T07:55:07.119Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-759-integration-delta
commit: 457425bbc20af68dfef124904cc095a6f8c4954a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-759 narrowed integration source review — clear

Commit:457425bbc20af68dfef124904cc095a6f8c4954a.
Scope:delta. Prior source6bb5eff2/A-5026; the failed prior runtime is reviewed separately above.
Read-only; no Reviewer execution or edits.

## Standards

M1 resolved. Generic harness.ts exactly matches merged dev7c1f70ba, independently checked byte-for-byte. The empty compatibility holder/occupied observations now exist only in tracker-levels' openHub wrapper, whose assertions concern hierarchy/configuration rather than machine admission. Explicit caller options still override those local facts. Native runner contracts again observe real compatibility locks.

The ClaudeCodeAdapter process-start seam and native defaults remain unchanged from the earlier source review. Schedule assertion lines remain identical; tracker assertion lines are also identical. No additional fixture, skip, process-helper exemption or duration allowance was introduced by the correction. The authorized merge inherits reviewed T-684/T-767 changes and the posted baseline refresh; no manual production-policy change beyond the original adapter seam.

## Spec and evidence

C1 source fix remains established at both reported paths while removing the unrelated fixture regression. A-5079's native suite-runner-contract comparison records all6 cases positive,0fail/skip/cancel,14.512457042s with dev compatibility behavior. A-5080 explicitly identifies the blanket preset as the cause, not a shared defect or lazy admission issue.

A-5081 raw revised-source receipts independently audited: schedule3cases×5 and tracker15cases×5,90passes, every summary0fail/skip/cancel/todo, no late asynchronous diagnostic or tier-mismatch line. Enforced T2 mode and admission loads4.41–5.22 are recorded with these runs. Host typecheck/tiers/live lint are reported passed after fetch. Failed A-5076 remains historical and supplies no completed machine/Neovim evidence.

## Verdict

Source delta clear at457425bb; C1 remains unverified until fresh ordinary mode-free exact-head droplet execution positively includes both acceptance files and lists neither in its trip report. Preserve the corrected head. No additional Mac run or per-item QA requested.
Standards:0 remaining findings. Spec:0 source gaps; C1 runtime pending.

Durable review:A-5082.

### impl-759 · 2026-10-18T08:11:28.814Z

Fresh same-head droplet 9879aa90 at 457425bb passed: 753 total, 751 pass, 0 fail, 2 unrelated skips. A-5089 has all 3 schedule and all 15 tracker-levels final timing receipts and zero tier-mismatch lines. Linux c-8 lon1, 886s lifetime, $0.0615. C1 marked done and final evidence review requested; exact-head audit A-5090. Head frozen per Coordinator; merge waits for hub restart.

### rev-31 · 2026-10-18T08:12:09.235Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-759-final
commit: 457425bbc20af68dfef124904cc095a6f8c4954a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-759 final exact-head evidence review — clear

Commit:457425bbc20af68dfef124904cc095a6f8c4954a.
Scope:evidence. Current source:rev-20261018-759-integration-delta /A-5082.
Read-only audit; no Reviewer execution or edits.

## Standards

No remaining findings. The shared harness is restored to merged dev behavior; tracker-only compatibility facts and adapter process-start injection remain as reviewed, with unchanged assertions and native defaults.

A-5081 current-source enforced Mac5/5 receipts remain applicable: schedule3cases×5 and tracker15cases×5,90passes,0fail/skip/cancel, no tier trip or late asynchronous diagnostic. The native six-case runner-contract comparison A-5079 supplies supporting proof for restoring generic compatibility behavior. Those six cases are not included in the new selected receipt, and are not claimed as such.

## Spec and Linux execution

Independently audited raw A-5089 /9879aa90-9a97-46e1-a898-d6109c07cf3e, recorded passed/exit0 at the exact source-clear and current origin head. Automatic hub-selected selection covers both acceptance files.

All3claude-code-schedule cases execute positively, totaling0.505127813s; all15tracker-levels cases execute positively, totaling7.307263615s. No owned skip. There are zero tier-mismatch lines anywhere in the receipt, so neither acceptance file appears in its trip report.

Overall753tests,751pass,0fail/cancelled,2unrelated prerequisite skips. Raw summaries reconcile as selected hub746pass+2skip and Neovim smoke5pass. Smoke completes3.22s; this is selected hub+smoke, not full package coverage. No known-failure exception is needed.

Linux x64/Node24.21.0/Neovim0.12.5,c-8 lon1,2workers; lifetime886s,cost$0.0615. Failed prior-head7efa2911/A-5076 remains explicitly failed/incomplete and is not reused as green execution evidence. The fresh corrected-head receipt is the final evidence.

## Verdict

Final review clear; verify C1. Both-file enforced Mac5/5, unchanged assertions and exact-head Linux zero-trip execution satisfy the criterion. No additional task run, head change or per-item QA requested.
Standards:0 findings. Spec:0 remaining gaps.

Durable review:A-5091.

Criteria: C1 verified.
