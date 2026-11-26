---
id: T-2031
kind: task
title: Owned-process stop scans the whole process table four times per stop and overruns its 1 s budget under Linux load; inspect only captured PIDs
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1782
branch: t/T-2031-owned-process-stop-scans-the-whole
created: 2026-11-20T09:57:59.356Z
updated: 2026-11-26T19:58:29.144Z
closed: 2026-11-26T19:58:29.144Z
---

## Summary

T-1856's owned-process stop (`native.end`, 1,000 ms budget) takes about 380 ms on a quiet Mac, including four full-machine process snapshots of about 693 rows each (impl-1856's trace, A-22127). Under Linux T3 load the same stop exceeded its budget with "process inspection deadline reached" in 2 of 4 full-suite occasions (A-22024, A-22118), and passed in the others (A-22090, A-22135). The cost of a full-machine scan grows with every process on the box.

## What to build

Inspect only the captured native PIDs and their recorded descendants during stop (`ps -p`, or `/proc/<pid>` on Linux), not the whole process table, keeping the exact birth-identity checks. Measure stop time against the current full-scan path under load.

## Acceptance criteria

- [x] C1. Stop inspection reads only the captured PIDs and descendants, with birth-identity checks unchanged, shown by a test that counts scanned rows (test).
  - done: impl-2031 · 2026-11-25T13:09:25.125Z
  - verified: rev-35 [reviewer] · run rev-35-2031-evidence-3 · 2026-11-26T19:00:52.792Z · commit a6a21bd1ae3ede85510523031edcca1000088ec5
- [x] C2. The item's Linux droplet verify passes every prune-process-lifecycle identity, with no "process inspection deadline reached" anywhere in the run (test).
  - done: impl-2031 · 2026-11-26T18:58:57.236Z
  - verified: rev-35 [reviewer] · run rev-35-2031-evidence-3 · 2026-11-26T19:00:52.792Z · commit a6a21bd1ae3ede85510523031edcca1000088ec5

## Comments

### coord · 2026-11-20T10:23:35.095Z

T-1856 source14 (45d2e7321) carries the scoped inspection: cland parses only captured roots and descendants (about 101 rows, against 5,471 before). Descendant discovery still uses `pgrep -P`, which enumerates the process table natively (procps-ng v4.0.4 pgrep.c). A Linux-native children walk (`/proc/<pid>/task/*/children`) would remove that remaining enumeration, if the Linux per-step trace in T-1856's final full suite shows it matters. Close this item when T-1856 lands unless that trace shows the need.

### impl-2031 · 2026-11-25T13:06:06.567Z

Consumer search: systemProcesses/endProcess production importers: hub/src/{remote/poller-lease,prune-processes,fixture-processes,git-command-owner,termination-owner,executor/local,host/local,orphans,suite-command}. Linux descendant selector changes only; default full ps and Darwin pgrep retained, no wire or persisted schema change. Shared probe importers include system-processes, Claude/session lifecycle, measure-memory, suite-cancel and fixture orphan lifecycle tests. Existing seam approved in launch: endProcess owned-tree fake native boundary. Red receipt: Linux enumeration assertion actual 6 pgrep calls, expected 0, Node 24.21.0 macOS synthetic Linux.

### rev-40 · 2026-11-25T13:13:53.138Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-2031-source1
commit: d183187120556f8de7c06bbe7e793ceb885b2e5f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-23410, no findings. Linux discovery recursively reads only selected parents'taskchildren, including nonleaderthreads; zero-pgrep/workcount/parentselector controls preserve10000unrelatedbranches. Childselectors grant no authority: selectedps/birthbracketing, exactcapturedidentity, callerancestry, forkfreeze and persignal fences unchanged. MissingprocfsrequiresindependentESRCH; unreadable/liveENOENT/malformed branchesrefuse. Newprobecontexts own acquisition/nativeclose/rootcleanup; rawfakeinterfaces/productionconsumerAPIs unchanged. Docs retainLinux/Darwin/defaultconditions. C1done/sourceconsistent, finalmarks pendingconfigurednamedproof. C2explicitlypendingexact-headLinuxpruneloadgateidentities5/5/noinspectiondeadline; localMac7/7notloadorLinuxproof. Otherlocal63/69/19+1skip/22/58/static0and757+18unknownreachability remain scoped author evidence. No Reviewer execution/edits.

### rev-40 · 2026-11-25T14:25:02.955Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261125-2031-evidence1
commit: d183187120556f8de7c06bbe7e793ceb885b2e5f
scope: evidence
findings: [{"severity":"medium","text":"E1: exact-head configured run completes T3 exit1 with26 failures, Web unexecuted; seven prune base passes supply none of C2's required5/5 load-gate receipts.","file":".cland/artifacts/A-23474-suite-648eea69-6a28-4de9-94bb-84e7646dce1c-auto-at-d183187.log","line":52618}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-23476 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23476-t-2031-configured-evidence-not-clear-at-d18318712.md). Producer code1/cause empty unknown, progress.unfinished[]; T0/T1/T2 complete0, T3 complete1 at canonical0b9678005 (executable match), Web/T4 unexecuted. Literal accounts:304 ENOENT /proc/44384/task/44386/children and other new-selector path diagnostics require lead/Coordinator source attribution, no unrelated-flake or timeout claim. Linux c8nyc1 workers2 Node24.21/Nvim0.12.5, no browser, noncache,9 prerequisite skips, budgets report-only. Seven prune structured base passes and two new C1 Linux controls pass are retained as positive selected evidence, not final green; no C1 final verification mark claimed. Prior source A-23410 retained. Hold released; no retry/source edits by Reviewer, pin head pending authorized disposition and fresh source review for any change.

Criteria: C2 failed (Configured648eea69 failed T3 and contains only seven prune base passes, no required5/5 load-gate receipts; absence of deadline text is not load coverage.).

### impl-2031 · 2026-11-25T14:32:41.840Z

Delta 93698d340 corrects task/PID ENOENT discovery races (Coordinator attribution). Fake task-disappearance regression went red with ENOENT then green; whole PID read/list disappearance cases and existing native birth/ancestor fences pass. A-23482 retains original Linux result, literal diagnostics and unknown attribution for orphan/native-resume timeouts. Corrected source local Node24/macOS: six files 228 pass, full typecheck and full test:lint exit0 with zero refusals. Native Linux verify pending after midnight; no resubmission before Coordinator window. C2 now requires every prune identity once plus no inspection deadline anywhere, with stage/soak repetition proof deferred as Coordinator decided.

### rev-40 · 2026-11-25T14:33:36.272Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-2031-source2
commit: 93698d340a36691149255913af6e5a9b144bfb85
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-23484 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23484-t-2031-vanished-task-source-clear-at-93698d340.md), no findings. Per-entry ENOENT discovery skips preserve other children and make no exit claim; permission/I/O/malformed errors still refuse. Selected-ps/native-birth/ancestry/per-target signal/fork-freeze authority unchanged. Three new owned fake race controls positively retain surviving managed kills/no unrelated signals/zero pgrep, prior row bounds preserved. Docs distinguish selector disappearance from native exit. A-23482 scoped local228/static0 retained; macOS native consumers do not establish Linux-native correctness. Prior648eea69 remains red; orphan/native-resume attribution unknown. Coordinator57e62eff corrected C2 to seven prune identities once with no inspection deadline anywhere, not5/5; stage/soak repetition deferred. C1/C2 final marks await green exact-head Linux configured proof. Hold released; no Reviewer edits/executions or resubmission, human midnight/Coordinator window retained.

### rev-40 · 2026-11-26T02:38:45.246Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261126-2031-evidence2
commit: 93698d340a36691149255913af6e5a9b144bfb85
scope: evidence
findings: [{"severity":"medium","text":"E2: exact-head configured T3 fails orphan-sweep cleanup census (nine Timeout resources expected[]), Web unexecuted; producer cause unspecified, final clearance unavailable.","file":".cland/artifacts/A-23535-suite-28f39125-cd68-4280-a15e-a502eb39dcb6-auto-at-93698d3.log","line":52108}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-23536 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23536-t-2031-second-configured-evidence-not-clear-at-93698d340.md). Producer1/causeemptyunknown, unfinished[], T0/T1/T2complete0/T3complete1; canonical339ef293 executable match. Literal orphan failure projectHub leaked resources; actual9Timeout vs[], stack hub-resources:32/harness:565/drainFixtureCleanup; no finer attribution. Corrected C2 uses7prune passes once and no inspection deadline: all seven structured passes and full-log0matches retained. No5/5 requirement; final configured gate remains red, not a prune assertion failure. C1 system-processes66 and fiveLinux named controls pass. Linuxc8nyc1 workers2 Node24.21/Nvim0.12.5 noncache,9skips,Web/T4 unexecuted, budgets advisory. Prior648eea69 stays failed historical. Hold released; pin head for lead/Coordinator disposition, no Reviewer edit/probe/retry.

Criteria: C2 failed (Final configured28f39125 failed T3 orphan-resource census and did not run Web; all7 prune identity/no-inspection-deadline observations pass and are retained, not failed subassertions.).

### impl-2031 · 2026-11-26T17:51:47.966Z

a6a21bd1a fixes the confirmed retained-deadline resource defect: AbortSignal.timeout left unrefed timers after procfs reads; new positive-control census red with46 Timeout resources, green after explicit owned AbortController timer cleared in finally. Both child discovery and caller ancestry use shared read owner; native identity/ENOENT policy unchanged. A-23548 retains evidence. Local Node24.21/macOS system67/orphan18 pass; full typecheck and test:lint exit0, zero refusals. No new Linux verification yet.

### rev-35 · 2026-11-26T17:53:25.626Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2031-source-3
commit: a6a21bd1ae3ede85510523031edcca1000088ec5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-23550 records standards/spec review of the timer delta and retained prior full review. Both procfs read paths now share an AbortController deadline owner with an unref'ed timer cleared in finally after the read settles, including ENOENT and rejection. Existing budgets, native birth/ancestry/exit checks and selector policy remain unchanged. New context-owned synthetic Linux census positively detects a planted unref'ed timer, observes destruction after clearing, and retains managed-child termination / EACCES no-signal assertions for all four paths. Matching guide updated. A-23548 local macOS results are implementer-reported scoped observations, not native Linux or final C2 evidence. Prior 28f39125/A-23535 remains failed; its seven prune passes remain positive subproof. C1/C2 intentionally unverified pending corrected-head Linux configured receipts under the corrected once-per-identity C2, with no 5/5 requirement. Request a new Coordinator verify window; no Reviewer test/probe/run performed. Findings: none.

### coord · 2026-11-26T18:30:24.225Z

Another dev-side sighting of this defect, from an unrelated item: T-2007's c-16 retry 5e40e738 (A-23560, lines 52126–52130, 2026-11-26) failed `prune-process-lifecycle.test.ts::hub crash after durable writer release is reconciled by restart before territory admission` with "foreground hub durable discovery: not within 20000 ms (… Git writer recovery required … recovery reservation: process inspection deadline reached …)". It ran on c-16 with 4 workers, a heavier load than c-8 with 2. Count it among the stage-cover and soak checks after T-2031 lands.

### rev-35 · 2026-11-26T19:00:52.793Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2031-evidence-3
commit: a6a21bd1ae3ede85510523031edcca1000088ec5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-23575 records independent A-23574/0d18800f audit. Producer code0/cause empty, unfinished[], complete exit0 T0/T1/T2/selected253 T3/Web at canonical5f8e97a9dd628d0580b7c41a24646faa3d52f20f. C1 row-count/selected-ps/native-birth/ancestor controls pass; system-processes67 includes positive timer destruction census. Current C2's exact seven prune identities each pass once, file passes, full-log inspection-deadline scan has zero matches; no obsolete5/5 requirement. Previously failed lost-row orphan cleanup passes, orphan17pass+1 real-OpenCode prerequisite skip retained. All selected file finishes pass;22 other T3/18 T4 unexecuted. Paired9765pass/12skip;3 existing protected-output finish-only receipts disclosed separately. Linuxc8nyc1 Node24.21/Nvim0.12.5 workers2, HeadlessShell1248/Chrome156.0.8078.4; cache unknown, advisory diagnostics retained. Earlier two red runs stay historical; source3 timer repair and current receipt settle C1/C2. Findings none; no Reviewer changes or additional run.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-26T19:58:29.144Z

Merged 2db9e2a4416b4e58aeae8749036fbcad568bc17f onto dev.
