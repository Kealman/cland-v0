---
id: T-254
kind: task
title: A cancelled suite attempt should not supersede green cache evidence for its tree
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - hub
  - v0.1.2
  - ready-for-agent
assignee: null
parent: E-273
blocked_by: []
topic: topic-269
branch: t/T-254-a-cancelled-suite-attempt-should-not
created: 2026-10-12T01:42:45.744Z
updated: 2026-10-15T06:31:58.456Z
closed: 2026-10-15T06:31:58.456Z
---

## Parent

Found by qa-22 during the T-230 epic QA demo (topic-165, 2026-10-12 01:42Z), M7(a). Refines T-233.

## What happened

`#cached` in hub/src/hub/suites.ts takes the newest fresh attempt for a tree and mode, and that attempt alone decides the cache. A suite cancelled because its requester died (T-212) therefore supersedes an earlier green result for the identical tree, and the next verification runs the full suite again. This fails safe: nothing wrongly reuses. But a cancellation says nothing about the tree, and a needless rerun costs a full suite slot on a budget-1 queue.

## What to build

A cancelled attempt (by its requester, by requester death, or by a head change before admission) no longer supersedes green evidence for its tree. A failed attempt (a test failure, a worker crash or a timeout) still does.

## Acceptance criteria

- [x] C1. Green, then cancelled, then a request on the same tree: a cache hit naming the green run; a test proves it.
  - done: impl-254 · 2026-10-15T03:54:04.313Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-254-5 · 2026-10-15T06:31:45.202Z · commit d8167992c3ce6e1e16d4d12c1dc91564433218b3
- [x] C2. Green, then failed, then a request on the same tree: a fresh run; a test proves it.
  - done: impl-254 · 2026-10-15T03:54:05.398Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-254-5 · 2026-10-15T06:31:45.202Z · commit d8167992c3ce6e1e16d4d12c1dc91564433218b3
- [x] C3. hub/README.md's cache paragraph states the rule.
  - done: impl-254 · 2026-10-15T03:54:06.442Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-254-1 · 2026-10-15T03:55:12.886Z · commit 871876cc7f691d0a4f9bde479a8178f6c29fc39b
  - verified: rev-23 [reviewer] · run rev-2026-10-15-254-3 · 2026-10-15T05:52:24.965Z · commit d8167992c3ce6e1e16d4d12c1dc91564433218b3
  - verified: rev-23 [reviewer] · run rev-2026-10-15-254-5 · 2026-10-15T06:31:45.202Z · commit d8167992c3ce6e1e16d4d12c1dc91564433218b3

## Comments

### impl-254 · 2026-10-15T03:45:21.300Z

Read task and E-273. Regression seam is the epic-prescribed real hub/spoke CLI/socket harness in hub/test/suite.test.ts. Existing green→fresh-failure→request coverage proves C2; adding green→queued cancellation→request coverage before the implementation change.

### impl-254 · 2026-10-15T03:54:07.459Z

Implemented cancellation-aware cache lookup for explicit requester cancellation, requester death, and queued head changes; failed and pending attempts still invalidate older green evidence. Added CLI/socket regressions for explicit/head-change cancellation and extended requester-death coverage to prove reuse across restart. C2 remains covered by the existing green→fresh failure→fresh execution test. Validation: red reproduced at missing cached.run; focused cases 4/4 pass; node --test hub/test/suite.test.ts 69/69 pass (393.2s); npm run typecheck passes; git diff --check clean. origin/dev merged before review (2f476ae2, tracker-only).

### rev-23 · 2026-10-15T03:55:12.886Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-254-1
commit: 871876cc7f691d0a4f9bde479a8178f6c29fc39b
scope: full

Source clear at 871876cc7f691d0a4f9bde479a8178f6c29fc39b. Standards and Spec: no high or medium findings. Cache lookup skips explicit cancellation, requester death and queued-head-change cancellation before choosing newest same-tree/effective-mode fresh evidence; failed and pending attempts still block older green. Completion/report/artifact/age/dirty-tree checks and original expiry remain. Reviewed persisted state, cancellation outcome reconciliation and launch paths. CLI/socket regressions check original green run reuse and unchanged execution count for requester/head-change cancellations, plus requester-death reuse across restart; existing green→failed→fresh regression remains intact. C3 README rule verified. C1/C2 remain run-dependent pending exact-head no-mode --executor local gate. A-2668 records source review; A-2667 reported targeted/69-case/typecheck evidence supports it. No per-item QA required.

Criteria: C3 verified.

### impl-254 · 2026-10-15T04:29:19.077Z

Same-head local verification 938db829 at 871876cc failed 1/1700 tests: account-limited.test.ts:236 recent failed-poll backoff case, deferred reset not within 15000ms at line 261. T-254 cancellation regressions passed. Log A-2679. Asked lead for a known shared dev fix/next step as instructed; no unrelated patch or rerun started.

### rev-23 · 2026-10-15T04:29:31.161Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-254-2
commit: 871876cc7f691d0a4f9bde479a8178f6c29fc39b
scope: evidence

Gate 938db829/A-2679 not clear: typecheck passes; 1699/1700 hub tests pass, exit 1, no skips/cancellations, Neovim not reached. Sole untouched failure account-limited.test.ts:261 recent failed-poll-backoff case: deferred poll supplies reset not within 15000 ms. Cache cancellation/death/restart and failure-invalidation cases pass. Find aside Bugs/S reported for lead disposition; precise cause unproven (T-366 feature, T-440 timing work related). C1/C2/final green remain pending; C3 source remains valid. No own criterion failure inferred. Standing single-retry rule requires exact-head five isolated passes and aside evidence first; no automatic retry clearance asserted here. A-2680 records evidence. Source basis is A-2669 (correcting the prior source verdict's A-2668 transcription).

### impl-254 · 2026-10-15T04:36:42.494Z

Coordinator-directed serial isolated account-limited.test.ts runs at unchanged 871876cc: runs 1–3 passed 10/10 (A-2681, A-2682, A-2683); run 4 failed 9/10 with same 15000ms deferred reset timeout at account-limited.test.ts:261 (A-2684). Stopped before run 5 and no verify retry, per decision that any isolated failure becomes a shared fix. Reported durable log to Coordinator and rev-23; awaiting named shared correction.

### impl-254 · 2026-10-15T05:51:58.185Z

Coordinator-directed shared correction fe4efed8 (T-451) cherry-picked exactly as d8167992c3ce6e1e16d4d12c1dc91564433218b3 and pushed. Only hub/test/account-limited.test.ts changes relative to reviewed 871876cc. Whole-file targeted run passed 10/10 (83.3s), including recent failed-poll backoff (16.79s). Evidence A-2697: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2697-t-254-targeted-account-limited-after-shared-t-451-pick-10-pass-at-d8167992.log. Tree clean; requesting delta source review of the pick before new local no-mode verification.

### rev-23 · 2026-10-15T05:52:24.965Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-254-3
commit: d8167992c3ce6e1e16d4d12c1dc91564433218b3
scope: delta

Delta source clear at d8167992. Standards and Spec: no high or medium findings. Independently compared full patches: exact landed T-451 fe4efed8, only account-limited.test.ts +4/-2, no original T-254 changes. Wait uses the unchanged 16 s/12 s assertion delay plus 5 s completion margin, preserving no-early-read/duplicate/reset/notice/refresh/restart assertions. A-2697 complete file checked: 10/10, no failures/cancellations/skips/todos, 83.332 s. C3 README refreshed from unchanged source; C1/C2 remain pending new exact-head complete gate. A-2698 details review. Earlier 938db829/A-2679 and isolated A-2684 stay red on diagnosed T-451; shared fix adoption replaces the nonqualifying flaky retry path. Submit local no-mode verification at this head.

Criteria: C3 verified.

### impl-254 · 2026-10-15T06:06:56.081Z

Local no-mode verification b6f1e5ff at delta-reviewed d8167992 failed 2/1698. Claude late-hook test times out in clauseTurnDone waiting for clause busy→idle (claude-code-sessions.test.ts:44,128); executor-run.test.ts scan:45 fails ENOENT on transient spend.json.lock.break. Corrected account backoff test passes. Evidence A-2699. Reported both S Bugs aside and asked lead for known shared fix commits or isolation direction. Source unchanged; no retry/patch started.

### rev-23 · 2026-10-15T06:07:26.288Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-254-4
commit: d8167992c3ce6e1e16d4d12c1dc91564433218b3
scope: evidence

Gate b6f1e5ff/A-2699 not clear: typecheck passes, 1696/1698 hub tests pass, exit 1, zero skips/cancellations, Neovim not reached. Untouched failures: claude-code-sessions.test.ts:44/128 clause busy→idle setup timeout (T-447 family); executor-run.test.ts:45-51 live sentinel audit ENOENT on spend.json.lock.break. The latter occurs after cross-executor cached.run assertion line 38 passes, so no own cache defect inferred. T-389 fixed the audit class in executor-safety.test.ts, a different file; shared disposition requested for this exact occurrence. Own cache regression cases and T-451 account cases pass. Two failures do not qualify for unchanged single-flake retry. Hold for lead diagnosis/shared correction, new source review if head changes. C1/C2/final green remain pending; C3 source mark/A-2698 remain applicable. Earlier 938db829/A-2679 and A-2684 retained as corrected T-451. A-2700 details both stacks/finds aside; no own criterion failure inferred.

### impl-254 · 2026-10-15T06:15:51.616Z

Coordinator decision 91739ccc isolation complete at unchanged d8167992: claude-code-sessions.test.ts 5/5 whole-file passes, 12/12 each (A-2701–A-2705); executor-run.test.ts 5/5 whole-file passes, 18/18 each (A-2706, A-2707, A-2708, A-2709, A-2710). All ten runs serial; no source changes. Submitting one authorized same-head local no-mode verify retry; retain prior red b6f1e5ff/A-2699 alongside the new result.

### impl-254 · 2026-10-15T06:31:10.354Z

Authorized unchanged-head retry c110dbe4 at d8167992 passed 2087/2087 tests, local darwin arm64, auto-selected full including Neovim, 893.6s. Log A-2711. Prior red b6f1e5ff/A-2699 and ten serial whole-file isolation passes A-2701–A-2710 retained as required by Coordinator decision 91739ccc. Source unchanged and tree clean; final Reviewer evidence verdict pending.

### rev-23 · 2026-10-15T06:31:45.202Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-254-5
commit: d8167992c3ce6e1e16d4d12c1dc91564433218b3
scope: evidence

Final clear at unchanged source-reviewed d8167992. Standards and Spec: no high or medium findings. Full local no-mode c110dbe4/A-2711 passes root typecheck and 2087/2087 (37 free hub, 1663 machine hub, 387 Neovim), zero failures/cancellations/skips/todos, exit 0. C1 requester/head-change cancellations reuse original green without extra execution; requester death retains it across restart. C2 green→fresh failure→request executes fresh; C3 README unchanged. All done marks/head checked. Prior same-head red b6f1e5ff/A-2699 retained: clause busy→idle setup (T-447 family) and live executor sentinel scan ENOENT (T-453); cache assertion preceded scan failure. Direct Coordinator 91739ccc explicitly authorized one retry after both files 5/5 whole-file serial: audited A-2701–A-2705 each 12/12 and A-2706–A-2710 each 18/18, zero failures/skips/cancellations. No source change before this single green retry; no broader multi-failure retry rule inferred. Earlier 938db829/A-2679 and isolated A-2684 retained as T-451, corrected by reviewed exact shared pick A-2698. Source bases A-2669/A-2698 current. A-2712 details complete evidence; C1-C3 verified.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-15T06:31:58.456Z

Merged 8b2a3d7a6c8ba71ed74b06cd5754462ab4814f8d onto dev.
