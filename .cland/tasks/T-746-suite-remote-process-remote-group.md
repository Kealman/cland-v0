---
id: T-746
kind: task
title: "suite-remote-process: 'remote group started' misses its 15 s bound on dev (1 in 5 on the Mac)"
state: open
status: ready
size: M
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
topic: topic-457
branch: t/T-746-suite-remote-process-remote-group
created: 2026-10-17T17:23:11.458Z
updated: 2026-10-17T19:45:11.819Z
---

## Summary

impl-742's alternating comparison (T-742, 2026-10-17 17:22Z) reproduced `hub/test/suite-remote-process.test.ts` failing on origin/dev at line 52, `f.remote(a.id)`, with "remote group started: not within 15000 ms" (26.8 s), in 1 of 5 whole-file runs at load below 4. Dev's passing runs took 17.5–19.3 s per file. At T-742's head the same file passed 5/5 in 9.5–10.7 s, so T-742's release and accounting change may remove the cause. Check this after T-742 merges.

## What to build

After T-742 lands, rerun the file 20× whole-file on the Mac. If it still fails, replace the 15 s real-time wait for "remote group started" with the hub's own start receipt, driving the fixture's clock if it uses one, and keep the assertions. If T-742 fixed it, record the 20× evidence and close this as covered.

## Acceptance criteria

- [x] C1. suite-remote-process.test.ts passes 20/20 whole-file on the Mac at dev after T-742, with its assertions unchanged, or with the fix named.
  - done: impl-746 · 2026-10-17T19:43:43.498Z
  - verified: rev-30 [reviewer] · run rev-20261017-746-source · 2026-10-17T19:45:11.112Z · commit c949d19d411449c8f087de4ab1d0b7eb27b7bd32

## Comments

### coord · 2026-10-17T18:39:34.258Z

Same signature in a second file: suite-close-recovery.test.ts "a sharded close handles restart with one result and confirmed cleanup" failed at line 19 with "remote group started: not within 15000 ms" in T-748's run f6262d9d (A-4699, branch base before T-742). The fix should cover every caller of the remote-group start wait, not just suite-remote-process.

### coord · 2026-10-17T19:20:44.130Z

Widening: the same class of wall-bound remote-fixture waits fails on loaded droplets in several files, not only the "remote group started" wait.
- Integrated cover dfcc6b36 (A-4709, classified load-flake): five failures.
  - executor-run.test.ts startReplyLost and startMarkerOnly.
  - suite-close.test.ts "integrated remote close collects each map…", failing with "already has a suite queued or running".
  - suite-close-recovery.test.ts "a sharded close handles restart…", failing on "remote group started".
  - session-native-lifecycle (codex, keep_context=false).
- T-748's run 29716dcc (A-4710): suite-close "occasion refuses implementers…" failed with "shard-2: machine readiness deadline reached".
All of these pass 3/3 on the Mac at dev. Fix scope: every scripted-remote fixture wait (group start, machine readiness, release) uses hub-clock receipts or a load-scaled bound instead of a fixed wall-clock deadline. Size grows to M.

### impl-746 · 2026-10-17T19:23:50.913Z

Baseline reproduced locally at load 2.5: suite-remote-process failed remote group started at 15000 ms (17.7 s file). Shared fixture now gives real SSH readiness and cleanup load-scaled budgets and routes receipt waits in all four callers through the same scaling. Existing fake-clock readiness/release deadlines remain virtual; no sleeps or assertions added/removed. First fixed run passed in 11.0 s. Typecheck and tier lint pass; serial 20x/10x evidence in progress.

### impl-746 · 2026-10-17T19:43:43.865Z

Committed and pushed c949d19d. A-4714 holds baseline red, fix details, every serial log and sampled load: remote-process 20/20; suite-close, suite-close-recovery, executor-run 10/10 each; typecheck and tiers green. No assertions or sleeps changed. Final fetch/merge already current. QA scope none; requesting source review before exact-head droplet verify.

### rev-30 · 2026-10-17T19:45:11.112Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-746-source
commit: c949d19d411449c8f087de4ab1d0b7eb27b7bd32
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-746 full source review — clear

Exact headc949d19d411449c8f087de4ab1d0b7eb27b7bd32, fixed parent/base816108c385364ea9604b5fe3d52e3c38af1027f0. One five-file test/helper commit, no production/budget/tier change. T-742 merge5f32c1cb independently confirmed ancestor. Read-only review, no Reviewer execution or delegation.

## Standards
No findings. Existing native worker tests retain T3 lifecycle reasons and real process ownership/cleanup. The helper computes one finite failure budget at each wait from testWaitMs(base) × max(1,one-minute-load/availableParallelism), rounded up. It does not repeatedly extend a deadline, advance FakeClock, add a sleep, or delay a successful observation. Existing positive test wait override is applied once; eventually receives the computed explicit bound.

Real process fixture readiness/cancel/release bases become10s, scaled by sampled work per CPU; group/result defaults30s. Explicit20s downstream waits retain their base and gain scaling. The one real watchdog-stop500ms override gains the same scaling. Scripted-machine readiness200ms and cleanup500ms stay virtual and unchanged; explicit env overrides still win. Product run/lifetime/accounting windows are unchanged, including T-742's120s pending-accounting rule.

## Spec / receipts
No findings. Coordinator scope widening was read in task comments: every scripted-remote group/readiness/release wait may use hub-Clock receipts or a load-scaled bound. This implementation chooses scaled bounds for real SSH/workers and retains existing fake-clock policy for scripted machines.

f.remote still observes the actual per-run pgid receipt and owns that process; f.result still observes the exact suite:id result in the intended topic. Callers keep the same barrier/done/state/queue/PID-gone observations. Released workers are observed done before downstream result waits; concurrency assertions remain before release. Rule9/10/12 boundaries are retained rather than replaced by elapsed sleeps. Each stage has its own bound.

Independent comparison of all assertion-bearing lines in the four changed tests matches the base exactly: remote-process9,close62,recovery10,executor76 lines. Complete hunks were reviewed: only imports/timeout selection changed, plus the real watchdog-stop override. No test/permutation/claim removed or assertion weakened. Explicit real worktree/remote exit/accounting-failure/slot release/provisioning/cancel/restart/coverage and cleanup proofs remain.

Local-import search across hub/test and nvim/test finds shared remote-fixture consumers, no Neovim importer; other fixture readers were inspected for deadline-policy assertions. Deliberate timeout/release tests use scripted FakeClock/explicit environment overrides, which stay authoritative. Existing native demo setup overrides are retained. Actual run/lifetime/watchdog expiry assertions are not changed. Broader shared-helper compatibility still needs the normal task verification; the source review does not claim every reader ran locally.

## Supplied Mac evidence
A-4714 baseline.log reproduces the original remote-group15000ms signature after the T-742 base: one-case file fails17.717769250s. No claim that T-742 alone removes it. Supplied first green10.97s is exploratory; final evidence is the distinct serial receipt set.

All52 accepted whole-file invocation logs independently parsed against receipts.json:
- suite-remote-process20/20,onecase/run,wall7.577–8.741s,peakload5.19385;
- suite-close10/10,fourcases/run,17.991–19.215s;
- suite-close-recovery10/10,threecases/run,15.686–17.397s;
- executor-run10/10,18reportedtests/run including nested fault cases,61.577–64.814s;
- remote-scripted2/2cases and close-component3/3cases each one whole-file smoke.
275reported passes total,zero failures/cancellations/skips. Samples are serial fresh Node processes at supplied250ms load sampling below15. These are current Mac observations, not proof against every future load pattern or a fresh Linux measurement. Report identifies exact committed source/base; no per-sample commit stamping is invented.

Supplied typecheck and test:tiers green (43hubfree/237machine),diff checkgreen. No new test is needed merely to mirror the arithmetic; the real receipt and fake-clock regression files supply meaningful coverage.

C1 verified: post-T-742 Mac20/20 with the named bounded-wait fix and preserved assertions. Source clear; Standards0/Spec0 findings. Exact-head normal mode-free droplet verification remains required before final runtime verdict. No per-item QA.
Durable review A-4715.

Criteria: C1 verified.
