---
id: T-1597
kind: task
title: The per-host allow list of leased task branches
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1591
topic: topic-1351
branch: t/T-1597-the-per-host-allow-list-of-leased-task
created: 2026-11-02T03:33:54.676Z
updated: 2026-11-03T03:41:15.208Z
closed: 2026-11-03T03:41:15.208Z
---

## Summary

The territory's `update` hook, when `CLAND_PUSH_HOST` is set, accepts a push only to `refs/heads/<branch>` for a task branch leased to that host. It refuses tags, other refs and deletions. The hub grants and revokes leases by rewriting the allow list under the territory lock, and revokes a branch's lease before a merge reads it. Existing territories get the new hook at hub start.

Hot files: `hub/src/territory.ts` (`TERRITORY_HOOK`, hook install), `hub/src/host/branch-leases.ts` (new), `hub/src/hub/merge.ts`, `hub/src/hub/merge-batch-territory.ts`, `hub/test/host-allow-list.test.ts` (new)

## Acceptance criteria

- [x] C1. Through host A's git socket a push to a task branch leased to A succeeds, and a push to a branch leased to host B, to an unleased task branch, to a tag or to `dev` is refused with a reason naming the host (test).
  - verified: rev-37 [reviewer] · run rev-37-1597-evidence-2 · 2026-11-03T00:49:36.060Z · commit afa67de1f750d92a015c61ae434f7b718976eca7
  - done: impl-1597 · 2026-11-03T02:04:22.268Z
  - verified: rev-37 [reviewer] · run rev-37-1597-evidence-3 · 2026-11-03T02:28:57.015Z · commit 15dd47c9459e9c92e2fe48296ba6f9c1f4dd4581
- [x] C2. Grant and revoke rewrite the allow list only under the territory lock, and a push racing a revoke is either accepted before it or refused after it, never merged after the revoke (test).
  - verified: rev-37 [reviewer] · run rev-37-1597-evidence-2 · 2026-11-03T00:49:36.060Z · commit afa67de1f750d92a015c61ae434f7b718976eca7
  - done: impl-1597 · 2026-11-03T02:04:23.312Z
  - verified: rev-37 [reviewer] · run rev-37-1597-evidence-3 · 2026-11-03T02:28:57.015Z · commit 15dd47c9459e9c92e2fe48296ba6f9c1f4dd4581
- [x] C3. Before a merge or a merge batch reads a task branch, the hub revokes every host's lease on it under the territory lock, and a later host push to it is refused (test).
  - verified: rev-37 [reviewer] · run rev-37-1597-evidence-2 · 2026-11-03T00:49:36.060Z · commit afa67de1f750d92a015c61ae434f7b718976eca7
  - done: impl-1597 · 2026-11-03T02:04:23.528Z
  - verified: rev-37 [reviewer] · run rev-37-1597-evidence-3 · 2026-11-03T02:28:57.015Z · commit 15dd47c9459e9c92e2fe48296ba6f9c1f4dd4581
- [x] C4. A territory initialised before this change gets the new hook at hub start, and pushes from the hub's own guarded operations (no `CLAND_PUSH_HOST`) behave as today (test).
  - verified: rev-37 [reviewer] · run rev-37-1597-evidence-2 · 2026-11-03T00:49:36.060Z · commit afa67de1f750d92a015c61ae434f7b718976eca7
  - done: impl-1597 · 2026-11-03T02:04:23.865Z
  - verified: rev-37 [reviewer] · run rev-37-1597-evidence-3 · 2026-11-03T02:28:57.016Z · commit 15dd47c9459e9c92e2fe48296ba6f9c1f4dd4581
- [x] C5. The territory-cli, territory-lock, merge and task-worktrees test files pass with no test edited.
  - verified: rev-37 [reviewer] · run rev-37-1597-evidence-2 · 2026-11-03T00:49:36.060Z · commit afa67de1f750d92a015c61ae434f7b718976eca7
  - done: impl-1597 · 2026-11-03T02:04:24.076Z
  - verified: rev-37 [reviewer] · run rev-37-1597-evidence-3 · 2026-11-03T02:28:57.016Z · commit 15dd47c9459e9c92e2fe48296ba6f9c1f4dd4581

## Notes

Shared files: `TERRITORY_HOOK` and the lease API grant/revoke (sole owner; 18 and 28 call it); `hub/src/territory.ts`

## Comments

### impl-1597 · 2026-11-02T23:42:24.910Z

Consumer inventory (rg field/function names, hook paths and importers across hub/src including colocated tests, hub/test, web/shared/nvim, qa/docs/.agents): territory hook install/probe: territory.ts, init/provision.ts, doctor/project.ts; locks: hub dispatch/daemon/releases/merge, git-maintenance; batch prepare: merge-batch-territory.ts + controller/tests; host socket/env: host/git-daemon.ts + host-git-daemon.test.ts; fixture consumers: harness, prepared-project, territory-task-branch, territory-lock, merge-checkout/gate/batches/component-support, push/publish, verification-tree, worktree-host, git-maintenance, codex-workspace-git, skill-provenance-merge, test-docs-merge and hub/worktrees.test.ts. Docs/QA: cland-init-and-cland-update, v0.4, E-1531-stage-3, T-117. No browser/wire/persisted schema contract changes. No-host pushes retain existing policy. Host-git-daemon test must grant its pushed branch under the new policy. Proposed lock order: existing worktrees.serial -> territory.lock -> Git ref/index locks; host daemon -> territory.lock -> Git ref locks. Awaiting lead decision on daemon serialization seam.

### impl-1597 · 2026-11-02T23:47:31.777Z

Coordinator-approved seam implemented. Lock order: worktrees.serial -> territory.lock -> Git ref/index locks; host receive admission -> territory.lock -> Git ref locks. Upload-pack never locks. First packet and push ownership each capped at 30s; native close precedes release. Batch critical section only revokes all member hosts and pins task heads; immutable preparation runs after release. Typed TerritoryBusy preserves existing refusal text and marks batch build/landing contention retryable. Lease API atomically rewrites tab-separated host/branch list; startup refresh uses existing injected lock seam in synthetic fixtures. Targeted macOS/Node24.21.0 receipts so far: 5/5 new allow-list cases, 4/4 migrated Git-daemon cases; full typecheck passed before final refinements. Full suites not run; no browser/provider/SSH. Lint initially caught manifest ordering, corrected.

### impl-1597 · 2026-11-02T23:56:49.815Z

Committed and pushed 8ea0462bd157daf8efccadd4d3dfe65f7db8c6ad (tree a889474a8d2615f20041493a45c021a493702c59). origin/dev fetched/merged before first review (986afe46b, already up to date), merge-tree clean, worktree clean. A-16009 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16009-t-1597-implementation-and-targeted-evidence.md records scope, local evidence and limits. Final source npm typecheck passed, lint exit0/refusals0 with known report-only findings; new native allow-list8/8 includes cap and failed-release boundary. Final-head unchanged merge.test.ts refresh is finishing before criterion completion/review request.

### rev-37 · 2026-11-03T00:01:03.091Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1597-source-1
commit: 8ea0462bd157daf8efccadd4d3dfe65f7db8c6ad
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards/Spec no findings, A-16015. Hook binds allowed task refs to daemon-supplied host; tags/other refs/deletions refuse, unhosted guarded policy preserved. Lease rewrites assert lock ownership; receive-only admission holds same lock until native close, with bounded first packet/push, pending+native capacity and incomplete-cleanup fence. Fetch stays concurrent. Immediate and native batch paths revoke all hosts before ref reads; batch pins within short lock section, immutable build outside; typed contention/reopen retries retain green receipt. Startup upgrades shared hook before sockets. Tests retain native advertisement/close, pinned bytes, all-host removal and final assertions; C5 files unedited. Matching subsystem docs/skill/guide updated. All C1–C5 remain run-dependent/unverified. A-16009 local darwin arm64 Node24.21 targeted/typecheck/lint supplemental only; no queued/full-suite/browser/SSH/provider receipt. No Reviewer execution/edits. Submit mode-free verify at exact head; required deferred C5 files need retained exact-head named native receipts/exit evidence. QA after-stage.

### rev-37 · 2026-11-03T00:22:13.989Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1597-evidence-1
commit: 8ea0462bd157daf8efccadd4d3dfe65f7db8c6ad
scope: evidence
findings: [{"severity":"medium","text":"Required production30s native cap test has no measured exact-case allowance: A-16039 enforces duration budget30.044s>5s and exits1 although assertions pass. Keep native cap/cleanup assertions; add an authorized-owner bounded duration exception, then request new-head source review.","file":"hub/test/host-allow-list.test.ts","line":173}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear. Actual log line25642: 'duration budget: hub/test/host-allow-list.test.ts::a stalled receive releases its write fence after the 30 second cap and native close 30.044 s > 5 s (add to hub/test/durations.json with a reason)'. This enforced check differs from later report-only legacy10s/ratchet notices. A-16039 run c7e1b4fd at exact source-clear head exits1: T0/T1/T2 green, selected T3 functional12/12 pass but phase fails; Web unexecuted. Independently checked allow-list8/daemon4/batches75/task-worktrees19 all pass; C5 territory-cli/lock/merge absent, require retained current-head supplements if deferred. Completed prefix aggregate4668/4668; native T2 summary4533/4533. Linux x64 droplet Node24.21 Neovim0.12.5, no cache/browser, tree32bdaf41a484c67dcc663771ce043601110670f3. General lint/legacy budgets/ratchet report-only. A-16040 records diagnosis; its test location should read173 and30.044s is total case timing including fixture setup, not isolated cap latency. C2 marked failed for gate/evidence, not a functional lease assertion; other criteria unverified. No Reviewer execution.

Criteria: C2 failed (Required ownership-cap test passes assertions but fails enforced exact-case duration gate (30.044s>5s); overall queued receipt exits1, so final evidence cannot clear.).

### impl-1597 · 2026-11-03T00:25:38.094Z

Correction at afa67de1f750d92a015c61ae434f7b718976eca7, committed/pushed with no dev merge after first source review. Coordinator e6fdcd00 explicitly disallowed a duration allowance; additive GitDaemonOptions.receiveTimeoutMs defaults to HOST_PUSH_TIMEOUT_MS30000. Consumer search covers startGitDaemon/GitDaemonOptions/HOST_PUSH_TIMEOUT_MS in production, native tests and subsystem/skill docs: omitted-option daemon4 controls retain default; allow-list cap test supplies500ms, starts after acquired lock, retains native close/drain/fresh-grant assertions and checks constant30000. Corrected case584.657ms incl setup, allow-list8/8, daemon4/4 and full typecheck pass locally darwinarm64/Node24.21.0. No new-head queued verification yet. Capturing raw exact-head unedited C5 controls before fresh source review.

### rev-37 · 2026-11-03T00:27:03.471Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1597-source-2
commit: afa67de1f750d92a015c61ae434f7b718976eca7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; Standards/Spec no findings, A-16042. Coordinator e6fdcd00 confirmed: injectable cap supersedes allowance advice. receiveTimeoutMs validates positive finite native range and defaults to unchanged30000; timer starts inside acquired lock before launch, clears after native completion, first-packet cap unchanged. Test injects500ms+constant assertion and retains advertisement/blocked grant/native exit/drain/fresh-grant receipts and final assertion. Docs/kept skill/change record replace real30s-test guidance; no allowance/C5 edits/dev merge. A-16041 exact-head darwin arm64 Node24.21 raw CLI26/lock20/merge7 pass with exec exit0 (signal explicitly unreported) retained as local supplements. All C1–C5 await fresh exact-head queued evidence; need current-head allow-list8/daemon4/batches75/task-worktrees19 outcomes. Old A-16039 remains failed on duration gate. No Reviewer tests/browser/edits; QA after-stage.

### rev-37 · 2026-11-03T00:49:36.060Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1597-evidence-2
commit: afa67de1f750d92a015c61ae434f7b718976eca7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, no findings; C1–C5 verified. A-16064 exact source-clear head run900a6511 exits0,4848/4848 with fail/cancel/skip/todo0. Independently streamed generated finish receipts: allow-list8 incl host/ref policy, both native push/revoke orderings, all-host immediate/batch revoke-and-pin, startup upgrade, injected expiry/default assertion and failed-release fence; daemon4; batches75 incl build/land retry after reopen; unchanged task-worktrees19 all pass. Deferred C5 unchanged CLI26/lock20/merge7 exact-head local darwin arm64 Node24.21 raw A-16041 each exit0, signal explicitly unreported; usable supplements, not queued Linux results. A-16065 maps criteria/provenance. Linux x64 droplet sfo2 Node24.21 Neovim0.12.5 isolated Headless Shell156.0.8078.4r1248; T0/T1/all-T2/Web/changedT3 once complete (2files/12identities), remainingT3 deferred/T4 and repetitions unexecuted. Exact-case gate passes, no allowance; general lint122/59files/budget/ratchet report-only, skip-reason report missing0. Uncached, canonical tree78620fe52e5af0917824fa81c73a7f366c318b96. Prior A-16039 remains failed. No Reviewer tests/browser/edits; QA after-stage.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-1597 · 2026-11-03T01:56:02.210Z

Batch failure classified (b), confirmed before product changes: deterministic native regression `node --test --test-name-pattern='revoke joins a receive' hub/test/host-allow-list.test.ts` failed in821.983ms with `TerritoryBusy: another territory operation holds the lock` at public revoke after Git client had exited while fs.rm of that receive's exact territory.lock was held. Distinct mkdtemp fixture identities rule out shared roots; no cleanup error is injected. Coordinator decision7e3a3955: only public revoke gets bounded wait (HOST_PUSH_TIMEOUT_MS + small margin, injectable); receive/merge retain refusal/retry and lock order; same-owner context must not wait on itself. Existing lock module has no release notification; reuse its bounded25ms–1s backoff helper, no new polling loop. Deadline preserves current busy message. Will keep native release/ref assertions and prove five local repetitions alongside authorized test load, then fresh source/verify. One-line T-1591 seam note requires Coordinator because original task.comment own-item refusal remains binding.

### rev-37 · 2026-11-03T02:05:45.912Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1597-source-3
commit: 15dd47c9459e9c92e2fe48296ba6f9c1f4dd4581
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Revoke-wait source clear, Standards/Spec no findings; A-16123. Coordinator public-only bounded wait decision confirmed. Public revoke alone opts into existing bounded retry helper with cap+2s default/injectable deadline; wrappers default0, receive/grant/merge refusal/order unchanged. Active matching-root ALS context reused without self-wait; write assertion/release drainage retained. Deterministic held-release test observes client exit plus contender read before releasing exact lock, then durable empty list; deadline/reentry controls retain policy assertions. Docs/skill/change record updated, C5 files unedited. Independently streamed A-16121:10 unique allow-list cases each base+5 local load passes (60completions), no non-pass; authorized darwin arm64 Node24.21 disposable-source package run, no artificial CPU stress/full suite/browser. Extra standard Neovim smoke files distinguished; zero-test launcher attempt not coverage. Lock20/typecheck/lint reports supplemental. All C1–C5 await new exact-head queued/native preservation evidence; prior green applies only to prior head, failed batch stays red. No Reviewer execution/edits. If authorized dev merge occurs after T-1601 landing, new head needs another source review before verify.

### rev-37 · 2026-11-03T02:28:57.016Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1597-evidence-3
commit: 15dd47c9459e9c92e2fe48296ba6f9c1f4dd4581
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final revoke-wait evidence clear, no findings; all C1–C5 verified. A-16126 exact-head run31b99f6d exits0,4850/4850 fail/cancel/skip/todo0. Independent per-record finish scan: native allow-list10/daemon4 pass once incl original policy, held async release and reentrant ownership; batches75unique/85pass completions (both contention cases base+5T2 load), task-worktrees19 all pass. A-16130 refreshed exact-head raw C5 CLI26/lock20/merge7 local darwin arm64 Node24.21 each exit0/signal explicitly unreported, zero fail/cancel/skip. A-16121 authorized same-head local load proof10cases×(base+5) retained; not added to queued aggregate. A-16132 maps criteria/limits. Linux x64 droplet Node24.21 Neovim0.12.5 isolated Headless Shell156.0.8078.4r1248; T0/T1/all-T2/Web/selectedT3 once complete(2files/14identities), remainingT3 deferred/no queuedT3 repeats/T4 unexecuted. Uncached canonical tree515f55841218b4b724f7ebadabda8a8b9e9438aa; exact-case gate passes, lint122/59files/legacy budgets/ratchet report-only, skip reason report missing0. Prior green remains prior-head, failed batch red. No Reviewer tests/browser/edits; QA after-stage.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-03T03:41:15.208Z

Merged 1fcc37db5702bacc22d63be1bcbc26362a48099d onto dev.
