---
id: T-1555
kind: task
title: The item's task branch in the territory before its worktree
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1550
  - T-1553
topic: topic-1316
branch: t/T-1555-the-item-s-task-branch-in-the-territory
created: 2026-10-31T23:47:43.466Z
updated: 2026-11-02T03:19:34.046Z
closed: 2026-11-02T03:19:34.046Z
---

## Summary

An item launch creates its task branch `t/<id>-<slug>` in the territory from the territory's task base (`dev`), under the territory lock. The launch's Host then adds the worktree from that branch. On the `local` host the root branch, its tip and the worktree are the same as today.

Hot files: `hub/src/territory.ts`, `hub/src/hub/worktrees.ts`, `hub/src/host/local.ts` (worktreeAdd from a territory branch)

## Acceptance criteria

- [x] C1. A first item launch creates `refs/heads/t/<id>-<slug>` in the territory at the task base's tip, under the territory lock, before the Host's worktreeAdd is called (test).
  - verified: rev-37 [reviewer] · run rev-37-1555-source-2 · 2026-11-02T02:13:38.750Z · commit 12d1fb798727e7cf7236a7784f3524a555002eea
  - verified: rev-37 [reviewer] · run rev-37-1555-evidence-1 · 2026-11-02T02:37:39.432Z · commit 12d1fb798727e7cf7236a7784f3524a555002eea
  - done: impl-1555 · 2026-11-02T02:37:53.683Z
- [x] C2. With a recording Host as the launch's host, the territory ref already exists when worktreeAdd is called (test).
  - done: impl-1555 · 2026-11-02T02:03:54.190Z
  - verified: rev-37 [reviewer] · run rev-37-1555-source-2 · 2026-11-02T02:13:38.750Z · commit 12d1fb798727e7cf7236a7784f3524a555002eea
  - verified: rev-37 [reviewer] · run rev-37-1555-evidence-1 · 2026-11-02T02:37:39.432Z · commit 12d1fb798727e7cf7236a7784f3524a555002eea
- [x] C3. On the `local` host the root's task branch, its tip and the worktree path are as today, and so is the `task-worktree` journal record (test).
  - done: impl-1555 · 2026-11-02T02:03:54.317Z
  - verified: rev-37 [reviewer] · run rev-37-1555-evidence-1 · 2026-11-02T02:37:39.432Z · commit 12d1fb798727e7cf7236a7784f3524a555002eea
- [x] C4. A launch whose task branch already exists in the territory adds the worktree at the territory's tip (test).
  - verified: rev-37 [reviewer] · run rev-37-1555-evidence-1 · 2026-11-02T02:37:39.432Z · commit 12d1fb798727e7cf7236a7784f3524a555002eea
  - done: impl-1555 · 2026-11-02T02:37:53.885Z
- [x] C5. A worktree add that fails after the territory ref was made leaves no territory branch behind (test).
  - verified: rev-37 [reviewer] · run rev-37-1555-evidence-1 · 2026-11-02T02:37:39.432Z · commit 12d1fb798727e7cf7236a7784f3524a555002eea
  - done: impl-1555 · 2026-11-02T02:37:54.277Z
- [x] C6. The task-worktrees, task-worktrees-lifecycle, territory-cli and worktree-cli test files pass with no test edited.
  - done: impl-1555 · 2026-11-02T02:03:54.877Z
  - verified: rev-37 [reviewer] · run rev-37-1555-evidence-1 · 2026-11-02T02:37:39.432Z · commit 12d1fb798727e7cf7236a7784f3524a555002eea

## Comments

### impl-1555 · 2026-11-02T01:56:24.312Z

Consumer inventory: searched ensureTaskWorktree, worktreeAdd, TaskWorktree and task-worktree across hub/src, hub/test, web, nvim, shipped skills and docs. Production callers: TaskWorktrees #make/launch/afterClaim and merge cleanup; adapters requests/sessions; territory creation/rollback/remove; Host local/test-host/legacy-worktree-git. Doubles: hub/src/hub/worktrees.test.ts, task-worktrees policy, worktree-host, host-contract/registry, launch-admission, lead/roles component, aide lifecycle, tracker-native-boundary and session-async-processes. Journal readers: journal/agents-topic, wire/UI consume unchanged task-worktree record. CLI territory/worktree and codex-workspace-git/native lifecycle files cover Git outcomes. New optional Host.worktreeAdd territory source remains compatible with existing callers/doubles that omit it; all return/wire shapes remain unchanged. Docs: Host subsystem README/implement and per-file guidance. Baseline scratch fixture passed on pre-change source (local macOS, Node 24; one file only).

### impl-1555 · 2026-11-02T01:59:55.696Z

Decision by coord, 2026-11-02 02:00Z, amending A-15078 for the local host (message 457bead1-7160-48c1-9e11-7e29a906aa7f): local task launch starts at root task-base/dev tip, including unpublished tracker commits. Under territory lock push that commit to create the territory task ref before Host.worktreeAdd. Nonlocal launch starts at territory dev tip. For either Host an existing territory task branch supplies its tip. Root-only branch behavior remains unchanged. Prune removes a launch-created territory branch only at its recorded launch base (root dev for local). Leave task-worktrees-lifecycle fixture unchanged. Reviewer must assess this amendment with C1/C3/C6.

### impl-1555 · 2026-11-02T02:02:53.810Z

Additional launch-path inventory: validateLaunchHost is called by adapters/requests.ts, Sessions.launch and TaskWorktrees.launch; hub/src/hub/worktrees.test.ts has seven void-returning legacy doubles. It now returns the already validated Host additively, so ignored returns retain behavior; #make defaults to the service Host when an old double returns undefined. TaskWorktrees.launch captures and passes that Host. New launch regression failed false !== true before this wiring, proving ensureTaskWorktree recording tests alone did not cover admitted placement. worktree-host fixture now injects its recording local Host into Sessions too.

### rev-37 · 2026-11-02T02:07:51.540Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1555-source-1
commit: 84fc0499d78d4118e48da93d0b71845124ad4f28
scope: full
findings: [{"severity":"medium","text":"Normal local push after absent-ref read accepts a concurrently created equal/ancestor ref, then marks it launch-owned; failed-add rollback/prune can delete another writer's pre-existing branch. Require atomic create-only publication/empty-old-ref lease before ownership metadata; cover equal/ancestor races.","file":"hub/src/territory.ts","line":606},{"severity":"medium","text":"Task fetch tip is reread through shared FETCH_HEAD after awaited rev-parse/worktree-list. An unrelated concurrent root fetch can replace it, causing root ref/worktree at wrong commit; confinement callback does not validate a confined HEAD. Pin the operation's fetched tip across yields and cover competing fetch.","file":"hub/src/host/local.ts","line":27}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear: two medium ownership/tip races (territory.ts:606; host/local.ts:27), detailed in findings. Coordinator amendment reviewed: local root-base/nonlocal territory-base and existing territory priority intended behavior otherwise preserved. Implementer agrees first race (ee4f2a6d); second is shared FETCH_HEAD new-tip race, distinct from old-tip CAS. No executed failure claimed; source-only reasoning. Other criteria runtime evidence unverified, named preservation files unchanged. No Reviewer tests/browser. Fixed head needs fresh source review before verify.

Criteria: C1 failed (Local publication can accept a branch created concurrently instead of proving launch created it.), C4 failed (Shared FETCH_HEAD can be overwritten by unrelated fetch before task ref/worktree is created, selecting wrong tip.), C5 failed (Rollback can delete a concurrent writer's pre-existing equal/ancestor territory ref after normal push misclassifies ownership.).

### impl-1555 · 2026-11-02T02:10:51.293Z

Source review rev-37-1555-source-1 found two mediums at 84fc0499d. Reproduced before fixes: concurrent ancestor/equal territory refs both returned 'unexpected success'; unrelated fetch changed the task branch SHA through shared FETCH_HEAD. Fixes require empty-old-ref push lease plus native porcelain new-ref receipt (up-to-date grants no ownership), and pass captured {path, tip} through optional Host source, fetch that SHA with --no-write-fetch-head and update from that literal captured SHA. All optional-source consumers (two territory call sites, Host interface/local implementation, recording test forwarders) migrated; legacy omitted-source callers unchanged. New held native-boundary tests preserve writer ref/provenance and assert exact root/worktree SHA. Final updated branch test file passed 16 tests on local macOS Node24.21.0. No verification submitted before fresh source review.

### rev-37 · 2026-11-02T02:13:38.750Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1555-source-2
commit: 12d1fb798727e7cf7236a7784f3524a555002eea
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh full source clear, Standards/Spec no findings. Both prior mediums resolved: local creation requires empty-old lease plus exact positive porcelain new-ref receipt before provenance (equal up-to-date grants no ownership); Host territory {path,tip} pins fetch/update-ref SHA and uses --no-write-fetch-head. Held native regressions assert preserved competing ancestor/equal refs/provenance and checkout identity despite unrelated FETCH_HEAD, releasing/joining in finally. Coordinator local-root/nonlocal-territory base amendment retained, admitted Host launch route intact. Four C6 preservation files unchanged. C1/C2 branch-before-Host/lock source properties verified; C3–C6 run-dependent evidence awaits exact-head mode-free verify. Local focused16/17/typecheck/lint supplemental only; no Reviewer execution/browser.

Criteria: C1 verified, C2 verified.

### impl-1555 · 2026-11-02T02:37:08.984Z

Exact-head mode-free verification ae455d28 at 12d1fb798 passed 4683/4683, no failures/cancellations/skips; A-15538. Linux x64 droplet c-8 lon1, Node24.21.0, Chrome Headless Shell156.0.8078.4/v1248; lifetime1122s/$0.0779. T0/T1/fallback all T2/Web and selected changed T3/T4 base completed; remaining T3 deferred to batch, T4 repetitions skipped. Budget/ratchet missing baselines report-only. Reviewer parsed branch16/host17/task-worktrees19 rows. Final C6 missing native T3 receipts now run on unchanged reviewed head: lifecycle3, territory-cli26, worktree-cli4, each local macOS arm64 Node24.21.0 native code0/signal null, no skips. Raw redacted stdout/stderr plus disk/load/native receipts in durable A-15539. Final evidence review requested; source/tree clean and no dev merge after first review.

### rev-37 · 2026-11-02T02:37:39.432Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1555-evidence-1
commit: 12d1fb798727e7cf7236a7784f3524a555002eea
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, C1–C6 verified. A-15538 runae455d28 Finished exit0 at exact source head/tree0106fbad4afb7a2ccbc412bb4e878ae7d9aa1451, noncached Linux x64 droplet Node24.21.0 Neovim0.12.5, isolated Headless Shell1248 Chrome156.0.8078.4. T0/T1/all-T2/Web plus selected T3 passed; mapped T4 base-only, repetitions skipped; remaining T3 deferred, no full T3/T4 claim. Aggregate4683pass,0fail/cancel/skip/todo. Independently checked named branch16 (amended local/nonlocal bases, existing-tip, launch Host, rollback, ancestor/equal race and competing FETCH_HEAD), host17, unedited task-worktrees19 outcomes all pass. A-15539 adds exact-head unedited lifecycle3/territory-cli26/worktree-cli4 raw named outcomes and nativecode0/signalnull, zero fail/cancel/skip/todo, sequential macOS arm64 Node24.21.0 targeted T3 (no browser/provider/native harness). Completes C6 required preservation receipts. Budget/lint/ratchets report-only; QA full after-stage. No Reviewer execution; no findings on either axis.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-11-02T03:19:34.046Z

Merged 5eb24394b40357707aab85fe3c69a19c5080c373 onto dev.
