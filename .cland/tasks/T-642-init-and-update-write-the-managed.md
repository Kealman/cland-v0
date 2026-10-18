---
id: T-642
kind: task
title: Init and update write the managed worktree.bgIsolation = "none" into .claude/settings.json and never touch settings.local.json
state: closed
status: done
size: S
criterion_seq: 5
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by:
  - T-639
topic: topic-495
branch: t/T-642-init-and-update-write-the-managed
created: 2026-10-16T16:23:58.091Z
updated: 2026-10-18T10:05:41.404Z
closed: 2026-10-18T10:05:41.404Z
---

## Summary

Claude Code 2.1.143 and later refuse a background session's Edit and Write in the main checkout until EnterWorktree (Q-600 question 12). `cland init` and `cland update` write `"worktree": {"bgIsolation": "none"}` into the project's `.claude/settings.json` as a managed key beside cland's hooks; `update` restores `"none"` after an edit; `.claude/settings.local.json`, where a human sets isolation back, is never read or written (spec v0.1.4 §3.2; Q-599 resolution 5).

## What to build

- **The value.** `BG_ISOLATION = 'none'` exported beside `HOOK_EVENTS` in `hub/src/adapters/claude-code.ts`, so init's settings and the hub's launch settings (ticket T-643) share one constant (prototype/setup 24ca0729).
- **The merge.** In `hub/src/init/claude-settings.ts`, `mergeWorktree` beside `mergeHooks`: `worktree.bgIsolation` set to cland's value; the other `worktree` keys (such as `baseRef`) and every other key of the file kept; the file written only when its content changes, so a second run reports it unchanged.
- **Never the local file.** Neither command opens `.claude/settings.local.json`.
- **Docs.** The comment at the head of `claude-settings.ts`, the managed set in `provision.ts`'s header and the hub README's managed-set table name the key, why it is managed, and that `settings.local.json` overrides it.
- **This repository.** After the merge the Coordinator runs `cland update` in the root and commits the new key: from then on the Coordinator's detached-worktree route for docs commits is no longer needed (spec §3.2).

## Acceptance criteria

- [x] C1. A fresh project's `.claude/settings.json` holds `"worktree": {"bgIsolation": "none"}` beside the cland hooks (init-settings.test.ts, on the scratch machine of ticket T-639).
  - done: impl-642 · 2026-10-18T09:22:24.267Z
  - verified: rev-30 [reviewer] · run rev-20261018-642-final · 2026-10-18T09:48:48.241Z · commit 90adfa3fb07faaf658c10092afe3b0f8bbec6d85
- [x] C2. After a human edit to `"bgIsolation": "worktree"`, `cland update` restores `"none"` and reports the file updated; a second `cland update` reports it unchanged.
  - done: impl-642 · 2026-10-18T09:22:25.204Z
  - verified: rev-30 [reviewer] · run rev-20261018-642-final · 2026-10-18T09:48:48.242Z · commit 90adfa3fb07faaf658c10092afe3b0f8bbec6d85
- [x] C3. A project's own hooks, `model` and `worktree.baseRef` survive init and update unchanged beside the managed key.
  - done: impl-642 · 2026-10-18T09:22:26.822Z
  - verified: rev-30 [reviewer] · run rev-20261018-642-final · 2026-10-18T09:48:48.242Z · commit 90adfa3fb07faaf658c10092afe3b0f8bbec6d85
- [x] C4. A `.claude/settings.local.json` holding `"bgIsolation": "worktree"` is byte-identical, with the same mtime, after init and update.
  - done: impl-642 · 2026-10-18T09:22:28.129Z
  - verified: rev-30 [reviewer] · run rev-20261018-642-final · 2026-10-18T09:48:48.242Z · commit 90adfa3fb07faaf658c10092afe3b0f8bbec6d85
- [x] C5. Demo: in a scratch project, `cland init`, an edit of the key, `cland update` and `git diff .claude/settings.json` show only the key restored.
  - done: impl-642 · 2026-10-18T09:22:28.875Z
  - verified: rev-30 [reviewer] · run rev-20261018-642-source · 2026-10-18T09:23:12.424Z · commit 90adfa3fb07faaf658c10092afe3b0f8bbec6d85

## Comments

### impl-642 · 2026-10-18T09:20:15.306Z

Started: using shared settings provisioner at T1 in init-settings.test.ts for C1-C4, with scratch init/update demo for C5. Existing task claim retained; repository settings and user state remain outside test targets.

### impl-642 · 2026-10-18T09:22:29.631Z

Implementation pushed at 90adfa3f on t/T-642-init-and-update-write-the-managed, after fetching/merging origin/dev 226bd904. Evidence A-5106 (scratch init/update diff) and A-5107 (red/green + scope). Host checks pass: test:lint, typecheck, git diff --check; init-settings.test.ts 4/4 in 0.143 s, existing init.test.ts 13/13 in 24.364 s. New tests carry 5 s timeouts and use no processes. Stage qaPolicy is none/after-stage, so source review only; droplet verify follows clear source verdict.

### rev-30 · 2026-10-18T09:23:12.424Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-642-source
commit: 90adfa3fb07faaf658c10092afe3b0f8bbec6d85
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, A-5109. Shared BG_ISOLATION and mergeWorktree overwrite only bgIsolation, preserving other settings/worktree keys; shared init/update provisioner retains byte/mtime-preserving unchanged path. No local settings path is read/written. Required docs and four filesystem-only T1 controls cover managed value, restoration, preservation and local override. C5 scratch CLI diff/demo A-5106 verified. C1–C4 remain pending accepted exact-head runtime evidence; A-5107 reported red/green/static checks retained. T-643/root update outside scope. No reviewer execution.

Criteria: C5 verified.

### impl-642 · 2026-10-18T09:48:22.397Z

Exact-head droplet verification green: bcf0ffec-515c-4747-9488-add1d2be854c at 90adfa3fb07faaf658c10092afe3b0f8bbec6d85, log A-5158. Linux x64 / Node v24.21.0, c-8 lon1, workers 2, machine lifetime 1245 s, $0.0864. Hub-only diff selection plus Neovim smoke: 2156 tests, 2151 passed, 0 failed, 5 skipped. New T1 init-settings file observed 0.009 s; report-only missing duration baseline is expected until integrated baseline refresh. Reviewer received same-head result directly; awaiting final evidence verdict without changing head.

### rev-30 · 2026-10-18T09:48:48.242Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-642-final
commit: 90adfa3fb07faaf658c10092afe3b0f8bbec6d85
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-5159: exact-head A-5158 / bcf0ffec passes hub plus Neovim smoke, 2151 pass/0 fail/5 outside-scope skips. All four settings cases have ordinary positive receipts and all four load gates pass 5/5; summed owned test seconds 0.009455488, no owned trips. C1–C4 verified; C5 scratch demo/source verification remains current. No findings. Post-merge repository update belongs to Coordinator.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-18T10:05:41.404Z

Merged e4f0db1f7441c6fab54c46312bbfacbfa3b60be7 onto dev.
