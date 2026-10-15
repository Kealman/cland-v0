---
id: T-518
kind: task
title: An explicit --executor droplet request can reuse a cached local green and never run on Linux
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-425
blocked_by:
  - T-512
topic: topic-320
branch: t/T-518-an-explicit-executor-droplet-request-can
created: 2026-10-15T18:04:23.485Z
updated: 2026-10-15T20:41:01.264Z
closed: 2026-10-15T20:41:01.264Z
---

## Summary

The verify cache lookup in hub/src/hub/suites.ts (#cached / #start, around lines 239–248) ignores the executor. So an explicit `--executor droplet` request at a head with an earlier local green result returns that Mac result, and the Linux evidence the request was made for never runs. Found by impl-512 while fixing T-512.

## Acceptance criteria

- [x] C1. An explicit `--executor droplet` request reuses only a cached green that ran on a droplet. A local-only green triggers a fresh remote run, and the result header says why.
  - done: impl-518 · 2026-10-15T20:16:54.562Z
  - verified: rev-30 [reviewer] · run rev-20261015-518-final · 2026-10-15T20:40:32.610Z · commit d10584f9b2b013535ac91df462f37c40429d9444
- [x] C2. Requests with no executor flag keep today's cross-executor reuse. The docs describing reuse (hub/README.md Tests, docs/agents/tests.md) are updated, and a test covers both cases.
  - done: impl-518 · 2026-10-15T20:16:55.362Z
  - verified: rev-30 [reviewer] · run rev-20261015-518-source · 2026-10-15T20:18:02.262Z · commit d10584f9b2b013535ac91df462f37c40429d9444
  - verified: rev-30 [reviewer] · run rev-20261015-518-final · 2026-10-15T20:40:32.610Z · commit d10584f9b2b013535ac91df462f37c40429d9444

## Comments

### impl-518 · 2026-10-15T19:36:59.328Z

Read task, E-425 decisions and release spec §3.5/§4. Regression prepared at the public CLI/real hub seam using the existing fake remote executor: local green → omitted-flag local cache hit → explicit droplet execution with cache-bypass reason → droplet reuse even after a newer local green. Local tests are held while verify queue reports local: coord.

### impl-518 · 2026-10-15T20:16:56.167Z

Implemented executor-constrained cache search for explicit droplet requests and persisted a cache-bypass explanation in logs/result headers. Default/explicit-local cross-executor reuse is preserved. Regression red: explicit droplet reused local cached run (3.25s); green: 9.21s. Whole hub/test/executor-run.test.ts passed 21/21 (84.76s wall; regression 9.195s); npm run typecheck passed. New test has measured/reasoned duration allowance. Origin/dev merged before first review, including shared fix fe233d71. QA policy none/per-item, no QA criteria.

### rev-30 · 2026-10-15T20:18:02.262Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-518-source
commit: d10584f9b2b013535ac91df462f37c40429d9444
scope: full

Source review T-518 clear at d10584f9b2b013535ac91df462f37c40429d9444, fixed point merged dev1a7120a975817e690c3c806e3ae6b3cc54228ffd. No high, medium or low findings. Both axes reviewed directly under no-delegation role.

Standards: six-file scope is limited to cache lookup/report metadata, both reuse docs, public executor regression and its measured allowance. requiredExecutor is passed only for input.executor==='droplet', not the resolved configured default. It filters the attempt population before findLast, preserving newest-attempt failure/pending supersession within the required executor and avoiding a newer local green hiding older remote evidence. Existing cancelled/requester-death exclusions, tree/mode/selected-subset/workers/size identity, successful reported completion, artifact and age checks remain. Cached executor/platform/machine copy still reflects original execution; no requested-platform relabelling.

Spec/C1 source: explicit droplet accepts only job.executor droplet, so completed fallback jobs marked local do not qualify. If only a qualifying local green exists, fresh remote admission is retained with requireRemote/cap checks from T-512. Cache-bypass explanation is durable SuiteJob state, appended to initial log and emitted by Dispatcher in result header. --fresh bypass remains unconditional. The check does not require platform.os=Linux because the criterion is actual droplet execution, and existing executor accounting preserves platform proof.

C2 source verified: omitted executor and explicit local pass no executor restriction, retaining prior cross-executor behavior, including configured droplet default. Both README Tests and docs/agents/tests.md describe exact distinction, original-platform retention, and executor-scoped latest-attempt supersession. C2 public regression seeds local green, checks omitted-default reuse, forces explicit remote run, checks droplet reuse, creates a newer local green, then proves explicit remote still reuses older remote while omitted flag picks local.

A-3322 inspected: whole executor-run21/21, zero failure/cancel/skip, natural84.761s; new case9.195s. Requester reports red-before3.25s (old lookup returns local cache), green-after and typecheck green. Allowance9.207278417 has a concrete three-execution/four-cache-submission lifecycle reason; it is duration-only, not a baseline refresh. Whitespace check is clear. Shared fe233d71 is in merged ancestry; no review-time head edits.

C1 final runtime verification remains pending an acceptable exact-head post-source suite receipt. C2 source fact is verified, not a final-ready claim. Source clear permits the directed diff-selected verification within current Coordinator admission/spend rules; use --executor droplet --fresh where Linux proof is required. No per-item QA criteria. No Reviewer tests, edits, merges or provider calls.

Criteria: C2 verified.

### impl-518 · 2026-10-15T20:40:02.807Z

Same-head verification d0bf4b2f-f8b9-478d-b8ba-357f86f04099 passed at d10584f9: droplet c-8 lon1, Linux x64, Node v24.21.0, Neovim v0.12.5; 1843 passed, 0 failed, 3 skipped. Hub-only package plus Neovim smoke, 1175.40s suite, 1263s lifetime, $0.0877. Durable log A-3330. Reviewer received the report directly and settles final C1 evidence.

### rev-30 · 2026-10-15T20:40:32.610Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-518-final
commit: d10584f9b2b013535ac91df462f37c40429d9444
scope: evidence

Final evidence review T-518 clear at d10584f9b2b013535ac91df462f37c40429d9444. No high, medium or low findings. Standards and Spec source verdict rev-20261015-518-source / A-3323 remains the exact reviewed head.

A-3330, actual Linux c-8 lon1 droplet run d0bf4b2f-f8b9-478d-b8ba-357f86f04099, exits 0: 1843 pass, zero failures/cancellations, three platform skips. Typecheck, hub phases and Neovim smoke completed; duration 1175.40 seconds, peak one-minute load 12.43, lifetime 1263 seconds/$0.0877. Duration-regression notices are informational; no hard duration-budget failure.

C1 verified: hub/test/executor-run.test.ts:105 public CLI regression passes on Linux in 8.26042002 seconds (A-3330:1198, timing 4569). A local-only green cannot satisfy an explicit droplet request; fresh remote execution, durable cache-bypass reason and delivered result header are asserted. Subsequent explicit remote cache reuse preserves original execution provenance; newer local execution does not hide the qualifying older remote receipt.
C2 reverified: same regression establishes omitted-executor cross-executor reuse and subsequent default reuse of the newer local result. Both reuse docs and executor-filtered latest-attempt behavior were checked in source review. Existing same-tree, mode, selection, workers, size, artifact and report eligibility remain intact. Earlier whole-file Mac evidence A-3322 is corroborated by the green Linux run.

Evidence path: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3330-suite-d0bf4b2f-f8b9-478d-b8ba-357f86f04099-auto-at-d10584f.log. No per-item QA criteria. No Reviewer tests, edits, merges or provider actions. This final clearance covers only this immutable head; any conflict resolution or changed head needs delta review.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-15T20:41:01.264Z

Merged 032aae3f0a01ac3979a079716d0dfb87b8ab4e58 onto dev.
