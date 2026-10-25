---
id: T-1272
kind: task
title: "Version bump: the root package.json and lockfile at 0.2.1"
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1191
blocked_by: []
topic: topic-1020
branch: t/T-1272-version-bump-the-root-package-json-and
created: 2026-10-25T05:58:03.152Z
updated: 2026-10-25T06:18:49.512Z
closed: 2026-10-25T06:18:49.512Z
---

## Summary

R-1191 ships version 0.2.1 (the human's choice, ask ae65f3f2). `cland release --item R-1191 --dry-run` refuses because dev's package.json says 0.2.0. Bump the root package.json and package-lock.json from 0.2.0 to 0.2.1, the same way T-1185 did for 0.2.0 (4db0183a).

## What to build

Set `version` to 0.2.1 in the root package.json and in the root entries of package-lock.json, and change nothing else in the lockfile. Leave web/package.json's own version alone, as T-1185 did.

## Acceptance criteria

- [x] C1. The root package.json and both root version entries in package-lock.json read 0.2.1, and `npm install --package-lock-only --ignore-scripts` leaves the lockfile unchanged (test).
  - done: oc-1272 · 2026-10-25T05:59:47.568Z
  - verified: rev-26 [reviewer] · run rev-20261025-1272-final-1 · 2026-10-25T06:13:07.883Z · commit f75a2f46673fe0449eb5e443121e4e5406b926c3

## Comments

### oc-1272 · 2026-10-25T05:59:47.521Z

C1 evidence (head f75a2f46, worktree /Users/evgeniyivanov/Projects/cland/v0/.cland/worktrees/T-1272):
- package.json `version` = 0.2.1; package-lock.json root `version` and `packages[""].version` = 0.2.1. web/package.json untouched.
- `npm install --package-lock-only --ignore-scripts` exit 0; package-lock.json sha256 dd641a1fa60b4608b44e0c46dac18356d7df71dbf2b7b789c0a47e1e9aeb5b4e both before and after the run, so the lockfile is unchanged beyond the edit.
- `git diff --stat` after the command: package-lock.json 4 ++--, package.json 2 +- (3 insertions, 3 deletions); `git status --porcelain` lists only those two files.
- `npm run typecheck` (hub, nvim, shared, web) passed at this head; no test files are touched, so no targeted test file ran. Full selection runs through cland verify.

### rev-26 · 2026-10-25T06:00:24.430Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1272-source-1
commit: f75a2f46673fe0449eb5e443121e4e5406b926c3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, Standards 0 findings / Spec 0 findings; A-11614. Exactly three intended version lines in two files, all 0.2.1. Lockfile bytes match base with only two root version substitutions; committed SHA256 dd641a1fa60b4608b44e0c46dac18356d7df71dbf2b7b789c0a47e1e9aeb5b4e matches recorded pre/post install value. web/package.json unchanged. C1 runtime portion remains unverified pending retained original npm lockfile-command evidence and exact-head configured mode-free result. No release/landing/publication verdict.

### rev-26 · 2026-10-25T06:13:07.883Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1272-final-1
commit: f75a2f46673fe0449eb5e443121e4e5406b926c3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1 verified. A-11617 audits original local A-11615 and configured A-11616 / run 0d6cfd87-f06e-45c2-95ce-fa04f141356f at unchanged source-cleared head. Three required values are 0.2.1; direct second npm install exit=0 with identical pre/post SHA256 matching committed lockfile establishes stability. First tail pipeline and local typecheck-tail limits retained, not treated as independent native exit/full capture. Configured raw log: 3111 ordinary test passes/437 file passes, no failures/cancellations/skips or repetition receipts; T0/T1/all fallback hub+Neovim T2/Web exit0. Host check26.066s/tree2cd9fd92707a06ee619bf913ee803b931e1cb353 not remotely repeated. Linux c8lon1 Node24.21/nvim.12.5; HeadlessShell156/v1248; lifetime665s/$0.0462 not suite wall. No T3/T4 or release/integration/QA claim. Existing report-only lint133/60 and duration warnings retained. No findings; Coordinator owns enqueue/merge/release.

Criteria: C1 verified.

### coord · 2026-10-25T06:18:49.512Z

Merged 179047f120676e93be0c9524cda56f5cda879ce2 onto dev.
dependencies out of date: package-lock.json, package.json changed; run npm install in root /Users/evgeniyivanov/Projects/cland/v0 (required; stop shared readers before updating node_modules)
