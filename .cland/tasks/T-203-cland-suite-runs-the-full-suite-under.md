---
id: T-203
kind: task
title: cland suite runs the full suite under the lock and posts one result for its session
state: open
status: review
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
updated: 2026-10-10T20:13:51.345Z
---

## What to build

Each Implementer writes its own wrapper to run `npm run typecheck && npm test` under the suite lock and report the result. On 2026-10-10, five runs were lost or went unreported. impl-190's nohup launch died with its tool shell. impl-183's report used a spoke-only frame and was lost for 40 minutes. impl-196's callback used raw topic.send, which the hub refuses, and a later run vanished. impl-187's Neovim run ended with no report. Each loss cost a queue slot and a Coordinator nudge (T-189 findings).

`cland suite [all|hub|nvim] --report <session|topic> [--to <session>]` runs the suite in the current worktree under the machine locks (T-175), detached from the caller's shell. It stores the log as an artifact and posts one message with the exit code, the counts, the failures and the artifact id through the hub as the calling session. While it waits it shows its queue position (T-201). The Implementer clause names it as the only way to run a full suite.

## Acceptance criteria

- [x] C1. `cland suite` survives the caller's shell exiting and posts exactly one result, whether pass, fail or crash, with the log artifact.
  - done: impl-203 · 2026-10-10T20:03:47.158Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-203-2 · 2026-10-10T20:13:51.345Z
- [x] C2. The result is posted as the calling session, to the named topic and recipient, through the role's permissions.
  - done: impl-203 · 2026-10-10T20:12:42.806Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-203-2 · 2026-10-10T20:13:51.345Z
- [x] C3. A crash or kill of the run still posts a result naming the cause.
  - done: impl-203 · 2026-10-10T20:12:42.925Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-203-2 · 2026-10-10T20:13:51.345Z
- [x] C4. The shipped and instance Implementer clauses use it; docs/agents/tests.md describes it.
  - done: impl-203 · 2026-10-10T20:03:47.509Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-203-1 · 2026-10-10T20:07:38.941Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-203-2 · 2026-10-10T20:13:51.345Z
- [ ] C5. `npm run typecheck && npm test` pass.

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
