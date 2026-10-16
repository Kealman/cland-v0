---
id: T-643
kind: task
title: The hub's Claude Code launches carry bgIsolation = "none" only where the project's settings files lack the key
state: open
status: planned
size: S
labels:
  - v0.1.4
  - init
  - hub
assignee: null
parent: E-612
blocked_by:
  - T-642
  - T-603
  - T-631
topic: null
branch: null
created: 2026-10-16T16:23:58.322Z
updated: 2026-10-16T16:24:32.846Z
---

## Summary

A project whose `.claude/settings.json` lacks the managed key (one not yet updated) still gets `"worktree": {"bgIsolation": "none"}` in the `--settings` of the hub's Claude Code launches. Launch settings outrank every settings file in Claude Code, so the fallback is passed only when the project's own files set no value, and never defeats a human's `settings.local.json` (spec v0.1.4 §3.2).

## What to build

- In `hub/src/adapters/claude-code.ts`, where the launch's `--settings` object is built (cland's hooks and `env`): add `worktree: { bgIsolation: BG_ISOLATION }` (ticket T-642's constant) only when neither `.claude/settings.json` nor `.claude/settings.local.json` in the session's working directory (the root, or the item's task worktree) sets `worktree.bgIsolation`. Both files are only read; an unreadable or malformed file counts as not setting the key.
- Read at every launch and resume, so a change to the files applies at the next launch.
- The adapter's head comment and the hub README's Claude Code launch section say when the key is passed and why not always.
- This file is where T-603 (the `CLAUDE_CONFIG_DIR` rule) and T-631 (`--permission-mode auto`) also change the launch; this ticket lands after them.

## Acceptance criteria

- [ ] C1. A fake Claude Code launched in a project whose settings files lack the key records `worktree.bgIsolation = "none"` in its launch settings (claude-code-adapter.test.ts).
- [ ] C2. With the key in `.claude/settings.json`, the recorded launch settings carry no `worktree` key.
- [ ] C3. With `"bgIsolation": "worktree"` in `.claude/settings.local.json` and no key in `settings.json`, the launch settings carry no `worktree` key, and `settings.local.json` is unchanged.
- [ ] C4. A session launched for an item reads its task worktree's files, not the root's (test with the key present in one and absent in the other).
