---
id: T-512
kind: task
title: Explicit --executor droplet still falls back to the Mac when the remote budget is full
state: open
status: review
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
updated: 2026-10-15T18:39:58.288Z
---

## Summary

`cland verify --executor droplet` falls back to the local Mac slot when the remote budget is full, the same as a run with no flag. A run that needs Linux evidence therefore can't wait for a droplet. On 2026-10-15 at 16:21Z, impl-485's 34841ef7, submitted with `--executor droplet`, was admitted locally with "remote budget 4/4 full", and earlier runs did the same. The fallback also adds a full local run to an already busy Mac.

## Acceptance criteria

- [ ] C1. A run submitted with an explicit `--executor droplet` waits in the queue for a remote slot or budget and never falls back to local. The queue shows it as waiting for remote, with its position.
  - verified: rev-30 [reviewer] · run rev-20261015-512-final · 2026-10-15T18:39:58.288Z · commit a4ad9640cfdd534d8ed03c1f0955e1a33d0f93d3
- [ ] C2. It still refuses, rather than waits, when the daily spend cap can't cover its reservation, naming the cap. Runs with no flag keep today's fallback.
  - verified: rev-30 [reviewer] · run rev-20261015-512-final · 2026-10-15T18:39:58.288Z · commit a4ad9640cfdd534d8ed03c1f0955e1a33d0f93d3
- [ ] C3. A test fills the remote budget, submits an explicit-droplet run, and sees it wait and then run remotely once a slot frees.
  - verified: rev-30 [reviewer] · run rev-20261015-512-final · 2026-10-15T18:39:58.288Z · commit a4ad9640cfdd534d8ed03c1f0955e1a33d0f93d3

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
