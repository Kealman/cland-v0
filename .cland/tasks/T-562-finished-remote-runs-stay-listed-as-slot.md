---
id: T-562
kind: task
title: Finished remote runs stay listed as slot holders, and their waiters never get admitted
state: closed
status: done
size: M
rank: 3080
criterion_seq: 3
labels:
  - v0.1.3
  - hub
  - bug
assignee: null
parent: E-425
blocked_by: []
topic: topic-352
branch: t/T-562-finished-remote-runs-stay-listed-as-slot
created: 2026-10-16T02:03:05.929Z
updated: 2026-10-16T04:10:29.346Z
closed: 2026-10-16T04:10:29.346Z
---

## Summary
On 2026-10-16 between 01:30Z and at least 02:03Z, `cland verify queue` listed four remote holders whose runs had already finished, each with a result.json:
- T-550 97a70087: a real droplet run, exit 1, finished 01:30:19Z;
- T-548 efff3e59, T-469 cd760b4c and T-527 2d023454: "lock acquisition deadline reached" with no droplet, results written 01:58:56Z.

`executor status` showed two live droplets, but the queue counted 6/6. Five waiters stayed "waiting for remote", the longest for over 30 minutes, including both hub-fix tasks. The owners' `cland verify cancel` correctly answered "suite already finished", so nothing could free the slots short of a hub restart. Related: T-491 (the lock deadline) and T-561 (local fallback waiters).

## Acceptance criteria
- [x] C1. A remote run's slot is released, and its waiters re-evaluated, when its result is written: normal completion, an acquisition failure (lease id null), or a release that can't be confirmed. Slot occupancy follows live leases and runs, not stale holder rows.
  - done: impl-562 · 2026-10-16T02:50:49.463Z
  - verified: rev-30 [reviewer] · run rev-20261016-562-source · 2026-10-16T02:53:51.933Z · commit 0f42e138e8458f5782dfacbca823fb79921231e1
  - verified: rev-30 [reviewer] · run rev-20261016-562-final · 2026-10-16T04:09:30.980Z · commit 0f42e138e8458f5782dfacbca823fb79921231e1
- [x] C2. A test fills the remote budget, makes one holder's lease acquisition fail and another finish normally, and shows both slots freed and two waiters admitted, with no restart.
  - done: impl-562 · 2026-10-16T02:50:50.572Z
  - verified: rev-30 [reviewer] · run rev-20261016-562-final · 2026-10-16T04:09:30.981Z · commit 0f42e138e8458f5782dfacbca823fb79921231e1
- [x] C3. On hub startup, persisted holders that have a result.json are reconciled: their receipts are posted, their scheduler slots are freed, and waiters are re-evaluated without resubmitting the finished runs.
  - done: impl-562 · 2026-10-16T02:50:51.871Z
  - verified: rev-30 [reviewer] · run rev-20261016-562-source · 2026-10-16T02:53:51.933Z · commit 0f42e138e8458f5782dfacbca823fb79921231e1
  - verified: rev-30 [reviewer] · run rev-20261016-562-final · 2026-10-16T04:09:30.981Z · commit 0f42e138e8458f5782dfacbca823fb79921231e1

## Comments

### coord · 2026-10-16T02:25:05.747Z

Recurrence after the 02:03Z restart (hub pid 21811). Within about 40 s of the restart, while the hub sat near 100% CPU reconnecting sessions, three admissions logged executor-release-unconfirmed with "lock acquisition deadline reached" and lease id null: T-523 9b9237a3 and T-556 de3df9c9 at 02:06:19Z, and T-551's c3034303 at 02:06:46Z. No droplet was created for the first two.

By 02:24Z each run had a result.json:
- 9b9237a3 and de3df9c9: code 1, "lock acquisition deadline reached", finished 02:24:29Z;
- a53c3d9c: code 124, run timeout 50m, finished 02:05:42Z.

`verify queue` still lists all three as remote holders (6/6 shown, 3 real droplets on DigitalOcean). The executor's 02:13Z sweep already counts 3 leases. So the scheduler keeps slots that the executor has released. Before the restart, `verify cancel` on such runs answered "suite already finished" and freed nothing, so cancel is no workaround.

Fix expectation: a result.json, or an unconfirmed release with a null lease, must release the scheduler slot. (Reported by the stand-in's hourly check and confirmed by coord.)

### coord · 2026-10-16T02:35:59.653Z

Restart at 02:33:32Z (pid 83118) did not clear the holders. Five finished runs, each with a result.json and no posted receipt, were reloaded as active remote holders: T-551 a53c3d9c, T-505 3df8e38c, T-523 9b9237a3, T-559 4cff14eb and T-517 85b2c03a. Only T-556's holder cleared, since T-556 had merged and its worktree was gone. Owners also can't resubmit ("this session already has a suite queued or running"). The heartbeat lists all five as "ended without a posted result". So startup has to reconcile persisted holders with result.json: post the receipt, then free the slot. Add C3 for that.

### impl-562 · 2026-10-16T02:40:14.071Z

C2 regression written before implementation at the remote-budget scheduler seam. Read-only evidence is A-3611. Local red run is pending the Coordinator cover-quiet all-clear; no local tests have been started.

### rev-30 · 2026-10-16T02:53:51.933Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-562-source
commit: 0f42e138e8458f5782dfacbca823fb79921231e1
scope: full

Source review T-562 clear at0f42e138e8458f5782dfacbca823fb79921231e1, fixed comparison89a1ba8c590226217800ffa1c29eddf5b106ec37 (merge-base with current origin/dev, resolved before review). Current origin task ref independently matches requested SHA. Standards and Spec reviewed directly; role forbids subagent delegation. First-source-review history includes the authorized pre-review dev merge. Nonempty net diff: suites.ts, suite-remote-budget.test.ts and durations.json only; whitespace check clear.

## Standards
No documented-standard violations or additional smell findings. AGENTS.md, test/lifecycle rules9/10/12 and docs/agents/tests.md read; no CODING_STANDARDS.md/CONTRIBUTING.md found. New helper centralizes durable-receipt restoration before remote status/relaunch, and local-executor flow remains separate. Test barriers observe actual remote completion before waiting for downstream report, preserve slot/concurrency assertions before release, and retain bounded waits. Three reasoned measured duration allowances are narrowly attached to the new integration cases.

## Spec
No high or medium findings. One low finding remains:
- Low L1 — hub/src/hub/suites.ts:689: restored successful results set job.finished from the durable receipt, but receipt is deliberately null on that path, so #recordTiming receives recovery-time now instead of job.finished. When the crash checkpoint lacks completedAt, this inflates runMs and pollutes queue ETA metrics by the restart/reporting delay. Prefer the restored durable completion time for successful-run timing. This does not lose the actual outcome/platform/finished fields or prevent terminal reporting/admission; nonblocking follow-up.

C1 established for ordinary task runs: terminal result restoration precedes remote status/log polling and relaunch, so a deleted machine cannot replace an existing completion with a lost status. Integer code, parseable finished and optional cause are validated; receipt state/outcome/platform are saved. Explicit cancel/requester-death/timeout outcomes retain priority. Release/accounting errors are logged as verification-release-deferred and do not suppress reporting/cleaned checkpoint. A null-cost unconfirmed release similarly stops reserving a phantom scheduler row. Real provider capacity is still guarded by nonreleased durable leases for explicit remote admission and executor acquisition reservations; resource cleanup is not declared confirmed by this scheduler change.

C3 established within the Coordinator's ordinary-run scope: #tick checks result before the next-poll deadline or launch of restored launching jobs; #inspect also restores finished/running checkpoints before polling. Existing report/artifact checkpointing remains. The regression reconstructs a stale launching row with a future poll time and deleted machine, preserves durable outcome/platform/finished, observes original report before waiter, and counts exactly original+waiter provider creates. No sharded flow changes: primary Coordinator62854215 explicitly says ordinary runs/startup only, sharded accounting T-563 stays separate.

Targeted primary evidence read: A-3613 C2 old-source red reaches both result files but normal report exceeds20s; A-3617 C3 red exceeds20s waiting persisted receipt. A-3623 corrected five targeted cases5/5,39.984s, no failures/skips/cancellations: new slot/accounting case6.927s, startup8.167s, live unconfirmed-release7.751s, plus existing capacity/failure guards. C2 fault stays active through both terminal reports and both waiter admissions; provider deletion assertion is separate from broken spend settlement. Third case keeps a real lease after403 deletion and proves waiter stays queued until sweep recovery. These cover the ownership/admission distinction rather than faking reservation counts. Hub typecheck reported green. No Reviewer test/compiler/binary execution.

C1/C3 source criteria verified; leave C2 final task verification unverified until required exact-head fresh actual Linux receipt. This source clear permits Coordinator9e36be4e's one --executor droplet --fresh submission at this SHA; source clear is not final ready. New head requires delta review. No per-item QA request. No edits, signals, installs, commits, merges, provider actions or subagents. Tracker body/criteria read from actual item file under the no-task.view journal-scan guidance.

Structured finding (tool schema currently lacks findings field): [{severity:low,file:hub/src/hub/suites.ts,line:689,text:Restored successful run timing uses recovery time rather than its durable finished timestamp, inflating runMs and ETA samples.}]. Counts: high0,medium0,low1. Total findings: Standards0; Spec1 low.

Review artifact A-3624 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3624-t-562-source-clear-at-0f42e138-terminal-receipt-recovery-and-slot-release.md

Criteria: C1 verified, C3 verified.

### impl-562 · 2026-10-16T03:26:53.320Z

Linux 62f32db1 at reviewed0f42e138: all three new cases pass plus 5/5 load gates each; sole failure is verification-workers cache hit assertion. A-3644 records whole-file Mac passes 4/4 on task and dev58696d94, plus a deterministic public-edge reproduction on BOTH heads: an empty done timestamp yields reported=true / finished=null and same-tree cached.run undefined. Head unchanged; shared-fix versus known-signature retry decision requested from lead T-562. No resubmission.

### impl-562 · 2026-10-16T04:09:28.446Z

Fresh retry cc6233c4 is green at unchanged reviewed0f42e138: A-3683, 1870 tests / 1866 pass / 0 fail / 4 platform skips, hub-only plus Neovim smoke. All three regressions pass ordinary execution and their exact 5/5 load gates. Reviewer final settlement requested; no source changes since source clear.

### rev-30 · 2026-10-16T04:09:30.981Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-562-final
commit: 0f42e138e8458f5782dfacbca823fb79921231e1
scope: evidence

# T-562 final evidence clear at 0f42e138

Head: 0f42e138e8458f5782dfacbca823fb79921231e1
Branch: t/T-562-finished-remote-runs-stay-listed-as-slot
Evidence scope only; original source review A-3624 / rev-20261016-562-source remains applicable. Origin task ref matches this SHA; no source or manifest changes.

## Standards
No new findings or unresolved high/medium findings. Existing nonblocking low L1 at hub/src/hub/suites.ts:689 remains: restored successful-run timing uses recovery-time now instead of durable job.finished when recording timing, inflating runMs/ETA samples. The durable outcome and finished fields, reporting and capacity behavior are unaffected. This review retains the finding rather than claiming it fixed.

## Spec
C2 is verified, and C1/C3 are refreshed at the exact reviewed head. A-3683 / cc6233c4-83bc-4d42-acf1-7f0259fad03a is actual Linux x64 droplet c-8 lon1 cland-v0-bd8b5e5b, Nodev24.21.0, Neovimv0.12.5, four workers. Exit0:1870 tests,1866 pass,0 fail/cancelled,4 platform skips. Hub free38/38, hub machine1816pass/4skip, Neovim smoke12/12. Both typechecks and all selected phases complete.
All three new regressions pass ordinarily and five fresh load repetitions each:
- finished remote runs free both budget slots despite failed spend settlement:12.547s, raw2991/3132;
- startup posts the persisted remote receipt before admitting its waiter:9.922s, raw3000/3226;
- an unconfirmed release posts its receipt while the live lease still guards admission:13.092s, raw3074/3641.
The source-reviewed fixtures retain fault injection until terminal reporting and waiter admission, account separately for durable live leases, and restore persisted terminal outcome before stale remote polling/relaunch. Thus ordinary completion/acquisition-failure slot release and two-waiter admission, startup reconciliation without resubmission, and unconfirmed-provider-release safety are covered without broadening to sharded accounting T-563. Source scope remains ordinary task runs/startup per Coordinator62854215.
Suite1416.93s, peak one-minute load14.56, load-gate extra wall0.03s; lifetime1491s,cost$0.1036. Known-entry duration regression notices do not fail the run. Final exit0 at6030. Earlier T-567/cache red is not used as final gate evidence; no exception is needed now.

Final review clear; all C1–C3 verified. Counts: high0,medium0,low1 (existing L1). No per-item QA. No Reviewer tests, edits, signals, provider operations or subagents.

Artifact: A-3685 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3685-t-562-final-evidence-clear-exact-head-green-linux-slot-recovery-suite.md

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-16T04:10:29.346Z

Merged dcac1f07558ba9bdbf30780290696fbbbc3067ee onto dev.
