---
id: T-643
kind: task
title: The hub's Claude Code launches carry bgIsolation = "none" only where the project's settings files lack the key
state: open
status: review
size: S
criterion_seq: 4
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
topic: topic-502
branch: t/T-643-the-hub-s-claude-code-launches-carry
created: 2026-10-16T16:23:58.322Z
updated: 2026-10-18T10:11:34.808Z
---

## Summary

A project whose `.claude/settings.json` lacks the managed key (one not yet updated) still gets `"worktree": {"bgIsolation": "none"}` in the `--settings` of the hub's Claude Code launches. Launch settings outrank every settings file in Claude Code, so the fallback is passed only when the project's own files set no value, and never defeats a human's `settings.local.json` (spec v0.1.4 §3.2).

## What to build

- In `hub/src/adapters/claude-code.ts`, where the launch's `--settings` object is built (cland's hooks and `env`): add `worktree: { bgIsolation: BG_ISOLATION }` (ticket T-642's constant) only when neither `.claude/settings.json` nor `.claude/settings.local.json` in the session's working directory (the root, or the item's task worktree) sets `worktree.bgIsolation`. Both files are only read; an unreadable or malformed file counts as not setting the key.
- Read at every launch and resume, so a change to the files applies at the next launch.
- The adapter's head comment and the hub README's Claude Code launch section say when the key is passed and why not always.
- This file is where T-603 (the `CLAUDE_CONFIG_DIR` rule) and T-631 (`--permission-mode auto`) also change the launch; this ticket lands after them.

## Acceptance criteria

- [x] C1. A fake Claude Code launched in a project whose settings files lack the key records `worktree.bgIsolation = "none"` in its launch settings (claude-code-adapter.test.ts).
  - done: impl-643 · 2026-10-18T10:10:28.235Z
- [x] C2. With the key in `.claude/settings.json`, the recorded launch settings carry no `worktree` key.
  - done: impl-643 · 2026-10-18T10:10:28.880Z
- [x] C3. With `"bgIsolation": "worktree"` in `.claude/settings.local.json` and no key in `settings.json`, the launch settings carry no `worktree` key, and `settings.local.json` is unchanged.
  - done: impl-643 · 2026-10-18T10:10:30.068Z
- [x] C4. A session launched for an item reads its task worktree's files, not the root's (test with the key present in one and absent in the other).
  - done: impl-643 · 2026-10-18T10:10:31.118Z

## Comments

### impl-643 · 2026-10-18T10:07:52.798Z

Implementation started at the adapter launch command seam. Use lowest-tier in-process execFile recording (as in claude-code-environment.test.ts) for settings precedence/cwd/relaunch; no additional fake harness process. Topic: topic-502.

### impl-643 · 2026-10-18T10:10:52.760Z

Implemented and pushed 15250f96; source review requested from reviewer role (resolved to rev-30). Evidence: A-5182 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5182-t-643-implementation-and-test-evidence.md. All C1–C4 marked done; lint, typecheck and serial targeted files passed. Awaiting source verdict before diff-selected droplet verification.

### rev-30 · 2026-10-18T10:11:34.808Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-643-source
commit: 15250f96000d1024ab977e09c4d5a2e4830ae256
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-5184: source clear, no findings. Conditional fallback uses session cwd and rereads both project/local files for every new launch/fresh resume/relaunch, respects explicit keys and malformed/unreadable policy, writes neither file. Existing authorization continuation/hooks/env/permissions retained. Recorded T2 permutations plus one existing native contract assertion cover C1–C4; runtime verification remains pending exact-head droplet evidence.
