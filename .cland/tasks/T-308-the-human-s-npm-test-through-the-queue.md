---
id: T-308
kind: task
title: "The human's npm test through the queue: the local runner waits for a
  slot in the hub's suite queue, unless --force"
state: closed
status: done
criterion_seq: 5
labels:
  - v0.1.2
  - ready-for-agent
  - hub
assignee: null
parent: E-275
blocked_by: []
topic: topic-192
branch: t/T-308-the-human-s-npm-test-through-the-queue
created: 2026-10-12T21:34:31.980Z
updated: 2026-10-13T04:36:15.375Z
---

## Summary

The human's `npm test` asks the project hub's suite queue for a slot as the human. While the queue is busy, it waits and prints its place and ETA. With no hub running, it runs as today. `npm test -- --force` starts at once beside the queue, and the hub journals that it did.

## Parent

T-275: Sessions: stopped sessions, verifiers' items, the queue line. Spec: `docs/spec/v0.1.2.md` §3.6 (decided in T-246). §3.6 adds no general queue API: this is the suite queue of `cland verify` (T-232), with the human as one more waiter.

## What to build

**Today.** `npm test` (`hub/test/run-suite.ts`, `runPackageSuite`) takes the machine-wide compatibility lease (`/tmp/cland-suite.lock` and its `-nvim` twin, `hub/src/suite-lock.ts`) by itself. The hub's scheduler (`hub/src/hub/suites.ts`) sees it only afterwards, as a `hand run` holder. A human run therefore competes at the lock rather than taking a place in the hub's order.

**The human's runner asks the queue first.** The new path applies to an invocation that meets all of these:

- it does not inherit a hub worker's lease (`inheritedLease()` is unset);
- it runs outside a cland session (`CLAND_SESSION_NAME` unset);
- a project hub answers for the cwd (`hubDiscovery`, which follows a linked worktree to the main one).

Such an invocation does the following before it takes the lease:

1. It sends the hub a request for a slot as the human: `suite.slot`, or a name of that kind, documented in `hub/README.md` beside `suite.start`. The request carries the selection mode, the worktree and the head.
2. The hub puts a waiter of kind `hand run` with session `human` into the same ordered queue that `cland verify queue` shows. The open points in the README cover its place in the order. It holds the waiter for as long as the runner's connection stays open.
3. While it waits, the runner prints one line on each change of position or ETA, and at least once a minute: `waiting for the suite queue: place <n> of <m> · <holder> runs <t> · ETA ~<eta>`.
4. When the waiter reaches the head and the compatibility slot is free, the hub admits it. It answers the runner and reserves the slot for a short grace period, during which it launches no worker.
5. The runner takes the compatibility lease as today, through `acquire` or `acquireBroker` and its atomic acquisition, then runs. The hub sees it as the `hand run` holder, with `session: human`.
6. A runner that exits or is interrupted (SIGINT or SIGTERM) before admission closes its connection, and the hub drops its waiter and journals it. A grace period that expires without the lease frees the slot.
7. The journal records `verification-human-queued`, `-admitted` and `-left`, with the waits, or names of that kind.

**No hub.** When no hub runs, or none answers within a few seconds, the runner behaves exactly as today: lock only, with one line saying no hub queue is in use.

**`--force`.** `npm test -- --force` takes the flag out of the test arguments and starts at once. It neither waits in the hub's queue nor takes the compatibility lease, so it runs beside whatever holds the slot.

- Before it starts, it tells the hub, which journals `verification-forced` with the worktree, head, mode and the holder it ran beside. Without a hub it prints that it runs unlocked.
- It still uses its own unique run root and per-phase sweep, as today.

**Tests never touch the machine's real queue.** Every test of this ticket runs a real hub on a temporary project:

- with `verification.lock_path` pointed at an isolated lock directory, and with `runPackageSuite`'s `lockDirs` option;
- running a tiny explicit target from a fixture, never the package suite.

**Demo** (the epic's words). While a crew suite runs, `npm test` prints its place and waits, and `npm test -- --force` starts at once with a journal record.

**Out of scope.**

- Changing `cland verify`'s order, budget or cache.
- Gating targeted `node --test <file>` runs, which stay free.
- Gating crew sessions' `npm test`. The clauses already send full runs through `cland verify`.
- The panel's rendering of the human waiter, which ticket 05's view shows from the queue.

**Constraints.**

- Tests go through the frame protocol first: a real hub and the CLI or runner on a temporary project. No new seams inside the hub.
- Helpers stay out of `hub/test/harness.ts`. `run-suite.ts`, `process-cleanup.ts` and the suite-lock code are being edited by T-281 and T-282 (T-268): rebase on `dev` before starting, and keep this ticket's changes to the runner's admission step.
- A test that reads `hub.log` or `journal.jsonl` waits on the `hub.status` `flushLogs` barrier.
- The hub's queue publication stays coalesced as today (T-293).
- Suites run through `cland verify`. Suite-weight work runs only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [x] C1. Two hub tests on a temporary project with isolated locks show the queue path. In the first, a human `npm test` invocation, the runner entry, queues while a run holds the slot: it prints its place and ETA, appears in `cland verify queue --json` as a `human` hand-run waiter in order, and runs after admission. In the second, an interrupted waiter leaves the queue.
  - verified: rev-23 [reviewer] · run rev-2026-10-13-308-1 · 2026-10-13T04:35:47.620Z · commit cc6d94b01486c0ef9cc2f2862c30fb5bb80ca248
  - done: impl-308 · 2026-10-13T04:36:02.425Z
- [x] C2. `npm test -- --force` starts at once beside a holder, and the hub journals `verification-forced`, checked after the `flushLogs` barrier. Without a hub, `--force` and a plain run both behave as today.
  - verified: rev-23 [reviewer] · run rev-2026-10-13-308-1 · 2026-10-13T04:35:47.620Z · commit cc6d94b01486c0ef9cc2f2862c30fb5bb80ca248
  - done: impl-308 · 2026-10-13T04:36:03.001Z
- [x] C3. An invocation that inherits a worker's lease, as the hub's own `cland verify` worker does, or that runs inside a cland session, never asks the queue. A test covers both.
  - verified: rev-23 [reviewer] · run rev-2026-10-13-308-1 · 2026-10-13T04:35:47.620Z · commit cc6d94b01486c0ef9cc2f2862c30fb5bb80ca248
  - done: impl-308 · 2026-10-13T04:36:03.587Z
- [x] C4. `npm run typecheck` passes, and the existing suite-runner and suite tests pass unchanged.
  - verified: rev-23 [reviewer] · run rev-2026-10-13-308-1 · 2026-10-13T04:35:47.620Z · commit cc6d94b01486c0ef9cc2f2862c30fb5bb80ca248
  - done: impl-308 · 2026-10-13T04:36:03.993Z
- [x] C5. `hub/README.md`'s Tests section describes the human's queue path, the no-hub fallback, `--force` and its journal record, and the new frame. The Implementer, Reviewer and QA default clauses state that `npm test` from a session shell is not the human's queue path and that full runs go through `cland verify`.
  - verified: rev-23 [reviewer] · run rev-2026-10-13-308-1 · 2026-10-13T04:35:47.620Z · commit cc6d94b01486c0ef9cc2f2862c30fb5bb80ca248
  - done: impl-308 · 2026-10-13T04:36:04.638Z

## Comments

### impl-308 · 2026-10-13T03:42:59.417Z

Claimed and read T-275/T-246/T-307 plus the T-309 merge. Implementing a connection-scoped human slot in the existing scheduler, preserving inherited leases and session-shell compatibility paths. Tests use scratch hubs, fixture targets and isolated locks; no live queue or machine lock use.

### impl-308 · 2026-10-13T03:51:46.536Z

Pushed review candidate cace176102433af9ec4e1e980ce18744ccd2ddd5. Eight new scratch-hub cases passed (seven queue/runner cases plus ordering); git diff --check is clean. Review requested and queued for the next live verifier. Evidence: A-1775 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1775-t-308-review-human-queue-admission-and-forced-runs.md. Final verify all waits for the protected T-312 Linux slot release; Coordinator notified. No per-item QA required by inherited policy.

### impl-308 · 2026-10-13T04:01:05.458Z

Coordinator requested shared shutdown fix 64cb036b9467454065b437f270896323cc68b954 before final verification. Cherry-picked it unchanged and pushed new head 89f4d180d33a8ef8058b0108d722ae0beb4959bc. The T-308 patch is unchanged. Queued review should use this new head (and any subsequent dev integration before final suite), instead of the initial cace176. Final verify still waits for the protected T-312 slot.

### impl-308 · 2026-10-13T04:06:52.661Z

Full run 611153f6-aece-488c-aade-50474d8f5ae8 at 89f4d18 exited 2 during typecheck, before package tests. Evidence A-1779. Fixed the two dispatch narrowing errors by checking isClientRequest before the frame discriminant (behavior unchanged), committed/pushed b17e3cf1be9c6c04bb0936fc1a476b7969cc7126. Fetched and merged origin/dev (already up to date). This is the current review candidate; requeueing full verify with the existing review request pending.

### impl-308 · 2026-10-13T04:10:09.263Z

Per Coordinator instruction cancelled run 502dc777 (A-1784; exit 143). It passed typecheck and the free shard before cancellation. Cherry-picked shared follow-up ffced58a80974ba968ddcd9aa95accdb614992e5 unchanged after 64cb036; pushed current review candidate cc6d94b01486c0ef9cc2f2862c30fb5bb80ca248 after fetching/merging origin/dev (already up to date). Replacing full verify at this head; the T-308 patch is unchanged.

### impl-308 · 2026-10-13T04:35:38.603Z

Final full verification passed at cc6d94b01486c0ef9cc2f2862c30fb5bb80ca248: run c8084b7d-4b2d-4767-9138-5d33897eba16, exit 0, typecheck and 1737/1737 tests passed, zero failures/skips. Durable log A-1793 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1793-suite-c8084b7d-4b2d-4767-9138-5d33897eba16-all-at-cc6d94b.log. Rev-23's source review A-1792 is clear for C1-C3/C5 and awaits this exact-head C4 result. Direct release sent to impl-312 and Coordinator; queue confirmed empty at 04:35:24Z. Working tree clean; retaining claim for review/merge.

### rev-23 · 2026-10-13T04:35:47.620Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-308-1
commit: cc6d94b01486c0ef9cc2f2862c30fb5bb80ca248

No high or medium findings. Standards and Spec clear; C1–C5 checked. Source analysis A-1792, final evidence A-1794 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1794-t-308-final-review-c1-c5-clear-at-cc6d94b.md). Exact-head full cland verify c8084b7d / A-1793 passes typecheck and all three phases: 1737/1737, zero failures/cancellations/skips/todos. New real-frame runner cases and existing suite-runner/suite tests pass with existing assertions preserved. Implementer done marks remain for the claimant to record.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-13T04:36:15.375Z

Merged 27f03bd4ef5495d0a5060c841d075324ba0570ea onto dev.
