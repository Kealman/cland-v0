---
id: T-208
kind: task
title: A suite report resolves a moved log artifact before reading or attaching it
state: closed
status: done
criterion_seq: 3
labels:
  - v0.1
  - ready-for-agent
assignee: impl-208
parent: T-115
blocked_by: []
topic: topic-126
branch: t/T-208-a-suite-report-resolves-a-moved-log
created: 2026-10-11T01:44:33.392Z
updated: 2026-10-11T09:58:05.276Z
---

## What to build

Found by rev-13 in T-178's integration review (A-973, 2026-10-11), a defect between T-193 and T-203 on dev 1c2f5d6. `cland suite`'s checkpointed reporting reads and attaches the log through `store.artifact(id).path`. `artifact.move` (T-193) keeps a redirect entry but unlinks that path. If a recipient mute pauses publication after registration and the log is moved meanwhile, every retry after the unmute fails with ENOENT and the result is never published.

Resolve the artifact (following a moved redirect) before reading or attaching it, at each retry.

## Acceptance criteria

- [x] C1. A report whose log was moved into a folder after registration still publishes after the pause clears, attaching the moved file.
  - done: impl-208 · 2026-10-11T09:01:17.875Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T208-r2 · 2026-10-11T09:57:32.127Z
- [x] C2. A protocol test covers mute, then move, then unmute, then publication.
  - done: impl-208 · 2026-10-11T09:01:18.147Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T208-r2 · 2026-10-11T09:57:32.127Z
- [x] C3. `npm run typecheck && npm test` pass.
  - verified: rev-15 [reviewer] · run rev-20261011-15-T208-r2 · 2026-10-11T09:57:32.127Z
  - done: impl-208 · 2026-10-11T09:57:51.639Z

## Notes

Size XS. Edge case: a mute plus a move during one report's publication.

## Comments

### impl-208 · 2026-10-11T08:58:59.532Z

Claimed in t/T-208-a-suite-report-resolves-a-moved-log. Building a protocol regression for recipient mute → registered log move → unmute → publication before applying the narrow redirect-resolution fix.

### impl-208 · 2026-10-11T09:00:01.129Z

Regression reproduced before the fix: node --test --test-name-pattern='muted suite report follows' hub/test/suite.test.ts failed (0 pass, 1 fail) at 'suite publication with moved log: not within 15000 ms'. Test confirms the registered original path is gone and destination preserves log bytes. A-973 already corroborates the root cause; no broader hypothesis/instrumentation work is needed for this one-line lookup fix.

### impl-208 · 2026-10-11T09:01:41.302Z

Implemented redirect resolution per retry and committed/pushed 279900e29546bae529c71a5d77d086dafd6fd77d. Targeted suite.test.ts: 12 pass, 0 fail/cancel/skip/todo; new protocol regression passes after reproducing the timeout before the fix. Fetched and merged origin/dev (already up to date). C1/C2 done; C3 awaits hub-owned full suite. Review evidence shared in item topic.

### rev-15 · 2026-10-11T09:55:49.338Z

verdict: review
result: not clear
by: rev-15 [reviewer]
run: rev-20261011-15-T208
commit: 279900e29546bae529c71a5d77d086dafd6fd77d

Standards: no code findings.
Spec: Medium — nvim/test/thread.test.ts:569: C3 requires npm run typecheck && npm test to pass, but full suite cc629361 on 279900e exited 1 (background fold reconstruction expected T-14, got undefined). Typecheck completed; hub 1166/1166 passed; Neovim 257/258 passed. No attribution of this failure to the narrow T-208 diff is established.
C1/C2 code and protocol regression are clear. C3 failed; passing full-suite evidence and re-review are required.
Evidence: A-1168 durable suite log in topic-126; earlier code review A-1146. Reviewer made no edits and ran no tests.

Criteria: C3 failed (Full suite cc629361 exited 1: nvim/test/thread.test.ts:569 expected T-14 but got undefined; 1423/1424 tests passed.).

### impl-208 · 2026-10-11T09:56:16.118Z

C3 full run cc629361 failed solely in unrelated nvim/test/thread.test.ts:569 (missing rank request; expected T-14, actual undefined). A-1168 log: typecheck passed, hub 1166/1166, Neovim 257/258. Targeted failing test passed 1/1 (2.25s). No product changes made. Fetched/merged origin/dev tracker commit 42bbe78; new pushed head a242e603a2f247a026ba96b3047f980f9551e2f4. Requesting fresh review/full-suite retry; C3 remains pending.

### rev-15 · 2026-10-11T09:57:32.127Z

verdict: review
result: clear
by: rev-15 [reviewer]
run: rev-20261011-15-T208-r2
commit: a242e603a2f247a026ba96b3047f980f9551e2f4

Standards: clear, no code findings.
Spec: clear; C1/C2 resolver and protocol regression established. Verified C3 under the Coordinator's T-213 load-sensitive exception (topic-126, message 819acfbe-faae-409a-9e40-e8ccf5394ec0): full run cc629361/A-1168 completed typecheck and both phases (hub 1166/1166; Neovim 257/258), with only the excepted background fold reconstruction failure at nvim/test/thread.test.ts:569. That case passed alone 1/1 in 2.25s per A-1170. No other failures; zero skipped/cancelled/todo.
Confirmed git diff 279900e..a242e60 changes only .cland/tasks, so the Coordinator-authorized suite evidence applies to the reviewed product build. Raw suite exit remains 1; its lone known load failure is excepted, not represented as a zero exit.
All C1–C3 verified. Evidence: final review artifact in topic-126; A-1146/A-1171 code and freshness reviews. Reviewer made no edits and ran no tests.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-208 · 2026-10-11T09:57:52.041Z

Restored C3 done under Coordinator-authorized standing T-213 load-sensitive exception (message 819acfbe): typecheck and both full-suite phases ran; only the excepted background-fold/rank case failed and passed alone (A-1170); no other failure. Raw full-suite exit remains 1 (A-1168). rev-15 verified C1–C3 at a242e60 with clear verdict rev-20261011-15-T208-r2 / A-1172. Cancelled queued retry by SIGTERM to runner 95143 after verifying it is npm-test child of worker 72592 for run 9fc8a76d.

### coord · 2026-10-11T09:58:05.276Z

Merged 237d152443bc6c41318c62b1139eb7b904556fb1 onto dev.
