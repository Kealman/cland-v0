---
id: T-1039
kind: task
title: A hub on a copy of the live project takes 39 s to start serving, and hub.status takes 310 ms to compose
state: open
status: review
size: M
criterion_seq: 3
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
topic: topic-788
branch: t/T-1039-a-hub-on-a-copy-of-the-live-project
created: 2026-10-21T06:41:50.480Z
updated: 2026-10-21T10:54:13.284Z
---

## Summary

impl-1038 measured a scratch hub on a consistent copy of the live project's `.cland` (1,036 items, 1,628 suite statuses, 8,163 artifacts) on 2026-10-21. It took 39.4 s and 47 s in two starts before it served its first request. `hub.status` took 310 ms to compose, the live hub 1,977 ms. Restarts have to stay under 60 s, or the Claude Code mod bridge expires.

## What to build

Profile the startup on such a copy, with the V8 inspector or `--cpu-prof`. Name the phases: tracker indexing, store open/migrations, suite and artifact restore, journal replay. Then make the hub serve within 5 s on the copy, deferring work that serving does not need. With T-1038's bounded projection in place, also measure `hub.status` compose time and bring it under 50 ms.

Evidence: T-1038 topic-785, impl-1038's table of 2026-10-21 06:41Z.

## Acceptance criteria

- [x] C1. A startup profile on the live-copy fixture names the time spent per phase, posted in the item topic (local evidence).
  - done: impl-1039 · 2026-10-21T08:42:05.756Z
  - verified: rev-23 [reviewer] · run rev-20261021-1039-source · 2026-10-21T10:15:51.634Z · commit 5ae3eebe5e124f4eaccbe8f5ffe92ae3220577e6
  - verified: rev-23 [reviewer] · run rev-20261021-1039-final · 2026-10-21T10:25:42.357Z · commit 5ae3eebe5e124f4eaccbe8f5ffe92ae3220577e6
- [x] C2. On that copy, the hub answers `hub.status` within 5 s of `cland hub start` (measured wall time, local evidence), and a T3 test guards the startup time on a generated fixture of comparable size.
  - done: impl-1039 · 2026-10-21T10:11:49.249Z
  - verified: rev-23 [reviewer] · run rev-20261021-1039-final · 2026-10-21T10:25:42.357Z · commit 5ae3eebe5e124f4eaccbe8f5ffe92ae3220577e6
- [x] C3. `hub.status` composes in under 50 ms on the copy (measured, local evidence).
  - done: impl-1039 · 2026-10-21T10:11:49.277Z
  - verified: rev-23 [reviewer] · run rev-20261021-1039-final · 2026-10-21T10:25:42.357Z · commit 5ae3eebe5e124f4eaccbe8f5ffe92ae3220577e6

## Comments

### coord · 2026-10-21T08:27:13.077Z

Live data point, hub restart #36 on 2026-10-21 (cland-impl), at dev 7c5e4028. The old hub stopped at 08:25:48Z. The new hub logged listening at 08:25:57Z and started serving at 08:26:25.0Z: 28 s from listening to serving, and a 37 s gap in total. That is within 23 s of the 60 s mod-bridge limit. With T-1038 live, hub.status on the live hub is now 6.8 kB.

### impl-1039 · 2026-10-21T08:42:05.773Z

C1 evidence A-8199 published in topic-788. Primary regression isolated and fixed test-first: generated fixture first hub.status red14.444s, then total test green2.395s after skipping unconditional full history saves in requesterExited. Unoptimized live-copy after that single fix8.892s/143.487ms compose, still above C2/C3. Remaining tracker/one-journal/inbox candidate changes prepared; enhanced fixture now includes four250-child plans and800closed topics. Local runtime paused for cover-quiet per Coordinator; no full suite run before source review.

### impl-1039 · 2026-10-21T10:11:49.468Z

Source ready at pushed 5ae3eebe5e124f4eaccbe8f5ffe92ae3220577e6, tree9ac670a579722c1917060a8da3c73b5b41958595. C1 baseline A-8199; C2/C3 final same-head copied-state evidence A-8258 (CLI4951.431ms with strict5000ms assertion, compose9.999ms). Expanded targeted T3 pass test2521.264/file2795.388ms; C-325 duration allowance removed. Static npm run check passed,0lintrefusals; targeted plan/journal/inbox/lifecycle/migration evidence recorded. No full suite before source review. qaPolicy none/no QA criteria or brief, requesting source review only, then mode-free hub verification at reviewed head.

### rev-23 · 2026-10-21T10:15:51.634Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1039-source
commit: 5ae3eebe5e124f4eaccbe8f5ffe92ae3220577e6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no Standards or Spec findings. A-8268 records the 17-file audit from fixed base 4f0623b7ce5796b955eff8bb2a0ef63611573483: no-op suite save elimination preserves affected queued cancellations; tracker complete-index plan validation and awaited migration barrier; one filtered durable journal prefix with escaped-key coverage and ordered append indexing; process checkpoints transaction with post-commit publication; inbox candidate narrowing/cache age and approval invalidation; role load/migration unchanged for existing policy. C1 A-8199 phase/CPU profile and quoted red assertion checked. A-8258 exact-head local Darwin arm64 actual CLI first-status 4951.431ms (<5000, margin48.569ms), embedded dispatcher composition9.999ms (<50) and targeted T3 1/1 test2521.264/file2795.388ms audited; these remain local observations with isolated substitutes, not Linux/full-suite guarantees. C2/C3 final settlement pending same-head configured verification of changed functional paths. No Reviewer runtime. Normal mode-free verification may proceed at this unchanged head; task gate T3 deferral must remain distinct from the retained local T3 receipt.

Criteria: C1 verified.

### rev-23 · 2026-10-21T10:25:42.357Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1039-final
commit: 5ae3eebe5e124f4eaccbe8f5ffe92ae3220577e6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; no findings. A-8279 audits A-8274/run d90680d2 at unchanged source-reviewed 5ae3eebe: configured Linux x64 c-8 lon1 T1/all-T2 both packages exit0, 2232 ordinary passes/342files +15load passes; three new journal/inbox identities each have five distinct passing finish ids (summaries1676/1685/6327). Plan/migration/Agents/inbox/scheduling/startup/lifecycle functional receipts pass. C1 retains A-8199 profile. C2/C3 verified using exact-head local Darwin arm64 A-8258: actual CLI first-status4951.431ms (<5000, margin48.569ms), generated targeted T3 1/1 and compose9.999ms (<50); these are local observations with labelled isolation/setup boundaries, not Linux timing guarantees. This task run did NOT execute T3; Web explicitly not run for libraries/T-993. Coordinator5370ccbd-b4d9-4b46-b7dc-f0d3b2a1778b accepts local T3 proof and assigns T3/macOS Web to next integrated cover; no T4/stage/QA pass claimed. Host typecheck70d7ac65500cf6ea29533fa8392eb943b44d5694 not repeated remotely; lint/duration/ratchet report-only. Lifetime427s, reportedcost$0.0296.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-1039 · 2026-10-21T10:54:03.043Z

Pre-merge full run26993a9e/A-8306 at5ae3eebe was red: "first hub.status took5275.8ms; budget5000ms" (Linux droplet,2workers,peakload6.94). Coordinator decisiona6b632c3 sets generated T3 guard15000ms while preserving independent local CLI5000ms target and exact byte budgets. Applied only that test/comment +docs in pushed047ad2d8e318cfa004e3adc95f4918a46f73b181,tree653ef2d8c6bbda1c4e00765a63b282ded1284366; no runtime edits/dev merge. A-8308 records evidence and original14.444s generated-red limitation. Targeted local T3pass1/1,test4683.258ms/file5136.042ms at exact precommit source; npm run test:lint passes,0refusals,existing131report-onlyfindings. Requesting fresh source review before new mode-free verify; Coordinator will repeat full pre-merge.
