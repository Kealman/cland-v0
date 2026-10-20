---
id: T-963
kind: task
title: thread.test.ts "200 message rewrites and steady-state appends…" fails its 8× append/rewrite ratio under droplet load (7.1 vs 51.5 ms)
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
  - flaky
  - nvim
assignee: null
parent: E-952
blocked_by: []
topic: topic-736
branch: t/T-963-thread-test-ts-200-message-rewrites-and
created: 2026-10-20T11:01:06.089Z
updated: 2026-10-20T11:18:46.704Z
closed: 2026-10-20T11:18:46.704Z
---

## Summary

The T2 Neovim cost test `nvim/test/thread.test.ts:692` failed in an unrelated task verify: T-958, run 2ac4658e at fd8b08b1, Linux droplet c-8, 2 workers, log A-7534. The failure was "append 7.095999999999991 ms vs rewrite 51.48400000000009 ms". The assertion requires `append * 8 <= rewrite`, and a ratio of 7.25 failed it. The test takes medians of only 9 append and 5 rewrite samples, CPU time, under parallel load. The comment says the eightfold advantage holds "even on a heavily loaded host", and this run disproves that.

## What to build

Make the incremental-cost claim robust to load without losing its meaning. Options include more samples, a ratio derived from a measured distribution, comparing operation counts instead of time (parses, line writes), or moving the timing claim to the explicit benchmark (CLAND_RENDER_BENCHMARK). Rule 9 applies: assert on the durable receipt of the boundary (work done) rather than elapsed time, where possible.

## Acceptance criteria

- [x] C1. The test's pass/fail no longer depends on CPU timing ratios under load, or its timing claim is reasoned and moved to the unloaded benchmark; the evidence states which.
  - verified: rev-31 [reviewer] · run rev-20261020-963-source · 2026-10-20T11:09:42.319Z · commit 8203f0cad0c8ebf0961f0687daf8404bed8993a5
  - verified: rev-31 [reviewer] · run rev-20261020-963-final · 2026-10-20T11:14:06.037Z · commit 8203f0cad0c8ebf0961f0687daf8404bed8993a5
  - done: impl-963 · 2026-10-20T11:14:25.225Z
- [x] C2. It still fails when append regresses to a full rewrite (a scratch mutation that re-renders on append turns it red).
  - verified: rev-31 [reviewer] · run rev-20261020-963-source · 2026-10-20T11:09:42.319Z · commit 8203f0cad0c8ebf0961f0687daf8404bed8993a5
  - verified: rev-31 [reviewer] · run rev-20261020-963-final · 2026-10-20T11:14:06.037Z · commit 8203f0cad0c8ebf0961f0687daf8404bed8993a5
  - done: impl-963 · 2026-10-20T11:14:26.340Z
- [x] C3. 20/20 sequential file runs pass, plus the same-head task gate.
  - verified: rev-31 [reviewer] · run rev-20261020-963-final · 2026-10-20T11:14:06.037Z · commit 8203f0cad0c8ebf0961f0687daf8404bed8993a5
  - done: impl-963 · 2026-10-20T11:14:27.866Z

## Comments

### impl-963 · 2026-10-20T11:05:37.238Z

Implementation replaces default timing gate with synchronous nvim_buf_attach line receipts for 200 appends: one unique-body parse, four-line insertion at the tail, ten-line eviction at row 0, final 200-message retention. Warm rewrites still require zero parses; eightfold CPU ratio moves to explicit unloaded benchmark alongside existing absolute limits. Disposable rewrite-on-append mutation failed at append 1: actual [[0,2000,2004],[0,10,0]], expected [[2000,2000,2004],[0,10,0]]. Initial local macOS direct T2 file run passed 23/23 and hub/Neovim typechecks passed; these are targeted checks, not the same-head task gate. Preparing 20 sequential file runs.

### impl-963 · 2026-10-20T11:09:38.411Z

At head 8203f0cad0c8ebf0961f0687daf8404bed8993a5 (tree 8df14eb8), A-7540 records 20/20 sequential local darwin/arm64 direct T2 file runs: 23 tests/run, 460 test executions, no skips. Repetitions started at load1=2.41 and local queue none. Scratch rewrite-on-append mutation fails at append 1's actual line write even with zero warm reparses. History-aware test lint has zero refusals; Neovim typecheck exited 0. Source review requested from reviewer role in topic-736; mode-free same-head task gate remains pending source clearance. Evidence directory: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7540-t-963-20-sequential-file-runs-and-full-rewrite-mutation-evidence.

### rev-31 · 2026-10-20T11:09:42.319Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-963-source
commit: 8203f0cad0c8ebf0961f0687daf8404bed8993a5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7543: source clear. Default gate uses synchronous parse/buffer-mutation receipts over 200 appends; timing ratio/absolute caps remain only in explicit unloaded benchmark. A-7540 scratch full-rewrite mutation fails first line receipt despite cached parses; C1/C2 verified. Twenty direct local Mac whole-file runs pass 460/460 with matching source hashes and sealed fixture recipe; C3 awaits green same-head mode-free task gate. No benchmark or duration-enforced pass claimed.

Criteria: C1 verified, C2 verified.

### impl-963 · 2026-10-20T11:13:53.616Z

Same-head mode-free task verification 3f88aeb7-9011-4163-bfd4-bcb0e622e897 passed at 8203f0cad0c8ebf0961f0687daf8404bed8993a5: host check plus all T1/selected Neovim T2, 902/902 tests, no failures/cancellations/skips. Log A-7548. Executor droplet c-8 lon1, Linux x64, workers 2; lifetime 181 s, cost $0.0126. Duration budgets and T3 ratchet were report-only; T3/T4 did not run. T3 is deferred to periodic dev/integrated occasions under the enabled queue. Reviewer has the same-head result for final C3 verification and verdict.

### rev-31 · 2026-10-20T11:14:06.037Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-963-final
commit: 8203f0cad0c8ebf0961f0687daf8404bed8993a5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7549: final clear. C1/C2 established by work-receipt source/mutation review A-7543; C3 combines audited 20/20 local Mac complete file runs (460 passes, A-7540) with exact-head 3f88aeb7/A-7548 host/T1/Neovim T2 green 902/902. All 23 thread cases pass; changed case 1.215428737 s; no owned resource/duration failures. Unchanged title creates no new load group. Five inherited report-only baseline gaps are preserved; CPU measurements are diagnostics, no benchmark or T3/T4 pass claimed.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T11:18:46.704Z

Merged 11df5ae6881c7b9f8c8f52f987a6a4b57409fbc2 onto dev.
