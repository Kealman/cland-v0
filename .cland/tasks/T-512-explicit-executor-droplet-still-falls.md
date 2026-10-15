---
id: T-512
kind: task
title: Explicit --executor droplet still falls back to the Mac when the remote budget is full
state: open
status: ready
size: S
rank: 3090
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-425
blocked_by: []
topic: topic-312
branch: t/T-512-explicit-executor-droplet-still-falls
created: 2026-10-15T16:25:28.989Z
updated: 2026-10-15T19:33:50.720Z
---

## Summary

`cland verify --executor droplet` falls back to the local Mac slot when the remote budget is full, the same as a run with no flag. A run that needs Linux evidence therefore can't wait for a droplet. On 2026-10-15 at 16:21Z, impl-485's 34841ef7, submitted with `--executor droplet`, was admitted locally with "remote budget 4/4 full", and earlier runs did the same. The fallback also adds a full local run to an already busy Mac.

## Acceptance criteria

- [x] C1. A run submitted with an explicit `--executor droplet` waits in the queue for a remote slot or budget and never falls back to local. The queue shows it as waiting for remote, with its position.
  - verified: rev-30 [reviewer] · run rev-20261015-512-final · 2026-10-15T18:39:58.288Z · commit a4ad9640cfdd534d8ed03c1f0955e1a33d0f93d3
  - verified: rev-30 [reviewer] · run rev-20261015-512-integration-final · 2026-10-15T19:32:44.846Z · commit 0222b1eeefaea32fe7a7a8ed586fd7867fd5dc30
  - done: impl-512 · 2026-10-15T19:33:47.664Z
- [x] C2. It still refuses, rather than waits, when the daily spend cap can't cover its reservation, naming the cap. Runs with no flag keep today's fallback.
  - verified: rev-30 [reviewer] · run rev-20261015-512-final · 2026-10-15T18:39:58.288Z · commit a4ad9640cfdd534d8ed03c1f0955e1a33d0f93d3
  - verified: rev-30 [reviewer] · run rev-20261015-512-integration-final · 2026-10-15T19:32:44.846Z · commit 0222b1eeefaea32fe7a7a8ed586fd7867fd5dc30
  - done: impl-512 · 2026-10-15T19:33:49.009Z
- [x] C3. A test fills the remote budget, submits an explicit-droplet run, and sees it wait and then run remotely once a slot frees.
  - verified: rev-30 [reviewer] · run rev-20261015-512-final · 2026-10-15T18:39:58.288Z · commit a4ad9640cfdd534d8ed03c1f0955e1a33d0f93d3
  - verified: rev-30 [reviewer] · run rev-20261015-512-integration-final · 2026-10-15T19:32:44.846Z · commit 0222b1eeefaea32fe7a7a8ed586fd7867fd5dc30
  - done: impl-512 · 2026-10-15T19:33:50.009Z

## Comments

### impl-512 · 2026-10-15T18:00:18.292Z

Regression at the authorized CLI/frame seam is red: `node --test --test-name-pattern='explicit droplet waits' hub/test/suite-remote-budget.test.ts` fails because the explicit droplet waiter becomes the local holder (8.68s test). The scheduler stores requestedExecutor as the resolved default, losing the explicit/omitted distinction; its full-budget path unconditionally falls back. Existing no-flag fallback tests will remain as compatibility coverage.

### impl-512 · 2026-10-15T18:05:58.263Z

Loaded Mac targeted run: suite-remote-budget.test.ts 13/13 green, 147.19s wall, beside the non-Coordinator local suite. New queue and cap cases passed; existing no-flag remote-full, provider-cleanup and shared-cap fallback cases passed. npm run typecheck and test:shards passed. Fetch/merge origin/dev reports already up to date. Executor-safety and executor-run compatibility checks follow before source review.

### impl-512 · 2026-10-15T18:09:55.464Z

Implementation committed and pushed at 8393e52e (task branch t/T-512-explicit-executor-droplet-still-falls). Root cause: the request discarded whether droplet was explicit, then admitted every droplet request through the full-budget fallback. Explicit remote intent is now persisted, remote waiters expose their queue position/waitingFor, and submission checks cap affordability while acquire keeps the atomic reservation. Loaded executor-safety compatibility is 20/20 green (A-3229); remote-budget is 13/13 (A-3228). Waiting for the coordinated final executor-run test window before requesting source review. QA policy is none, with no QA criteria or brief.

### rev-30 · 2026-10-15T18:15:36.049Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-512-source
commit: a4ad9640cfdd534d8ed03c1f0955e1a33d0f93d3
scope: full

Source review T-512 clear at a4ad9640cfdd534d8ed03c1f0955e1a33d0f93d3, fixed point 9bc15ce821eb85b0254d7bf034481b857d11ff18. Standards and Spec reviewed directly under no-delegation role. No high or medium findings.
Standards: explicit intent is a durable requireRemote field separate from the resolved executor default. Existing saved-job reload preserves it without reinterpreting older requests. Scheduler skips a remote-only waiter when scheduler or durable lease capacity is occupied, admits independent local requests, and requeues the typed RemoteBudgetFull acquire race. Other acquisition/delivery failures preserve failed outcome and any durable lease for cleanup; fallback refuses requireRemote. Identity/auth/head rechecks remain after asynchronous submission work.
Spec C1/C2: an actual execution requested explicitly as droplet cannot enter local fallback; omitted flags keep the established fallback paths. A pre-submission affordability check uses offered size price, lifetime reservation and shared ledger/cap, naming the cap on refusal; acquire retains atomic spend reservation and rechecks any concurrent change. Cache executor-policy behavior remains intentionally outside this change, as the requester/Coordinator assigned a separate follow-up. An explicit request can still reuse an existing cached result; do not present that as a newly executed Linux run.
Spec C3/tests: new CLI/frame fixture fills remote budget=1, asserts queue position and waiting-for-remote label, observes later local execution independently, releases the first remote worker, observes its done receipt before report, then checks waiting run executes remotely. Separate cap tests cover both full and spare remote-slot cases without local admission or dangling waiter. Existing no-flag fallback tests still exercise default behavior across cap/provider/snapshot/region/dirty cases.
Evidence: A-3228 remote-budget 13/13 and A-3229 executor-safety 20/20 pass. A-3237 executor-run whole file is retained as 19 pass/1 fail: the changed test mistakenly expected no holder despite its own manually held compatibility lock. Final commit corrects that assertion to hand-run holder/no admitted verification job; A-3238 reruns the changed case 1/1 green, without production changes. No claim of a green final whole executor-run file yet. New/renamed duration exceptions carry measured values and lifecycle reasons. Docs explain explicit wait, omitted fallback, affordability and queue fields; whitespace check passes, requester reports typecheck/shard lint green.
Low aside, Bugs / XS — hub/src/hub/suites.ts:698: snapshot ETA accounts for occupying suite jobs but not durable-only prepare/cleanup leases. With only such leases blocking capacity, an explicit waiter may show ETA 0 despite correctly remaining queued. Existing estimation seam needs a follow-up (unknown ETA is preferable to a false free slot); it does not defeat remote-only admission.
C1–C3 remain unverified pending exact-head post-source gate. Source clear permits one cland verify at this head. No per-item QA criteria. No Reviewer tests, edits or provider calls.

### impl-512 · 2026-10-15T18:38:12.539Z

Same-head verification 4174e836-3781-4a4c-85a2-d8a014bbe0c5 is green at a4ad9640cfdd534d8ed03c1f0955e1a33d0f93d3: full mode, 2182/2182 passed, no failures/skips/cancellations; local darwin arm64, Node v24.21.0, Neovim v0.12.5. Durable log A-3260: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3260-suite-4174e836-3781-4a4c-85a2-d8a014bbe0c5-auto-at-a4ad964.log. The run used the Coordinator-authorized local fallback and completed naturally under load. Production source and reviewed head remain unchanged. Awaiting the Reviewer's final same-head verdict; retaining the claim until merge.

### rev-30 · 2026-10-15T18:39:58.288Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-512-final
commit: a4ad9640cfdd534d8ed03c1f0955e1a33d0f93d3
scope: evidence

Final evidence review T-512 clear at unchanged a4ad9640cfdd534d8ed03c1f0955e1a33d0f93d3. No high or medium findings remain; source review A-3243 stands.
A-3260 / 4174e836-3781-4a4c-85a2-d8a014bbe0c5 completes exit 0, exact-head full verification on local Darwin after the requested no-executor/default admission path: typecheck, hub free/machine and full Neovim, 2182 passed / 0 failed / 0 cancelled / 0 skipped. It is not a Linux execution. The task has no Linux-only acceptance criterion; remote behavior is proven through actual CLI/frame fake-provider integration tests within this run.
C1/C3 verified: explicit remote-capacity fixture passes at :5210 (16.198s), covering queue position/remote label, no local takeover, later independent local admission, separate remote completion/report observation and waiting request's eventual remote execution. Source review establishes persisted intent, durable-capacity gating and hard prohibition on explicit fallback.
C2 verified: cap refusal tests at :5211–5212 pass for remote budgets1/2, naming the cap and leaving no local job or remote waiter. Atomic acquire reservation and existing omitted-flag fallback compatibility also pass. Corrected dirty explicit refusal case passes at :4438 (7.860s); the final whole executor-run file is now covered by the full green run, superseding its prior targeted 19/20 receipt. No hard duration failure.
All C1–C3 verified at this head. The low durable-only ETA issue was reported and filed separately; cache executor-policy remains its separately assigned follow-up. Neither is represented as fixed here. No new source change or additional run needed. No per-item QA criteria. No Reviewer tests, edits, merges or provider calls.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-512 · 2026-10-15T19:21:11.633Z

Coordinator merge-conflict waiver (66ab3b1b, 19:17Z): merged origin/dev and resolved at 0222b1eeefaea32fe7a7a8ed586fd7867fd5dc30, pushed to origin. Kept T-394 coverage-selected admission and cache identity, T-396 worker/fallback worker fields, per-run size delivery and pricing, and T-459 demo acquire metadata. Explicit-remote checkSpend now receives input.size; existing verification-workers price test additionally proves explicit c-16 refuses at its price before omitted-flag fallback still uses local worker policy. durations.json was rebuilt from origin/dev plus only my four allowance identities at sorted keys. Shared fixes 051db745/d5442c61/7cdf2dd0 are in merge ancestry. Typecheck/shard lint green; quiet Mac verification-workers 4/4 green. Grep matches add suite-close/suite-coverage to the four mandated files; five files remain, run serially after T-502 yields. No new full verify per Coordinator; A-3260 stands for delta review.

### impl-512 · 2026-10-15T19:31:29.680Z

Conflict waiver checks completed at pushed head 0222b1eeefaea32fe7a7a8ed586fd7867fd5dc30: quiet Mac serial whole files verification-workers 4/4, suite-remote-budget 13/13, suite-selection 83/83, executor-run 20/20, suite-close 7/7, suite-coverage 1/1 (128/128). Typecheck/shard lint/diff check green. Durable evidence A-3298: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3298-t-512-merge-resolution-0222b1ee-six-serial-mac-files-128-128-green, entry README.txt. Each file rechecked load<15, local holder absent and targeted window free. Requesting delta review; no new full verify under Coordinator decision 66ab3b1b, which retains A-3260.

### rev-30 · 2026-10-15T19:32:44.846Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-512-integration-final
commit: 0222b1eeefaea32fe7a7a8ed586fd7867fd5dc30
scope: delta

Delta final review T-512 clear at 0222b1eeefaea32fe7a7a8ed586fd7867fd5dc30, merge of prior final-reviewed a4ad9640cfdd534d8ed03c1f0955e1a33d0f93d3 with dev a59514aefb3e5effe1c49ce9f6a3829a943540a6. No high or medium findings.

Standards: combined merge reviewed against both parents. T-394 coverage selection/capture/cache identity and T-396 workers/fallbackWorkers/size remain in the merged suites path. Coverage reducer/selector, package worker policy, init config, local suite-worker and remote delivery blobs match merged dev. Demo acquisition metadata and per-run size/price reservation survive. Durable requireRemote remains derived from explicit input, remote-only scheduler skips unavailable capacity and permits independent local work, RemoteBudgetFull requeues, and fallback guard refuses explicit requests. Unknown acquisition cleanup ownership remains retained.

Spec: checkSpend now takes optional requested size and submission passes input.size; it reserves that size's offered price for the configured lifetime against shared spend, while acquisition retains atomic cap checking. New existing-fixture assertions prove explicit c-16 requires its own $0.125 reservation against a $0.10 cap, refuses before queue admission, and leaves both waiter/remote lists empty. The following omitted-executor request still uses normal local fallback with configured local workers, no provider create. The existing selected-subset cache key also retains worker/size identity. Original queue-position, remote-only launch and no-local-fallback tests remain. Separate previously filed cache-platform/ETA follow-ups remain outside this admission change.

Coordinator 66ab3b1b-a219-44c0-aa13-66ae7a011210 independently confirmed in topic history: merge dev, preserve coverage and worker/size pricing alongside explicit waiting/cap refusal, run identifiers plus required targeted files, delta review; A-3260 stands and no new full verify is required.

Evidence A-3298 README and all six raw whole-file logs inspected: workers4, remote-budget13, selection83, executor-run20, suite-close7, coverage1 =128 passed, zero failed/cancelled/skipped. Recorded quiet Mac serial admissions load2.23–3.79, no local holder/other targeted file. Identifier map has no Neovim match. Requester reports typecheck/shard lint green and read-only whitespace check is clear. Prior full A-3260/4174e836 at a4ad9640 completed2182/2182 on actual local Darwin with full Neovim; it is supporting gate evidence under the explicit waiver, not a fresh full run at this merge head.

Manifest parsed against merged dev: files/tests unchanged; one obsolete dirty-fallback test identity replaced by its already reviewed dirty-explicit-refusal identity, plus three other previously reviewed remote-only/cap task allowances, at sorted keys. No other prior allowance changed/removed. Shared051/d544/7cdf arrive through ancestry; no broad new allowance.

C1–C3 reverified: explicit remote intent and queue position wait without fallback, size-aware cap refusal while omitted flag retains fallback, and budget-filled fixture waits then launches remotely. No Reviewer tests, edits, merges or provider calls.

Criteria: C1 verified, C2 verified, C3 verified.
