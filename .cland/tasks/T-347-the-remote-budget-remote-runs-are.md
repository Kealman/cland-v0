---
id: T-347
kind: task
title: "The remote budget: remote runs are admitted up to remote_budget in parallel beside the local slot of one, the local slot takes a droplet run only when the remote budget is full, and cland verify queue names each run's executor"
state: open
status: in progress
size: M
criterion_seq: 7
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-271
blocked_by:
  - T-346
topic: topic-233
branch: t/T-347-the-remote-budget-remote-runs-are
created: 2026-10-13T20:53:46.081Z
updated: 2026-10-14T12:42:59.545Z
---

## Summary

The scheduler gets two kinds of slot: the local slot of one, behind the compatibility leases as today, and up to `remote_budget` droplet slots. One ordered queue feeds both. A droplet run takes a free remote slot. The local slot takes it only when the remote budget is full, with a warn-level notice, or when the run asks for `--executor local`. `cland verify queue` shows the local holder, every remote run with its droplet, and each waiter's executor.

## Parent

E-271: Remote executors, tracer bullet 5 of 6. Spec: `docs/spec/v0.1.2.md` §3.14: remote runs have their own budget beside the local cap of one. The decisions behind it:

- D27: `remote_budget` defaults to 4 in the docs and is set to 2 for this project during the build. The hub refuses a create beyond the budget.
- The epic's choice: with a remote executor the queue admits a run to a free remote slot; the local slot takes it only when the remote budget is full or the run asks for `--local`.

Prior work: T-215 kept the local budget at one (`verification-budget-capped`). T-218 (A-1142): the queue, not the suite, blocks the crew.

## What to build

**Config.** `[verification] remote_budget`, a positive integer, `4` by default, in `hub/src/init/config.ts`. It is passed to `Suites` beside `budget`. `budget` keeps its cap of one and its `verification-budget-capped` note.

**Admission.** `Suites.#tick` in `hub/src/hub/suites.ts` counts active jobs per executor.

- The order stays as today, from `#ordered`: integrated `dev` runs first, then human hand-run waiters, then item rank, then enqueue order.
- The tick walks the ordered queue and admits:
  - a droplet run while active droplet runs number fewer than `remote_budget`, with no compatibility check;
  - a local run, or a human hand run, only into the local slot when it is free, behind `compatibilityOccupied` as today;
  - a droplet run into a free local slot when the remote budget is full.
- When a droplet run goes to the local slot, the job's executor becomes `local`, and ticket T-346's fallback records it: a warn notice `verify <id>: remote budget <n>/<n> full; running locally`, and `verification-executor-fallback` with the cause `remote budget full`.
- A waiter that cannot be admitted does not block the waiters behind it that can. Example: a local run waiting on a hand holder does not hold back a droplet run behind it.
- The per-session rule stays: one active suite per session.
- Launch is not serialized. Several acquires may be in flight at once, each under its own lease and watchdog. Ticket T-346's spend cap is checked for each.

**The queue.** `VerificationQueue` in `hub/src/protocol.ts` grows without breaking its readers. `holder` stays the local holder, which the Neovim verify line reads (`nvim/lua/cland/verification.lua`, unchanged).

- New field `remote: VerificationHolder[]`. Each entry has `executor: 'droplet'`, `machine` (name, size, region), `since`, `runMs` and `etaMs`.
- Waiters gain `executor`, the one they asked for.
- The ETA uses each executor's own median from recent runs (`estimate` in `Suites.snapshot` gains an executor filter). A droplet run's median includes its acquire time.
- Admitted droplet runs no longer push back the local waiters' ETA.

`cland verify queue` (`hub/src/cli/suite.ts`) prints three kinds of line:

- `local: <holder or none>`;
- `remote <active>/<budget>: <session> · <item> · droplet <name> <size> <region> · since <t> · ETA <d>`, one per remote run;
- the waiters, each with its executor.

`--json` carries the same fields.

**Journal.** `verification-timing` already carries `executor` (ticket T-342). Add `remoteActive` and `remoteBudget` to `verification-admitted` (a new record) when a droplet run is admitted.

**Docs.** `hub/README.md`: the admission paragraph, which currently says that `[verification].budget` defaults to 1, gains `remote_budget`, the slot rule, the fallback to the local slot, and the new queue lines. `docs/agents/tests.md`: the queue output.

**Demo** (the epic's words, within D27's 2 or 3 droplets). Three task branches verify at once on three droplets, and `cland verify queue` names each run's executor.

**Out of scope.** The sessions panel's queue line and the queue view in Neovim (epic "Sessions: stopped sessions, verifiers' items, the queue line"). Any change to the cache or the report.

**Constraints.**

- Tests go through the frame protocol first: a real hub, a real spoke and the CLI on a temporary project. Several fixture worktrees with their own sessions submit at once, in the style of `hub/test/suite.test.ts`. They run against the fake API and the fake machine, and fake runs wait on files, not sleeps. No `npm test` case reaches DigitalOcean.
- No new seams inside the hub. Classify new test files in `hub/test/shards.json`. Read the logs after the `flushLogs` barrier (T-291).
- A real check runs in a scratch project hub on the branch, with `remote_budget = 2`, `lifetime = "15m"` and two branches whose diffs select `nvim-only` (a few minutes each). Post create, destroy and cost on this item.
- Suites run through `cland verify`, after a clear source review, at the exact reviewed head (D25).
- Commit on the task branch and push it to `origin`; `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [x] C1. With `remote_budget = 3`, three sessions submit `cland verify --executor droplet` at once. Three fake droplets run in parallel, and while they run, a fourth session's local run and a human hand run take the local slot in turn.
  - done: impl-347 · 2026-10-14T03:18:53.491Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-347-9 · 2026-10-14T08:55:43.401Z · commit 205897b4aed6ff59590908c2fa53cde755dd5fac
- [x] C2. With `remote_budget = 2` and the local slot free, a third droplet run goes to the local slot. It gets one warn notice with the cause `remote budget full` and a `verification-executor-fallback` record. With the local slot busy too, it waits and is admitted to the first slot that frees.
  - done: impl-347 · 2026-10-14T03:18:54.476Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-347-9 · 2026-10-14T08:55:43.401Z · commit 205897b4aed6ff59590908c2fa53cde755dd5fac
- [x] C3. `cland verify queue` and `--json` show the local holder, both remote runs with droplet name, size and region, and each waiter's requested executor. Every existing queue assertion in `hub/test/suite.test.ts` still passes.
  - done: impl-347 · 2026-10-14T03:49:42.979Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-347-9 · 2026-10-14T08:55:43.401Z · commit 205897b4aed6ff59590908c2fa53cde755dd5fac
- [x] C4. A local waiter held by a hand holder does not block a droplet waiter behind it. A droplet waiter refused for the cap falls back and does not block the queue.
  - done: impl-347 · 2026-10-14T03:18:55.766Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-347-9 · 2026-10-14T08:55:43.401Z · commit 205897b4aed6ff59590908c2fa53cde755dd5fac
- [x] C5. The fake API never sees more than `remote_budget` live droplets from one hub, and every acquire passes the shared spend cap.
  - done: impl-347 · 2026-10-14T03:18:56.287Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-347-9 · 2026-10-14T08:55:43.401Z · commit 205897b4aed6ff59590908c2fa53cde755dd5fac
- [ ] C6. Real check, posted on this item: two nvim-only branches verify at once on two droplets in a scratch project, with both results, `cland verify queue` captured during the runs, and the costs.
- [x] C7. `hub/README.md` and `docs/agents/tests.md` describe `remote_budget`, the slot rule and the queue lines.
  - done: impl-347 · 2026-10-14T03:18:56.994Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-347-2 · 2026-10-14T03:27:35.135Z · commit 130e3fcd2563630041775d18405990ae1150622c
  - verified: rev-23 [reviewer] · run rev-2026-10-14-347-4 · 2026-10-14T03:50:02.091Z · commit 2bea4c2ebf8bee59fc346344565e1dcc95f47559
  - verified: rev-23 [reviewer] · run rev-2026-10-14-347-6 · 2026-10-14T06:12:32.305Z · commit e116b78e47d61e8799b57e3ad8e86624f0a8f3a6
  - verified: rev-23 [reviewer] · run rev-2026-10-14-347-8 · 2026-10-14T08:28:21.323Z · commit 205897b4aed6ff59590908c2fa53cde755dd5fac
  - verified: rev-23 [reviewer] · run rev-2026-10-14-347-9 · 2026-10-14T08:55:43.401Z · commit 205897b4aed6ff59590908c2fa53cde755dd5fac
  - verified: rev-23 [reviewer] · run rev-2026-10-14-347-10 · 2026-10-14T11:19:14.715Z · commit cbbe6974014f5f2ab8a372cdac5be5e1253feff9

## Comments

### impl-347 · 2026-10-14T03:06:56.144Z

Implementation uses the ticket's pre-agreed frame/CLI and fake-provider seams. First failing slice: remote_budget config validation plus three file-barrier remote candidates in separate worktrees alongside a local candidate and human reservation. Scheduler currently counts all executors together and only considers the first waiter.

### impl-347 · 2026-10-14T03:19:18.393Z

Pushed 0b00cdaa2b97ede5a19407bec8153e4a254ccfee and requested source review from rev-23. A-2207 records implementation/validation (8/8 remote budget tests, 26/26 existing queue subset, typecheck/shards green); A-2208 records C6 scratch procedure. C1-C5/C7 done; C6 pending source-clear, two real nvim-only droplet runs and costs. No full verification before source review.

### rev-23 · 2026-10-14T03:23:24.878Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-347-1
commit: 0b00cdaa2b97ede5a19407bec8153e4a254ccfee
scope: full

Medium — hub/test/suite-remote-budget.test.ts:222: remoteMs > localMs is not guaranteed by including acquire time; a slower later local run can fail correct behavior. Assert the remote admitted→finished interval spans acquisition/start/execution directly, retaining all executor median and waiter/remote ETA checks. Complete fourteen-file source review found no additional high/medium production issue. C3 failed; corrected exact-head source review required before full suite and real C6. A-2210: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2210-t-347-full-source-review-eta-regression-timing-blocker.md. Reviewer ran no tests/cloud operations and made no edits.

Criteria: C3 failed (New ETA test assumes remoteMs > localMs for independently scheduled executions; directly prove the remote interval covers acquisition/start rather than an unsupported relative duration.).

### impl-347 · 2026-10-14T03:27:05.213Z

Corrected A-2210's C3 finding at pushed 130e3fcd2563630041775d18405990ae1150622c. Direct admitted/provider-create/machine-barrier/finished lifecycle assertions replace unsupported remote/local relative timing; whole-second remote receipt precision handled. Retained executor median and all waiter/remote ETA checks. Targeted ETA 1/1, typecheck/diff check pass. A-2211 records correction; source re-review assigned to rev-23. Production unchanged. C6 approved under D24/D27, held for Coordinator's MicroVM-ended relay and clean provider tags; no cloud resources created.

### rev-23 · 2026-10-14T03:27:35.135Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-347-2
commit: 130e3fcd2563630041775d18405990ae1150622c
scope: full

No high/medium findings remain. ETA test proves remote timing from its own provider-create/file-barrier/public admitted/finished boundaries, handling whole-second receipt precision, and retains all executor median/local waiter/remote ETA assertions. Production unchanged; original complete source review retained. C7 docs verified; C1–C5 await exact-head ordinary full evidence; C6 awaits real scratch two-droplet receipts, gated by Coordinator's MicroVM-ended relay and clean tag listing. A-2212: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2212-t-347-corrected-source-clear-at-130e3fcd.md. Source clear only.

Criteria: C7 verified.

### impl-347 · 2026-10-14T03:28:10.416Z

Source-clear at exact pushed head 130e3fcd2563630041775d18405990ae1150622c, rev-23 run rev-2026-10-14-347-2 / A-2212. Full verification submitted through cland verify all, run 0e2c5554-600f-412a-ae4b-58d93fa34b03, worker PID null while queued; recipients rev-23 and impl-347 in topic-233. Waiting for hub result; no bypass or source changes. C6 remains held for Coordinator's MicroVM-ended relay and clean-tag preflight.

### impl-347 · 2026-10-14T03:46:34.155Z

Full 0e2c5554/A-2220 failed 1/1617 hub tests at 130e3fcd; existing abandoned-human reservation timed out, Neovim not reached. Reproduced same failure standalone. Fixed lazy-probe regression at pushed 2bea4c2ebf8bee59fc346344565e1dcc95f47559: reconcile admitted humans before queue traversal, so expiry works with no waiters. Existing test unchanged; targeted human expiry/lease/priority 3/3 and remote/local/human coexistence 2/2 pass, typecheck/diff check pass. A-2222 records diagnosis; corrected source review assigned rev-23 before next full verify. C6 remains held until corrected-head full green; Coordinator has relayed MicroVM ended and initial droplets/snapshots must be empty. No real resources created.

### rev-23 · 2026-10-14T03:49:13.855Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-347-3
commit: 130e3fcd2563630041775d18405990ae1150622c
scope: evidence

Medium — hub/src/hub/suites.ts:405–419: human grace reconciliation is inside the ordered waiter loop, so an empty queue leaves an abandoned human reservation admitted indefinitely. A-2220 fails the unchanged human-grace assertion at hub/test/suite.test.ts:1488; Neovim was not reached. Evidence: A-2221, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2221-t-347-full-evidence-not-clear-abandoned-human-reservation.md. C6 remains pending. Corrected head will receive a separate source pass.

Criteria: C3 failed (An admitted human reservation never expires with no queued waiter; existing abandoned-human regression fails.).

### rev-23 · 2026-10-14T03:50:02.091Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-347-4
commit: 2bea4c2ebf8bee59fc346344565e1dcc95f47559
scope: full

No high/medium source findings remain. Human grace reconciliation now runs before queue traversal, so empty queues expire abandoned reservations while matching human leases/grace still reserve only the local slot. Remote admission remains independent; original tests/deadlines are unchanged. C7 docs refreshed; C1–C5 require fresh exact-head ordinary full evidence and C6 real receipts remain pending. A-2223: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2223-t-347-corrected-human-grace-source-clear-at-2bea4c2.md.

Criteria: C7 verified.

### impl-347 · 2026-10-14T03:50:32.286Z

Corrected source-clear 2bea4c2ebf8bee59fc346344565e1dcc95f47559, rev-23 run rev-2026-10-14-347-4 / A-2223. Fresh ordinary full verification submitted at exact head: 355e5bec-95fe-4ec3-b2ea-5ceca2ef2f4d, recipients rev-23/impl-347, topic-233, PID null while queued. No bypass/source changes. C6 starts only after this corrected-head run is green, with Coordinator's approved A-2208 setup and required initial empty cland droplets/snapshots.

### rev-23 · 2026-10-14T04:13:44.713Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-347-5
commit: 2bea4c2ebf8bee59fc346344565e1dcc95f47559
scope: evidence

Medium — hub/test/verifier-routing.test.ts:199: existing queued Reviewer delivery times out at the 5s channel wait after hold release; A-2229 exits 1 (1616/1617 hub, no skips/cancellations; Neovim not reached). This file is unchanged by T-347; cause needs targeted diagnosis. Human-grace/queue tests passed, so no individual queue criterion is failed by this unrelated routing timeout. Complete verification remains not clear: C1–C5 unverified, C7 source mark retained, C6 held. Preserve assignment/exact-once assertions. A-2230: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2230-t-347-corrected-head-full-evidence-not-clear-verifier-delivery.md.

### impl-347 · 2026-10-14T04:15:07.814Z

355e5bec/A-2229 at source-clear 2bea4c2e failed 1/1617 hub tests, verifier-routing.test.ts:199 rev-2 queued-delivery wait; corrected human grace and remote budget cases passed, Neovim not reached. Same test failed standalone 1/1 without mutation/load generator (A-2231). Coordinator's latest disposition 941882d1: impl-369 compares dev 39ff0f4 and this head five times each; T-347 holds unchanged at 2bea4c2e with C6/full rerun held until that comparison determines task regression versus shared T-369 fix. Subscribed to T-369 task events; no source edits or new suite run.

### impl-347 · 2026-10-14T04:17:43.924Z

T-369 direct comparison (impl-369 report a6ebd8f0): dev 39ff0f4c and T-347 2bea4c2e each passed 5/5 standalone in separate detached scratch worktrees, no mutation/load, one targeted file at a time. This does not isolate a T-347 regression; prior standalone red A-2231 remains a shared-race candidate. T-369 continues bounded-load delivery/connection ownership diagnosis. T-347 remains unchanged and C6/full rerun held under Coordinator disposition until the shared-fix outcome.

### impl-347 · 2026-10-14T06:11:34.689Z

Shared T-369 merged commit e5bd6b89 cherry-picked cleanly as pushed e116b78e47d61e8799b57e3ad8e86624f0a8f3a6 per Coordinator 023985df. Only verifier-routing readiness/subscription delta; all assertions/deadlines unchanged. Targeted failing case now 1/1 green; typecheck/diff check green. Delta source review requested. Full verify held for Coordinator's Agents hub-back notice under 4808b2e1, then fresh exact-reviewed-head verify and C6 after green. No cloud resources created.

### rev-23 · 2026-10-14T06:12:32.305Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-347-6
commit: e116b78e47d61e8799b57e3ad8e86624f0a8f3a6
scope: delta

No high/medium delta findings. Only four verifier-routing subscription/native-ready lines changed; patch exactly equals final-reviewed T-369 and landed shared e5bd6b89. All routing/exact-once assertions and 5s waits retained; production/T-347 tests/docs unchanged, corrected complete source A-2223 retained. C7 refreshed; C1–C5 fresh exact-head full evidence and C6 real receipts remain pending. Enqueue only after Coordinator's Agents hub-back notice. A-2257: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2257-t-347-shared-verifier-readiness-delta-clear-at-e116b78e.md.

Criteria: C7 verified.

### impl-347 · 2026-10-14T06:25:17.362Z

After Coordinator hub-back notice 39d6c297, fresh full verify f7a73045-3add-4bb5-a7af-588bc033556c is running at exact source delta-cleared head e116b78e47d61e8799b57e3ad8e86624f0a8f3a6; worker PID 56937, recipients rev-23/impl-347, topic-233. Shared T-369 fix included. Waiting for result; no source changes. New T-348 Implementer clause reserves executor administration/provider listings to the hub/human/Coordinator; routed concrete C6 A-2208/A-2218 admin/listing/snapshot-cleanup steps to lead T-347 for execution direction. No real cloud calls/resources yet.

### impl-347 · 2026-10-14T06:46:33.903Z

Full f7a73045/A-2268 at source delta-cleared e116b78e passed 1973/1974 tests; hub phase and shared verifier fix passed, sole Neovim failure explorer-card.test.ts:194 'missing row T-10' after zR. Exact-head standalone case passes 1/1 (~0.774s), Neovim source/test unchanged by T-347. Coordinator ad8280ae assigns readiness sweep to shared T-376 (regression T-352) and directs holding e116b78e until both T-375 and T-376 merged commits exist. Then cherry-pick both, request one delta review and run one fresh full; Coordinator runs C6 after green. Subscribed to both task event streams; no source changes or rerun.

### rev-23 · 2026-10-14T06:46:43.964Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-347-7
commit: e116b78e47d61e8799b57e3ad8e86624f0a8f3a6
scope: evidence

Medium — nvim/test/explorer-card.test.ts:196: immediate zR→select T-10 lacks expanded-row readiness; A-2268 errors missing row T-10 (1973/1974, no skips/cancellations). Hub/remote-budget/human-grace/routing cases pass; no individual task criterion is failed for this inherited stub test. Coordinator ad8280ae files T-376 and holds e116b78e until both T-375/T-376 shared commits merge; then combined delta review and fresh full, followed by Coordinator-owned C6. C1–C5/full evidence unverified, C7 source retained, C6 held. A-2270: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2270-t-347-full-evidence-not-clear-explorer-row-readiness.md.

### impl-347 · 2026-10-14T07:40:16.758Z

Coordinator c34f944a: integrated dev run f52cc4fc is green (1982/1982, A-2287). Shared T-375 merged as 3c79acbececa1a5df5dc2029fc9f3e9c3300d8ca, executor-droplet race fixes plus production API deadline cause. T-376 explorer readiness is still verifying. Keeping T-347 unchanged at e116b78e; once T-376 merges, cherry-pick both commits, one combined delta source review and one fresh full verification, then Coordinator-run C6 after green.

### impl-347 · 2026-10-14T08:26:39.034Z

Both shared fixes cherry-picked and pushed at 205897b4aed6ff59590908c2fa53cde755dd5fac: T-375 3c79acbe as e00368d4 (API deadline cause + lifecycle races), T-376 fc0fabf9 as 205897b4 (explorer/card/vboard readiness). T-347 admission/queue code unchanged. Targeted lifecycle/deadline cases 4/4 and previously failing card case 1/1, typecheck/shards/diff check pass. Combined delta review assigned rev-23; A-2294 records evidence. One fresh exact-head full follows source-clear, then notify Coordinator for C6.

### rev-23 · 2026-10-14T08:28:21.323Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-347-8
commit: 205897b4aed6ff59590908c2fa53cde755dd5fac
scope: delta

No high or medium findings. Combined T-375/T-376 shared delta retains all landed additions/removals and the prior task source assessment. The shared additions/removals match exactly. Four files match the landed references; explorer.test.ts retains only its pre-existing branch difference from later T-355 message-key coverage, with no assertion removed by this delta. T-347 admission/config/queue code and its own tests are unchanged. The former missing-row failure now has the reviewed expanded-row barrier. C7 refreshed. C1–C5 await exact-head full verification; C6 remains Coordinator-owned and pending the green result. One full cland verify may now run at this exact head through the queue. A-2298: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2298-t-347-combined-shared-fix-delta-source-clear.md.

Criteria: C7 verified.

### impl-347 · 2026-10-14T08:28:55.779Z

Combined source delta-clear at 205897b4aed6ff59590908c2fa53cde755dd5fac, rev-23 run rev-2026-10-14-347-8 / A-2298. One fresh full verify submitted through shared queue: bb07de2b-3b11-4a4a-af68-069e39c92023, PID null while queued, recipients rev-23/impl-347, topic-233. Both shared T-375/T-376 fixes included. Waiting for result at unchanged head; Coordinator runs C6 after green using A-2262 with required clean cloud preflight. Claimant then marks C6 done and requests final evidence settlement.

### rev-23 · 2026-10-14T08:55:43.401Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-347-9
commit: 205897b4aed6ff59590908c2fa53cde755dd5fac
scope: evidence

No high or medium findings. Exact-head full bb07de2b/A-2301 passes typecheck and all phases: 1975/1975, zero failures/cancellations/skips/todo, exit 0. Remote/local/human coexistence, both fallback paths, queue/human grace, cap/shared-spend reservations and former card readiness case pass. A-2298 source review remains applicable; clean unchanged head confirmed. C1–C5 and C7 verified. C6 remains unverified pending Coordinator-owned real two-droplet scratch results, queue capture and costs. A-2302: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2302-t-347-exact-head-full-evidence-clear-c6-pending.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C7 verified.

### impl-347 · 2026-10-14T08:55:49.954Z

Exact-head fresh full bb07de2b/A-2301 is green at source delta-cleared 205897b4aed6ff59590908c2fa53cde755dd5fac: both typechecks, 1975/1975 pass, zero fail/cancel/skip/todo. Shared T-369/T-375/T-376 fixes included. Coordinator notified immediately to run C6 through A-2262 with this expected-head argument and clean provider preflight under standing go. Keeping head unchanged; claimant marks C6 done after the evidence artifact posts, then rev-23 final settlement.

### coord · 2026-10-14T08:56:13.881Z

C6 real create: 608961348 (cland-t347-real-4cdee42e), c-8 lon1, run executor-prepare, created 2026-10-14T08:56:11.333Z, deadline 2026-10-14T09:11:11.333Z; $0.25/hour. Scratch remote_budget=2, lifetime=15m, daily cap=$3. Source reviewed at 205897b4aed6ff59590908c2fa53cde755dd5fac.

### impl-347 · 2026-10-14T08:57:00.204Z

rev-23 accepted exact-head full bb07de2b/A-2301 (1975/1975, both typechecks, no skip/failure), A-2302 / rev-2026-10-14-347-9, verifying C1-C5/C7. Coordinator 1e5a0436 is now running C6 from its shell via A-2262 at unchanged 205897b4; preflight source clean/token presence/syntax passed, stand-in notified. Awaiting C6 real receipts/queue/cost/cleanup artifact; claimant then marks C6 done and sends final evidence to rev-23. Head stays unchanged until merge.

### coord · 2026-10-14T09:04:37.797Z

C6 real attempt 1 (Coordinator, driver A-2262 at 205897b4, 2026-10-14):
- Builder 608961348 (c-8 lon1) was created at 08:56:11Z and prepared image 249754241, transferred to lon1, nyc1 and sfo2 in 454 s.
- Prepare then failed at its release stage: 'builder release not confirmed', with two executor-release-unconfirmed records at 09:03:42Z.
- The driver's cleanup released the builder and deleted the image. The provider listing afterwards showed no cland droplets and no snapshots. Estimated cost about $0.03 (about 8 min of c-8).
- No parallel runs were reached.
- Filed T-381 (regression_of T-344): the release error is swallowed, and prepare fails on an unconfirmed release.
- C6 waits for T-381.

### impl-347 · 2026-10-14T10:54:58.441Z

Latest C6 record checked: Coordinator attempt 1 stopped at builder release confirmation and never reached parallel runs; cleanup and empty provider listings recorded, about $0.03 cost, T-381 filed as T-344 regression. C6 remains pending/unmarked. Subscribed to T-381 task events and reported C6 blocker to lead/reviewer for shared-fix disposition. Source head remains 205897b4 with accepted green 1975/1975 evidence; no extra test or cloud action.

### impl-347 · 2026-10-14T10:55:45.942Z

Coordinator f684ccff disposition: keep 205897b4 unchanged until the Coordinator names T-381's merged product-code commit. Then merge origin/dev (do not cherry-pick), including any landed T-382/T-383 shared fixes; request one merge delta review; run one fresh exact-reviewed-head full verification; Coordinator runs C6 with A-2262 at that new head. Claimant then marks C6 done from evidence and rev-23 settles. No source changes before that named merge.

### impl-347 · 2026-10-14T11:18:02.122Z

Per Coordinator 2f5af0e5, fetched and merged origin/dev through T-381 83b74c6e as pushed cbbe6974014f5f2ab8a372cdac5be5e1253feff9 (parents 205897b4/4a9da38c). Docs and shard map conflicts resolved preserving feature docs/authority and every test classification; other source merged automatically. Typecheck/shards/diff check pass; sequential targeted remote budget/release reservation 3/3 and prepare retry/pending-builder cases 6/6 green. One delta review requested before fresh full; A-note records integration evidence. T-382/T-383 not landed yet; known-only failures will be reported before rerun. C6 remains Coordinator-owned after green.

### rev-23 · 2026-10-14T11:19:14.715Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-347-10
commit: cbbe6974014f5f2ab8a372cdac5be5e1253feff9
scope: delta

Delta source clear; no high or medium findings. Budget scheduler/config/CLI/own tests remain identical to 205897b4. Overlapping product paths preserve T-381 bounded cleanup/retry/pending-builder ownership beside the existing durable-lease capacity guard. Both conflict resolutions are sound: shard classifications are the exact parent union; docs retain executor authority, detailed slot/fallback/queue rules and executor-specific ETA. C7 refreshed. C1–C5 await new-head full verification; C6 remains the Coordinator-owned two-droplet real check. A-2344: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2344-t-347-t-381-integration-delta-clear-at-cbbe6974.md.

Criteria: C7 verified.

### impl-347 · 2026-10-14T11:20:41.950Z

Merge delta source-clear cbbe6974014f5f2ab8a372cdac5be5e1253feff9, A-2344 / rev-2026-10-14-347-10. One fresh full verify queued at exact head: dde7d63b-5854-4127-8d13-6fdc2b2367ca, PID null, recipients rev-23/impl-347, topic-233. Waiting for result; known-only T-382/T-383 failures reported before rerun. Coordinator given A-2345 C6 admin driver: A-2262 with observable wait for confirmed builder release after prepare, preserving both remote slots under T-381's pending-cleanup success contract. No source change or cloud call by this session.

### impl-347 · 2026-10-14T11:56:20.639Z

Human D29 (Coordinator 9f0656bd) now requires task verification with no mode after source-clear; hub selects phases. Existing queued all run dde7d63b at cbbe6974 is explicitly allowed to finish and will not be cancelled/resubmitted. Any later submission uses cland verify --report topic-233 with no mode, exact reviewed head; touched/added files targeted sequentially before review. Existing C6 administration remains Coordinator-owned after green.

### rev-23 · 2026-10-14T12:41:05.414Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-347-11
commit: cbbe6974014f5f2ab8a372cdac5be5e1253feff9
scope: evidence

Medium — hub/test/lead-handover.test.ts:50 / suite gate: exact-head dde7d63b/A-2357 fails waiting 5000 ms for the new Lead's channel event. Typecheck and 1641/1642 hub tests pass; Neovim is not reached. The test is unchanged from incoming dev and the cause is unclassified, so no individual T-347 feature criterion is newly failed. C1–C5 remain unverified, C7 source mark stands, C6 held. Bugs · S aside filed to lead. Coordinator 2bd19cc5/0eeed23b permits one same-head no-mode rerun only after 5/5 isolated passes and the aside; final evidence must name both runs and the flake ticket. A-2344 remains source assessment. Evidence A-2362: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2362-t-347-red-verification-unchanged-lead-handover-timeout.md.

### impl-347 · 2026-10-14T12:41:42.925Z

Coordinator's 5/5 qualification probe at exact unchanged cbbe6974 completed sequentially: 4 pass / 1 fail (third run repeats the same 5000ms lead-2 channel wait, only Implementer clause observed). No test changes/load generator; all five logs shared as a folder artifact. Therefore no same-head rerun qualifies under 2bd19cc5/0eeed23b. Reported Bugs S find aside to lead/reviewer; existing dde7d63b/A-2357 red and A-2362 not-clear evidence retained. Source assessment A-2344 stands, head unchanged, C6 held for disposition.

### impl-347 · 2026-10-14T12:42:59.545Z

Coordinator 7d315b11 confirms 4/5 isolated handover outcomes do not qualify for an unchanged rerun. T-398 filed (S, regression T-369) as a shared sweep of observer/native-MCP startup pattern; impl-398 owns it. Hold cbbe6974 unchanged. Once T-398 merges, cherry-pick the named commit, targeted touched files sequentially, delta source review, cland verify with no mode at exact reviewed head, then Coordinator C6 on green. A-2365 holds all five standalone logs.
