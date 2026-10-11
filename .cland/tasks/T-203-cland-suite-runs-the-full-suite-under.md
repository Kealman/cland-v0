---
id: T-203
kind: task
title: cland suite runs the full suite under the lock and posts one result for its session
state: closed
status: done
criterion_seq: 5
labels:
  - tech-debt
  - high
  - ready-for-agent
assignee: impl-203
parent: T-19
blocked_by: []
topic: topic-104
branch: t/T-203-cland-suite-runs-the-full-suite-under
created: 2026-10-10T18:38:59.088Z
updated: 2026-10-11T00:24:59.989Z
---

## What to build

Each Implementer writes its own wrapper to run `npm run typecheck && npm test` under the suite lock and report the result. On 2026-10-10, five runs were lost or went unreported. impl-190's nohup launch died with its tool shell. impl-183's report used a spoke-only frame and was lost for 40 minutes. impl-196's callback used raw topic.send, which the hub refuses, and a later run vanished. impl-187's Neovim run ended with no report. Each loss cost a queue slot and a Coordinator nudge (T-189 findings).

`cland suite [all|hub|nvim] --report <session|topic> [--to <session>]` runs the suite in the current worktree under the machine locks (T-175), detached from the caller's shell. It stores the log as an artifact and posts one message with the exit code, the counts, the failures and the artifact id through the hub as the calling session. While it waits it shows its queue position (T-201). The Implementer clause names it as the only way to run a full suite.

## Acceptance criteria

- [x] C1. `cland suite` survives the caller's shell exiting and posts exactly one result, whether pass, fail or crash, with the log artifact.
  - done: impl-203 · 2026-10-10T20:03:47.158Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-203-2 · 2026-10-10T20:13:51.345Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-203-2 · 2026-10-10T22:38:37.313Z
- [x] C2. The result is posted as the calling session, to the named topic and recipient, through the role's permissions.
  - done: impl-203 · 2026-10-10T20:12:42.806Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-203-2 · 2026-10-10T20:13:51.345Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-203-2 · 2026-10-10T22:38:37.313Z
- [x] C3. A crash or kill of the run still posts a result naming the cause.
  - done: impl-203 · 2026-10-10T20:12:42.925Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-203-2 · 2026-10-10T20:13:51.345Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-203-2 · 2026-10-10T22:38:37.313Z
- [x] C4. The shipped and instance Implementer clauses use it; docs/agents/tests.md describes it.
  - done: impl-203 · 2026-10-10T20:03:47.509Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-203-1 · 2026-10-10T20:07:38.941Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-203-2 · 2026-10-10T20:13:51.345Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-203-2 · 2026-10-10T22:38:37.313Z
- [x] C5. `npm run typecheck && npm test` pass.
  - done: impl-203 · 2026-10-11T00:24:19.664Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-203-5 · 2026-10-11T00:24:50.756Z

## Notes

Size S. Pairs with T-201 (lock order).

## Comments

### coord · 2026-10-10T18:39:54.477Z

Correction (18:40Z): impl-196's 18:20Z run did not vanish; it completed and its callback delivered to rev-14 at 18:38:47Z (A-711). The lost runs are impl-190's (nohup), impl-183's (spoke-only frame, delayed 40 min), impl-196's earlier raw topic.send callback, and impl-187's (nohup).

### coord · 2026-10-10T19:50:33.409Z

Interim route in use (2026-10-10): impl-187's reporter (/tmp/cland-T187-suite.mjs) opens a HubClient spoke on the live hub with the session's own sessionId and name, then calls artifact.create and send. It works, proven in A-720, but each Implementer copies it by hand, and it opens a second spoke under one session identity. T-203 should replace it. impl-193 hit the same gap at 19:49Z: the CLI socket has no send, and topic.send is human-only.

### impl-203 · 2026-10-10T19:52:01.911Z

Claimed T-203; working in its provisioned task worktree. Implementing a hub-owned detached worker, durable run receipts and restart/kill reporting, reusing artifact and send permission checks with the caller's stable session id. Package runner remains the owner of machine/Neovim locks. No second spoke is needed.

### impl-203 · 2026-10-10T19:59:25.575Z

The interim HubClient callback dummy proof passed and delivered as impl-203, with durable log A-742 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-742-t-203-dummy-callback-proof-at-05dd0cc.log. Six scratch-hub CLI regressions passed: detached completion, duplicate active submission, SIGKILL, typecheck failure, preflight permissions and hub restart. Added permission-revocation retry and committed-message recovery coverage; final targeted checks underway.

### impl-203 · 2026-10-10T20:04:09.946Z

Committed and pushed 215b8a73ebc1f8934000939b2ec4336a4472ed3d on t/T-203-cland-suite-runs-the-full-suite-under. Fetched and merged origin/dev before final suite (already current). C1–C4 marked done; C5 pending the full typecheck+hub+Neovim run. Targeted 9/9 passed in A-747; final permission-only delta checks passed and typecheck is clean. A-748 records implementation and queue/recovery boundaries. Requesting rev-13 review now, then starting the proven interim persistent callback route and going idle.

### rev-13 · 2026-10-10T20:07:39.130Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261010-203-1
commit: 215b8a73ebc1f8934000939b2ec4336a4472ed3d

Medium — hub/src/hub/dispatch.ts:466: message existence does not establish all requested deliveries. For --to rev --to impl with the reviewer pair loop-muted, core commits only to impl, yet the run becomes reported; after unmute/restart the deterministic-id check prevents recovery to rev. Track/refuse/recover pending recipients without bypassing hygiene or duplicating successful delivery. Independently confirmed with an in-memory core probe.
Medium — hub/src/hub/suites.ts:80,94: cleanup signals a vanished worker's whole group or an unverified PID after awaited identity failure. Use verified positive-PID/start-identity cleanup consistently; unavailable/reused identity must not be signalled (repo process ownership invariant hub/README.md:710/1157).
Low heuristic — hub/src/hub/dispatch.ts:449: Dispatcher owns mutations and persistence callbacks for another module's job checkpoint; consider keeping checkpoint ownership in Suites.

Independent typecheck/diff checks pass, clean pinned head. A-747 targeted9/9 evidence and writing regressions inspected; summary/protocol probes pass. C2/C3 failed; C4 verified separately. C5 remains unverified pending fresh full suite, and normal-path C1 coverage does not clear these findings.

Review A-751: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-751-t-203-review-at-215b8a7-recipient-recovery-and-crash-cleanup.md.

Criteria: C2 failed (A partially refused result is marked reported and can never recover delivery to its named refused recipient.), C3 failed (Worker-death and launch-failure cleanup signal unverified PID/group identities, allowing termination of a reused identity.).

### impl-203 · 2026-10-10T20:10:44.322Z

A-751 review findings are being fixed. Superseded validation was cancelled with identity-verified process-tree cleanup; its single result is A-753 and C5 remains pending. Reporting now requires every intended recipient to pass hygiene before committing the one result, retaining a pending job across mute/restart without partial accepted deliveries. Removed both raw hub-side signal calls; failed launch/crash cleanup uses endProcess and retains unverified identities instead of signalling. Added live CLI regressions for muted named-recipient recovery across restart and preservation of unavailable worker identity. Narrowed the reporter callback to checkpointArtifact so Suites owns checkpoint mutation/persistence.

### rev-13 · 2026-10-10T20:13:51.345Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261010-203-2
commit: 5a8a480db588deb12c717148fcb33441da7ae3c9

No high or medium findings. A-751 C2/C3 fixed: all recipient admission precedes result commit, preserving pending recovery across mute/restart without partial delivery; hub error cleanup now verifies positive PID/start identities and preserves unavailable identities. Suites owns artifact checkpoint mutation, resolving the low heuristic. Imported T-196 dev changes retain suite behavior.

Independent typecheck/diff check pass; clean pinned task worktree. In-memory probe confirms no commit while reviewer muted and one result to both recipients after unmute. A-759 targeted11/11 passes with no fail/cancel/skip/todo; writing CLI/recovery regressions inspected rather than rerun in readonly sandbox. Combined full-item/delta review establishes C1–C4. C5 unverified pending fresh full suite, so readiness is not established.

Review A-762: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-762-t-203-re-review-at-5a8a480-findings-resolved-c5-pending.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-203 · 2026-10-10T22:31:23.657Z

Full run A-853 at5a8a480: typecheck passes;1305 tests,1304 pass,1 fails in Neovim shell reference-navigation test after-hook (kill EPERM, hub/test/process-cleanup.ts:165). C5 remains pending; diagnosing isolated test and merging current origin/dev before next full validation.

### rev-13 · 2026-10-10T22:31:39.026Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261011-203-1
commit: 5a8a480db588deb12c717148fcb33441da7ae3c9

Medium — hub/test/process-cleanup.ts:165 (nvim/test/shell.test.ts:429): gi/gt/gs shell case fails in its after-hook with killEPERM; the navigation assertions are not the reported failure. C5's complete package run is unsuccessful.

A-853 typecheck passes; hub1067/1067, Neovim237/238, aggregate1304/1305; zero cancelled/skipped/todo. No other failure. Clean unchanged head; C1–C4 and Standards/Spec A-762 remain supported. T-190's specifically scoped Terminal teardown exception is not an automatic exception for T-203. Resolve the shared cleanup finding or obtain this item's scoped Coordinator disposition before verification. Writing-suite evidence inspected rather than independently rerun.

Review A-854: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-854-t-203-c5-at-5a8a480-sole-shared-cleanup-eperm-failure.md.

Criteria: C5 failed (A-853 complete package exits1: hub1067/1067,Neovim237/238; sole killEPERM in shared process-cleanup after gi/gt/gs shell case.).

### impl-203 · 2026-10-10T22:35:48.724Z

Merged current origin/dev59742a3, resolved instance/shipped Implementer clause conflicts retaining cland suite and Lead routing, retained joint FIFO admission docs; pushed clean c987346188a13cb7766cfb914aeb232f264140d0. Typecheck clean, suite CLI/recovery11/11 A-855, full Neovim shell file83/83 A-856; exact prior failing test11/11 isolated. A-857 records unreproduced after-hook EPERM; cleanup unchanged, no C5 waiver. Renewed review requested before fresh full suite.

### rev-13 · 2026-10-10T22:38:37.314Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-203-2
commit: c987346188a13cb7766cfb914aeb232f264140d0

No high or medium findings in the requested C1–C4 merge integration. Standards and Spec both clear: atomic recipient admission, stable caller/current permissions, durable exactly-once checkpoints and verified-identity cleanup survive; T-201 joint FIFO, T-177 Lead routing and T-190 visibility integrate without changing result identity or attachments. Shipped/instance clauses retain cland suite and combined routing/admission docs.

Independent typecheck/diff check pass; clean pinned head. A-855 CLI/recovery11/11 and A-856 shell83/83 have zero failures/cancelled/skipped/todo; durable writing-suite evidence inspected rather than rerun read-only. Prior full-item A-762 plus this delta establish C1–C4.

C5 remains unverified: A-854 prior-head full run failed shared cleanup EPERM; A-857 says cause remains unconfirmed and no waiver applies. Final readiness is withheld pending fresh complete typecheck+hub+Neovim evidence on c987346.

Review A-858: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-858-t-203-merge-integration-at-c987346-c1-c4-clear-c5-pending.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-203 · 2026-10-10T23:35:02.494Z

A-885 at clean unchanged c987346 completed hub1083,pass1081,fail2; no Neovim phase. Failures: pid-identity.test.ts51 session.stop15s timeout; request-guard.test.ts43 healthy-client latency723ms > bound. Suite peak1m load13.60. Isolating both; C5 unresolved, no waiver.

### rev-13 · 2026-10-10T23:35:21.257Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261011-203-3
commit: c987346188a13cb7766cfb914aeb232f264140d0

Medium — hub/test/pid-identity.test.ts:80: Codex crash/restart/reused-PID case gets no session.stop result within15000ms; subsequent bystander/signal-refused assertions are not reached. This does not prove a reused PID was signalled; cause remains unconfirmed.
Medium — hub/test/request-guard.test.ts:59: other client waited723ms behind the flood, exceeding the timing bound. The additional Codex timeout prevents any sole-request-guard exception from clearing the run.

A-885 typecheck passes; npm test exits1, hub1081/1083, zero cancelled/skipped/todo. Package runner stops after failed hub phase, so outer Neovim did not run; the previous cleanup EPERM has not been rechecked by this full run. Clean unchanged c987346, C1–C4 and prior Standards/Spec integration A-858 stand. C5 failed; diagnose the timeout and provide successful complete final evidence or explicitly applicable Coordinator disposition. Durable output inspected read-only.

Review A-886: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-886-t-203-c5-at-c987346-two-hub-failures-neovim-not-reached.md.

Criteria: C5 failed (A-885 typecheck passes; npm test exits1: hub1081/1083, Codex session.stop timeout and request-guard723ms; outer Neovim phase not reached.).

### impl-203 · 2026-10-10T23:36:36.851Z

Coordinator decision a1fdc05b: C5 may combine A-885 hub with a fresh typecheck+Neovim-only run at c987346; only its request-guard timing and PID-reuse stop-timeout failures assigned to T-172 are scoped exceptions. Neovim not waived; any other failure remains real. Running authorized Neovim validation now; no code or head changes.

### coord · 2026-10-10T23:52:35.683Z

Root cause of the late deliveries (impl-184, 2026-10-10 23:52Z): a completion callback that sends through the session's own MCP tool only fires when the session next gets a turn, so results land after the next hub wake. Reporters that open their own HubClient spoke (the /tmp/cland-T187-suite.mjs pattern) deliver at once. `cland suite --report` must post from its own detached process, not through the caller's turn.

### impl-203 · 2026-10-11T00:23:50.159Z

Authorized typecheck+Neovim run A-927 at clean unchanged c987346: typecheck pass,249 tests248 pass1 fail. Sole failure thread.test.ts638 rendering append budget2.136042ms vs2ms. This case is listed in T-172; prior Coordinator exception covers only two hub cases and is not assumed to include this. Isolating rendering test and requesting explicit disposition/repair; C5 unresolved. PID case also passes3 additional isolated runs.

### impl-203 · 2026-10-11T00:24:19.594Z

Coordinator decision3fb62cd5 extends named T-172 exceptions for C5 atc987346: request-guard wall-clock latency; PID-reuse stop timeout; thread append2ms budget. Combined typecheck+hub A-8851081/1083 and typecheck+Neovim A-927248/249 contain only those3 cases. Required isolated rendering rerun passes A-929, append1.405ms. PID isolation4/4 A-888/A-928; shared dev flood reproduced A-889. Marking C5 done under explicit disposition, requesting rev-13 final C5 verification; no head changes.

### rev-13 · 2026-10-11T00:24:50.756Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-203-5
commit: c987346188a13cb7766cfb914aeb232f264140d0

No remaining unwaived findings. C5 clear under Coordinator a1fdc05b and3fb62cd5's explicit split and three named T-172 exceptions: request-guard wall-clock latency, Codex PID-reuse session.stop timeout, and thread append2ms budget. This is exception-based verification, not a fully green package result.

A-885 typecheck passes, hub1081/1083 with only the two named hub failures. A-927 typecheck passes, Neovim248/249 with only append2.136042ms >2ms. Both phases zero cancelled/skipped/todo; no other failure. Required isolated same-head A-929 passes1/1, append1.405ms/rewrite21.980ms, exact200cold/0warm parses, zero fail/cancelled/skipped/todo. Earlier cleanup EPERM does not recur. Aggregate1329/1332, exactly3 permitted failures.

Clean unchanged head independently reconfirmed; C1–C4 and A-858 stand, C5 done mark present. Durable complete logs inspected read-only; writing suites not independently rerun. A-930's pre-extension disposition is superseded.

Review A-931: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-931-t-203-final-c5-at-c987346-clear-under-three-named-t-172-exceptions.md.

Criteria: C5 verified.

### coord · 2026-10-11T00:24:59.989Z

Merged a61949083a07e2dff36803e643744eb50cba7fc1 onto dev.
