---
id: T-469
kind: task
title: "Every stage-close cover carries a Linux proof: the sharded droplet run plus the Mac run, both required by the stage gate"
state: open
status: review
size: S
criterion_seq: 3
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-387
blocked_by: []
topic: topic-316
branch: t/T-469-every-stage-close-cover-carries-a-linux
created: 2026-10-15T09:13:16.034Z
updated: 2026-10-15T21:27:56.819Z
---

## Summary

Retrospective A-2783, START 3: 6 of 6 droplet task runs went red on Linux-only tests, and those defects surfaced only after the switch. A stage closes only when its integrated cover has passed on both platforms: T-395's sharded droplet run (Linux) and the local Mac run.

## What to build

The stage gate (`#stageCurrent` and the plan's `after-stage` close) accepts the stage-close run as evidence only when it holds a green Linux droplet result (the T-395 `--occasion stage` run) and a green macOS result at the same tree. `cland verify --occasion stage` runs both, or names the one missing. hub/README.md and the plan-epic skill say so.

## Acceptance criteria

- [x] C1. A stage with a green Mac cover but no green Linux droplet result at the same tree stays open, and `task plan show` names the missing platform.
  - done: impl-469 · 2026-10-15T20:20:12.775Z
- [x] C2. With both green at the same tree, the stage closes, proven by a fake-provider test.
  - done: impl-469 · 2026-10-15T20:20:13.848Z
- [x] C3. hub/README.md and the plan-epic skill describe the two-platform stage gate.
  - done: impl-469 · 2026-10-15T20:20:15.204Z
  - verified: rev-30 [reviewer] · run rev-20261015-469-source-correction · 2026-10-15T20:30:36.543Z · commit a54d2083b7b3bf2bc80712bf0ac9162e29a45b08

## Comments

### impl-469 · 2026-10-15T19:20:23.567Z

Implementation in progress: same-tree Linux stage and macOS full receipts now feed after-stage closure and QA freshness; plan and run reports name missing platforms/tree. Existing stage-QA fixtures now supply historical completed platform receipts; a fake-provider end-to-end test exercises Mac-only rejection, mismatched trees, both-platform closure, cache separation and next-stage activation. Typecheck passes. Targeted test window is shared with T-512/T-502 merge checks.

### impl-469 · 2026-10-15T19:36:11.366Z

Checkpoint during Coordinator cover-quiet/restart hold: implementation pushed as fb9354d747d247f8f5c3a3583667f912ab4a4bb1 after clean merge of current origin/dev including T-512 and T-519. New fake-provider platform gate 1/1 green (15.52s with measured allowance), stage-QA 12/12 green (43.58s) before that final merge. Resume on restart notice: planned-stage, suite-close, verification-tree; rerun new platform gate on merged T-512 path; final typecheck/shard lint; then source review before cland verify. No review/verify submitted during hold. Design/validation note A-3293.

### impl-469 · 2026-10-15T20:21:07.145Z

Source review requested from Reviewer at fe41f7facb01d3aaa71582b53bc1c73adf81fb59, pushed to local origin after current dev integration. All 31 targeted cases are green; final typecheck, shard lint and diff check pass. Detailed artifact A-3324. Fixed original query-budget regression without changing its assertion, and proved report-delivery retry advances the next stage. C1-C3 marked done; no per-item QA criteria. Waiting for clear source verdict before exact-head Linux verification.

### rev-30 · 2026-10-15T20:22:45.698Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-469-source
commit: fe41f7facb01d3aaa71582b53bc1c73adf81fb59
scope: full

Source review T-469 not clear at fe41f7facb01d3aaa71582b53bc1c73adf81fb59, fixed point merged dev1a7120a975817e690c3c806e3ae6b3cc54228ffd.

Medium — hub/src/hub/suites.ts:341–344: stage-droplet cache lookup builds its findLast candidate set from stageCovers(), which already discards every failed, pending or unreported attempt (:187). Consequently a green stage-droplet run A followed by a newer fresh failed stage-droplet run B at the same tree/selection/workers/size can return A on the next nonfresh stage request; B is removed before newest-attempt selection. This contradicts the preserved source comment at339 and README:2088 that a newer failed/pending fresh attempt supersedes older green evidence. It can report a cached green after the current stage attempt failed. Filter for stage/executor provenance independently of success, select the newest applicable noncancelled attempt, then apply outcome/report/completion/artifact checks. Retain historical completed-stage proof behavior separately. Add a public regression: qualifying green stage run -> same-key fresh failed run -> subsequent stage request must execute/refuse reuse; also cover a pending/unreported stage attempt so it cannot resurrect the old green.

Standards axis: the above is a documented cache-contract regression. Other reviewed boundaries remain consistent: historical committed-tree lookup uses a private Git index, immutable landing->cover ancestry runs off-request with retry notification, and recovered report eligibility notifies planned-stage scheduling. Diff whitespace passes. No Reviewer edits/tests.

Spec axis: two-platform receipt gating is otherwise present for every after-stage stage including scope none, with independent QA for non-none scope. Linux proof checks stage provenance and all sharded Linux/green children (or documented one-slot fallback); Mac proof requires local Darwin. Stage snapshots require landings covered by an ancestral Linux build and same-tree Mac, completed history survives later descendants, rollback invalidates ancestry, and public plan/results name missing platforms/tree. Per-item gate logic is retained. These source facts do not waive the cache blocker.

A-3324 targeted evidence reviewed: requester reports31 cases (stage-cover1, stage-QA12, planned-stage10, close7, verification-tree1), typecheck/shard lint green; source fixtures preserve query-budget assertions and add platform/QA/report-recovery/next-stage checks. New15.60s allowance has measured lifecycle reason. The positive cache-separation fixture does not exercise newer failed/pending attempts. Validation supplied is not proof of that negative history.

No criterion marks are added on this not-clear source pass. The finding concerns required cache/evidence validity rather than an invented failure of the direct C1/C2 happy-path scenarios. C3 docs are present but final marks wait for corrected source and gate. Do not submit full verification at this head. Fix, targeted regression evidence and a new source-review request are required before the next run. No per-item QA criteria.

### impl-469 · 2026-10-15T20:29:39.451Z

A-3325 cache-supersession finding fixed in a54d2083b7b3bf2bc80712bf0ac9162e29a45b08, pushed; no dev merge after first review. Failed and unreported stage negative-history cases were each observed red before the fix and green after it. Full stage-cover file3/3 and ordinary cache file6/6 green; measured allowances committed; final typecheck/shard lint/diff check pass. Source re-review requested with artifact A-3326. No full verification submitted; Coordinator new-droplet hold remains in force.

### rev-30 · 2026-10-15T20:30:36.543Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-469-source-correction
commit: a54d2083b7b3bf2bc80712bf0ac9162e29a45b08
scope: delta

Source re-review T-469 clear at a54d2083b7b3bf2bc80712bf0ac9162e29a45b08, delta from previously reviewed fe41f7facb01d3aaa71582b53bc1c73adf81fb59. No high, medium or low findings remain. A-3325's cache supersession blocker is resolved.

Standards: the findLast population now filters only same tree/mode/selected-subset/workers/size, cancellation exclusions and stage executor/occasion provenance. It includes newer failed, pending or unreported attempts; the existing success/report/finished/artifact checks run only after newest-attempt selection. Stage platform/sharded-proof eligibility follows those checks instead of prefiltering them. This restores the documented latest-attempt supersession contract while leaving historical completed-stage proof selection separate and unchanged. No dev merge after first review; source delta is suites.ts plus two public regressions and measured duration entries.

Spec/negative history: new fake-provider cases seed qualifying Linux stage green, then same-tree fresh failed or successful-but-unreported attempt, then nonfresh stage request. Both require no cache hit and a newly executed green, with report recovery and all droplets collected. Failure trigger lives outside the candidate checkout, preserving same-key identity. The blocked-report case observes completed outcome and loop-breaker error before the third request, then unmutes and joins both reports. Requester recorded red against fe41f7fa (old green reused) and green after fix. A-3326 reports complete stage-cover3/3 (34.71s, prior platform/history/QA/report-recovery case retained) plus ordinary cache6/6 (31.28s). The two new11.13s/11.12s allowances have measured multi-run lifecycle reasons, preserve prior budgets/values and keep file below60s. Typecheck/shard lint reported green; whitespace check is clear.

Broader first-pass source facts remain: every after-stage stage including scope none requires completed same-tree local Darwin and Linux stage-droplet evidence; scoped stages independently require current QA at that tested tree. Landings must be contained in an ancestral Linux build, rollback removes eligibility, later descendants retain completed historical proof. Plan/results name missing platforms/tree, report recovery notifies next-stage scheduling, and historical tree lookup uses a private index. Per-item gates stay unchanged. Both README and plan-epic guidance describe the two-platform requirement; C3 source verified.

C1/C2 final runtime marks remain pending acceptable exact-head post-source verification. Prior targeted cases and A-3326 do not substitute for that gate. Coordinator f2fe5d34-ccf9-4967-988f-b42faab2c740 currently holds NEW DROPLET verifies until E-387 stage run has bundled; existing runs finish, targeted/local-only work is separately permitted. This clearance does not lift that hold. After its explicit release, submit one exact-head diff-selected Linux verification; any changed head needs new source review.

No Reviewer tests, edits, merges or provider calls.

Criteria: C3 verified.

### impl-469 · 2026-10-15T20:40:03.086Z

Source correction clear at a54d2083 (A-3327), C3 verified. After explicit hold release, submitted cland verify with no mode and --executor droplet --fresh, report topic-316 to Reviewer rev-30 and item lead. Run 59810133-257b-4b3f-8004-6a766be94a76 is queued position1. Exact reviewed head remains clean and unchanged. Awaiting hub result before final evidence review.

### rev-30 · 2026-10-15T21:04:30.192Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-469-linux-first
commit: a54d2083b7b3bf2bc80712bf0ac9162e29a45b08
scope: evidence

Evidence review T-469 not clear at a54d2083b7b3bf2bc80712bf0ac9162e29a45b08.

Medium — hub/src/tracker/tracker.ts:1803 and hub/test/task-card.test.ts:113: integrated verification callbacks enumerate this.#index.list() and refresh plans globally. Linux receipt A-3351 observes one full tracker hydration where completion must perform zero, failing the bounded/coalesced completion contract. Restrict refresh to indexed affected stage containers rather than restoring full-list work on every integrated run update; preserve the existing zero-full-list assertion.

Medium — hub/test/planned-stage.test.ts:260: stage landing uses 10456 tracker queries with 64 unrelated items and eight unrelated plans, exceeding the existing <10000 budget. This is the task's modified stage path, not an admitted known outside flake. Diagnose stage-cover/planned refresh work and keep the query assertion; the new proof gate must preserve unrelated-plan isolation. Exact root cause of this count remains under Implementer diagnosis, so no unsupported attribution of every excess query to a specific callback.

A-3351 /59810133 is actual Linux c-8 lon1, exit1, 1831 pass/two failures/three platform skips. Typecheck and hub phases completed; Neovim was not reached. Query failure details at lines4132–4144; full-list assertion at4147–4162. Duration-regression notices are separate and do not explain these functional assertions.

Standards: source/cached-attempt correction A-3327 remains the reviewed implementation, but these runtime regressions block final clearance. Spec: C1/C2 platform-proof runtime marks remain pending a successful post-correction gate; C3 source documentation mark remains current. No failure is inferred for the platform criteria from the unrelated general query budgets themselves; the concrete performance regressions still make this review not clear.

Implementer d35abfc7 confirms diagnosis of the added refresh callbacks, no unchanged flake retry, preservation of both assertions, and targeted reproduction only after T-427's exclusive timing window. An implementation correction requires a new source review before another verification. No Reviewer tests, edits, merges or provider actions.
Evidence path: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3351-suite-59810133-257b-4b3f-8004-6a766be94a76-auto-at-a54d208.log.

### impl-469 · 2026-10-15T21:27:42.815Z

A-3358 completion regression corrected and pushed at6d7ef2e58241111b07783af70df96504ba6dd203. Task-card6/6:46 completion queries/0 full lists/0 item reads. Stage-cover whole file3/3;69.595432s loaded test sum recorded as measured file allowance. Requested clean dev/task landing comparison: devf8000c3d9645, task9788/9795; close7833/7834/7901; all original query assertions retained. Coordinator approved proceeding in7b0c7a3f. #tipsMoved/#hydrate/Worktrees unchanged; no post-review dev merge. A-3378 carries evidence. Source delta review requested; verification waits for stage close admitted.
