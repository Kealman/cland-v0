---
id: T-2050
kind: task
title: An item turns ready on a clear evidence verdict while its same-head verify is still launching, with no result
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1710
branch: t/T-2050-an-item-turns-ready-on-a-clear-evidence
created: 2026-11-21T08:26:55.956Z
updated: 2026-11-21T23:38:21.913Z
closed: 2026-11-21T23:38:21.913Z
---

## Summary

On 2026-11-21 at 08:26:37Z, T-1983 changed review → ready while its only verify, run 6532e3ef at 44e58b48f, was in state `launching` with `result: null`. The run was admitted 08:26:28Z. Both verdicts on the item were clear at that head: the source review, and the final evidence review on the C2 campaigns. So ready rested on the review verdicts alone, before any suite result existed at the head. The Coordinator reads ready as "verified and mergeable" (rule 7 already asks for a head check), and an enqueue on this ready would merge without the item's own suite result.

## What to build

The ready transition requires a green same-head verify result for items whose flow includes `cland verify`, or an explicit verification disposition. A verify in flight keeps the item in review. Find out whether the hub counted the in-flight run, or a cached earlier run, as satisfying the gate.

## Acceptance criteria

- [x] C1. With clear review verdicts and a same-head verify in `launching` or `running` state, the item stays in review; it turns ready only when that run finishes green (test, red before).
  - done: impl-2050 · 2026-11-21T19:21:04.654Z
  - verified: rev-40 [reviewer] · run rev-40-20261121-2050-final · 2026-11-21T20:36:07.961Z · commit 58206d6d0ea81327c7dde0040270a9496b8ff14e
- [x] C2. A red or cancelled same-head run keeps the item out of ready (test).
  - done: impl-2050 · 2026-11-21T19:21:04.762Z
  - verified: rev-40 [reviewer] · run rev-40-20261121-2050-final · 2026-11-21T20:36:07.961Z · commit 58206d6d0ea81327c7dde0040270a9496b8ff14e

Evidence: T-1983's task.view at 08:26Z shows status ready with `verify: {id: 6532e3ef…, state: "launching", result: null, head: 44e58b48f}`.

## Comments

### impl-2050 · 2026-11-21T18:12:57.162Z

Consumer audit recorded in docs/evidence/T-2050-ready-consumers.md, including merge/enqueue, heartbeat stale-ready rows, scheduler/cache receipts, persisted tracker readers, clients, fixtures, skills and QA briefs. Root cause: ready never read verify, not an incorrectly accepted older/cache run. Regressions first failed with actual 'ready' !== expected 'review' for launching/running/failed/cancelled; targeted Tracker file now 38/38 passing on macOS Node 24.21.0 (local, fake-only; no browser). No live hub.db accessed.

### rev-40 · 2026-11-21T18:19:46.780Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-2050-source
commit: 1eb7e21e5fffcf2eea3b36ab8412b3084b9b8225
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. Automatic ready now requires the producing scheduler's latest finished passed timestamped exact-tip receipt when running config has test/tier commands. Pending/red/cancelled/absent/stale/incomplete receipt is insufficient; same-tree cache retains submitted-head projection. Approved no-command/empty-task-patch dispositions preserved; verification.decline grants no waiver. Receipt updates/restored binding schedule checks and pending-run demotion; final write rechecks task/Git/gate and receipt changes. Startup defers readiness through binding. Consumer audit and matching docs/skill changes read against behavior. Explicit merge admission remains Coordinator-deferred T-2055. Ten new fake-native-guarded regression variants inspected; A-22541 local red/green/static results are reported working-tree evidence, not a configured exact-head receipt. C1/C2 remain unverified pending same-head configured verification. Full source audit A-22547; no tests or native/browser runs by reviewer.

### impl-2050 · 2026-11-21T18:21:07.682Z

Source review clear at 1eb7e21e5fffcf2eea3b36ab8412b3084b9b8225 (A-22547, rev-40-20261121-2050-source). Pre-window dependency scan selected 69 T1 files plus 3 unknown-grammar files conservatively included: 72 files, 981/981 tests passed, zero skipped; local macOS Node 24.21.0, no browser. Full typecheck and test:lint passed (0 lint refusals, baseline report-only findings). Configured verify is not yet submitted; requested Coordinator window.

### rev-40 · 2026-11-21T18:32:40.681Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261121-2050-evidence1
commit: 1eb7e21e5fffcf2eea3b36ab8412b3084b9b8225
scope: evidence
findings: [{"severity":"medium","text":"Required configured load-gate evidence fails: all ten new ready-verification identities have five failed native-file repetition receipts (50 total), ERR_TEST_FAILURE/testCodeFailure: test failed. Base/test-level passes do not supersede the failed rounds; underlying cause unknown.","file":".cland/artifacts/A-22552-suite-186e2294-12c8-4e25-8595-e0818a85df62-auto-at-1eb7e21.log","line":12460}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear at reviewed head. A-22552/run186e2294 matches canonical tree9e350e8d. Literal first load-gate diagnostic: status failed, repetition1, ERR_TEST_FAILURE, failureType testCodeFailure, message/cause 'test failed' (12460). All ten new base cases pass, but each has five failed load-gate file rounds, 50 total. Selected test-level finishes can pass while the encompassing file fails; no assertion/root-cause/unrelated-flake attribution inferred. T0 exit0; T1 exit1. T2/T3/T4/Web unexecuted; browser null. Noncached Linuxx64 dropletc-8ams3 Node24.21.0/Nvim0.12.5 workers2. Advisory budgets/lint remain report-only and are not inferred exit cause. C1/C2 failed for incomplete configured verification; no final readiness claim. Prior source A-22547 retained. Full audit A-22553; no reviewer runs or edits.

Criteria: C1 failed (Exact-head configured run186e2294 exited1 in T1; launching/running repetition file receipts failed, and later phases did not run.), C2 failed (Exact-head configured run186e2294 exited1 in T1; failed/cancelled repetition file receipts failed, and later phases did not run.).

### impl-2050 · 2026-11-21T18:37:16.829Z

Correction pushed at 1eb1a27d4304a0926133cd08b8fc15769d95c80b: existing awaited churn file setup now registers before every test; test bodies and product code unchanged. Exact one-name native repro was red 5/5 fresh processes with 'fixture work admission closed' after selected-case pass, now green 5/5 fresh plus 5 identical same-process cases. A-22554 records cause/proof. Targeted files 64/64; full typecheck and test:lint passed, no lint refusals. Narrow source re-review requested; rerunning 72 pre-window T1 files. Prior configured run 186e2294 remains failed evidence; no resubmission yet.

### rev-40 · 2026-11-21T18:37:39.028Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-2050-source2
commit: 1eb1a27d4304a0926133cd08b8fc15769d95c80b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Correction source clear, no findings. Compared1eb7e21e5..1eb1a27d4: only identical awaited file-owned churn setup moved above all new registrations, plus focused-run documentation. Production code, setup/test bodies and readiness assertions unchanged; no dev merge. File-context after-hook/owner now registers before any running case, consistent with pre-change layout. A-22554 reports native one-name red 'fixture work admission closed' and local green correction controls; artifact is narrative, not raw per-process exact-head proof. C1/C2 remain unverified pending new configured receipt at this head. Failed186e2294/A-22552 and evidence-not-clearA-22553 retained; no failed rounds reused. Prior full product auditA-22547 applies unchanged. No reviewer runs/edits.

### rev-40 · 2026-11-21T19:05:28.671Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261121-2050-evidence2
commit: 1eb1a27d4304a0926133cd08b8fc15769d95c80b
scope: evidence
findings: [{"severity":"medium","text":"Shared ready consumer not migrated: fixture configures test=\"true\" and a nonempty patch, posts only clear review, then waits ready without completed exact-head verification. All45 merge-queue T2 cases fail at this setup boundary; inject fixture-owned verification evidence while preserving configured commands.","file":"hub/test/merge-queue.test.ts","line":328}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear. Exact head/tree matchA-22559. First literal failure37703: 'Error: reviewed task ready: not within3000ms'. Merge-queue fixture283 configures test=true, fake Git returns nonempty patch,327 posts clear review,328 awaits ready with no verification receipt; impl07e218d1 confirms no hidden disposition and Coordinator attribution. Consumer migration required, separate from deferredT-2055. Prior registration-order issue resolved: all ten new base identities and50 load-gate rounds pass with ten5/5 summaries. T0/T1 exit0, T2 exit1;45 failed identities allmerge-queue. T3/T4/Web unexecuted; browser null. Noncached Linuxx64/c-8ams3/Node24.21/Nvim0.12.5/workers2, advisory reports retained. C1/C2 failed for red configured evidence, not asserted readiness-test regression. Earlier186e2294 remains failed; no reviewer runs/edits.

Criteria: C1 failed (Configured59022dad has T0/T1 green but T2 exit1 with45 unmigrated merge-queue fixture failures; T3/T4/Web unexecuted.), C2 failed (Configured59022dad remains failed in T2 despite positive new base and50 load-gate passes; completed green final evidence is missing.).

### rev-40 · 2026-11-21T19:22:26.199Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-2050-source3
commit: 58206d6d0ea81327c7dde0040270a9496b8ff14e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Consumer correction source clear, no findings. Shared fixture records explicit completed passed item/head receipts and notifies Tracker; moving refs never manufactures a pass. Merge-queue and suite-stage-cover keep configured commands/nonempty diffs; changed-head queue case completes its next head explicitly. Lookup-only useVerify preserves previously bound verification requirement and integrated stage-cover supplier; production dispatcher still supplies all3args. Internal Daemon Tracker addition and owned projectHub hook checked across return/startup/cleanup paths and compatibility census; no wire/config change. Existing queue and real integrated stage-cover assertions retained; expanded fixture/disposition audit read. A-22561 local378+4QA passes are narrative working-tree evidence, not independently reconstructed configured receipts. C1/C2 remain unverified pending new exact-head run. Earlier186e2294/A-22552 and59022dad/A-22559 remain failed. No reviewer runs/edits.

### impl-2050 · 2026-11-21T19:23:38.850Z

Consumer correction source-clear at58206d6d0ea81327c7dde0040270a9496b8ff14e. A-22561/committed audit list all31 task-ready files and fixture paths/dispositions. Under granted native slot all31 passed378/378 including T2/T3/Web, plus four stub QA cases4/4; zero skips; slot released. Pre-window new-head T1 reachability batch72 files passed981/981, zero skipped. Full typecheck/test:lint passed0refusals; final doc wording lint passed. Local macOS arm64 Node24.21.0; pinned Chrome Headless Shell revision1248, isolated groups closed; headless Neovim for QA. Prior two configured runs remain failed. New window requested; no resubmission yet.

### rev-40 · 2026-11-21T20:36:07.961Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-2050-final
commit: 58206d6d0ea81327c7dde0040270a9496b8ff14e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear at exact reviewed head/treea89cf58e. Run695455ea/A-22570 finished/passed. All ten new generated readiness cases have base passes +5/5 load gates (50 positive rounds); all51 merge-queue cases,11 tracker-ready cases and migrated native stage-cover identity pass independently. C1 launching/running and C2 failed/cancelled assertions verified; missing/older/unfinished/passed/cache/no-command/empty-diff controls retained. T0/T1/fallbackT2/T3command/Web exit0; T4 unexecuted. Actual T3 receipt includes stage-cover pass48298; no blanket unexecuted T3 claim or totals inferred from nested generated records. Noncached Linuxx64/c-8blr1/Node24.21.0/Nvim0.12.5/workers2; HeadlessShell1248/CfT156.0.8078.4. Platform/prerequisite skips and report-only advisories retain status. Prior186e2294 and59022dad remain failed historical rounds. No reviewer runs/edits. Prior final sourceA-22562 and full productA-22547 retained.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-21T23:38:21.913Z

Merged 503d5858f72ef8ae6eb71a6b18bfb306c2bfb396 onto dev.
