---
id: T-322
kind: task
title: "D25: Implementers verify only after a clear review verdict, at the exact reviewed head (clauses and skills)"
state: open
status: review
criterion_seq: 3
labels:
  - tech-debt
  - hub
  - ready-for-agent
assignee: null
parent: E-216
blocked_by: []
topic: topic-201
branch: t/T-322-d25-implementers-verify-only-after-a
created: 2026-10-13T10:34:03.049Z
updated: 2026-10-13T12:27:37.371Z
---

## Summary

Decision D25 (`docs/spec/v0.1.md` §4, 2026-10-13): an Implementer requests review first. When the verdict on its source is clear, it runs `cland verify` at the exact reviewed head. A fix after a verdict needs a new review before a new run. The reason: 79 full runs for 26 merges, and 42% of verdicts not clear, so runs launched alongside a review request mostly burned on the next fix. This item puts the rule into the clauses and the skills.

## What to build

- The Implementer clause, and the Lead clause where it requests review, in `hub/src/roles/default-roles.ts` and in this project's `.cland/roles.toml`. The clause states: "request review first; when the verdict is clear, run `cland verify` at the exact reviewed head; a fix after the verdict needs a new review before a new run".
- The Reviewer clause, if it says it waits for a full run before reviewing source: the Reviewer reviews source first and records the final verdict when the post-verdict run lands at the same head.
- Any skill text that says otherwise: the `merge`, `qa` and `code-review` skills, and `docs/agents/issue-tracker.md` if it describes the loop. Vendored skills record their patch in `skills/PATCHES.md`.
- The tree-hash cache stays: an unchanged head after review reuses an earlier green run. State that in the clause.
- The roles snapshot tests pin the new text.

## Constraints

- No hub behaviour change beyond the clause text. The merge gate and verdict rules are unchanged.
- Tests through the frame protocol where they touch delivery, and snapshot tests for the text.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. English everywhere.
- The Coordinator clause changes if it describes the loop, so the Coordinator relaunches after the merge. The clause rides the next hub restart.

## Acceptance criteria

- [x] C1. The default Implementer clause, and the Lead clause where it requests review, state the D25 order: review first, verify after a clear verdict at the exact reviewed head, and a new review after a fix. `.cland/roles.toml` carries the same text.
  - done: impl-322 · 2026-10-13T10:39:49.880Z
  - verified: rev-26 [reviewer] · run rev-20261013-322-source-1 · 2026-10-13T10:50:33.052Z · commit e54bba10d40d0115225b62a98377a411b8e271b7
  - verified: rev-26 [reviewer] · run rev-20261013-322-source-2 · 2026-10-13T11:46:41.900Z · commit c4ad029914dbf1dacb98f56e4e74133e66921386
  - verified: rev-26 [reviewer] · run rev-20261013-322-source-3 · 2026-10-13T12:25:30.883Z · commit 6acf2f3749ca1c8dd2fe85fd48805e28cfbebc9e
- [x] C2. The Reviewer clause and the merge, qa and code-review skills agree with the order, with vendored patches recorded.
  - done: impl-322 · 2026-10-13T10:39:50.842Z
  - verified: rev-26 [reviewer] · run rev-20261013-322-source-1 · 2026-10-13T10:50:33.052Z · commit e54bba10d40d0115225b62a98377a411b8e271b7
  - verified: rev-26 [reviewer] · run rev-20261013-322-source-2 · 2026-10-13T11:46:41.900Z · commit c4ad029914dbf1dacb98f56e4e74133e66921386
  - verified: rev-26 [reviewer] · run rev-20261013-322-source-3 · 2026-10-13T12:25:30.883Z · commit 6acf2f3749ca1c8dd2fe85fd48805e28cfbebc9e
- [ ] C3. The roles snapshot tests pass with the new text, and `cland verify` is green.
  - failed: rev-26 [reviewer] · 2026-10-13T12:12:25.053Z · note Accepted full A-1931 exits1: 29 hub failures, including roles.test.ts:263 clause-first-turn timeout and inbox-workload.test.ts:113 stop-7 OS probe refusal; Neovim not reached.

## Comments

### impl-322 · 2026-10-13T10:35:20.373Z

D25 implementation started. Updating default and project clauses, source/final reviewer workflow, merge/QA/code-review/implement skills, and linked test/review guidance. No hub behavior or gate change. Full verification will follow a clear source review at its exact head.

### rev-26 · 2026-10-13T10:50:33.052Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261013-322-source-1
commit: e54bba10d40d0115225b62a98377a411b8e271b7

Source review under D25: no high/medium finding. C1 default/project clauses implement review-first, exact-head post-clear verification, renewed review after fixes/merge head changes, cache reuse and final-verdict merge ordering. C2 Reviewer and code-review/merge/qa/implement skills plus docs/template agree; vendored patches recorded with unchanged upstream lock hashes. hub/test/roles.test.ts:53–88 pins default/project real-spoke clause delivery including Lead; no production/grant/cache/gate change. C3 remains unverified pending post-verdict full green receipt. T-317 integration needs renewed source review at any changed head before verification; Coordinator relaunch after merge required. Evidence artifact records both review axes.

Criteria: C1 verified, C2 verified.

### impl-322 · 2026-10-13T10:50:48.482Z

Source review clear at e54bba10d40d0115225b62a98377a411b8e271b7, run rev-20261013-322-source-1, C1/C2 verified (A-1912). C3 remains pending. Per Coordinator and Reviewer instructions, waiting for T-317 integration before merging origin/dev, requesting review of that changed head, and submitting exact-head verification in protected machine order.

### rev-26 · 2026-10-13T11:46:41.900Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261013-322-source-2
commit: c4ad029914dbf1dacb98f56e4e74133e66921386

Source review under D25: no high/medium finding. C1/C2 renewed. Merge combined diff preserves default/project category-aware Coordinator/Lead routing and D25 ordering, tracker template Review/Categories/migration sections, both QA and vendored patch entries. Independently compared changed lines: task delta versus current dev identical to A-1912's reviewed12-file77+/24- delta; no production/grant/cache/gate change. git diff --check clean. C3 post-verdict full same-head cland verify still pending; source clear only. Coordinator relaunch after eventual merge required. Artifact records Standards/Spec integration assessment.

Criteria: C1 verified, C2 verified.

### rev-26 · 2026-10-13T12:12:25.053Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261013-322-final-1
commit: c4ad029914dbf1dacb98f56e4e74133e66921386

Medium — hub/test/roles.test.ts:263: launched Coordinator first-turn clause case times out15000ms, so required complete role suite is not green. Both changed default/project D25 snapshot cases pass, but that does not satisfy C3. Medium — hub/test/inbox-workload.test.ts:113: stop-7 returns cannot inspect the OS process table: ps failed or timed out. A-1931 full bdc5895c exits1: free36/36, machine1429tests1400pass29fail, total1465/1436pass29fail; no cancel/skip/todo, Neovim not started. Broad fake-harness/frame timeouts preserved; cause not inferred. C1/C2 source marks remain current; final readiness not clear. Artifact records evidence. Corrected/integrated head requires renewed source review before another run under D25; no Reviewer tests or retries.

Criteria: C3 failed (Accepted full A-1931 exits1: 29 hub failures, including roles.test.ts:263 clause-first-turn timeout and inbox-workload.test.ts:113 stop-7 OS probe refusal; Neovim not reached.).

### impl-322 · 2026-10-13T12:17:24.584Z

Diagnosis: full run bdc5895c peaked at 1m load 14.74, but isolated Claude adapter checks show a T-322-specific failure (dev 51c9d67: 6/6 pass; c4ad029: 4/6 pass, 2 clause-echo timeouts). OpenCode at c4ad029: 11/19 pass, 8 clause-echo timeouts; dev comparison running. T-322 grows the project Coordinator clause echo from 7909 to 8265 UTF-8 bytes across the 8192-byte send cap. Tightening wording without dropping D25/T-317 rules. Regression guard reserves 512 bytes below MAX_TEXT_BYTES for every default and project role's delivered clause reply, including staffing text. Full run will wait for T-321 integration and new source review.

### impl-322 · 2026-10-13T12:23:19.352Z

Byte-budget fix pushed at 6acf2f3749ca1c8dd2fe85fd48805e28cfbebc9e after merging origin/dev 51c9d67. Tightened Coordinator wording in defaults/project with all rules retained; added delivered-clause reply budget for all six roles, reserving 512 bytes under the 8192 cap. Final Coordinator replies: defaults 7628, project 7672 bytes. Regression guard was red before fix, green after. Fixed whole Claude adapter 6/6 and OpenCode adapter 19/19; whole roles 8/8 after tightening, final snapshots 2/2 after last wording adjustment. Isolated baseline/failed/fixed logs and diagnosis are in A-1937. C3 remains pending T-321 integration, exact-head source review and green full run.

### rev-26 · 2026-10-13T12:25:30.883Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261013-322-source-3
commit: 6acf2f3749ca1c8dd2fe85fd48805e28cfbebc9e

Source review: no high/medium finding in byte correction. C1/C2 renewed. Default/project Coordinator shortening preserves decision/ask routing, epic/staffing order, item QA/lead duties, rescue evidence, merge/override rules, subscriptions/resume and unchanged D25/T-317 clauses. roles.test.ts:76 measures every default/project delivered role clause pong reply as UTF-8 against unchanged8192 cap with512headroom; existing assertions retained. A-1937 isolated baseline/red/fixed logs establish clause-byte failure and corrected Claude6/6, OpenCode19/19, roles8/8; delivered byte guard red8233/8277 and final reported7628/7672. No production/grant/cache/gate/cap change; git diff --check clean. C3 remains failed/pending full; A-1931 preserved. Coordinator requires T-321 integration before next full, renewed exact-head source review after merge. Artifact records evidence; Coordinator relaunch after eventual merge required.

Criteria: C1 verified, C2 verified.
