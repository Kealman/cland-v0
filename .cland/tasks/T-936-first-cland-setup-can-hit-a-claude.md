---
id: T-936
kind: task
title: First cland setup can hit a Claude .claude.json lock timeout; a delayed rerun succeeds
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-690
branch: t/T-936-first-cland-setup-can-hit-a-claude
created: 2026-10-20T05:13:34.457Z
updated: 2026-10-20T05:32:21.882Z
closed: 2026-10-20T05:32:21.882Z
---

## Summary

E-613's DoD demo (qa-676, run qa-2026-10-20-2, release candidate 824105c5; evidence A-7031, report A-7033) ran `cland setup` in an isolated HOME with real Claude Code 2.1.304. The first run failed its Claude trust step on a `.claude.json` lock timeout; the holder was not identified. One rerun about 10 s later succeeded. Setup should not fail a newcomer's first run on a transient lock.

## What to build

Find what holds the `.claude.json` lock during setup's Claude step (setup's own earlier step, the probe, or Claude Code itself) from a reproduction in an isolated HOME. Then remove the self-contention, or retry the lock with a bounded backoff and a clear message naming the lock if it still times out.

## Acceptance criteria

- [x] C1. The lock holder during the first setup run is named from a reproduction, or the evidence says why it cannot be reproduced.
  - done: impl-936 · 2026-10-20T05:17:16.602Z
  - verified: rev-31 [reviewer] · run rev-20261020-936-source · 2026-10-20T05:21:12.656Z · commit 21457f8b9557e4767e64ebb444540365e94d774a
  - verified: rev-31 [reviewer] · run rev-20261020-936-final · 2026-10-20T05:28:06.627Z · commit 21457f8b9557e4767e64ebb444540365e94d774a
- [x] C2. Setup's Claude trust step survives a held `.claude.json` lock that is released within its retry window (a T2 test with a fake lock holder), and reports the lock path and holder when the window runs out.
  - done: impl-936 · 2026-10-20T05:17:17.314Z
  - verified: rev-31 [reviewer] · run rev-20261020-936-source · 2026-10-20T05:21:12.656Z · commit 21457f8b9557e4767e64ebb444540365e94d774a
  - verified: rev-31 [reviewer] · run rev-20261020-936-final · 2026-10-20T05:28:06.627Z · commit 21457f8b9557e4767e64ebb444540365e94d774a
- [x] C3. A mode-free `cland verify` at the reviewed head is green.
  - done: impl-936 · 2026-10-20T05:27:39.436Z
  - verified: rev-31 [reviewer] · run rev-20261020-936-final · 2026-10-20T05:28:06.627Z · commit 21457f8b9557e4767e64ebb444540365e94d774a

## Comments

### impl-936 · 2026-10-20T05:17:16.591Z

Implemented at 21457f8b9557e4767e64ebb444540365e94d774a. Scratch-only Claude 2.1.304 reproduction identifies `auth status --json` as the orphan lock creator; PID exited, directory empty. Retry now outlasts 10s stale threshold with 15s bounded backoff; refreshed lock timeout reports exact path, elapsed/window and unknown holder. Evidence A-7069 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7069-t-936-auth-status-orphan-reproduction-and-retry-regression-evidence/report.md. Targeted 34/34 tests and npm run check pass. Source review requested next; C3 pending same-head hub verification. No merge request.

### rev-31 · 2026-10-20T05:21:12.656Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-936-source
commit: 21457f8b9557e4767e64ebb444540365e94d774a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings; A-7086. Scratch-only raw reproduction identifies auth status as orphan creator, not a live holder. Verified later Coordinator decision preserving existing stale reclaim/atomic write and probe order. New FakeClock T2 regressions prove release after six seconds, unchanged >10s stale threshold, and exact 15s refreshed-lock timeout with path/unknown holder while preserving data. C1/C2 verified; C3 awaits same-head configured mode-free verify and three new identities 5/5.

Criteria: C1 verified, C2 verified.

### impl-936 · 2026-10-20T05:27:50.251Z

C3 complete at unchanged source-reviewed 21457f8b9557e4767e64ebb444540365e94d774a. Mode-free run bb34c5b9-0c3d-44c2-b00d-6e0494e49dcc passed 1923/1923, no failures/skips; A-7094. Confirmed all three new setup-trust-lock identities have actual 5/5 passed receipts at A-7094 lines 46868, 46875, 46971. Linux x64 / Node 24.21.0 / Neovim 0.12.5, droplet lifetime 340s, $0.0236. T3 deferred to periodic/integrated occasions under configured task tiers. Final Reviewer verdict pending; no merge enqueue.

### rev-31 · 2026-10-20T05:28:06.627Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-936-final
commit: 21457f8b9557e4767e64ebb444540365e94d774a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-7096 independently audits complete A-7094 / bb34c5b9 at unchanged reviewed head. 1923 ordinary plus fifteen distinct repetitions pass; all three new identities 5/5, max 0.014045596 s. Existing trust 11/11 and setup-flow 20/20 pass; host check/all T1/fallback all T2 green, no tier mismatch or hard budget failure. C1–C3 verified and claimant done; diagnosis/native proof remains A-7069. No merge action.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T05:32:21.882Z

Merged 63d11188ab335ae0a1259afd356493405fb70276 onto dev.
