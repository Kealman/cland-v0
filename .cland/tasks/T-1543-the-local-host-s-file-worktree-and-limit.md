---
id: T-1543
kind: task
title: The local host's file, worktree and limit operations
state: closed
status: done
size: M
criterion_seq: 8
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1542
topic: topic-1289
branch: t/T-1543-the-local-host-s-file-worktree-and-limit
created: 2026-10-31T23:47:40.588Z
updated: 2026-11-01T01:06:49.352Z
closed: 2026-11-01T01:06:49.352Z
---

## Summary

Add the file operations to the Host: stat of a working directory with its identity, realpath, read a file's bytes and list a folder's files by path, `git worktree add` and `remove` with the root `node_modules` symlink, who stands inside a worktree, and the limit-poll operation. The `local` host implements each with today's code, the contract suite covers every member, and the account poller asks the local Host before an idle poll.

Hot files: `hub/src/host/host.ts`, `hub/src/host/local.ts`, `hub/test/host-contract.ts`, `hub/test/host-local-contract.test.ts`, `hub/src/accounts/poller.ts`

## Acceptance criteria

- [x] C1. The `Host` interface gains statDirectory, realpath, readFile, listFolder, worktreeAdd, worktreeRemove, occupants and limitPolls, and the `local` host implements each.
  - done: impl-1543 · 2026-11-01T00:40:04.425Z
  - verified: rev-35 [reviewer] · run rev-35-1543-source-2 · 2026-11-01T00:43:00.648Z · commit b018f43c0c4a37f5d7801b00dd86d918a6761675
  - verified: rev-35 [reviewer] · run rev-35-1543-final-1 · 2026-11-01T01:00:04.585Z · commit b018f43c0c4a37f5d7801b00dd86d918a6761675
- [x] C2. statDirectory gives `sessionCwdRefusal`'s refusals for a missing path and for a file, and for a directory gives no refusal plus its device and inode (test).
  - done: impl-1543 · 2026-11-01T00:40:04.534Z
  - verified: rev-35 [reviewer] · run rev-35-1543-final-1 · 2026-11-01T01:00:04.585Z · commit b018f43c0c4a37f5d7801b00dd86d918a6761675
- [x] C3. realpath resolves a symlinked directory to its target and returns a missing path unchanged, as Codex's `real` helper does today (test).
  - done: impl-1543 · 2026-11-01T00:40:04.639Z
  - verified: rev-35 [reviewer] · run rev-35-1543-final-1 · 2026-11-01T01:00:04.585Z · commit b018f43c0c4a37f5d7801b00dd86d918a6761675
- [x] C4. readFile returns a file's exact bytes and refuses a directory or a missing path, and listFolder lists a folder's regular files as `folderFiles` does (test).
  - done: impl-1543 · 2026-11-01T00:40:04.940Z
  - verified: rev-35 [reviewer] · run rev-35-1543-final-1 · 2026-11-01T01:00:04.585Z · commit b018f43c0c4a37f5d7801b00dd86d918a6761675
- [x] C5. In a scratch repository worktreeAdd adds a worktree on the given branch, links the root `node_modules` into it when the root has one, and returns today's stale-install warning; worktreeRemove removes it and refuses a worktree with changes (test).
  - done: impl-1543 · 2026-11-01T00:40:05.063Z
  - verified: rev-35 [reviewer] · run rev-35-1543-final-1 · 2026-11-01T01:00:04.585Z · commit b018f43c0c4a37f5d7801b00dd86d918a6761675
- [x] C6. occupants returns the sessions whose real cwd is the worktree or lies under it, including through a symlinked alias, and none for a sibling path that shares the prefix (test).
  - verified: rev-35 [reviewer] · run rev-35-1543-final-1 · 2026-11-01T01:00:04.585Z · commit b018f43c0c4a37f5d7801b00dd86d918a6761675
  - done: impl-1543 · 2026-11-01T01:00:10.356Z
- [x] C7. limitPolls on the `local` host allows idle polls, the account poller checks it before each idle poll, and `account-poller.test.ts` and `account-poller-clock.test.ts` pass with no test edited.
  - done: impl-1543 · 2026-11-01T00:40:05.471Z
  - verified: rev-35 [reviewer] · run rev-35-1543-final-1 · 2026-11-01T01:00:04.585Z · commit b018f43c0c4a37f5d7801b00dd86d918a6761675
- [x] C8. A T1 test fails when a member of the `Host` interface has no case in the contract suite (test).
  - done: impl-1543 · 2026-11-01T00:40:05.579Z
  - verified: rev-35 [reviewer] · run rev-35-1543-source-2 · 2026-11-01T00:43:00.649Z · commit b018f43c0c4a37f5d7801b00dd86d918a6761675
  - verified: rev-35 [reviewer] · run rev-35-1543-final-1 · 2026-11-01T01:00:04.586Z · commit b018f43c0c4a37f5d7801b00dd86d918a6761675

## Comments

### impl-1543 · 2026-11-01T00:37:47.067Z

Contract consumer inventory (rule 20): Host/localHost currently consumed only by hub/test/host-contract.ts and host-local-contract.test.ts; no wire/snapshot/persisted Host shape yet. AccountPoller constructor consumers: daemon startup plus account-poller.test.ts and account-poller-clock.test.ts (preserve existing optional args). Existing behaviours to reuse: session-cwd.ts; codex.ts real helper; artifact-folder.ts folderFiles (artifacts/create and folder tests); TaskWorktrees.#make install checks, #observe containment; territory ensure/remove task worktrees. These existing callers remain API-compatible; adapter/worktree/artifact routing is follow-on epic work. Shared install policy will be extracted and imported by both TaskWorktrees and local Host. Search covered production, tests including T3/T4, docs, skills, web/nvim/shared; no previous Host wire shape to migrate.

### rev-35 · 2026-11-01T00:41:20.308Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1543-source-1
commit: 03b54ee5005a51dc6ae4de36a34d7b3b899f4a70
scope: full
findings: [{"severity":"medium","text":"occupants introduces a second realpath/fallback and directory-containment policy already implemented by TaskWorktrees.#observe (worktrees.ts:298–330). This violates rule 24 and permits Host occupancy and destructive-prune occupancy to drift. Extract the shared path-resolution/containment computation and use it from both while preserving #observe's snapshot/identity revalidation.","file":"hub/src/host/local.ts","line":28},{"severity":"low","text":"Reusable Host contract compares readFile's promised Uint8Array directly to Buffer under strict deepEqual; a valid plain Uint8Array with identical bytes fails. Normalize to byte arrays/Buffer before comparison. Lines 82–83 also hard-code local name/poll policy in the generic suite; keep local-only expectations in the local wrapper or parameterize them.","file":"hub/test/host-contract.ts","line":31}]
finding_counts: {"high":0,"medium":1,"low":1}

Source not clear: medium hub/src/host/local.ts:28 duplicates TaskWorktrees realpath/containment policy (rule 24); share the computation while retaining prune snapshot and identity revalidation. Low hub/test/host-contract.ts:31 strict Buffer equality overconstrains Uint8Array API; lines 82–83 local-only expectations reduce generic suite reuse. Other source criteria look implemented. Final evidence must include all six native host-local-contract identities despite unchanged wrapper, plus untouched account-poller/account-poller-clock cases for C7. No Reviewer runtime/browser execution; no full run yet.

Criteria: C6 failed (Host occupancy re-derives existing TaskWorktrees path/containment policy instead of sharing it as rule 24 requires.).

### rev-35 · 2026-11-01T00:43:00.649Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1543-source-2
commit: b018f43c0c4a37f5d7801b00dd86d918a6761675
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear. Standards: no findings. Spec: no findings. Original medium and low resolved: exported realWorktreePath/resolvedOccupants shared by Host and both prune computations; snapshot/tracker/inode revalidation retained. Byte-sequence comparison accepts declared Uint8Array; local identity/poll expectations parameterized in executable wrapper. C1 and C8 source verified. C2–C7 await native same-head run evidence, including all six Host wrapper identities and unchanged account-poller/account-poller-clock controls, plus worktree extraction regressions. No Reviewer runtime/browser execution. Proceed mode-free cland verify at this head; QA policy none.

Criteria: C1 verified, C8 verified.

### rev-35 · 2026-11-01T01:00:04.586Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1543-final-1
commit: b018f43c0c4a37f5d7801b00dd86d918a6761675
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; Standards and Spec: no findings. All C1–C8 verified. A-15144 passed run a5c60a5b pins reviewed head, remote runner tree 90f061f832f05211822c04ccf497231928d05595 (not cached). T0/T1/T2/selected T3/Web exit 0, reported 4540 passes, zero fail/cancelled/skipped/todo. Actual six Host wrapper identities pass; T1 guards pass plus 5/5 repetitions; clock controls 10 and task-worktrees 13 top-level passes. Linux x64 droplet Node 24.21.0, Neovim 0.12.5, isolated Chrome Headless Shell 1248 / Chrome for Testing 156.0.8078.4. Changed T3 ran once/no repetitions; remaining T3 deferred, T4 unexecuted. Native C7 poller and native prune controls completed separately on unchanged head: A-15146/A-15147 each six named raw pass receipts/native exit 0, Darwin 27.0.0 arm64 Node 24.21.0, Git tree 7ebd3712fcbfa7cc50477cab034e0185b5951c2e. Native tests unchanged. Local and runner trees reported distinctly. Budget/test-lint/ratchet/Web repetition and skip-reason notices report-only. No Reviewer tests/browser execution; QA none.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### coord · 2026-11-01T01:06:49.352Z

Merged 44b91d214ccfc27c5d4181437121ac9a5e4a749a onto dev.
