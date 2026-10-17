---
id: T-727
kind: task
title: claude-code-adapter scheduler and latch negatives move onto the adapter Clock
state: open
status: review
size: S
criterion_seq: 2
labels:
  - v0.1.4
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-696
topic: topic-451
branch: t/T-727-claude-code-adapter-scheduler-and-latch
created: 2026-10-17T07:27:42.323Z
updated: 2026-10-17T16:46:48.722Z
---

## Summary

T-691 (9a158f83) turned claude-code-adapter.test.ts into Claude Code's contract file. Its scheduler and signed-out-latch negatives (about 10 waits) stayed in their old wall-clock form, because they need the ClaudeCodeAdapter Clock seam that T-696 adds. This ticket converts them once T-696 lands.

## What to build

The scheduler and latch negatives in claude-code-adapter.test.ts drive the production ClaudeCodeAdapter with the hub FakeClock (T-685) through T-696's adapter Clock parameter, with the execFile boundary replaced and no binary. They wait on observed boundaries, never by pumping fake time. Native transport deadlines stay real.

## Acceptance criteria

- [x] C1. Every scheduler and latch negative in claude-code-adapter.test.ts runs on the FakeClock with no real-time sleep left, with assertions unchanged in meaning, shown in an audit.
  - done: impl-727 · 2026-10-17T16:45:41.764Z
  - verified: rev-30 [reviewer] · run rev-20261017-727-source-correction · 2026-10-17T16:46:48.722Z · commit ff0b67d9606bc205d9d0edfacb0137e071c65ed3
- [ ] C2. claude-code-adapter.test.ts passes 5/5 serially on the Mac and in the task's droplet verify, with its seconds before and after recorded.

## Comments

### impl-727 · 2026-10-17T16:42:50.568Z

Implemented scheduler/latch migration in 3b430870. origin/dev merged before first review. Production ClaudeCodeAdapter + FakeClock + scripted execFile, no binary for migrated cases; sender/journal coverage reopens real projectHub store. Mac baseline median 26.045s; after medians 17.947s contract + 0.675s T2 = 18.622s (28.5% lower), both files 5/5 serial, load 4.78–7.98. Typecheck/test:tiers green; audit and logs attached as artifact in topic-451. QA policy none/after-stage. Source review next; exact-head droplet verify follows clear source verdict.

### rev-30 · 2026-10-17T16:44:26.447Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-727-source
commit: 3b430870bab019df57e50b7d3a4b30a0a3355ca9
scope: full
findings: [{"severity":"medium","text":"M1: receipt() pumps FakeClock by 1ms until native I/O settles; nextPoll() similarly advances 1000ms until success at line135. I/O latency thereby determines simulated schedule progress, contrary to the ticket's explicit no-pumping requirement. Observe scheduling/input boundaries, advance a chosen interval, then await the receipt without further fake-time advancement.","file":"hub/test/claude-code-schedule.test.ts","line":52}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-727 source review — not clear

Reviewed head 3b430870bab019df57e50b7d3a4b30a0a3355ca9 on t/T-727-claude-code-adapter-scheduler-and-latch, fixed point 0ffa17c33df21a4bcb2f0d3830e2c1a220ce01c7 (merge-base with origin/dev). Three-file diff: native contract, new schedule component, sorted tier entry. No production or duration-manifest change. Read-only source/receipt review; no Reviewer test execution.

## Standards
M1 (medium), hub/test/claude-code-schedule.test.ts:52, also :135: receipt() repeatedly advances the shared FakeClock by 1ms until an arbitrary socket/MCP promise settles; nextPoll() repeatedly advances it by 1000ms until a poll signal arrives. This is fake-time pumping. Native I/O latency determines how far the entire hub scheduler advances, potentially admitting extra directory polls or changing timestamps while waiting for unrelated frames. docs/agents/tests.md:145–146 calls for a chosen clock advance followed by the expected frame/record, and T-727 explicitly forbids pumping fake time. Keep receipt waits bounded in native time without advancing the clock; where hub behavior needs a scheduled tick, first observe the relevant scheduling/input boundary, advance its explicit interval, then await its specific completion receipt. Recovery polling should likewise use a selected deadline/interval followed by an observed poll/query receipt, not an advance-until-passed loop.

Other standards checks: T2 header, FakeClock at adapter and hub boundaries, mocked execFile, fake infrastructure probes and in-process spoke. No new real subprocess or real sleep in the migrated file. Scripted ps is a replaced boundary, while pidAlive uses the current process in-process. Native transport deadlines remain real. The new tier path is sorted.

## Spec
M1 prevents C1 source clearance: the ticket's What to build says “They wait on observed boundaries, never by pumping fake time.” Having a final promise/poll receipt does not remove the repeated time-pumping loop before it.

The remaining migration map is supported by source. All six retained native test bodies are byte-identical after removing the three moved declarations. Default 30000ms interval, idle quiet, shared snapshot reuse, null-PID second launch/handle stop, config directory, 29999+1 boundary, final watch cancellation/no pending timers, admitted query before latch and persisted completion, sender dedup across real store reopen, running/unknown/signed-out state, failed launches, journal/history/remedies, explicit-success recovery and no auth/doctor retry assertions remain represented. The final stop uses the background handle with pid:null to isolate watch cancellation; native known-PID lifecycle proof remains in the native contract.

## Supplied evidence and pending work
A-4624 raw logs independently contain five before native passes (9 cases each), five after native passes (6 cases each), and five component passes (3 cases each): 90 total passing test executions, zero failures/cancellations/skips. The README's subprocess-wall medians recompute to 26.045s before and 17.947+0.675=18.622s after, 28.5% lower. These are subprocess-wall measurements, distinct from Node's file duration and reported top-level test-seconds. Metadata load 4.776–7.981. Supplied typecheck/tier checks green; report-only lint has no new-file finding. These green receipts do not override the explicit no-pumping requirement.

C1 failed for M1. C2 remains unverified: exact-head droplet evidence has not been submitted. Correct the helpers, rerun the affected file and request source review at the changed head before verification. No per-item QA.

Standards: one medium finding. Spec: the same M1 violates the explicit C1 implementation constraint; no additional finding.

Durable review: A-4626.

Criteria: C1 failed (M1: receipt and nextPoll pump fake time until asynchronous completion instead of advancing explicit intervals and awaiting observed receipts.).

### rev-30 · 2026-10-17T16:46:48.722Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-727-source-correction
commit: ff0b67d9606bc205d9d0edfacb0137e071c65ed3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-727 corrected source review — clear

Head ff0b67d9606bc205d9d0edfacb0137e071c65ed3, direct child of reviewed 3b430870bab019df57e50b7d3a4b30a0a3355ca9. Fixed point remains 0ffa17c33df21a4bcb2f0d3830e2c1a220ce01c7. Only claude-code-schedule.test.ts changes in this correction; no production, native contract, tier, baseline, allowance or dev-merge change. Branch tip independently confirmed. Read-only review; no Reviewer execution.

## Standards
M1 in A-4626 resolved. receipt() now races the actual work with a native 10s deadline, clears the owned deadline in finally, and never advances FakeClock. This is a bounded native socket/MCP timeout, not a sleep used to infer completion; its lint annotation states that boundary. queryCompleted still observes a persisted schedule write while yielding native I/O with fake time fixed.

Positive recovery polling follows the accepted recovery frame, advances one chosen 35000ms interval (30000ms directory floor plus at most one 5000ms liveness tick), then waits boundedly for the actual poll signal without moving fake time. The exact 29999+1 scheduler boundary and chosen negative advances remain unchanged. No advance-until-success loop remains. Other initial standards/source checks in A-4626 remain applicable: production adapter + shared FakeClock, replaced execFile including ps edge, fake infrastructure probes and in-process spoke, real transport deadlines, T2 header and sorted tier entry. No remaining findings.

## Spec
C1 verified. Initial declaration/semantic audit in A-4626 remains valid across the unchanged migration: default interval, idle quiet, shared snapshot reuse, null-PID handle stop, exact call/config counts, final watch cancellation, pre-latch admitted query and completed write, latch persistence across real store reopen, ordered sender dedup, signed-out running state, expired failures, journal/history/remedy content, explicit recovery, no auth/doctor and failed-turn latch negatives. Six retained native test bodies were independently byte-identical after the original three deletions. Native lifecycle proof remains there.

A-4629 supersedes A-4624 for corrected component timing/receipts. Five corrected raw component logs each show 3/3, zero failures/cancellations/skips; source-unchanged native contract retains its audited five 6/6 passes. Before five 9/9 passes remain disclosed. Subprocess-wall medians: 26.045s before; 17.947s native plus 0.533s component =18.480s after, 29.0% lower. These wall measurements are distinct from Node file duration/test-seconds. Component sampled load4.086; native earlier load6.845–7.981. Supplied corrected typecheck/tiers green, report-only lint lists new file T2 qualifying T2 with no new-file finding. No baseline rewritten.

Full source clear with findings []; C1 verified at this exact head. C2 remains unverified until normal mode-free exact-head droplet evidence arrives. Any standing Coordinator submission hold still applies. No per-item QA (none/after-stage).

Standards: 0 remaining findings. Spec: 0 remaining findings.

Durable review: A-4631.

Criteria: C1 verified.
