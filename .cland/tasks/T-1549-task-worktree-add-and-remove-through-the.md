---
id: T-1549
kind: task
title: Task worktree add and remove through the Host
state: open
status: ready
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1543
topic: topic-1298
branch: t/T-1549-task-worktree-add-and-remove-through-the
created: 2026-10-31T23:47:42.044Z
updated: 2026-11-01T09:05:33.690Z
---

## Summary

`ensureTaskWorktree` and `removeTaskWorktree` keep their policy, lock and path checks in the territory module, but add and remove the worktree through a Host's worktreeAdd and worktreeRemove. Those operations also make the root `node_modules` link and the stale-install warning.

Hot files: `hub/src/territory.ts`, `hub/src/hub/worktrees.ts`

## Acceptance criteria

- [x] C1. `ensureTaskWorktree` and `removeTaskWorktree` take a Host, `local` by default, and call its worktreeAdd and worktreeRemove for the `git worktree add` and `remove` steps (test).
  - verified: rev-35 [reviewer] · run rev-35-1549-final-1 · 2026-11-01T07:53:13.810Z · commit 5376aec357c6651f513775bc2d6c5b4a82a827cf
  - done: impl-1549 · 2026-11-01T07:53:24.657Z
  - verified: rev-35 [reviewer] · run rev-35-1549-delta-1 · 2026-11-01T09:05:33.130Z · commit 6b6c4f9d5442627eb3ff18dcf9fcdb48b85073f5
- [x] C2. The `node_modules` link and the stale-install warning come from worktreeAdd, and `TaskWorktrees` no longer calls `symlink` itself.
  - done: impl-1549 · 2026-11-01T07:25:00.694Z
  - verified: rev-35 [reviewer] · run rev-35-1549-source-2 · 2026-11-01T07:33:42.071Z · commit 5376aec357c6651f513775bc2d6c5b4a82a827cf
  - verified: rev-35 [reviewer] · run rev-35-1549-final-1 · 2026-11-01T07:53:13.810Z · commit 5376aec357c6651f513775bc2d6c5b4a82a827cf
  - verified: rev-35 [reviewer] · run rev-35-1549-delta-1 · 2026-11-01T09:05:33.130Z · commit 6b6c4f9d5442627eb3ff18dcf9fcdb48b85073f5
- [x] C3. With a recording Host, a claim, an item launch and a prune make one worktreeAdd per created worktree and one worktreeRemove per pruned one, each under the territory lock (test).
  - done: impl-1549 · 2026-11-01T07:25:02.413Z
  - verified: rev-35 [reviewer] · run rev-35-1549-final-1 · 2026-11-01T07:53:13.810Z · commit 5376aec357c6651f513775bc2d6c5b4a82a827cf
  - verified: rev-35 [reviewer] · run rev-35-1549-delta-1 · 2026-11-01T09:05:33.130Z · commit 6b6c4f9d5442627eb3ff18dcf9fcdb48b85073f5
- [x] C4. The task-worktrees, task-worktrees-lifecycle, worktree-cli and territory-lock test files pass with no test edited.
  - done: impl-1549 · 2026-11-01T07:25:03.370Z
  - verified: rev-35 [reviewer] · run rev-35-1549-final-1 · 2026-11-01T07:53:13.810Z · commit 5376aec357c6651f513775bc2d6c5b4a82a827cf
  - verified: rev-35 [reviewer] · run rev-35-1549-delta-1 · 2026-11-01T09:05:33.130Z · commit 6b6c4f9d5442627eb3ff18dcf9fcdb48b85073f5

## Comments

### impl-1549 · 2026-11-01T07:11:45.223Z

Consumer inventory before optional internal Host plumbing: territory ensure/remove callers are TaskWorktrees (claim, item launch, prune, merged cleanup), hub/src/hub/worktrees.test.ts and hub/test/tracker-native-boundary.test.ts. TaskWorktrees consumers: dispatcher, task-worktrees.test.ts (legacy injected WorktreeGit fake), session-async-processes.test.ts, launch-admission.test.ts. Host worktreeAdd/remove consumers: local implementation and reusable host-contract.ts. Searches included field/function names across hub/nvim/web/shared, skills, docs and QA; no wire/persisted shape changes. Optional trailing Host parameter preserves callers; existing Host options must stay compatible. Rollback Git worktree creation/removal paths also require review; detached restoration cannot use current branch-only Host interface unchanged.

### impl-1549 · 2026-11-01T07:15:23.953Z

Coordinator decision applied: legacy injected WorktreeGit overrides now adapt into Host operations in hub/src/host/legacy-worktree-git.ts; TaskWorktrees has no install-helper call. Internal Host.worktreeAdd adds optional reuseOnly (install-only) and detached (rollback restoration); existing callers retain branch-only behavior and reusable previous-shape contract remains unedited. All native add/remove paths, including confinement/CAS recovery, use supplied Host under territory lock. Local red-first receipt: worktree-host.test.ts initially failed with warning undefined, missing node_modules, and ignored recording Host; now 3/3 pass. Native C4 files remain unedited.

### impl-1549 · 2026-11-01T07:16:23.024Z

Applied Coordinator decision: legacy injected WorktreeGit compatibility lives in host/legacy-worktree-git.ts; TaskWorktrees calls no install helper. Added optional reuseOnly/detached Host add options; existing branch-only Host contract unchanged. Unedited C4 local macOS runs passed: task-worktrees 19 tests, task-worktrees-lifecycle 3, worktree-cli 4, territory-lock 20. New recording Host tests passed 3/3; typecheck passed. test:lint is still running. No full suite run locally.

### impl-1549 · 2026-11-01T07:17:56.835Z

Coordinator quiet-machine decision 15292553 supersedes the earlier local test evidence: all loaded-run receipts are diagnostic only, not passing evidence. Heavy commands stopped; worktree-host run interrupted at file cleanup (3 assertions completed, file cancelled), test:lint interrupted (exit 130). Will rerun all required targeted checks and typecheck/test:lint sequentially only after Coordinator posts local runs resume. Source implementation is committed; criteria/review remain pending fresh receipts.

### impl-1549 · 2026-11-01T07:24:01.067Z

After explicit resume: sequential fresh typecheck and test:lint passed (lint report-only findings, 0 refusals); worktree-host 3/3 and unedited task-worktrees 19/19 passed at start/end vm.loadavg below 10. Fetched/merged origin/dev before first review (tracker/QA-doc-only changes), pushed head 6794262b3f13c1229fb8e8b3372030b57e8c12c9; merge-tree clean tree 61ae1c6b15727c513fc5b9a04e45d16ed74aec22. Lifecycle completed 3/3 but end load 10.52, treated provisional; waited a minute (load 5.03) and rerunning that file now. No local suites.

### rev-35 · 2026-11-01T07:26:49.265Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1549-source-1
commit: 6794262b3f13c1229fb8e8b3372030b57e8c12c9
scope: full
findings: [{"severity":"medium","text":"Host.worktreeAdd now creates the Git worktree and immediately runs worktreeInstall before verifyCreatedWorktree checks post-Git confinement. Previously confinement was verified before install reads/symlink writes. A parent swapped during Git can now receive install writes outside the intended root, and an install failure bypasses confinement verification entirely. Preserve a post-create confinement barrier before install handling and cover raced-parent plus install-failure recovery.","file":"hub/src/territory.ts","line":570},{"severity":"medium","text":"The new separate git branch creation is followed by resumed(authorize) outside the cleanup try. If authority is revoked during the awaited branch command, that check throws and leaves the newly created branch behind without worktree or CAS cleanup. Include every post-branch failure boundary in owned recovery; preserve a concurrently advanced branch with compare-and-swap and test the revocation interleaving.","file":"hub/src/territory.ts","line":585}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear: two medium findings. territory.ts:570 calls Host add, including install effects, before verifyCreatedWorktree; raced parent/install failure can write outside confinement or bypass verification. territory.ts:585 authorizes after newly creating branch outside cleanup try; revocation during branch command strands its new ref. Preserve prior confinement-before-install ordering and CAS-owned cleanup across every post-branch boundary. Success-path routing/lock tests otherwise match scope; native race/recovery controls required for fixes. No Reviewer execution.

Criteria: C1 failed (Host add moves install side effects before post-Git confinement and split branch creation leaves an uncovered authorization-failure cleanup boundary.).

### impl-1549 · 2026-11-01T07:28:31.726Z

Source-review fixes: consumer inventory adds optional Host.worktreeAdd beforeInstall barrier callback, awaited after native Git creation and before install reads/writes. Local Host and legacy compatibility adapter are the only implementations; recording Host forwards options; previous branch-only contract remains unchanged. Territory supplies confinement/recovery + reauthorization barrier; transport implementations must await it before install effects. Adding held native-registration/branch-command regressions in worktree-host.test.ts without changing C4 files. No wire/schema change.

### impl-1549 · 2026-11-01T07:32:08.721Z

Both source findings fixed in pushed 5376aec35. Red held regressions reproduced injected install error before confinement (new/existing branches) and leftover unmodified branch after durable creation + authorization revocation. Green expanded worktree-host file 10/10 includes concurrent writer preservation and contained install-failure retention. beforeInstall callback blocks install I/O pending territory confinement/authorization; rollback restoration skips installs. All post-branch errors share captured-tip cleanup. Typecheck and test:lint pass (0 refusals; report-only findings). Rerunning C4 unedited files sequentially; task-worktrees 19/19 green, lifecycle running. No dev merge after first review.

### rev-35 · 2026-11-01T07:33:42.071Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1549-source-2
commit: 5376aec357c6651f513775bc2d6c5b4a82a827cf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear. Standards/Spec: no findings. Both medium findings resolved: Host beforeInstall awaits territory confinement/authorization after Git and before install effects; recovery skips installs. Every post-branch failure now shares captured-tip cleanup, with registered worktree retention and concurrent-ref CAS protection. Held regression controls prove new/existing parent races, revoked authority with unchanged/advanced ref, and post-confinement install failure. Lock/final prune protections and four preservation files retained. C2 source verified; C1/C3/C4 pending exact-head native/verify receipts. No Reviewer execution; QA after-stage.

Criteria: C2 verified.

### rev-35 · 2026-11-01T07:53:13.810Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1549-final-1
commit: 5376aec357c6651f513775bc2d6c5b4a82a827cf
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear. Standards/Spec no findings. A-15247 records inspected receipts: A-15243 same-head787b1dd3 exit0,4565 pass,zero fail/cancel/skip/todo. All six worktree-host top-level identities and four nested controls pass; task-worktrees13 top-level outcomes pass. T0/T1/all fallback T2/Web/changed T3 complete; remaining T3/T4/full premerge unexecuted. Linux x64 droplet Node24.21.0 isolated Headless Shell1248/Chrome Testing156.0.8078.4; report-only budget/lint/ratchet,no cache/skips. A-15246 supplies same-head local macOS Node24.21.0 named native lifecycle3/CLI4/territory-lock20 pass,exit0; filtered tracker-native-boundary13 and hub worktrees2 native code0/signal null/no timeout. Source equality excluding .cland independently checked. Prior two medium fixes retain held confinement/CAS coverage. C1–C4 verified. No Reviewer execution; after-stage QA and Coordinator full premerge cover separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-35 · 2026-11-01T09:05:33.130Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1549-delta-1
commit: 6b6c4f9d5442627eb3ff18dcf9fcdb48b85073f5
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear; Standards/Spec no findings. A-15261: Coordinator decision5d362b3e explicitly authorized dev merge and rule6 waiver/batch route. Both skill paragraphs preserved verbatim; no manual runtime edits. Task territory/worktree/legacy adapter and criterion test files identical to prior reviewed head; additive incoming fileType and artifact/Events changes already reviewed. A-15260 merged-head macOS Node24.21 typecheck/lint exit0,0 lint refusals,report-only findings; conflict-text search has no matching tests. C1–C4 rechecked/carried under explicit rule6 waiver using unchanged source/tests and prior A-15243/A-15246 receipts. Those receipts remain prior-head evidence, not new-head runtime passes. Additional all9ba018aa failed bundling after authorized HEAD change; runtime counts unavailable. New-head runtime/full premerge evidence pending Coordinator T1–T3 merge batch; this is delta source clearance for ready/enqueue, not a green suite claim. After-stage QA separate. No Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
