---
id: T-312
kind: task
title: "Five more Linux failures from the first all-phase container run: Codex relaunch PID, OpenCode no-url rollback, three Neovim cases"
state: open
status: review
criterion_seq: 5
labels:
  - v0.1.2
  - hub
  - nvim
  - ready-for-agent
assignee: null
parent: T-268
blocked_by:
  - T-281
topic: topic-190
branch: t/T-312-five-more-linux-failures-from-the-first
created: 2026-10-13T01:50:19.683Z
updated: 2026-10-13T05:37:25.419Z
---

## Summary

The first Linux container run of all phases, at T-281's fba1599 on 2026-10-13, found five failures beyond T-281's five. Two are in the hub phase and three in the Neovim phase, which had never run on Linux before. T-268's C6 needs `npm run typecheck && npm test` green on Ubuntu 24.04, so each is fixed at its cause before T-282's droplet acceptance run.

## Parent

T-268: Suite spend and Linux portability. Evidence is in T-281's topic (topic-181).

## The failures

1. **Codex relaunch returns the old PID.** At `hub/test/orphan-servers.test.ts:146`, `first.pid` and `second.pid` are equal. It fails in five of five isolated runs (A-1734). A read-only observer recorded a new app-server birth each time, with a distinct PID and start ticks, so this is not PID reuse. The relaunch answer carries the old PID. This looks like a product bug in how the Codex adapter reports a relaunched child on Linux, not a test defect.
2. **OpenCode no-url rollback.** At `hub/test/adapter-native-boundary.test.ts:267`, "owned child has exited before rollback returns" is false in the full run (A-1727). The file passed alone five times in a row, 64 of 64 each (A-1729). The failure is load-sensitive: name the cause and fix it with a wait for state, never a retry or a longer sleep.
3. **Neovim: artifacts keeping** (A-1731).
4. **Neovim: prompt draft editing** (A-1731). Compare with T-300, the macOS prompt-draft flake.
5. **Neovim: thread delayed-history mode** reads `nt` where `t` is expected (A-1731).

## Constraints

- Fix each at its cause, with no weakened assertion, no skip and no retry. Name each cause in the item.
- A failure that also reproduces on macOS dev alone is a dev defect under the shared-fix rule: one commit, cherry-picked into every open branch.
- Linux runs are machine-weight. Run them only in a slot the Coordinator hands out: Docker Desktop at its current 4 CPUs, never changing its settings, `--init`, an ordinary user, and Docker quit after use.
- Suites run through `cland verify` on macOS.
- Commit on the task branch and push it to `origin`; `dev` only through `cland merge`. English everywhere.

## Acceptance criteria

- [x] C1. Each of the five failures has its cause named in the item and fixed there, with no test weakened, skipped or retried.
  - done: impl-312 · 2026-10-13T03:19:16.688Z
- [x] C2. In the Ubuntu 24.04 container as an ordinary user, `orphan-servers` and `adapter-native-boundary` each pass ten runs in a row alone, and the three Neovim files pass ten runs in a row alone. The logs are published as artifacts in this item's topic.
  - done: impl-312 · 2026-10-13T03:19:17.710Z
- [ ] C3. One container run of all phases (`npm run typecheck && npm test -- --all`) is green on Linux, with the platform skips listed by reason. Its log is published as an artifact.
  - failed: rev-26 [reviewer] · 2026-10-13T04:51:30.945Z · note A-1799 Linux all-phase run fails pid-identity.test.ts:108 (stop ok:true, expected false) and stops before Neovim; required green all-phase result is absent.
- [ ] C4. The suite is green on macOS through `cland verify`.
- [x] C5. C5. The hub-phase hang of freshness.test.ts in the first T-312 Linux all-phase run (2026-10-13 ~03:00Z, worker idle in epoll while every other worker had finished) has its cause named in the item and fixed there, with no timeout raised, no skip and no retry. The file passes ten runs in a row alone in the Ubuntu container, and the evidence of the hang is published as an artifact in this item's topic.
  - done: impl-312 · 2026-10-13T04:06:46.233Z

## Comments

### impl-312 · 2026-10-13T02:22:43.643Z

Codex relaunch cause: the frame is ok but its value is found:false ('no rollout found for thread id'), returning the retained stopped row; the PID comparison hid that reason. fake-codex persisted turns>0 only at turn completion. Linux termination is faster than the default 300 ms fake turn; a 10 s fake first turn deterministically reproduces the identical old-PID failure on macOS (A-1741), while ordinary dev baseline passes. Real contract source: upstream openai/codex commit 12cca49c81c8aa6a37a5cc4e39964ee3b70f9458, codex-rs/core/src/session/mod.rs, record_user_prompt_and_emit_turn_item calls ensure_rollout_materialized after recording first user input, before model completion: https://github.com/openai/codex/blob/12cca49c81c8aa6a37a5cc4e39964ee3b70f9458/codex-rs/core/src/session/mod.rs#L5036-L5095 . The fake now persists at first turn start; regression keeps the 10 s turn (so completion cannot make it green) and explicitly requires resume.value.found before comparing PIDs. No production PID reporting change is needed.

### impl-312 · 2026-10-13T02:29:22.234Z

OpenCode no-url rollback cause: endProcess confirms OS process disappearance (and excludes zombies) before Node/libuv necessarily delivers the native ChildProcess exit receipt. Under load, LaunchFiles.rollback removed resources and rejected spawn while exitCode and signalCode were still null. The existing native adapter-boundary seam now gates only that receipt while retaining real child/OS identities/signals, and checks session resources cannot be undone early. It fails before the fix and passes after it. LaunchFiles now captures the exit promise when owning a native child, and awaits it after verified termination before resource undo; recovered durable receipts without a native ChildProcess continue using OS proof. Unchanged original no-url assertion retained; complete adapter-native-boundary file passes 65/65. A-1742 was archived as superseded: its first diagnostic also counted termination-lease cleanup; final red proof narrows the observation to this fixture's session resources.

### impl-312 · 2026-10-13T02:31:10.332Z

Three Neovim causes: (1) artifacts keeping waited only for the artifact-list count, which arrives independently of topic.history. A held real protocol history response proves count=1 with thread messages=0; early zR has no run to open, then history creates the default closed fold (A-1748). Test retains the count wait and now also waits for the actual artifact message and rendered folded run before zR, retaining keep/unkeep/restart/palette assertions. (2) prompt draft issued :Cland prompt immediately after nvim listening, before the hub welcome/connect handshake. The command correctly refuses 'prompt: the hub is not connected'; the originally issued command never becomes a draft after welcome (A-1747). Test now waits hub:connected before the one command. This is the same T-300 case/cause: load makes the handshake lag behind the immediate RPC command. (3) delayed-history test asserted Terminal mode immediately after startinsert; A-1731's line 606 fails BEFORE releasing history, with native terminal-normal nt. The test now waits for the requested mode before retaining the original exact assertion and releasing history; all post-history mode/focus/tail/status assertions remain. Protocol-gated red source A-1746 and green A-1749; no permanent seam added. Artifacts file passes 9/9; thread validation in progress.

### impl-312 · 2026-10-13T02:33:58.330Z

Pinned Neovim's own help confirms delayed-history precondition: v0.12.5 runtime/doc/insert.txt :startinsert (lines 2032–2039) starts Insert/Terminal mode just after executing the command, and inside a function/script only after it finishes. The Linux failure was the pre-history mode assertion at line 606, before snapshot release. The exact mode assertion remains and now follows a state wait. Fixed complete macOS files: adapter-native-boundary 65/65, codex-adapter 35/35, artifacts 9/9, thread 24/24; typecheck passes after correcting the test fault injection's readonly-field typing. Temporary UI protocol relay source was preserved as A-1746 and removed from the repo.

### impl-312 · 2026-10-13T03:19:20.183Z

A-1760 publishes the complete protected-slot evidence at 5e8842a: 20 four-worker macOS artifacts runs and all 40 isolated Ubuntu runs green (ten per unique file; artifacts covers both keeping and draft). Every orphan run correlates found:true with distinct observed app-server births. Typecheck passed, but C3 is blocked: freshness's first subtest rm hook failed ENOTEMPTY on .cland/tasks, so its later tracker.stop hook never ran. Inspector shows all six subtests finished, including the last scheduled-tip starvation case; a referenced inotify/FSEventWrap plus deleted SQLite handles kept the worker alive. No child/fake/hub/bridge from that file survived. /proc, process tree, inspector state and final reporter output retained. TERM of only PID74253 flushed the hub result: 1381 pass / 1 fail / 3 skips; nvim phase did not run. Docker/container stop=0 and both leases released at 03:16:42Z. Coordinator assigned this teardown cause to C5; existing 40 proofs stand unless their files change.

### impl-312 · 2026-10-13T03:28:43.890Z

C5 cause and candidate: the first freshness subtest registered tempProject removal before tracker.stop. A live watcher/background tracker write raced recursive rm, which failed ENOTEMPTY; Node's after-hook loop then skipped tracker.stop. The referenced FSEventWrap and deleted SQLite handles kept the finished worker alive. macOS dev file passed 6/6 alone and 6/6 under existing suite load, so the ordinary-alone shared-fix trigger did not reproduce. A controlled native removal probe reproduces the same teardown cause on dev and passes on the candidate. One standalone shared-fix commit 4426831 is pushed: fixture ownership runs resource callbacks before directories, attempts every registered step, and preserves original or aggregated errors. Matching direct-tracker hook patterns were audited and migrated in freshness, item-lead, launch-admission, merge, name-reservation, push, release, request-guard, session-async-processes, session-holds, subscription-hygiene, task-worktrees, tracker-async, tracker-criterion-write, tracker-native-boundary, tracker-rank, tracker-ready and tracker-status; freshness-harness now shares the same lifecycle. Composite callbacks were split so early disposal failure cannot skip later resources. Regression boundaries verify live tracker stop precedes rm and disposal/ENOTEMPTY failures remain visible while later resources/directories are cleaned. A-1763: cleanup 23/23, freshness 6/6, tracker native 29/29, frame readiness 24/24, final typecheck green. A-1761 was archived because its first publication preceded the last migration typecheck failure; that syntax was corrected and rechecked in A-1763. The four original target files are unchanged since the forty Linux proofs at 5e8842a.

### impl-312 · 2026-10-13T03:31:58.749Z

Audit also checked hub/src/hub/worktrees.test.ts outside hub/test: its direct tracker fixtures already await tracker.stop before rm in one teardown callback, so it does not share the removal-before-stop cause and was left unchanged. No native t.after tracker.stop registrations remain in the migrated hub/test fixtures.

### impl-312 · 2026-10-13T03:37:37.529Z

Evidence-count correction from review: each Linux orphan file in the original forty-run proof has 24 tests total, 23 passes, zero failures and one existing real-OpenCode-prerequisite skip, not 24 actual passes. All ten observer correlations remain found:true with distinct observed old/new PIDs. Corrected full proof bundle is A-1768; A-1760 was archived as a superseded summary, and identical original logs/hang captures remain in A-1768. C2 remains done: all ten complete files succeeded, and no skip was introduced. Pinned Codex contract source excerpts and verified SHA256s are now published in A-1767, with the TurnStart recording/persistence call chain and the distinction that real admission replies are not persistence barriers.

### impl-312 · 2026-10-13T04:06:46.673Z

A-1780 publishes the complete second Linux slot at integrated c79a8a5. Ten isolated freshness files passed 6/6 each with normal exit and no deadline hit; the full hub phase passed freshness too, completing C5. Typecheck passed. Full hub totals: 1393 tests, 1389 passes, 1 fail, 3 existing skips; nvim full phase did not start. The failure was uncaught ERR_INVALID_STATE, database is not open, from deferred HubCore.eventsProject → InboxBoard → closed ProcessTable, in session-async-processes' claim-conflict slow-request test; no logging assertion was weakened. Container and Desktop stop=0, both leases released 04:04:26Z. After cleanup, supplied shared shutdown fix 64cb036 was fetched and cherry-picked unchanged as 6a8205d, pushed. Coordinator assigned impl-313 to confirm that shared fix covers this second path; any follow-up will also be cherry-picked unchanged. C3/C4 remain pending. The next authorized Linux request is one all-phase run only; original forty proofs and these ten freshness proofs stand.

### impl-312 · 2026-10-13T04:12:00.576Z

Third-slot candidate 1e138fc is pushed and published in A-1785: supplied 64cb036/ffced58 are unchanged cherry-picks (6a8205d/2e1e517), then origin/dev fetched/merged. Independent real-frame regression from impl-313 and rev-26 review confirm the first patch missed HubCore's journalImmediate; the follow-up closes Core before Dispatcher/adapters and async drains, covering the exact A-1780 eventsProject/InboxBoard closed-table stack. At the candidate, events-quiet 6/6 and session-async-processes 5/5 pass; all original four isolated-proof files are unchanged from 5e8842a. Coordinator approved exactly one all-phase Linux run at 1e138fc/A-1785 after T-313 and T-308 existing queued runs finish and queue is empty, with no additional handoff unless a hub restart is posted. Earlier failed evidence stays in A-1780; C3/C4 remain incomplete.

### rev-26 · 2026-10-13T04:51:30.945Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261013-312-1
commit: 1e138fc3faa579146b19c143453ae7e451aac0d4

Medium: hub/test/pid-identity.test.ts:108 — current Linux all-phase candidate fails the Claude failed-stop/reused-PID refusal assertion (ok:true instead of false), so C3 is not met and Neovim never ran. The following bystander assertion was not reached; this evidence does not establish signalling or exact cause. A-1799 preserves the run; reviewer assessment published in this topic. No outstanding high/medium code finding in the previously reviewed original fixes or shared shutdown follow-up. C1/C2/C5 evidence checked; C4 final macOS full gate pending.

Criteria: C3 failed (A-1799 Linux all-phase run fails pid-identity.test.ts:108 (stop ok:true, expected false) and stops before Neovim; required green all-phase result is absent.).

### impl-312 · 2026-10-13T05:09:58.258Z

Actual PID cause remains unestablished: macOS dev file passes alone and under existing suite load, 3/3 each. A-1803 controlled native exit proves an exited row can validly return stop ok:true while retaining a live bystander; Linux A-1799 has no status/identity checkpoint, so this is a hypothesis rather than a diagnosis. Coordinator approved e0724d6 diagnostic preconditions and trace: test now requires a running row, original fake alive with recorded start identity, and live different-identity staged bystander before preserving both original assertions. Mac file 3/3 and typecheck green (A-1808). Approved A-1809 slot after T-314: PID file ten times, stop first failure; otherwise explicit hub then independent nvim-only shards regardless of hub result. This is not readiness proof. Phase-count correction: prior summaries referred to machine shards; including each run's 30/30 hermetic shard, the three failed hub invocations total respectively 1415/1411 pass, 1423/1419 pass, and 1425/1421 pass, each one failure/three existing skips. Original logs retain per-shard counters and reasons.

### impl-312 · 2026-10-13T05:34:42.198Z

Approved diagnosis completed at e0724d68795f4410998269f9fe49ba6ac115ab90, 05:17:58–05:32:45 UTC. A-1813: ten isolated pid-identity files each 3/3; typecheck green; explicit full hub 1425 tests / 1422 pass / 3 existing skips / zero fail; explicit full Neovim 307 tests / 304 pass / 3 existing sandbox skips / zero fail. All eleven Claude traces show staged running row, original fake alive at recorded identity, live bystander at different identity, ok:false refusal and both alive afterward. A-1799's earlier ok:true failure did not reproduce, so the prior actual cause remains unknown; the deliberately exited-row experiment is a sufficient hypothesis only. This slot is diagnosis only and does not complete C3/C4. Docker container and Desktop stopped with exit 0, leases released, queue no holder. Asked Lead for decision on readiness candidate retaining required strict preconditions, removing temporary trace, merging latest dev and running actual all-phase verification.

### impl-312 · 2026-10-13T05:37:11.000Z

Per Coordinator's 05:35:02 decision, A-1799's ok:true result is recorded as NOT REPRODUCED after targeted capture (A-1813: ten isolated whole files plus one loaded hub case, all preconditions holding and stop refused). No cause is claimed and production remains unchanged for this case. Permanent preconditions now name any running-row/liveness/recorded-start/staged-PID failure before stop. Temporary traces are removed in 31651ef. Readiness head 050aea7430936c0661e6b550bb23714b89b6706e merges origin/dev e27e08f. Original four target files and C5 proofs remain unchanged. A-1814 holds the one all-phase readiness runner with explicit Neovim diagnosis after failure. Machine order: T-275 QA, T-314 full run, then request readiness slot; C3/C4 still pending. C1 for the added PID case is unreproduced after targeted capture and guarded by permanent preconditions, subject to review of criterion wording under the Coordinator's decision.
