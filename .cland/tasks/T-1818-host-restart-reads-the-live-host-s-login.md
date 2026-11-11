---
id: T-1818
kind: task
title: host-restart reads the live host's login file before its tunnel is up after restart
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
regression_of: T-1793
found_by: droplet
topic: topic-1483
branch: t/T-1818-host-restart-reads-the-live-host-s-login
created: 2026-11-11T19:32:48.950Z
updated: 2026-11-11T20:47:28.056Z
closed: 2026-11-11T20:47:28.056Z
---

## Summary

`hub/test/host-restart.test.ts::restart keeps the live host and exits the deleted host, settles spend, and restores watchdog ownership` failed on periodic dev T3 run 24f075af at e744bc339 (Linux droplet, A-18857) with `Error: host host-…: tunnel is not up` from `ssh-host.ts` `check` via `readFile`, at host-restart.test.ts:107. That line is T-1793's C2 proof: right after the hub reopens, it reads the live host's login file through `liveHost.readFile`, but the reopened hub's SSH tunnel to that host may not be up yet. The same case passed in A-18798, A-18810 and A-18814 (10.5–12.0 s). It is a setup race in the test, not a product defect: the restart restores the tunnel asynchronously.

## What to build

Before the C2 read, wait with a named setup bound (`eventually` with `SETUP_MS`) for the reopened live host to be reachable, through the Host's own readiness signal (tunnel up or `loginDiskReachable()`), never a sleep. Then read the file and keep every existing assertion. Don't weaken the proof that the post-restart mounted disk holds the exact rotated bytes.

## Acceptance criteria

- [x] C1. The case waits for the reopened live host's tunnel or disk readiness through a named bounded wait before `readFile`, and every existing assertion is kept (test).
  - done: impl-1818 · 2026-11-11T19:34:58.255Z
  - verified: rev-36 [reviewer] · run rev-36-1818-final-1 · 2026-11-11T20:01:30.470Z · commit 0679105b1205c8421377272b364756af332cce73
- [x] C2. The case passes five lone repetitions on macOS at the fix head, and the Linux run of the mode-free verify passes it, both recorded in an item comment.
  - done: impl-1818 · 2026-11-11T19:59:11.456Z
  - verified: rev-36 [reviewer] · run rev-36-1818-final-1 · 2026-11-11T20:01:30.470Z · commit 0679105b1205c8421377272b364756af332cce73

## Comments

### impl-1818 · 2026-11-11T19:34:35.375Z

Pre-fix red evidence: A-18857, periodic dev T3 24f075af at e744bc339 on Linux droplet, Error: host host-…: tunnel is not up from ssh-host check via readFile at host-restart.test.ts:107. Local macOS baseline at e744bc339 passed once (8.492 s case); race is intermittent. Fix 0679105b1 waits on the reopened Host's loginDiskReachable() via eventually/SETUP_MS before readFile, retaining every assertion. Rule 20: no shared contract changes; only this test and its per-test guidance change.

### impl-1818 · 2026-11-11T19:36:29.782Z

At pushed fix head 0679105b1, case `restart keeps the live host and exits the deleted host, settles spend, and restores watchdog ownership` passed five lone fresh Node processes on macOS arm64 Node v24.21.0 under preservation lock; samples 9.653416209, 8.539985833, 11.810234083, 9.26198125, 9.324013125 s (includes fixture setup/cleanup). Each producer exit 0, tests=1 pass=1 fail/cancelled/skipped/todo=0. Load1 <4. No browser; fake provider/transports/harness only. A-18863 durable evidence folder /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-18863-t-1818-macos-five-lone-host-restart-receipts-at-0679105b1 contains logs and full TMPDIR inventories/delta, secret-scanned before publication with positive control. TMPDIR unchanged; /tmp hc roots unchanged (seven pre-existing), no new hc roots. Ten short cland-h aliases appeared. Hub typecheck, diff whitespace and closed-item wording lint passed. Existing 31 s report-mode allowance retained, no new test identity. Source review requested from Reviewer; Linux mode-free verify pending source verdict. Remaining full T3 is merge-batch evidence, T4 stage/epic evidence.

### rev-36 · 2026-11-11T19:37:14.496Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1818-source-1
commit: 0679105b1205c8421377272b364756af332cce73
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

SOURCE CLEAR, A-18865; Standards 0 / Spec 0. Complete two-file diff adds only named eventually/SETUP_MS Host readiness before readFile plus matching QA guidance; all exact rotated-byte, binding/native and terminal destroyed assertions retained. No production/shared contract/tier/duration/resource-owner change. Existing case31s allowance unchanged. A-18863 local five lone macOS samples/supporting producer limits retained; Linux half of C2 unexecuted. C1/C2 runtime-unverified pending exact-head configured evidence; do not mark C2 complete before its Linux pass. No Reviewer execution. Submit mode-free verify at pinned head; final named receipts and item comment required. Per-item QA none, stage documentation committed; broader T3/T4/QA unclaimed.

### coord · 2026-11-11T19:38:29.975Z

The periodic culprit search for 24f075af labels host-restart "already-fixed on dev at 7d50d44b3" because its three failing-file reruns passed (fcdd1a67 at e744bc339, 11.6 s; ea93ede7 at 6aa8c95df, 9.6 s; 5d9dee99 at 7d50d44b3, 9.5 s). No commit since e744bc339 changes the readiness of the reopened live host before line 107's read, so those passes are the race's normal outcome, not a fix. This item stays open and its fix lands as planned.

### impl-1818 · 2026-11-11T19:59:11.282Z

C2 complete on unchanged source-reviewed head 0679105b1205c8421377272b364756af332cce73, tree 29e49e0948f48795b1fa671dd91083dfa7e42323. macOS five lone fresh-process passes are recorded above in A-18863. Linux mode-free run 8046292f-8857-4ead-b51a-2ff3674e5b22 / A-18872 exit 0: 6116/6116 pass, no failures/cancellations/skips/todo. T0, all T1, fallback all T2, changed T3 (one file/one case), Web completed; full T3 remains merge-batch evidence and T4 stage/epic evidence. Generated case `hub/test/host-restart.test.ts::restart keeps the live host and exits the deleted host, settles spend, and restores watchdog ownership` has explicit finish outcome pass, seconds 9.816254191 (log lines 32125–32127), in addition to phase exit 0. Actual one base execution, no Linux repetitions; case duration includes setup and cleanup. Executor droplet c-8 lon1, Linux x64 6.8.0-147-generic Node24.21.0; browser Chrome Headless Shell revision1248, Google Chrome for Testing156.0.8078.4. Duration/lint budgets report-only, including reported unrelated regressions; no enforce claim. Droplet lifetime1163s, cost$0.0808. No source changes after review; clean tree.

### rev-36 · 2026-11-11T20:01:30.470Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1818-final-1
commit: 0679105b1205c8421377272b364756af332cce73
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

FINAL CLEAR, A-18876; Standards 0 / Spec 0, C1-C2 verified. Same-head 8046292f/A-18872 exit0, exact generated host-restart finish pass9.816254191s and file pass10.799471409s; T0/allT1/fallbackT2/changedT3/Web complete,6116 base tests/676 files plus125 separate load tests, no fail/cancel/skip. Five original macOS lone passes A-18863 independently read; A-18874 links fixed commit, argv/cwd/Node24.21/Darwin, synchronous per-child status guards and parent session75581 completion exit0. Uncaptured signal/PID/hash/absolute execPath and pre-run architecture remain unknown; no provenance rerun. Required both-platform item comment and done marks present. Source wait preserves all exact byte/native/binding/destroyed assertions;31s allowance unchanged. Exportedtree29e49e0948f48795b1fa671dd91083dfa7e42323, Linuxx64 kernel147/Node24.21/Nvim.12.5, cachednull, HeadlessShell1248/CfT156, c8lon1/2workers/lifetime1163s/$0.0808. Inventory/socket-alias qualifications and earlier intermittent red/false culprit label retained; no zero-leak/global cleanup claim. No Reviewer execution. Remaining fullT3/T4/stageQA/landing separate; per-itemQA none.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-11T20:47:28.056Z

Merged 68ed9d82b489ed5e74817bd842b3b7e040194c8f onto dev.
