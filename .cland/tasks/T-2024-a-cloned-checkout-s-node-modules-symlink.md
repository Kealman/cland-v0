---
id: T-2024
kind: task
title: A cloned checkout's node_modules symlink is not ignored by .gitignore, so every dev T3 probe is refused as a dirty worktree
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: topic-1673
branch: t/T-2024-a-cloned-checkout-s-node-modules-symlink
created: 2026-11-20T01:12:37.043Z
updated: 2026-11-20T03:04:56.285Z
closed: 2026-11-20T03:04:56.285Z
---

## Summary

The dev T3 probe's checkout is a separate `git clone --shared --no-checkout`, and `prepareBatchDependencies` symlinks its `node_modules` to the root's. `.gitignore` has `node_modules/`, and the trailing slash doesn't match a symlink. Only `.git/info/exclude` ignores it, and a clone has its own empty exclude file. So `git status --porcelain` shows the symlink, and every probe is refused with "dirty worktree cannot be bundled for droplet". That is what drives the T-2023 loop (cland-impl's diagnosis, 2026-11-20).

## What to build

Make the root `.gitignore` ignore `node_modules` whether it's a directory or a symlink (`node_modules` without the slash). Check every other path that `prepareBatchDependencies` or verify-prepare creates in a checkout for the same gap.

## Acceptance criteria

- [x] C1. In a fresh `git clone --shared` of the repo with the `node_modules` symlink that `prepareBatchDependencies` creates, `git status --porcelain --untracked-files=all` prints nothing (test).
  - done: impl-2024 · 2026-11-20T01:31:04.418Z
  - verified: rev-35 [reviewer] · run rev-35-2024-evidence-1 · 2026-11-20T01:59:50.950Z · commit d761f3daf173d6eede7b38012198abf831f1f02d
- [x] C2. Every path that batch or probe dependency preparation creates in a checkout is listed, and each is ignored by `.gitignore` (evidence).
  - done: impl-2024 · 2026-11-20T01:24:30.998Z
  - verified: rev-35 [reviewer] · run rev-35-2024-source-2 · 2026-11-20T01:32:45.616Z · commit d761f3daf173d6eede7b38012198abf831f1f02d
  - verified: rev-35 [reviewer] · run rev-35-2024-evidence-1 · 2026-11-20T01:59:50.950Z · commit d761f3daf173d6eede7b38012198abf831f1f02d

## Comments

### impl-2024 · 2026-11-20T01:24:31.173Z

Red/green: new disposable shared-clone test reports actual ?? node_modules with old directory-only rule; full verify-prepare.test.ts passes 2/2 after one-line ignore fix. Dependency preparation path inventory committed in docs/agents/tests/hub-test-verify-prepare.test.ts.md. No hub source changes. Local full test:lint and typecheck exit 0; native runs macOS arm64 Node v24.21.0, no install/network/browser.

### rev-35 · 2026-11-20T01:27:22.504Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2024-source-1
commit: 59b3e3a4590e7e4bb03c9b2757e5478f69142e90
scope: full
findings: [{"severity":"medium","text":"M1 (Standards/rules9,12): new shared-clone regression lacks encompassing pre-acquisition setup/body ownership and native Git child enrollment/close joins; per-command timeouts and tempProject cleanup do not fence the original continuation before root disposal.","file":"hub/test/verify-prepare.test.ts","line":14}]
finding_counts: {"high":0,"medium":1,"low":0}

Initial full Standards/Spec review not clear; A-22015 records medium M1 at verify-prepare.test.ts:14. Leadcc147c79 confirms the new callback lacks a pre-acquisition whole-callback owner and native child enrollment; per-command timeout/tempProject cleanup are narrower. Preserve real Git clone, actual worktreeInstall symlink, unignored-file positive control, check-ignore and final empty-status assertions while fixing caller/setup/child ownership. The node_modules rule is correct and inspected producer/path inventory reveals no further ignore gap. C1 failed; C2 remains done/unverified; no criteria newly verified. A-22013's precommit local red/green and static-check ordering remain qualified, not configured or cancellation proof. Hold released for correction/fresh committed-head review before verify; no slot/window granted.

Criteria: C1 failed (M1: new native shared-clone test has no encompassing bounded setup/body owner or enrolled Git child-close join before fixture cleanup.).

### rev-35 · 2026-11-20T01:32:45.616Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2024-source-2
commit: d761f3daf173d6eede7b38012198abf831f1f02d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source2 clear; A-22019 records full Standards/Spec pass at d761f3daf173d6eede7b38012198abf831f1f02d/tree115820694c4c71346853c68f948d3de034f8eb8e. M1 repaired via residueControl before root acquisition, separately bounded filesystem/clone/assertion steps and residueChild enrollment/close/result joins for every actual Git command. Positive resource/root disposal fences remain. All Git/worktreeInstall/symlink/status/check-ignore/positive-control assertions retained. Ignore behavior and inspected preparation output inventory unchanged; C2 verified. C1 remains done/unverified pending configured same-head run. A-22017 ordinary precommit local2/2/static-check reports remain qualified and supplement original red A-22013. No findings, production/helper redesign, Reviewer runtime or dev merge. Hold released for lead to obtain Coordinator's verify window at this head.

Criteria: C2 verified.

### rev-35 · 2026-11-20T01:59:50.950Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2024-evidence-1
commit: d761f3daf173d6eede7b38012198abf831f1f02d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged d761f3daf173d6eede7b38012198abf831f1f02d; A-22037 audits d8aa3f3e/A-22036. Exact shared-clone case passes at36103, sibling install/preparation case at36108, file completes36111; all original Git/symlink/status/check-ignore/positive controls retained. Producer receipts pair uniquely:7061 test passes/0fail/0skip/0cancel plus731 separate file passes, no repeats inferred. T0/all234T1/all441T2/all55Web and changedT3 file complete;271T3 batch-deferred/18T4 unexecuted. C2 inventory/source verification current; verify C1/C2. Linux x64 c-8 ams3 Node24.21/Nvim0.12.5, HeadlessShell1248/Chrome156.0.8078.4; cache:null, canonical tree1224d6d7 differs in kind from Git tree11582069. T3 ratchet/duration/lint advisories report-only, no allowance claimed. No findings or Reviewer runtime/source changes.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-20T03:04:56.285Z

Merged 488bfb0162afc4fb18f6be3a8b6b85e3767741d0 onto dev.
