---
id: T-642
kind: task
title: Init and update write the managed worktree.bgIsolation = "none" into .claude/settings.json and never touch settings.local.json
state: open
status: in progress
size: S
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
updated: 2026-10-18T09:20:15.306Z
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

- [ ] C1. A fresh project's `.claude/settings.json` holds `"worktree": {"bgIsolation": "none"}` beside the cland hooks (init-settings.test.ts, on the scratch machine of ticket T-639).
- [ ] C2. After a human edit to `"bgIsolation": "worktree"`, `cland update` restores `"none"` and reports the file updated; a second `cland update` reports it unchanged.
- [ ] C3. A project's own hooks, `model` and `worktree.baseRef` survive init and update unchanged beside the managed key.
- [ ] C4. A `.claude/settings.local.json` holding `"bgIsolation": "worktree"` is byte-identical, with the same mtime, after init and update.
- [ ] C5. Demo: in a scratch project, `cland init`, an edit of the key, `cland update` and `git diff .claude/settings.json` show only the key restored.

## Comments

### impl-642 · 2026-10-18T09:20:15.306Z

Started: using shared settings provisioner at T1 in init-settings.test.ts for C1-C4, with scratch init/update demo for C5. Existing task claim retained; repository settings and user state remain outside test targets.
