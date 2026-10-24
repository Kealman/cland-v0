---
id: T-1015
kind: task
title: Periodic dev T3 goes red when dev moves while it bundles the root
state: closed
status: done
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
updated: 2026-10-24T08:10:20.864Z
closed: 2026-10-24T08:10:20.864Z
---

## Summary

The periodic dev T3 run 90717a88 (2026-10-20 17:20Z, head 7052b616) went red with "dirty or changed worktree cannot be bundled for droplet: HEAD changed": a tracker commit moved root `dev` while the run was bundling the root for the droplet. No test ran, yet the run reports red, a culprit search starts and comes back inconclusive, and General gets a red notice.

## What to build

The periodic dev T3 bundles the commit it was started for (from the object store or a detached snapshot), not the live root checkout, so later dev commits (tracker or code) cannot invalidate it. A run that cannot bundle is reported as infrastructure (not red) and is retried, with no culprit search.

## Acceptance criteria

- [x] C1. A periodic dev T3 started at commit X still bundles X when root dev moves during bundling (test).
  - done: impl-1015 · 2026-10-24T07:46:35.393Z
  - verified: rev-26 [reviewer] · run rev-20261024-1015-final-1 · 2026-10-24T08:06:43.873Z · commit 1456d31243043fcda66325840d706b1afc5de4cf
- [x] C2. A bundling failure is reported as an infrastructure outcome, not red, starts no culprit search and is retried at the next eligible tip (test).
  - done: impl-1015 · 2026-10-24T07:53:09.858Z
  - verified: rev-26 [reviewer] · run rev-20261024-1015-final-1 · 2026-10-24T08:06:43.873Z · commit 1456d31243043fcda66325840d706b1afc5de4cf

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

### impl-1015 · 2026-10-24T08:06:25.433Z

Configured mode-free verification 0996360e-9245-442c-b870-45184ff8b3ec completed exit 0 at exact source-clear head 1456d31243043fcda66325840d706b1afc5de4cf. Linux x64 droplet c-8 lon1, Node v24.21.0 / Neovim v0.12.5: 2798 tests, 2798 pass, 0 fail/cancel/skip/todo. T0, all T1, fallback all T2 in hub and Neovim, and Web completed; T3 deferred to periodic/integrated occasions (queue enabled; configured batches omit T3), not claimed as executed. Budgets and lint diagnostics report-only; result green despite reported duration warnings. Receipt A-10470 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10470-suite-0996360e-9245-442c-b870-45184ff8b3ec-auto-at-1456d31.log. Droplet lifetime 615 s, cost $0.0427. No source/head changes since clear review; final reviewer evidence settlement pending.

### rev-26 · 2026-10-24T08:06:43.873Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1015-final-1
commit: 1456d31243043fcda66325840d706b1afc5de4cf
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final C1/C2 clear at unchanged1456d312/treebf5972bd, carrying A-10423/A-10449 source. A-10470/0996360e exit0: independently parsed2798 ordinary/418file passes plus20actual load tests/20files pass, nofail/cancel/skip. C1 real sealed Git captured-X bundle/content case passes; C2 infrastructure/history/retry, public no-red/no-search and first-checkpoint healing cases pass; all4 identities5/5 load reps, noallowance trigger. T1/allfallbackT2hub+Neovim/actualWeb exit0 on Linux x64 c-8 lon1 cland-v0-44cdae89 Node24.21/Nvim0.12.5 workers2(Web4), lifetime615s/$0.0427. Rootcheck stdout retained/0refusals; remote reused hostgate6524f066 Git tree, not repeated. Lint133/60/duration/tier/ratchetreport-only, Web141.81s suite/141.70s shard>40s reportbudget and1missingbaseline retained. No configuredT3/T4 orrealprovider/periodicprocess/QAclaim; approved T1/T2 seams prove criteria. Local evidence source limits remain. A-10472: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10472-t-1015-final-evidence-at-1456d312.md. No findings.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T08:10:20.864Z

Merged 1fd3495b0caf4d4d0b631611ac99be3645aeff10 onto dev.
