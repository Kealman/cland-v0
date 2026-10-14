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
updated: 2026-10-14T06:46:43.964Z
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
- [x] C2. With `remote_budget = 2` and the local slot free, a third droplet run goes to the local slot. It gets one warn notice with the cause `remote budget full` and a `verification-executor-fallback` record. With the local slot busy too, it waits and is admitted to the first slot that frees.
  - done: impl-347 · 2026-10-14T03:18:54.476Z
- [x] C3. `cland verify queue` and `--json` show the local holder, both remote runs with droplet name, size and region, and each waiter's requested executor. Every existing queue assertion in `hub/test/suite.test.ts` still passes.
  - done: impl-347 · 2026-10-14T03:49:42.979Z
- [x] C4. A local waiter held by a hand holder does not block a droplet waiter behind it. A droplet waiter refused for the cap falls back and does not block the queue.
  - done: impl-347 · 2026-10-14T03:18:55.766Z
- [x] C5. The fake API never sees more than `remote_budget` live droplets from one hub, and every acquire passes the shared spend cap.
  - done: impl-347 · 2026-10-14T03:18:56.287Z
- [ ] C6. Real check, posted on this item: two nvim-only branches verify at once on two droplets in a scratch project, with both results, `cland verify queue` captured during the runs, and the costs.
- [x] C7. `hub/README.md` and `docs/agents/tests.md` describe `remote_budget`, the slot rule and the queue lines.
  - done: impl-347 · 2026-10-14T03:18:56.994Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-347-2 · 2026-10-14T03:27:35.135Z · commit 130e3fcd2563630041775d18405990ae1150622c
  - verified: rev-23 [reviewer] · run rev-2026-10-14-347-4 · 2026-10-14T03:50:02.091Z · commit 2bea4c2ebf8bee59fc346344565e1dcc95f47559
  - verified: rev-23 [reviewer] · run rev-2026-10-14-347-6 · 2026-10-14T06:12:32.305Z · commit e116b78e47d61e8799b57e3ad8e86624f0a8f3a6

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
