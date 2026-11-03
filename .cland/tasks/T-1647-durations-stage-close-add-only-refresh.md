---
id: T-1647
kind: task
title: "Durations: stage-close add-only refresh and renew seven allowances expiring 2026-11-05"
state: open
status: ready
size: XS
criterion_seq: 2
labels: []
assignee: null
parent: C-216
blocked_by: []
topic: topic-1356
branch: t/T-1647-durations-stage-close-add-only-refresh
created: 2026-11-03T00:38:49.827Z
updated: 2026-11-03T01:08:43.829Z
---

## Summary

Seven duration allowances owned by E-880 expire on 2026-11-05 at 00:00 UTC (hub heartbeat, 2026-11-03 00:37Z):
- `startup-replies-scale.test.ts` eight startup replies;
- `startup-task-pages-soak.test.ts` five thousand open items;
- `suite-timeouts.test.ts` fast-exit inherited-pipe writers;
- three `telegram-polling-restart.test.ts` Discord history cases;
- `web/test/items.test.ts` "the Items tree reads the pinned tracker snapshot".

If they lapse, those tests fail their budgets and turn batches red. Separately, the stage-close refresh after the green cover pair at 986afe46 is still owed: Linux 7953ccfc (A-15983) and macOS f124d237 (A-15995).

## What to build

- Run `node hub/test/durations.ts refresh --add-only <cover log>` for both cover logs. It adds missing test and file baselines and leaves allowances intact. Drop every `site/test/` key, then run `npm run test:tiers`.
- Renew each of the seven allowances under the budget rules: owner a category or a direct child of one (E-880 is the configured legacy owner), `added` to `expires` of 31 days or less. Size each at about 1.5× the worst sample in today's cover logs and batch logs, keeping its reason and appending the samples. Retire any allowance whose test now fits its budget in every sample.
- The three Discord history allowances overlap T-1641, the flaky history test. Name T-1641 in their reasons.

## Acceptance criteria

- [x] C1. No allowance in `hub/test/durations.json` expires before 2026-11-10, and every renewed entry lists its samples and its reason (lint).
  - done: impl-1647 · 2026-11-03T00:41:37.552Z
  - verified: rev-35 [reviewer] · run rev-35-1647-final-1 · 2026-11-03T01:08:43.720Z · commit e0956e56fcfaf4dbdf6ea76b0f3999ae5cf29ac3
- [x] C2. The add-only refresh adds the cover-pair baselines, no `site/test/` key remains, and `npm run test:tiers` and `npm run test:lint` pass.
  - done: impl-1647 · 2026-11-03T00:41:39.529Z
  - verified: rev-35 [reviewer] · run rev-35-1647-final-1 · 2026-11-03T01:08:43.720Z · commit e0956e56fcfaf4dbdf6ea76b0f3999ae5cf29ac3

## Comments

### impl-1647 · 2026-11-03T00:42:00.147Z

Implemented and pushed e0956e56fcfaf4dbdf6ea76b0f3999ae5cf29ac3; review requested. Only durations.json: +56 file/+387 test baselines from green cover pair, unchanged existing baseline values, no site/test keys, ten allowances renewed with multi-run passing samples (A-16052). Final test:tiers/test:lint passed Darwin arm64 Node24.21.0 (zero lint refusals, advisory findings retained); suites/browser unrun per specific maintenance brief. Validation A-16058.

### rev-35 · 2026-11-03T00:44:06.774Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1647-source-1
commit: e0956e56fcfaf4dbdf6ea76b0f3999ae5cf29ac3
scope: full
findings: [{"severity":"low","text":"180 sample rows have an empty platform field, including Linux maxima used for sizing, although allowance reasons say A-16052 records platforms. Supplement from native suite provenance with platform/executor/browser and overall run result; preserve the distinction between passing individual cases in failed runs and an overall pass (rule17). Raw source logs remain available and all ten maxima independently match, so this does not block source clear.","file":".cland/artifacts/A-16052-t-1647-duration-samples-with-source-heads-and-platforms.json","line":8}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear with one low evidence metadata finding, no high/medium. Independent streamed source-log calculation confirms exact +56/+387 additions, unchanged existing baselines/budget, no site/test keys. All ten caps equal1.5x worst passing raw case samples rounded upward; expiries/owners/reasons satisfy Coordinator a9352480, state-path Nov10/T-1638 and Discord T-1641 conditions. A-15966 failed completion excluded; passing cases from failed A-15982 are measurements only. Low: A-16052 leaves180 platform fields blank; supplement native provenance and overall-result distinctions without source changes. C1/C2 runtime/planning verification remains pending exact-head mode-free verify, explicitly required by Coordinator211a60b1. Local tier/lint summaries do not waive it. Reviewer performed read-only data/source analysis, no tests/browser/edits. Detail A-16060: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16060-t-1647-source-review-add-only-baselines-and-measured-renewals.md.

### rev-35 · 2026-11-03T01:08:43.720Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1647-final-1
commit: e0956e56fcfaf4dbdf6ea76b0f3999ae5cf29ac3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1/C2 verified, no remaining findings. Exact-head0077bb25/A-16066 exit0,4834 pass/zero fail/cancel/skip/todo. Independently checked refresh7/runner-budget3/duration-budget12/tier19/remote-budget17 controls plus actual host lint0refusals and successful manifest/shard planning; source add-only/cap/date proofs carry forward. Prior low resolved by A-16061:40 native run provenance records and209 unchanged sample outcome/metadata linkages independently checked, failed/partial result distinctions retained. Uncached Linux x64 c-8sfo2 Node24.21/Nvim0.12.5, isolated Headless Shell1248/Chrome for Testing156.0.8078.4; T0/T1/allT2/Web complete,T3 deferred to batch,T4 unexecuted. Budget/lint/ratchet/skip-reason diagnostics report-only; host typecheck at runner tree3f3690557 not remotely repeated. QA none. Reviewer executed no tests/browser/edits. Detail A-16067: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16067-t-1647-final-evidence-duration-planning-and-provenance-correction.md.

Criteria: C1 verified, C2 verified.
