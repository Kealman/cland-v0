---
id: T-461
kind: task
title: Signed-out Claude latch test makes one extra CLI call after restart, on two Linux droplet runs (shared fix)
state: open
status: ready
size: S
criterion_seq: 1
labels:
  - v0.1.3
  - hub
  - ready-for-agent
assignee: null
parent: R-294
blocked_by: []
topic: topic-281
branch: t/T-461-claude-code-adapter-signed-out-watch
created: 2026-10-15T08:06:05.572Z
updated: 2026-10-15T10:12:49.048Z
---

## Summary

`hub/test/claude-code-adapter.test.ts:389` (the signed-out watch) counted 3 CLI calls where it expects 2, in T-455's gate 8052e04c (A-2746), 2026-10-15 07:58Z. The whole file passed 5/5 alone at a0ec44ea (A-2754). Under load, a schedule tick lands before the latch is observed. The test should count calls after the latch is in effect, or bound the count by the observed schedule.

## Acceptance criteria

- [x] C1. The count is taken against the observed latch, not wall time, and the file passes 5/5 beside a local full run.
  - done: impl-461 · 2026-10-15T08:30:46.903Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-461-3 · 2026-10-15T10:12:46.580Z · commit be2a70c2147b6377e1cade08f031ebcb9455b6a4

## Comments

### coord · 2026-10-15T08:24:29.140Z

Promoted to a v0.1.3 shared fix (Coordinator, 2026-10-15 08:24Z). The same test, 'accounts: a signed-out Claude directory is reported once, remains quiet across restart, and recovers only on explicit success', failed on Linux droplet runs on two branches: T-455 8052e04c (A-2746) and T-335 391d9b46 (A-2753). The macOS whole-file runs passed 5/5 (A-2754). Treat it as a Linux timing defect. The fix needs a droplet proof: the fix branch's diff-selected verify runs this file on Linux.

### impl-461 · 2026-10-15T08:25:52.295Z

Baseline targeted case passes locally (1/1, 6.75 s); A-2746 fails before restart and A-2753 fails after restart, both 3 !== 2. Existing fake agents-hold/agents-started/agents-finished receipts give a deterministic frame-boundary reproduction: admit a poll before authentication_failed, then release its call log after latching. Testing that controlled ordering before adjusting the count baseline.

### impl-461 · 2026-10-15T08:30:58.603Z

Implemented and pushed be2a70c2147b6377e1cade08f031ebcb9455b6a4. Deterministic pre-latch child gate reproduces the exact red count mismatch; baseline after observed child completion passes, with unchanged child PID assertions before/after restart. Five serial whole-file passes (45/45), including loaded runs beside impl-335 and impl-454; npm run typecheck and diff checks pass. Evidence: A-2779 diagnosis/local summary and A-2778 raw repetitions. Source review requested from reviewer, routed to rev-26. Awaiting clear source verdict before Linux diff-selected verify.

### rev-26 · 2026-10-15T08:32:11.293Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261015-461-source-1
commit: be2a70c2147b6377e1cade08f031ebcb9455b6a4
scope: full

No high or medium findings. hub/test/claude-code-adapter.test.ts:375 observes a real gated pre-latch agents child; :392–395 releases it and waits for its completion receipt before counting. Existing fake writes calls before finished. Exact count checks, polling windows, restart/deduplication and explicit-success recovery assertions remain; new PID equality checks exclude later child admission. No production/fake-harness changes.
A-2779 records deterministic exact 3 !== 2 red→green. Five whole-file runs pass 9/9 each; A-2778 queue snapshots show four starting under non-Coordinator local full runs and one starting quiet, explicitly allowed by Coordinator decision 6aaaa257. Do not claim five fully loaded files. C1 final mark remains pending accepted same-head Linux diff-selected proof required by the Coordinator; source-clear permits that verification. Typecheck reported green; no Reviewer tests run.

### impl-461 · 2026-10-15T09:11:51.889Z

Linux diff-selected proof 2bef23b0 at same reviewed be2a70c2: touched adapter file passes 9/9, signed-out test 8.84 s. Overall run failed (1716 pass, 1 fail, 3 skip) solely in executor-prepare.test.ts:165: TypeError reading lifetimeMs from an undefined executor-lease-released journal record. Log A-2810. Reported out-of-scope Bugs/S find and gate blocker to lead T-461, asked whether a shared fix exists or an unchanged-head rerun is wanted. No source changes or extra suite started.

### rev-26 · 2026-10-15T09:12:13.342Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261015-461-evidence-1
commit: be2a70c2147b6377e1cade08f031ebcb9455b6a4
scope: evidence

Medium — hub/test/executor-prepare.test.ts:165: untouched builder-delete recovery test dereferences undefined lifetimeMs journal record; TypeError blocks overall verification. No latch cause is inferred.
Same-head Linux hub-only receipt 2bef23b0/A-2810 reaches all nine changed-file adapter cases and all pass; signed-out latch case passes in 8.844s. Overall exits 1: 1720 tests, 1716 pass, 1 fail, 3 platform skips; Neovim smoke not reached. Droplet c-8 lon1/Linux, lifetime 1375s, cost $0.0955, peak load 13.16. Item-specific Linux proof is positive, but final accepted verification remains pending. No failed C1 mark for this unrelated case; keep the successful case evidence separate from the red receipt and await Coordinator direction before rerun.

### impl-461 · 2026-10-15T09:27:11.348Z

Coordinator flaky-rule decision d0492bf7 complete at unchanged clean be2a70c2: executor-prepare.test.ts run whole, serially five times, all 17/17 (85/85 total). Command: node --test hub/test/executor-prepare.test.ts. Durations 100.33 s, 96.81 s, 108.29 s, 105.72 s, 78.01 s. Project hub outage paused the runner after run 1; runs 2–5 resumed after reconnect, with no test failure. Queue captured before each; non-coord impl-454 suite remained visible, no local: coord. Raw stdout, timestamps, head and queue snapshots: A-2820. The red Linux receipt A-2810 remains preserved. Requesting renewed same-head clearance from rev-23 before the Coordinator-authorized single Linux resubmit.

### rev-23 · 2026-10-15T09:31:04.112Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-461-1
commit: be2a70c2147b6377e1cade08f031ebcb9455b6a4
scope: evidence

Source continuity and retry evidence at be2a70c2147b6377e1cade08f031ebcb9455b6a4. Standards: no new finding; the ten-line test-only patch retains exact counts, PID identity, restart and explicit-success recovery assertions. Spec: the baseline follows completion of the observed pre-latch child; fake-claude.ts:110 records the call before :114 writes agents-finished. This agrees with rev-26's source pass rev-20261015-461-source-1; branch tip remains identical.

Audited A-2820: five sequential standalone whole executor-prepare.test.ts invocations, 17/17 each, all exit 0 with no failures/skips/cancellations (85/85). The project hub outage pauses between repetitions 1 and 2; no test failed. Coordinator d0492bf7 explicitly permits one same-head Linux resubmit after this evidence, naming the unrelated journal race T-481.

This renews source/retry clearance only. Original Linux 2bef23b0/A-2810 remains red overall (1716 pass, one T-481 failure, three platform skips); the changed adapter file passed 9/9 there. C1 remains unverified until accepted same-head Linux verification. Do not treat this note as final gate clearance. No Reviewer tests run.
Evidence: A-2828.

### impl-461 · 2026-10-15T09:54:18.428Z

Single authorized retry a506e23a/A-2843 at unchanged be2a70c2 confirms adapter 9/9 and signed-out latch 8.694s; previous executor-prepare/T-481 case passes 6.381s. Overall red: 1716 pass, 1 fail, 3 skips. Sole failure is untouched crew-launch.test.ts:145, OpenCode keep_context=true pool moves to next worktree: expected unknown/unavailable brief but got pool size 1 reached. Reported Bugs/S find and gate blocker to lead, preserving first red 2bef23b0/A-2810 and five standalone executor passes A-2820. No source changes or third suite run; waiting for lead decision and reviewer final settlement.

### rev-23 · 2026-10-15T09:55:23.238Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-461-2
commit: be2a70c2147b6377e1cade08f031ebcb9455b6a4
scope: evidence

Medium — hub/test/crew-launch.test.ts:145: retained OpenCode pool test receives pool-size reached instead of the expected unknown/unavailable brief refusal. A-2843:3854–3868 records the sole assertion failure; it is outside T-461's one-file patch and Coordinator 7c2d4c4b tracks it in E-482's flake sweep.

Authorized unchanged-head Linux retry a506e23a/A-2843 remains red: 1720 tests, 1716 pass, one fail, three platform skips, exit 1; Neovim smoke not reached. The adapter file again passes 9/9 and the latch case passes 8.694s. Previous T-481 builder-release case passes 6.381s. Preserve first red 2bef23b0/A-2810, its positive adapter/latch evidence, and five serial executor-prepare passes A-2820.

Directly read Coordinator decision 7c2d4c4b-5410-402d-81f2-1feb41258aec accepts both Linux adapter/latch proofs and requires one unchanged-head local merge gate, avoiding another Linux retry. That local run 99409d4b is now running at be2a70c2147b6377e1cade08f031ebcb9455b6a4. C1 remains unverified until its accepted result. Source clearance remains unchanged; this evidence verdict does not authorize further resubmissions. No Reviewer tests or changes.
Review evidence: A-2846.

### impl-461 · 2026-10-15T10:12:18.050Z

Coordinator-directed unchanged-head local merge gate 99409d4b/A-2860 passed: 1732/1732, zero failures/skips/cancellations, including Neovim smoke. Head remains clean be2a70c2147b6377e1cade08f031ebcb9455b6a4. Linux file proof remains adapter 9/9 and latch green in both droplet runs: 2bef23b0/A-2810 (overall red solely T-481) and a506e23a/A-2843 (overall red solely T-484 crew pool race). Coordinator disposition 7c2d4c4b and standing gate rule cb6eaf4c authorize this local merge gate with those Linux proofs. All receipts preserved; awaiting rev-23 final settlement, no more tests or source changes needed.

### rev-23 · 2026-10-15T10:12:46.580Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-461-3
commit: be2a70c2147b6377e1cade08f031ebcb9455b6a4
scope: evidence

Final evidence clear at unchanged be2a70c2147b6377e1cade08f031ebcb9455b6a4; no high/medium finding remains in T-461.

C1: source review rev-20261015-461-source-1 and continuity review rev-2026-10-15-461-1 establish that the count follows the observed pre-latch child completion, while exact count/PID checks, restart quietness and explicit-success recovery remain. A-2779 records deterministic 3 != 2 red→green; A-2778/raw local repetitions and the earlier source review record 5/5 whole files (9/9 each). One starts quiet and overlaps the next full run; do not claim five fully loaded files. Direct Coordinator 6aaaa257 permits that labelled quiet remainder.

Linux file evidence is positive in both overall-red receipts: 2bef23b0/A-2810 adapter 9/9, latch 8.844s, sole outside failure T-481; authorized retry a506e23a/A-2843 adapter 9/9, latch 8.694s, sole outside failure crew-launch:145 now T-484 in E-482. Both overall results remain red with three platform skips each. A-2820's five serial executor-prepare files pass 85/85 and supported the one retry; it did not make either Linux gate green.

Direct Coordinator 7c2d4c4b accepts those two Linux file proofs and orders the unchanged-head local merge gate. That gate 99409d4b/A-2860 passes typecheck, all hub shards and Neovim smoke: 1732/1732, zero failures/skips/cancellations, exit 0. It selected hub-only, not full Neovim. Local darwin arm64, Node v24.21.0, Neovim v0.12.5; 1037.62s. Branch remains exactly reviewed. C1 verified under those recorded evidence rulings. No Reviewer tests or source changes.
Review evidence: A-2861.

Criteria: C1 verified.
