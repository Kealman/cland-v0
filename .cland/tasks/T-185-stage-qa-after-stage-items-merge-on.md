---
id: T-185
kind: task
title: "Stage QA: after-stage items merge on review; one QA run on dev closes
  the stage with a verdict naming it"
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: impl-185
parent: E-114
blocked_by:
  - T-184
topic: topic-117
branch: t/T-185-stage-qa-after-stage-items-merge-on
created: 2026-10-10T15:38:37.751Z
updated: 2026-10-11T07:13:15.111Z
---

## Parent

T-114, slice 3 of 6. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

After-stage items merge on review alone; one QA run on `dev` closes the stage with a verdict on the epic naming the stage; a not-clear stage verdict keeps the stage open; the `qa` skill writes a stage brief.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-185 · 2026-10-11T05:36:34.324Z
  - verified: rev-14 [reviewer] · run rev-20261011-185-3 · 2026-10-11T05:37:57.440Z
- [x] C2. Demo: three items merge on review, then one QA run closes stage 1.
  - done: impl-185 · 2026-10-11T05:09:41.745Z
  - verified: rev-14 [reviewer] · run rev-20261011-185-1 · 2026-10-11T05:17:37.998Z
  - verified: rev-14 [reviewer] · run rev-20261011-185-2 · 2026-10-11T05:31:24.825Z
  - verified: rev-14 [reviewer] · run rev-20261011-185-3 · 2026-10-11T05:37:57.440Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-185 · 2026-10-11T05:09:41.877Z
  - verified: rev-14 [reviewer] · run rev-20261011-185-1 · 2026-10-11T05:17:38.167Z
  - verified: rev-14 [reviewer] · run rev-20261011-185-2 · 2026-10-11T05:31:25.010Z
  - verified: rev-14 [reviewer] · run rev-20261011-185-3 · 2026-10-11T05:37:57.440Z
- [x] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
  - done: impl-185 · 2026-10-11T07:09:53.436Z
  - verified: rev-14 [reviewer] · run rev-20261011-185-4 · 2026-10-11T07:12:16.764Z

## Comments

### impl-185 · 2026-10-11T04:55:53.968Z

Claimed worktree at dev 438e53e. Reading §3.10, T-114 constraints and merged T-184 policy/T-186 approval seams. Implementing epic stage QA verdicts on dev, persistent stage closure/freshness, and stage briefs; item merges continue to use review-only after-stage policy.

### impl-185 · 2026-10-11T05:07:26.763Z

Committed and pushed 782a279a55f8f574e3c0166eb313653984850b27. origin/dev fetched and merged (already current at 438e53e). Structured stage verdicts/progress, dev/merge/snapshot checks, epic-demo separation, override scope, stage brief workflow and exact QA role handover are implemented. Existing plan-gate regression file passes 8/8; Node24.21.0 typecheck passes. Final-head stage test file is finishing; C4 awaits the required full suite.

### impl-185 · 2026-10-11T05:09:14.676Z

Final-head targeted file at 782a279 passed first five cases; the sixth caught a test-edit mistake: an override assertion was accidentally duplicated after the publication race intentionally reopened a member, so the hub correctly refused QA. Removed only the misplaced five-line test setup in 413a65a; production source is unchanged. Re-running all three publication races. Fetched/merged origin/dev (already current) and pushed 413a65a.

### rev-14 · 2026-10-11T05:17:38.425Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261011-185-1
commit: 413a65afc90f01f3bbb3195da7154c38f9444517

Medium — hub/src/tracker/tracker.ts:1121: stageCurrent never checks current dev ancestry, so dev rollback before stage landings leaves closed/current evidence and may advance work without the integrated changes.
Medium — hub/src/tracker/tracker.ts:1564: raw source is compared to serializeItem(item), so valid quoted frontmatter refuses QA as a concurrent change without any edit during publication.
Medium — .agents/skills/qa/SKILL.md:23 and hub/src/hub/dispatch.ts:367: the new qa request T-n stage … first line bypasses the Lead subtree check; a foreign epic stage request is accepted where ordinary QA is forbidden.
All three confirmed by independent real-class memory diagnostics. Standards: no findings. Spec: three medium findings. C1 failed; C2/C3 separately verified; C4 pending. Evidence A-1060 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1060-t-185-review-not-clear-at-413a65a-closure-source-format-and-request-scope.md.

Criteria: C1 failed (Stage closure survives dev losing its merges; valid noncanonical Markdown refuses stage QA; new stage request shape bypasses Lead subtree check.).

### impl-185 · 2026-10-11T05:24:56.803Z

Fixed all three C1 review findings in fb22172 and merged latest origin/dev da0d0c4; pushed clean head 37f23f2d3e58eceb749ffbe63ef1f97faf0dbbd4. Stage closure now uses background tested-build ancestry, canonical source admission preserves raw-byte publication checks, and stage QA requests enter the Lead subtree guard. Real daemon/spoke regressions pass: nine stage cases A-1074, added failure-ancestry A-1075 and formatting race A-1076; existing freshness 5/5 A-1072. Original failing diagnostics retained A-1070/A-1071. C4 remains pending; previous obsolete-head suite was deliberately cancelled (A-1062). Requesting re-review, then the required all suite on the merged correction head.

### rev-14 · 2026-10-11T05:31:25.134Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261011-185-2
commit: 37f23f2d3e58eceb749ffbe63ef1f97faf0dbbd4

Medium — hub/src/tracker/freshness.ts:274: thrown ancestry computations become permanent false cache entries; lines 170–171 return them without retry even after Git recovers at the same dev SHA. A qualifying stage remains open until dev changes or the hub restarts. The regression at hub/test/stage-qa.test.ts:204 advances dev after recovery and misses this case. Add bounded background retry plus same-SHA recovery coverage.
The three original A-1060 findings are corrected. Standards: no findings. Spec: one medium finding. C1 failed; C2/C3 separately reverified for this run; C4 remains pending. Actual-Freshness memory diagnostic confirms no second merge-base call after Git recovery. Evidence A-1079 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1079-t-185-correction-review-not-clear-at-37f23f2-same-tip-ancestry-recovery.md.

Criteria: C1 failed (A transient ancestry computation failure is cached false indefinitely at the unchanged dev SHA; restoring Git does not retry or close the qualifying stage.).

### impl-185 · 2026-10-11T05:36:34.267Z

Corrected A-1079 same-tip recovery in pushed 464561e2822645531bf002a2cf186eebe31d6cf9. Thrown ancestry errors now retry on the bounded background tip schedule, including unchanged dev; true negative ancestry remains cached. Tightened real-daemon regression confirms a Git subprocess error before restoring it and requires unchanged-SHA closure: red A-1081, green integrated/recovery/rollback 3/3 A-1082; existing freshness 5/5 A-1083. Fetched/merged origin/dev da0d0c4 (already current). Docs describe retries; exact role handover unchanged. C4 awaits the new required full suite; old 37f23f2 run deliberately cancelled A-1080.

### rev-14 · 2026-10-11T05:37:57.440Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-185-3
commit: 464561e2822645531bf002a2cf186eebe31d6cf9

No high or medium findings remain. Standards and Spec are both clear. A-1079 same-SHA recovery is resolved: only thrown ancestry errors retry on the bounded background schedule, completed negatives stay false, waiting items receive recovery notifications, and stop/obsolete-tip pruning discard retries. The real subprocess regression restores Git without moving dev. Actual-Freshness memory diagnostic independently confirms the retry bound, same-SHA recovery, all waiters, negatives and cleanup. A-1082 recovery/rollback/demo 3/3 and A-1083 freshness 5/5 pass. C1/C2/C3 verified; C4 remains pending complete current-head typecheck/hub/Neovim evidence, with no exceptions. Evidence A-1085 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1085-t-185-same-sha-ancestry-recovery-clear-at-464561e-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-185 · 2026-10-11T07:09:53.308Z

Complete final-head suite ee9e75be-ee70-484b-b897-10497cd00180 passed at unchanged pushed head 464561e2822645531bf002a2cf186eebe31d6cf9. Typecheck (hub and Neovim) passed; hub 1145/1145 and Neovim 253/253 passed, total 1398, zero failures/cancellations/skips/todos. Durable log A-1106 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1106-suite-ee9e75be-ee70-484b-b897-10497cd00180-all-at-464561e.log. Worktree remains clean. Marking C4 done and requesting rev-14 verification; C1–C3 already verified at this head. Holding the claim for the supervising merge gate.

### rev-14 · 2026-10-11T07:12:16.764Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-185-4
commit: 464561e2822645531bf002a2cf186eebe31d6cf9

Standards: no new findings; prior A-1085 source clearance remains applicable at this unchanged head.
Spec: no outstanding high/medium findings. C4 verified from complete A-1106: hub and Neovim typecheck, hub 1145/1145 and Neovim 253/253; 1398 total, exit 0, zero failure/cancellation/skip/todo. No exceptions. C1–C3 retain rev-20261011-185-3 verification at this exact commit.
Review evidence A-1107: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1107-t-185-final-c4-verification-clear-at-464561e-1398-tests.md. HEAD/origin match the pinned commit and worktree is clean.

Criteria: C4 verified.

### coord · 2026-10-11T07:13:15.111Z

Merged 343226b4bf1cbe71040eaf0c537b6dd8e56bacf4 onto dev.
