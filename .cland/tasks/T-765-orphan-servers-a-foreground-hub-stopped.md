---
id: T-765
kind: task
title: "orphan-servers: a foreground hub stopped after doctor --fix was SIGKILLed instead of exiting cleanly (1 in 35 Mac runs)"
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
topic: topic-472
branch: t/T-765-orphan-servers-a-foreground-hub-stopped
created: 2026-10-18T00:55:58.384Z
updated: 2026-10-18T03:49:25.389Z
---

## Summary

During T-703's post-merge proof on 2026-10-18 at 00:33Z, the head was 671d8e9d, which merges T-703 with dev fc183873. There, hub/test/orphan-servers.test.ts:446, "doctor --fix lets a foreground hub for a deleted project stop cleanly without recreating its directory", failed once at line 466. The run got `{code: null, signal: SIGKILL}` where it expected a clean exit, at peak load 4.8, on the fifth of five whole-file runs (A-4878). It didn't reproduce in 30 further serial runs: 10 whole-file runs on clean dev fc183873, 10 isolated-case runs and 10 whole-file runs at the T-703 head (A-4879). T-703 changes the stop and kill path (a bounded PID-reaped precondition in daemon.ts and adapters/processes.ts), but it's unproven whether that path causes this.

## What to build

Find what escalates a doctor-repaired foreground hub's stop to SIGKILL: the stop-grace timer, a race between the hub's own exit and the escalation, or an unrelated reaper. Make the clean exit deterministic, or make the test wait on the hub's own exit receipt before the grace window.

## Acceptance criteria

- [x] C1. The cause is named with evidence, and the case passes 50/50 serially under a load of 8–12, or under a scripted delay that reproduced the SIGKILL before the fix.
  - done: impl-765 · 2026-10-18T03:42:52.564Z
  - verified: rev-30 [reviewer] · run rev-20261018-765-final · 2026-10-18T03:49:24.827Z · commit a1e009c231b4ccf2d068a319ff1897bf4a17c33b

## Comments

### impl-765 · 2026-10-18T03:11:13.580Z

Diagnosis/proof in progress: original A-4878 clean-exit failure has no externally visible signal/stop receipt (ordinary signal/stop logs use the async file sink, removed with the fixture). A 1500 ms delay in the native hub's SIGTERM callback reproduces {code:null, signal:SIGKILL} 3/3. Doctor-side process.kill tracing shows TERM -> STOP after ~1.05 s -> KILL, identifying sweepUnlocked's 1000 ms grace escalation. Removing the delay passes; minimized delayed regression fails before source fix and passes after a hub-only 5000 ms normal termination grace. Harness/bridge remain 1000 ms and shared sweep deadline remains 12 s. T0 typecheck/tiers/lint exit 0. Running the requested 50 serial delayed cases and five touched-file runs next, before source review.

### impl-765 · 2026-10-18T03:19:38.398Z

Implementation committed and pushed to local origin at 71f1b1b67e3fe0100ca9aec8862263916aa9cec3. Source review requested via reviewer role in topic-472. A-4915 preserves all red/green diagnosis logs, source hashes and 56 green serial native runs: delayed case 50/50; orphan-servers whole file 5/5 (60.128, 63.288, 59.447, 58.465, 56.690 s); termination-ownership whole file 1/1 (12.433 s), including forced hub-tree reap. Peak 1-minute load 5.9795. T0 typecheck/tiers/lint and diff whitespace checks pass. No new duration allowance, no local full suite, no live hub changes. Awaiting clear source verdict before exact-head diff-selected droplet verification.

### rev-30 · 2026-10-18T03:21:03.784Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-765-source
commit: 71f1b1b67e3fe0100ca9aec8862263916aa9cec3
scope: full
findings: [{"severity":"medium","text":"M1: the new handler-delivery assertion reads accumulated stderr immediately after child exit, which does not establish stream completion; bound marker receipt or pre-registered close/stderr-end completion before retaining the final assertion.","file":"hub/test/orphan-servers.test.ts","line":485}]
finding_counts: {"high":0,"medium":1,"low":0}

A-4918 records Standards M1 (medium), no production/Spec findings. The hub-only 5000ms grace preserves the 12s sweep deadline and identity/tree/owner guards. Independently audited exact source hashes, traced pre-fix TERM/STOP/KILL, minimized red/green and normal control, 50/50 delayed cases, five 18/18 whole-file runs and the forced-tree reap control (142 total passes). These support the reproduced grace-expiry mechanism, with historical A-4878 scheduling details explicitly unknown. Before verification, fix the new stderr assertion's exit-vs-stream boundary, retain clean OS exit/no-ENOENT/no-lock assertions and refresh affected test evidence at a new reviewed head.

Criteria: C1 failed (Regression still has a cross-boundary stderr receipt race: child exit does not establish that the handler-delivery data has been observed.).

### impl-765 · 2026-10-18T03:23:42.958Z

M1 fixed in a1e009c231b4ccf2d068a319ff1897bf4a17c33b (three test-only lines: pre-register child close, bound close observation after actual exit and before final stderr assertions). Committed/pushed; production unchanged from 71f1b1b6. Revised T0 checks pass. A-4925 preserves the local attempt interrupted for Coordinator cover-quiet and confirmation that owned test PIDs were gone before stage start. Coordinator a3cde264 authorizes delta review now with five serial affected-file runs pending quiet-end; delta request delivered through reviewer role. Droplet verification waits for both clear source verdict and refreshed 5/5. No local tests during quiet.

### rev-30 · 2026-10-18T03:24:10.665Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-765-source-correction
commit: a1e009c231b4ccf2d068a319ff1897bf4a17c33b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-4927: M1 resolved; no remaining Standards or Spec findings. Three test-only lines pre-register child close and separately bound stream closure after actual process exit and before final stderr assertions. Production and all original assertions are unchanged from 71f1b1b6. Primary Coordinator a3cde264 explicitly permits source review while local proof is pending: the interrupted A-4925 attempt is not green, affected-file exact-head 5/5 must follow the quiet-end notice, and droplet verification waits for BOTH that proof and source clear. C1 remains unverified pending the local proof and same-head task receipt; prior 50/50 A-4915 evidence remains historical support for the unchanged scripted fault and production correction.

### impl-765 · 2026-10-18T03:43:16.936Z

Fresh post-quiet proof at exact source-cleared a1e009c231b4ccf2d068a319ff1897bf4a17c33b is complete: orphan-servers.test.ts whole file 5/5, 90 passes with no failures/skips/cancellations, durations 67.503/64.632/64.376/73.865/72.308 s, peak 1-minute load 10.7212. A-4936 retains all logs and matching source hashes; original A-4915 controlled reproduction and 50/50 delayed cases remain separate historical proof. Both Coordinator prerequisites hold. Reviewer received the new evidence; mode-free exact-head droplet verification submitted with Reviewer, impl-765 and Coordinator as recipients. No further source changes or local tests; waiting for hub result.

### impl-765 · 2026-10-18T03:49:12.851Z

Exact-head diff-selected droplet receipt is green: suite 20ab679c-bec2-43be-8c43-21fc910ebb74 at a1e009c231b4ccf2d068a319ff1897bf4a17c33b, A-4942. hub-selected uses coverage map A-4923 at ancestral d392167a and names sweepUnlocked, worker and the endProcess options callback; 162 passes, zero failures/cancellations, one skip. Linux x64 c-8 lon1 / Node 24.21.0 / Neovim 0.12.5, lifetime 280 s, cost $0.0195; shard wall 203.67 s. Task verify record is finished/passed at the reviewed head. Report-only duration/lint findings were not changed; E-482 owns allowances. Fresh corrected local proof remains A-4936 and controlled red/50-case proof A-4915. Awaiting Reviewer final evidence verdict; source unchanged and worktree clean.

### rev-30 · 2026-10-18T03:49:24.827Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-765-final
commit: a1e009c231b4ccf2d068a319ff1897bf4a17c33b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-4943: final clear, C1 verified, no remaining findings. A-4936 source hashes match both committed changed files and its five post-quiet whole-file logs pass 90/90 without failure/cancellation/skip, satisfying primary a3cde264's prerequisite after M1. A-4915 retains audited 50/50 delayed cases and traced pre-fix doctor TERM/STOP/KILL diagnosis; the production correction is unchanged. Exact-head A-4942 / 20ab679c exits 0: delayed case passes 3.140433468s, TERM-resistant deleted-hub tree passes 8.777008061s. Total 162 pass/0 fail or cancelled/1 optional real-OpenCode prerequisite skip, with 5/5 Neovim smoke. Existing report-only duration notices disclosed; no new allowance. Historical A-4878's precise internal scheduling operation remains unknown; the controlled grace-expiry mechanism and sender are evidenced.

Criteria: C1 verified.
