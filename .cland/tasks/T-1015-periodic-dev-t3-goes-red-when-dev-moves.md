---
id: T-1015
kind: task
title: Periodic dev T3 goes red when dev moves while it bundles the root
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: topic-935
branch: t/T-1015-periodic-dev-t3-goes-red-when-dev-moves
created: 2026-10-20T17:26:44.017Z
updated: 2026-10-24T07:54:22.690Z
---

## Summary

The periodic dev T3 run 90717a88 (2026-10-20 17:20Z, head 7052b616) went red with "dirty or changed worktree cannot be bundled for droplet: HEAD changed": a tracker commit moved root `dev` while the run was bundling the root for the droplet. No test ran, yet the run reports red, a culprit search starts and comes back inconclusive, and General gets a red notice.

## What to build

The periodic dev T3 bundles the commit it was started for (from the object store or a detached snapshot), not the live root checkout, so later dev commits (tracker or code) cannot invalidate it. A run that cannot bundle is reported as infrastructure (not red) and is retried, with no culprit search.

## Acceptance criteria

- [x] C1. A periodic dev T3 started at commit X still bundles X when root dev moves during bundling (test).
  - done: impl-1015 · 2026-10-24T07:46:35.393Z
- [x] C2. A bundling failure is reported as an infrastructure outcome, not red, starts no culprit search and is retried at the next eligible tip (test).
  - done: impl-1015 · 2026-10-24T07:53:09.858Z

## Comments

### coord · 2026-10-22T23:37:32.848Z

Recurred 2026-10-22 23:36Z: periodic dev T3 a373df37 (A-9548) at a5ec440d reported "Periodic dev T3 red" with exit 1 "dirty or changed worktree cannot be bundled for droplet: HEAD changed", because T-1139 landed (adde2c7c) while it bundled. No test ran, and the culprit search came back inconclusive with no failing files. It still posts a red headline in General for an infrastructure race.

### impl-1015 · 2026-10-24T07:44:30.438Z

C1/C2 implemented test-first. C1 red: "dirty or changed worktree cannot be bundled for droplet: HEAD changed"; green after periodic committed-only Git delivery and remote-only check. C2 red: result "red" vs expected "not-run"; green with durable outcome.notRun="infrastructure", empty failingFiles, no incident cover/search, preserved executed green/red evidence and retry after restart. Local macOS targeted run on current uncommitted tree: node --test hub/test/suite-soak.test.ts hub/test/suite-soak-component.test.ts, 18/18 pass. npm run check pending. No real droplets used.

### rev-26 · 2026-10-24T07:50:16.995Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-1015-source-1
commit: 9f2effd663d32708bf4dad1bffd43330f9ac3b1d
scope: full
findings: [{"severity":"medium","text":"M1 (C2): The first done/lost result.json write omits an already-saved outcome.notRun=\"infrastructure\" and original cause. A stop before the later full-outcome rewrite leaves a bare receipt; #restoreRemoteResult at1091 replaces the saved infrastructure outcome with that receipt, turning an unexecuted attempt red and allowing incident cover/culprit search. Preserve marker/cause at every durable result write and on recovery from this first checkpoint; the current crash test only plants the final already-correct receipt.","file":"hub/src/hub/suites.ts","line":1140}]
finding_counts: {"high":0,"medium":1,"low":0}

Full audit complete at 9f2effd6/tree49c6e138. Standards: no independent findings; Spec: M1 medium C2 at suites.ts1140/1091, reported and accepted by lead. Captured-commit delivery/check path and native sealed Git proof otherwise align; fake-executor no-cover/no-search/interval retry path aligns outside the durable-receipt gap. Matching help/docs/skill CHANGES and delegated role eligibility pointer reviewed. A-10423: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10423-t-1015-full-source-review-at-9f2effd6.md. C1 remains unverified pending exact-head runtime/evidence; C2 failed. A-10413/A-10419 remain narrative local validation notes, not raw test receipts; preserve original stdout/exits/native timings and source limits without transcription reruns. No configured verification at this head. Correct M1 then request fresh source review before mode-free verify. Complete finding set; no further source findings or per-item QA required.

Criteria: C2 failed (Restart after the first terminal-status receipt can discard durable infrastructure classification and publish a red unexecuted attempt.).

### impl-1015 · 2026-10-24T07:52:37.258Z

M1 corrected test-first in 1456d312 (pushed). Red from first terminal-status checkpoint: recovered {cause:"remote machine lost"} instead of saved {cause:"bundle: object unavailable",notRun:"infrastructure"}. Both first terminal write and restore now retain saved infrastructure cause/marker; restore atomically heals old bare result files. Existing result-only recovery test remains. Final-head local macOS command node --test hub/test/suite-soak.test.ts hub/test/suite-soak-component.test.ts passed 19/19, raw stdout preserved as artifact; these are targeted T1/T2 results without a duration-budget gate or full verification. npm run check at 1456d312 pending. Original prior-head output/timings preserved A-10428; M1 red/green excerpts A-10435. Fresh review follows check, no verification yet.

### rev-26 · 2026-10-24T07:54:22.690Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1015-source-2
commit: 1456d31243043fcda66325840d706b1afc5de4cf
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at1456d312/treebf5972bd, M1resolved; no findings. First terminal write retains saved infrastructure notRun/cause; restore protects that outcome and atomically heals old bare receipts. New T1 exact-checkpoint recovery retains final durable JSON/not-run/no-cover/no-search assertions; prior full-result recovery/retry tests retained. Three-file correction only, no devmerge; full A-10423 audit otherwise carried. A-10439 exact-head local T1/T2 native19/19 duration3532.829ms; A-10440 raw rootcheck0, actual lint133findings/60files/reportmode/0refusals. A-10428 prior-headstdout/A-10435 intermediate red-green source limits retained. A-10449 supersedes A-10444 lint-count typo: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10449-t-1015-corrected-source-verdict-at-1456d312.md. C1/C2 await actual same-head configured receipt, no current configuredgreen/LinuxT3T4/QAclaim. Proceed with mode-free verification at this unchanged head.
