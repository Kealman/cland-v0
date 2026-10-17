---
id: T-755
kind: task
title: Integrated dev covers run about 55% slower than task full runs of the same code
state: open
status: review
size: S
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
  - needs-triage
assignee: null
parent: E-482
blocked_by: []
topic: topic-458
branch: t/T-755-integrated-dev-covers-run-about-55
created: 2026-10-17T20:04:48.908Z
updated: 2026-10-17T20:22:32.905Z
---

## Summary

Two integrated covers at dev 1c766f2f/b5400af ran 2741 s and 2750 s (A-4709, A-4720), against 1759 s for cover a190eaf9 an hour earlier (A-4695). Per-file times rose 1.5–3×: inbox-workload "archive startup…" took 25 s, then 67 s and 73 s. Both went red on wall-bound remote-fixture waits (T-746). T-748's full task run 718eb39d of nearly the same tree (dev plus T-748's tripwire) ran 1669 s and green at the same time on another droplet. So this isn't the code alone, and it isn't region-wide noise. Peak 1-minute load stayed under 8.

## What to build

Find what makes an integrated cover slower than a task run of the same tree. Candidates: coverage capture (NODE_V8_COVERAGE) when the coverage map is refreshed, the integrated-cover worker or environment setup, the occasion or full-mode differences, or droplet CPU steal. Compare the two slow logs with a190eaf9 and 718eb39d phase by phase. Fix the cause, or make covers run like task runs.

## Acceptance criteria

- [ ] C1. The cause is named with evidence (A-4721), and the task's droplet verify at the reviewed head passes the scripted-provider and remote-fixture regressions that deliver the receipt and the tmpfs temp root or its fallback; the live host receipt is checked in T-756 after merge and hub restart.
- [x] C2. Each droplet run records bounded fsync and SQLite timings, the run's iowait and steal deltas, and the capped tmpfs fixture-root outcome or an explicit disk fallback in its result header and journal, with scripted-provider and remote-fixture regressions covering receipt propagation and the temp-root fallback.
  - done: impl-755 · 2026-10-17T20:21:49.212Z
  - verified: rev-30 [reviewer] · run rev-20261017-755-source-correction · 2026-10-17T20:22:20.467Z · commit 76f78ec26770700f9dd6c1fd56064e77e9c92ce2

## Comments

### impl-755 · 2026-10-17T20:07:56.716Z

Investigation evidence in A-4721 (topic-458): all four runs compared phase by phase and 320 file rows. Slowdown localizes to disk-backed persistence: unchanged store migration 10–13x slower, in-memory siblings ~1.3x. Identical cover launch script/policy, same slow-cover candidate tree, fast cover also captures coverage; local capture differential does not recreate disk signature. Exact device/sync mechanism is unmeasured; requested Coordinator decision before a nontrivial executor probe/tmpfs change. C1 not done: fresh same-tree post-fix comparison still needed.

### impl-755 · 2026-10-17T20:16:09.757Z

Implemented and pushed 8b6b5c9e0fb17bf6cee51506abba4bb9db26768c; review requested from responsible Reviewer in topic-458 and delivered. Review evidence A-4725; five-run receipts A-4723. Typecheck, tier lint, shell syntax and diff checks pass; 3 changed/new test files each 5/5; existing executor-run 18/18 in 69.04s. Coordinator moved live-host receipt and within-15% comparison to T-756; C1 now awaits candidate regression receipts in same-head droplet verify after source clearance. C2 done. No QA required by current policy.

### rev-30 · 2026-10-17T20:19:10.281Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-755-source
commit: 8b6b5c9e0fb17bf6cee51506abba4bb9db26768c
scope: full
findings: [{"severity":"medium","text":"Preserve identified per-shard health through aggregate results, journals and cache/recovery. #collectShards concatenates all child logs, but machineHealthFromLog keeps only the last receipt, so #inspect stores that child's measurements as the parent's single health value. suite-result and verification-timing journal entries expose this unlabeled value; cache reuse copies it without the shard collection and loses the other machines from the result header. Two distinct child receipts must remain attributable through those paths.","file":"hub/src/hub/suites.ts","line":823}]
finding_counts: {"high":0,"medium":1,"low":0}

Medium M1 — hub/src/hub/suites.ts:823: concatenated sharded logs are parsed into one last-child health value; aggregate persistence/journals and cached headers lose per-machine attribution. Retain identified per-shard receipts through aggregate, cache and recovery, with two distinct-machine regression coverage. Full source/evidence audit: A-4726. C2 failed; C1 remains unverified pending corrected source and exact-head droplet evidence. Coordinator-authorized T-756 live-host/performance deferral is respected.

Criteria: C2 failed (Aggregate/cache/journal health loses identified per-shard measurements; retain both machines through persistence and recovery.).

### impl-755 · 2026-10-17T20:21:55.065Z

M1 corrected and pushed at 76f78ec26770700f9dd6c1fd56064e77e9c92ce2; fresh review request delivered to responsible Reviewer. A-4728 explains identified per-shard persistence/journal/cache/header/recovery; A-4727 contains revised 5/5 checks for all three health files. New two-machine scripted regression reproduced M1 red before the fix, now green; cache suite 10/10; typecheck/tier/diff checks green. No dev merge after first source review, and no verification at rejected head.

### rev-30 · 2026-10-17T20:22:20.467Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-755-source-correction
commit: 76f78ec26770700f9dd6c1fd56064e77e9c92ce2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

No remaining findings. M1 fixed: identified completed shardHealth survives aggregate result/timing and result journals, cache/header and receipt-only recovery; parents no longer reduce heterogeneous machine logs as one sample. The two-distinct-machine regression checks those paths, retaining single-machine behavior. Source audit and targeted evidence limits: A-4729; prior full assessment A-4726. C2 source-verified. C1 remains unverified pending exact-head diff-selected droplet evidence; live-host receipt/performance comparison remains T-756 after merge/restart under Coordinator disposition.

Criteria: C2 verified.

### impl-755 · 2026-10-17T20:22:32.905Z

Source review clear at 76f78ec26770700f9dd6c1fd56064e77e9c92ce2 (A-4729). Submitted mode-free droplet verification 69eab775-0eda-4654-bb27-094e6d34165b at that exact clean head, result in topic-458 to Reviewer/item lead/Coordinator. C1 remains pending runtime receipt. Going idle without head changes.
