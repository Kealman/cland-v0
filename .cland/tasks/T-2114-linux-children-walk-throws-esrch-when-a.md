---
id: T-2114
kind: task
title: Linux children walk throws ESRCH when a whole process vanishes mid-walk (scandir /proc/<pid>/task), failing verify with 'auto exit 1'
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
regression_of: T-2031
found_by: cover
topic: topic-1800
branch: t/T-2114-linux-children-walk-throws-esrch-when-a
created: 2026-11-26T20:43:04.307Z
updated: 2026-11-27T01:22:47.859Z
closed: 2026-11-27T01:22:47.859Z
---

## Summary

Stage cover ca02bf48 at dev 54697b236 (A-23621, 2026-11-26) failed `hub/test/suite-timeouts.test.ts::verify kills a silent test tree and spoke, names the last started test and frees admission`. The inner suite ended `auto exit 1; ESRCH: no such process, scandir '/proc/142371/task'` instead of reporting the stall. T-2031 (landed 2db9e2a44) treats a vanished task or pid as "no children" on ENOENT, but Linux returns ESRCH when the process exits between listing and `scandir('/proc/<pid>/task')`. The error escapes the stop path and fails the run.

## What to build

Treat ESRCH from `/proc/<pid>/task` and its children reads the same as ENOENT, a vanished process with no children, in the shared procfs read owner. Keep every other error refused and the birth-identity checks unchanged.

## Acceptance criteria

- [x] C1. A fake-procfs case where the pid directory read fails with ESRCH mid-walk yields no children and no thrown error, and is red before the fix (test).
  - done: impl-2114 · 2026-11-26T20:46:35.107Z
  - verified: rev-35 [reviewer] · run rev-35-2114-evidence-1 · 2026-11-26T22:11:10.187Z · commit b347e04b3037ae6400ffbd40558bcd774c500e8e
- [x] C2. suite-timeouts.test.ts's silent-tree case reports the stall in the item's Linux droplet verify (test).
  - done: impl-2114 · 2026-11-26T22:09:44.318Z
  - verified: rev-35 [reviewer] · run rev-35-2114-evidence-1 · 2026-11-26T22:11:10.188Z · commit b347e04b3037ae6400ffbd40558bcd774c500e8e

## Comments

### impl-2114 · 2026-11-26T20:45:30.484Z

Consumer census: shared linuxChildren entry owner is internal to systemProcesses/endProcess. Direct production consumers: prune-processes, fixture-processes, remote/poller-lease, host/local, executor/local, git-command-owner, suite-command, orphans. Wire shape, births and native-exit authority unchanged; discovery alone grants none. rg over src/bin/tests/nvim/docs/skills and fixtures finds no separate procfs policy consumer requiring migration. Production import graph: 757 reachable test files (T1 72, T2 370, T3 226, T4 14, remaining other classifications), 18 unknown graph files; local checks limited to changed file plus five direct importers; verify owns wider selection. Red: three ESRCH boundary cases plus resource census failed with Error: vanished procfs entry / code ESRCH; ENOENT passed 3/3. Focused green 11/11, changed file 70/70; macOS arm64, local Node 24.21.0; Linux boundaries synthetic.

### rev-35 · 2026-11-26T20:50:02.547Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2114-source-1
commit: b347e04b3037ae6400ffbd40558bcd774c500e8e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-23627 records standards/spec review. Shared discovery-only entry owner accepts exactly ENOENT/ESRCH for task directory/children reads, adds no selectors and grants no exit/signal authority. Other errors, native birth/caller ancestry checks and owned timer clearing remain unchanged. Six positively reached vanished-entry controls retain managed termination/no unrelated signals/no pgrep/positive bounded row work; resource census extends both codes while EACCES still rejects. Existing whole-case probe ownership and final assertions retained; matching guide/census updated. A-23625/local request results are scoped authored macOS/Node24.21 synthetic-boundary evidence, not raw native Linux or full reachable coverage. C1/C2 intentionally unverified pending exact-head configured Linux receipts, especially suite-timeouts' silent-tree stall/cleanup/admission case. No findings; hold released, request Coordinator window. No Reviewer changes or test/probe/run.

### rev-35 · 2026-11-26T22:11:10.188Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2114-evidence-1
commit: b347e04b3037ae6400ffbd40558bcd774c500e8e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear; A-23646 records independent2528ceef/A-23645 audit. Producer code0/empty cause, unfinished[], complete0 T0/T1/T2/selected253 T3/Web at canonical623be4e1c5fe029d7a419fb6be28f8a607d6b013. C1 all six exact ENOENT/ESRCH cases pass, including pid-list ESRCH, with injection/termination/no-unrelated-signal/bounded-work assertions retained; timer census/refusal controls pass. A-23625 reported local red and source-supported old ESRCH rethrow remain accurately labelled, not reconstructed raw logs. C2 exact Linux silent-tree stall/cleanup/last-started/successor-admission case passes at log50243 (14.243778488 test-seconds). System70/suite-timeouts19/prune7 pass; orphan17pass+1 prerequisite skip. Paired9810pass/12explicit skips, known3 finish-only accounting records separate; other23 T3/18 T4 unexecuted, no load repetitions claimed. Linuxc8nyc1 Node24.21/Nvim0.12.5 workers2, isolated HeadlessShell1248/Chrome156.0.8078.4; advisory/cache limits recorded. Earlier stage failure retained; C1/C2 verified, findings none, no Reviewer changes or additional run.

Criteria: C1 verified, C2 verified.

### impl-2114 · 2026-11-26T23:04:51.875Z

Batch 218ef60e at merged head 93673b60 failed existing reservation-release assertion: failed release is retried after the local call returns (actual false). Focused case passed 5/5 on unchanged task head b347e04b3; six full local files also passed (70,19,52,22,17,7). macOS arm64 Node 24.21.0, serial, no stress generator. Case calls default darwin probe; child overrides process.platform to darwin, so linuxChildren is unreachable. Coordinator classified flaky attribution, filed T-2115 and re-enqueued once. No source change or new verification submission. Native slot released.

### impl-2114 · 2026-11-27T00:29:05.440Z

Second batch 68e9a39a at 4ce8724 failed untouched late SessionEnd case with Error: process authority unknown; stop requires host reboot or recycling (A-23672:30367). Exact case passed 5/5 locally on unchanged b347e04b3, macOS arm64 Node 24.21.0, start loads 1.41-1.54; no Linux reproduction claimed. Complete production import graph of host/agent server, processes, prepared, native and claude-stop has no path to changed system-processes.ts, unknown entries zero. prepare-stop owner uses AgentProcesses captureForStop/capture and separate observeProcesses/observeClaudeProcesses/ps group. Reported unrelated logic path to Coordinator; native slot released, no source changes or further submissions. Native Linux timing/race cause remains unproven.

### coord · 2026-11-27T01:22:47.859Z

Merged e3772f8eeb09a6a8ead0f9149324ea15061dfed4 onto dev.
