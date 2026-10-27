---
id: T-1375
kind: task
title: suite-remote-process budget-slot test leaks a child process under a loaded macOS stage cover
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: topic-1118
branch: t/T-1375-suite-remote-process-budget-slot-test
created: 2026-10-27T16:48:16.391Z
updated: 2026-10-27T18:26:43.627Z
closed: 2026-10-27T18:26:43.627Z
---

## Summary

`hub/test/suite-remote-process.test.ts::finished remote runs free both budget slots despite failed spend settlement` failed once in the macOS stage cover e39a3a5a (dev 20c93783, local, 2 workers, peak 1m load 8.88; log A-12840). Its body passed; the projectHub leak check after it found one `PROCESSWRAP` still active. Alone it passed 5/5 on the same tree.

## What to build

The test ends right after the two waiting runs are admitted, so their remote launches (with `faults.create = 422`) can still own a child process when the leak check runs on a loaded host. Make the test await each admitted waiter's terminal result (or its owned child's exit) before it returns, so cleanup observes no live process, and prove it under CPU load.

## Evidence

- Failure: `AssertionError: projectHub leaked resources; active before=CloseReq,PipeWrap,PipeWrap,PipeWrap,TCPServerWrap after=PipeWrap,PipeWrap,PipeWrap`, actual `resources: ['PROCESSWRAP']` (hub-resources.ts:33 via process-cleanup.ts:100).
- Linux stage cover 9e9aeedb at the same commit green (A-12836).
- Flaky-rerun rule: 5/5 alone on macOS at 20c93783; one cover resubmit.

## Acceptance criteria

- [x] C1. The test awaits the terminal state of every run it admits before returning, and the leak check finds no active process.
  - done: impl-1375 · 2026-10-27T17:49:00.661Z
  - verified: rev-26 [reviewer] · run rev-20261027-1375-evidence-2 · 2026-10-27T18:20:31.398Z · commit db99ad0645791a99aeb3bef61fb6757966947c74
- [x] C2. The identity passes 10/10 under two workers plus owned CPU load on macOS.
  - done: impl-1375 · 2026-10-27T17:49:01.325Z
  - verified: rev-26 [reviewer] · run rev-20261027-1375-evidence-2 · 2026-10-27T18:20:31.398Z · commit db99ad0645791a99aeb3bef61fb6757966947c74

## Comments

### coord · 2026-10-27T17:19:28.368Z

Second macOS stage cover at the same tree (8f990137, A-12841, peak load 9.76) failed on the same identity with the same PROCESSWRAP leak, so it is not a one-off flake (flaky-rerun rule: same test red twice → report). History: it passed in all three macOS stage covers at 91d2dc4a (1e276de4, ce65f192, c6a30da9) and in the Linux covers at both 91d2dc4a and 20c93783; it fails in both macOS covers at 20c93783. Between them only e59731e6 (tracker) and T-1374 landed (test-only files plus durations.json and lint-baseline.json), so the likely trigger is changed shard scheduling and neighbours under load, not product code. It blocks the E-1310 stage 2 / E-1313 stage 1 close.

### impl-1375 · 2026-10-27T17:43:15.896Z

TDD at existing T3 nativeProjectHub/fake DigitalOcean seam: temporarily wrapped only waiters' ssh-keygen with a 4-second owned-fixture delay and recorded PIDs. Old tail plus terminal assertion failed: `admitted waiter a3e67297-f8c6-4e13-a927-caf15b4770da has no terminal result` (macOS local, one identity, 14.45661025 s). Same control plus waits for both waiter terminal reports passed (15.975540125 s). This proves the early-return boundary; the original PROCESSWRAP leak has not yet reproduced in this control (cleanup reaped the delayed children). Testing the unmodified schedule with creation-stack capture under the approved owned-load probe before attributing the exact leak.

### impl-1375 · 2026-10-27T17:49:17.079Z

Implemented and pushed a25907444c0c0c72d0344b3f05cbf62dda3aa952 (tree c9eb3a5dfbc50675612f8ec7a8beb120ef493676): two exact waiter terminal-report waits before ledger restoration; no product changes. C1/C2 done; source review requested. Durable evidence A-12850: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12850-t-1375-deterministic-control-and-final-head-macos-10-10.md. Deterministic native attribution/control red→green; final-head macOS local exact identity 10/10 at two workers plus owned CPU progress each repetition, full TAP summaries/close receipts; typecheck passed. No local duration gate/browser or other tiers. Historical post-cleanup leak not reproduced; Coordinator accepted deterministic proof and next-stage real-world check. LOCAL CAPACITY RELEASED.

### rev-26 · 2026-10-27T17:50:25.128Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1375-source-1
commit: a25907444c0c0c72d0344b3f05cbf62dda3aa952
scope: full
findings: [{"severity":"medium","text":"M1 Standards: guide heading must be the exact test path required by unchanged test-docs.test.ts. Preserve guard, retain actual red/green/native exits, correct only heading and request pushed-head source review.","file":"docs/agents/tests/hub-test-suite-remote-process.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

Full consolidated source review A-12851: Standards M1 medium, Spec 0. Two exact waiter terminal-report waits preserve all original queue/admission/result/deletion assertions and the native leak check, before ledger restoration. A-12850 deterministic missing-completion control supports repair; historical post-cleanup leak not reproduced, as explicitly accepted by Coordinator dca2f416. Local exact-head macOS 10/10 CPU evidence remains distinct from configured/Linux coverage; C1/C2 runtime marks pending. No additional findings; heading correction needs fresh source review before verification. QA none; no Reviewer execution.

### rev-26 · 2026-10-27T17:51:08.609Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1375-source-2
commit: db99ad0645791a99aeb3bef61fb6757966947c74
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear: Standards 0, Spec 0. A-12853 incorporates A-12851; exact one-heading correction resolves M1, owning guard/index/runtime bytes unchanged. A-12852 actual local guard red exit1 2/3 -> green exit0 3/3 inspected. Terminal-report repair retains original assertions/leak check; A-12850 macOS 10/10 remains prior-head unchanged-test evidence. Historical post-cleanup leak not reproduced locally; deterministic completion control and next-stage real-world check accepted by Coordinator. C1/C2 runtime verification pending exact-head mode-free run/original-record final review. QA none; no Reviewer execution.

### impl-1375 · 2026-10-27T18:02:14.361Z

Verification 11f33f8b at source-reviewed db99ad064 failed outside the item: unchanged nvim/test/explorer-card-component.test.ts::epic cards show stage progress, approval, subtree verdict and latest activity including a closed plan; exact A-12854:18816 output `Error: nvim ... missing row T-10`. Reported possible shared-defect to lead T-1375 (Bugs/S); holding diagnosis and changes for Coordinator. Linux droplet x64, Node24.21.0/Neovim0.12.5, workers2, duration gates report-only; T0/T1 green, T2 exit1, 3445 tests/3444 pass/1 fail/0 cancelled/skipped/todo. Changed T3/Web unexecuted; no complete configured/Linux evidence, not ready. Original macOS load proof remains separate at prior head.

### rev-26 · 2026-10-27T18:02:38.223Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1375-evidence-1
commit: db99ad0645791a99aeb3bef61fb6757966947c74
scope: evidence
findings: [{"severity":"medium","text":"Configured runtime blocker: original run11f33f8b/A-12854 fails this unchanged identity with Lua 'missing row T-10' (log18816). Root cause unclassified; changed T3 and Web were not executed, so final criterion evidence is incomplete.","file":"nvim/test/explorer-card-component.test.ts","line":110}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; original exact-head run exit1. Independent 3444 ordinary passes/1 fail, no load-gate records and no owned T3 identity execution. T0/T1 green, fallback T2 red, changedT3/Web unrun, T4 absent. A-12855 records exact failure, platform/host-gate/report-only limits and preserves source-2/local macOS proof as historical context only. C1/C2 stay runtime-unverified. Await Coordinator's shared-fix/retry disposition at the reviewed head; no source regression or flaky pass inferred and no Reviewer execution.

### impl-1375 · 2026-10-27T18:19:29.597Z

Authorized same-head retry 641154c2 is green at unchanged db99ad064: A-12856, 3737/3737, T0/T1/T2 + changed T3 once + Web. Owned T3 identity native pass12.712835631s; old explorer failure now pass0.928708599s. Linux x64 droplet c-8 lon1/Node24.21.0/Neovim0.12.5, workers2 (Web4), Chrome Headless Shell156.0.8078.4/v1248; lifetime900s/cost$0.0625; duration/lint gates report-only, remaining T3/T4 not executed. Original red11f33f8b/A-12854 retained and linked to T-1376, Coordinator's 5/5-alone proof and authorized retry. Coordinator accepted green and directed no further commits/duration edits: existing16.7s E-880 allowance covers12.7s. Final original-record evidence review requested. Historical post-cleanup leak remains unreproduced locally; deterministic completion control and prior-head unchanged-test macOS10/10 evidence remain distinct. Awaiting final clear before ready report.

### rev-26 · 2026-10-27T18:20:31.398Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1375-evidence-2
commit: db99ad0645791a99aeb3bef61fb6757966947c74
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, C1/C2 verified. Accepted same-head retry641154c2/A-12856: independent3737 ordinary passes, no separate load records; owned T3 pass12.712835631 s with original terminal/queue/deletion/leak assertions. Original red11f33f8b/A-12854 retained (explorer missingT-10; T3/Web unrun); Coordinatorb922e7f1 authorized retry, T-1376 untouched, formerly failing case now passes .928708599 s; 08c9d6c0 accepts/no further commits. A-12850 prior-head macOS exact-identity10/10 two-lane ownedCPU TAP/native-close proof stays separately attributed to unchanged test bytes. Historical post-cleanup leak unreproduced; deterministic createKey control proves missing-completion boundary and next Mac cover remains real-world check. T0/allT1/fallback allT2/changedT3 once/Web complete; otherT3/T4 absent. Actual E-88016.7s throughNov23 covers sample; printedR-1278 stanza suggestion only. Report-only limits/host-gate reuse/pinned browser preserved in A-12857. QA none; Coordinator enqueue/landing separate.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-27T18:26:43.627Z

Merged 3fd2e2894cf9e712fb690ce940c1a73886d2765c onto dev.
