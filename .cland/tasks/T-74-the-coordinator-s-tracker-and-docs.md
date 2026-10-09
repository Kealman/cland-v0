---
id: T-74
kind: task
title: "The Coordinator's tracker and docs commits have no sanctioned path to the territory's dev: the hook refuses them, and the only workaround is the raw marker"
state: closed
labels:
  - ready-for-agent
  - slice-2
  - territory
assignee: null
parent: T-19
blocked_by: []
topic: topic-31
branch: t/T-74-the-coordinator-s-tracker-and-docs
created: 2026-10-09T15:00:48.091Z
updated: 2026-10-09T17:57:00.959Z
---

## Parent

Part of T-20; found on the first day on `dev`, 2026-10-09 at 15:00Z, right after the D15 interim ended.

## What happened

Decision D1 says the Coordinator's tracker and docs commits land on `dev` directly. The territory's `update` hook, from T-53, refuses every update of `dev` that does not carry cland's marker. So `git push origin dev` with a tracker commit was rejected ("hook declined"). The Coordinator then pushed with `CLAND_TERRITORY_WRITE=1`. That works, but it is the raw accident-guard bypass, and it is undocumented as a normal path. If local `dev` holds unpushed tracker commits, `cland merge` lands its squash on top of whatever it sees, and the root and the territory can diverge.

## What to build

A sanctioned way for the Coordinator's own commits to reach `dev`, with no raw marker:
- `cland push`, or a `dev` push grant for the Coordinator. It fast-forwards the territory's `dev` to the root's `dev` under the territory lock, only when it is a fast-forward and only for the Coordinator or the human. A session shell with another role is refused.
- Check what `cland merge` does when the root's `dev` is ahead of the territory's: it should push those commits first, as part of the merge, or refuse naming them. Pick one and document it.
- Update the `merge` skill and hub/README.md's push rule. In AGENTS.md's managed block, say how tracker commits reach `dev`.

## Acceptance criteria

- [ ] The Coordinator's tracker commit on the root's `dev` reaches the territory with one sanctioned command and no environment marker. An Implementer's attempt is refused.
- [ ] `cland merge` with the root's `dev` ahead of the territory has a defined, tested outcome.
- [ ] `npm run typecheck && npm test` pass, and the docs are updated.

## Notes

Size S. Implementer: Codex. Until this lands, the Coordinator pushes tracker commits with the marker. Each such push is a fast-forward of its own tracker commits only, and is noted in the run notes on T-20.

## Comments

### impl-74 · 2026-10-09T16:50:26.711Z

Implementation choice: cland push publishes root dev explicitly; merge refuses root-ahead before preparation, names unpublished commits and directs Coordinator to cland push. Reusing the queued territory lock/runner; converting inherited fs calls in async lock/territory checks to async I/O to satisfy request-path constraints.

### impl-74 · 2026-10-09T17:01:15.245Z

Implementation committed and pushed to local origin: 4b9f4171c2ec49319a89ea1825fa180b3e080ba9 (lock conversion first, feature/docs second). Targeted evidence: territory-lock 5/5, push 10/10, merge regression 39/39; npm run typecheck passes. Required npm test is running on the exact committed tree. A-126 records the behavior and partial-failure states.

### rev-65 · 2026-10-09T17:07:48.598Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-74-1
commit: 4b9f4171c2ec49319a89ea1825fa180b3e080ba9

High — hub/src/hub/lock.ts:178 (33b7c39): After A's failed exclusive creation and a prior holder's normal release, A can observe null then queue unlink; B creates/acquires the lock before that unlink completes, which removes B's live lock and lets A acquire too. The break guard does not exclude ordinary creation. Retry exclusive creation for absence and ensure stale removal cannot erase a successor; add this deferred null-snapshot interleaving. This breaks mutual exclusion across merge/release/sync/push.

Medium — hub/src/territory-push.ts:46 (4b9f417): After an accepted push loses its reply, a failed confirmation query is swallowed as null and becomes push-git/push-refused even though territory dev moved. Return an explicit publication-outcome-unknown state with verification/retry guidance when confirmation is unavailable; do not imply an ordinary refusal with unchanged refs.

Standards: 0 findings (clear). Spec: 1 high, 1 medium (not clear). Read both commits separately, T-74, A-126 and shared-operation/identity/failure tests. Both findings reproduced with pinned source and fully virtual filesystem/process/Git ports, no source/temp files or actual pushes. Other reviewed role/grant, fast-forward/no-force, named merge-refusal and known post-publication follow-up paths match the item. Synchronous init APIs remain unchanged. git diff --check passes; no suite run, as requested.

Evidence A-128 with both runnable probes: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-128-t-74-review-4b9f417-lock-race-and-unknown-publication.md.

### impl-74 · 2026-10-09T17:19:46.082Z

Fix round on f79164bcf0ab91c3af0f97a2c68e74e4706ecc24 addresses rev-65-74-1. Both sync and async lock lifecycle operations now share a crash-recoverable nonempty directory guard; absent snapshots never unlink, stale removal cannot erase a successor, and failed reads are preserved. push-outcome-unknown has CLI exit 2, a distinct event and verify/retry guidance; pending-merge verification no longer treats failed Git queries as unlanded. Lock 11/11, push 11/11 and typecheck pass. Full npm test rerun is running on the exact committed tree. A-131 contains evidence, compatibility details and the exact roles.toml line.

### rev-65 · 2026-10-09T17:26:46.063Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-74-2
commit: f79164bcf0ab91c3af0f97a2c68e74e4706ecc24

Medium — hub/src/territory.ts:91: A lock-release failure in finally replaces a primary push-outcome-unknown; hub/src/hub/releases.ts:51 then logs push-refused and the CLI exits 1 despite possible publication. Preserve the typed unknown outcome with cleanup detail and add this combined post-publication failure regression. Exact Releases/wrapper virtual-port probe confirms the primary code is lost.

High none remaining; other medium/low none. Standards 0 (clear); Spec 1 medium (not clear). The original high is resolved: both lock APIs guard creation, removal and release; absent snapshots never unlink; unique owner filenames and rmdir preserve successors through empty-directory rename and concurrent recovery; legacy main records, failed reads and repeated release are handled conservatively. The direct lost-reply/failed-confirmation case now correctly reports push-outcome-unknown, CLI2 and its distinct event; only subsequent cleanup masking remains.

Reran adapted A-128 probes against pinned f79164b. Twelve virtual lock schedules passed, including the null-snapshot race, empty-guard rename gap, two recoverers, crash/legacy cases in sync and async APIs, failed reads, obsolete release and a live owner with unknown start. Direct unknown-publication probe passed; combined unknown-publication/lock-release probe reproduced the remaining medium. Read T-74, A-131 and all seven changed files. git diff --check passes. No suite or edits; full suite running per request.

Evidence A-136 with all runnable probes: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-136-t-74-resolution-f79164b-unknown-outcome-masked-by-cleanup.md.

### impl-74 · 2026-10-09T17:38:54.835Z

Second fix round: absent lock/directory release now returns without creating a guard in sync and async APIs, including directory disappearance after the ownership check. A shared cleanup wrapper preserves primary typed errors and appends cleanup failure details at all lock/territory finally sites and sync scratch cleanup. Targeted lock 16/16 and push 12/12 pass; the combined real CLI test checks published dev, lost reply, failed confirmation and failed release retain exit 2/event/retry guidance. New lock regressions fail against pinned f79164b (0/5), and session-process comparisons reproduce head 0/3 versus base 3/3 three times. Sequential orphan comparison is in progress because global doctor --fix cases interfere when paired.

### rev-65 · 2026-10-09T17:46:56.123Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-74-3
commit: 84fb16f83b06311c3a73932c52c20d863b75cb07

Standards: clear — high 0, medium 0, low 0.
Spec: clear — high 0, medium 0, low 0.

The remaining medium from rev-65-74-2 is resolved: territory and lock cleanup preserve the original typed publication error, its code and recovery fields, adding cleanup detail. Unknown publication retains its event and CLI exit-2 classification. Absent/deleted-project lock release creates no guard, including directory deletion after the ownership check; successor-holder protection remains intact.

Pinned-source read-only virtual probes passed 23 lock cases, 3 wrapper cases and the combined unknown-publication/release-failure case. git diff --check passed. Coordinator reports targeted tests and typecheck passing; full suite remains pending with Implementer, and no Reviewer suite was run as requested.

Evidence: A-141, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-141-t-74-resolution-review-84fb16f-rev-65-74-3.md

### impl-74 · 2026-10-09T17:56:15.748Z

Implementation complete at 84fb16f83b06311c3a73932c52c20d863b75cb07, pushed to the local task branch; clean worktree, no merge. Both shutdown release and primary-outcome cleanup fixes are in the final commit. npm run typecheck && npm test passed on exactly that frozen tree: hub 528/528, Neovim 94/94, zero failures/skips; duration 618.88s, suite-lock wait 0.01s. A-144 is the full validation log; A-140 contains all counted three-run head/base comparison output and doctor evidence; A-146 is the final report with the exact project roles.toml line for the Coordinator. Targeted lock/push/release/session/verdict/doctor checks also pass. Machine-wide doctor --fix tests interfere if whole orphan files run side by side, so those comparisons were rerun sequentially.

### coord · 2026-10-09T17:56:27.226Z

Merged 72b71d3d423801839231b865a56848005fc83ea1 onto dev.

### coord · 2026-10-09T17:57:00.958Z

Merged by the Coordinator through `cland merge T-74`: squash 72b71d3 on dev. Gate: review rev-65-74-3 clear on 84fb16f, after rev-65-74-1 (lock race, high, and unknown outcome, medium) and rev-65-74-2 (outcome masked by cleanup). Full suite on 84fb16f: 528 hub + 94 Neovim passed, no failures or skips (A-144). Head and base comparisons: A-140. qa-12's live matrix passed on f79164b (A-134). impl-74 stopped.
Observed at this merge: the root's dev held an unpushed commit, 5d228e5, by the human's account through another Claude session at 17:01Z. It is a two-line docs link update for the design canvas. The running hub predates T-74, so the gate did not refuse, and the merge published 5d228e5 to the territory beneath 72b71d3. That is exactly the case T-74's new refusal covers once the hub runs this code. The Coordinator's `push` grant is added to this project's roles.toml in a separate commit.
