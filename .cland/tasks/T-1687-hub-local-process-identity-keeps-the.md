---
id: T-1687
kind: task
title: Hub-local process identity keeps the exit-time /proc ESRCH race that T-1684 fixed for the agent (git daemon stop incomplete)
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1684
topic: topic-1391
branch: t/T-1687-hub-local-process-identity-keeps-the
created: 2026-11-05T11:55:24.090Z
updated: 2026-11-05T13:32:21.937Z
---

## Summary

Hub-local process identity on Linux has the same exit-time `/proc` race that T-1684 fixed for the host agent. `hub/src/process-identity.ts` (lines 59 and 82) reads `/proc/<pid>/stat`, and any read error, ESRCH from a process mid-exit included, becomes an identity failure. T-1684 added a bounded retry that resolves only on a positive ENOENT or native birth, but only in `host/agent/native.ts`. The hub-local path that `localHost` uses kept the bare failure.

Observed failures, intermittent on Linux x64 under load:
- T-1686 batch 21f52bc7 at 084165e2 (A-16851): host-git-daemon "eight admitted daemons per host; excess is refused, logged and close joins native exits" failed with `Git daemon termination incomplete` (git-daemon.ts:75, `native.stop(proof)` returned false; `native` is `localHost`). The test passed in A-16828, A-16844 and A-16849.
- dev-t3 687e1dc0 at 4cd99e20 (A-16822): host-ssh-contract "Host processes reports resident bytes and CPU percent for the whole parent-child tree", where `host.stop(owned)` returned false (host-contract.ts:415). That case ran through the agent before T-1684 landed. It may also be this class.

## What to build

Apply T-1684's bounded exit-time retry, with the same semantics, to `process-identity.ts`, ideally through one shared helper used by both paths so there is a single definition. A persistent ESRCH or unreadable state stays unknown. No signal authority comes from observation.

## Acceptance criteria

- [x] C1. Injected ESRCH on a `/proc/<pid>/stat` read of an exiting process makes hub-local identity report unknown before the fix and resolve to exited after it (test, red before the fix).
  - done: impl-1687 · 2026-11-05T12:07:07.976Z
  - verified: rev-35 [reviewer] · run rev-35-1687-final-1 · 2026-11-05T12:43:59.544Z · commit 5decccd1e89ab499f92a2aff31c67616fd9b57da
- [x] C2. Hub-local and agent identity share one exit-race helper, and a persistent ESRCH still yields unknown (test).
  - done: impl-1687 · 2026-11-05T12:07:08.485Z
  - verified: rev-35 [reviewer] · run rev-35-1687-final-1 · 2026-11-05T12:43:59.544Z · commit 5decccd1e89ab499f92a2aff31c67616fd9b57da
- [x] C3. host-git-daemon and host-ssh-contract pass 20/20 locally under CPU load in a Linux container (evidence).
  - done: impl-1687 · 2026-11-05T12:14:44.840Z
  - verified: rev-35 [reviewer] · run rev-35-1687-final-1 · 2026-11-05T12:43:59.545Z · commit 5decccd1e89ab499f92a2aff31c67616fd9b57da

## Comments

### impl-1687 · 2026-11-05T11:56:39.630Z

Rule 20 sweep before edits: searched hub/src, hub/test, nvim/test, docs, .agents, qa for process-identity, observeLinuxProcess/observeProcesses, isCapturedOrExited, IdentityExited/reportExited. Hub production consumers: adapters/processes, claude-code-local, host/local, hub/lock-identity, stdio-writers, suite-command, process-cleanup (native births). Agent consumers: bootstrap, entry, restart, supervisor.sh, claude, claude-stop, processes, ref-push. All retain APIs, nullable birth/ended distinction and signal fences; boot readers unchanged. Existing test consumers include process-identity, process-cleanup, system-processes/probe, claude-code-sessions-lifecycle, executor-droplet, memory-producer, host-agent/restart/supervisor/revoke-native/stop-observation/ref-watch-recovery, fakes/fake-host; harness/session-resume's unrelated observeProcesses is unaffected. QA E-1531 stages 2/3, E-1532 stage 3, E-1538 stages 1/2, E-1284 reference same unchanged APIs or historical receipts. No wire/persisted shape migration. Full search saved for evidence; preservation set will run unchanged.

### impl-1687 · 2026-11-05T11:57:39.621Z

Sweep addendum: also hub/system-processes, hub/suite-isolation, executor/local and executor/droplet/watchdog consume unchanged nullable/Map APIs. No changes needed: unknown stays unknown, only positive ENOENT or validated terminal stat gains exited. New T1 tests run both actual hub-local read paths with mocked physical procfs and restored builtin exports, no process launch. Baseline red: 6 pass/12 fail, ESRCH->ENOENT actual exit [] vs expected [123]; fixed green: process-identity + host-ref-watch-recovery 39/39 on macOS arm64 Node v24.21.0 (Linux readers injected). Shared helper in agent/identity keeps sync/async retry policy single-defined; agent boot namespace unchanged.

### impl-1687 · 2026-11-05T12:00:27.233Z

Correction/supersession to earlier comment: Coordinator decision bc7640f8 requires hub-local ENOENT to remain unknown and fall through to native kill(0), unlike the agent. Shared helper now shares only bounded ESRCH retry. C1 proves ESRCH -> validated Z -> exit; original red log contains that failure in both readers too. Only the two generated ESRCH refuses-present/surviving-branch tests now sustain ESRCH after snapshot; all their assertions unchanged. Existing ENOENT/kill(0) tests are unedited. Current head 5decccd1e.

### rev-35 · 2026-11-05T12:02:19.118Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1687-source-1
commit: 5decccd1e89ab499f92a2aff31c67616fd9b57da
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Interim source clear, no findings. A-16854 records shared bounded ESRCH-only retry review: sync/async hub-local and agent paths share one read helper while retaining caller-owned absence policies, physical hub boot reads, unknown diagnostics and native signal fences. Hub-local ENOENT remains unknown and reaches unchanged kill(0) branch checks; agent positive-ENOENT unchanged per Coordinator. Two authorized persistent-ESRCH fixture migrations preserve every refusal/no-signal assertion. All32 closure hashes match pinned Git objects. C1–C3 remain unverified pending retained red/current green, preservation/load evidence and same-head configured result. Source clear permits mode-free verification here after required local evidence/preflight; any changed head needs fresh review first. Existing agent ENOENT follow-up is T-1688, out of scope. No reviewer tests/edits; QA none.

### impl-1687 · 2026-11-05T12:08:26.462Z

Expanded field/function sweep includes processIdentityAsync/processIdentitiesAsync/processIdentities, linuxIdentity, agentBootId, isCapturedOrExited, observeLinuxProcess/observeProcesses, nativeExited and identityError. Additional hits: process-table re-export; agent/server reports unchanged observation shape; host-boundary helper/test and host-boot-source prove same boundary; measure-memory and claude-code-remote consume unchanged facts; QA E-1532 stages 2/4 and test docs describe unchanged ENOENT/kill(0) behavior. No migration needed in these. No nvim/test hits. Current-head macOS 21-file preservation A-16855 passed 368, skipped only native Linux Claude case; new tests <3ms. Only two authorized persistent-ESRCH fixture migrations.

### rev-35 · 2026-11-05T12:43:59.545Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1687-final-1
commit: 5decccd1e89ab499f92a2aff31c67616fd9b57da
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1–C3 verified. A-16861 records original sync/async ESRCH→Z red and independently inspected exact-head run3a5b55c8/A-16860: 5170/5170, zero fail/cancel/skip/todo. All12 new reader controls pass base+5/5 load each; process identity18, agent/ref-watch21, closure4 and changed lifecycle19 all pass, including unchanged ENOENT/kill(0) safety and real Linux background birth/stop. A-16856 independently establishes20 native code-0/signal-null combined-file iterations with43 identical passing names each (860total) under Linux arm64 CPU load; all7 source hashes match. Mac preservation368pass/1Linux prerequisite skip remains explicit. T0/allT1/fallback allT2/changedT3 once/Web complete; remaining T3 deferred, T4 unexecuted. Candidate projection matches; caller-owned absence policies preserved, source clear A-16854 stands. No findings or reviewer rerun; QA none.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-05T13:32:21.937Z

Batch c287e638 (A-16865) failed suite-cancel:141 (the worker pid wasn't alive after a refused cancel) on a droplet with degraded disk (fsync 197 ms). impl-1687 then ran suite-cancel 5/5 at head 5decccd1 and 5/5 at dev c6e19ffa, all eight cases each time (80 passes), in a Linux container with --init under CPU load (A-16866). Not reproduced on either head, so it is treated as an unrelated intermittent failure. Re-enqueued once at the unchanged head under the flaky rerun rule. The intermittent failure is filed separately.
