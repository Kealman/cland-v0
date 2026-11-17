---
id: T-1645
kind: task
title: The host agent's run operation buffers unbounded command output before its reply cap
state: open
status: ready
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1884
blocked_by: []
topic: topic-1596
branch: t/T-1645-the-host-agent-s-run-operation-buffers
created: 2026-11-02T23:52:24.965Z
updated: 2026-11-17T08:46:39.115Z
---

## Summary

T-1593's host-agent `run` RPC reuses the legacy doctor/run helper, which accumulates a command's stdout and stderr without a bound. Only afterwards does the 1 MiB reply cap refuse an oversized result. A noisy command on a small agent host can therefore grow the agent's memory before the refusal. The reviewer flagged this as low in A-16003; the behaviour otherwise matches the spec.

## What to build

Bound output while it is collected. Stop reading, or truncate, at the reply cap plus a margin, and report truncation explicitly. Keep the doctor's existing behaviour unchanged for its callers.

## Acceptance criteria

- [x] C1. An agent `run` of a command that writes 10× the reply cap holds at most the cap plus a fixed margin in memory, and answers with an explicit truncated or refused result (test).
  - done: impl-1645 · 2026-11-17T08:12:14.991Z
  - verified: rev-35 [reviewer] · run rev-35-1645-final-1 · 2026-11-17T08:45:21.336Z · commit 18e3f2d0a435728ff6a8a921c406730f9be48aca
- [x] C2. The doctor checks that use the same helper produce unchanged results (test).
  - done: impl-1645 · 2026-11-17T08:12:15.372Z
  - verified: rev-35 [reviewer] · run rev-35-1645-final-1 · 2026-11-17T08:45:21.336Z · commit 18e3f2d0a435728ff6a8a921c406730f9be48aca

## Comments

### impl-1645 · 2026-11-17T07:56:04.919Z

Rule 20 consumer census: agent raw run is dispatched by agentOperations; durable run-host is dispatched by server and persisted/trimmed by PreparedOperations.runCommand, consumed by SSHHost.run/settlement. command.ts is re-exported by doctor/report.ts. Direct consumers: agent process-usage, claude, login-disk, fake-login-disk, ref-push-worker, watch, prepared-checkout, worktrees; host/local, doctor/report and report importers (doctor probes, setup machine/account-identity/handover, system/process identity/path helpers, orphan/suite/git-maintenance/release-preflight helpers). These retain the unlimited default and unchanged result shape. Searches covered run-host, boundedCommandResult, frame-cap text, agent/command and doctor/report across hub, nvim, shared, docs, .agents and qa, including T3/T4: host-prepared, host-command-environment (old-shape regression), claude-agent-launch, claude-code-remote, login-binding, login-exclusive-native, login-write-back, ssh-host-fixture, doctor-run and doctor-* fixtures/tests; QA E-1532/1533/1535/1537/1538 and shipped skill change notes refer to commands or environment and need no wire migration. No fields or wire version change. Raw run keeps its existing frame-cap refusal; run-host keeps its explicit bounded RunResult error and durable native exit. New collection bound is opt-in only on those two RPC paths.

### rev-35 · 2026-11-17T08:06:35.821Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1645-source-1
commit: 0e6f47a4e7e0f0b8dddf1fe56db7f2491d415ba8
scope: full
findings: [{"severity":"medium","text":"All three new callbacks use fakeProbe without a whole-sequence owner before mocks/timers and pending run/agentOperations work. Its t.after only restores globals, leaving early-failure/cancellation setup/body/command continuations unjoined. Lead confirms no owner/disposition. Fence, release and join body/command before mock/timer/stream disposal; retain nominal assertions (rule12).","file":"hub/test/doctor-run.test.ts","line":14},{"severity":"low","text":"Per-file guidance omits the new trailing collector and bounded-output/raw-refusal/drain-close/unlimited-doctor regressions. Update matching test guidance with the correction (rule16).","file":"docs/agents/tests/hub-test-doctor-run.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":1}

Full source pass at treee74643d73a0f1906f0b500365491baef963a10f7; A-20762. Standards1M/1L, no separate nominal production defect. Shared collector bounds combined retained UTF-8 bytes only on raw run/generic run-host, keeps drain/native-close and durable result path, default doctor behavior unchanged. Closure hashes independently match. A-20755/A-20761 candidate11/11T2+13/13T1+5/5T1 and full lint/typecheck0 remain successful-path/precommit evidence, not ownership proof/exact-head runtime. Raw/hash/native-signal/original-scan unknowns retained; compatibility/lint overlap disclosed, no timing/load claim. C1/C2 failed/unverified; no verified marks. Lead confirms lifetime gap. Consolidate correction plus per-file guidance, then fresh pushed-head source review before configured verify. No Reviewer test/probe/edit.

Criteria: C1 failed (New output-bound/refusal regressions lack failure/cancellation lifetime ownership before restoring globals.), C2 failed (New complete-output doctor compatibility regression has the same unjoined callback/command cleanup gap.).

### rev-35 · 2026-11-17T08:17:00.018Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1645-source-2
commit: 18e3f2d0a435728ff6a8a921c406730f9be48aca
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh full source clear, tree22fcc93df68575b3f12446a60a65cd816e3cea3f; A-20772. M1/L1 corrected together. Shared fixtureWork enrolls bodies/command/assertion closures before fake acquisition; close fences/aborts, releases held setup and fake child, joins admitted work, observes stream close then restores global mocks. Positive abandoned-command and late-body→agent-operation controls retain restoration/no-process assertions; nominal byte/refusal/doctor assertions unchanged, spawn receipt replaces microtask polling. Per-file guide updated. Production/closure bytes unchanged from prior full pass; no new findings. A-20768 final candidate doctor-run13/13T2 and full typing0 follow edits; lint0/refusals0/122report findings59files overlapped final edits and is not an immutable final-source receipt. Earlier13/13compatibility+5/5closure remain prior-candidate T1 evidence. Raw/hash/signal/platform/native/provenance limits retained. C1/C2 remain unverified pending same-head configured evidence; no verified marks. No Reviewer runtime/probe/edit/new run/merge. Follow Coordinator window.

### rev-35 · 2026-11-17T08:45:21.336Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1645-final-1
commit: 18e3f2d0a435728ff6a8a921c406730f9be48aca
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Same-head final clear; A-20790 reconciles A-20787/run56cbc44f with A-20772 source. All5new output/refusal/doctor/cleanup identities have ordinary PASS+5/5load; full doctor-run13/13, closure and previous-shape compatibility guards pass. Counted retained UTF-8 strings≤1MiB through>10frame caps, zero overflow signals, native-close/exit and explicit refusal retained; no RSS/native-noisy-command claim. T0/T1/allT2/Web exit0,6612ordinary passes/708files plus235separate load passes,0fail/cancel/skip.264? No T3 executed:269T3/17T4 files unexecuted. Current clean head; normalized treeb9b345386d121fc4849dc4b976260ca0b8c3f620, uncached Linuxx64/Node24.21.0, actual HeadlessShell1248/ChromeTesting156.0.8078.4.64existing warning identities unchanged, none own-case; positive controls are primary evidence. Exact T-1935 fixture pair retained separately from terminal exit0/hub passed, no retry. Lint122/59 and budgets/ratchet/skip report-only; source-local/provenance limits preserved. Source clear predates rules38–43; cleared-head basis respected. C1/C2 verified. No Reviewer runtime/probe/edit/new run/merge.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-17T08:46:39.115Z

Record correction (coord, on rev-35's behalf; a reviewer can only post verdict comments). rev-35-1645-final-1 contains a stray "264?" just before "No T3 executed: 269 T3/17 T4 unexecuted". The correct statement, as in A-20790, is that 0 of 269 T3 files and 0 of 17 T4 files ran in the task verify; T3 is covered by the merge batch. The verdict and criteria marks are unchanged and valid.
