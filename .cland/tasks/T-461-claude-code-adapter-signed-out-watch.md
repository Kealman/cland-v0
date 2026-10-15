---
id: T-461
kind: task
title: Signed-out Claude latch test makes one extra CLI call after restart, on two Linux droplet runs (shared fix)
state: open
status: in progress
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
updated: 2026-10-15T09:12:13.342Z
---

## Summary

`hub/test/claude-code-adapter.test.ts:389` (the signed-out watch) counted 3 CLI calls where it expects 2, in T-455's gate 8052e04c (A-2746), 2026-10-15 07:58Z. The whole file passed 5/5 alone at a0ec44ea (A-2754). Under load, a schedule tick lands before the latch is observed. The test should count calls after the latch is in effect, or bound the count by the observed schedule.

## Acceptance criteria

- [x] C1. The count is taken against the observed latch, not wall time, and the file passes 5/5 beside a local full run.
  - done: impl-461 · 2026-10-15T08:30:46.903Z

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
