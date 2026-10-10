---
id: T-104
kind: task
title: "Concurrent launches for one exclusive role: the role is reserved after awaits, so admission order can flip under load"
state: closed
status: done
labels:
  - ready-for-agent
  - hub
assignee: null
parent: T-19
blocked_by: []
topic: topic-36
branch: t/T-104-concurrent-launches-for-one-exclusive
created: 2026-10-09T20:04:50.886Z
updated: 2026-10-10T00:58:17.911Z
---

## Parent

Part of T-19. Found by the Coordinator's full suite on dev a9be9a0 at 19:55Z on 2026-10-09, after T-75 and T-77 merged.

## What happened

hub/test/role-integrity.test.ts:70, "two launches for the Coordinator at once: the role is reserved before the spawn, so the second is refused at once", failed once in the full suite. It passed 3 of 3 times when run alone. The first launch, coord-1, was refused with "role coordinator is held by coord-2", so the second launch reserved the role first. Exclusivity held, since only one session got the role and nothing spawned twice. Admission order did not. T-75 added a fresh roles read, and T-77 an async stat of the cwd, before the reservation. Both are awaits, so under load the later request can reach the reservation first.

## What to build

- Reserve the exclusive role synchronously at request admission, before any await. Then do the fresh roles read and the cwd check. If the role turns out to be invalid or the launch fails, release the reservation, as the failed-launch path already does.
- Keep the guarantees of T-75 (a fresh roles read for launch, with the grant rechecked after the await) and of T-77 (async launch stat).

## Acceptance criteria

- [ ] Two concurrent launches for an exclusive role: the first admitted wins, deterministically, which a deferred test proves by holding the fresh read of the first launch.
- [ ] A launch whose fresh roles read revokes the caller's grant releases the reserved role, which a test proves.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. Implementer: Codex. Class B, a race across an await (A-96).

## Comments

### impl-104 · 2026-10-09T20:05:26.639Z

Claim confirmed; reproducing admission order deterministically by holding the first launch's fresh roles read. Will reserve before awaits, verify rollback and sweep resume/relaunch/role.set; one final npm test.

### impl-104 · 2026-10-09T20:10:27.960Z

Both races reproduced deterministically before their fixes: second launch succeeded while first fresh read was held; second role.set returned ok:true while first was held. Launch now reserves name/role synchronously before fresh and stat, and rechecks grants after both; role.set reserves exclusive admission without publishing the role before fresh validation. Seven admission/rollback tests and revoked-grant tests pass; typecheck passes. Resume/relaunch sweep: no role reservation after awaits; hello checks exclusivity synchronously and process publication re-reads the current role. Running the single final npm test.

### impl-104 · 2026-10-09T20:11:48.165Z

Committed the exact tree under the ongoing final suite, without content changes: d7ffcb6ba96439e73b521e42735d814fcce1fa1b (git log -1). Worktree clean. Diagnosis/invariants/sweep evidence: A-182, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-182-t-104-deterministic-reproduction-and-admission-fix.md. Typecheck and nine targeted cases pass; full suite result pending.

### rev-6 · 2026-10-09T20:16:42.001Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-104-1
commit: d7ffcb6ba96439e73b521e42735d814fcce1fa1b

Medium — hub/src/adapters/sessions.ts:256: admission checks cached exclusivity but does not revalidate the refreshed target-role definition; two launches admitted with reviewer.exclusive=false both spawn after fresh publishes exclusive=true. hub/src/hub/core.ts:762 also omits role.set admission ownership for cached nonexclusive roles, so the second assignment can win when its fresh read makes the role exclusive.
Medium — hub/src/adapters/sessions.ts:268: synchronous refusal and reservation rollback (:275) occupy separate resumed scopes without an intervening await; a 150 ms refusal plus 150 ms cleanup records slow=0. Post-fresh authorization (:264) and role.set refusal (:797-802 in dispatch.ts) have related scope gaps.

Normal first-admitted exclusivity and fresh-error/revoked-grant/bad-cwd/missing-adapter/spawn rollback probes pass; grants are checked after fresh and cwd stat. Resume/hello/current-row publication paths inspected. Both typechecks and diff check pass; no full suite run.

Separate Standards/Spec reports and reproducible memory probes: A-183, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-183-t-104-review-rev-6-104-1-at-d7ffcb6.md.

### impl-104 · 2026-10-09T20:19:03.000Z

Fix round head 6bf53e18fe94c9380e5debf21320aef9df3eda92, committed before suite and pushed to local origin. Reproduced three reviewer findings red: launch and role.set when fresh changes exclusivity from false to true, plus split 150 ms refusal + 150 ms rollback missing slow-request. All now green: ordered tickets for every named role, validation against the fresh/current snapshot and earlier live tickets, and one post-stat refusal/cleanup scope. Eleven admission tests and two RolesFile grant-refresh tests pass; typecheck passes. Superseded d7ffcb6 suite stopped cleanly by runner, exit 143. One full npm test on this new head follows.

### rev-6 · 2026-10-09T20:23:08.298Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-104-2
commit: 6bf53e18fe94c9380e5debf21320aef9df3eda92

No high or medium findings remain. Ordered tickets independent of cached exclusivity close both launch and role.set races; first-admitted wins after fresh makes Reviewer exclusive. Post-fresh and post-stat 150 ms refusal + 150 ms ticket release each record one resumed 300 ms stretch.
Low — hub/src/adapters/sessions.ts:277 / hub/src/hub/dispatch.ts:803: bounded cwd/stat initiation and synchronous assignment-error conversion remain outside adjacent measured scopes; folding these into the preceding callbacks would improve timing consistency.

Normal launch rollback, refused assignments, nonexclusive launch/assignment concurrency and interrupted-reservation startup recovery pass in memory. All settling success/failure paths release their own tickets; live pending I/O retains a ticket until it settles, with no new I/O deadline. Grant rechecks and existing hello/resume behavior remain intact. Both typechecks and diff check pass; no full suite run.

Separate Standards/Spec reports and reproducible probes: A-185, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-185-t-104-resolution-review-rev-6-104-2-at-6bf53e1.md.

### impl-104 · 2026-10-09T20:31:24.135Z

Message-contract correction committed separately: ed722e0472580004c6d15e442a12497ca6e6bf2c, pushed to local origin. Existing roles.test.ts is unchanged and its Coordinator-exclusivity case is green; actual holder retains the clear command, pending earlier admission names that request and asks caller to retry. New pending-message test brings admission coverage to twelve passing cases; typecheck and diff check pass. Prior full run on 6bf53e1 ended 628 hub tests: 627 pass, 1 refusal-wording failure; Neovim did not run after the hub failure. Full suite on new committed head follows.

### rev-6 · 2026-10-09T20:33:05.523Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-104-3
commit: ed722e0472580004c6d15e442a12497ca6e6bf2c

No new findings in 6bf53e1..ed722e0. Live/offline holder refusals restore the original actionable clear command; an earlier pending ticket receives the intended retry guidance. No other refusal text or admission behavior changes. Existing roles.test.ts is unchanged, and no assertion weakened.
Low, unchanged — hub/src/adapters/sessions.ts:277 / hub/src/hub/dispatch.ts:803: prior bounded timing-consistency note remains as recorded in rev-6-104-2.

Exact live/offline/pending messages and retry after release pass in memory. Independent hub typecheck and diff check pass. No full suite run.

Separate Standards/Spec reports and probe: A-186, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-186-t-104-refusal-wording-review-rev-6-104-3-at-ed722e0.md.

### impl-104 · 2026-10-09T20:43:21.205Z

Final handoff at ed722e0472580004c6d15e442a12497ca6e6bf2c: implementation committed/pushed, worktree clean; current rev-6-104-3 review is clear. Typecheck, twelve admission tests, two RolesFile grant-refresh tests and unchanged Coordinator-exclusivity assertion pass. Full npm test: 629 hub tests, 627 pass, 2 failures (doctor startup ENOENT after project removal; process-row 5000 ms frame timeout), Neovim skipped after nonzero hub exit. Per Coordinator request, each failed case passed 3/3 alone on final head and 3/3 alone on verified baseline 7e5f9596d8e4df8be11403960b70456e2855eb25: all 12 sequential probes pass, supporting flakes with no head-specific failure reproduced. A-189: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-189-t-104-final-implementation-and-test-evidence.md. Full log A-187: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-187-t-104-full-suite-on-ed722e0-627-pass-2-flaky-failures.log. Comparison log A-188: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-188-t-104-isolated-baseline-comparisons-12-of-12-pass.log. Awaiting Coordinator decision on suite acceptance/remaining Neovim verification; no merge.

### impl-104 · 2026-10-09T20:46:12.979Z

Verification complete at ed722e0472580004c6d15e442a12497ca6e6bf2c; worktree clean. Coordinator accepted both hub failures as pre-existing flakes after all twelve isolated head/baseline probes passed. Remaining Neovim stage ran via npm run test:nvim -> node hub/test/run-suite.ts nvim: exit 0, 104 tests/104 pass/0 fail, 98.19 s. A-190: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-190-t-104-neovim-stage-on-ed722e0-104-of-104-pass.log. Completed verification summary A-191: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-191-t-104-verification-complete-accepted-hub-flakes-and-green-neovim.md. Current review is clear; handoff ready for Coordinator merge gate. No merge performed.

### coord · 2026-10-09T20:46:22.292Z

Merged b8f96f9f41e02c4b66eca9ceb72f6ddd4cc08c16 onto dev.

### coord · 2026-10-09T20:46:29.629Z

Merged by the Coordinator through `cland merge T-104`: squash b8f96f9 on dev. Gate: review rev-6-104-3 clear on ed722e0. Earlier rounds: rev-6-104-1 (exclusivity changing during the fresh read, and split timing) and rev-6-104-2 (clear on 6bf53e1, with a low noted on T-79). Design: an ordered admission ticket for every role-naming launch and role.set, validated synchronously against the fresh definition after the read and again after the cwd stat. Refusals and rollback are timed in one scope. Holder refusals keep the actionable clear command. Suite on ed722e0: 627 of 629 hub tests passed. The two failures pass 3 of 3 alone on this head and on the base (A-187, A-188), so they are accepted as pre-existing flakes and filed as T-105. Neovim alone: 104 of 104 (A-190). impl-104 stopped. Dev was pushed to match the territory before this merge.
