---
id: T-973
kind: task
title: A test run flipped core.bare=true in the live repository (shared by all worktrees), breaking merge admission
state: open
status: in progress
size: S
labels:
  - bug
  - security
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: null
branch: t/T-973-a-test-run-flipped-core-bare-true-in-the
created: 2026-10-20T13:44:18.343Z
updated: 2026-10-20T16:40:03.829Z
---

## Summary

At 2026-10-20 13:31:25Z (.git/config mtime), `core.bare` became `true` in the live repository's config, which every task worktree shares. The hub's merge admission then failed with `merge-tiers: git rev-parse --show-toplevel: fatal: this operation must be run in a work tree`, dropping T-970 and T-972 (13:42:58Z). The Coordinator restored it with `git config core.bare false`. In that window, implementers impl-970 and impl-972 were running targeted test files in their task worktrees, and the Coordinator had just run bisection probes in detached worktrees of the live repository. The usual mechanism is `git init --bare` or `git clone --bare` running with GIT_DIR or GIT_COMMON_DIR inherited, which reinitialises the inherited repository as bare.

## What to build

Find the writer and close the class. Every test and fixture child strips GIT_DIR, GIT_WORK_TREE, GIT_COMMON_DIR, GIT_INDEX_FILE and the other GIT_* repository-location variables. The sealed builder from T-961 should already do this; check whether it covers these and whether the culprit bypassed it. The hub refuses to admit or batch while the root reports `core.bare=true`, with a clear message naming the fix. Rule 15 applies.

## Acceptance criteria

- [ ] C1. The writer is identified (test, command or session) from a reproduction in a scratch repository, or the evidence lists every candidate checked.
- [ ] C2. A T1 test with a poisoned GIT_DIR shows a fixture `git init --bare` / `clone --bare` cannot write the parent repository's config.
- [ ] C3. Merge admission reports `core.bare=true` in the root as its own clear error instead of a raw rev-parse failure.

## Comments

### coord · 2026-10-20T13:45:01.828Z

Coordinator investigation notes (13:45Z): impl-970 and impl-972 report that all their test runs used disposable roots and fixture environments that strip GIT_DIR, GIT_WORK_TREE and GIT_COMMON_DIR, and that only read-only or operational git ran in task worktrees. The Coordinator's bisect probes (13:13–13:28Z) ran node --test in detached worktrees of the live repository with only HOME replaced, which is a rule-15 gap, but they ended about 3 minutes before the 13:31:25Z write. Other sessions on this machine with worktrees of this repository include ~/.claude/jobs/723d0f6e/tmp/wt-fix and wt-ps (another Claude job), plus cland-explorer, brand, setup, onboarding and the research worktrees. The writer is unidentified; C1 stays open.
